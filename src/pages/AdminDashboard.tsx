import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '../components/Layout/MainLayout';
import { apiClient } from '../lib/api';
import {
  Users,
  UserCheck,
  Building,
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  Info,
  AlertTriangle,
  LayoutGrid,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const TEAL = '#006D6D';
const FOREST = '#1a4d3e';

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [supervisorCount, setSupervisorCount] = useState<number | null>(null);
  const [deptStats, setDeptStats] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      const [dashRes, workloadRes, deptRes] = await Promise.all([
        apiClient.getAdminDashboard(),
        apiClient.getSupervisorWorkload(),
        apiClient.getDepartmentStats().catch(() => ({ success: false, data: [] })),
      ]);
      if (dashRes.success) setDashboard(dashRes.data);
      const totals = dashRes.data?.totals || {};
      setStudentCount(totals.students ?? null);
      if (workloadRes.success && workloadRes.data?.totalStats?.totalSupervisors != null) {
        setSupervisorCount(workloadRes.data.totalStats.totalSupervisors);
      } else {
        setSupervisorCount(totals.supervisors ?? null);
      }
      if (deptRes.success && Array.isArray(deptRes.data)) {
        setDeptStats(deptRes.data);
      }
      setLoading(false);
    };
    fetchDashboard();
  }, []);

  const totals = dashboard?.totals || {};
  const displayStudents = studentCount ?? totals.students ?? 0;
  const displayGroups = totals.groups ?? 0;
  const displaySupervisors = supervisorCount ?? totals.supervisors ?? 0;
  const gpaDistribution = dashboard?.gpaDistribution || { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const gpaTotal = (gpaDistribution.HIGH || 0) + (gpaDistribution.MEDIUM || 0) + (gpaDistribution.LOW || 0);

  const barPalette = ['#006D6D', '#5865C3', '#b45309', '#0ea5e9'];

  const deptBars = useMemo(() => {
    const list = [...deptStats].sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0)).slice(0, 4);
    const max = Math.max(...list.map((d) => d.studentCount || 0), 1);
    return list.map((d, i) => ({
      ...d,
      pct: Math.round(((d.studentCount || 0) / max) * 100),
      color: barPalette[i % barPalette.length],
    }));
  }, [deptStats]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <MainLayout title="Admin overview">
      <div className="max-w-6xl mx-auto space-y-8 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">Admin overview</h1>
            <p className="text-slate-500 mt-1 text-sm sm:text-base">{today}</p>
          </div>
          <Link
            to="/reports-analytics"
            className="text-sm font-semibold hover:underline shrink-0"
            style={{ color: TEAL }}
          >
            View full analytics
          </Link>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${TEAL}18` }}
            >
              <GraduationCap className="w-6 h-6" style={{ color: TEAL }} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-500">Active students</p>
              <p className="text-2xl font-bold text-[#1a1a1a] tabular-nums mt-0.5">
                {loading ? '—' : displayStudents.toLocaleString()}
              </p>
              <span className="inline-flex mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                Live totals
              </span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${TEAL}18` }}
            >
              <UserCheck className="w-6 h-6" style={{ color: TEAL }} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-500">Faculty supervisors</p>
              <p className="text-2xl font-bold text-[#1a1a1a] tabular-nums mt-0.5">
                {loading ? '—' : displaySupervisors.toLocaleString()}
              </p>
              <span className="inline-flex mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                Across departments
              </span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${TEAL}18` }}
            >
              <Building className="w-6 h-6" style={{ color: TEAL }} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-500">Research groups</p>
              <p className="text-2xl font-bold text-[#1a1a1a] tabular-nums mt-0.5">
                {loading ? '—' : displayGroups.toLocaleString()}
              </p>
              <span className="inline-flex mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
                Project groups
              </span>
            </div>
          </div>
        </div>

        {/* Distribution + GPA */}
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-6">
              <h2 className="text-lg font-bold text-[#1a1a1a]">Departmental distribution</h2>
              <Link to="/departments" className="text-sm font-semibold flex items-center gap-1" style={{ color: TEAL }}>
                View departments <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {deptBars.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No department data yet.</p>
            ) : (
              <ul className="space-y-4">
                {deptBars.map((d) => (
                  <li key={d.id}>
                    <div className="flex justify-between text-sm mb-1.5 gap-2">
                      <span className="font-medium text-slate-800 truncate">{d.name}</span>
                      <span className="text-slate-500 tabular-nums shrink-0">
                        {d.studentCount?.toLocaleString?.() ?? d.studentCount} students
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${d.pct}%`, backgroundColor: d.color }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            className="lg:col-span-2 rounded-xl border border-slate-200/60 shadow-md p-5 sm:p-6 text-white flex flex-col min-h-[280px]"
            style={{ background: `linear-gradient(160deg, ${FOREST} 0%, #0f2d24 100%)` }}
          >
            <h2 className="text-lg font-bold mb-4">GPA summary</h2>
            <div className="flex-1 flex items-end gap-2 sm:gap-3 min-h-[140px] pt-2">
              {[
                { key: 'HIGH', label: 'High', val: gpaDistribution.HIGH || 0 },
                { key: 'MEDIUM', label: 'Mid', val: gpaDistribution.MEDIUM || 0 },
                { key: 'LOW', label: 'Low', val: gpaDistribution.LOW || 0 },
              ].map((t) => {
                const h = gpaTotal > 0 ? Math.max(12, Math.round(((t.val) / gpaTotal) * 100)) : 8;
                return (
                  <div key={t.key} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-md min-h-[24px] transition-all"
                      style={{
                        height: `${h}px`,
                        background: `linear-gradient(180deg, rgba(0,109,109,0.9) 0%, rgba(255,255,255,0.35) 100%)`,
                      }}
                    />
                    <span className="text-[10px] sm:text-xs text-white/75 uppercase tracking-wide">{t.label}</span>
                    <span className="text-sm font-bold tabular-nums">{t.val}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-white/85 mt-4 leading-relaxed">
              Distribution across GPA tiers from your current student records. Open{' '}
              <Link to="/users" className="underline font-medium text-white">
                Users
              </Link>{' '}
              to refine profiles and academic data.
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-lg font-bold text-[#1a1a1a] mb-4">Quick actions</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                to: '/groups',
                title: 'Form groups',
                sub: 'Create and organize project groups',
                icon: LayoutGrid,
                accent: TEAL,
              },
              {
                to: '/supervisor-assignment',
                title: 'Assign supervisors',
                sub: 'Balance workloads and allocations',
                icon: UserCheck,
                accent: '#5865C3',
              },
              {
                to: '/defense-scheduling',
                title: 'Schedule defenses',
                sub: 'Plan sessions and milestones',
                icon: Calendar,
                accent: '#b45309',
              },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="group bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md hover:border-slate-300/90 transition-all flex gap-4"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${a.accent}15` }}
                >
                  <a.icon className="w-5 h-5" style={{ color: a.accent }} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#1a1a1a] group-hover:opacity-90">{a.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{a.sub}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-[#006D6D] group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </Link>
            ))}
          </div>
        </div>

        {/* Activity-style panel (static samples — replace with API when available) */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 sm:p-6">
          <h2 className="text-lg font-bold text-[#1a1a1a] mb-4">Recent activity</h2>
          <ul className="space-y-3">
            <li className="flex gap-3 p-3 rounded-lg bg-emerald-50/80 border border-emerald-100/80">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">Dashboard data refreshed</p>
                <p className="text-xs text-slate-600 mt-0.5">Totals reflect the latest enrollment and group records.</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-2">System</p>
              </div>
            </li>
            <li className="flex gap-3 p-3 rounded-lg bg-sky-50/80 border border-sky-100/80">
              <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">Tip: review department scope</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Admins with a limited scope can adjust departments in Settings.
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-2">Administration</p>
              </div>
            </li>
            <li className="flex gap-3 p-3 rounded-lg bg-amber-50/80 border border-amber-100/80">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">Check supervisor assignment</p>
                <p className="text-xs text-slate-600 mt-0.5">Resolve students still awaiting a primary supervisor.</p>
                <Link
                  to="/supervisor-assignment"
                  className="inline-block mt-2 text-xs font-bold uppercase tracking-wide"
                  style={{ color: TEAL }}
                >
                  Open assignment →
                </Link>
              </div>
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-4 text-sm pb-2">
          <Link to="/users" className="inline-flex items-center gap-1 font-semibold" style={{ color: TEAL }}>
            <Users className="w-4 h-4" />
            Directory
          </Link>
          <Link to="/reports-analytics" className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-[#006D6D]">
            <ArrowRight className="w-4 h-4" />
            Analytics & exports
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
