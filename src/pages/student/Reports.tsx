import { useEffect, useRef, useState, useMemo } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { useGroups } from '../../contexts/GroupsContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Upload,
  FileText,
  CheckCircle2,
  Lock,
  Loader2,
  Mail,
  Check,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const TEAL = '#006D6D';

const REPORT_TYPES = [
  { value: 'proposal', label: 'Proposal' },
  { value: 'progress', label: 'Progress' },
  { value: 'final', label: 'Final' },
  { value: 'other', label: 'Other' },
];

const STEPS = [
  { key: 'proposal', label: 'Proposal' },
  { key: 'progress', label: 'Progress #1' },
  { key: 'progress2', label: 'Progress #2' },
  { key: 'final', label: 'Final report' },
];

export function Reports() {
  const { student } = useAuth();
  const { groups, syncWithDatabase } = useGroups();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [reportType, setReportType] = useState('proposal');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const studentGroup = groups.find((g) =>
    g.members.some((m) => (m.matricNumber ?? (m as any).matric) === student?.matric_number)
  );

  useEffect(() => {
    syncWithDatabase().catch(() => {});
  }, [syncWithDatabase]);

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

  const milestoneState = useMemo(() => {
    const has = (t: string) =>
      reports.some((r) => String(r.report_type || '').toLowerCase() === t.toLowerCase());
    const progressN = reports.filter((r) => String(r.report_type || '').toLowerCase() === 'progress').length;
    const steps = STEPS.map((s) => {
      if (s.key === 'proposal') return { ...s, done: has('proposal') };
      if (s.key === 'progress') return { ...s, done: progressN >= 1 };
      if (s.key === 'progress2') return { ...s, done: progressN >= 2 };
      return { ...s, done: has('final') };
    });
    const firstIncomplete = steps.findIndex((s) => !s.done);
    return steps.map((s, i) => {
      if (s.done) return { ...s, status: 'done' as const };
      if (firstIncomplete === -1) return { ...s, status: 'done' as const };
      return { ...s, status: i === firstIncomplete ? ('current' as const) : ('pending' as const) };
    });
  }, [reports]);

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
      <div className="space-y-8 min-w-0">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: TEAL }}>
            Student
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">Reports & submissions</h1>
          <p className="text-slate-600 mt-2 text-sm sm:text-base max-w-2xl leading-relaxed">
            Manage your academic progress, submit project milestones, and track feedback from your supervisor in one
            place.
          </p>
        </div>

        {/* Milestone strip */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 sm:p-6 overflow-x-auto">
          <div className="flex items-center justify-between gap-4 min-w-[520px] sm:min-w-0">
            {milestoneState.map((step, idx) => (
              <div key={step.key} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center text-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                      step.status === 'done'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : step.status === 'current'
                          ? 'border-sky-400 bg-sky-50 text-sky-700'
                          : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}
                  >
                    {step.status === 'done' ? (
                      <Check className="w-5 h-5" strokeWidth={2.5} />
                    ) : step.status === 'current' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs font-semibold text-slate-800 mt-2 leading-tight px-1">
                    {step.label}
                  </p>
                </div>
                {idx < milestoneState.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-1 rounded-full min-w-[12px] ${
                      milestoneState[idx].status === 'done' ? 'bg-emerald-400' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 sm:p-6 min-w-0">
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

              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Select project type</p>
              <div className="flex flex-wrap gap-2 mb-8">
                {REPORT_TYPES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setReportType(opt.value)}
                    className={`px-4 py-2.5 rounded-[10px] text-sm font-semibold border-2 transition-colors ${
                      reportType === opt.value
                        ? 'text-white border-transparent shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                    style={reportType === opt.value ? { backgroundColor: TEAL } : undefined}
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
                className="rounded-xl border-2 border-dashed border-slate-200 bg-[#F8F9FA]/80 hover:border-[#006D6D]/40 hover:bg-[#006D6D]/[0.04] transition-colors px-6 py-12 text-center cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <div
                  className="w-14 h-14 rounded-xl bg-white shadow-sm border border-slate-200/80 flex items-center justify-center mx-auto"
                  style={{ color: TEAL }}
                >
                  <Upload size={28} strokeWidth={1.75} />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-800">Click to upload or drag and drop</p>
                <p className="text-xs text-slate-500 mt-1">PDF, DOCX up to 10MB where accepted by your institution</p>
                {file && (
                  <p className="text-xs font-semibold mt-3 truncate max-w-full px-2" style={{ color: TEAL }}>
                    Selected: {file.name}
                  </p>
                )}
              </div>

              <div className="mt-8 flex justify-end">
                <Button
                  onClick={uploadReport}
                  disabled={uploading || !file}
                  className="!rounded-[10px] !px-8 !py-3 !bg-[#006D6D] hover:!bg-[#005a5a] !text-white border-0"
                >
                  {uploading ? 'Uploading…' : 'Submit report'}
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-[#1a1a1a] flex items-center gap-2">
                  <FileText size={20} style={{ color: TEAL }} strokeWidth={1.75} />
                  Submission history
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F8F9FA] text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Report</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 hidden md:table-cell">Comments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                          Loading…
                        </td>
                      </tr>
                    ) : reports.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                          No reports submitted yet.
                        </td>
                      </tr>
                    ) : (
                      reports.map((report) => (
                        <tr key={report.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-900 truncate">{report.title}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{report.report_type}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600 tabular-nums hidden sm:table-cell">
                            {report.submitted_at?.split('T')[0]}
                          </td>
                          <td className="px-4 py-3">
                            {report.reviewed ? (
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
                            ) : (
                              <span className="text-xs font-semibold text-sky-800 bg-sky-100 px-2.5 py-1 rounded-full">
                                Under review
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs hidden md:table-cell">
                            {report.review_comments ? (
                              <span className="line-clamp-2">{report.review_comments}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div
              className="rounded-xl p-5 text-white shadow-md"
              style={{ background: `linear-gradient(160deg, ${TEAL} 0%, #0a4d4d 100%)` }}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-white/80">Submission guide</p>
              <ul className="mt-4 space-y-3 text-sm text-white/95">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  Use clear filenames and your department&apos;s style guide (e.g. APA) if required.
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  Include cover page and signatures where your program requires them.
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  Submit before the deadline to stay on track for milestones.
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Your supervisor</p>
              {studentGroup?.supervisor ? (
                <>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: TEAL }}
                    >
                      {studentGroup.supervisor
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{studentGroup.supervisor}</p>
                      <p className="text-xs text-slate-500">{studentGroup.department || 'Supervisor'}</p>
                    </div>
                  </div>
                  <Link to="/messages" className="mt-4 block">
                    <Button
                      variant="outline"
                      className="w-full !rounded-[10px] !bg-[#006D6D]/10 !border-[#006D6D]/30 !text-[#006D6D] hover:!bg-[#006D6D]/15"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Contact supervisor
                    </Button>
                  </Link>
                </>
              ) : (
                <p className="text-sm text-slate-500">Supervisor will appear here once assigned to your group.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
