import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';
import { computeExpenseSplits } from '../services/balanceService';

const router = Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

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

const expenseSchema = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  category: z.string().default('other'),
  notes: z.string().optional(),
  date: z.string().optional(),
  paidById: z.string(),
  splitType: z.enum(['equal', 'exact', 'percentage', 'shares']).default('equal'),
  memberIds: z.array(z.string()).min(1),
  splitData: z.record(z.number()).optional(),
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
});

// Get expenses for a group
router.get('/group/:groupId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await assertGroupMember(req.params.groupId, req.userId!);

    const page = parseInt(req.query.page as string || '1');
    const limit = 20;
    const category = req.query.category as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const where: any = { groupId: req.params.groupId };
    if (category) where.category = category;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          paidBy: { select: { id: true, name: true, email: true, avatar: true } },
          splits: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);

    // Annotate with current user's split
    const annotated = expenses.map((e) => {
      const mySplit = e.splits.find((s) => s.userId === req.userId);
      const iAmPayer = e.paidById === req.userId;
      let myShare = 0;
      if (mySplit) {
        myShare = iAmPayer ? mySplit.amount - e.amount : -mySplit.amount;
      }
      return { ...e, myShare };
    });

    res.json({ expenses: annotated, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Create expense
router.post('/group/:groupId', upload.single('receipt'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await assertGroupMember(req.params.groupId, req.userId!);

    const body = expenseSchema.parse({
      ...req.body,
      amount: parseFloat(req.body.amount),
      memberIds: typeof req.body.memberIds === 'string' ? JSON.parse(req.body.memberIds) : req.body.memberIds,
      splitData: req.body.splitData ? (typeof req.body.splitData === 'string' ? JSON.parse(req.body.splitData) : req.body.splitData) : undefined,
      isRecurring: req.body.isRecurring === 'true' || req.body.isRecurring === true,
    });

    const receiptUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const splitAmounts = await computeExpenseSplits(
      body.memberIds,
      body.amount,
      body.splitType,
      body.splitData,
    );

    const expense = await prisma.expense.create({
      data: {
        groupId: req.params.groupId,
        paidById: body.paidById,
        title: body.title,
        amount: body.amount,
        currency: body.currency,
        category: body.category,
        notes: body.notes,
        receiptUrl,
        date: body.date ? new Date(body.date) : new Date(),
        splitType: body.splitType,
        isRecurring: body.isRecurring,
        recurringFrequency: body.recurringFrequency,
        splits: {
          create: body.memberIds.map((id) => ({
            userId: id,
            amount: splitAmounts[id] ?? 0,
            shares: body.splitData?.[id] ?? 1,
          })),
        },
      },
      include: {
        paidBy: { select: { id: true, name: true, email: true, avatar: true } },
        splits: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      },
    });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });
    await logActivity(req.params.groupId, req.userId!, 'expense_added', {
      expenseId: expense.id,
      title: expense.title,
      amount: expense.amount,
      currency: expense.currency,
      userName: user?.name,
    });

    getIo(req).to(`group:${req.params.groupId}`).emit('expense:added', expense);

    res.status(201).json(expense);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.errors[0].message }); return; }
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create expense' });
  }
});

// Get single expense
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: {
        paidBy: { select: { id: true, name: true, email: true, avatar: true } },
        splits: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      },
    });
    if (!expense) { res.status(404).json({ error: 'Expense not found' }); return; }
    await assertGroupMember(expense.groupId, req.userId!);
    res.json(expense);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// Update expense
router.put('/:id', upload.single('receipt'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) { res.status(404).json({ error: 'Expense not found' }); return; }
    await assertGroupMember(existing.groupId, req.userId!);

    // Only payer can edit
    if (existing.paidById !== req.userId) {
      // Check if admin
      const member = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId: req.userId!, groupId: existing.groupId } },
      });
      if (member?.role !== 'admin') {
        res.status(403).json({ error: 'Only the payer or a group admin can edit this expense' });
        return;
      }
    }

    const body = expenseSchema.partial().parse({
      ...req.body,
      amount: req.body.amount ? parseFloat(req.body.amount) : undefined,
      memberIds: req.body.memberIds ? (typeof req.body.memberIds === 'string' ? JSON.parse(req.body.memberIds) : req.body.memberIds) : undefined,
      splitData: req.body.splitData ? (typeof req.body.splitData === 'string' ? JSON.parse(req.body.splitData) : req.body.splitData) : undefined,
    });

    const receiptUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const updateData: any = {};
    if (body.title) updateData.title = body.title;
    if (body.amount) updateData.amount = body.amount;
    if (body.currency) updateData.currency = body.currency;
    if (body.category) updateData.category = body.category;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (receiptUrl) updateData.receiptUrl = receiptUrl;
    if (body.date) updateData.date = new Date(body.date);
    if (body.splitType) updateData.splitType = body.splitType;
    if (body.paidById) updateData.paidById = body.paidById;

    // Recalculate splits if needed
    if (body.memberIds || body.amount || body.splitType || body.splitData) {
      const memberIds = body.memberIds || (await prisma.expenseSplit.findMany({ where: { expenseId: req.params.id } })).map((s) => s.userId);
      const amount = body.amount || existing.amount;
      const splitType = body.splitType || existing.splitType;
      const splitAmounts = await computeExpenseSplits(memberIds, amount, splitType, body.splitData);

      await prisma.expenseSplit.deleteMany({ where: { expenseId: req.params.id } });
      updateData.splits = {
        create: memberIds.map((id) => ({
          userId: id,
          amount: splitAmounts[id] ?? 0,
          shares: body.splitData?.[id] ?? 1,
        })),
      };
    }

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        paidBy: { select: { id: true, name: true, email: true, avatar: true } },
        splits: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      },
    });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });
    await logActivity(existing.groupId, req.userId!, 'expense_edited', {
      expenseId: expense.id,
      title: expense.title,
      userName: user?.name,
    });

    getIo(req).to(`group:${existing.groupId}`).emit('expense:updated', expense);

    res.json(expense);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.errors[0].message }); return; }
    console.error(err);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Delete expense
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) { res.status(404).json({ error: 'Expense not found' }); return; }
    await assertGroupMember(existing.groupId, req.userId!);

    if (existing.paidById !== req.userId) {
      const member = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId: req.userId!, groupId: existing.groupId } },
      });
      if (member?.role !== 'admin') {
        res.status(403).json({ error: 'Only the payer or group admin can delete this expense' });
        return;
      }
    }

    await prisma.expense.delete({ where: { id: req.params.id } });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });
    await logActivity(existing.groupId, req.userId!, 'expense_deleted', {
      title: existing.title,
      amount: existing.amount,
      userName: user?.name,
    });

    getIo(req).to(`group:${existing.groupId}`).emit('expense:deleted', { id: req.params.id });

    res.json({ message: 'Expense deleted' });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.message }); return; }
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
