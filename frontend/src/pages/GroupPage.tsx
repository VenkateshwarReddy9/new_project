import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi } from '../api/groups';
import { expensesApi, settlementsApi, Expense } from '../api/expenses';
import { useAuthStore } from '../stores/authStore';
import { useSocket } from '../hooks/useSocket';
import {
  Plus, Download, UserPlus, Settings, Trash2, ArrowLeft,
  Receipt, Scale, Clock, DollarSign, X, Check
} from 'lucide-react';
import ExpenseItem from '../components/ExpenseItem';
import ExpenseModal from '../components/ExpenseModal';
import SettlementModal from '../components/SettlementModal';
import BalanceCard from '../components/BalanceCard';
import ActivityFeed from '../components/ActivityFeed';
import toast from 'react-hot-toast';

type Tab = 'expenses' | 'balances' | 'settlements' | 'activity';

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('expenses');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlePrefill, setSettlePrefill] = useState<{ payerId: string; payeeId: string; amount: number } | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Real-time updates
  useSocket(id);

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: () => groupsApi.get(id!),
    enabled: !!id,
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', id],
    queryFn: () => expensesApi.list(id!),
    enabled: !!id && tab === 'expenses',
  });

  const { data: balances } = useQuery({
    queryKey: ['balances', id],
    queryFn: () => groupsApi.getBalances(id!),
    enabled: !!id && tab === 'balances',
  });

  const { data: settlements } = useQuery({
    queryKey: ['settlements', id],
    queryFn: () => settlementsApi.list(id!),
    enabled: !!id && tab === 'settlements',
  });

  const { data: activity } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => groupsApi.getActivity(id!),
    enabled: !!id && tab === 'activity',
  });

  const deleteMutation = useMutation({
    mutationFn: expensesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', id] });
      queryClient.invalidateQueries({ queryKey: ['balances', id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Expense deleted');
    },
    onError: () => toast.error('Failed to delete expense'),
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) => groupsApi.addMember(id!, email),
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success(`${member.name} added to group`);
      setInviteEmail('');
      setShowInvite(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add member'),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: () => groupsApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Group deleted');
      navigate('/');
    },
    onError: () => toast.error('Failed to delete group'),
  });

  const deleteSettlementMutation = useMutation({
    mutationFn: settlementsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements', id] });
      queryClient.invalidateQueries({ queryKey: ['balances', id] });
      toast.success('Settlement deleted');
    },
    onError: () => toast.error('Failed to delete settlement'),
  });

  if (groupLoading) {
    return (
      <div className="animate-pulse space-y-4 max-w-4xl mx-auto">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-48" />
        <div className="card h-32" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Group not found</p>
        <button onClick={() => navigate('/')} className="btn-primary mt-4">Go Home</button>
      </div>
    );
  }

  const isAdmin = group.role === 'admin';
  const members = group.members;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'balances', label: 'Balances', icon: Scale },
    { id: 'settlements', label: 'Payments', icon: DollarSign },
    { id: 'activity', label: 'Activity', icon: Clock },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/')} className="btn-ghost p-2 mt-0.5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: group.color + '22' }}
          >
            {group.emoji}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{group.name}</h1>
            {group.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{group.description}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex -space-x-1">
                {members.slice(0, 4).map((m) => (
                  <div
                    key={m.id}
                    className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-bold border border-white dark:border-gray-900 flex items-center justify-center"
                    title={m.name}
                  >
                    {m.name[0]}
                  </div>
                ))}
                {members.length > 4 && (
                  <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 border border-white dark:border-gray-900 flex items-center justify-center">
                    +{members.length - 4}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">{members.length} members</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowInvite(true)} className="btn-secondary text-sm gap-1.5">
            <UserPlus className="w-4 h-4" /> Invite
          </button>
          <button
            onClick={() => groupsApi.exportCsv(id!, group.name)}
            className="btn-ghost p-2"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button onClick={() => setShowSettings(true)} className="btn-ghost p-2" title="Settings">
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* My balance banner */}
      {group.myBalance !== 0 && (
        <div className={`card px-4 py-3 flex items-center justify-between ${
          group.myBalance > 0
            ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
            : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
        }`}>
          <p className={`text-sm font-medium ${group.myBalance > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {group.myBalance > 0
              ? `You are owed $${group.myBalance.toFixed(2)} in this group`
              : `You owe $${Math.abs(group.myBalance).toFixed(2)} in this group`}
          </p>
          {group.myBalance < 0 && (
            <button
              onClick={() => { setTab('balances'); }}
              className="text-xs text-red-600 dark:text-red-400 font-medium hover:underline"
            >
              Settle up →
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === tabId
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'expenses' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => { setEditingExpense(null); setShowExpenseModal(true); }} className="btn-primary gap-1.5">
              <Plus className="w-4 h-4" /> Add Expense
            </button>
          </div>

          {expensesLoading ? (
            <div className="space-y-3">
              {[1,2,3].map((i) => <div key={i} className="card h-20 animate-pulse" />)}
            </div>
          ) : expensesData?.expenses && expensesData.expenses.length > 0 ? (
            <div className="space-y-2">
              {expensesData.expenses.map((expense) => (
                <ExpenseItem
                  key={expense.id}
                  expense={expense}
                  canEdit={expense.paidById === userId || isAdmin}
                  onEdit={(e) => { setEditingExpense(e); setShowExpenseModal(true); }}
                  onDelete={(expenseId) => {
                    if (confirm('Delete this expense?')) deleteMutation.mutate(expenseId);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-3">🧾</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">No expenses yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Add the first expense to start tracking</p>
              <button onClick={() => setShowExpenseModal(true)} className="btn-primary mx-auto">
                <Plus className="w-4 h-4" /> Add Expense
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'balances' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowSettlementModal(true)} className="btn-primary gap-1.5">
              <Plus className="w-4 h-4" /> Record Payment
            </button>
          </div>

          {balances?.simplifiedTransactions && balances.simplifiedTransactions.length > 0 ? (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Simplified — {balances.simplifiedTransactions.length} payment{balances.simplifiedTransactions.length !== 1 ? 's' : ''} to settle all debts
              </p>
              <div className="space-y-2">
                {balances.simplifiedTransactions.map((t, i) => (
                  <BalanceCard
                    key={i}
                    transaction={t}
                    isMe={t.from.id === userId}
                    onSettle={(payerId, payeeId, amount) => {
                      setSettlePrefill({ payerId, payeeId, amount });
                      setShowSettlementModal(true);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-3">✅</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">All settled up!</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">No outstanding balances in this group.</p>
            </div>
          )}

          {/* Per-member balances */}
          {balances?.netBalances && balances.netBalances.length > 0 && (
            <div className="card p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3 text-sm">Member Balances</h3>
              <div className="space-y-2">
                {balances.netBalances.map((b) => (
                  <div key={b.userId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-400">
                        {b.name[0]}
                      </div>
                      <span className="text-gray-700 dark:text-gray-300">{b.name}</span>
                    </div>
                    <span className={`font-medium ${
                      b.amount > 0.01 ? 'text-green-600 dark:text-green-400' :
                      b.amount < -0.01 ? 'text-red-500 dark:text-red-400' :
                      'text-gray-400 dark:text-gray-500'
                    }`}>
                      {b.amount > 0.01 ? `+$${b.amount.toFixed(2)}` :
                       b.amount < -0.01 ? `-$${Math.abs(b.amount).toFixed(2)}` :
                       'Settled'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'settlements' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowSettlementModal(true)} className="btn-primary gap-1.5">
              <Plus className="w-4 h-4" /> Record Payment
            </button>
          </div>

          {settlements && settlements.length > 0 ? (
            <div className="space-y-2">
              {settlements.map((s) => (
                <div key={s.id} className="card p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {s.payer.name} → {s.payee.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(s.date).toLocaleDateString()}{s.notes ? ` · ${s.notes}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {s.currency} {s.amount.toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => { if (confirm('Delete this payment?')) deleteSettlementMutation.mutate(s.id); }}
                    className="btn-ghost p-1.5 text-red-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-3">💳</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">No payments recorded</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Record payments to track settlements</p>
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="card p-4">
          <ActivityFeed activities={activity?.activities || []} />
        </div>
      )}

      {/* Modals */}
      {showExpenseModal && (
        <ExpenseModal
          groupId={id!}
          members={members}
          currentUserId={userId!}
          expense={editingExpense || undefined}
          onClose={() => { setShowExpenseModal(false); setEditingExpense(null); }}
        />
      )}

      {showSettlementModal && (
        <SettlementModal
          groupId={id!}
          members={members}
          prefilledPayerId={settlePrefill?.payerId}
          prefilledPayeeId={settlePrefill?.payeeId}
          prefilledAmount={settlePrefill?.amount}
          onClose={() => { setShowSettlementModal(false); setSettlePrefill(null); }}
        />
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="modal-content max-w-sm w-full">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Invite Member</h2>
              <button onClick={() => setShowInvite(false)} className="btn-ghost p-1.5 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              className="p-5 space-y-4"
              onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate(inviteEmail); }}
            >
              <div>
                <label className="label">Email address</label>
                <input
                  type="email"
                  className="input"
                  placeholder="friend@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  autoFocus
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  If they don't have an account yet, one will be created for them.
                </p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && isAdmin && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}>
          <div className="modal-content max-w-sm w-full">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Group Settings</h2>
              <button onClick={() => setShowSettings(false)} className="btn-ghost p-1.5 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Members can leave; admins can remove members and delete the group.
              </p>
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete "${group.name}"? This cannot be undone.`)) {
                    deleteGroupMutation.mutate();
                  }
                }}
                className="btn-danger w-full"
                disabled={deleteGroupMutation.isPending}
              >
                <Trash2 className="w-4 h-4" />
                {deleteGroupMutation.isPending ? 'Deleting...' : 'Delete Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
