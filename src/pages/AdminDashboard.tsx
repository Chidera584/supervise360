import { useEffect, useState } from 'react';
import { MainLayout } from '../components/Layout/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { Users, UserCheck, Building, FileText, ArrowRight, Building2 } from 'lucide-react';
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
      // Use dashboard totals (group_members, project_groups, supervisor_workload) - across ALL departments
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

  return (
    <MainLayout title="Admin Dashboard">
      <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 min-w-0">
        {/* Hero Section - Full-width blue header */}
        <div className="relative bg-[#022B3A] px-4 sm:px-6 pt-6 sm:pt-8 pb-20 sm:pb-24 text-white">
          <h1 className="text-2xl md:text-3xl font-bold">
            Welcome, {user?.first_name}
          </h1>
          <p className="text-[#BFDBF7] mt-1">
            Here's what's in your system
          </p>
        </div>

        {/* Floating Cards - Overlap hero */}
        <div className="relative -mt-12 sm:-mt-16 px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100/80 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1F7A8C]/10 flex items-center justify-center shrink-0">
                  <Users className="text-[#1F7A8C]" size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Total Students</p>
                  <p className="text-2xl font-bold text-[#022B3A] mt-0.5 tabular-nums">
                    {loading ? '—' : displayStudents}
                  </p>
                  <Link to="/users" className="inline-flex items-center gap-1 text-xs text-[#1F7A8C] font-medium mt-1 hover:underline">
                    View users <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100/80 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1F7A8C]/10 flex items-center justify-center shrink-0">
                  <UserCheck className="text-[#1F7A8C]" size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Supervisors</p>
                  <p className="text-2xl font-bold text-[#022B3A] mt-0.5 tabular-nums">
                    {loading ? '—' : supervisorCount ?? totals.supervisors ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100/80 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1F7A8C]/10 flex items-center justify-center shrink-0">
                  <Building className="text-[#1F7A8C]" size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Groups</p>
                  <p className="text-2xl font-bold text-[#022B3A] mt-0.5 tabular-nums">
                    {loading ? '—' : displayGroups}
                  </p>
                  <Link to="/groups" className="inline-flex items-center gap-1 text-xs text-[#1F7A8C] font-medium mt-1 hover:underline">
                    View groups <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Main Content */}
        <div className="mt-6 px-4 sm:px-6 pb-8 bg-gradient-to-b from-slate-50 to-white min-h-[50vh]">
          <div className="w-full space-y-6">
            {/* Department breakdown - individual totals per department */}
            {deptStats.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-semibold text-slate-800">Department Breakdown</p>
                  <Link to="/departments" className="text-sm text-[#1F7A8C] font-medium hover:underline flex items-center gap-1">
                    View all <ArrowRight size={14} />
                  </Link>
                </div>
                <p className="text-sm text-slate-500 mb-4">Students, supervisors, and groups per department</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {deptStats.map((d: any) => (
                    <Link
                      key={d.id}
                      to={`/departments`}
                      className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:border-[#BFDBF7] hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#1F7A8C]/10 flex items-center justify-center shrink-0">
                        <Building2 className="text-[#1F7A8C]" size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800 truncate text-sm">{d.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {d.studentCount} students · {d.supervisorCount} supervisors · {d.groupCount ?? 0} groups
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { to: '/departments', label: 'Departments', sub: 'Manage by department', icon: Building2 },
                { to: '/users', label: 'Users', sub: 'Manage students & staff', icon: Users },
                { to: '/groups', label: 'Groups', sub: 'View and form groups', icon: Building },
                { to: '/supervisor-assignment', label: 'Supervisors', sub: 'Assign & sync workload', icon: UserCheck },
                { to: '/reports-analytics', label: 'Reports', sub: 'Analytics & exports', icon: FileText },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="group flex items-center gap-4 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-[#BFDBF7] hover:shadow-md transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-[#E1E5F2] flex items-center justify-center text-slate-600 group-hover:text-[#022B3A] transition-colors">
                      <Icon size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 group-hover:text-[#022B3A] transition-colors">
                        {action.label}
                      </p>
                      <p className="text-sm text-slate-500">{action.sub}</p>
                    </div>
                    <ArrowRight size={18} className="text-slate-300 group-hover:text-[#022B3A] group-hover:translate-x-1 transition-all shrink-0" />
                  </Link>
                );
              })}
            </div>

            {/* GPA Distribution */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <p className="font-semibold text-slate-800 mb-4">GPA Distribution</p>
              <div className="flex flex-wrap gap-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-600">
                    {gpaDistribution.HIGH || 0}
                  </span>
                  <span className="text-slate-500 text-sm">High tier</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-amber-600">
                    {gpaDistribution.MEDIUM || 0}
                  </span>
                  <span className="text-slate-500 text-sm">Medium tier</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-rose-600">
                    {gpaDistribution.LOW || 0}
                  </span>
                  <span className="text-slate-500 text-sm">Low tier</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
