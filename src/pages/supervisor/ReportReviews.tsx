import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { FileText, ExternalLink, CheckCircle, XCircle } from 'lucide-react';

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
      const ext = report.file_name?.match(/\.[a-z0-9]+$/i)?.[0] || (report.mime_type?.includes('pdf') ? '.pdf' : '.docx');
      a.download = report.file_name || `report-${report.id}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to download document. It may have been deleted or the file is missing.' });
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

  return (
    <MainLayout title="Report Reviews">
      <div className="space-y-6">
        <Card className="border border-slate-200 p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-[#022B3A]">Pending Report Reviews</h2>
          <p className="text-sm text-gray-600 mt-1">
            Download each report to review it, then add your comments and approve or reject.
          </p>
        </Card>

        {message && (
          <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <Card className="border border-slate-200 p-4 sm:p-6">
          {loading ? (
            <div className="text-gray-500">Loading reports...</div>
          ) : (
            <div className="space-y-4">
              {pending.map((report) => (
                <div key={report.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{report.title}</p>
                      <p className="text-sm text-gray-600">
                        {report.group_name || 'Group'} • {report.report_type} • {report.submitted_at?.split('T')[0]}
                        {report.file_name && (
                          <span className="ml-2 text-gray-500">({report.file_name})</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 md:self-center">
                      <Button
                        variant="outline"
                        onClick={() => openDocument(report)}
                        disabled={loadingDocId === report.id}
                        className="text-xs sm:text-sm px-3 py-2"
                      >
                        <ExternalLink size={14} className="mr-1" />
                        {loadingDocId === report.id ? 'Downloading...' : 'Download Document'}
                      </Button>
                      <Button
                        onClick={() => expandForReview(report)}
                        className="text-xs sm:text-sm px-3 py-2"
                      >
                        <FileText size={14} className="mr-1" />
                        Review
                      </Button>
                    </div>
                  </div>
                  {expandedId === report.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                      <p className="text-sm text-gray-600">
                        Download the document above to review it, then add your comments below.
                      </p>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Review Comments</label>
                        <textarea
                          className="w-full rounded-lg border border-gray-300 p-3 text-sm min-h-[100px] focus:ring-2 focus:ring-[#022B3A] focus:border-transparent"
                          placeholder="Enter your feedback and comments on this report..."
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => submitReview(report.id, true)}
                          disabled={submittingId === report.id || !comments.trim()}
                          className="text-xs sm:text-sm px-3 py-2"
                        >
                          <CheckCircle size={14} className="mr-1" />
                          {submittingId === report.id ? 'Submitting...' : 'Approve'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => submitReview(report.id, false)}
                          disabled={submittingId === report.id || !comments.trim()}
                          className="border-red-300 text-red-700 hover:bg-red-50 text-xs sm:text-sm px-3 py-2"
                        >
                          <XCircle size={14} className="mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {pending.length === 0 && (
                <p className="text-gray-500">No pending reports.</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
