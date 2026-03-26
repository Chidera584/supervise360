import { LogOut, Menu, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { MainLayoutTopBarSearch } from './MainLayout';

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
      <header className="sticky top-0 z-30 shrink-0 bg-[#006D6D] text-white border-b border-white/15 shadow-sm px-3 sm:px-5 py-3">
        <div className="flex items-center gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4">
          <div className="flex items-center gap-2 min-w-0 flex-1 lg:flex-none">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="lg:hidden p-2 -ml-1 rounded-lg text-white/90 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-white/20 bg-white/15 text-sm text-white placeholder:text-white/65 focus:outline-none focus:ring-2 focus:ring-white/25 focus:border-white/30"
                  aria-label={topBarSearch.placeholder}
                />
              </div>
            ) : (
              <span className="text-sm font-medium text-white/90 truncate lg:hidden">{title}</span>
            )}
          </div>

          <div className="flex items-center justify-end gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={signOut}
              className="p-2 rounded-lg text-white/90 hover:bg-white/10 transition-colors"
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
