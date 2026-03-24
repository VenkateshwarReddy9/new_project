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

// ─── Financial tips generator ──────────────────────────────────────────────
function generateFinancialTips(params: {
  byCategory: { category: string; amount: number }[];
  totalSpent: number;
  prevTotalSpent: number;
  topExpenses: { title: string; amount: number; category: string }[];
  period: 'month' | 'year';
}): { icon: string; severity: 'info' | 'warning' | 'success'; message: string }[] {
  const { byCategory, totalSpent, prevTotalSpent, topExpenses, period } = params;
  const tips: { icon: string; severity: 'info' | 'warning' | 'success'; message: string }[] = [];

  if (totalSpent === 0) return tips;

  const pctChange = prevTotalSpent > 0 ? ((totalSpent - prevTotalSpent) / prevTotalSpent) * 100 : 0;

  // Spending trend
  if (pctChange > 25) {
    tips.push({
      icon: '📈',
      severity: 'warning',
      message: `Your spending increased by ${pctChange.toFixed(0)}% compared to the previous ${period}. Review your expenses and identify areas to cut back.`,
    });
  } else if (pctChange < -10 && prevTotalSpent > 0) {
    tips.push({
      icon: '🎉',
      severity: 'success',
      message: `Great job! You spent ${Math.abs(pctChange).toFixed(0)}% less than the previous ${period}. Keep up the good financial habits.`,
    });
  }

  // Category-specific tips
  for (const cat of byCategory) {
    const pct = (cat.amount / totalSpent) * 100;
    if (cat.category === 'food' || cat.category === 'dining') {
      if (pct > 35) {
        tips.push({
          icon: '🍽️',
          severity: 'warning',
          message: `Food & dining accounts for ${pct.toFixed(0)}% of your spending ($${cat.amount.toFixed(2)}). Try meal prepping or cooking at home to cut this by 30–40%.`,
        });
      }
    }
    if (cat.category === 'entertainment') {
      if (pct > 20) {
        tips.push({
          icon: '🎬',
          severity: 'warning',
          message: `Entertainment is ${pct.toFixed(0)}% of your budget. Set a monthly entertainment cap (e.g. $${(totalSpent * 0.15).toFixed(0)}) to stay on track.`,
        });
      }
    }
    if (cat.category === 'shopping') {
      if (pct > 30) {
        tips.push({
          icon: '🛍️',
          severity: 'warning',
          message: `Shopping is consuming ${pct.toFixed(0)}% of your budget. Try the 24-hour rule: wait a day before making non-essential purchases.`,
        });
      }
    }
    if (cat.category === 'transport' || cat.category === 'transportation') {
      if (pct > 20) {
        tips.push({
          icon: '🚗',
          severity: 'info',
          message: `Transport costs are ${pct.toFixed(0)}% of your spending. Explore carpooling, public transit, or cycling to reduce costs.`,
        });
      }
    }
  }

  // Single largest expense check
  if (topExpenses.length > 0) {
    const biggestExpense = topExpenses[0];
    if (biggestExpense.amount > totalSpent * 0.3) {
      tips.push({
        icon: '💸',
        severity: 'info',
        message: `Your largest single expense was "${biggestExpense.title}" at $${biggestExpense.amount.toFixed(2)} — that's ${((biggestExpense.amount / totalSpent) * 100).toFixed(0)}% of your total. Plan ahead for big purchases by saving incrementally each month.`,
      });
    }
  }

  // General savings tip based on 50/30/20 rule
  const savingsTarget = totalSpent * 0.2;
  tips.push({
    icon: '💰',
    severity: 'info',
    message: `Based on the 50/30/20 rule, you should aim to save at least $${savingsTarget.toFixed(2)} this ${period} (20% of spending). Consider automating a savings transfer on payday.`,
  });

  // Emergency fund reminder
  if (period === 'month') {
    tips.push({
      icon: '🏦',
      severity: 'info',
      message: `Ensure you have 3–6 months of expenses ($${(totalSpent * 3).toFixed(0)}–$${(totalSpent * 6).toFixed(0)}) in an emergency fund. If not, prioritize building it before other investments.`,
    });
  }

  return tips.slice(0, 6); // Max 6 tips
}

