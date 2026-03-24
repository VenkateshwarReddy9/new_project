import { ArrowRight } from 'lucide-react';
import { Transaction } from '../api/groups';

interface Props {
  transaction: Transaction;
  isMe: boolean; // true if I am the payer
  onSettle: (payerId: string, payeeId: string, amount: number) => void;
}

export default function BalanceCard({ transaction, isMe, onSettle }: Props) {
  return (
    <div className="card p-4 flex items-center gap-3">
      {/* From */}
      <div className="flex flex-col items-center min-w-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
          isMe ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
        }`}>
          {transaction.from.name[0].toUpperCase()}
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate max-w-[60px] text-center">
          {isMe ? 'You' : transaction.from.name.split(' ')[0]}
        </p>
      </div>

      {/* Arrow + amount */}
      <div className="flex-1 flex flex-col items-center">
        <p className="font-semibold text-gray-900 dark:text-white">${transaction.amount.toFixed(2)}</p>
        <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500 mt-0.5">
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>

      {/* To */}
      <div className="flex flex-col items-center min-w-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
          !isMe && transaction.to.id === transaction.to.id ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
        }`}>
          {transaction.to.name[0].toUpperCase()}
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate max-w-[60px] text-center">
          {transaction.to.name.split(' ')[0]}
        </p>
      </div>

      {/* Settle button - show if I am the payer */}
      {isMe && (
        <button
          onClick={() => onSettle(transaction.from.id, transaction.to.id, transaction.amount)}
          className="btn-primary text-xs py-1.5 px-3 ml-2 flex-shrink-0"
        >
          Settle
        </button>
      )}
    </div>
  );
}
