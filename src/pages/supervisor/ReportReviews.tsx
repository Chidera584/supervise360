import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';

export function ReportReviews() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPending = async () => {
    setLoading(true);
    const response = await apiClient.getPendingReportReviews();
    if (response.success && response.data) {
      setPending(response.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPending();
  }, []);

  const reviewReport = async (id: number) => {
    const comments = prompt('Review comments');
    if (!comments) return;
    await apiClient.reviewReport(id, { comments, approved: true });
    loadPending();
  };

  return (
    <MainLayout title="Report Reviews">
      <div className="space-y-6">
        <Card>
          <h2 className="text-xl font-semibold text-[#1a237e]">Pending Report Reviews</h2>
        </Card>

        <Card>
          {loading ? (
            <div className="text-gray-500">Loading reports...</div>
          ) : (
            <div className="space-y-4">
              {pending.map((report) => (
                <div key={report.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{report.title}</p>
                      <p className="text-sm text-gray-600">
                        {report.group_name || 'Group'} • {report.report_type} • {report.submitted_at?.split('T')[0]}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => reviewReport(report.id)}>
                        Review
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {pending.length === 0 && (
                <div className="text-gray-500">No pending reports.</div>
              )}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
