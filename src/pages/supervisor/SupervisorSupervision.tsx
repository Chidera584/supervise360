import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { CalendarClock, RefreshCw } from 'lucide-react';

export function SupervisorSupervision() {
  const [sessions, setSessions] = useState<{ id: number; label: string }[]>([]);
  const [sessionFilter, setSessionFilter] = useState<number | ''>('');
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [form, setForm] = useState({
    group_id: '',
    session_id: '',
    title: 'Supervision meeting',
    starts_at: '',
    location: '',
  });

  const loadMeetings = async () => {
    const mRes = await apiClient.getSupervisionMeetings(
      sessionFilter === '' ? undefined : Number(sessionFilter)
    );
    if (mRes.success && Array.isArray(mRes.data)) setMeetings(mRes.data);
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

  const createMeeting = async () => {
    const gid = Number(form.group_id);
    const sid = Number(form.session_id);
    if (!gid || !sid || !form.starts_at) {
      alert('Group, session, and start time are required');
      return;
    }
    const starts_at = form.starts_at.length === 16 ? `${form.starts_at}:00`.replace('T', ' ') : form.starts_at;
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

  return (
    <MainLayout title="Supervision meetings">
      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-[#1F7A8C]" />
              <h2 className="text-lg font-semibold text-[#022B3A]">Your meetings</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadAll()}>
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
                <li key={m.id} className="border border-slate-200 rounded p-3">
                  <span className="font-medium">{m.title}</span>
                  <span className="text-slate-500 ml-2">
                    {m.group_name} · {m.starts_at ? new Date(m.starts_at).toLocaleString() : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-[#022B3A] mb-3">Schedule a meeting</h3>
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
      </div>
    </MainLayout>
  );
}
