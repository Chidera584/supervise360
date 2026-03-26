import { useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Button } from '../../components/UI/Button';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, MessageSquare, FileText, Star, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { stripGroupName, stripProjectTitle, sortGroupsByNumber } from '../../utils/supervisorDisplay';

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

export function MyGroups() {
  const { user, supervisor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [groups, setGroups] = useState<SupervisorGroup[]>([]);
  const hasScrolledToGroup = useRef(false);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<'all' | 'pending'>('all');

  useEffect(() => {
    let alive = true;

    const fetchGroups = async () => {
      const res = await apiClient.getSupervisorMyGroups();
      if (!alive) return;
      if (res.success && res.data) {
        const raw = res.data as SupervisorGroup[];
        setGroups(sortGroupsByNumber(raw));
      }
      setLoading(false);
    };

    fetchGroups();
    const id = window.setInterval(fetchGroups, 30000);
    window.addEventListener('focus', fetchGroups);

    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener('focus', fetchGroups);
    };
  }, []);

  // Scroll to group when navigated from Dashboard with state.groupId
  useEffect(() => {
    const state = location.state as { groupId?: number } | null;
    if (state?.groupId && !loading && !hasScrolledToGroup.current) {
      const el = document.getElementById(`group-card-${state.groupId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        hasScrolledToGroup.current = true;
      }
    }
  }, [loading, location.state]);

  const activeGroupsCount = useMemo(
    () => groups.filter((g) => (g.reportsTotal ?? 0) > 0).length,
    [groups]
  );
  const pendingReportsCount = useMemo(
    () => groups.reduce((s, g) => s + (g.reportsPending ?? 0), 0),
    [groups]
  );
  const reviewedReportsCount = useMemo(
    () => groups.reduce((s, g) => s + (g.reportsReviewed ?? 0), 0),
    [groups]
  );

  const filteredGroups = useMemo(() => {
    if (filter === 'pending') return groups.filter((g) => (g.reportsPending ?? 0) > 0);
    return groups;
  }, [groups, filter]);

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Active', bg: 'rgba(16,185,129,0.12)', fg: '#059669' };
      case 'planning':
        return { label: 'Planning', bg: 'rgba(59,130,246,0.12)', fg: '#2563eb' };
      case 'completed':
        return { label: 'Completed', bg: 'rgba(148,163,184,0.25)', fg: '#475569' };
      default:
        return { label: status || 'Group', bg: 'rgba(148,163,184,0.25)', fg: '#475569' };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle size={16} className="text-emerald-600" />;
      case 'planning':
        return <Clock size={16} className="text-blue-600" />;
      case 'completed':
        return <Star size={16} className="text-slate-600" />;
      default:
        return <AlertCircle size={16} className="text-slate-600" />;
    }
  };

  if (loading) {
    return (
      <MainLayout title="My Groups">
        <div className="flex items-center justify-center h-64 text-slate-500">Loading groups…</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="My Groups">
      <div className="space-y-6 min-w-0">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">
              My Supervised Groups
            </h1>
            <p className="text-slate-500 mt-1">
              Manage academic group progress, review submissions, and provide feedback.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Assigned groups</p>
            <p className="text-2xl font-bold text-[#1a1a1a] mt-1">{groups.length}</p>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            icon={<Users className="w-5 h-5 text-[#006D6D]" />}
            title="Active groups"
            value={activeGroupsCount}
            accent={TEAL}
            bg="rgba(0,109,109,0.08)"
          />
          <MetricCard
            icon={<FileText className="w-5 h-5 text-amber-700" />}
            title="Reports pending review"
            value={pendingReportsCount}
            accent="#b45309"
            bg="rgba(180,83,9,0.10)"
          />
          <MetricCard
            icon={<CheckCircle className="w-5 h-5 text-emerald-700" />}
            title="Reports reviewed"
            value={reviewedReportsCount}
            accent="#059669"
            bg="rgba(5,150,105,0.10)"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <FilterPill active={filter === 'all'} label="All Groups" onClick={() => setFilter('all')} />
            <FilterPill
              active={filter === 'pending'}
              label="Pending Review"
              onClick={() => setFilter('pending')}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#006D6D]" />
              {filteredGroups.length} shown
            </span>
          </div>
        </div>

        {/* Groups list */}
        {groups.length === 0 ? (
          <div className="py-14 text-center">
            <Users className="mx-auto h-14 w-14 text-slate-300 mb-3" />
            <h3 className="text-xl font-semibold text-[#1a1a1a] mb-1">No groups assigned</h3>
            <p className="text-slate-600">Your administrator will assign groups when available.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((group) => {
              const chip = getStatusChip(group.status);
              return (
                <div
                  key={group.id}
                  id={`group-card-${group.id}`}
                  className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-[#1a1a1a]">{stripGroupName(group.name)}</h3>
                        <span
                          className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: chip.bg, color: chip.fg }}
                        >
                          {getStatusIcon(group.status)}
                          {chip.label}
                        </span>
                        {group.project?.progress_percentage != null && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ backgroundColor: 'rgba(0,109,109,0.10)', color: TEAL }}
                          >
                            {(() => {
                              const apiPctRaw = group.project?.progress_percentage ?? 0;
                              const apiPct = apiPctRaw <= 1 ? apiPctRaw * 100 : apiPctRaw;
                              const derivedPct = group.reportsTotal ? Math.min(100, Math.round((group.reportsTotal / 4) * 100)) : 0;
                              const pctToShow = apiPctRaw && apiPct > 0 ? apiPct : derivedPct;
                              return `${pctToShow.toFixed(2)}%`;
                            })()} progress
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-600 mt-1 line-clamp-1">
                        {group.project ? stripProjectTitle(group.project.title, group.name) : 'No project yet'}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        <div className="flex items-center">
                          {group.members.slice(0, 4).map((m, idx) => (
                            <div
                              key={m.id ?? idx}
                              className="w-8 h-8 rounded-full bg-[#1F7A8C] text-white flex items-center justify-center text-xs font-bold border-2 border-white -ml-1 first:ml-0"
                              title={m.name}
                            >
                              {initials(m.name)}
                            </div>
                          ))}
                          {group.members.length > 4 && (
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 -ml-1">
                              +{group.members.length - 4}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {group.members.length} members
                        </div>
                        <div className="text-xs text-slate-500">
                          {group.reportsPending} pending · {group.reportsReviewed} reviewed
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        variant="primary"
                        className="!rounded-[10px] !px-3 !py-2 !bg-[#006D6D] !text-white hover:!bg-[#005a5a] border-0"
                        onClick={() => navigate('/messages', { state: { groupId: group.id, groupName: group.name } })}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Message
                      </Button>
                      <Button
                        variant="outline"
                        className="!rounded-[10px] !px-3 !py-2 !border-slate-200"
                        onClick={() => navigate('/report-reviews', { state: { groupId: group.id } })}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Reports {group.reportsPending > 0 ? `(${group.reportsPending})` : ''}
                      </Button>
                      <Button
                        variant="outline"
                        className="!rounded-[10px] !px-3 !py-2 !border-slate-200"
                        onClick={() => navigate('/evaluations', { state: { groupId: group.id, groupName: group.name } })}
                      >
                        <Star className="w-4 h-4 mr-2" />
                        Grade Work
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function MetricCard({
  icon,
  title,
  value,
  accent,
  bg,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  accent: string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg, color: accent }}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-[#1a1a1a] mt-1 tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
}

function FilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        active ? 'text-white border-transparent' : 'text-slate-600 bg-white border-slate-200 hover:border-slate-300'
      }`}
      style={active ? { backgroundColor: TEAL } : undefined}
    >
      {label}
    </button>
  );
}

