import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { groupsApi } from '../api/groups';
import { BarChart2, TrendingUp } from 'lucide-react';
import SpendingChart from '../components/SpendingChart';
import { CATEGORIES } from '../components/ExpenseModal';

export default function AnalyticsPage() {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: groupsApi.list,
  });

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics', selectedGroupId],
    queryFn: () => dashboardApi.analytics(selectedGroupId || undefined),
  });

  const totalSpent = analytics?.byCategory.reduce((a, c) => a + c.amount, 0) || 0;
  const topCategory = analytics?.byCategory[0];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your spending patterns</p>
        </div>

        {/* Group filter */}
        <select
          className="input w-48"
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
        >
          <option value="">All Groups</option>
          {groups?.map((g) => (
            <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1,2,3,4].map((i) => <div key={i} className="card h-64 animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Your total spent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">${totalSpent.toFixed(2)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {selectedGroupId ? 'in selected group' : 'across all groups'}
              </p>
            </div>

            <div className="card p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Top category</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {topCategory ? (
                  <span>{CATEGORIES.find((c) => c.id === topCategory.category)?.icon} {topCategory.category}</span>
                ) : '—'}
              </p>
              {topCategory && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">${topCategory.amount.toFixed(2)} spent</p>
              )}
            </div>

            <div className="card p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Categories tracked</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {analytics?.byCategory.length || 0}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">unique expense types</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie chart */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Spending by Category</h3>
              </div>
              <SpendingChart
                type="pie"
                data={analytics?.byCategory || []}
                dataKey="amount"
                xKey="category"
              />
            </div>

            {/* Monthly bar chart */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Monthly Spending (Last 6 Months)</h3>
              </div>
              <SpendingChart
                type="bar"
                data={(analytics?.byMonth || []).map((m) => ({ ...m, month: m.label }))}
                dataKey="amount"
                xKey="month"
              />
            </div>
          </div>

          {/* Category breakdown table */}
          {analytics && analytics.byCategory.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Category Breakdown</h3>
              <div className="space-y-3">
                {analytics.byCategory.map((cat) => {
                  const catDef = CATEGORIES.find((c) => c.id === cat.category);
                  const pct = totalSpent > 0 ? (cat.amount / totalSpent) * 100 : 0;
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span>{catDef?.icon || '💰'}</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                            {cat.category}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            ${cat.amount.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: catDef?.color || '#6366f1',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top spenders (only if group selected) */}
          {selectedGroupId && analytics && analytics.topSpenders.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Top Spenders</h3>
              <div className="space-y-3">
                {analytics.topSpenders.map((spender, i) => (
                  <div key={spender.userId} className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-300 dark:text-gray-600 w-6 text-center">
                      {i + 1}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {spender.name[0]}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">{spender.name}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">${spender.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {(!analytics || analytics.byCategory.length === 0) && (
            <div className="card p-16 text-center">
              <div className="text-5xl mb-4">📊</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No spending data yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add expenses to your groups to see analytics here
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
