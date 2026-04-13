import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { CalendarClock, RefreshCw, ClipboardList, X } from 'lucide-react';

const ALL_GROUPS = '__ALL__';

type MeetingSingle = {
  kind: 'single';
  id: number;
  group_id: number;
  title: string;
  starts_at: string;
  group_name?: string;
  attendance_locked?: boolean;
};

type MeetingSeries = {
  kind: 'series';
  bulk_series_id: string;
  title: string;
  starts_at: string;
  display_label: string;
  attendance_locked?: boolean;
};

type MeetingListItem = MeetingSingle | MeetingSeries;

type AttendanceRow = { group_member_id: number; name: string; present: boolean };

type AttendanceCtx =
  | { mode: 'single'; meetingId: number; title: string; locked: boolean }
  | { mode: 'series'; bulkSeriesId: string; title: string; locked: boolean };

export function SupervisorSupervision() {
  const [sessions, setSessions] = useState<{ id: number; label: string }[]>([]);
  const [supervisorSession, setSupervisorSession] = useState<number | ''>('');
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [form, setForm] = useState({
    group_id: '' as string,
    session_id: '',
    title: 'Supervision meeting',
    starts_at: '',
    location: '',
  });
  const [attendanceCtx, setAttendanceCtx] = useState<AttendanceCtx | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [sessionInitDone, setSessionInitDone] = useState(false);

  const sessionIdNum = supervisorSession === '' ? undefined : Number(supervisorSession);

  const loadMeetings = async () => {
    const mRes = await apiClient.getSupervisionMeetings(sessionIdNum);
    if (mRes.success && Array.isArray(mRes.data)) {
      setMeetings(mRes.data as MeetingListItem[]);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    const sid = sessionIdNum;
    const [sessRes, gRes] = await Promise.all([
      apiClient.getSessions(),
      apiClient.getSupervisorMyGroups(sid),
    ]);
    if (sessRes.success && Array.isArray(sessRes.data)) {
      setSessions(sessRes.data as { id: number; label: string }[]);
    }
    if (gRes.success && Array.isArray(gRes.data)) setGroups(gRes.data);
    await loadMeetings();
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const sessRes = await apiClient.getSessions();
      if (sessRes.success && Array.isArray(sessRes.data)) {
        const list = sessRes.data as { id: number; label: string }[];
        setSessions(list);
        if (list.length) setSupervisorSession(list[0].id);
      }
      setSessionInitDone(true);
    })();
  }, []);

  useEffect(() => {
    if (!sessionInitDone) return;
    if (sessions.length > 0 && supervisorSession === '') return;
    loadAll();
  }, [sessionInitDone, supervisorSession, sessions.length]);

  useEffect(() => {
    if (supervisorSession !== '') {
      setForm((f) => ({ ...f, session_id: String(supervisorSession) }));
    }
  }, [supervisorSession]);

  const normalizeStartsAt = (raw: string) =>
    raw.length === 16 ? `${raw}:00`.replace('T', ' ') : raw;

  const scheduleMeeting = async () => {
    const sid = Number(form.session_id);
    if (!sid || !form.starts_at) {
      alert('Session and start time are required');
      return;
    }
    const starts_at = normalizeStartsAt(form.starts_at);
    if (form.group_id === ALL_GROUPS) {
      const res = await apiClient.createBulkSupervisionMeetings({
        session_id: sid,
        starts_at,
        title: form.title || 'Supervision meeting',
        location: form.location || undefined,
        scope: 'all_groups',
      });
      if (res.success) {
        const n = (res.data as any)?.count ?? 0;
        alert(`Scheduled ${n} meeting(s) for all your groups in this session.`);
        setForm((f) => ({ ...f, starts_at: '', location: '' }));
        await loadMeetings();
      } else {
        alert((res as any).message || 'Failed to schedule');
      }
      return;
    }
    const gid = Number(form.group_id);
    if (!gid) {
      alert('Select a group or All groups');
      return;
    }
    const res = await apiClient.createSupervisionMeeting({
      group_id: gid,
      session_id: sid,
      title: form.title,
      starts_at,
      location: form.location || undefined,
    });
    if (res.success) {
      setForm((f) => ({ ...f, starts_at: '', location: '' }));
      await loadMeetings();
    } else {
      alert((res as any).message || 'Failed to create meeting');
    }
  };

  const openAttendance = async (m: MeetingListItem) => {
    setLoadingAttendance(true);
    try {
      if (m.kind === 'series') {
        const res = await apiClient.getSeriesMeetingAttendance(m.bulk_series_id);
        if (!res.success) {
          alert((res as any).message || 'Failed to load attendance');
          return;
        }
        const d = res.data as {
          locked: boolean;
          students: {
            group_member_id: number;
            student_name: string;
            present: boolean | null;
          }[];
          title?: string;
        };
        const title = m.display_label || d.title || m.title;
        const rows: AttendanceRow[] = (d.students || []).map((s) => ({
          group_member_id: s.group_member_id,
          name: s.student_name || 'Student',
          present: s.present === null || s.present === undefined ? true : !!s.present,
        }));
        setAttendanceCtx({
          mode: 'series',
          bulkSeriesId: m.bulk_series_id,
          title,
          locked: !!d.locked,
        });
        setAttendanceRows(rows);
        return;
      }
      const res = await apiClient.getMeetingAttendance(m.id);
      const g = groups.find((x: any) => Number(x.id) === Number(m.group_id));
      const members = Array.isArray(g?.members) ? g.members : [];
      const locked =
        res.success && res.data && typeof (res.data as any).locked === 'boolean'
          ? !!(res.data as any).locked
          : !!m.attendance_locked;
      const saved = (res.success && (res.data as any)?.attendance) as
        | { group_member_id: number; present: boolean }[]
        | undefined;
      const rows: AttendanceRow[] = members.map((mem: any) => {
        const sid = Number(mem.id);
        const row = saved?.find((a) => a.group_member_id === sid);
        return {
          group_member_id: sid,
          name: mem.name || 'Student',
          present: row ? !!row.present : true,
        };
      });
      setAttendanceCtx({
        mode: 'single',
        meetingId: m.id,
        title: `${m.title} — ${m.group_name || 'Group'}`,
        locked,
      });
      setAttendanceRows(rows);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const saveAttendance = async () => {
    if (!attendanceCtx) return;
    if (attendanceCtx.locked) return;
    const attendance = attendanceRows.map((r) => ({
      group_member_id: r.group_member_id,
      present: r.present,
    }));
    if (attendance.length === 0) {
      alert('No students in this meeting.');
      return;
    }
    setSavingAttendance(true);
    try {
      if (attendanceCtx.mode === 'series') {
        const res = await apiClient.saveSeriesMeetingAttendance(attendanceCtx.bulkSeriesId, attendance);
        if (res.success) {
          setAttendanceCtx(null);
          setAttendanceRows([]);
          await loadMeetings();
        } else {
          alert((res as any).message || 'Failed to save attendance');
        }
      } else {
        const res = await apiClient.saveMeetingAttendance(attendanceCtx.meetingId, attendance);
        if (res.success) {
          setAttendanceCtx(null);
          setAttendanceRows([]);
          await loadMeetings();
        } else {
          alert((res as any).message || 'Failed to save attendance');
        }
      }
    } finally {
      setSavingAttendance(false);
    }
  };

  return (
    <MainLayout title="Supervision meetings">
      <div className="space-y-6">
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-[#1F7A8C]" />
              <h2 className="text-lg font-semibold text-[#022B3A]">Supervision portal</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm text-slate-600">Academic session</label>
              <select
                className="border rounded-lg px-2 py-1.5 text-sm min-w-[200px]"
                value={supervisorSession === '' ? '' : String(supervisorSession)}
                onChange={(e) => setSupervisorSession(e.target.value ? Number(e.target.value) : '')}
              >
                {sessions.length === 0 ? (
                  <option value="">No sessions</option>
                ) : (
                  sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))
                )}
              </select>
              <Button variant="outline" onClick={() => loadAll()}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-[#1F7A8C]" />
              <h2 className="text-lg font-semibold text-[#022B3A]">Your meetings</h2>
            </div>
          </div>
          {loading ? (
            <p className="text-slate-600 text-sm">Loading…</p>
          ) : meetings.length === 0 ? (
            <p className="text-slate-600 text-sm">No meetings yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {meetings.map((m) => {
                const key = m.kind === 'series' ? `s-${m.bulk_series_id}` : `m-${m.id}`;
                const primary =
                  m.kind === 'series' ? m.display_label || m.title : `${m.title} — ${m.group_name || ''}`;
                const locked = !!m.attendance_locked;
                return (
                  <li
                    key={key}
                    className="border border-slate-200 rounded p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-medium">{primary}</span>
                      <span className="text-slate-500 ml-2">
                        {m.starts_at ? new Date(m.starts_at).toLocaleString() : ''}
                      </span>
                      {locked && (
                        <span className="ml-2 text-xs font-semibold text-emerald-700">Attendance saved</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="!text-xs"
                      onClick={() => openAttendance(m)}
                    >
                      <ClipboardList className="w-3.5 h-3.5 mr-1" />
                      {locked ? 'View attendance' : 'Attendance'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-[#022B3A] mb-3">Schedule a meeting</h3>
          <p className="text-sm text-slate-600 mb-3">
            Pick one group or <span className="font-medium">All groups</span> to schedule the same time for every
            group you supervise in the selected session.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-600">Group</label>
              <select
                className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                value={form.group_id}
                onChange={(e) => setForm({ ...form, group_id: e.target.value })}
              >
                <option value="">Select group…</option>
                <option value={ALL_GROUPS}>All groups (this session)</option>
                {groups.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.department})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600">Session</label>
              <select
                className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                value={form.session_id}
                onChange={(e) => setForm({ ...form, session_id: e.target.value })}
              >
                <option value="">Select…</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-600">Title</label>
              <input
                className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Starts at (local)</label>
              <input
                type="datetime-local"
                className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Location</label>
              <input
                className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
          </div>
          <Button className="mt-4 bg-[#022B3A]" onClick={scheduleMeeting}>
            Schedule meeting
          </Button>
        </Card>

        {attendanceCtx && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => !savingAttendance && !loadingAttendance && setAttendanceCtx(null)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 shrink-0">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Meeting attendance</h3>
                  <p className="text-sm text-slate-600">{attendanceCtx.title}</p>
                  {attendanceCtx.locked && (
                    <p className="text-xs text-emerald-800 mt-1">Saved — read only</p>
                  )}
                </div>
                <button
                  type="button"
                  className="p-2 rounded-lg hover:bg-slate-100"
                  onClick={() => !savingAttendance && !loadingAttendance && setAttendanceCtx(null)}
                >
                  <X size={20} />
                </button>
              </div>
              {loadingAttendance ? (
                <p className="text-sm text-slate-600">Loading…</p>
              ) : attendanceRows.length === 0 ? (
                <p className="text-sm text-amber-700">No students found for this meeting.</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {attendanceRows.map((row) => (
                    <li
                      key={row.group_member_id}
                      className="flex items-center justify-between gap-2 border border-slate-100 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm font-medium text-slate-800">{row.name}</span>
                      {attendanceCtx.locked ? (
                        <span className="text-sm text-slate-700">{row.present ? 'Present' : 'Absent'}</span>
                      ) : (
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={row.present}
                            onChange={(e) =>
                              setAttendanceRows((prev) =>
                                prev.map((r) =>
                                  r.group_member_id === row.group_member_id
                                    ? { ...r, present: e.target.checked }
                                    : r
                                )
                              )
                            }
                          />
                          Present
                        </label>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end gap-2 pt-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setAttendanceCtx(null)}
                  disabled={savingAttendance || loadingAttendance}
                >
                  {attendanceCtx.locked ? 'Close' : 'Cancel'}
                </Button>
                {!attendanceCtx.locked && (
                  <Button
                    onClick={saveAttendance}
                    disabled={savingAttendance || loadingAttendance || attendanceRows.length === 0}
                  >
                    {savingAttendance ? 'Saving…' : 'Save attendance'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
