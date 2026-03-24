import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface Balance {
  userId: string;
  name: string;
  email: string;
  avatar?: string | null;
  amount: number; // positive = owed money, negative = owes money
}

export interface Transaction {
  from: { id: string; name: string; email: string; avatar?: string | null };
  to: { id: string; name: string; email: string; avatar?: string | null };
  amount: number;
}

export interface GroupBalance {
  netBalances: Balance[];
  simplifiedTransactions: Transaction[];
  rawDebts: { fromId: string; toId: string; amount: number }[];
}

/**
 * Calculates net balances for all members in a group.
 * For each expense: the payer is credited the full amount,
 * and each split participant is debited their share.
 * Settlements are also accounted for.
 */
export async function calculateGroupBalances(groupId: string): Promise<GroupBalance> {
  const [expenses, settlements, members] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId },
      include: {
        splits: { include: { user: true } },
        paidBy: true,
      },
    }),
    prisma.settlement.findMany({
      where: { groupId },
      include: { payer: true, payee: true },
    }),
    prisma.groupMember.findMany({
      where: { groupId },
      include: { user: true },
    }),
  ]);

  // Initialize net balance map: userId -> net amount
  const netBalanceMap = new Map<string, number>();
  const userMap = new Map<string, { id: string; name: string; email: string; avatar?: string | null }>();

  for (const member of members) {
    netBalanceMap.set(member.userId, 0);
    userMap.set(member.userId, {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      avatar: member.user.avatar,
    });
  }

  // Process expenses
  for (const expense of expenses) {
    // Payer gets credited the full amount
    const payerBalance = netBalanceMap.get(expense.paidById) ?? 0;
    netBalanceMap.set(expense.paidById, payerBalance + expense.amount);

    // Each split participant is debited their share
    for (const split of expense.splits) {
      const splitBalance = netBalanceMap.get(split.userId) ?? 0;
      netBalanceMap.set(split.userId, splitBalance - split.amount);
    }
  }

  // Process settlements: payer's debt decreases, payee's credit decreases
  for (const settlement of settlements) {
    const payerBalance = netBalanceMap.get(settlement.payerId) ?? 0;
    netBalanceMap.set(settlement.payerId, payerBalance + settlement.amount);

    const payeeBalance = netBalanceMap.get(settlement.payeeId) ?? 0;
    netBalanceMap.set(settlement.payeeId, payeeBalance - settlement.amount);
  }

  // Build net balances array
  const netBalances: Balance[] = [];
  for (const [userId, amount] of netBalanceMap.entries()) {
    const user = userMap.get(userId);
    if (user) {
      netBalances.push({
        userId,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        amount: Math.round(amount * 100) / 100,
      });
    }
  }

  // Compute raw pairwise debts (before simplification)
  const rawDebts = computeRawDebts(expenses, settlements);

  // Simplify debts using greedy algorithm
  const simplifiedTransactions = simplifyDebts(netBalances, userMap);

  return { netBalances, simplifiedTransactions, rawDebts };
}

/**
 * Greedy debt simplification algorithm:
 * 1. Separate users into creditors (positive balance) and debtors (negative balance)
 * 2. Repeatedly match the largest debtor with the largest creditor
 * 3. Continue until all balances are settled
 * This minimizes the number of transactions.
 */
function simplifyDebts(
  balances: Balance[],
  userMap: Map<string, { id: string; name: string; email: string; avatar?: string | null }>
): Transaction[] {
  const transactions: Transaction[] = [];

  // Copy and filter out zero balances
  const credits = balances
    .filter((b) => b.amount > 0.005)
    .map((b) => ({ ...b }));
  const debts = balances
    .filter((b) => b.amount < -0.005)
    .map((b) => ({ ...b, amount: -b.amount })); // Make positive for easier math

  // Sort descending by amount
  credits.sort((a, b) => b.amount - a.amount);
  debts.sort((a, b) => b.amount - a.amount);

  let ci = 0;
  let di = 0;

  while (ci < credits.length && di < debts.length) {
    const credit = credits[ci];
    const debt = debts[di];

    const amount = Math.min(credit.amount, debt.amount);

    if (amount > 0.005) {
      const fromUser = userMap.get(debt.userId)!;
      const toUser = userMap.get(credit.userId)!;

      transactions.push({
        from: fromUser,
        to: toUser,
        amount: Math.round(amount * 100) / 100,
      });
    }

    credit.amount -= amount;
    debt.amount -= amount;

    if (credit.amount < 0.005) ci++;
    if (debt.amount < 0.005) di++;
  }

  return transactions;
}

