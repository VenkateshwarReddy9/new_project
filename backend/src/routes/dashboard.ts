import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { calculateUserOverallBalance } from '../services/balanceService';

const router = Router();
const prisma = new PrismaClient();

// Dashboard overview
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [overallBalance, recentActivity, groupMemberships] = await Promise.all([
      calculateUserOverallBalance(req.userId!),
      prisma.activity.findMany({
        where: {
          group: {
            members: { some: { userId: req.userId } },
          },
        },
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
          group: { select: { id: true, name: true, emoji: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.groupMember.findMany({
        where: { userId: req.userId },
        include: {
          group: {
            select: { id: true, name: true, emoji: true, color: true },
          },
        },
      }),
    ]);

    res.json({
      ...overallBalance,
      recentActivity: recentActivity.map((a) => ({ ...a, data: JSON.parse(a.data) })),
      groupCount: groupMemberships.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Analytics
router.get('/analytics', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = req.query.groupId as string | undefined;

    // Get user's groups
    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.userId, ...(groupId && { groupId }) },
      select: { groupId: true },
    });

    const groupIds = memberships.map((m) => m.groupId);

    if (groupIds.length === 0) {
      res.json({ byCategory: [], byMonth: [], topSpenders: [] });
      return;
    }

    // Spending by category
    const expenses = await prisma.expense.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        splits: { where: { userId: req.userId } },
        paidBy: { select: { id: true, name: true } },
      },
    });

    // By category (only expenses that involve the current user)
    const categoryMap = new Map<string, number>();
    for (const e of expenses) {
      const mySplit = e.splits[0];
      if (!mySplit && e.paidById !== req.userId) continue;
      const amount = mySplit ? mySplit.amount : 0;
      categoryMap.set(e.category, (categoryMap.get(e.category) ?? 0) + amount);
    }
    const byCategory = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);

    // By month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const recentExpenses = expenses.filter((e) => new Date(e.date) >= sixMonthsAgo);
    const monthMap = new Map<string, number>();

    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, 0);
    }

    for (const e of recentExpenses) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mySplit = e.splits[0];
      const amount = mySplit ? mySplit.amount : 0;
      if (monthMap.has(key)) {
        monthMap.set(key, (monthMap.get(key) ?? 0) + amount);
      }
    }

    const byMonth = Array.from(monthMap.entries())
      .map(([month, amount]) => ({
        month,
        amount: Math.round(amount * 100) / 100,
        label: new Date(month + '-01').toLocaleString('default', { month: 'short', year: 'numeric' }),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Top spenders in selected group (only relevant if groupId provided)
    let topSpenders: { userId: string; name: string; avatar: string | null; amount: number }[] = [];
    if (groupId) {
      const allExpenses = await prisma.expense.findMany({
        where: { groupId },
        include: { paidBy: { select: { id: true, name: true, avatar: true } } },
      });
      const spenderMap = new Map<string, { name: string; avatar: string | null; amount: number }>();
      for (const e of allExpenses) {
        const existing = spenderMap.get(e.paidById);
        if (existing) {
          existing.amount += e.amount;
        } else {
          spenderMap.set(e.paidById, { name: e.paidBy.name, avatar: e.paidBy.avatar, amount: e.amount });
        }
      }
      topSpenders = Array.from(spenderMap.entries())
        .map(([userId, data]) => ({ userId, ...data, amount: Math.round(data.amount * 100) / 100 }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
    }

    res.json({ byCategory, byMonth, topSpenders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

export default router;
