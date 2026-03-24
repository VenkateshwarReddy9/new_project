import client from './client';

export interface FinancialTip {
  icon: string;
  severity: 'info' | 'warning' | 'success';
  message: string;
}

export interface TopExpense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
}

export interface CategoryAmount {
  category: string;
  amount: number;
}

export const dashboardApi = {
  get: () =>
    client.get<{
      totalOwed: number;
      totalOwes: number;
      netBalance: number;
      byGroup: { groupId: string; groupName: string; balance: number }[];
      recentActivity: any[];
      groupCount: number;
    }>('/dashboard').then((r) => r.data),

  analytics: (groupId?: string) =>
    client.get<{
      byCategory: CategoryAmount[];
      byMonth: { month: string; amount: number; label: string }[];
      topSpenders: { userId: string; name: string; avatar: string | null; amount: number }[];
    }>('/dashboard/analytics', { params: groupId ? { groupId } : {} }).then((r) => r.data),

  monthlyReview: (month: string) =>
    client.get<{
      month: string;
      monthLabel: string;
      totalSpent: number;
      prevTotalSpent: number;
      pctChange: number | null;
      byCategory: CategoryAmount[];
      prevByCategory: CategoryAmount[];
      topExpenses: TopExpense[];
      dailySpending: { day: number; amount: number }[];
      tips: FinancialTip[];
    }>('/dashboard/analytics/monthly-review', { params: { month } }).then((r) => r.data),

  yearlyReview: (year: number) =>
    client.get<{
      year: number;
      totalSpent: number;
      prevTotalSpent: number;
      pctChange: number | null;
      monthlyAvg: number;
      byMonth: { monthNum: number; month: string; amount: number }[];
      byCategory: CategoryAmount[];
      topExpenses: TopExpense[];
      worstMonth: { month: string; amount: number } | null;
      bestMonth: { month: string; amount: number } | null;
      tips: FinancialTip[];
    }>('/dashboard/analytics/yearly-review', { params: { year } }).then((r) => r.data),
};