// Monthly Review: GET /dashboard/analytics/monthly-review?month=YYYY-MM
router.get('/analytics/monthly-review', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const monthParam = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const [year, month] = monthParam.split('-').map(Number);

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // Previous month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const startOfPrevMonth = new Date(prevYear, prevMonth - 1, 1);
    const endOfPrevMonth = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);

    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.userId },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);

    if (groupIds.length === 0) {
      res.json({ month: monthParam, totalSpent: 0, prevTotalSpent: 0, byCategory: [], topExpenses: [], dailySpending: [], tips: [] });
      return;
    }

    const [currentExpenses, prevExpenses] = await Promise.all([
      prisma.expense.findMany({
        where: { groupId: { in: groupIds }, date: { gte: startOfMonth, lte: endOfMonth } },
        include: { splits: { where: { userId: req.userId } } },
        orderBy: { amount: 'desc' },
      }),
      prisma.expense.findMany({
        where: { groupId: { in: groupIds }, date: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
        include: { splits: { where: { userId: req.userId } } },
      }),
    ]);

    function userAmount(e: any) {
      const split = e.splits[0];
      return split ? split.amount : 0;
    }

    const totalSpent = currentExpenses.reduce((sum, e) => sum + userAmount(e), 0);
    const prevTotalSpent = prevExpenses.reduce((sum, e) => sum + userAmount(e), 0);

    // By category
    const categoryMap = new Map<string, number>();
    for (const e of currentExpenses) {
      const amt = userAmount(e);
      if (amt === 0) continue;
      categoryMap.set(e.category, (categoryMap.get(e.category) ?? 0) + amt);
    }
    const byCategory = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);

    // Top expenses
    const topExpenses = currentExpenses
      .filter((e) => userAmount(e) > 0)
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        title: e.title,
        amount: Math.round(userAmount(e) * 100) / 100,
        category: e.category,
        date: e.date,
      }));

    // Daily spending (each day of the month)
    const daysInMonth = endOfMonth.getDate();
    const dailyMap = new Map<number, number>();
    for (let d = 1; d <= daysInMonth; d++) dailyMap.set(d, 0);
    for (const e of currentExpenses) {
      const day = new Date(e.date).getDate();
      const amt = userAmount(e);
      if (amt > 0) dailyMap.set(day, (dailyMap.get(day) ?? 0) + amt);
    }
    const dailySpending = Array.from(dailyMap.entries()).map(([day, amount]) => ({
      day,
      amount: Math.round(amount * 100) / 100,
    }));

    // Previous month category breakdown for comparison
    const prevCategoryMap = new Map<string, number>();
    for (const e of prevExpenses) {
      const amt = userAmount(e);
      if (amt === 0) continue;
      prevCategoryMap.set(e.category, (prevCategoryMap.get(e.category) ?? 0) + amt);
    }
    const prevByCategory = Array.from(prevCategoryMap.entries()).map(([category, amount]) => ({ category, amount }));

    const tips = generateFinancialTips({ byCategory, totalSpent, prevTotalSpent, topExpenses, period: 'month' });

    res.json({
      month: monthParam,
      monthLabel: startOfMonth.toLocaleString('default', { month: 'long', year: 'numeric' }),
      totalSpent: Math.round(totalSpent * 100) / 100,
      prevTotalSpent: Math.round(prevTotalSpent * 100) / 100,
      pctChange: prevTotalSpent > 0 ? Math.round(((totalSpent - prevTotalSpent) / prevTotalSpent) * 10000) / 100 : null,
      byCategory,
      prevByCategory,
      topExpenses,
      dailySpending,
      tips,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load monthly review' });
  }
});

// Yearly Review: GET /dashboard/analytics/yearly-review?year=YYYY
router.get('/analytics/yearly-review', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));
    const prevYear = year - 1;

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
    const startOfPrevYear = new Date(prevYear, 0, 1);
    const endOfPrevYear = new Date(prevYear, 11, 31, 23, 59, 59, 999);

    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.userId },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);

    if (groupIds.length === 0) {
      res.json({ year, totalSpent: 0, prevTotalSpent: 0, byMonth: [], byCategory: [], topExpenses: [], tips: [] });
      return;
    }

    const [yearExpenses, prevYearExpenses] = await Promise.all([
      prisma.expense.findMany({
        where: { groupId: { in: groupIds }, date: { gte: startOfYear, lte: endOfYear } },
        include: { splits: { where: { userId: req.userId } } },
        orderBy: { amount: 'desc' },
      }),
      prisma.expense.findMany({
        where: { groupId: { in: groupIds }, date: { gte: startOfPrevYear, lte: endOfPrevYear } },
        include: { splits: { where: { userId: req.userId } } },
      }),
    ]);

    function userAmount(e: any) {
      const split = e.splits[0];
      return split ? split.amount : 0;
    }

    const totalSpent = yearExpenses.reduce((sum, e) => sum + userAmount(e), 0);
    const prevTotalSpent = prevYearExpenses.reduce((sum, e) => sum + userAmount(e), 0);

    // By month (all 12)
    const monthMap = new Map<number, number>();
    for (let m = 1; m <= 12; m++) monthMap.set(m, 0);
    for (const e of yearExpenses) {
      const m = new Date(e.date).getMonth() + 1;
      const amt = userAmount(e);
      monthMap.set(m, (monthMap.get(m) ?? 0) + amt);
    }
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const byMonth = Array.from(monthMap.entries()).map(([monthNum, amount]) => ({
      monthNum,
      month: MONTH_NAMES[monthNum - 1],
      amount: Math.round(amount * 100) / 100,
    }));

    // By category
    const categoryMap = new Map<string, number>();
    for (const e of yearExpenses) {
      const amt = userAmount(e);
      if (amt === 0) continue;
      categoryMap.set(e.category, (categoryMap.get(e.category) ?? 0) + amt);
    }
    const byCategory = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);

    // Top 10 most expensive expenses
    const topExpenses = yearExpenses
      .filter((e) => userAmount(e) > 0)
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        title: e.title,
        amount: Math.round(userAmount(e) * 100) / 100,
        category: e.category,
        date: e.date,
      }));

    // Best and worst month
    const sortedMonths = [...byMonth].filter((m) => m.amount > 0).sort((a, b) => b.amount - a.amount);
    const worstMonth = sortedMonths[0] || null;
    const bestMonth = sortedMonths[sortedMonths.length - 1] || null;

    const tips = generateFinancialTips({ byCategory, totalSpent, prevTotalSpent, topExpenses, period: 'year' });

    res.json({
      year,
      totalSpent: Math.round(totalSpent * 100) / 100,
      prevTotalSpent: Math.round(prevTotalSpent * 100) / 100,
      pctChange: prevTotalSpent > 0 ? Math.round(((totalSpent - prevTotalSpent) / prevTotalSpent) * 10000) / 100 : null,
      monthlyAvg: Math.round((totalSpent / 12) * 100) / 100,
      byMonth,
      byCategory,
      topExpenses,
      worstMonth,
      bestMonth,
      tips,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load yearly review' });
  }
});

export default router;
