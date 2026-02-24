import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export function LandingPage() {
  const navigate = useNavigate();

  const goToStudentLogin = () => navigate('/login?role=student');
  const goToSupervisorLogin = () => navigate('/login?role=supervisor');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Red accent stripe */}
      <div className="h-1 bg-gradient-to-r from-[#c41e3a] via-[#e63950] to-[#c41e3a]" />

      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2.5 group"
            >
              <div className="relative p-2 rounded-xl bg-gradient-to-br from-[#1e4d8b] to-[#163d6b] shadow-lg shadow-blue-900/20 group-hover:shadow-blue-900/30 transition-shadow">
                <GraduationCap className="w-6 h-6 text-white" />
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#c41e3a] rounded-full ring-2 ring-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-[#1e4d8b] to-[#163d6b] bg-clip-text text-transparent">
                SUPERVISE360
              </span>
            </button>

            <nav className="flex items-center gap-6">
              {[
                { label: 'Home', onClick: () => navigate('/') },
                { label: 'Student', onClick: goToStudentLogin },
                { label: 'Supervisor', onClick: goToSupervisorLogin },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="relative px-4 py-2 text-slate-600 font-medium text-lg rounded-lg hover:text-[#1e4d8b] hover:bg-blue-50/80 transition-all duration-200 group"
                >
                  {item.label}
                  <span className="absolute inset-0 rounded-lg bg-[#1e4d8b]/5 scale-0 group-hover:scale-100 transition-transform duration-200 -z-10" />
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 relative overflow-hidden">
        {/* Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(30, 77, 139, 0.88) 0%, rgba(22, 61, 107, 0.82) 50%, rgba(30, 77, 139, 0.78) 100%), url(/hero-graduation.png)`,
          }}
        />
        
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cyan-300/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />

        {/* Floating shapes */}
        <div className="absolute top-20 left-20 w-20 h-20 border-2 border-white/20 rounded-xl rotate-12 animate-float" />
        <div className="absolute top-1/3 right-32 w-12 h-12 border border-white/30 rounded-lg -rotate-12 animate-float" style={{ animationDelay: '-2s' }} />
        <div className="absolute bottom-32 left-1/4 w-16 h-16 border-2 border-white/15 rounded-full animate-float" style={{ animationDelay: '-4s' }} />

        {/* Hero content */}
        <div className="relative z-10 min-h-[calc(100vh-140px)] flex flex-col items-center justify-center px-6 text-center">
          <p className="text-blue-200 font-medium tracking-widest text-sm uppercase mb-4 animate-fade-in opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
            Student Project Management System
          </p>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6 leading-[1.1] animate-fade-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
            Streamline Your
            <br />
            <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent drop-shadow-sm">
              Academic Journey
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-blue-100/95 max-w-2xl leading-relaxed animate-fade-up opacity-0" style={{ animationDelay: '0.7s', animationFillMode: 'forwards' }}>
            Connect with supervisors, manage submissions, and track your project progress all in one place.
          </p>

          {/* Subtle accent line */}
          <div 
            className="mt-8 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-[#c41e3a] to-transparent animate-fade-in opacity-0"
            style={{ animationDelay: '1s', animationFillMode: 'forwards' }}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#022B3A] to-[#0a3d52] py-5">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <p className="text-sm text-slate-300">© 2026 Supervise360. Student Project Management System.</p>
          <a 
            href="/admin-login" 
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Admin Access
          </a>
        </div>
      </footer>
    </div>
  );
}
