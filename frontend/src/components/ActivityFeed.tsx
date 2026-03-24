import { format, isToday, isYesterday } from 'date-fns';
import { DollarSign, Plus, Edit2, Trash2, UserPlus, UserMinus, CheckCircle } from 'lucide-react';

interface Activity {
  id: string;
  type: string;
  data: Record<string, any>;
  createdAt: string;
  user: { id: string; name: string; email: string; avatar?: string | null };
  group?: { id: string; name: string; emoji: string };
}

interface Props {
  activities: Activity[];
  showGroup?: boolean;
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'expense_added': return { icon: Plus, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' };
    case 'expense_edited': return { icon: Edit2, color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' };
    case 'expense_deleted': return { icon: Trash2, color: 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400' };
    case 'settlement_added': return { icon: CheckCircle, color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' };
    case 'member_joined': return { icon: UserPlus, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' };
    case 'member_left': return { icon: UserMinus, color: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' };
    default: return { icon: DollarSign, color: 'bg-gray-100 dark:bg-gray-800 text-gray-500' };
  }
}

function getActivityText(activity: Activity): string {
  const d = activity.data;
  switch (activity.type) {
    case 'expense_added':
      return `${activity.user.name} added "${d.title}" for ${d.currency || 'USD'} ${Number(d.amount).toFixed(2)}`;
    case 'expense_edited':
      return `${activity.user.name} edited "${d.title}"`;
    case 'expense_deleted':
      return `${activity.user.name} deleted "${d.title}"`;
    case 'settlement_added':
      return `${d.payerName} paid ${d.payeeName} ${d.currency || 'USD'} ${Number(d.amount).toFixed(2)}`;
    case 'member_joined':
      return `${d.userName} joined${d.inviterName ? ` (invited by ${d.inviterName})` : ''}`;
    case 'member_left':
      return `${d.userName} left the group`;
    case 'group_created':
      return `${d.userName} created the group`;
    default:
      return 'Activity occurred';
  }
}

function groupByDate(activities: Activity[]): { label: string; items: Activity[] }[] {
  const groups: Record<string, Activity[]> = {};
  for (const activity of activities) {
    const date = new Date(activity.createdAt);
    let label: string;
    if (isToday(date)) label = 'Today';
    else if (isYesterday(date)) label = 'Yesterday';
    else label = format(date, 'MMMM d, yyyy');
    if (!groups[label]) groups[label] = [];
    groups[label].push(activity);
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

export default function ActivityFeed({ activities, showGroup = false }: Props) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-600">
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  const grouped = groupByDate(activities);

  return (
    <div className="space-y-4">
      {grouped.map(({ label, items }) => (
        <div key={label}>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            {label}
          </p>
          <div className="space-y-2">
            {items.map((activity) => {
              const { icon: Icon, color } = getActivityIcon(activity.type);
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {getActivityText(activity)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {format(new Date(activity.createdAt), 'h:mm a')}
                      </p>
                      {showGroup && activity.group && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          · {activity.group.emoji} {activity.group.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
