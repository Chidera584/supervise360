import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';

export function Reports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('proposal');
  const [file, setFile] = useState<File | null>(null);

  const loadReports = async () => {
    setLoading(true);
    const response = await apiClient.getMyReports();
    if (response.success) {
      setReports(response.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReports();
  }, []);

  const uploadReport = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('report_type', reportType);
    formData.append('title', `${reportType} report`);
    const response = await apiClient.uploadReport(formData);
    if (response.success) {
      setFile(null);
      await loadReports();
    }
  };

  return (
    <MainLayout title="Reports">
      <div className="space-y-6">
        <Card>
          <h2 className="text-xl font-semibold text-[#1a237e] mb-4">Upload New Report</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="proposal">Proposal</option>
              <option value="progress">Progress Report</option>
              <option value="final">Final Report</option>
              <option value="other">Other</option>
            </select>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <Button onClick={uploadReport}>Upload Report</Button>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-[#1a237e] mb-4">Submitted Reports</h3>
          {loading ? (
            <div className="text-gray-500">Loading reports...</div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{report.title}</p>
                      <p className="text-sm text-gray-600">
                        {report.report_type} • {report.submitted_at?.split('T')[0]}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {report.reviewed ? 'Reviewed' : 'Under review'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {reports.length === 0 && (
                <div className="text-gray-500">No reports submitted yet.</div>
              )}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
