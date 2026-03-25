import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../lib/api';
import { FolderKanban, FileCheck, FileText, UserCheck } from 'lucide-react';

export function ReportsAnalytics() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const response = await apiClient.getAdminStats();
      if (response.success) {
        setStats(response.data);
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  const perf = stats?.systemPerformance || {};
  const reviewed = perf.reviewedReports ?? 0;
  const totalReports = perf.totalReports ?? 0;
  const reviewPct = totalReports > 0 ? Math.round((reviewed / totalReports) * 100) : 0;

  const workload = stats?.supervisorWorkload || [];
  const maxLoad = Math.max(1, ...workload.map((s: any) => Number(s.current_groups) || 0));

  return (
    <MainLayout title="Reports & analytics">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-700">System health</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">Reports & analytics</h2>
          <p className="text-slate-600 mt-1 text-sm max-w-2xl">
            High-level throughput across groups, submissions, and supervisor review activity.
          </p>
        </div>

        {loading ? (
          <Card className="py-16 text-center text-slate-500 text-sm">Loading analytics…</Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: 'Total groups',
                  value: perf.totalGroups ?? 0,
                  icon: FolderKanban,
                  tint: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
                },
                {
                  label: 'Projects submitted',
                  value: perf.projectsSubmitted ?? 0,
                  icon: FileCheck,
                  tint: 'bg-sky-50 text-sky-700 ring-sky-100',
                },
                {
                  label: 'Reports submitted',
                  value: totalReports,
                  icon: FileText,
                  tint: 'bg-brand-50 text-brand-700 ring-brand-100',
                },
                {
                  label: 'Reports reviewed',
                  value: reviewed,
                  sub: totalReports ? `${reviewPct}% of submissions` : undefined,
                  icon: UserCheck,
                  tint: 'bg-violet-50 text-violet-700 ring-violet-100',
                },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <Card key={m.label} className="p-5 border-slate-200/90">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ${m.tint}`}>
                        <Icon size={20} strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{m.label}</p>
                        <p className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">{m.value}</p>
                        {m.sub && <p className="text-xs text-slate-500 mt-1">{m.sub}</p>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-slate-200/90">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Supervisor workload</h3>
                <p className="text-sm text-slate-500 mb-5">Current groups vs. capacity</p>
                <div className="space-y-4">
                  {workload.map((sup: any, index: number) => {
                    const cur = Number(sup.current_groups) || 0;
                    const max = Number(sup.max_groups) || 1;
                    const pct = Math.min(100, Math.round((cur / max) * 100));
                    const barWidth = maxLoad > 0 ? Math.round((cur / maxLoad) * 100) : 0;
                    return (
                      <div key={index}>
                        <div className="flex justify-between text-sm mb-1 gap-2">
                          <span className="font-medium text-slate-800 truncate">{sup.supervisor_name}</span>
                          <span className="text-slate-500 tabular-nums shrink-0">
                            {cur}/{max}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-1">{sup.department}</p>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 90 ? 'bg-amber-500' : 'bg-gradient-to-r from-brand-500 to-brand-600'
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {workload.length === 0 && (
                    <p className="text-slate-500 text-sm">No supervisor workload data available.</p>
                  )}
                </div>
              </Card>

              <Card className="border-slate-200/90">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Grouping quality</h3>
                <p className="text-sm text-slate-500 mb-5">Composition of formed groups</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200/80 p-4 bg-slate-50/80">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ideal groups</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                      {stats?.groupingQuality?.idealGroups || 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 p-4 bg-slate-50/80">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fallback groups</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                      {stats?.groupingQuality?.fallbackGroups || 0}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                  Use this snapshot with department dashboards when tuning allocation rules or supervisor limits.
                </p>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
