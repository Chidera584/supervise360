import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function MainLayout({ children, title }: MainLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-100 flex">
      <Sidebar mobileOpen={mobileSidebarOpen} setMobileOpen={setMobileSidebarOpen} />
      <div className="flex-1 flex flex-col lg:ml-64 min-h-screen">
        <Header title={title} onToggleSidebar={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 pt-16 lg:pt-6 pb-[env(safe-area-inset-bottom)] min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
