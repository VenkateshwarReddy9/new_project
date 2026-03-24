import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, FinancialTip, TopExpense, CategoryAmount } from '../api/dashboard';
import { groupsApi } from '../api/groups';
import { BarChart2, TrendingUp, TrendingDown, Calendar, Award, AlertTriangle, Info, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import SpendingChart from '../components/SpendingChart';
import { CATEGORIES } from '../components/ExpenseModal';

type Tab = 'overview' | 'monthly' | 'yearly';

// ─── Tip Card ──────────────────────────────────────────────────────────────
function TipCard({ tip }: { tip: FinancialTip }) {
  const colors = {
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200',
  };
  const icons = {
    warning: <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />,
    success: <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />,
    info: <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />,
  };
  return (
    <div className={`flex gap-3 p-4 rounded-xl border text-sm ${colors[tip.severity]}`}>
      <span className="text-xl leading-none">{tip.icon}</span>
      <div className="flex items-start gap-2">
        {icons[tip.severity]}
        <p>{tip.message}</p>
      </div>
    </div>
  );
}

// ─── Category bar list ─────────────────────────────────────────────────────
function CategoryBreakdown({ data, total }: { data: CategoryAmount[]; total: number }) {
  return (
    <div className="space-y-3">
      {data.map((cat) => {
        const catDef = CATEGORIES.find((c) => c.id === cat.category);
        const pct = total > 0 ? (cat.amount / total) * 100 : 0;
        return (
          <div key={cat.category}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span>{catDef?.icon || '💰'}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{cat.category}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">${cat.amount.toFixed(2)}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{pct.toFixed(1)}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: catDef?.color || '#6366f1' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Top Expenses list ─────────────────────────────────────────────────────
function TopExpensesList({ expenses }: { expenses: TopExpense[] }) {
  return (
    <div className="space-y-2">
      {expenses.map((e, i) => {
        const catDef = CATEGORIES.find((c) => c.id === e.category);
        return (
          <div key={e.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
            <span className="text-lg font-bold text-gray-300 dark:text-gray-600 w-6 text-center">{i + 1}</span>
            <span className="text-lg">{catDef?.icon || '💰'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{e.title}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{e.category} · {new Date(e.date).toLocaleDateString()}</p>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">${e.amount.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Change badge ──────────────────────────────────────────────────────────
function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const positive = pct > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${positive ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

// ─── Monthly Review Tab ────────────────────────────────────────────────────
function MonthlyReview() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  const { data, isLoading } = useQuery({
    queryKey: ['monthly-review', month],
    queryFn: () => dashboardApi.monthlyReview(month),
  });

  function prevMonth() {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  function nextMonth() {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const isCurrentMonth = month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (isLoading) return <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{[1,2,3,4].map(i=><div key={i} className="card h-64 animate-pulse" />)}</div>;

  return (
    <div className="space-y-6">
      {/* Month navigator */}
      <div className="flex items-center gap-4">
        <button onClick={prevMonth} className="btn-secondary p-2"><ChevronLeft className="w-4 h-4" /></button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white min-w-[180px] text-center">
          {data?.monthLabel || month}
        </h2>
        <button onClick={nextMonth} className="btn-secondary p-2" disabled={isCurrentMonth}><ChevronRight className="w-4 h-4" /></button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Spent</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">${(data?.totalSpent ?? 0).toFixed(2)}</p>
          <div className="mt-1"><ChangeBadge pct={data?.pctChange ?? null} /></div>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Previous Month</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">${(data?.prevTotalSpent ?? 0).toFixed(2)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">for comparison</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Top Category</p>
          {data && data.byCategory.length > 0 ? (
            <>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {CATEGORIES.find(c => c.id === data.byCategory[0].category)?.icon} {data.byCategory[0].category}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">${data.byCategory[0].amount.toFixed(2)}</p>
            </>
          ) : <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">—</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily spending chart */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Daily Spending</h3>
          </div>
          <SpendingChart
            type="bar"
            data={(data?.dailySpending || []).map(d => ({ day: `Day ${d.day}`, amount: d.amount }))}
            dataKey="amount"
            xKey="day"
          />
        </div>

        {/* Category pie */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Spending by Category</h3>
          </div>
          <SpendingChart
            type="pie"
            data={data?.byCategory || []}
            dataKey="amount"
            xKey="category"
          />
        </div>
      </div>

      {/* Category breakdown */}
      {data && data.byCategory.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Category Breakdown</h3>
          <CategoryBreakdown data={data.byCategory} total={data.totalSpent} />
        </div>
      )}

      {/* Most expensive expenses */}
      {data && data.topExpenses.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Biggest Expenses This Month</h3>
          </div>
          <TopExpensesList expenses={data.topExpenses} />
        </div>
      )}

      {/* Financial tips */}
      {data && data.tips.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">💡 Financial Discipline Suggestions</h3>
          <div className="space-y-3">
            {data.tips.map((tip, i) => <TipCard key={i} tip={tip} />)}
          </div>
        </div>
      )}

      {data && data.totalSpent === 0 && (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4">📅</div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No expenses in {data.monthLabel}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Add expenses to see your monthly review</p>
        </div>
      )}
    </div>
  );
}

// ─── Yearly Review Tab ─────────────────────────────────────────────────────
function YearlyReview() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, isLoading } = useQuery({
    queryKey: ['yearly-review', year],
    queryFn: () => dashboardApi.yearlyReview(year),
  });

  if (isLoading) return <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{[1,2,3,4].map(i=><div key={i} className="card h-64 animate-pulse" />)}</div>;

  return (
    <div className="space-y-6">
      {/* Year navigator */}
      <div className="flex items-center gap-4">
        <button onClick={() => setYear(y => y - 1)} className="btn-secondary p-2"><ChevronLeft className="w-4 h-4" /></button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white min-w-[80px] text-center">{year}</h2>
        <button onClick={() => setYear(y => y + 1)} className="btn-secondary p-2" disabled={year >= currentYear}><ChevronRight className="w-4 h-4" /></button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Spent</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">${(data?.totalSpent ?? 0).toFixed(2)}</p>
          <div className="mt-1"><ChangeBadge pct={data?.pctChange ?? null} /></div>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Avg</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">${(data?.monthlyAvg ?? 0).toFixed(2)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">per month</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Highest Month</p>
          {data?.worstMonth ? (
            <>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{data.worstMonth.month}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">${data.worstMonth.amount.toFixed(2)}</p>
            </>
          ) : <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">—</p>}
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Lowest Month</p>
          {data?.bestMonth ? (
            <>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{data.bestMonth.month}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">${data.bestMonth.amount.toFixed(2)}</p>
            </>
          ) : <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">—</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly spending bar */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Monthly Spending — {year}</h3>
          </div>
          <SpendingChart
            type="bar"
            data={data?.byMonth || []}
            dataKey="amount"
            xKey="month"
          />
        </div>

        {/* Category pie */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Year-End Category Breakdown</h3>
          </div>
          <SpendingChart
            type="pie"
            data={data?.byCategory || []}
            dataKey="amount"
            xKey="category"
          />
        </div>
      </div>

      {/* Category breakdown */}
      {data && data.byCategory.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Category Breakdown — {year}</h3>
          <CategoryBreakdown data={data.byCategory} total={data.totalSpent} />
        </div>
      )}

      {/* Biggest expenses */}
      {data && data.topExpenses.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">10 Biggest Expenses of {year}</h3>
          </div>
          <TopExpensesList expenses={data.topExpenses} />
        </div>
      )}

      {/* Financial discipline tips */}
      {data && data.tips.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">💡 Year-End Financial Insights & Suggestions</h3>
          <div className="space-y-3">
            {data.tips.map((tip, i) => <TipCard key={i} tip={tip} />)}
          </div>
        </div>
      )}

      {data && data.totalSpent === 0 && (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4">📆</div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No expenses in {year}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Add expenses to see your yearly review</p>
        </div>
      )}
    </div>
  );
}

// ─── Overview Tab (existing) ───────────────────────────────────────────────
function Overview() {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list });
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics', selectedGroupId],
    queryFn: () => dashboardApi.analytics(selectedGroupId || undefined),
  });

  const totalSpent = analytics?.byCategory.reduce((a, c) => a + c.amount, 0) || 0;
  const topCategory = analytics?.byCategory[0];

  return (
    <div className="space-y-6">
      {/* Group filter */}
      <div className="flex justify-end">
        <select className="input w-48" value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
          <option value="">All Groups</option>
          {groups?.map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{[1,2,3,4].map(i => <div key={i} className="card h-64 animate-pulse" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Your total spent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">${totalSpent.toFixed(2)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{selectedGroupId ? 'in selected group' : 'across all groups'}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Top category</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {topCategory ? <span>{CATEGORIES.find(c => c.id === topCategory.category)?.icon} {topCategory.category}</span> : '—'}
              </p>
              {topCategory && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">${topCategory.amount.toFixed(2)} spent</p>}
            </div>
            <div className="card p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Categories tracked</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{analytics?.byCategory.length || 0}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">unique expense types</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Spending by Category</h3>
              </div>
              <SpendingChart type="pie" data={analytics?.byCategory || []} dataKey="amount" xKey="category" />
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Monthly Spending (Last 6 Months)</h3>
              </div>
              <SpendingChart
                type="bar"
                data={(analytics?.byMonth || []).map(m => ({ ...m, month: m.label }))}
                dataKey="amount"
                xKey="month"
              />
            </div>
          </div>

          {analytics && analytics.byCategory.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Category Breakdown</h3>
              <CategoryBreakdown data={analytics.byCategory} total={totalSpent} />
            </div>
          )}

          {selectedGroupId && analytics && analytics.topSpenders.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Top Spenders</h3>
              <div className="space-y-3">
                {analytics.topSpenders.map((spender, i) => (
                  <div key={spender.userId} className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-300 dark:text-gray-600 w-6 text-center">{i + 1}</span>
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

          {(!analytics || analytics.byCategory.length === 0) && (
            <div className="card p-16 text-center">
              <div className="text-5xl mb-4">📊</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No spending data yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Add expenses to your groups to see analytics here</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'monthly', label: 'Monthly Review', icon: '📅' },
    { id: 'yearly', label: 'Year-End Review', icon: '🗓️' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track spending patterns, reviews & financial tips</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview />}
      {tab === 'monthly' && <MonthlyReview />}
      {tab === 'yearly' && <YearlyReview />}
    </div>
  );
}
