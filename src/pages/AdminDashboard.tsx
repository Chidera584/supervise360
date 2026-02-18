import { useEffect, useState } from 'react';
import { MainLayout } from '../components/Layout/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { Users, UserCheck, Building, FileText, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AdminDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [studentCount, setStudentCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      const [dashRes, groupsRes] = await Promise.all([
        apiClient.getAdminDashboard(),
        apiClient.getGroups()
      ]);
      if (dashRes.success) setDashboard(dashRes.data);
      if (groupsRes.success && Array.isArray(groupsRes.data)) {
        const total = (groupsRes.data as any[]).reduce(
          (sum, g) => sum + (Array.isArray(g.members) ? g.members.length : 0),
          0
        );
        setStudentCount(total);
      } else {
        setStudentCount(dashRes.data?.totals?.students ?? null);
      }
      setLoading(false);
    };
    fetchDashboard();
  }, []);

  const totals = dashboard?.totals || {};
  const displayStudents = studentCount ?? totals.students ?? 0;
  const gpaDistribution = dashboard?.gpaDistribution || { HIGH: 0, MEDIUM: 0, LOW: 0 };

  const actions = [
    { to: '/users', label: 'Users', sub: 'Manage students & staff', icon: Users },
    { to: '/groups', label: 'Groups', sub: 'View and form groups', icon: Building },
    { to: '/supervisor-assignment', label: 'Supervisors', sub: 'Assign & sync workload', icon: UserCheck },
    { to: '/reports-analytics', label: 'Reports', sub: 'Analytics & exports', icon: FileText },
  ];

  return (
    <MainLayout title="Admin Dashboard">
      <div className="-m-6 p-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-800">
            {user?.first_name}, welcome back
          </h1>
          <p className="text-slate-500 mt-1">Here’s what’s in your system</p>

          {/* Featured stat + smaller stats */}
          <div className="mt-8 flex flex-col lg:flex-row gap-4">
            <div className="flex-1 bg-[#1a237e] rounded-2xl p-8 text-white shadow-lg shadow-indigo-900/20">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-indigo-200 text-sm font-medium">Total students</p>
                  <p className="text-5xl font-bold mt-2 tabular-nums">
                    {loading ? '—' : displayStudents}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
                  <Users size={28} />
                </div>
              </div>
              <Link
                to="/users"
                className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-indigo-200 hover:text-white transition-colors"
              >
                View users
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 flex-1">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                <p className="text-2xl font-bold text-slate-800 tabular-nums">
                  {loading ? '—' : totals.supervisors || 0}
                </p>
                <p className="text-sm text-slate-500 mt-1">Supervisors</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                <p className="text-2xl font-bold text-slate-800 tabular-nums">
                  {loading ? '—' : totals.groups || 0}
                </p>
                <p className="text-sm text-slate-500 mt-1">Groups</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                <p className="text-2xl font-bold text-slate-800 tabular-nums">
                  {loading ? '—' : totals.projects || 0}
                </p>
                <p className="text-sm text-slate-500 mt-1">Projects</p>
              </div>
            </div>
          </div>

          {/* Action cards */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group flex items-center gap-4 bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all"
                >
                  <div className="w-12 h-12 rounded-lg bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center text-slate-600 group-hover:text-[#1a237e] transition-colors">
                    <Icon size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 group-hover:text-[#1a237e] transition-colors">
                      {action.label}
                    </p>
                    <p className="text-sm text-slate-500">{action.sub}</p>
                  </div>
                  <ArrowRight size={18} className="text-slate-300 group-hover:text-[#1a237e] group-hover:translate-x-1 transition-all" />
                </Link>
              );
            })}
          </div>

          {/* GPA */}
          <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <p className="font-semibold text-slate-800 mb-4">GPA distribution</p>
            <div className="flex gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600">
                  {gpaDistribution.HIGH || 0}
                </span>
                <span className="text-slate-500 text-sm">High</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-600">
                  {gpaDistribution.MEDIUM || 0}
                </span>
                <span className="text-slate-500 text-sm">Medium</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-rose-600">
                  {gpaDistribution.LOW || 0}
                </span>
                <span className="text-slate-500 text-sm">Low</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
