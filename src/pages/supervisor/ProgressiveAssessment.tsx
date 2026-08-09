import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../lib/api';
import { BarChart3, ChevronDown, ChevronRight, RefreshCw, Plus } from 'lucide-react';
import { Button } from '../../components/UI/Button';

type StudentOption = { student_user_id: number; student_name: string; group_id: number };

const ENTRY_CATEGORIES = [
  { value: 'participation', label: 'Participation' },
  { value: 'quiz', label: 'Quiz / test' },
  { value: 'general', label: 'General performance' },
] as const;

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

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryStudent, setEntryStudent] = useState('');
  const [entryCategory, setEntryCategory] = useState<'participation' | 'quiz' | 'general'>('participation');
  const [entryPoints, setEntryPoints] = useState('');
  const [entryMaxPoints, setEntryMaxPoints] = useState('');
  const [entryTitle, setEntryTitle] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [sRes, eRes, stuRes] = await Promise.all([
      apiClient.getSessions(),
      apiClient.getSupervisorAssessmentEntries(sessionId === '' ? undefined : Number(sessionId)),
      apiClient.getEvaluationStudents(sessionId === '' ? undefined : Number(sessionId)),
    ]);
    if (sRes.success && Array.isArray(sRes.data)) {
      setSessions(sRes.data as { id: number; label: string }[]);
    }
    if (eRes.success && Array.isArray(eRes.data)) {
      setRows(eRes.data as Entry[]);
    } else {
      setRows([]);
    }
    if (stuRes.success && Array.isArray(stuRes.data)) {
      setStudents(stuRes.data as StudentOption[]);
    } else {
      setStudents([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [sessionId]);

  const resetEntryForm = () => {
    setEntryStudent('');
    setEntryCategory('participation');
    setEntryPoints('');
    setEntryMaxPoints('');
    setEntryTitle('');
    setEntryNotes('');
    setEntryError(null);
  };

  const handleAddEntry = async () => {
    if (!entryStudent) {
      setEntryError('Select a student');
      return;
    }
    const targetSessionId = sessionId !== '' ? Number(sessionId) : sessions[0]?.id;
    if (!targetSessionId) {
      setEntryError('Select an academic session first (use the session filter above)');
      return;
    }
    const student = students.find((s) => String(s.student_user_id) === entryStudent);
    if (!student) {
      setEntryError('Selected student not found');
      return;
    }
    const points = entryPoints.trim() === '' ? null : Number(entryPoints);
    const maxPoints = entryMaxPoints.trim() === '' ? null : Number(entryMaxPoints);
    if (points != null && Number.isNaN(points)) {
      setEntryError('Points must be a number');
      return;
    }
    if (maxPoints != null && Number.isNaN(maxPoints)) {
      setEntryError('Max points must be a number');
      return;
    }
    setEntrySaving(true);
    setEntryError(null);
    try {
      const res = await apiClient.createAssessmentEntry({
        student_user_id: student.student_user_id,
        session_id: targetSessionId,
        category: entryCategory,
        points,
        max_points: maxPoints,
        title: entryTitle.trim() || undefined,
        notes: entryNotes.trim() || undefined,
        group_id: student.group_id,
      });
      if (!res.success) {
        setEntryError((res as any).message || 'Failed to save entry');
        return;
      }
      resetEntryForm();
      setShowAddEntry(false);
      await load();
    } finally {
      setEntrySaving(false);
    }
  };

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
            <Button
              type="button"
              onClick={() => {
                resetEntryForm();
                setShowAddEntry((v) => !v);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add entry
            </Button>
          </div>
        </div>

        {showAddEntry && (
          <Card>
            <h2 className="text-sm font-semibold text-[#022B3A] mb-3">New assessment entry</h2>
            <p className="text-xs text-slate-500 mb-4">
              For participation, quizzes, or general performance notes. Meeting attendance is
              recorded automatically when you save attendance for a meeting.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Student</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={entryStudent}
                  onChange={(e) => setEntryStudent(e.target.value)}
                >
                  <option value="">Select student...</option>
                  {students.map((s) => (
                    <option key={s.student_user_id} value={s.student_user_id}>
                      {s.student_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={entryCategory}
                  onChange={(e) => setEntryCategory(e.target.value as typeof entryCategory)}
                >
                  {ENTRY_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Points (optional)</label>
                <input
                  type="number"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={entryPoints}
                  onChange={(e) => setEntryPoints(e.target.value)}
                  placeholder="e.g. 8"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Max points (optional)</label>
                <input
                  type="number"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={entryMaxPoints}
                  onChange={(e) => setEntryMaxPoints(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Title (optional)</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={entryTitle}
                  onChange={(e) => setEntryTitle(e.target.value)}
                  placeholder="e.g. Week 4 quiz"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes (optional)</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                />
              </div>
            </div>
            {entryError && <p className="text-sm text-red-600 mt-3">{entryError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" type="button" onClick={() => setShowAddEntry(false)} disabled={entrySaving}>
                Cancel
              </Button>
              <Button type="button" onClick={handleAddEntry} disabled={entrySaving}>
                {entrySaving ? 'Saving...' : 'Save entry'}
              </Button>
            </div>
          </Card>
        )}

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
