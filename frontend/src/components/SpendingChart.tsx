import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { CATEGORIES } from './ExpenseModal';

interface Props {
  type: 'pie' | 'bar' | 'line';
  data: any[];
  dataKey?: string;
  xKey?: string;
}

const PIE_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16'];

function getCategoryColor(category: string): string {
  const cat = CATEGORIES.find((c) => c.id === category);
  return cat?.color || '#6366f1';
}

export default function SpendingChart({ type, data, dataKey = 'amount', xKey = 'month' }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-600 text-sm">
        No data to display
      </div>
    );
  }

  if (type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius={90}
            label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={entry.category} fill={getCategoryColor(entry.category) || PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(val: number) => [`$${val.toFixed(2)}`, 'Amount']}
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg, #fff)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend
            formatter={(value) => {
              const cat = CATEGORIES.find((c) => c.id === value);
              return cat ? `${cat.icon} ${value}` : value;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            formatter={(val: number) => [`$${val.toFixed(2)}`, 'Spent']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
          />
          <Bar dataKey={dataKey} fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          formatter={(val: number) => [`$${val.toFixed(2)}`, 'Spent']}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
        />
        <Line type="monotone" dataKey={dataKey} stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: '#6366f1' }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
