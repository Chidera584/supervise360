import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  Globe,
  GraduationCap,
  LayoutGrid,
  BarChart3,
  FileText,
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
        <div className="w-full px-4 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between gap-6 py-3.5 sm:py-4 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2.5 sm:gap-3 group shrink-0 min-w-0 text-left"
            >
              <img src="/logo-shell-white.png" alt="" className="h-9 sm:h-10 w-auto object-contain rounded-2xl shrink-0" />
              <span className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                Supervise360
              </span>
            </button>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-3 lg:gap-4 shrink-0">
              <nav className="flex items-center gap-2 lg:gap-3 shrink-0">
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

              <button
                type="button"
                onClick={goAdmin}
                className="px-3.5 lg:px-4 py-2 text-sm font-semibold rounded-lg border border-white/25 text-white hover:bg-white/10 transition-colors"
              >
                Admin login
              </button>
            </div>

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
        <section className="relative overflow-hidden bg-white border-b border-slate-100">
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(1200px 520px at 12% 0%, rgba(0,109,109,0.10) 0%, rgba(255,255,255,0) 60%), radial-gradient(900px 420px at 90% 20%, rgba(88,101,195,0.10) 0%, rgba(255,255,255,0) 60%)',
              }}
            />
          </div>

          <div className="relative z-10 w-full px-4 sm:px-8 lg:px-12 pt-8 sm:pt-10 lg:pt-12 pb-10 sm:pb-12 lg:pb-14">
            <div className="grid lg:grid-cols-12 gap-7 lg:gap-9 items-center">
              <div className="lg:col-span-6">
                <p
                  className="text-xs sm:text-sm font-semibold uppercase tracking-[0.22em] opacity-0"
                  data-animate="fade-in"
                  style={{ color: TEAL }}
                >
                  For modern supervision teams
                </p>
                <h1
                  className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold text-[#0f172a] leading-[1.05] opacity-0"
                  data-animate="fade-up"
                  style={{ transitionDelay: '120ms' }}
                >
                  Supervision made simple.
                </h1>
                <p
                  className="hidden sm:block mt-4 text-base sm:text-lg leading-relaxed opacity-0"
                  data-animate="fade-up"
                  style={{ color: MUTED, transitionDelay: '200ms' }}
                >
                  Manage groups, submissions, feedback, and defense scheduling in one workspace.
                </p>

                <div className="hidden sm:grid mt-6 grid-cols-2 gap-4 text-sm" data-animate="fade-in" style={{ transitionDelay: '420ms' }}>
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${TEAL}14` }}>
                      <ShieldCheck className="w-5 h-5" style={{ color: TEAL }} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">Audit-ready</p>
                      <p className="text-slate-600 mt-0.5">Clear records for review.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${SLATE_BLUE}14` }}>
                      <BarChart3 className="w-5 h-5" style={{ color: SLATE_BLUE }} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">Progress visible</p>
                      <p className="text-slate-600 mt-0.5">Milestones stay visible.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6" data-animate="slide-right" style={{ transitionDelay: '120ms' }}>
                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-300" />
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-300" />
                    </div>
                    <span className="text-xs font-semibold text-slate-500">Campus overview</span>
                  </div>
                  <div className="relative">
                    <img
                      src={slideImages[1]}
                      alt="Supervise360 preview"
                      className="w-full h-[320px] sm:h-[380px] object-cover"
                      style={{ filter: 'saturate(1.05) contrast(1.05)' }}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 -120px 140px rgba(15,23,42,0.35)' }} />
                    <div className="absolute left-5 right-5 bottom-5 rounded-2xl bg-white/90 backdrop-blur border border-white/60 p-4">
                      <p className="text-sm font-semibold text-slate-900">From proposal to final defense</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Students, supervisors, and admins stay aligned.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'Submissions', value: 'Reports' },
                    { label: 'Feedback', value: 'Reviews' },
                    { label: 'Coordination', value: 'Messages' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
                      <p className="text-sm font-bold text-slate-900 mt-1">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Journey */}
        <section id="journey" className="bg-white border-t border-slate-100">
          <div className="w-full px-4 sm:px-8 lg:px-12 py-10 sm:py-14">
            <h2
              className="text-2xl sm:text-3xl font-bold text-center text-[#1a1a1a] mb-3"
              data-animate="fade-up"
            >
              Choose your portal
            </h2>
            <p
              className="text-center max-w-xl mx-auto mb-7 sm:mb-10"
              style={{ color: MUTED }}
              data-animate="fade-in"
            >
              Choose your role and continue.
            </p>
              <div className="grid md:grid-cols-2 gap-5 lg:gap-6">
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
                  Submit reports, track milestones, and receive feedback.
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
                  className="text-left rounded-xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow text-white opacity-0"
                  data-animate="slide-right"
                style={{ backgroundColor: TEAL }}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-white/15 mb-5 border border-white/20">
                  <LayoutGrid className="w-6 h-6 text-white" strokeWidth={1.75} />
                </div>
                <h3 className="text-xl font-bold mb-2">For supervisors</h3>
                <p className="text-sm sm:text-base leading-relaxed text-white/90 mb-6">
                  Review submissions, guide groups, and manage evaluations.
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
          <div className="w-full px-4 sm:px-8 lg:px-12 py-10 sm:py-14">
            <div className="max-w-2xl mx-auto mb-9 sm:mb-10 text-center">
              <div className="h-1 w-12 rounded-full mx-auto mb-5" style={{ backgroundColor: TEAL }} />
              <h2 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a]" data-animate="fade-up">
                Designed around how campuses actually work
              </h2>
              <p className="mt-3 text-base sm:text-lg" style={{ color: MUTED }} data-animate="fade-in">
                Clear roles, faster follow-through.
              </p>
            </div>
            <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
              <div className="lg:col-span-6 space-y-5">
                {[
                  {
                    icon: LayoutGrid,
                    title: 'Groups stay structured',
                    body: 'Assignments and milestones stay visible.',
                  },
                  {
                    icon: FileText,
                    title: 'Submissions feel organized',
                    body: 'Track reports with clear states.',
                  },
                  {
                    icon: ShieldCheck,
                    title: 'Feedback is accountable',
                    body: 'Review notes and decisions are recorded.',
                  },
                ].map((f, i) => (
                  <div
                    key={f.title}
                    className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"
                    data-animate="fade-up"
                    style={{ transitionDelay: `${i * 120}ms` }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${TEAL}14` }}>
                        <f.icon className="w-6 h-6" style={{ color: TEAL }} strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-slate-900">{f.title}</p>
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{f.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-6" data-animate="slide-right">
                <div className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Preview</p>
                    <p className="text-lg font-bold text-slate-900 mt-1">A calmer workspace</p>
                  </div>
                  <img
                    src={slideImages[0]}
                    alt="Workspace preview"
                    className="w-full h-[320px] sm:h-[380px] object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="hidden sm:block mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-animate="fade-in">
                  <p className="text-sm font-semibold text-slate-900">
                    “Milestones and feedback became clear immediately.”
                  </p>
                  <p className="text-xs text-slate-500 mt-2">Department coordinator</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-10 sm:py-14 text-white" style={{ backgroundColor: SLATE_BLUE }}>
          <div className="w-full px-4 sm:px-8 lg:px-12">
            <div className="grid lg:grid-cols-2 gap-7 lg:gap-10 items-center">
              <div className="relative" data-animate="slide-left" style={{ transitionDelay: '60ms' }}>
                <div className="rounded-3xl bg-white/10 border border-white/15 overflow-hidden">
                  <img src={slideImages[2]} alt="Campus workflow" className="w-full h-[320px] object-cover opacity-90" loading="lazy" />
                </div>
              </div>
              <div data-animate="slide-right" style={{ transitionDelay: '140ms' }}>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-6" data-animate="fade-up">
                  Built for modern campuses
                </h2>
                <p className="text-white/85 text-base sm:text-lg leading-relaxed mb-10" data-animate="fade-in">
                  Works for small classes and large departments.
                </p>
                <div className="hidden md:grid md:grid-cols-2 gap-4">
                  {[
                    { t: 'Department-ready', d: 'Scales across your program.' },
                    { t: 'Clarity for everyone', d: 'Clear next steps for each role.' },
                    { t: 'Designed for focus', d: 'Less noise, better follow-through.' },
                    { t: 'Consistent records', d: 'History is preserved and searchable.' },
                  ].map((x) => (
                    <div key={x.t} className="rounded-2xl bg-white/10 border border-white/15 p-4">
                      <p className="font-semibold">{x.t}</p>
                      <p className="text-sm text-white/80 mt-1 leading-relaxed">{x.d}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden border-t border-slate-100 bg-[#f2f4f7]">
          <div className="absolute -right-20 top-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[#006D6D]/[0.07] pointer-events-none" />
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] mb-4" data-animate="fade-up">
              Ready to elevate your academic management?
            </h2>
            <p className="text-base sm:text-lg mb-8" style={{ color: MUTED }} data-animate="fade-in">
              Open your portal to get started.
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
        <div className="w-full px-4 sm:px-8 lg:px-12 py-10 sm:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
            <div className="sm:col-span-2 lg:col-span-1" data-animate="slide-left">
              <div className="flex items-center gap-2 mb-3">
                <img src="/logo-auth-teal.png" alt="" className="h-9 w-auto object-contain rounded-2xl" />
                <span className="font-bold text-[#1a1a1a]">
                  Supervise<span style={{ color: TEAL }}>360</span>
                </span>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: MUTED }}>
                A workspace for supervision, reporting, and milestones.
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
