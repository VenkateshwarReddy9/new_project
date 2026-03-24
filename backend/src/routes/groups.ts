import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import { calculateGroupBalances } from '../services/balanceService';

const router = Router();
const prisma = new PrismaClient();

function getIo(req: AuthRequest) {
  return req.app.get('io');
}

async function logActivity(groupId: string, userId: string, type: string, data: object) {
  await prisma.activity.create({
    data: { groupId, userId, type, data: JSON.stringify(data) },
  });
}

async function assertMember(groupId: string, userId: string): Promise<void> {
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!member) throw Object.assign(new Error('Not a member of this group'), { status: 403 });
}

async function assertAdmin(groupId: string, userId: string): Promise<void> {
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!member || member.role !== 'admin') throw Object.assign(new Error('Admin access required'), { status: 403 });
}

// List user's groups
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.userId },
      include: {
        group: {
          include: {
            members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
            _count: { select: { expenses: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const groups = await Promise.all(memberships.map(async (m) => {
      const { netBalances } = await calculateGroupBalances(m.groupId);
      const myBalance = netBalances.find((b) => b.userId === req.userId);
      return {
        ...m.group,
        myBalance: myBalance?.amount ?? 0,
        memberCount: m.group.members.length,
        expenseCount: m.group._count.expenses,
        members: m.group.members.map((mem) => mem.user),
        role: m.role,
      };
    }));

    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Create group
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, emoji, color } = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      emoji: z.string().default('💰'),
      color: z.string().default('#6366f1'),
    }).parse(req.body);

    const group = await prisma.group.create({
      data: {
        name, description, emoji, color,
        members: { create: { userId: req.userId!, role: 'admin' } },
      },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      },
    });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });
    await logActivity(group.id, req.userId!, 'group_created', { groupName: name, userName: user?.name });

    res.status(201).json({ ...group, myBalance: 0, role: 'admin' });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.errors[0].message }); return; }
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Get group details
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await assertMember(req.params.id, req.userId!);

    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { expenses: true, settlements: true } },
      },
    });

    if (!group) { res.status(404).json({ error: 'Group not found' }); return; }

    const myMembership = group.members.find((m) => m.userId === req.userId);
    const { netBalances, simplifiedTransactions } = await calculateGroupBalances(req.params.id);

    res.json({
      ...group,
      members: group.members.map((m) => ({
        ...m.user,
        role: m.role,
        joinedAt: m.joinedAt,
        balance: netBalances.find((b) => b.userId === m.userId)?.amount ?? 0,
      })),
      myBalance: netBalances.find((b) => b.userId === req.userId)?.amount ?? 0,
      role: myMembership?.role ?? 'member',
      simplifiedTransactions,
      expenseCount: group._count.expenses,
      settlementCount: group._count.settlements,
    });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Update group
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await assertAdmin(req.params.id, req.userId!);

    const { name, description, emoji, color } = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional().nullable(),
      emoji: z.string().optional(),
      color: z.string().optional(),
    }).parse(req.body);

    const group = await prisma.group.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(description !== undefined && { description }), ...(emoji && { emoji }), ...(color && { color }) },
    });

    res.json(group);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.errors[0].message }); return; }
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Delete group
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await assertAdmin(req.params.id, req.userId!);
    await prisma.group.delete({ where: { id: req.params.id } });
    res.json({ message: 'Group deleted' });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Invite member by email
router.post('/:id/members', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await assertMember(req.params.id, req.userId!);

    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    let invitee = await prisma.user.findUnique({ where: { email } });

    if (!invitee) {
      // Create a placeholder user
      const tempPassword = Math.random().toString(36).slice(-8);
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      invitee = await prisma.user.create({
        data: { email, name: email.split('@')[0], passwordHash },
      });
    }

    const existing = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: invitee.id, groupId: req.params.id } },
    });
    if (existing) {
      res.status(400).json({ error: 'User is already a member' });
      return;
    }

    const member = await prisma.groupMember.create({
      data: { userId: invitee.id, groupId: req.params.id },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    const inviter = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });
    await logActivity(req.params.id, req.userId!, 'member_joined', { userName: invitee.name, inviterName: inviter?.name });

    getIo(req).to(`group:${req.params.id}`).emit('member:joined', member.user);

    res.status(201).json(member.user);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.errors[0].message }); return; }
    console.error(err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Remove member
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: groupId, userId: targetUserId } = req.params;

    // Can remove self or admin can remove others
    if (targetUserId !== req.userId) {
      await assertAdmin(groupId, req.userId!);
    }

    await prisma.groupMember.delete({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });
    await logActivity(groupId, req.userId!, 'member_left', { userId: targetUserId, userName: user?.name });

    res.json({ message: 'Member removed' });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Get group balances
router.get('/:id/balances', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await assertMember(req.params.id, req.userId!);
    const balances = await calculateGroupBalances(req.params.id);
    res.json(balances);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    res.status(500).json({ error: 'Failed to calculate balances' });
  }
});

// Get group activity
router.get('/:id/activity', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await assertMember(req.params.id, req.userId!);

    const page = parseInt(req.query.page as string || '1');
    const limit = 20;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where: { groupId: req.params.id },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.activity.count({ where: { groupId: req.params.id } }),
    ]);

    res.json({
      activities: activities.map((a) => ({ ...a, data: JSON.parse(a.data) })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Export group to CSV
router.get('/:id/export/csv', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await assertMember(req.params.id, req.userId!);

    const [group, expenses] = await Promise.all([
      prisma.group.findUnique({ where: { id: req.params.id } }),
      prisma.expense.findMany({
        where: { groupId: req.params.id },
        include: {
          paidBy: { select: { name: true, email: true } },
          splits: { include: { user: { select: { name: true, email: true } } } },
        },
        orderBy: { date: 'desc' },
      }),
    ]);

    const rows = ['Date,Title,Category,Amount,Currency,Paid By,Split Type,Notes'];
    for (const e of expenses) {
      rows.push([
        new Date(e.date).toISOString().split('T')[0],
        `"${e.title.replace(/"/g, '""')}"`,
        e.category,
        e.amount.toFixed(2),
        e.currency,
        `"${e.paidBy.name}"`,
        e.splitType,
        `"${(e.notes || '').replace(/"/g, '""')}"`,
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${group?.name || 'group'}-expenses.csv"`);
    res.send(rows.join('\n'));
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    res.status(500).json({ error: 'Failed to export' });
  }
});

export default router;
