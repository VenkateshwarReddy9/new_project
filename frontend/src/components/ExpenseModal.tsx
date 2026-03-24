import { useState, useRef } from 'react';
import { X, Upload, Sparkles, ChevronRight, ChevronLeft, Check, Loader2, Image } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi, aiApi, Expense, CreateExpenseData } from '../api/expenses';
import { GroupMember } from '../api/groups';
import toast from 'react-hot-toast';

export const CATEGORIES = [
  { id: 'food', icon: '🍕', label: 'Food', color: '#f97316' },
  { id: 'transport', icon: '🚗', label: 'Transport', color: '#3b82f6' },
  { id: 'accommodation', icon: '🏠', label: 'Accommodation', color: '#8b5cf6' },
  { id: 'entertainment', icon: '🎮', label: 'Entertainment', color: '#ec4899' },
  { id: 'utilities', icon: '⚡', label: 'Utilities', color: '#f59e0b' },
  { id: 'groceries', icon: '🛒', label: 'Groceries', color: '#10b981' },
  { id: 'health', icon: '💊', label: 'Health', color: '#ef4444' },
  { id: 'travel', icon: '✈️', label: 'Travel', color: '#0ea5e9' },
  { id: 'shopping', icon: '🛍️', label: 'Shopping', color: '#6366f1' },
  { id: 'other', icon: '💰', label: 'Other', color: '#6b7280' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'SGD', 'CHF'];
type SplitType = 'equal' | 'exact' | 'percentage' | 'shares' | 'ai';

interface Props {
  groupId: string;
  members: GroupMember[];
  currentUserId: string;
  expense?: Expense; // if editing
  onClose: () => void;
}

export default function ExpenseModal({ groupId, members, currentUserId, expense, onClose }: Props) {
  const isEditing = !!expense;
  const queryClient = useQueryClient();

  // Step 1 fields
  const [title, setTitle] = useState(expense?.title || '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [currency, setCurrency] = useState(expense?.currency || 'USD');
  const [category, setCategory] = useState(expense?.category || 'food');
  const [notes, setNotes] = useState(expense?.notes || '');
  const [date, setDate] = useState(expense ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0]);
  const [paidById, setPaidById] = useState(expense?.paidById || currentUserId);
  const [isRecurring, setIsRecurring] = useState(expense?.isRecurring || false);
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly'>(
    (expense?.recurringFrequency as any) || 'monthly'
  );
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(expense?.receiptUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 fields
  const [splitType, setSplitType] = useState<SplitType>(
    expense ? (expense.splitType as SplitType) : 'equal'
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    expense ? expense.splits.map((s) => s.userId) : members.map((m) => m.id)
  );
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(
    expense?.splits ? Object.fromEntries(expense.splits.map((s) => [s.userId, String(s.amount)])) : {}
  );
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, string>>(
    expense?.splits ? Object.fromEntries(expense.splits.map((s) => [s.userId, String(s.shares)])) : {}
  );

  // AI split
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ splits: { userId: string; name: string; amount: number }[]; explanation: string } | null>(null);

  const [step, setStep] = useState(1);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setReceipt(file);
      const url = URL.createObjectURL(file);
      setReceiptPreview(url);
    }
  }

  function getComputedSplits(): Record<string, number> {
    const amt = parseFloat(amount) || 0;
    const ids = selectedMemberIds;

    if (splitType === 'equal') {
      const share = Math.round((amt / ids.length) * 100) / 100;
      const result: Record<string, number> = {};
      ids.forEach((id, i) => {
        result[id] = i === ids.length - 1 ? Math.round((amt - share * (ids.length - 1)) * 100) / 100 : share;
      });
      return result;
    }

    if (splitType === 'exact') {
      return Object.fromEntries(ids.map((id) => [id, parseFloat(exactAmounts[id] || '0')]));
    }

    if (splitType === 'percentage') {
      return Object.fromEntries(ids.map((id) => {
        const pct = parseFloat(percentages[id] || '0');
        return [id, Math.round((pct / 100) * amt * 100) / 100];
      }));
    }

    if (splitType === 'shares') {
      const totalShares = ids.reduce((a, id) => a + (parseFloat(shares[id] || '1')), 0);
      return Object.fromEntries(ids.map((id) => {
        const sh = parseFloat(shares[id] || '1');
        return [id, Math.round((sh / totalShares) * amt * 100) / 100];
      }));
    }

    if (splitType === 'ai' && aiResult) {
      return Object.fromEntries(aiResult.splits.map((s) => [s.userId, s.amount]));
    }

    return {};
  }

  const computedSplits = getComputedSplits();

  function validateStep1(): boolean {
    if (!title.trim()) { toast.error('Please enter a title'); return false; }
    if (!amount || parseFloat(amount) <= 0) { toast.error('Please enter a valid amount'); return false; }
    return true;
  }

  function validateStep2(): boolean {
    const total = Object.values(computedSplits).reduce((a, v) => a + v, 0);
    const amt = parseFloat(amount);
    if (Math.abs(total - amt) > 0.05) {
      toast.error(`Split amounts ($${total.toFixed(2)}) don't match expense ($${amt.toFixed(2)})`);
      return false;
    }
    if (selectedMemberIds.length === 0) { toast.error('Select at least one member'); return false; }
    if (splitType === 'ai' && !aiResult) { toast.error('Please generate AI split first'); return false; }
    return true;
  }

  async function handleAiParse() {
    if (!aiPrompt.trim()) { toast.error('Please describe how to split'); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error('Please enter amount first'); return; }

    const selectedMembers = members.filter((m) => selectedMemberIds.includes(m.id));

    setAiLoading(true);
    try {
      const result = await aiApi.parseSplit({
        prompt: aiPrompt,
        totalAmount: parseFloat(amount),
        members: selectedMembers.map((m) => ({ id: m.id, name: m.name })),
      });
      setAiResult(result);
      toast.success('AI split generated!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'AI parsing failed');
    } finally {
      setAiLoading(false);
    }
  }

  const mutation = useMutation({
    mutationFn: () => {
      const splits = getComputedSplits();
      const data: CreateExpenseData = {
        title,
        amount: parseFloat(amount),
        currency,
        category,
        notes: notes || undefined,
        date,
        paidById,
        splitType: splitType === 'ai' ? 'exact' : splitType,
        memberIds: selectedMemberIds,
        splitData: splitType !== 'equal' ? splits : undefined,
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : undefined,
        receipt: receipt || undefined,
      };

      return isEditing
        ? expensesApi.update(expense!.id, data)
        : expensesApi.create(groupId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(isEditing ? 'Expense updated!' : 'Expense added!');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save expense');
    },
  });

  const pctTotal = selectedMemberIds.reduce((a, id) => a + (parseFloat(percentages[id] || '0')), 0);
  const exactTotal = selectedMemberIds.reduce((a, id) => a + (parseFloat(exactAmounts[id] || '0')), 0);
  const amt = parseFloat(amount) || 0;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isEditing ? 'Edit Expense' : 'Add Expense'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1 rounded-full transition-all ${
                    s <= step ? 'bg-primary-600 w-8' : 'bg-gray-200 dark:bg-gray-700 w-4'
                  }`}
                />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* Step 1: Details */}
        {step === 1 && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Title *</label>
                <input
                  className="input"
                  placeholder="What was this expense?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Amount *</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Currency</label>
                <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Paid by</label>
                <select className="input" value={paidById} onChange={(e) => setPaidById(e.target.value)}>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="label">Category</label>
              <div className="grid grid-cols-5 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-all ${
                      category === cat.id
                        ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-xl">{cat.icon}</span>
                    <span className="text-gray-600 dark:text-gray-400 truncate w-full text-center">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Notes (optional)</label>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="Any additional details"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Recurring */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Recurring expense</span>
              </label>
              {isRecurring && (
                <select
                  className="input py-1.5 w-32"
                  value={recurringFrequency}
                  onChange={(e) => setRecurringFrequency(e.target.value as any)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              )}
            </div>

            {/* Receipt upload */}
            <div>
              <label className="label">Receipt (optional)</label>
              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 text-center cursor-pointer hover:border-primary-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {receiptPreview ? (
                  <div className="flex items-center gap-3">
                    <Image className="w-8 h-8 text-primary-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Receipt attached</span>
                    <button
                      type="button"
                      className="ml-auto text-xs text-red-500"
                      onClick={(e) => { e.stopPropagation(); setReceipt(null); setReceiptPreview(null); }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Click to upload receipt image</span>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => { if (validateStep1()) setStep(2); }}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Split */}
        {step === 2 && (
          <div className="p-5 space-y-4">
            <div>
              <label className="label">Split among</label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMemberIds((prev) =>
                      prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                    )}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                      selectedMemberIds.includes(m.id)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                      {m.name[0]}
                    </span>
                    {m.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Split type */}
            <div>
              <label className="label">How to split</label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['equal', 'exact', 'percentage', 'shares', 'ai'] as SplitType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSplitType(type)}
                    className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center ${
                      splitType === type
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {type === 'ai' ? '✨ AI' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Split details */}
            {splitType === 'equal' && (
              <div className="space-y-2">
                {selectedMemberIds.map((id) => {
                  const member = members.find((m) => m.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{member?.name}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        ${computedSplits[id]?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {splitType === 'exact' && (
              <div className="space-y-2">
                {selectedMemberIds.map((id) => {
                  const member = members.find((m) => m.id === id);
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{member?.name}</span>
                      <input
                        type="number"
                        className="input w-28 py-1.5"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        value={exactAmounts[id] || ''}
                        onChange={(e) => setExactAmounts((p) => ({ ...p, [id]: e.target.value }))}
                      />
                    </div>
                  );
                })}
                <div className={`text-xs text-right ${Math.abs(exactTotal - amt) > 0.01 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                  Total: ${exactTotal.toFixed(2)} / ${amt.toFixed(2)}
                </div>
              </div>
            )}

            {splitType === 'percentage' && (
              <div className="space-y-2">
                {selectedMemberIds.map((id) => {
                  const member = members.find((m) => m.id === id);
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{member?.name}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          className="input w-20 py-1.5"
                          placeholder="0"
                          min="0"
                          max="100"
                          value={percentages[id] || ''}
                          onChange={(e) => setPercentages((p) => ({ ...p, [id]: e.target.value }))}
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 text-right">
                        ${computedSplits[id]?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  );
                })}
                <div className={`text-xs text-right ${Math.abs(pctTotal - 100) > 0.01 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                  Total: {pctTotal.toFixed(1)}% {Math.abs(pctTotal - 100) < 0.01 ? '✓' : `(need ${(100 - pctTotal).toFixed(1)}% more)`}
                </div>
              </div>
            )}

            {splitType === 'shares' && (
              <div className="space-y-2">
                {selectedMemberIds.map((id) => {
                  const member = members.find((m) => m.id === id);
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{member?.name}</span>
                      <input
                        type="number"
                        className="input w-20 py-1.5"
                        placeholder="1"
                        min="0.1"
                        step="0.5"
                        value={shares[id] || ''}
                        onChange={(e) => setShares((p) => ({ ...p, [id]: e.target.value }))}
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 text-right">
                        ${computedSplits[id]?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {splitType === 'ai' && (
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-3 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">AI Split Assistant</span>
                  </div>
                  <textarea
                    className="input resize-none text-sm"
                    rows={3}
                    placeholder={"Describe the split... e.g. \"Alice had steak ($45), I had pasta, Bob didn't eat, split the drinks equally\""}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleAiParse}
                    disabled={aiLoading || !aiPrompt.trim()}
                    className="btn-primary mt-2 text-sm w-full"
                  >
                    {aiLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Generate Split</>
                    )}
                  </button>
                </div>

                {aiResult && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">{aiResult.explanation}</p>
                    {aiResult.splits.map((split) => {
                      const member = members.find((m) => m.id === split.userId);
                      return (
                        <div key={split.userId} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300">{member?.name || split.name}</span>
                          <span className="font-medium text-gray-900 dark:text-white">${split.amount.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => { if (validateStep2()) setStep(3); }}
              >
                Review <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="p-5 space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{CATEGORIES.find((c) => c.id === category)?.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{category} · {date}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{currency} {parseFloat(amount).toFixed(2)}</p>
                  {isRecurring && (
                    <p className="text-xs text-primary-600 dark:text-primary-400">Repeats {recurringFrequency}</p>
                  )}
                </div>
              </div>

              {notes && <p className="text-sm text-gray-500 dark:text-gray-400 italic">"{notes}"</p>}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Split breakdown</p>
                {Object.entries(computedSplits).map(([id, splitAmt]) => {
                  const member = members.find((m) => m.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-bold">
                          {member?.name[0]}
                        </div>
                        <span className="text-gray-700 dark:text-gray-300">
                          {member?.name}
                          {id === paidById && <span className="ml-1 badge-gray">paid</span>}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">${splitAmt.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)} className="btn-secondary">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Check className="w-4 h-4" /> {isEditing ? 'Update Expense' : 'Add Expense'}</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
