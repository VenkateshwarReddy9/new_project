import { useState } from 'react';
import { ChevronDown, ChevronUp, Edit2, Trash2, Receipt, Repeat } from 'lucide-react';
import { Expense } from '../api/expenses';
import { useAuthStore } from '../stores/authStore';
import { format } from 'date-fns';
import { CATEGORIES } from './ExpenseModal';

interface Props {
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
}

export default function ExpenseItem({ expense, onEdit, onDelete, canEdit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const userId = useAuthStore((s) => s.user?.id);

  const cat = CATEGORIES.find((c) => c.id === expense.category) || CATEGORIES[CATEGORIES.length - 1];
  const iAmPayer = expense.paidById === userId;
  const mySplit = expense.splits.find((s) => s.userId === userId);

  let myLabel = '';
  let myLabelColor = '';
  if (mySplit) {
    if (iAmPayer && expense.splits.length > 1) {
      const othersTotal = expense.splits.filter((s) => s.userId !== userId).reduce((a, s) => a + s.amount, 0);
      myLabel = `you lent $${othersTotal.toFixed(2)}`;
      myLabelColor = 'text-green-600 dark:text-green-400';
    } else if (!iAmPayer) {
      myLabel = `you owe $${mySplit.amount.toFixed(2)}`;
      myLabelColor = 'text-red-500 dark:text-red-400';
    }
  }

  return (
    <div className="card p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        {/* Category icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ backgroundColor: cat.color + '22' }}
        >
          {cat.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="font-medium text-gray-900 dark:text-white truncate">{expense.title}</h4>
                {expense.isRecurring && (
                  <span title="Recurring expense"><Repeat className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" /></span>
                )}
                {expense.receiptUrl && (
                  <span title="Has receipt"><Receipt className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /></span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {expense.paidBy.name} paid · {format(new Date(expense.date), 'MMM d, yyyy')}
              </p>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-gray-900 dark:text-white">
                {expense.currency} {expense.amount.toFixed(2)}
              </p>
              {myLabel && (
                <p className={`text-xs mt-0.5 ${myLabelColor}`}>{myLabel}</p>
              )}
            </div>
          </div>

          {/* Expand/actions */}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? 'Less' : 'Details'}
            </button>

            {canEdit && (
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => onEdit(expense)}
                  className="btn-ghost py-1 px-2 text-xs gap-1"
                >
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={() => onDelete(expense.id)}
                  className="btn-ghost py-1 px-2 text-xs gap-1 text-red-500 hover:text-red-600 dark:text-red-400"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
          {expense.notes && (
            <p className="text-sm text-gray-600 dark:text-gray-400 italic">"{expense.notes}"</p>
          )}

          <div className="space-y-1">
            {expense.splits.map((split) => (
              <div key={split.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
                    {split.user.name[0].toUpperCase()}
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">
                    {split.user.name}
                    {split.userId === expense.paidById && (
                      <span className="ml-1 text-xs text-gray-400">(paid)</span>
                    )}
                  </span>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">
                  ${split.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {expense.receiptUrl && (
            <a
              href={expense.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              <Receipt className="w-3.5 h-3.5" /> View Receipt
            </a>
          )}
        </div>
      )}
    </div>
  );
}
