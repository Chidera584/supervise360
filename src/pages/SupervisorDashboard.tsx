import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../components/Layout/MainLayout';
import { Button } from '../components/UI/Button';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { Users, FileText, MessageSquare, CheckCircle, Eye, MessageCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { stripGroupName, stripProjectTitle, sortGroupsByNumber } from '../utils/supervisorDisplay';

interface SupervisorGroup {
  id: number;
  name: string;
  department?: string;
  status: string;
  avg_gpa?: number;
  supervisor?: string;
  members: { id: number; name: string; gpa?: number; matricNumber?: string }[];
  project: {
    id: number;
    title: string;
    status?: string;
    progress_percentage?: number;
    submitted_at?: string;
  } | null;
  reportsTotal: number;
  reportsReviewed: number;
  reportsPending: number;
}

const TEAL = '#006D6D';

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function SupervisorDashboard() {
  const { user, supervisor } = useAuth();
  const navigate = useNavigate();

  const [supervisorGroups, setSupervisorGroups] = useState<SupervisorGroup[]>([]);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [reportsReviewedCount, setReportsReviewedCount] = useState(0);
  const [inboxCount, setInboxCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [myGroupsRes, inboxRes] = await Promise.all([
          apiClient.getSupervisorMyGroups(),
          apiClient.getInbox(),
        ]);

        if (myGroupsRes.success && Array.isArray(myGroupsRes.data)) {
          const groups = sortGroupsByNumber(myGroupsRes.data as SupervisorGroup[]);
          setSupervisorGroups(groups);
          setPendingReviewsCount(groups.reduce((s, g) => s + (g.reportsPending ?? 0), 0));
          setReportsReviewedCount(groups.reduce((s, g) => s + (g.reportsReviewed ?? 0), 0));
        } else if (!myGroupsRes.success) {
          const pendingRes = await apiClient
            .getPendingReportReviews()
            .catch(() => ({ success: false, data: [] }));
          if (pendingRes.success && Array.isArray(pendingRes.data)) {
            setPendingReviewsCount((pendingRes.data as any[]).length);
          }
        }

        if (inboxRes.success && Array.isArray(inboxRes.data)) {
          setInboxCount((inboxRes.data as any[]).length);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const activeGroups = useMemo(
    () => supervisorGroups.filter((g) => (g.reportsTotal ?? 0) > 0).length,
    [supervisorGroups]
  );

  const assignedGroups = supervisorGroups.length;

  if (loading) {
    return (
      <MainLayout title="Supervisor Dashboard">
        <div className="flex items-center justify-center py-24 text-slate-500">Loading…</div>
      </MainLayout>
    );
  }

  const departmentText = supervisor?.department || user?.department || 'Software Engineering';

  return (
    <MainLayout title="Supervisor Dashboard">
      <div className="space-y-6 min-w-0">
        {/* Hero */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">
              Welcome, {user?.first_name}
            </h1>
            <p className="text-slate-500 mt-1 text-sm sm:text-base">
              Department of {departmentText} · Managing {activeGroups} Active Groups
            </p>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            value={assignedGroups}
            label="Assigned Groups"
            icon={<Users className="w-5 h-5" />}
            accent="#1a4d3e"
            accentBg="rgba(26,77,62,0.06)"
          />
          <MetricCard
            value={pendingReviewsCount}
            label="Pending Reviews"
            icon={<FileText className="w-5 h-5" />}
            accent="#1F7A8C"
            accentBg="rgba(31,122,140,0.06)"
          />
          <MetricCard
            value={inboxCount}
            label="New Messages"
            icon={<MessageSquare className="w-5 h-5" />}
            accent="#7c3aed"
            accentBg="rgba(124,58,237,0.06)"
          />
          <MetricCard
            value={reportsReviewedCount}
            label="Reports Reviewed"
            icon={<CheckCircle className="w-5 h-5" />}
            accent="#006D6D"
            accentBg="rgba(0,109,109,0.06)"
          />
        </div>

        {/* My assigned groups */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h2 className="text-lg font-bold text-[#1a1a1a]">My Assigned Groups</h2>
              <p className="text-sm text-slate-500 mt-1">Review submissions, manage feedback, and grade work.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/my-groups" className="font-semibold hover:underline" style={{ color: TEAL }}>
                View All Groups
              </Link>
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-[#006D6D]/10 flex items-center justify-center text-[#006D6D]">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                  <Users className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {supervisorGroups.length === 0 ? (
            <div className="text-center py-10">
              <Users className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No supervised groups</h3>
              <p className="text-slate-600">Your administrator will assign groups when available.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {supervisorGroups.map((group) => {
                const statusChip =
                  group.status === 'active'
                    ? { bg: 'rgba(16,185,129,0.12)', fg: '#059669', text: 'Active' }
                    : { bg: 'rgba(245,158,11,0.14)', fg: '#b45309', text: 'Formed' };

                return (
                  <div
                    key={group.id}
                    id={`group-card-${group.id}`}
                    className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-[#1a1a1a]">{stripGroupName(group.name)}</h3>
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: statusChip.bg, color: statusChip.fg }}
                          >
                            {statusChip.text}
                          </span>
                          {(() => {
                            const submittedCount = group.reportsTotal ?? 0;
                            const derivedPct = submittedCount ? Math.min(100, (submittedCount / 4) * 100) : 0;
                            if (derivedPct <= 0) return null;
                            return (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                style={{ backgroundColor: '#1F7A8C20', color: '#1F7A8C' }}
                              >
                                {derivedPct.toFixed(2)}% progress
                              </span>
                            );
                          })()}
                        </div>

                        <p className="text-sm text-slate-600 mt-1 line-clamp-1">
                          {group.project ? stripProjectTitle(group.project.title, group.name) : 'No project yet'}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <div className="flex items-center">
                            {group.members.slice(0, 4).map((m, idx) => (
                              <div
                                key={m.id ?? idx}
                                className="w-9 h-9 rounded-full bg-[#1F7A8C] text-white flex items-center justify-center text-xs font-bold border-2 border-white -ml-1 first:ml-0"
                                title={m.name}
                              >
                                {initials(m.name)}
                              </div>
                            ))}
                            {group.members.length > 4 && (
                              <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 -ml-1">
                                +{group.members.length - 4}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{group.members.length} members</div>
                          <div className="text-xs text-slate-500">
                            {group.reportsPending} pending · {group.reportsReviewed} reviewed
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 shrink-0 mt-2 md:mt-0">
                        <Link to="/my-groups" state={{ groupId: group.id, groupName: group.name }}>
                          <Button variant="outline" className="!rounded-[10px] !px-3 !py-2 !text-sm">
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                        </Link>
                        <Button
                          className="!rounded-[10px] !px-3 !py-2 !text-sm !bg-[#000080] !text-white hover:!bg-[#00006b] border-0"
                          onClick={() => navigate('/messages', { state: { groupId: group.id, groupName: group.name } })}
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Message
                        </Button>
                        <Button
                          variant="outline"
                          className="!rounded-[10px] !px-3 !py-2 !text-sm"
                          onClick={() => navigate('/report-reviews', { state: { groupId: group.id } })}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Reports {group.reportsPending > 0 ? `(${group.reportsPending})` : ''}
                        </Button>
                        <Button
                          variant="outline"
                          className="!rounded-[10px] !px-3 !py-2 !text-sm"
                          onClick={() => navigate('/evaluations', { state: { groupId: group.id, groupName: group.name } })}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Grade
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

function MetricCard({
  value,
  label,
  icon,
  accent,
  accentBg,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  accent: string;
  accentBg: string;
}) {
  return (
    <div
      className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex gap-4"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: accentBg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-[#1a1a1a] tabular-nums mt-0.5">{value}</p>
      </div>
    </div>
  );
}

