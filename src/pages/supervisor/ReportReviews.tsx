import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Button } from '../../components/UI/Button';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../lib/api';
import { FileText, ExternalLink, CheckCircle, XCircle } from 'lucide-react';

export function ReportReviews() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
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
      } else {
        setPending([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const selectedReport = useMemo(() => {
    if (!selectedId) return null;
    return pending.find((r) => r.id === selectedId) || null;
  }, [pending, selectedId]);

  const openDocument = async (report: { id: number; file_name?: string; mime_type?: string }) => {
    setLoadingDocId(report.id);
    try {
      const blob = await apiClient.fetchReportFile(report.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext =
        report.file_name?.match(/\.[a-z0-9]+$/i)?.[0] || (report.mime_type?.includes('pdf') ? '.pdf' : '.docx');
      a.download = report.file_name || `report-${report.id}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to download document. It may have been deleted or missing.' });
    } finally {
      setLoadingDocId(null);
    }
  };

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
        setSelectedId(null);
        setComments('');
        await loadPending();
      } else {
        setMessage({ type: 'error', text: (res as any).message || 'Failed to submit review' });
      }
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <MainLayout title="Report Reviews">
      <div className="max-w-6xl mx-auto space-y-6 min-w-0">
        <Card className="border border-slate-200/90 rounded-2xl p-4 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-[#1a1a1a]">Pending Report Reviews</h2>
              <p className="text-sm text-slate-600 mt-1">
                Download each report to review it, then add your comments and approve or reject.
              </p>
            </div>
            <div className="mt-1 md:mt-0 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pending</p>
              <p className="text-lg font-semibold text-slate-800">{pending.length} submissions</p>
            </div>
          </div>
        </Card>

        {message && (
          <div
            className={`p-4 rounded-xl border ${
              message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-5">
          {/* Left: list */}
          <Card className="border border-slate-200/90 rounded-2xl p-0 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-white/50">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#1a1a1a]">Pending Submissions</h3>
                <div className="flex gap-2">
                  <div className="text-xs font-semibold px-3 py-1 rounded-full bg-[#006D6D]/10 text-[#006D6D] border border-[#006D6D]/20">
                    All Projects
                  </div>
                  <div className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                    Urgent
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-1">Select a submission to review.</p>
            </div>

            {loading ? (
              <div className="p-6 text-slate-500">Loading reports…</div>
            ) : pending.length === 0 ? (
              <div className="p-6 text-slate-500">No pending reports.</div>
            ) : (
              <div className="p-4 space-y-3">
                {pending.map((report) => {
                  const isSelected = selectedId === report.id;
                  const submittedDate = report.submitted_at ? report.submitted_at.split('T')[0] : '—';

                  return (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(report.id);
                        setComments('');
                        setMessage(null);
                      }}
                      className={`w-full text-left border rounded-xl p-4 transition-shadow ${
                        isSelected
                          ? 'border-[#006D6D]/30 bg-[#006D6D]/5 shadow-sm'
                          : 'border-slate-200 hover:border-[#006D6D]/20 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-[#006D6D]">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#1a1a1a] truncate">{report.title}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {report.group_name || 'Group'} • {report.report_type} • {submittedDate}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-[#1F7A8C]/10 text-[#1F7A8C] border border-[#1F7A8C]/20">
                            NEW
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                        <div className="w-2 h-2 rounded-full bg-[#006D6D]" />
                        Awaiting review
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Right: review panel */}
          <Card className="border border-slate-200/90 rounded-2xl p-0 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-white/50">
              <h3 className="text-lg font-semibold text-[#1a1a1a]">Review Submission</h3>
              <p className="text-sm text-slate-500 mt-1">Download the draft, then add your decision and comments.</p>
            </div>

            <div className="p-5 space-y-4">
              {!selectedReport ? (
                <div className="py-10 text-center text-slate-500">
                  Select a submission from the left panel.
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Currently reviewing</p>
                    <p className="mt-1 font-semibold text-[#1a1a1a]">{selectedReport.title}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {selectedReport.group_name || 'Group'} • {selectedReport.report_type}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                    <Button
                      variant="outline"
                      className="!rounded-[10px] !px-3 !py-2 !border-slate-200"
                      onClick={() => openDocument(selectedReport)}
                      disabled={loadingDocId === selectedReport.id}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {loadingDocId === selectedReport.id ? 'Downloading…' : 'Download Draft'}
                    </Button>

                    <div className="text-xs text-slate-500">
                      {selectedReport.file_name ? selectedReport.file_name : 'Draft document'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-[#1a1a1a]">Reviewer Comments *</label>
                    <textarea
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      rows={6}
                      className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#006D6D]/30"
                      placeholder="Provide detailed feedback on methodology, citations, and structure…"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      className="flex-1 !rounded-[10px] !bg-[#006D6D] !text-white hover:!bg-[#005a5a] border-0"
                      onClick={() => submitReview(selectedReport.id, true)}
                      disabled={submittingId === selectedReport.id || !comments.trim()}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 !rounded-[10px] !border-red-200 !text-red-700 hover:!bg-red-50"
                      onClick={() => submitReview(selectedReport.id, false)}
                      disabled={submittingId === selectedReport.id || !comments.trim()}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>

                  <div className="pt-2">
                    <Button
                      className="w-full !rounded-[12px] !bg-[#006D6D] !text-white hover:!bg-[#005a5a] border-0"
                      onClick={() => {
                        if (!selectedReport) return;
                        // Safety: do not change behavior, just a convenience for "submit final review"
                        // This uses "approve" as the default final action if comments exist.
                        submitReview(selectedReport.id, true);
                      }}
                      disabled={submittingId === selectedReport.id || !comments.trim()}
                    >
                      Submit Final Review
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

