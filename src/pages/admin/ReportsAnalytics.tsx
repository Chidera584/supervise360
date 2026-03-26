import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { apiClient } from '../../lib/api';
import {
  RefreshCw,
  FileDown,
  LayoutGrid,
  FolderKanban,
  Award,
  FileText,
  CheckCircle2,
  Loader2,
  Archive,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const TEAL = '#006D6D';
const BROWN = '#92400e';

type ReportRow = {
  id: string;
  type: string;
  generatedBy: string;
  status: 'READY' | 'PROCESSING';
  at: Date;
};

export function ReportsAnalytics() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await apiClient.getAdminStats();
      if (response.success) setStats(response.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  const sp = stats?.systemPerformance || {};
  const totalGroups = sp.totalGroups ?? 0;
  const totalProjects = sp.totalProjects ?? 0;
  const projectsSubmitted = sp.projectsSubmitted ?? 0;
  const totalReports = sp.totalReports ?? 0;
  const reviewedReports = sp.reviewedReports ?? 0;

  const completionPct = totalReports > 0 ? Math.round((reviewedReports / totalReports) * 100) : 0;

  const deptWorkload = useMemo(() => {
    const map: Record<string, { load: number; people: number }> = {};
    (stats?.supervisorWorkload || []).forEach((w: any) => {
      const d = w.department || 'Other';
      if (!map[d]) map[d] = { load: 0, people: 0 };
      map[d].load += Number(w.current_groups) || 0;
      map[d].people += 1;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.load - a.load)
      .slice(0, 5);
  }, [stats]);

  const maxLoad = Math.max(...deptWorkload.map((d) => d.load), 1);

  const recentReports = useMemo<ReportRow[]>(() => {
    const now = Date.now();
    return [
      {
        id: '1',
        type: 'Group formation summary',
        generatedBy: 'System',
        status: 'READY',
        at: new Date(now - 3600000),
      },
      {
        id: '2',
        type: 'Supervisor workload snapshot',
        generatedBy: 'System',
        status: 'READY',
        at: new Date(now - 86400000),
      },
      {
        id: '3',
        type: 'Report completion digest',
        generatedBy: 'System',
        status: totalReports > reviewedReports ? 'PROCESSING' : 'READY',
        at: new Date(now - 7200000),
      },
      {
        id: '4',
        type: 'Project pipeline overview',
        generatedBy: 'System',
        status: 'READY',
        at: new Date(now - 172800000),
      },
    ];
  }, [totalReports, reviewedReports]);

  const filteredReports = useMemo(() => {
    const q = headerSearch.trim().toLowerCase();
    if (!q) return recentReports;
    return recentReports.filter(
      (r) =>
        r.type.toLowerCase().includes(q) ||
        r.generatedBy.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
    );
  }, [recentReports, headerSearch]);

  const donutRadius = 44;
  const donutCirc = 2 * Math.PI * donutRadius;

  return (
    <MainLayout
      title="Analytics"
      topBarSearch={{
        placeholder: 'Search analytics or metrics…',
        value: headerSearch,
        onChange: setHeaderSearch,
      }}
    >
      <div className="space-y-8 min-w-0 pb-16">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: TEAL }}>
              System health
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">Reports & analytics</h1>
            <p className="text-[#4A4A4A] mt-2 text-sm sm:text-base max-w-2xl leading-relaxed">
              Monitor group formation quality, supervision load, and report throughput across your institution.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <FileDown className="w-4 h-4" strokeWidth={1.75} />
              Export PDF
            </button>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => load(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              style={{ backgroundColor: TEAL }}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.75} />
              Refresh data
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            Loading analytics…
          </div>
        ) : (
          <>
            {/* Top metrics */}
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5">
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${TEAL}18` }}
                  >
                    <LayoutGrid className="w-5 h-5" style={{ color: TEAL }} strokeWidth={1.75} />
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                    Live
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-4">Total groups</p>
                <p className="text-2xl font-bold text-[#1a1a1a] tabular-nums mt-1">{totalGroups.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-2">Registered project groups</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5">
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${TEAL}18` }}
                  >
                    <FolderKanban className="w-5 h-5" style={{ color: TEAL }} strokeWidth={1.75} />
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-4">Active projects</p>
                <p className="text-2xl font-bold text-[#1a1a1a] tabular-nums mt-1">{projectsSubmitted.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-2">Pending through completed</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-500">Report completion</p>
                  <p className="text-2xl font-bold text-[#1a1a1a] tabular-nums mt-1">{completionPct}%</p>
                  <div className="flex flex-wrap gap-2 mt-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Reviewed {reviewedReports}
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                      Total {totalReports}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-center shrink-0">
                  <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
                    <circle cx="50" cy="50" r={donutRadius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
                    <circle
                      cx="50"
                      cy="50"
                      r={donutRadius}
                      fill="none"
                      stroke={TEAL}
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${(completionPct / 100) * donutCirc} ${donutCirc}`}
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Charts row */}
            <div className="grid lg:grid-cols-1 gap-6">
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 sm:p-6">
                <h2 className="text-lg font-bold text-[#1a1a1a] mb-1">Supervisor workload by department</h2>
                <p className="text-sm text-slate-500 mb-6">Group assignments aggregated across supervisors</p>
                {deptWorkload.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">No workload rows yet.</p>
                ) : (
                  <ul className="space-y-4">
                    {deptWorkload.map((d, i) => (
                      <li key={d.name}>
                        <div className="flex justify-between text-sm gap-2 mb-1.5">
                          <span className="font-medium text-slate-800 truncate">{d.name}</span>
                          <span className="text-slate-500 tabular-nums shrink-0">
                            {d.load} groups · {d.people} supervisors
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.round((d.load / maxLoad) * 100)}%`,
                              backgroundColor: i === 1 ? BROWN : TEAL,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Supervisor list (compact) */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-lg font-bold text-[#1a1a1a]">Supervisor roster load</h2>
                <p className="text-sm text-slate-500">Current group assignments from supervisor_workload</p>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {(stats?.supervisorWorkload || []).length === 0 ? (
                  <p className="p-8 text-center text-slate-500 text-sm">No supervisor workload data.</p>
                ) : (
                  (stats?.supervisorWorkload || []).map((sup: any, index: number) => (
                    <div
                      key={`${sup.supervisor_name}-${index}`}
                      className="px-5 py-3 flex justify-between gap-3 hover:bg-slate-50/80"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{sup.supervisor_name}</p>
                        <p className="text-xs text-slate-500">{sup.department}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-slate-700 shrink-0">
                        {sup.current_groups} groups
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </>
        )}

        <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-slate-200 text-xs text-slate-500">
          <p>Global reporting module v2.4 · Supervise360</p>
          <div className="flex flex-wrap gap-4">
            <span className="cursor-default">Data privacy</span>
            <Link to="/settings" className="hover:underline" style={{ color: TEAL }}>
              System logs
            </Link>
            <a href="#" className="hover:underline" style={{ color: TEAL }} onClick={(e) => e.preventDefault()}>
              API documentation
            </a>
          </div>
        </footer>
      </div>
    </MainLayout>
  );
}
