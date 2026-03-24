import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';

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

async function assertGroupMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!member) throw Object.assign(new Error('Not a member of this group'), { status: 403 });
}

// Get settlements for a group
router.get('/group/:groupId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await assertGroupMember(req.params.groupId, req.userId!);

    const settlements = await prisma.settlement.findMany({
      where: { groupId: req.params.groupId },
      include: {
        payer: { select: { id: true, name: true, email: true, avatar: true } },
        payee: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { date: 'desc' },
    });

    res.json(settlements);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

// Create settlement
router.post('/group/:groupId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await assertGroupMember(req.params.groupId, req.userId!);

    const { payerId, payeeId, amount, currency, notes, date } = z.object({
      payerId: z.string(),
      payeeId: z.string(),
      amount: z.number().positive(),
      currency: z.string().default('USD'),
      notes: z.string().optional(),
      date: z.string().optional(),
    }).parse(req.body);

    if (payerId === payeeId) {
      res.status(400).json({ error: 'Payer and payee cannot be the same' });
      return;
    }

    // Verify both users are group members
    const [payer, payee] = await Promise.all([
      prisma.groupMember.findUnique({ where: { userId_groupId: { userId: payerId, groupId: req.params.groupId } } }),
      prisma.groupMember.findUnique({ where: { userId_groupId: { userId: payeeId, groupId: req.params.groupId } } }),
    ]);

    if (!payer || !payee) {
      res.status(400).json({ error: 'Both users must be group members' });
      return;
    }

    const settlement = await prisma.settlement.create({
      data: {
        groupId: req.params.groupId,
        payerId,
        payeeId,
        amount,
        currency,
        notes,
        date: date ? new Date(date) : new Date(),
      },
      include: {
        payer: { select: { id: true, name: true, email: true, avatar: true } },
        payee: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    await logActivity(req.params.groupId, req.userId!, 'settlement_added', {
      payerName: settlement.payer.name,
      payeeName: settlement.payee.name,
      amount,
      currency,
    });

    getIo(req).to(`group:${req.params.groupId}`).emit('settlement:added', settlement);

    res.status(201).json(settlement);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.errors[0].message }); return; }
    console.error(err);
    res.status(500).json({ error: 'Failed to create settlement' });
  }
});

// Delete settlement
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settlement = await prisma.settlement.findUnique({ where: { id: req.params.id } });
    if (!settlement) { res.status(404).json({ error: 'Settlement not found' }); return; }
    await assertGroupMember(settlement.groupId, req.userId!);

    await prisma.settlement.delete({ where: { id: req.params.id } });
    res.json({ message: 'Settlement deleted' });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    res.status(500).json({ error: 'Failed to delete settlement' });
  }
});

export default router;
