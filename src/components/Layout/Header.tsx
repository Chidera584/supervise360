import { LogOut, Menu, Search, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { MainLayoutTopBarSearch } from './MainLayout';

const TEAL = '#006D6D';

interface HeaderProps {
  title: string;
  onToggleSidebar?: () => void;
  topBarSearch?: MainLayoutTopBarSearch;
}

export function Header({ title, onToggleSidebar, topBarSearch }: HeaderProps) {
  const { user, signOut } = useAuth();

  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'external_supervisor';
  const isLightShell = isAdmin || isStudent || isSupervisor;

  if (isLightShell) {
    return (
      <header className="sticky top-0 z-30 shrink-0 bg-white border-b border-slate-200/90 shadow-sm px-3 sm:px-5 py-3">
        <div className="flex items-center gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4">
          <div className="flex items-center gap-2 min-w-0 flex-1 lg:flex-none">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006D6D]/30"
                aria-label="Open navigation menu"
              >
                <Menu size={20} />
              </button>
            )}

            {topBarSearch ? (
              <div className="relative flex-1 min-w-0 max-w-xl">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                  strokeWidth={1.75}
                />
                <input
                  type="search"
                  value={topBarSearch.value}
                  onChange={(e) => topBarSearch.onChange(e.target.value)}
                  placeholder={topBarSearch.placeholder}
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200 bg-[#F8F9FA] text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006D6D]/25 focus:border-[#006D6D]/40"
                  aria-label={topBarSearch.placeholder}
                />
              </div>
            ) : (
              <span className="text-sm font-medium text-slate-500 truncate lg:hidden">{title}</span>
            )}
          </div>

          <div className="hidden lg:flex items-center justify-center px-2">
            <span className="text-sm font-semibold tracking-wide whitespace-nowrap" style={{ color: TEAL }}>
              {isAdmin ? 'Academic Management System' : 'Student workspace'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-1 sm:gap-2 shrink-0">
            {/* Help link only; notifications/profile icons intentionally removed */}
            <Link
              to={isAdmin ? '/settings' : '/profile'}
              className="hidden sm:inline-flex p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              title={isAdmin ? 'Help & settings' : 'Profile & help'}
            >
              <HelpCircle size={20} strokeWidth={1.75} />
            </Link>

            <button
              type="button"
              onClick={signOut}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
    );
  }

  // Dark header for other roles.
  return (
    <header className="sticky top-0 z-30 shrink-0 bg-[#022B3A] text-white px-4 sm:px-6 py-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-[#1F7A8C]/40 focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
        )}
        <h1 className="text-lg sm:text-xl font-semibold truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to={isAdmin ? '/settings' : '/profile'}
          className="hidden sm:inline-flex p-2 rounded-lg text-white/90 hover:bg-[#1F7A8C]/30 transition-colors"
          title={isAdmin ? 'Help & settings' : 'Profile & help'}
        >
          <HelpCircle size={20} strokeWidth={1.75} />
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="p-2 hover:bg-[#1F7A8C]/30 rounded-lg transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