function computeRawDebts(
  expenses: Array<{
    paidById: string;
    splits: Array<{ userId: string; amount: number }>;
  }>,
  settlements: Array<{ payerId: string; payeeId: string; amount: number }>
): { fromId: string; toId: string; amount: number }[] {
  // Build pairwise debt map: "fromId->toId" -> amount
  const debtMap = new Map<string, number>();

  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (split.userId === expense.paidById) continue; // Skip payer's own share
      const key = `${split.userId}->${expense.paidById}`;
      const current = debtMap.get(key) ?? 0;
      debtMap.set(key, current + split.amount);
    }
  }

  // Apply settlements to reduce debts
  for (const settlement of settlements) {
    // settlement.payerId paid settlement.payeeId
    const key = `${settlement.payerId}->${settlement.payeeId}`;
    const current = debtMap.get(key) ?? 0;
    const newAmount = current - settlement.amount;
    if (newAmount > 0) {
      debtMap.set(key, newAmount);
    } else {
      debtMap.delete(key);
      // If overpaid, reverse direction
      if (newAmount < 0) {
        const reverseKey = `${settlement.payeeId}->${settlement.payerId}`;
        const reverseCurrent = debtMap.get(reverseKey) ?? 0;
        debtMap.set(reverseKey, reverseCurrent + Math.abs(newAmount));
      }
    }
  }

  const rawDebts: { fromId: string; toId: string; amount: number }[] = [];
  for (const [key, amount] of debtMap.entries()) {
    if (amount > 0.005) {
      const [fromId, toId] = key.split('->');
      rawDebts.push({ fromId, toId, amount: Math.round(amount * 100) / 100 });
    }
  }

  return rawDebts;
}

/**
 * Calculate overall balance for a user across all their groups.
 */
export async function calculateUserOverallBalance(userId: string): Promise<{
  totalOwed: number;
  totalOwes: number;
  netBalance: number;
  byGroup: Array<{ groupId: string; groupName: string; balance: number }>;
}> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: { group: true },
  });

  const byGroup: Array<{ groupId: string; groupName: string; balance: number }> = [];
  let totalOwed = 0;
  let totalOwes = 0;

  for (const membership of memberships) {
    const { netBalances } = await calculateGroupBalances(membership.groupId);
    const myBalance = netBalances.find((b) => b.userId === userId);
    const balance = myBalance?.amount ?? 0;

    byGroup.push({
      groupId: membership.groupId,
      groupName: membership.group.name,
      balance,
    });

    if (balance > 0) totalOwed += balance;
    else if (balance < 0) totalOwes += Math.abs(balance);
  }

  return {
    totalOwed: Math.round(totalOwed * 100) / 100,
    totalOwes: Math.round(totalOwes * 100) / 100,
    netBalance: Math.round((totalOwed - totalOwes) * 100) / 100,
    byGroup,
  };
}

export async function computeExpenseSplits(
  members: string[],
  amount: number,
  splitType: string,
  splitData?: Record<string, number>
): Promise<Record<string, number>> {
  const splits: Record<string, number> = {};

  switch (splitType) {
    case 'equal': {
      const share = Math.round((amount / members.length) * 100) / 100;
      let remaining = amount;
      members.forEach((id, idx) => {
        if (idx === members.length - 1) {
          splits[id] = Math.round(remaining * 100) / 100;
        } else {
          splits[id] = share;
          remaining -= share;
        }
      });
      break;
    }

    case 'exact': {
      if (!splitData) throw new Error('splitData required for exact split');
      let total = 0;
      for (const id of members) {
        splits[id] = splitData[id] ?? 0;
        total += splits[id];
      }
      if (Math.abs(total - amount) > 0.01) {
        throw new Error(`Exact amounts (${total}) do not sum to expense amount (${amount})`);
      }
      break;
    }

    case 'percentage': {
      if (!splitData) throw new Error('splitData required for percentage split');
      let totalPct = 0;
      for (const id of members) totalPct += splitData[id] ?? 0;
      if (Math.abs(totalPct - 100) > 0.01) {
        throw new Error(`Percentages must sum to 100, got ${totalPct}`);
      }
      let remaining = amount;
      members.forEach((id, idx) => {
        if (idx === members.length - 1) {
          splits[id] = Math.round(remaining * 100) / 100;
        } else {
          const share = Math.round(((splitData[id] ?? 0) / 100) * amount * 100) / 100;
          splits[id] = share;
          remaining -= share;
        }
      });
      break;
    }

    case 'shares': {
      if (!splitData) throw new Error('splitData required for shares split');
      let totalShares = 0;
      for (const id of members) totalShares += splitData[id] ?? 1;
      let remaining = amount;
      members.forEach((id, idx) => {
        if (idx === members.length - 1) {
          splits[id] = Math.round(remaining * 100) / 100;
        } else {
          const share = Math.round(((splitData[id] ?? 1) / totalShares) * amount * 100) / 100;
          splits[id] = share;
          remaining -= share;
        }
      });
      break;
    }

    default:
      throw new Error(`Unknown split type: ${splitType}`);
  }

  return splits;
}
