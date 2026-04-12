import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { CalendarClock, RefreshCw, ClipboardList, X } from 'lucide-react';

type MeetingRow = {
  id: number;
  group_id: number;
  title: string;
  starts_at: string;
  group_name?: string;
  location?: string | null;
};

export function SupervisorSupervision() {
  const [sessions, setSessions] = useState<{ id: number; label: string }[]>([]);
  const [sessionFilter, setSessionFilter] = useState<number | ''>('');
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [form, setForm] = useState({
    group_id: '',
    session_id: '',
    title: 'Supervision meeting',
    starts_at: '',
    location: '',
  });
  const [bulkForm, setBulkForm] = useState({
    session_id: '',
    scope: 'all_groups' as 'all_groups' | 'single_group',
    group_id: '',
    title: 'Supervision meeting',
    starts_at: '',
    location: '',
  });
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [attendanceMeeting, setAttendanceMeeting] = useState<MeetingRow | null>(null);
  const [attendancePresent, setAttendancePresent] = useState<Record<number, boolean>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  const loadMeetings = async () => {
    const mRes = await apiClient.getSupervisionMeetings(
      sessionFilter === '' ? undefined : Number(sessionFilter)
    );
    if (mRes.success && Array.isArray(mRes.data)) setMeetings(mRes.data as MeetingRow[]);
  };

  const loadAll = async () => {
    setLoading(true);
    const [sessRes, gRes] = await Promise.all([
      apiClient.getSessions(),
      apiClient.getSupervisorMyGroups(),
    ]);
    if (sessRes.success && Array.isArray(sessRes.data)) {
      const list = sessRes.data as { id: number; label: string }[];
      setSessions(list);
    }
    if (gRes.success && Array.isArray(gRes.data)) setGroups(gRes.data);
    await loadMeetings();
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [sessionFilter]);

  const normalizeStartsAt = (raw: string) =>
    raw.length === 16 ? `${raw}:00`.replace('T', ' ') : raw;

  const createMeeting = async () => {
    const gid = Number(form.group_id);
    const sid = Number(form.session_id);
    if (!gid || !sid || !form.starts_at) {
      alert('Group, session, and start time are required');
      return;
    }
    const starts_at = normalizeStartsAt(form.starts_at);
    const res = await apiClient.createSupervisionMeeting({
      group_id: gid,
      session_id: sid,
      title: form.title,
      starts_at,
      location: form.location || undefined,
    });
    if (res.success) {
      setForm({ ...form, starts_at: '', location: '' });
      await loadMeetings();
    } else {
      alert((res as any).message || 'Failed to create meeting');
    }
  };

  const runBulkSchedule = async () => {
    const sid = Number(bulkForm.session_id);
    if (!sid || !bulkForm.starts_at) {
      alert('Session and start time are required');
      return;
    }
    if (bulkForm.scope === 'single_group' && !Number(bulkForm.group_id)) {
      alert('Select a group for single-group bulk schedule');
      return;
    }
    setBulkSubmitting(true);
    try {
      const res = await apiClient.createBulkSupervisionMeetings({
        session_id: sid,
        starts_at: normalizeStartsAt(bulkForm.starts_at),
        title: bulkForm.title || 'Supervision meeting',
        location: bulkForm.location || undefined,
        scope: bulkForm.scope,
        group_id: bulkForm.scope === 'single_group' ? Number(bulkForm.group_id) : undefined,
      });
      if (res.success) {
        const n = (res.data as any)?.count ?? 0;
        alert(`Scheduled ${n} meeting(s).`);
        setBulkForm((f) => ({ ...f, starts_at: '', location: '' }));
        await loadMeetings();
      } else {
        alert((res as any).message || 'Bulk schedule failed');
      }
    } finally {
      setBulkSubmitting(false);
    }
  };

  const openAttendance = (m: MeetingRow) => {
    const g = groups.find((x: any) => Number(x.id) === Number(m.group_id));
    const members = Array.isArray(g?.members) ? g.members : [];
    const next: Record<number, boolean> = {};
    members.forEach((mem: any) => {
      if (mem?.id != null) next[Number(mem.id)] = true;
    });
    setAttendancePresent(next);
    setAttendanceMeeting(m);
  };

  const saveAttendance = async () => {
    if (!attendanceMeeting) return;
    const attendance = Object.entries(attendancePresent).map(([group_member_id, present]) => ({
      group_member_id: Number(group_member_id),
      present,
    }));
    if (attendance.length === 0) {
      alert('No members found for this group.');
      return;
    }
    setSavingAttendance(true);
    try {
      const res = await apiClient.saveMeetingAttendance(attendanceMeeting.id, attendance);
      if (res.success) {
        setAttendanceMeeting(null);
        await loadMeetings();
      } else {
        alert((res as any).message || 'Failed to save attendance');
      }
    } finally {
      setSavingAttendance(false);
    }
  };

  const attendanceMembers = attendanceMeeting
    ? (() => {
        const g = groups.find((x: any) => Number(x.id) === Number(attendanceMeeting.group_id));
        return Array.isArray(g?.members) ? g.members : [];
      })()
    : [];

  return (
    <MainLayout title="Supervision meetings">
      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-[#1F7A8C]" />
              <h2 className="text-lg font-semibold text-[#022B3A]">Your meetings</h2>
            </div>
            <Button variant="outline" onClick={() => loadAll()}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
          <div className="mb-4">
            <label className="text-sm text-slate-600 mr-2">Filter by session</label>
            <select
              className="border rounded-lg px-2 py-1 text-sm"
              value={sessionFilter === '' ? '' : String(sessionFilter)}
              onChange={(e) => setSessionFilter(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">All</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <p className="text-slate-600 text-sm">Loading…</p>
          ) : meetings.length === 0 ? (
            <p className="text-slate-600 text-sm">No meetings yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {meetings.map((m) => (
                <li key={m.id} className="border border-slate-200 rounded p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{m.title}</span>
                    <span className="text-slate-500 ml-2">
                      {m.group_name} · {m.starts_at ? new Date(m.starts_at).toLocaleString() : ''}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="!text-xs"
                    onClick={() => openAttendance(m)}
                  >
                    <ClipboardList className="w-3.5 h-3.5 mr-1" />
                    Attendance
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-[#022B3A] mb-3">Schedule a meeting (one group)</h3>
          <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
            <div>
              <label className="text-xs text-slate-600">Group</label>
              <select
                className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                value={form.group_id}
                onChange={(e) => setForm({ ...form, group_id: e.target.value })}
              >
                <option value="">Select group…</option>
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
          <Button className="mt-4 bg-[#022B3A]" onClick={createMeeting}>
            Create meeting
          </Button>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-[#022B3A] mb-2">Bulk schedule</h3>
          <p className="text-sm text-slate-600 mb-3">
            Create the same meeting time for all groups you supervise in this session, or for one group only.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
            <div>
              <label className="text-xs text-slate-600">Session</label>
              <select
                className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                value={bulkForm.session_id}
                onChange={(e) => setBulkForm({ ...bulkForm, session_id: e.target.value })}
              >
                <option value="">Select…</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600">Scope</label>
              <select
                className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                value={bulkForm.scope}
                onChange={(e) =>
                  setBulkForm({
                    ...bulkForm,
                    scope: e.target.value as 'all_groups' | 'single_group',
                  })
                }
              >
                <option value="all_groups">All my groups in this session</option>
                <option value="single_group">Single group</option>
              </select>
            </div>
            {bulkForm.scope === 'single_group' && (
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-600">Group</label>
                <select
                  className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                  value={bulkForm.group_id}
                  onChange={(e) => setBulkForm({ ...bulkForm, group_id: e.target.value })}
                >
                  <option value="">Select group…</option>
                  {groups.map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.department})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-600">Title</label>
              <input
                className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                value={bulkForm.title}
                onChange={(e) => setBulkForm({ ...bulkForm, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Starts at (local)</label>
              <input
                type="datetime-local"
                className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                value={bulkForm.starts_at}
                onChange={(e) => setBulkForm({ ...bulkForm, starts_at: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Location</label>
              <input
                className="w-full border rounded-lg px-2 py-2 text-sm mt-1"
                value={bulkForm.location}
                onChange={(e) => setBulkForm({ ...bulkForm, location: e.target.value })}
              />
            </div>
          </div>
          <Button
            className="mt-4 bg-[#1F7A8C]"
            onClick={runBulkSchedule}
            disabled={bulkSubmitting}
          >
            {bulkSubmitting ? 'Scheduling…' : 'Schedule for selected scope'}
          </Button>
        </Card>

        {attendanceMeeting && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => !savingAttendance && setAttendanceMeeting(null)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Meeting attendance</h3>
                  <p className="text-sm text-slate-600">{attendanceMeeting.title}</p>
                </div>
                <button
                  type="button"
                  className="p-2 rounded-lg hover:bg-slate-100"
                  onClick={() => !savingAttendance && setAttendanceMeeting(null)}
                >
                  <X size={20} />
                </button>
              </div>
              {attendanceMembers.length === 0 ? (
                <p className="text-sm text-amber-700">No members loaded for this group. Refresh and try again.</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {attendanceMembers.map((mem: any) => (
                    <li
                      key={mem.id}
                      className="flex items-center justify-between gap-2 border border-slate-100 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm font-medium text-slate-800">{mem.name}</span>
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={attendancePresent[mem.id] !== false}
                          onChange={(e) =>
                            setAttendancePresent((prev) => ({
                              ...prev,
                              [mem.id]: e.target.checked,
                            }))
                          }
                        />
                        Present
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAttendanceMeeting(null)} disabled={savingAttendance}>
                  Cancel
                </Button>
                <Button onClick={saveAttendance} disabled={savingAttendance || attendanceMembers.length === 0}>
                  {savingAttendance ? 'Saving…' : 'Save attendance'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
