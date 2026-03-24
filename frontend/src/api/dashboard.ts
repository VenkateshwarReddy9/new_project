import client from './client';

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
      byCategory: { category: string; amount: number }[];
      byMonth: { month: string; amount: number; label: string }[];
      topSpenders: { userId: string; name: string; avatar: string | null; amount: number }[];
    }>('/dashboard/analytics', { params: groupId ? { groupId } : {} }).then((r) => r.data),
};
