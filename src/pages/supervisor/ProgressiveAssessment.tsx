import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../lib/api';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '../../components/UI/Button';

type Entry = {
  id: number;
  student_user_id: number;
  session_id: number;
  category: string;
  points: number | null;
  max_points: number | null;
  title: string | null;
  notes: string | null;
  recorded_at: string;
  meeting_id: number | null;
  first_name?: string;
  last_name?: string;
  email?: string;
};

export function ProgressiveAssessment() {
  const [sessions, setSessions] = useState<{ id: number; label: string }[]>([]);
  const [sessionId, setSessionId] = useState<number | ''>('');
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [sRes, eRes] = await Promise.all([
      apiClient.getSessions(),
      apiClient.getSupervisorAssessmentEntries(sessionId === '' ? undefined : Number(sessionId)),
    ]);
    if (sRes.success && Array.isArray(sRes.data)) {
      setSessions(sRes.data as { id: number; label: string }[]);
    }
    if (eRes.success && Array.isArray(eRes.data)) {
      setRows(eRes.data as Entry[]);
    } else {
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [sessionId]);

  const byStudent = useMemo(() => {
    const m = new Map<number, Entry[]>();
    for (const e of rows) {
      const uid = Number(e.student_user_id);
      if (!m.has(uid)) m.set(uid, []);
      m.get(uid)!.push(e);
    }
    for (const list of m.values()) {
      list.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
    }
    return [...m.entries()].sort((a, b) => {
      const na = `${a[1][0]?.last_name || ''} ${a[1][0]?.first_name || ''}`.trim();
      const nb = `${b[1][0]?.last_name || ''} ${b[1][0]?.first_name || ''}`.trim();
      return na.localeCompare(nb);
    });
  }, [rows]);

  return (
    <MainLayout title="Progressive assessment">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#1F7A8C]" />
            <div>
              <h1 className="text-xl font-bold text-[#022B3A]">Progressive assessment</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Attendance and supervisor scoring entries over time, per student (scoped by session).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Session</label>
            <select
              className="border rounded-lg px-2 py-1.5 text-sm min-w-[200px]"
              value={sessionId === '' ? '' : String(sessionId)}
              onChange={(e) => setSessionId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">All sessions</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <Button variant="outline" type="button" onClick={() => load()}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-600 text-sm">Loading…</p>
        ) : byStudent.length === 0 ? (
          <Card>
            <p className="text-slate-600 text-sm">No assessment entries yet. Meeting attendance appears here after you save attendance.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {byStudent.map(([uid, list]) => {
              const name =
                `${list[0]?.first_name || ''} ${list[0]?.last_name || ''}`.trim() || `Student #${uid}`;
              return (
                <Card key={uid}>
                  <h2 className="text-base font-semibold text-[#022B3A] mb-3">{name}</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-slate-500">
                          <th className="py-2 pr-2">When</th>
                          <th className="py-2 pr-2">Category</th>
                          <th className="py-2 pr-2">Score</th>
                          <th className="py-2 pr-2">Title</th>
                          <th className="py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((e) => (
                          <tr key={e.id} className="border-b border-slate-100">
                            <td className="py-2 pr-2 whitespace-nowrap text-slate-700">
                              {e.recorded_at ? new Date(e.recorded_at).toLocaleString() : '—'}
                            </td>
                            <td className="py-2 pr-2">{e.category}</td>
                            <td className="py-2 pr-2">
                              {e.points != null && e.max_points != null
                                ? `${e.points} / ${e.max_points}`
                                : e.points != null
                                  ? String(e.points)
                                  : '—'}
                            </td>
                            <td className="py-2 pr-2 max-w-[200px] truncate">{e.title || '—'}</td>
                            <td className="py-2 max-w-[240px] truncate text-slate-600">{e.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
