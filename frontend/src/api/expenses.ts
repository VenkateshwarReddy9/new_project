import client from './client';

export interface ExpenseSplit {
  id: string;
  userId: string;
  amount: number;
  shares: number;
  user: { id: string; name: string; email: string; avatar?: string | null };
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  notes?: string | null;
  receiptUrl?: string | null;
  date: string;
  splitType: string;
  isRecurring: boolean;
  recurringFrequency?: string | null;
  paidById: string;
  paidBy: { id: string; name: string; email: string; avatar?: string | null };
  splits: ExpenseSplit[];
  myShare?: number;
  createdAt: string;
}

export interface Settlement {
  id: string;
  groupId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  currency: string;
  notes?: string | null;
  date: string;
  createdAt: string;
  payer: { id: string; name: string; email: string; avatar?: string | null };
  payee: { id: string; name: string; email: string; avatar?: string | null };
}

export interface CreateExpenseData {
  title: string;
  amount: number;
  currency: string;
  category: string;
  notes?: string;
  date?: string;
  paidById: string;
  splitType: 'equal' | 'exact' | 'percentage' | 'shares';
  memberIds: string[];
  splitData?: Record<string, number>;
  isRecurring?: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly';
  receipt?: File;
}

export const expensesApi = {
  list: (groupId: string, params?: { page?: number; category?: string; startDate?: string; endDate?: string }) =>
    client.get<{ expenses: Expense[]; total: number; page: number; pages: number }>(`/expenses/group/${groupId}`, { params }).then((r) => r.data),

  create: (groupId: string, data: CreateExpenseData) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (key === 'receipt' && val instanceof File) {
        formData.append('receipt', val);
      } else if (key === 'memberIds' || key === 'splitData') {
        formData.append(key, JSON.stringify(val));
      } else if (val !== undefined && val !== null) {
        formData.append(key, String(val));
      }
    });
    return client.post<Expense>(`/expenses/group/${groupId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  update: (id: string, data: Partial<CreateExpenseData>) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (key === 'receipt' && val instanceof File) {
        formData.append('receipt', val);
      } else if (key === 'memberIds' || key === 'splitData') {
        formData.append(key, JSON.stringify(val));
      } else if (val !== undefined && val !== null) {
        formData.append(key, String(val));
      }
    });
    return client.put<Expense>(`/expenses/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  delete: (id: string) =>
    client.delete(`/expenses/${id}`),
};

export const settlementsApi = {
  list: (groupId: string) =>
    client.get<Settlement[]>(`/settlements/group/${groupId}`).then((r) => r.data),

  create: (groupId: string, data: { payerId: string; payeeId: string; amount: number; currency?: string; notes?: string; date?: string }) =>
    client.post<Settlement>(`/settlements/group/${groupId}`, data).then((r) => r.data),

  delete: (id: string) =>
    client.delete(`/settlements/${id}`),
};

export const aiApi = {
  parseSplit: (data: { prompt: string; totalAmount: number; members: { id: string; name: string }[] }) =>
    client.post<{ splits: { userId: string; name: string; amount: number }[]; explanation: string }>('/ai/parse-split', data).then((r) => r.data),
};
