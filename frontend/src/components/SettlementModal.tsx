import { useState } from 'react';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { settlementsApi } from '../api/expenses';
import toast from 'react-hot-toast';
import { GroupMember } from '../api/groups';

interface Props {
  groupId: string;
  members: GroupMember[];
  prefilledPayerId?: string;
  prefilledPayeeId?: string;
  prefilledAmount?: number;
  onClose: () => void;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD'];

export default function SettlementModal({
  groupId,
  members,
  prefilledPayerId,
  prefilledPayeeId,
  prefilledAmount,
  onClose,
}: Props) {
  const [payerId, setPayerId] = useState(prefilledPayerId || members[0]?.id || '');
  const [payeeId, setPayeeId] = useState(prefilledPayeeId || members[1]?.id || '');
  const [amount, setAmount] = useState(prefilledAmount ? String(prefilledAmount) : '');
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      settlementsApi.create(groupId, {
        payerId,
        payeeId,
        amount: parseFloat(amount),
        currency,
        notes: notes || undefined,
        date,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Payment recorded!');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to record payment');
    },
  });

  const availablePayees = members.filter((m) => m.id !== payerId);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Record Payment</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <form
          className="p-5 space-y-4"
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        >
          <div>
            <label className="label">Who paid?</label>
            <select className="input" value={payerId} onChange={(e) => setPayerId(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Paid to</label>
            <select
              className="input"
              value={payeeId}
              onChange={(e) => setPayeeId(e.target.value)}
            >
              {availablePayees.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Amount</label>
              <input
                type="number"
                className="input"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="w-24">
              <label className="label">Currency</label>
              <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <input
              type="text"
              className="input"
              placeholder="Payment description"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={!amount || parseFloat(amount) <= 0 || payerId === payeeId || mutation.isPending}
            >
              {mutation.isPending ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
