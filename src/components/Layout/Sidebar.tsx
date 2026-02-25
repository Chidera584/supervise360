import { Home, Users, FileText, MessageSquare, Settings, User, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

export function Sidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change or resize to desktop
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
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
      <div className="p-6 border-b border-gray-600">
        <img src="/logo.png" alt="Supervise360" className="h-10 w-auto object-contain" />
      </div>
      <nav className="flex-1 p-4 overflow-y-auto">
        {menuItems.map((item, idx) => (
          <div
            key={idx}
            onClick={() => { navigate(item.path); setMobileOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors hover:bg-gray-700 cursor-pointer ${
              location.pathname === item.path ? 'bg-gray-700 border-l-4 border-[#1F7A8C]' : ''
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-600">
        <button
          onClick={() => { signOut(); setMobileOpen(false); }}
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
      {/* Mobile menu button - visible on lg and below */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-[#022B3A] text-white rounded-lg shadow-lg hover:bg-[#1F7A8C] transition-colors"
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      {/* Mobile drawer */}
      <div className={`lg:hidden fixed top-0 left-0 h-full w-72 max-w-[85vw] bg-[#022B3A] flex flex-col text-white z-50 transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
          <img src="/logo.png" alt="Supervise360" className="h-8 w-auto object-contain" />
          <button onClick={() => setMobileOpen(false)} className="p-2 hover:bg-gray-700 rounded-lg" aria-label="Close menu">
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          {menuItems.map((item, idx) => (
            <div
              key={idx}
              onClick={() => { navigate(item.path); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors hover:bg-gray-700 cursor-pointer ${
                location.pathname === item.path ? 'bg-gray-700 border-l-4 border-[#1F7A8C]' : ''
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-600">
          <button
            onClick={() => { signOut(); setMobileOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors text-red-300"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>
      {/* Desktop sidebar - fixed so it stays static when scrolling */}
      <div className="hidden lg:flex w-64 flex-shrink-0 fixed left-0 top-0 h-screen bg-[#022B3A] flex-col text-white z-30">
      {navContent}
      </div>
    </>
  );
}
