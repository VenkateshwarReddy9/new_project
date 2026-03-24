import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BarChart2, Plus, X, Wallet2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { groupsApi } from '../api/groups';
import { useState } from 'react';
import CreateGroupModal from './CreateGroupModal';

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: groupsApi.list,
  });

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <Link to="/" className="flex items-center gap-2" onClick={onClose}>
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Wallet2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">SplitSmart</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg lg:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </Link>
          );
        })}

        {/* Groups section */}
        <div className="pt-4">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Groups
            </span>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Create group"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-0.5">
            {groups?.map((group) => {
              const active = location.pathname === `/groups/${group.id}`;
              return (
                <Link
                  key={group.id}
                  to={`/groups/${group.id}`}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="text-base flex-shrink-0">{group.emoji}</span>
                  <span className="truncate">{group.name}</span>
                  {group.myBalance !== 0 && (
                    <span
                      className={`ml-auto text-xs font-medium flex-shrink-0 ${
                        group.myBalance > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                      }`}
                    >
                      {group.myBalance > 0 ? '+' : ''}{group.myBalance.toFixed(0)}
                    </span>
                  )}
                </Link>
              );
            })}

            {(!groups || groups.length === 0) && (
              <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-600">
                No groups yet
              </p>
            )}
          </div>
        </div>
      </nav>

      {/* Create group modal */}
      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
    </div>
  );
}
