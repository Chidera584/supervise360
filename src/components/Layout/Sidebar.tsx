import {
  Home,
  Users,
  FileText,
  MessageSquare,
  Settings,
  User,
  LogOut,
  X,
  Building2,
  LayoutDashboard,
  LayoutGrid,
  UserCheck,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen(open: boolean): void;
}

interface MenuItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

const TEAL = '#006D6D';

export function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';
  const isSupervisor =
    user?.role === 'supervisor' || user?.role === 'external_supervisor';
  const isLightShell = isAdmin || isStudent || isSupervisor;

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const studentMenuItems: MenuItem[] = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'My Group', path: '/my-group' },
    { icon: FileText, label: 'Reports', path: '/reports' },
    { icon: MessageSquare, label: 'Messages', path: '/messages' },
    { icon: FileText, label: 'Defense & Evaluation', path: '/defense-evaluation' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const supervisorMenuItems: MenuItem[] = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'My Groups', path: '/my-groups' },
    { icon: FileText, label: 'Evaluations', path: '/evaluations' },
    { icon: FileText, label: 'Report Reviews', path: '/report-reviews' },
    { icon: MessageSquare, label: 'Messages', path: '/messages' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const adminMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Building2, label: 'Departments', path: '/departments' },
    { icon: Users, label: 'Users', path: '/users' },
    { icon: LayoutGrid, label: 'Groups', path: '/groups' },
    { icon: UserCheck, label: 'Supervisor assignment', path: '/supervisor-assignment' },
    { icon: Calendar, label: 'Defense scheduling', path: '/defense-scheduling' },
    { icon: BarChart3, label: 'Analytics', path: '/reports-analytics' },
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const getMenuItems = (): MenuItem[] => {
    switch (user?.role) {
      case 'student':
        return studentMenuItems;
      case 'supervisor':
      case 'external_supervisor':
        return supervisorMenuItems;
      case 'admin':
        return adminMenuItems;
      default:
        return studentMenuItems;
    }
  };

  const menuItems = getMenuItems();

  const linkClass = (path: string, mobile: boolean) => {
    const active = location.pathname === path;
    if (isLightShell) {
      return `w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] mb-1 transition-colors cursor-pointer text-sm ${
        active
          ? 'font-semibold bg-white/15 text-white'
          : 'text-white/90 hover:bg-white/10'
      }`;
    }
    const base = mobile ? '' : '';
    return `w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors cursor-pointer ${base} ${
      active ? 'bg-gray-700 border-l-4 border-[#1F7A8C]' : 'hover:bg-gray-700'
    }`;
  };

  const adminBranding = (
    <div className="px-1 pt-2 pb-4 border-b border-white/15">
      <div className="flex items-center gap-3">
        <img src="/logo-shell-white.png" alt="Supervise360" className="h-9 w-9 object-contain rounded-2xl shrink-0" />
        <div className="min-w-0">
          <p className="text-lg font-bold tracking-tight truncate text-white">Supervise360</p>
        </div>
      </div>
    </div>
  );

  const defaultBranding = (
    <div className="p-6 border-b border-white/15 flex items-center gap-3">
      <img src="/logo-shell-white.png" alt="Supervise360" className="h-8 w-8 object-contain rounded-2xl" />
      <h1 className="text-xl font-bold text-white">Supervise360</h1>
    </div>
  );

  const studentBranding = (
    <div className="px-1 pt-2 pb-4 border-b border-white/15 flex items-center gap-3">
      <img src="/logo-shell-white.png" alt="" className="h-9 w-9 object-contain rounded-2xl shrink-0" />
      <div className="min-w-0">
        <p className="text-lg font-bold tracking-tight truncate text-white">Supervise360</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/70 mt-0.5">
          Student portal
        </p>
      </div>
    </div>
  );

  const StudentNav = ({ mobile }: { mobile: boolean }) => (
    <>
      {mobile ? (
        <div className="px-4 pt-4 pb-2 border-b border-slate-200 shrink-0">{studentBranding}</div>
      ) : (
        <div className="px-4 pt-5 pb-0">{studentBranding}</div>
      )}
      <nav className={`flex-1 p-3 overflow-y-auto ${mobile ? 'min-h-0' : ''}`}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <div
              key={item.path}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate(item.path);
                  setMobileOpen(false);
                }
              }}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              className={linkClass(item.path, mobile)}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2 : 1.75}
                className={active ? 'text-white' : 'text-white/80'}
              />
              <span>{item.label}</span>
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-200 space-y-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            signOut();
            setMobileOpen(false);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm text-white/90 hover:bg-white/10 transition-colors"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  const AdminNav = ({ mobile }: { mobile: boolean }) => (
    <>
      {mobile ? (
        <div className="px-4 pt-4 pb-2 border-b border-slate-200 shrink-0">{adminBranding}</div>
      ) : (
        <div className="px-4 pt-5 pb-0">{adminBranding}</div>
      )}
      <nav className={`flex-1 p-3 overflow-y-auto ${mobile ? 'min-h-0' : ''}`}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <div
              key={item.path}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate(item.path);
                  setMobileOpen(false);
                }
              }}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              className={linkClass(item.path, mobile)}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2 : 1.75}
                className={active ? 'text-white' : 'text-white/80'}
              />
              <span>{item.label}</span>
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-200 space-y-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            signOut();
            setMobileOpen(false);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm text-white/90 hover:bg-white/10 transition-colors"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  const DefaultNav = () => (
    <>
      {defaultBranding}
      <nav className="flex-1 p-4 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.path}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate(item.path);
                  setMobileOpen(false);
                }
              }}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              className={linkClass(item.path, false)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </div>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-600">
        <button
          type="button"
          onClick={() => {
            signOut();
            setMobileOpen(false);
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors text-red-300"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          style={{ touchAction: 'none' }}
        />
      )}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full min-h-[100dvh] w-72 max-w-[85vw] flex flex-col z-50 transform transition-transform duration-300 ease-out ${
          isLightShell ? 'bg-[#006D6D] text-white border-r border-white/15' : 'bg-[#022B3A] text-white'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div
          className={`flex items-center justify-between p-4 border-b shrink-0 ${
            isLightShell ? 'border-slate-200' : 'border-gray-600'
          }`}
        >
          {!isLightShell && (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <img src="/logo-shell-white.png" alt="Supervise360" className="h-8 w-8 object-contain rounded-2xl shrink-0" />
                <h1 className="text-xl font-bold truncate">Supervise360</h1>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 hover:bg-gray-700 rounded-lg shrink-0"
                aria-label="Close menu"
              >
                <X size={24} />
              </button>
            </>
          )}
          {isLightShell && (
            <>
              <span className="text-sm font-semibold text-white">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg shrink-0 text-white/90"
                aria-label="Close menu"
              >
                <X size={22} />
              </button>
            </>
          )}
        </div>
        {isAdmin ? (
          <div className="flex flex-col flex-1 min-h-0">
            <AdminNav mobile />
          </div>
        ) : isStudent ? (
          <div className="flex flex-col flex-1 min-h-0">
            <StudentNav mobile />
          </div>
        ) : (
          <>
            <nav className="flex-1 min-h-0 p-4 overflow-y-auto overscroll-contain">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.path}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        navigate(item.path);
                        setMobileOpen(false);
                      }
                    }}
                    onClick={() => {
                      navigate(item.path);
                      setMobileOpen(false);
                    }}
                    className={linkClass(item.path, true)}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </nav>
            <div className="p-4 border-t border-gray-600">
              <button
                type="button"
                onClick={() => {
                  signOut();
                  setMobileOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors text-red-300"
              >
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </div>
          </>
        )}
      </div>

      <div
        className={`hidden lg:flex w-64 flex-shrink-0 fixed left-0 top-0 h-screen flex-col z-30 ${
          isLightShell ? 'bg-[#006D6D] text-white border-r border-white/15' : 'bg-[#022B3A] text-white'
        }`}
      >
        {isAdmin ? <AdminNav mobile={false} /> : isStudent ? <StudentNav mobile={false} /> : <DefaultNav />}
      </div>
    </>
  );
}
