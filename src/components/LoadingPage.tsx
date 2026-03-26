interface LoadingPageProps {
  message?: string;
}

export function LoadingPage({ message = 'Loading...' }: LoadingPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 overflow-hidden">
      {/* Top accent stripe - matches LandingPage */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#c41e3a] via-[#e63950] to-[#c41e3a]" />

      {/* Soft gradient orbs in background */}
      <div className="fixed top-1/4 -left-32 w-80 h-80 bg-[#1e4d8b]/10 rounded-full blur-3xl animate-pulse" />
      <div className="fixed bottom-1/4 -right-32 w-96 h-96 bg-[#163d6b]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />

      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#1e4d8b] to-[#163d6b] blur-xl opacity-40 animate-pulse" />
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-[#1e4d8b] to-[#163d6b] shadow-lg shadow-blue-900/25">
              <img src="/logo.png" alt="Supervise360" className="w-14 h-14 object-contain rounded-xl" />
            </div>
          </div>
        </div>

        {/* Brand name */}
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#1e4d8b] to-[#163d6b] bg-clip-text text-transparent mb-6">
          Supervise360
        </h1>

        {/* Spinner */}
        <div className="relative mb-4">
          <div 
            className="w-12 h-12 rounded-full border-2 border-slate-200 border-t-[#1e4d8b] animate-spin"
            style={{ borderTopColor: '#1e4d8b' }}
          />
        </div>

        {/* Message */}
        <p className="text-slate-500 text-sm font-medium tracking-wide animate-pulse">
          {message}
        </p>

        {/* Subtle accent line */}
        <div className="mt-6 h-0.5 w-16 rounded-full bg-gradient-to-r from-transparent via-[#c41e3a]/60 to-transparent" />
      </div>

      {/* Footer hint */}
      <p className="fixed bottom-6 text-xs text-slate-400">
        Student Project Management System
      </p>
    </div>
  );
}
