import { Bell, User, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [unreadCount] = useState(0); // Placeholder for future notification system

  return (
    <header className="bg-[#1a237e] text-white px-6 py-4 flex items-center justify-between shadow-md">
      <h1 className="text-xl font-semibold">{title}</h1>

      <div className="flex items-center gap-4">
        <button className="relative p-2 hover:bg-[#283593] rounded-lg transition-colors">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#26a69a] rounded-full flex items-center justify-center">
            <User size={18} />
          </div>
          <span className="text-sm">{user?.first_name} {user?.last_name}</span>
          <button 
            onClick={signOut}
            className="ml-2 p-2 hover:bg-[#283593] rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
