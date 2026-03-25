import { useEffect, useState } from 'react';
import { MainLayout } from '../components/Layout/MainLayout';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { useAuth } from '../contexts/AuthContext';
import { useGroups } from '../contexts/GroupsContext';
import { apiClient } from '../lib/api';
import { Link } from 'react-router-dom';
import { Users, FileText, MessageSquare, UserCheck } from 'lucide-react';

export function StudentDashboard() {
  const { user, student } = useAuth();
  const { groups, syncWithDatabase } = useGroups();
  const [loading, setLoading] = useState(true);
  const [reportsCount, setReportsCount] = useState(0);
  const [reportsReviewedCount, setReportsReviewedCount] = useState(0);
  const [inboxCount, setInboxCount] = useState(0);

  const studentGroup = groups.find(group =>
    group.members.some(member => {
      const matric = member.matricNumber ?? (member as any).matric;
      return matric === student?.matric_number;
    })
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await syncWithDatabase();
        const [reportsRes, inboxRes] = await Promise.all([
          apiClient.getMyReports(),
          apiClient.getInbox(),
        ]);
        if (reportsRes.success && Array.isArray(reportsRes.data)) {
          const reports = reportsRes.data as any[];
          setReportsCount(reports.length);
          setReportsReviewedCount(reports.filter((r: any) => r.reviewed).length);
        }
        if (inboxRes.success && Array.isArray(inboxRes.data)) {
          setInboxCount((inboxRes.data as any[]).length);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [syncWithDatabase]);

  if (loading) {
    return (
      <MainLayout title="Student dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Student dashboard">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-700">Overview</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">
            Hello{user?.first_name ? `, ${user.first_name}` : ''}
          </h2>
          <p className="text-slate-600 mt-1 text-sm">
            {student?.matric_number ? `Matric ${student.matric_number}` : user?.department || 'Your workspace for supervision and submissions.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-900/5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
                <Users className="text-brand-700" size={20} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Group</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5 truncate">
                  {studentGroup ? studentGroup.name : 'Not assigned'}
                </p>
                {studentGroup && <p className="text-xs text-emerald-700 font-medium mt-1">Active</p>}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-900/5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
                <FileText className="text-violet-700" size={20} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Reports</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">{reportsCount}</p>
                {reportsCount > 0 && (
                  <p className="text-xs text-slate-500 mt-1">{reportsReviewedCount} reviewed</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border-0 bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-md shadow-brand-900/15">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <MessageSquare className="text-white" size={20} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-100">Inbox</p>
                <p className="text-lg font-bold mt-0.5 tabular-nums">{inboxCount}</p>
                <p className="text-xs text-brand-100/90 mt-1">Messages</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="rounded-xl border-slate-200/90">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Group information</h2>
            {studentGroup ? (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-brand-50/50 border border-brand-100/80 rounded-xl">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">You are assigned to {studentGroup.name}</p>
                      <p className="text-sm text-slate-600">Status: {studentGroup.status}</p>
                    </div>
                    <Link to="/my-group" className="shrink-0">
                      <Button className="w-full sm:w-auto">View Group Details</Button>
                    </Link>
                  </div>

                  <div>
                    <h3 className="font-medium text-slate-900 mb-3">Group Members ({Array.isArray(studentGroup.members) ? studentGroup.members.length : 0})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Array.isArray(studentGroup.members) ? studentGroup.members.map((member, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                          <div className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-white font-semibold text-sm">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{member.name}</p>
                            <p className="text-xs text-slate-500">{member.matricNumber ?? 'N/A'}</p>
                          </div>
                          {(member.matricNumber ?? (member as any).matric) === student?.matric_number && (
                            <span className="text-xs bg-brand-100 text-brand-800 px-2 py-1 rounded-full font-medium">You</span>
                          )}
                        </div>
                      )) : (
                        <div className="col-span-3 p-3 text-slate-500 text-sm">No members data available</div>
                      )}
                    </div>
                  </div>

                  {studentGroup.supervisor && (
                    <div>
                      <h3 className="font-medium text-slate-900 mb-3">Supervisor</h3>
                      <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
                        <div className="w-12 h-12 bg-brand-600 rounded-full flex items-center justify-center shrink-0">
                          <UserCheck className="text-white" size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{studentGroup.supervisor}</p>
                          <p className="text-sm text-slate-600">Project Supervisor</p>
                        </div>
                        <Link to="/messages">
                          <Button variant="outline" size="sm">
                            <MessageSquare className="mr-2" size={14} />
                            Contact
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No Group Assigned</h3>
                  <p className="text-slate-600">
                    Groups will be formed by the administrator. You'll be notified when assigned.
                  </p>
                </div>
              )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
