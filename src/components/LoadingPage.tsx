interface LoadingPageProps {
  message?: string;
}

export function LoadingPage({ message = 'Loading...' }: LoadingPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 overflow-hidden">
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#c41e3a] via-[#e63950] to-[#c41e3a]" />

      <div className="fixed top-1/4 -left-32 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse" />
      <div className="fixed bottom-1/4 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-8 flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent to-primary blur-xl opacity-35 animate-pulse" />
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary to-indigo-800 shadow-lg shadow-slate-900/25">
              <img src="/logo.png" alt="Supervise360" className="w-14 h-14 object-contain rounded-xl" />
            </div>
          </div>
        </div>

        <h1 className="text-xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent mb-6">
          Supervise360
        </h1>

        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-full border-2 border-slate-200 border-t-accent animate-spin" />
        </div>

        <p className="text-slate-500 text-sm font-medium tracking-wide animate-pulse">{message}</p>

        <div className="mt-6 h-0.5 w-16 rounded-full bg-gradient-to-r from-transparent via-[#c41e3a]/60 to-transparent" />
      </div>

      <p className="fixed bottom-6 text-xs text-slate-400">Student Project Management System</p>
    </div>
  );
}
