import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { groupsApi } from '../api/groups';
import { useAuthStore } from '../stores/authStore';
import { TrendingUp, TrendingDown, Wallet, Plus } from 'lucide-react';
import GroupCard from '../components/GroupCard';
import ActivityFeed from '../components/ActivityFeed';
import CreateGroupModal from '../components/CreateGroupModal';
import SpendingChart from '../components/SpendingChart';

function StatCard({ label, value, icon: Icon, color, subtitle }: {
  label: string;
  value: string;
  icon: any;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${color.includes('green') ? 'bg-green-100 dark:bg-green-900/20' : color.includes('red') ? 'bg-red-100 dark:bg-red-900/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.get,
  });

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: groupsApi.list,
  });

  const { data: analytics } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => dashboardApi.analytics(),
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (dashLoading || groupsLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1,2,3].map((i) => <div key={i} className="card h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {greeting}, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Here's your expense overview
          </p>
        </div>
        <button onClick={() => setShowCreateGroup(true)} className="btn-primary gap-2">
          <Plus className="w-4 h-4" /> New Group
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="You're owed"
          value={`$${dashboard?.totalOwed.toFixed(2) || '0.00'}`}
          icon={TrendingUp}
          color="text-green-600 dark:text-green-400"
          subtitle="across all groups"
        />
        <StatCard
          label="You owe"
          value={`$${dashboard?.totalOwes.toFixed(2) || '0.00'}`}
          icon={TrendingDown}
          color="text-red-500 dark:text-red-400"
          subtitle="across all groups"
        />
        <StatCard
          label="Net balance"
          value={`${(dashboard?.netBalance || 0) >= 0 ? '+' : ''}$${Math.abs(dashboard?.netBalance || 0).toFixed(2)}`}
          icon={Wallet}
          color={(dashboard?.netBalance || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}
          subtitle={`${dashboard?.groupCount || 0} active groups`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Groups */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Groups</h2>
            <button onClick={() => setShowCreateGroup(true)} className="btn-ghost text-sm gap-1 py-1.5">
              <Plus className="w-4 h-4" /> New
            </button>
          </div>

          {groups && groups.length > 0 ? (
            <div className="space-y-3">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          ) : (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-3">💸</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">No groups yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Create a group to start splitting expenses with friends
              </p>
              <button onClick={() => setShowCreateGroup(true)} className="btn-primary mx-auto">
                <Plus className="w-4 h-4" /> Create Group
              </button>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Spending chart */}
          {analytics && analytics.byCategory.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Spending by Category</h3>
              <SpendingChart type="pie" data={analytics.byCategory} dataKey="amount" xKey="category" />
            </div>
          )}

          {/* Recent activity */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Recent Activity</h3>
            <ActivityFeed
              activities={dashboard?.recentActivity || []}
              showGroup
            />
          </div>
        </div>
      </div>

      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
    </div>
  );
}
