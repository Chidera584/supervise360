import { useEffect, useRef, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { Upload, FileText, CheckCircle2 } from 'lucide-react';

const REPORT_TYPES = [
  { value: 'proposal', label: 'Proposal' },
  { value: 'progress', label: 'Progress' },
  { value: 'final', label: 'Final' },
  { value: 'other', label: 'Other' },
];

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
      setMessage({
        type: 'error',
        text: msg.includes('Project not found')
          ? 'Your group needs a project record. Contact your supervisor or administrator.'
          : msg,
      });
    }
    setUploading(false);
  };

  return (
    <MainLayout title="Reports & submissions">
      <div className="max-w-4xl mx-auto space-y-8 min-w-0">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-700">Student</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">Submit a report</h2>
          <p className="text-slate-600 mt-1 text-sm">
            Choose the report type, attach your file, and upload for supervisor review.
          </p>
        </div>

        <Card className="min-w-0 border-slate-200/90">
          {message && (
            <div
              className={`p-3 rounded-xl mb-5 text-sm border ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200/80'
                  : 'bg-red-50 text-red-900 border-red-200/80'
              }`}
            >
              {message.text}
            </div>
          )}

          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Report type</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {REPORT_TYPES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setReportType(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  reportType === opt.value
                    ? 'bg-brand-50 text-brand-800 ring-2 ring-brand-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:border-brand-300 hover:bg-brand-50/30 transition-colors px-6 py-10 text-center cursor-pointer"
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-200/80 flex items-center justify-center mx-auto text-brand-600">
              <Upload size={24} strokeWidth={1.75} />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-800">Drag & drop or click to upload</p>
            <p className="text-xs text-slate-500 mt-1">PDF, Word, or other accepted formats</p>
            {file && (
              <p className="text-xs text-brand-700 font-medium mt-3 truncate max-w-full px-2">Selected: {file.name}</p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3 justify-end">
            <Button onClick={uploadReport} disabled={uploading || !file}>
              {uploading ? 'Uploading…' : 'Submit report'}
            </Button>
          </div>
        </Card>

        <Card className="min-w-0 border-slate-200/90">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileText size={20} className="text-brand-600" strokeWidth={1.75} />
              Submission history
            </h3>
          </div>
          {loading ? (
            <div className="text-slate-500 text-sm py-8 text-center">Loading reports…</div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 min-w-0 shadow-sm shadow-slate-900/5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{report.title}</p>
                      <p className="text-sm text-slate-600">
                        {report.report_type} · {report.submitted_at?.split('T')[0]}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {report.reviewed ? (
                          <>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                report.approved == 1
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : report.approved == 0
                                    ? 'bg-red-100 text-red-900'
                                    : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {report.approved == 1 && <CheckCircle2 size={12} />}
                              {report.approved == 1
                                ? 'Approved'
                                : report.approved == 0
                                  ? 'Rejected'
                                  : 'Reviewed'}
                            </span>
                            {report.review_comments && (
                              <div className="w-full mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                  Supervisor feedback
                                </p>
                                <p className="text-sm text-slate-900 whitespace-pre-wrap">{report.review_comments}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs font-medium text-amber-800 bg-amber-100 px-2 py-1 rounded-full">
                            Under review
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {reports.length === 0 && (
                <div className="text-slate-500 text-sm py-8 text-center">No reports submitted yet.</div>
              )}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
