import { Bell, User, LogOut, Trash2, X, Menu, Search, HelpCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../lib/api';
import { Link } from 'react-router-dom';
import type { MainLayoutTopBarSearch } from './MainLayout';

interface HeaderProps {
  title: string;
  onToggleSidebar?: () => void;
  topBarSearch?: MainLayoutTopBarSearch;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  type?: string;
  read_status?: boolean;
  created_at?: string;
}

const TEAL = '#006D6D';

export function Header({ title, onToggleSidebar, topBarSearch }: HeaderProps) {
  const { user, signOut } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';
  const isLightShell = isAdmin || isStudent;
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    try {
      const [countRes, listRes] = await Promise.all([
        apiClient.getNotificationUnreadCount(),
        apiClient.getRecentNotifications(10),
      ]);
      if (countRes.success && typeof countRes.data === 'number') {
        setUnreadCount(countRes.data);
      }
      if (listRes.success && Array.isArray(listRes.data)) {
        setNotifications(listRes.data as Notification[]);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    if (user) loadNotifications();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (dropdownOpen) loadNotifications();
  }, [dropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await apiClient.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_status: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (loading || unreadCount === 0) return;
    setLoading(true);
    try {
      await apiClient.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_status: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearOne = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (loading) return;
    try {
      await apiClient.clearNotification(id);
      const n = notifications.find((x) => x.id === id);
      setNotifications((prev) => prev.filter((x) => x.id !== id));
      if (n && !n.read_status) setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to clear notification:', err);
    }
  };

  const handleClearAll = async () => {
    if (loading || notifications.length === 0) return;
    setLoading(true);
    try {
      await apiClient.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to clear all notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const roleLabel = user?.role === 'admin'
    ? 'Administrator'
    : user?.role === 'student'
      ? 'Student'
      : user?.role === 'external_supervisor'
        ? 'External supervisor'
        : user?.role === 'supervisor'
          ? 'Supervisor'
          : '';

  const notificationBell = (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={`relative p-2 rounded-lg transition-colors ${
          isLightShell ? 'text-slate-600 hover:bg-slate-100' : 'text-white hover:bg-[#1F7A8C]/30'
        }`}
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 gap-2">
            <h3 className="font-semibold text-slate-800">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={loading}
                  className="text-xs font-medium hover:underline disabled:opacity-50"
                  style={{ color: TEAL }}
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={loading}
                  className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50 flex items-center gap-1"
                  title="Clear all notifications"
                >
                  <Trash2 size={12} />
                  Clear all
                </button>
              )}
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !n.read_status) handleMarkRead(n.id);
                  }}
                  onClick={() => !n.read_status && handleMarkRead(n.id)}
                  className={`px-4 py-3 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors group flex items-start gap-2 ${
                    !n.read_status ? 'bg-[#006D6D]/[0.06]' : ''
                  }`}
                >
                  <div className="flex gap-2 flex-1 min-w-0">
                    {!n.read_status && (
                      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: TEAL }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">
                        {n.title}
                      </p>
                      <p className="text-slate-600 text-xs mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        {formatDate(n.created_at)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleClearOne(e, n.id)}
                    disabled={loading}
                    className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-red-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    title="Clear notification"
                    aria-label="Clear notification"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} strokeWidth={1.75} />
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
            <span
              className="text-sm font-semibold tracking-wide whitespace-nowrap"
              style={{ color: TEAL }}
            >
              {isAdmin ? 'Academic Management System' : 'Student workspace'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-1 sm:gap-2 shrink-0">
            {notificationBell}
            <Link
              to={isAdmin ? '/settings' : '/profile'}
              className="hidden sm:inline-flex p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              title={isAdmin ? 'Help & settings' : 'Profile & help'}
            >
              <HelpCircle size={20} strokeWidth={1.75} />
            </Link>
            <div className="hidden sm:flex items-center gap-2 pl-1 border-l border-slate-200 ml-1">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                style={{ backgroundColor: TEAL }}
              >
                <User size={18} strokeWidth={1.75} />
              </div>
              <div className="hidden md:block min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate max-w-[140px]">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-slate-500 truncate max-w-[140px]">{roleLabel}</p>
              </div>
            </div>
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

      <div className="flex items-center gap-4">
        {notificationBell}

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1F7A8C] rounded-full flex items-center justify-center">
            <User size={18} />
          </div>
          <span className="text-sm hidden sm:inline truncate max-w-[120px]">
            {user?.first_name} {user?.last_name}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="ml-2 p-2 hover:bg-[#1F7A8C]/30 rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
