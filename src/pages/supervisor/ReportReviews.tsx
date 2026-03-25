import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { FileText, Download, CheckCircle, XCircle, ChevronRight } from 'lucide-react';

export function ReportReviews() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [comments, setComments] = useState('');
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<number | null>(null);

  const loadPending = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getPendingReportReviews();
      if (response.success) {
        setPending(Array.isArray(response.data) ? response.data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  const openDocument = async (report: { id: number; file_name?: string; mime_type?: string }) => {
    setLoadingDocId(report.id);
    try {
      const blob = await apiClient.fetchReportFile(report.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext =
        report.file_name?.match(/\.[a-z0-9]+$/i)?.[0] ||
        (report.mime_type?.includes('pdf') ? '.pdf' : '.docx');
      a.download = report.file_name || `report-${report.id}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setMessage({
        type: 'error',
        text: 'Failed to download document. It may have been deleted or the file is missing.',
      });
    } finally {
      setLoadingDocId(null);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const submitReview = async (id: number, approved: boolean) => {
    const trimmed = comments.trim();
    if (!trimmed) {
      setMessage({ type: 'error', text: 'Please add your review comments before submitting.' });
      return;
    }
    setSubmittingId(id);
    setMessage(null);
    try {
      const res = await apiClient.reviewReport(id, { comments: trimmed, approved });
      if (res.success) {
        setMessage({ type: 'success', text: approved ? 'Report approved.' : 'Report rejected.' });
        setExpandedId(null);
        setComments('');
        await loadPending();
      } else {
        setMessage({ type: 'error', text: (res as any).message || 'Failed to submit review' });
      }
    } finally {
      setSubmittingId(null);
    }
  };

  const expandForReview = (report: any) => {
    setExpandedId(expandedId === report.id ? null : report.id);
    setComments('');
    setMessage(null);
  };

  const selected = expandedId != null ? pending.find((r) => r.id === expandedId) : null;

  return (
    <MainLayout title="Report reviews">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-700">Supervisor</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">Pending submissions</h2>
          <p className="text-slate-600 mt-1 text-sm max-w-2xl">
            Download each draft, review offline if needed, then record comments and approve or reject.
          </p>
        </div>

        {message && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200/80'
                : 'bg-red-50 text-red-900 border-red-200/80'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
          <div className="xl:col-span-3 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">
                Queue{' '}
                <span className="text-slate-500 font-normal">({pending.length})</span>
              </p>
            </div>

            {loading ? (
              <Card className="py-12 text-center text-slate-500 text-sm">Loading reports…</Card>
            ) : (
              <div className="space-y-3">
                {pending.map((report) => {
                  const active = expandedId === report.id;
                  return (
                    <div
                      key={report.id}
                      className={`rounded-xl border bg-white p-4 sm:p-5 shadow-sm shadow-slate-900/5 transition-all ${
                        active ? 'border-brand-400 ring-2 ring-brand-500/20' : 'border-slate-200/90 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-600">
                          <FileText size={20} strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 gap-y-1">
                            <h3 className="font-semibold text-slate-900">{report.title}</h3>
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                              Awaiting review
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">
                            {report.group_name || 'Group'} · {report.report_type} ·{' '}
                            {report.submitted_at?.split('T')[0]}
                          </p>
                          {report.file_name && (
                            <p className="text-xs text-slate-500 mt-1 truncate">{report.file_name}</p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDocument(report)}
                              disabled={loadingDocId === report.id}
                            >
                              <Download size={14} className="shrink-0" />
                              {loadingDocId === report.id ? 'Downloading…' : 'Download draft'}
                            </Button>
                            <Button
                              variant={active ? 'secondary' : 'primary'}
                              size="sm"
                              onClick={() => expandForReview(report)}
                            >
                              {active ? 'Selected' : 'Review'}
                              {!active && <ChevronRight size={14} className="shrink-0" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {pending.length === 0 && (
                  <Card className="py-12 text-center text-slate-500 text-sm">No pending reports.</Card>
                )}
              </div>
            )}
          </div>

          <div className="xl:col-span-2 xl:sticky xl:top-24 space-y-4">
            <Card className="border-slate-200/90">
              {!selected ? (
                <div className="text-center py-10 px-2">
                  <FileText className="mx-auto h-10 w-10 text-slate-300 mb-3" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-slate-800">Select a submission</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Choose <span className="font-medium text-slate-700">Review</span> on a report to add comments and
                    submit your decision.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-700">
                      Currently reviewing
                    </p>
                    <p className="font-semibold text-slate-900 mt-1">{selected.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selected.group_name} · {selected.report_type}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                      Reviewer comments
                    </label>
                    <textarea
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm min-h-[120px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                      placeholder="Summarize feedback, required changes, or approval notes…"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="flex-1 min-w-[8rem]"
                        onClick={() => submitReview(selected.id, true)}
                        disabled={submittingId === selected.id || !comments.trim()}
                      >
                        <CheckCircle size={14} />
                        {submittingId === selected.id ? 'Submitting…' : 'Approve'}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 min-w-[8rem] border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => submitReview(selected.id, false)}
                        disabled={submittingId === selected.id || !comments.trim()}
                      >
                        <XCircle size={14} />
                        Reject
                      </Button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Comments are sent to the student with your decision.
                    </p>
                  </div>
                </div>
              )}
            </Card>

            <div className="rounded-xl border border-slate-900/10 bg-slate-900 p-5 text-white shadow-lg shadow-slate-900/20">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Tip</p>
              <p className="text-sm text-slate-200 mt-2 leading-relaxed">
                Keep feedback specific and actionable so students can update their work without guesswork.
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
