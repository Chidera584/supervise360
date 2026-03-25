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
  LayoutGrid,
  UserCog,
  Calendar,
  BarChart2,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen(open: boolean): void;
}

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

function getRoleSubtitle(role: string | undefined): string {
  switch (role) {
    case 'student':
      return 'Student portal';
    case 'supervisor':
    case 'external_supervisor':
      return 'Supervisor portal';
    case 'admin':
      return 'Academic admin';
    default:
      return 'Supervise360';
  }
}

export function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
    { icon: <Home size={20} strokeWidth={1.75} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Users size={20} strokeWidth={1.75} />, label: 'My Group', path: '/my-group' },
    { icon: <FileText size={20} strokeWidth={1.75} />, label: 'Reports', path: '/reports' },
    { icon: <MessageSquare size={20} strokeWidth={1.75} />, label: 'Messages', path: '/messages' },
    { icon: <ClipboardList size={20} strokeWidth={1.75} />, label: 'Defense & Evaluation', path: '/defense-evaluation' },
    { icon: <User size={20} strokeWidth={1.75} />, label: 'Profile', path: '/profile' },
  ];

  const supervisorMenuItems: MenuItem[] = [
    { icon: <Home size={20} strokeWidth={1.75} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Users size={20} strokeWidth={1.75} />, label: 'My Groups', path: '/my-groups' },
    { icon: <FileText size={20} strokeWidth={1.75} />, label: 'Evaluations', path: '/evaluations' },
    { icon: <ClipboardList size={20} strokeWidth={1.75} />, label: 'Report Reviews', path: '/report-reviews' },
    { icon: <MessageSquare size={20} strokeWidth={1.75} />, label: 'Messages', path: '/messages' },
    { icon: <User size={20} strokeWidth={1.75} />, label: 'Profile', path: '/profile' },
  ];

  const adminMenuItems: MenuItem[] = [
    { icon: <Home size={20} strokeWidth={1.75} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Building2 size={20} strokeWidth={1.75} />, label: 'Departments', path: '/departments' },
    { icon: <Users size={20} strokeWidth={1.75} />, label: 'Users', path: '/users' },
    { icon: <LayoutGrid size={20} strokeWidth={1.75} />, label: 'Groups', path: '/groups' },
    { icon: <UserCog size={20} strokeWidth={1.75} />, label: 'Supervisors', path: '/supervisor-assignment' },
    { icon: <Calendar size={20} strokeWidth={1.75} />, label: 'Defense Scheduling', path: '/defense-scheduling' },
    { icon: <BarChart2 size={20} strokeWidth={1.75} />, label: 'Reports & Analytics', path: '/reports-analytics' },
    { icon: <Settings size={20} strokeWidth={1.75} />, label: 'Settings', path: '/settings' },
    { icon: <User size={20} strokeWidth={1.75} />, label: 'Profile', path: '/profile' },
  ];

  const getMenuItems = () => {
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
  const subtitle = getRoleSubtitle(user?.role);

  const linkClass = (path: string) => {
    const active = location.pathname === path;
    return [
      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-colors cursor-pointer border-l-[3px]',
      active
        ? 'bg-brand-50 text-brand-800 font-medium border-brand-600 shadow-sm shadow-brand-900/5'
        : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    ].join(' ');
  };

  const shellClass =
    'flex flex-col bg-white text-slate-800 border-r border-slate-200/90 shadow-[2px_0_12px_-4px_rgba(15,23,42,0.06)]';

  const inner = (
    <>
      <div className="p-5 border-b border-slate-200/90 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo.png" alt="" className="h-9 w-9 object-contain rounded-xl ring-1 ring-slate-200/80 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 leading-tight truncate">Supervise360</h1>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-700/90 truncate">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-2 -mr-1 -mt-1 rounded-lg hover:bg-slate-100 text-slate-600 shrink-0"
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>
      </div>
      <nav className="flex-1 p-3 overflow-y-auto min-h-0">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Menu</p>
        {menuItems.map((item, idx) => (
          <div
            key={idx}
            role="button"
            tabIndex={0}
            onClick={() => {
              navigate(item.path);
              setMobileOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(item.path);
                setMobileOpen(false);
              }
            }}
            className={linkClass(item.path)}
          >
            <span className={location.pathname === item.path ? 'text-brand-700' : 'text-slate-500'}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-200/90 shrink-0">
        <button
          type="button"
          onClick={() => {
            signOut();
            setMobileOpen(false);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
        >
          <LogOut size={20} strokeWidth={1.75} />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-[2px]"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          style={{ touchAction: 'none' }}
        />
      )}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full min-h-[100dvh] w-72 max-w-[85vw] ${shellClass} z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {inner}
      </div>
      <div className={`hidden lg:flex w-64 flex-shrink-0 fixed left-0 top-0 h-screen ${shellClass} z-30 flex-col`}>
        {inner}
      </div>
    </>
  );
}
