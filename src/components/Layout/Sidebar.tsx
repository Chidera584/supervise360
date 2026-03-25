import { Home, Users, FileText, MessageSquare, Settings, User, LogOut, X, Building2 } from 'lucide-react';
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

const navItemBase =
  'w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors cursor-pointer text-slate-300 hover:bg-white/5 hover:text-white';
const navItemActive =
  'bg-white/[0.08] text-white border-l-[3px] border-accent shadow-sm shadow-black/10';

export function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Close mobile menu on route change or resize to desktop
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
    { icon: <Home size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Users size={20} />, label: 'My Group', path: '/my-group' },
    { icon: <FileText size={20} />, label: 'Reports', path: '/reports' },
    { icon: <MessageSquare size={20} />, label: 'Messages', path: '/messages' },
    { icon: <FileText size={20} />, label: 'Defense & Evaluation', path: '/defense-evaluation' },
    { icon: <User size={20} />, label: 'Profile', path: '/profile' },
  ];

  const supervisorMenuItems: MenuItem[] = [
    { icon: <Home size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Users size={20} />, label: 'My Groups', path: '/my-groups' },
    { icon: <FileText size={20} />, label: 'Evaluations', path: '/evaluations' },
    { icon: <FileText size={20} />, label: 'Report Reviews', path: '/report-reviews' },
    { icon: <MessageSquare size={20} />, label: 'Messages', path: '/messages' },
    { icon: <User size={20} />, label: 'Profile', path: '/profile' },
  ];

  const adminMenuItems: MenuItem[] = [
    { icon: <Home size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Building2 size={20} />, label: 'Departments', path: '/departments' },
    { icon: <Users size={20} />, label: 'Users', path: '/users' },
    { icon: <Users size={20} />, label: 'Groups', path: '/groups' },
    { icon: <Users size={20} />, label: 'Supervisors', path: '/supervisor-assignment' },
    { icon: <FileText size={20} />, label: 'Defense Scheduling', path: '/defense-scheduling' },
    { icon: <FileText size={20} />, label: 'Reports & Analytics', path: '/reports-analytics' },
    { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
    { icon: <User size={20} />, label: 'Profile', path: '/profile' },
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

  const navContent = (
    <>
      <div className="p-6 border-b border-white/10 flex items-center gap-3">
        <img src="/logo.png" alt="Supervise360" className="h-9 w-9 object-contain rounded-xl ring-1 ring-white/10" />
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-white tracking-tight truncate">Supervise360</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">Academic Suite</p>
        </div>
      </div>
      <nav className="flex-1 p-3 overflow-y-auto">
        {menuItems.map((item, idx) => (
          <div
            key={idx}
            onClick={() => {
              navigate(item.path);
              setMobileOpen(false);
            }}
            className={`${navItemBase} ${location.pathname === item.path ? navItemActive : 'border-l-[3px] border-transparent'}`}
          >
            {item.icon}
            <span className="text-sm font-medium">{item.label}</span>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-white/10">
        <button
          onClick={() => {
            signOut();
            setMobileOpen(false);
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-500/10 transition-colors text-red-300/90 text-sm font-medium"
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
          className="lg:hidden fixed inset-0 bg-slate-950/60 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          style={{ touchAction: 'none' }}
        />
      )}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full min-h-[100dvh] w-72 max-w-[85vw] bg-primary flex flex-col text-white z-50 border-r border-white/5 transform transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo.png" alt="Supervise360" className="h-9 w-9 object-contain rounded-xl shrink-0 ring-1 ring-white/10" />
            <h1 className="text-lg font-semibold truncate">Supervise360</h1>
          </div>
          <button onClick={() => setMobileOpen(false)} className="p-2 hover:bg-white/10 rounded-lg shrink-0" aria-label="Close menu">
            <X size={22} />
          </button>
        </div>
        <nav className="flex-1 min-h-0 p-3 overflow-y-auto overscroll-contain">
          {menuItems.map((item, idx) => (
            <div
              key={idx}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              className={`${navItemBase} ${location.pathname === item.path ? navItemActive : 'border-l-[3px] border-transparent'}`}
            >
              {item.icon}
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => {
              signOut();
              setMobileOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-500/10 transition-colors text-red-300/90 text-sm font-medium"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>
      <div className="hidden lg:flex w-64 flex-shrink-0 fixed left-0 top-0 h-screen bg-primary flex-col text-white z-30 border-r border-white/5 shadow-xl shadow-slate-950/20">
        {navContent}
      </div>
    </>
  );
}
