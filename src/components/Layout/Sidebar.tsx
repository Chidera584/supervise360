import { Home, Users, FileText, MessageSquare, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

export function Sidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const studentMenuItems: MenuItem[] = [
    { icon: <Home size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Users size={20} />, label: 'My Group', path: '/my-group' },
    { icon: <FileText size={20} />, label: 'Project', path: '/project' },
    { icon: <FileText size={20} />, label: 'Reports', path: '/reports' },
    { icon: <MessageSquare size={20} />, label: 'Messages', path: '/messages' },
    { icon: <FileText size={20} />, label: 'Defense & Evaluation', path: '/defense-evaluation' },
    { icon: <Settings size={20} />, label: 'Profile', path: '/profile' },
  ];

  const supervisorMenuItems: MenuItem[] = [
    { icon: <Home size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Users size={20} />, label: 'My Groups', path: '/my-groups' },
    { icon: <FileText size={20} />, label: 'Project Proposals', path: '/project-proposals' },
    { icon: <FileText size={20} />, label: 'Evaluations', path: '/evaluations' },
    { icon: <FileText size={20} />, label: 'Report Reviews', path: '/report-reviews' },
    { icon: <MessageSquare size={20} />, label: 'Messages', path: '/messages' },
    { icon: <Settings size={20} />, label: 'Profile', path: '/profile' },
  ];

  const adminMenuItems: MenuItem[] = [
    { icon: <Home size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Users size={20} />, label: 'Users', path: '/users' },
    { icon: <Users size={20} />, label: 'Groups', path: '/groups' },
    { icon: <Users size={20} />, label: 'Supervisors', path: '/supervisor-assignment' },
    { icon: <FileText size={20} />, label: 'Defense Scheduling', path: '/defense-scheduling' },
    { icon: <FileText size={20} />, label: 'Reports & Analytics', path: '/reports-analytics' },
    { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
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

  return (
    <div className="w-64 flex-shrink-0 sticky top-0 h-screen bg-[#2c3e50] flex flex-col text-white">
      <div className="p-6 border-b border-gray-600">
        <h1 className="text-xl font-bold">Supervise360</h1>
      </div>

      <nav className="flex-1 p-4">
        {menuItems.map((item, idx) => (
          <div
            key={idx}
            onClick={() => navigate(item.path)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors hover:bg-gray-700 cursor-pointer ${
              location.pathname === item.path ? 'bg-gray-700 border-l-4 border-[#26a69a]' : ''
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-600">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors text-red-300"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
