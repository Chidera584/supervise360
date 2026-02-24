import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function MainLayout({ children, title }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen bg-[#f5f5f5]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title={title} />
        <main className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 pt-16 lg:pt-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
