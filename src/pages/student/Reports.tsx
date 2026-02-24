import { useEffect, useRef, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';

export function Reports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [reportType, setReportType] = useState('proposal');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file first.' });
      return;
    }
    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('report_type', reportType);
    formData.append('title', `${reportType} report`);
    const response = await apiClient.uploadReport(formData);
    if (response.success) {
      setMessage({ type: 'success', text: 'Report uploaded successfully.' });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadReports();
    } else {
      const msg = (response as any).message || 'Failed to upload report.';
      setMessage({ type: 'error', text: msg.includes('Project not found') ? 'Your group needs a project record. Contact your supervisor or administrator.' : msg });
    }
    setUploading(false);
  };

  return (
    <MainLayout title="Reports">
      <div className="space-y-6">
        <Card>
          <h2 className="text-xl font-semibold text-[#022B3A] mb-4">Upload New Report</h2>
          <p className="text-sm text-gray-600 mb-4">
            Submit your project proposal and reports here. Select the report type (Proposal, Progress, Final) and choose a file (PDF, Word, etc.).
          </p>
          {message && (
            <div className={`p-3 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message.text}
            </div>
          )}
          <div className="flex flex-col md:flex-row gap-4 items-start">
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
              ref={fileInputRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <Button onClick={uploadReport} disabled={uploading || !file}>
              {uploading ? 'Uploading...' : 'Upload Report'}
            </Button>
          </div>
          {file && <p className="text-sm text-gray-600 mt-2">Selected: {file.name}</p>}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-[#022B3A] mb-4">Submitted Reports</h3>
          {loading ? (
            <div className="text-gray-500">Loading reports...</div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{report.title}</p>
                      <p className="text-sm text-gray-600">
                        {report.report_type} • {report.submitted_at?.split('T')[0]}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {report.reviewed ? (
                          <>
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                                report.approved == 1
                                  ? 'bg-green-100 text-green-800'
                                  : report.approved == 0
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {report.approved == 1
                                ? '✓ Approved'
                                : report.approved == 0
                                ? '✗ Rejected'
                                : 'Reviewed'}
                            </span>
                            {report.review_comments && (
                              <div className="w-full mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Supervisor feedback</p>
                                <p className="text-sm text-gray-900 whitespace-pre-wrap">{report.review_comments}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">Under review</span>
                        )}
                      </div>
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
