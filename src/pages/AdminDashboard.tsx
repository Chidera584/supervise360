import { useEffect, useState } from 'react';
import { MainLayout } from '../components/Layout/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { Users, UserCheck, Building, FileText, ArrowRight, Building2, Calendar, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AdminDashboard() {
  const { user } = useAuth();
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
  const gpaDistribution = dashboard?.gpaDistribution || { HIGH: 0, MEDIUM: 0, LOW: 0 };

  const maxDeptStudents = Math.max(1, ...deptStats.map((d: any) => Number(d.studentCount) || 0));

  return (
    <MainLayout title="Admin overview">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-700">Dashboard</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">
              Welcome back{user?.first_name ? `, ${user.first_name}` : ''}
            </h2>
            <p className="text-slate-600 mt-1 text-sm max-w-xl">
              Monitor enrollment, supervision load, and department activity at a glance.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-900/5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 ring-1 ring-brand-100">
                <Users className="text-brand-700" size={22} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Active students</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">{loading ? '—' : displayStudents}</p>
                <Link
                  to="/users"
                  className="inline-flex items-center gap-1 text-xs text-brand-700 font-medium mt-2 hover:text-brand-800"
                >
                  View users <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-900/5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center shrink-0 ring-1 ring-sky-100">
                <UserCheck className="text-sky-700" size={22} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Supervisors</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">
                  {loading ? '—' : supervisorCount ?? totals.supervisors ?? 0}
                </p>
                <Link
                  to="/supervisor-assignment"
                  className="inline-flex items-center gap-1 text-xs text-brand-700 font-medium mt-2 hover:text-brand-800"
                >
                  Assign workload <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-900/5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 ring-1 ring-amber-100">
                <Building className="text-amber-800" size={22} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Project groups</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">{loading ? '—' : displayGroups}</p>
                <Link
                  to="/groups"
                  className="inline-flex items-center gap-1 text-xs text-brand-700 font-medium mt-2 hover:text-brand-800"
                >
                  View groups <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {deptStats.length > 0 && (
            <div className="xl:col-span-2 rounded-xl border border-slate-200/90 bg-white p-6 shadow-sm shadow-slate-900/5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="font-semibold text-slate-900">Departmental distribution</p>
                  <p className="text-sm text-slate-500 mt-0.5">Students by department</p>
                </div>
                <Link to="/departments" className="text-sm text-brand-700 font-medium hover:text-brand-800 flex items-center gap-1 shrink-0">
                  Manage <ArrowRight size={14} />
                </Link>
              </div>
              <div className="space-y-4">
                {deptStats.map((d: any) => {
                  const n = Number(d.studentCount) || 0;
                  const pct = Math.round((n / maxDeptStudents) * 100);
                  return (
                    <div key={d.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-slate-800 truncate pr-2">{d.name}</span>
                        <span className="text-slate-500 tabular-nums shrink-0">{n}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border-0 bg-gradient-to-b from-brand-800 to-brand-900 p-6 text-white shadow-lg shadow-brand-900/20">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-200/90">Performance</p>
            <p className="text-lg font-semibold mt-2">GPA distribution</p>
            <p className="text-sm text-brand-100/90 mt-1 mb-5">Tallies by tier across the institution</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-brand-100 text-sm">High tier</span>
                <span className="text-xl font-bold tabular-nums">{gpaDistribution.HIGH || 0}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-brand-100 text-sm">Medium tier</span>
                <span className="text-xl font-bold tabular-nums">{gpaDistribution.MEDIUM || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-brand-100 text-sm">Low tier</span>
                <span className="text-xl font-bold tabular-nums">{gpaDistribution.LOW || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900 mb-3">Quick actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[
              { to: '/departments', label: 'Departments', sub: 'Structure & codes', icon: Building2 },
              { to: '/users', label: 'Users', sub: 'Students & staff', icon: Users },
              { to: '/groups', label: 'Groups', sub: 'Project groups', icon: Building },
              { to: '/supervisor-assignment', label: 'Supervisors', sub: 'Assignments', icon: UserCheck },
              { to: '/defense-scheduling', label: 'Defense scheduling', sub: 'Sessions', icon: Calendar },
              { to: '/reports-analytics', label: 'Reports & analytics', sub: 'Insights', icon: BarChart2 },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group flex items-center gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-900/5 hover:border-brand-200 hover:shadow-md transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-slate-50 group-hover:bg-brand-50 flex items-center justify-center text-slate-600 group-hover:text-brand-700 transition-colors ring-1 ring-slate-100 group-hover:ring-brand-100">
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 group-hover:text-brand-800 transition-colors">{action.label}</p>
                    <p className="text-xs text-slate-500">{action.sub}</p>
                  </div>
                  <ArrowRight
                    size={18}
                    className="text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all shrink-0"
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
