import client from './client';

export interface GroupMember {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
  joinedAt: string;
  balance: number;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  emoji: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  members: GroupMember[];
  myBalance: number;
  role: string;
  expenseCount: number;
  memberCount: number;
}

export interface Balance {
  userId: string;
  name: string;
  email: string;
  avatar?: string | null;
  amount: number;
}

export interface Transaction {
  from: { id: string; name: string; email: string; avatar?: string | null };
  to: { id: string; name: string; email: string; avatar?: string | null };
  amount: number;
}

export const groupsApi = {
  list: () =>
    client.get<Group[]>('/groups').then((r) => r.data),

  create: (data: { name: string; description?: string; emoji?: string; color?: string }) =>
    client.post<Group>('/groups', data).then((r) => r.data),

  get: (id: string) =>
    client.get<Group & { simplifiedTransactions: Transaction[] }>(`/groups/${id}`).then((r) => r.data),

  update: (id: string, data: Partial<{ name: string; description: string; emoji: string; color: string }>) =>
    client.put<Group>(`/groups/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    client.delete(`/groups/${id}`),

  addMember: (groupId: string, email: string) =>
    client.post<{ id: string; name: string; email: string; avatar?: string | null }>(`/groups/${groupId}/members`, { email }).then((r) => r.data),

  removeMember: (groupId: string, userId: string) =>
    client.delete(`/groups/${groupId}/members/${userId}`),

  getBalances: (groupId: string) =>
    client.get<{ netBalances: Balance[]; simplifiedTransactions: Transaction[] }>(`/groups/${groupId}/balances`).then((r) => r.data),

  getActivity: (groupId: string, page = 1) =>
    client.get<{ activities: any[]; total: number; page: number; pages: number }>(`/groups/${groupId}/activity?page=${page}`).then((r) => r.data),

  exportCsv: (groupId: string, groupName: string) => {
    const link = document.createElement('a');
    link.href = `/api/groups/${groupId}/export/csv`;
    link.download = `${groupName}-expenses.csv`;
    link.click();
  },
};
