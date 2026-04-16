import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../lib/api';
import { BarChart3, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
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

type StudentSummary = {
  uid: number;
  name: string;
  attendanceTotal: number;
  attendancePresent: number;
  attendanceAbsent: number;
  attendanceRate: number;
  totalEntries: number;
  entries: Entry[];
};

export function ProgressiveAssessment() {
  const [sessions, setSessions] = useState<{ id: number; label: string }[]>([]);
  const [sessionId, setSessionId] = useState<number | ''>('');
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);

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

  const summaries = useMemo<StudentSummary[]>(() => {
    return byStudent.map(([uid, list]) => {
      const name = `${list[0]?.first_name || ''} ${list[0]?.last_name || ''}`.trim() || `Student #${uid}`;
      const attendanceRows = list.filter((e) => e.category === 'meeting_attendance');
      const attendanceTotal = attendanceRows.length;
      const attendancePresent = attendanceRows.filter((e) => Number(e.points) >= 1).length;
      const attendanceAbsent = attendanceTotal - attendancePresent;
      const attendanceRate =
        attendanceTotal > 0 ? Math.round((attendancePresent / Math.max(attendanceTotal, 1)) * 100) : 0;

      return {
        uid,
        name,
        attendanceTotal,
        attendancePresent,
        attendanceAbsent,
        attendanceRate,
        totalEntries: list.length,
        entries: list,
      };
    });
  }, [byStudent]);

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
        ) : summaries.length === 0 ? (
          <Card>
            <p className="text-slate-600 text-sm">No assessment entries yet. Meeting attendance appears here after you save attendance.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {summaries.map((s) => {
              return (
                <Card key={s.uid}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpandedStudentId((current) => (current === s.uid ? null : s.uid))}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-slate-500">
                          {expandedStudentId === s.uid ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-[#022B3A]">{s.name}</h2>
                          <p className="text-xs text-slate-500 mt-1">
                            {s.totalEntries} record{s.totalEntries === 1 ? '' : 's'} available. Click to
                            {expandedStudentId === s.uid ? ' hide' : ' view'} details.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                          Meetings: {s.attendanceTotal}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                          Present: {s.attendancePresent}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700">
                          Absent: {s.attendanceAbsent}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                          Attendance: {s.attendanceRate}%
                        </span>
                      </div>
                    </div>
                  </button>
                  {expandedStudentId === s.uid && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
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
                            {s.entries.map((e) => (
                              <tr key={e.id} className="border-b border-slate-100 align-top">
                                <td className="py-2 pr-2 whitespace-nowrap text-slate-700">
                                  {e.recorded_at ? new Date(e.recorded_at).toLocaleString() : '—'}
                                </td>
                                <td className="py-2 pr-2">
                                  {e.category === 'meeting_attendance' ? 'attendance' : e.category}
                                </td>
                                <td className="py-2 pr-2">
                                  {e.points != null && e.max_points != null
                                    ? `${e.points} / ${e.max_points}`
                                    : e.points != null
                                      ? String(e.points)
                                      : '—'}
                                </td>
                                <td className="py-2 pr-2 max-w-[220px] text-slate-800">
                                  {e.title || '—'}
                                </td>
                                <td className="py-2 max-w-[320px] text-slate-600 whitespace-pre-wrap break-words">
                                  {e.notes || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
