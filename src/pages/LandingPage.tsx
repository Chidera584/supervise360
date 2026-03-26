import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  Globe,
  GraduationCap,
  LayoutGrid,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  Mail,
  BookOpen,
  LifeBuoy,
} from 'lucide-react';

const TEAL = '#006D6D';
const TEAL_HOVER = '#005a5a';
const SLATE_BLUE = '#5865C3';
const MUTED = '#4A4A4A';
const BG_SOFT = '#F8F9FA';

export function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const slideImages = ['/landing-slide-1.png', '/landing-slide-2.png', '/landing-slide-3.png'];

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-animate]'));
    if (els.length === 0) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    const applyInitialState = (el: HTMLElement) => {
      if (prefersReducedMotion) {
        el.style.opacity = '';
        el.style.transform = '';
        return;
      }

      const anim = el.getAttribute('data-animate') || 'fade-up';
      el.style.opacity = '0';
      el.style.willChange = 'opacity, transform';
      el.style.transition = 'opacity 650ms ease, transform 650ms ease';

      if (anim === 'slide-left') {
        el.style.transform = 'translateX(-28px)';
      } else if (anim === 'slide-right') {
        el.style.transform = 'translateX(28px)';
      } else if (anim === 'fade-in') {
        el.style.transform = 'translateY(0)';
      } else {
        // fade-up default
        el.style.transform = 'translateY(18px)';
      }
    };

    const applyVisibleState = (el: HTMLElement) => {
      const anim = el.getAttribute('data-animate') || 'fade-up';
      el.style.opacity = '1';
      el.style.willChange = '';

      if (anim === 'slide-left' || anim === 'slide-right') {
        el.style.transform = 'translateX(0)';
      } else {
        el.style.transform = 'translateY(0)';
      }
    };

    // Set initial hidden state immediately to avoid flicker.
    els.forEach(applyInitialState);
    if (prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          applyVisibleState(el);
          observer.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' }
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const goToStudentLogin = () => {
    navigate('/login?role=student');
    setMobileMenuOpen(false);
  };
  const goToSupervisorLogin = () => {
    navigate('/login?role=supervisor');
    setMobileMenuOpen(false);
  };
  const goAdmin = () => {
    navigate('/admin-login');
    setMobileMenuOpen(false);
  };

  const navItems = [
    { label: 'Home', onClick: () => { navigate('/'); setMobileMenuOpen(false); } },
    { label: 'Student', onClick: goToStudentLogin },
    { label: 'Supervisor', onClick: goToSupervisorLogin },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--landing-bg)]" style={{ ['--landing-bg' as string]: BG_SOFT }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#006d6d] border-b border-white/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-6 py-3.5 sm:py-4 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2.5 sm:gap-3 group shrink-0 min-w-0 text-left"
            >
              <img src="/logo-shell-white.png" alt="" className="h-9 sm:h-10 w-auto object-contain shrink-0" />
              <span className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                Supervise360
              </span>
            </button>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-2 lg:gap-3 shrink-0">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={[
                    'px-3 lg:px-4 py-2 text-sm font-medium tracking-wide rounded-lg transition-colors',
                    item.label === 'Home' && location.pathname === '/'
                      ? 'bg-white/15 text-white font-semibold border border-white/20'
                      : 'text-white/90 hover:text-white hover:bg-white/10',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 -mr-2 text-white/90 hover:bg-white/10 rounded-lg transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {mobileMenuOpen && (
            <nav className="md:hidden pb-4 border-t border-white/15 flex flex-col gap-0.5 pt-3">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={[
                    'w-full text-left px-4 py-3 rounded-lg transition-colors',
                    item.label === 'Home' && location.pathname === '/'
                      ? 'text-white font-semibold bg-white/15 border border-white/20'
                      : 'text-white/90 font-medium hover:bg-white/10',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={goAdmin}
                className="w-full text-left px-4 py-3 text-sm font-medium rounded-lg text-white/80 hover:bg-white/10 transition-colors"
              >
                Admin Login
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            {slideImages.map((src, idx) => (
              <div
                key={src}
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url(${src})`,
                  animation: 'fadeSlide 12s infinite',
                  animationDelay: `${idx * 4}s`,
                  opacity: 0.55,
                  filter: 'saturate(1.12) contrast(1.08) brightness(1.02)',
                  transform: 'scale(1.04)',
                }}
              />
            ))}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(248,249,250,0.78) 0%, rgba(255,255,255,0.88) 45%, rgba(242,244,247,0.93) 100%)',
              }}
            />
            <div className="absolute -top-24 -right-24 w-[min(420px,50vw)] h-[min(420px,50vw)] rounded-full bg-[#006D6D]/[0.06] blur-3xl" />
            <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-[#5865C3]/[0.08] blur-3xl" />
          </div>

          <style>{`
            @keyframes fadeSlide {
              0% { opacity: 0.18; }
              8% { opacity: 0.66; }
              30% { opacity: 0.66; }
              40% { opacity: 0.22; }
              100% { opacity: 0.22; }
            }
          `}</style>

          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-20 pb-16 sm:pb-20 text-center">
            <p
              className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] mb-4 opacity-0"
              data-animate="fade-in"
              style={{ color: TEAL, animationDelay: '0.1s', animationFillMode: 'forwards' }}
            >
              Academic supervision platform
            </p>
            <h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-bold text-[#1a1a1a] leading-tight max-w-4xl mx-auto opacity-0"
              data-animate="fade-up"
              style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}
            >
              Academic excellence through
              <br className="hidden sm:block" />
              <span className="sm:ml-2 font-['Playfair_Display',serif] italic font-medium text-[#006D6D]">Streamlined</span>
              <span className="sm:ml-2">supervision</span>
            </h1>
            <p
              className="mt-5 sm:mt-6 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed opacity-0"
              data-animate="fade-up"
              style={{ color: MUTED, animationDelay: '0.35s', animationFillMode: 'forwards' }}
            >
              Connect students and supervisors, manage submissions, and keep milestones visible in one calm, structured workspace.
            </p>
            <div
              className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 opacity-0"
              data-animate="fade-up"
              style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}
            >
              <button
                type="button"
                onClick={goToStudentLogin}
                className="w-full sm:w-auto px-8 py-3.5 rounded-[10px] text-white font-semibold text-sm sm:text-base shadow-sm hover:shadow-md transition-all"
                style={{ backgroundColor: TEAL }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = TEAL_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = TEAL; }}
              >
                Get started
              </button>
              <button
                type="button"
                onClick={goAdmin}
                className="w-full sm:w-auto px-8 py-3.5 rounded-[10px] font-semibold text-sm sm:text-base border-2 bg-white transition-colors hover:bg-slate-50"
                style={{ borderColor: TEAL, color: TEAL }}
              >
                Admin login
              </button>
            </div>
          </div>
        </section>

        {/* Journey */}
        <section id="journey" className="bg-white border-t border-slate-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <h2
              className="text-2xl sm:text-3xl font-bold text-center text-[#1a1a1a] mb-3"
              data-animate="fade-up"
            >
              Select your journey
            </h2>
            <p
              className="text-center max-w-xl mx-auto mb-10 sm:mb-14"
              style={{ color: MUTED }}
              data-animate="fade-in"
            >
              Choose the path that matches your role. You will sign in with your institutional credentials.
            </p>
              <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
              <button
                type="button"
                onClick={goToStudentLogin}
                  className="text-left rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm hover:shadow-md hover:border-slate-300/80 transition-all group relative overflow-hidden opacity-0"
                  data-animate="slide-left"
              >
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-lg mb-5"
                  style={{ backgroundColor: `${TEAL}14` }}
                >
                  <GraduationCap className="w-6 h-6" style={{ color: TEAL }} strokeWidth={1.75} />
                </div>
                <h3 className="text-xl font-bold text-[#1a1a1a] mb-2">For students</h3>
                <p className="text-sm sm:text-base leading-relaxed mb-6" style={{ color: MUTED }}>
                  View your group, submit reports, and stay on top of milestones and feedback.
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: TEAL }}>
                  Explore student portal
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <div className="pointer-events-none absolute bottom-0 right-0 w-28 h-20 sm:w-36 sm:h-24 opacity-40 rounded-tl-2xl bg-gradient-to-tl from-slate-200 to-transparent" aria-hidden />
              </button>

              <button
                type="button"
                onClick={goToSupervisorLogin}
                  className="text-left rounded-xl p-6 sm:p-8 shadow-md hover:shadow-lg transition-shadow text-white opacity-0"
                  data-animate="slide-right"
                style={{ backgroundColor: TEAL }}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-white/15 mb-5 border border-white/20">
                  <LayoutGrid className="w-6 h-6 text-white" strokeWidth={1.75} />
                </div>
                <h3 className="text-xl font-bold mb-2">For supervisors</h3>
                <p className="text-sm sm:text-base leading-relaxed text-white/90 mb-6">
                  Review submissions, guide groups, and keep supervision work organized in one portfolio-style view.
                </p>
                <span
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-[10px] bg-white text-sm font-semibold w-full sm:w-auto"
                  style={{ color: TEAL }}
                >
                  Explore Supervisor Portal
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-slate-100" style={{ backgroundColor: BG_SOFT }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-14">
              <div className="h-1 w-12 rounded-full mx-auto mb-5" style={{ backgroundColor: TEAL }} />
              <h2 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a]" data-animate="fade-up">
                Designed for academic clarity
              </h2>
              <p className="mt-3 text-base sm:text-lg" style={{ color: MUTED }} data-animate="fade-in">
                Fewer handoffs, clearer expectations, and reporting that stays close to the work.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-8 sm:gap-10">
              {[
                {
                  icon: LayoutGrid,
                  title: 'Structured allocation',
                  body: 'Groups and roles stay visible so supervision load and assignments are easier to track.',
                },
                {
                  icon: BarChart3,
                  title: 'Real-time progress',
                  body: 'Reports and milestones surface in one timeline—less chasing, more teaching.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Accountable workflows',
                  body: 'Structured reviews and records help uphold integrity without slowing people down.',
                },
              ].map((f, i) => (
                <div
                  key={f.title}
                  className="text-center sm:text-left"
                  data-animate={i % 2 === 0 ? 'slide-left' : 'slide-right'}
                  style={{ transitionDelay: `${i * 120}ms` }}
                >
                  <div
                    className="inline-flex items-center justify-center w-11 h-11 rounded-lg mb-4 mx-auto sm:mx-0"
                    style={{ backgroundColor: `${TEAL}18` }}
                  >
                    <f.icon className="w-5 h-5" style={{ color: TEAL }} strokeWidth={1.75} />
                  </div>
                  <h3 className="text-lg font-bold text-[#1a1a1a] mb-2">{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-14 sm:py-20 text-white" style={{ backgroundColor: SLATE_BLUE }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="relative" data-animate="slide-left" style={{ transitionDelay: '60ms' }}>
                <div className="aspect-[4/3] max-w-md mx-auto lg:mx-0 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
                  <div className="text-center p-8">
                    <GraduationCap className="w-14 h-14 mx-auto text-white/80 mb-4" strokeWidth={1.25} />
                    <p className="text-sm font-medium text-white/80 uppercase tracking-widest">Institutions</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-2">Built for modern campuses</p>
                  </div>
                </div>
              </div>
              <div data-animate="slide-right" style={{ transitionDelay: '140ms' }}>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-6" data-animate="fade-up">
                  Empowering teams to run supervision with confidence
                </h2>
                <p className="text-white/85 text-base sm:text-lg leading-relaxed mb-10" data-animate="fade-in">
                  Whether you coordinate dozens of groups or hundreds, Supervise360 keeps the academic narrative coherent—for students, supervisors, and administrators.
                </p>
                <div className="grid grid-cols-2 gap-6 sm:gap-8">
                  <div>
                    <p className="text-3xl sm:text-4xl font-bold tabular-nums">12k+</p>
                    <p className="text-sm text-white/80 mt-1">Supervision touchpoints tracked</p>
                  </div>
                  <div>
                    <p className="text-3xl sm:text-4xl font-bold tabular-nums">450k+</p>
                    <p className="text-sm text-white/80 mt-1">Milestones and submissions logged</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden border-t border-slate-100 bg-[#f2f4f7]">
          <div className="absolute -right-20 top-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[#006D6D]/[0.07] pointer-events-none" />
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] mb-4" data-animate="fade-up">
              Ready to elevate your academic management?
            </h2>
            <p className="text-base sm:text-lg mb-8" style={{ color: MUTED }} data-animate="fade-in">
              Open the student portal to get started, or head to admin login if you manage the platform.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={goToStudentLogin}
                className="w-full sm:w-auto px-8 py-3.5 rounded-[10px] text-white font-semibold shadow-sm hover:shadow transition-all"
                style={{ backgroundColor: TEAL }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = TEAL_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = TEAL; }}
                data-animate="slide-left"
              >
                Open student portal
              </button>
              <button
                type="button"
                onClick={goToSupervisorLogin}
                className="w-full sm:w-auto px-2 py-3 text-sm sm:text-base font-semibold border-0 bg-transparent hover:underline underline-offset-4"
                style={{ color: TEAL }}
                data-animate="slide-right"
              >
                Supervisor sign-in
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
            <div className="sm:col-span-2 lg:col-span-1" data-animate="slide-left">
              <div className="flex items-center gap-2 mb-3">
                <img src="/logo-auth-teal.png" alt="" className="h-9 w-auto object-contain" />
                <span className="font-bold text-[#1a1a1a]">
                  Supervise<span style={{ color: TEAL }}>360</span>
                </span>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: MUTED }}>
                A structured workspace for student supervision, reporting, and academic milestones.
              </p>
              <div className="flex items-center gap-3">
                <a href="#" className="p-2 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-[#006D6D] transition-colors" aria-label="Social">
                  <Globe className="w-4 h-4" />
                </a>
                <a href="#" className="p-2 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-[#006D6D] transition-colors" aria-label="Social">
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>
            <div data-animate="slide-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Product</p>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#features" className="hover:text-[#006D6D] transition-colors" style={{ color: MUTED }}>
                    Features
                  </a>
                </li>
                <li>
                  <button type="button" onClick={goToStudentLogin} className="hover:text-[#006D6D] transition-colors text-left" style={{ color: MUTED }}>
                    Student portal
                  </button>
                </li>
                <li>
                  <button type="button" onClick={goToSupervisorLogin} className="hover:text-[#006D6D] transition-colors text-left" style={{ color: MUTED }}>
                    Supervisor access
                  </button>
                </li>
              </ul>
            </div>
            <div data-animate="slide-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Resources</p>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="inline-flex items-center gap-1.5 hover:text-[#006D6D] transition-colors" style={{ color: MUTED }}>
                    <BookOpen className="w-3.5 h-3.5" />
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="inline-flex items-center gap-1.5 hover:text-[#006D6D] transition-colors" style={{ color: MUTED }}>
                    <LifeBuoy className="w-3.5 h-3.5" />
                    Help center
                  </a>
                </li>
              </ul>
            </div>
            <div data-animate="slide-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Contact</p>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="mailto:support@supervise360.local" className="hover:text-[#006D6D] transition-colors" style={{ color: MUTED }}>
                    Email us
                  </a>
                </li>
                <li>
                  <button type="button" onClick={goAdmin} className="hover:text-[#006D6D] transition-colors text-left" style={{ color: MUTED }}>
                    Admin login
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Supervise360. All rights reserved.</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a href="#" className="hover:text-[#006D6D] transition-colors">Cookie policy</a>
              <a href="#" className="hover:text-[#006D6D] transition-colors">Privacy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
