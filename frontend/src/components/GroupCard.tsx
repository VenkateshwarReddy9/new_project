import { Link } from 'react-router-dom';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { Group } from '../api/groups';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  group: Group;
}

export default function GroupCard({ group }: Props) {
  const balance = group.myBalance;

  return (
    <Link
      to={`/groups/${group.id}`}
      className="card p-4 hover:shadow-md transition-all hover:-translate-y-0.5 block"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ backgroundColor: group.color + '22', border: `2px solid ${group.color}33` }}
        >
          {group.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{group.name}</h3>
          {group.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{group.description}</p>
          )}

          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Users className="w-3.5 h-3.5" />
              {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {group.expenseCount} expenses
            </span>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          {balance === 0 ? (
            <span className="badge-gray">Settled</span>
          ) : balance > 0 ? (
            <div>
              <div className="flex items-center gap-1 justify-end text-green-600 dark:text-green-400">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-sm font-semibold">${balance.toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">you're owed</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1 justify-end text-red-500 dark:text-red-400">
                <TrendingDown className="w-3.5 h-3.5" />
                <span className="text-sm font-semibold">${Math.abs(balance).toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">you owe</p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
