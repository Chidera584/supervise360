import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { CalendarClock } from 'lucide-react';

export function StudentMeetings() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetingView, setMeetingView] = useState<'upcoming' | 'history'>('upcoming');

  useEffect(() => {
    apiClient
      .getMySupervisionMeetings()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setMeetings(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const nowTs = Date.now();
  const upcomingMeetings = meetings.filter((m) => {
    const ts = m.starts_at ? new Date(m.starts_at).getTime() : 0;
    return ts >= nowTs;
  });
  const historyMeetings = meetings.filter((m) => {
    const ts = m.starts_at ? new Date(m.starts_at).getTime() : 0;
    return ts > 0 && ts < nowTs;
  });
  const visibleMeetings = meetingView === 'upcoming' ? upcomingMeetings : historyMeetings;

  return (
    <MainLayout title="Supervision meetings">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-[#1F7A8C]" />
            <h2 className="text-lg font-semibold text-[#022B3A]">Scheduled meetings</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={meetingView === 'upcoming' ? 'primary' : 'outline'}
              onClick={() => setMeetingView('upcoming')}
            >
              Upcoming ({upcomingMeetings.length})
            </Button>
            <Button
              variant={meetingView === 'history' ? 'primary' : 'outline'}
              onClick={() => setMeetingView('history')}
            >
              History ({historyMeetings.length})
            </Button>
          </div>
        </div>
        {loading ? (
          <p className="text-slate-600 text-sm">Loading…</p>
        ) : visibleMeetings.length === 0 ? (
          <p className="text-slate-600 text-sm">
            {meetingView === 'upcoming'
              ? 'No upcoming supervision meetings scheduled yet.'
              : 'No past meeting history yet.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {visibleMeetings.map((m) => (
              <li
                key={m.id}
                className="border border-slate-200 rounded-lg p-4 bg-slate-50/80"
              >
                <p className="font-medium text-slate-900">{m.title || 'Meeting'}</p>
                <p className="text-sm text-slate-600 mt-1">
                  {m.starts_at ? new Date(m.starts_at).toLocaleString() : '—'}
                  {m.ends_at ? ` – ${new Date(m.ends_at).toLocaleTimeString()}` : ''}
                </p>
                {m.location && (
                  <p className="text-xs text-slate-500 mt-1">Location: {m.location}</p>
                )}
                {m.notes && <p className="text-sm text-slate-700 mt-2">{m.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </MainLayout>
  );
}
