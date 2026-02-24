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
      window.open(url, '_blank');
      // Revoke after a delay so the new tab can load it
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to open document. It may have been deleted or the file is missing.' });
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
        <Card>
          <h2 className="text-xl font-semibold text-[#022B3A]">Pending Report Reviews</h2>
          <p className="text-sm text-gray-600 mt-1">
            Open each report document to review it, then add your comments and approve or reject.
          </p>
        </Card>

        {message && (
          <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <Card>
          {loading ? (
            <div className="text-gray-500">Loading reports...</div>
          ) : (
            <div className="space-y-4">
              {pending.map((report) => (
                <div key={report.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-start justify-between p-4">
                    <div>
                      <p className="font-semibold text-gray-900">{report.title}</p>
                      <p className="text-sm text-gray-600">
                        {report.group_name || 'Group'} • {report.report_type} • {report.submitted_at?.split('T')[0]}
                        {report.file_name && (
                          <span className="ml-2 text-gray-500">({report.file_name})</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDocument(report)}
                        disabled={loadingDocId === report.id}
                      >
                        <ExternalLink size={14} className="mr-1" />
                        {loadingDocId === report.id ? 'Opening...' : 'View Document'}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => expandForReview(report)}
                      >
                        <FileText size={14} className="mr-1" />
                        Review
                      </Button>
                    </div>
                  </div>
                  {expandedId === report.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                      <p className="text-sm text-gray-600">
                        Open the document above to review it, then add your comments below.
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
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => submitReview(report.id, true)}
                          disabled={submittingId === report.id || !comments.trim()}
                        >
                          <CheckCircle size={14} className="mr-1" />
                          {submittingId === report.id ? 'Submitting...' : 'Approve'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => submitReview(report.id, false)}
                          disabled={submittingId === report.id || !comments.trim()}
                          className="border-red-300 text-red-700 hover:bg-red-50"
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
