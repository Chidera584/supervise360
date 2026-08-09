import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../lib/api';
import { BarChart3, CheckCircle, MessageSquareText, ClipboardList } from 'lucide-react';

type Entry = {
  id: number;
  category: string;
  title: string | null;
  notes: string | null;
  recorded_at: string;
  meeting_id: number | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  meeting_attendance: 'Meeting attendance',
  participation: 'Participation',
  quiz: 'Quiz / test',
  general: 'General performance',
};

export function ProgressiveAssessment() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getMyProgressiveAssessments()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setEntries(res.data as Entry[]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <MainLayout title="Progressive assessment">
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-[#1F7A8C]" />
          <h2 className="text-lg font-semibold text-[#022B3A]">Your assessment record</h2>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Your supervisor records attendance, participation, quiz, and general-performance
          entries here over time. Numeric scores aren't shown - only that a record exists, when,
          and any notes your supervisor left.
        </p>
        {loading ? (
          <p className="text-slate-600 text-sm">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-slate-600 text-sm">No assessment entries recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((e) => (
              <li key={e.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/80">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    {e.category === 'meeting_attendance' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : e.category === 'quiz' ? (
                      <ClipboardList className="w-4 h-4 text-[#1F7A8C]" />
                    ) : (
                      <MessageSquareText className="w-4 h-4 text-[#1F7A8C]" />
                    )}
                    <span className="font-medium text-slate-900">
                      {CATEGORY_LABELS[e.category] || e.category}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {e.recorded_at ? new Date(e.recorded_at).toLocaleString() : '—'}
                  </span>
                </div>
                {e.title && <p className="text-sm text-slate-800 mt-2">{e.title}</p>}
                {e.notes && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{e.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </MainLayout>
  );
}
