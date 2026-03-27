import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '../components/Layout/MainLayout';
import { Button } from '../components/UI/Button';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { Link } from 'react-router-dom';
import {
  Users,
  FileText,
  UserCheck,
  Shield,
  Clock,
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
} from 'lucide-react';

const TEAL = '#006D6D';
const PURPLE = '#7c3aed';

export function StudentDashboard() {
  const { user, student } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [reportsCount, setReportsCount] = useState(0);
  const [reportsReviewedCount, setReportsReviewedCount] = useState(0);
  const [inboxPreview, setInboxPreview] = useState<any[]>([]);
  const [studentGroup, setStudentGroup] = useState<any | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [myGroupRes, reportsRes, inboxRes] = await Promise.all([
          apiClient.getMyGroup(),
          apiClient.getMyReports(),
          apiClient.getInbox(),
        ]);

        if (myGroupRes.success && myGroupRes.data) {
          setStudentGroup(myGroupRes.data);
        } else {
          setStudentGroup(null);
        }

        if (reportsRes.success && Array.isArray(reportsRes.data)) {
          const reports = reportsRes.data as any[];
          setReportsList(reports);
          setReportsCount(reports.length);
          setReportsReviewedCount(reports.filter((r: any) => r.reviewed).length);
        }
        if (inboxRes.success && Array.isArray(inboxRes.data)) {
          const inbox = inboxRes.data as any[];
          setInboxPreview(inbox.slice(0, 4));
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const milestones = useMemo(() => {
    const hasSubmitted = (t: string) =>
      reportsList.some(
        (r) =>
          String(r.report_type || '').toLowerCase() === t.toLowerCase() && !!r.submitted_at
      );
    const proposalDone = hasSubmitted('proposal');
    const finalDone = hasSubmitted('final');
    const progressN = reportsList.filter(
      (r) => String(r.report_type || '').toLowerCase() === 'progress' && !!r.submitted_at
    ).length;
    const steps = [
      { id: 'proposal', label: 'Proposal', done: proposalDone },
      { id: 'progress1', label: 'Progress #1', done: progressN >= 1 },
      { id: 'progress2', label: 'Progress #2', done: progressN >= 2 },
      { id: 'final', label: 'Final submission', done: finalDone },
    ];
    const firstIncomplete = steps.findIndex((s) => !s.done);
    return steps.map((s, i) => {
      if (s.done) return { ...s, state: 'done' as const };
      if (firstIncomplete === -1) return { ...s, state: 'done' as const };
      return { ...s, state: i === firstIncomplete ? ('current' as const) : ('pending' as const) };
    });
  }, [reportsList]);

  const progressPct = reportsCount > 0 ? Math.round((reportsReviewedCount / reportsCount) * 100) : 0;

  if (loading) {
    return (
      <MainLayout title="Student Dashboard">
        <div className="flex items-center justify-center h-64 text-slate-500">Loading…</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Student Dashboard">
      <div className="space-y-8 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">Student dashboard</h1>
            <p className="text-slate-500 mt-1">
              Welcome back, <span className="font-semibold text-slate-700">{user?.first_name}</span>
              {student?.matric_number ? (
                <span className="text-slate-400"> · Matric {student.matric_number}</span>
              ) : null}
            </p>
          </div>
          <Link
            to="/reports"
            className="text-sm font-semibold shrink-0 inline-flex items-center gap-1"
            style={{ color: TEAL }}
          >
            Submit work <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-emerald-700" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Group status</p>
              <p className="text-lg font-bold mt-1" style={{ color: TEAL }}>
                {studentGroup ? 'Assigned' : 'Not assigned'}
              </p>
              <p className="text-sm text-slate-600 mt-0.5 truncate">
                {studentGroup ? studentGroup.name : 'Awaiting administrator'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 flex gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${TEAL}18` }}
            >
              <FileText className="w-5 h-5" style={{ color: TEAL }} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reports status</p>
              <p className="text-lg font-bold text-[#1a1a1a] mt-1 tabular-nums">
                {reportsReviewedCount} / {reportsCount || '—'}
              </p>
              <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progressPct}%`, backgroundColor: TEAL }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Reviewed submissions</p>
            </div>
          </div>

          <div
            className="rounded-xl border border-slate-200/80 p-5 text-white shadow-md flex flex-col justify-between min-h-[120px]"
            style={{ background: `linear-gradient(145deg, ${TEAL} 0%, #0a4d4d 100%)` }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Next milestone</p>
              <p className="text-lg font-bold mt-1">
                {milestones.find((m) => m.state === 'current')?.label || 'Progress report'}
              </p>
            </div>
            <p className="text-sm text-white/90">Keep momentum—submit updates on schedule.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-5">
                <h2 className="text-lg font-bold text-[#1a1a1a]">Group snapshot</h2>
                <Link to="/my-group" className="text-sm font-semibold" style={{ color: TEAL }}>
                  View all details
                </Link>
              </div>
              {studentGroup ? (
                <div className="space-y-6">
                  {studentGroup.supervisor && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-slate-100 bg-[#F8F9FA]">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: TEAL }}
                      >
                        <UserCheck className="w-6 h-6" strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#1a1a1a]">{studentGroup.supervisor}</p>
                        <p className="text-sm text-slate-500">Project supervisor</p>
                      </div>
                      <Link to="/messages">
                        <Button className="!rounded-[10px] w-full sm:w-auto whitespace-nowrap !bg-[#006D6D] hover:!bg-[#005a5a] !text-white border-0">
                          <Mail className="w-4 h-4 mr-2" />
                          Quick contact
                        </Button>
                      </Link>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-3">
                      Members ({Array.isArray(studentGroup.members) ? studentGroup.members.length : 0})
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {Array.isArray(studentGroup.members) ? (
                        studentGroup.members.map((member, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white"
                          >
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ backgroundColor: `${TEAL}` }}
                            >
                              {member.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">{member.name}</p>
                              <p className="text-xs text-slate-500">{member.matricNumber ?? '—'}</p>
                            </div>
                            {(member.matricNumber ?? (member as any).matric) === student?.matric_number && (
                              <span
                                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: `${TEAL}20`, color: TEAL }}
                              >
                                You
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No member data.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500">
                  <Users className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                  <p className="font-medium text-slate-800">No group assigned yet</p>
                  <p className="text-sm mt-1">Your administrator will place you in a group when ready.</p>
                </div>
              )}
            </div>

            {/* Milestones */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#1a1a1a]">Project milestones</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Track progress toward final submission</p>
                </div>
                <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 uppercase tracking-wide">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Done
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PURPLE }} /> Current
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-300" /> Pending
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {milestones.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl border p-4 flex flex-col gap-2 ${
                      m.state === 'done'
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : m.state === 'current'
                          ? 'border-violet-200 bg-violet-50/60'
                          : 'border-slate-200 bg-slate-50/80 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {m.state === 'done' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : m.state === 'current' ? (
                        <Clock className="w-5 h-5" style={{ color: PURPLE }} />
                      ) : (
                        <Lock className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <p className="font-semibold text-[#1a1a1a]">{m.label}</p>
                    <p className="text-xs text-slate-500">
                      {m.state === 'done' ? 'Completed' : m.state === 'current' ? 'In progress' : 'Locked'}
                    </p>
                    {m.state === 'current' && (
                      <Link to="/reports">
                        <Button className="mt-2 w-full !text-xs !font-bold !uppercase !tracking-wide !py-2 !bg-violet-600 hover:!bg-violet-700 !text-white border-0">
                          Submit now
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 sm:p-6 h-full flex flex-col">
              <h2 className="text-lg font-bold text-[#1a1a1a] mb-4">Recent activity</h2>
              <ul className="space-y-4 flex-1">
                {inboxPreview.length === 0 ? (
                  <li className="text-sm text-slate-500 py-6 text-center">No messages yet.</li>
                ) : (
                  inboxPreview.map((msg) => (
                    <li key={msg.id} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                      <p className="text-[#1a1a1a] font-medium text-sm line-clamp-2">{msg.subject}</p>
                      <p className="text-xs text-slate-400 mt-1">Inbox · {msg.sent_at?.split('T')[0]}</p>
                    </li>
                  ))
                )}
              </ul>
              <Link to="/messages" className="mt-4 block w-full">
                <Button variant="outline" className="w-full !rounded-[10px] font-semibold border-slate-200">
                  Go to inbox
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
