import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const slideImages = ['/landing-slide-1.png', '/landing-slide-2.png', '/landing-slide-3.png'];

  const goToStudentLogin = () => { navigate('/login?role=student'); setMobileMenuOpen(false); };
  const goToSupervisorLogin = () => { navigate('/login?role=supervisor'); setMobileMenuOpen(false); };

  const navItems = [
    { label: 'Home', onClick: () => { navigate('/'); setMobileMenuOpen(false); } },
    { label: 'Student', onClick: goToStudentLogin },
    { label: 'Supervisor', onClick: goToSupervisorLogin },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700" />

      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 sm:gap-2.5 group shrink-0 min-w-0"
            >
              <img src="/logo.png" alt="" className="h-8 sm:h-10 w-auto object-contain rounded-xl shrink-0" />
              <span className="text-base sm:text-xl font-bold bg-gradient-to-r from-brand-700 to-brand-900 bg-clip-text text-transparent truncate">
                SUPERVISE360
              </span>
            </button>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-4 lg:gap-6 shrink-0">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="relative px-3 lg:px-4 py-2 text-slate-600 font-medium text-base lg:text-lg rounded-lg hover:text-brand-800 hover:bg-brand-50/90 transition-all duration-200 group"
                >
                  {item.label}
                  <span className="absolute inset-0 rounded-lg bg-brand-600/10 scale-0 group-hover:scale-100 transition-transform duration-200 -z-10" />
                </button>
              ))}
            </nav>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 -mr-2 text-slate-600 hover:text-brand-800 hover:bg-brand-50/90 rounded-lg transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile nav dropdown */}
          {mobileMenuOpen && (
            <nav className="md:hidden mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="w-full text-left px-4 py-3 text-slate-600 font-medium rounded-lg hover:text-brand-800 hover:bg-brand-50/90 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 relative">
        {/* Background slider */}
        <div className="absolute inset-0 overflow-hidden">
          {slideImages.map((src, idx) => (
            <div
              key={src}
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `url(${src})`,
                animation: 'fadeSlide 12s infinite',
                animationDelay: `${idx * 4}s`,
              }}
            />
          ))}

          {/* Dark overlay for readable text */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, rgba(15, 118, 110, 0.92) 0%, rgba(17, 94, 89, 0.88) 45%, rgba(15, 23, 42, 0.85) 100%)',
            }}
          />
        </div>

        <style>{`
          @keyframes fadeSlide {
            0% { opacity: 0; }
            8% { opacity: 1; }
            30% { opacity: 1; }
            40% { opacity: 0; }
            100% { opacity: 0; }
          }
        `}</style>
        
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-teal-300/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-brand-400/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />

        {/* Floating shapes */}
        <div className="absolute top-20 left-20 w-20 h-20 border-2 border-white/20 rounded-xl rotate-12 animate-float" />
        <div className="absolute top-1/3 right-32 w-12 h-12 border border-white/30 rounded-lg -rotate-12 animate-float" style={{ animationDelay: '-2s' }} />
        <div className="absolute bottom-32 left-1/4 w-16 h-16 border-2 border-white/15 rounded-full animate-float" style={{ animationDelay: '-4s' }} />

        {/* Hero content */}
        <div className="relative z-10 min-h-[min(calc(100vh-120px),600px)] flex flex-col items-center justify-center px-4 sm:px-6 py-10 sm:py-12 text-center">
          <p className="text-brand-100 font-medium tracking-widest text-xs sm:text-sm uppercase mb-3 sm:mb-4 animate-fade-in opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
            Academic supervision, simplified
          </p>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-4 sm:mb-6 leading-[1.15] animate-fade-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
            Streamline Your
            <br />
            <span className="bg-gradient-to-r from-white via-teal-100 to-emerald-100 bg-clip-text text-transparent drop-shadow-sm">
              academic journey
            </span>
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl text-teal-50/95 max-w-2xl leading-relaxed animate-fade-up opacity-0" style={{ animationDelay: '0.7s', animationFillMode: 'forwards' }}>
            Connect with supervisors, manage submissions, and track your project progress all in one place.
          </p>

          {/* Subtle accent line */}
          <div 
            className="mt-8 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent animate-fade-in opacity-0"
            style={{ animationDelay: '1s', animationFillMode: 'forwards' }}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-brand-900 via-slate-900 to-brand-950 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p className="text-xs sm:text-sm text-slate-300">© 2026 Supervise360. Student Project Management System.</p>
          <a 
            href="/admin-login" 
            className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors shrink-0"
          >
            Admin Access
          </a>
        </div>
      </footer>
    </div>
  );
}
