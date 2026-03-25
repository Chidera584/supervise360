import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../contexts/AuthContext';

export interface MainLayoutTopBarSearch {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  topBarSearch?: MainLayoutTopBarSearch;
}

export function MainLayout({ children, title, topBarSearch }: MainLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className={`min-h-screen flex ${isAdmin ? 'bg-[#F8F9FA]' : 'bg-slate-50'}`}>
      <Sidebar mobileOpen={mobileSidebarOpen} setMobileOpen={setMobileSidebarOpen} />
      <div className="flex-1 flex flex-col lg:ml-64 min-h-screen min-w-0">
        <Header title={title} onToggleSidebar={() => setMobileSidebarOpen(true)} topBarSearch={topBarSearch} />
        <main
          className={`flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 pt-16 lg:pt-6 pb-[env(safe-area-inset-bottom)] min-w-0 ${
            isAdmin ? 'bg-[#F8F9FA]' : ''
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
