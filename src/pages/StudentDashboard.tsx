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
      <MainLayout title="Student Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Student Dashboard">
      <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 lg:-m-6">
        {/* Hero Section - Full-width blue header */}
        <div className="relative bg-[#022B3A] px-4 sm:px-6 pt-6 sm:pt-8 pb-20 sm:pb-24 text-white">
          <h1 className="text-2xl md:text-3xl font-bold">
            Welcome, {user?.first_name}
          </h1>
          <p className="text-[#BFDBF7] mt-1">
            {student?.matric_number ? `Matric: ${student.matric_number}` : user?.department || 'Student Portal'}
          </p>
        </div>

        {/* Floating Cards - Overlap hero with soft shadow */}
        <div className="relative -mt-12 sm:-mt-16 px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 w-full">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100/80 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1F7A8C]/10 flex items-center justify-center shrink-0">
                  <Users className="text-[#1F7A8C]" size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Group Status</p>
                  <p className="text-xl font-bold text-[#022B3A] mt-0.5">
                    {studentGroup ? studentGroup.name : 'Not Assigned'}
                  </p>
                  {studentGroup && (
                    <p className="text-xs text-slate-400 mt-1">Assigned</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100/80 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1F7A8C]/10 flex items-center justify-center shrink-0">
                  <FileText className="text-[#1F7A8C]" size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Reports</p>
                  <p className="text-xl font-bold text-[#022B3A] mt-0.5">{reportsCount}</p>
                  {reportsCount > 0 && (
                    <p className="text-xs text-slate-400 mt-1">{reportsReviewedCount} reviewed</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100/80 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1F7A8C]/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="text-[#1F7A8C]" size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Messages</p>
                  <p className="text-xl font-bold text-[#022B3A] mt-0.5">{inboxCount}</p>
                  <p className="text-xs text-slate-400 mt-1">In inbox</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Light background */}
        <div className="mt-6 px-4 sm:px-6 pb-8 sm:pb-12 bg-gradient-to-b from-slate-50 to-white min-h-[40vh]">
          <div className="w-full space-y-6">
            {/* Group Information */}
            <Card className="rounded-2xl shadow-sm border-slate-100">
              <h2 className="text-lg font-semibold text-[#022B3A] mb-4">Group Information</h2>
              {studentGroup ? (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-[#E1E5F2]/50 border border-[#BFDBF7]/50 rounded-xl">
                    <div className="min-w-0">
                      <p className="font-medium text-[#022B3A]">You are assigned to {studentGroup.name}</p>
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
                          <div className="w-10 h-10 bg-[#1F7A8C] rounded-full flex items-center justify-center shrink-0">
                            <span className="text-white font-semibold text-sm">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{member.name}</p>
                            <p className="text-xs text-slate-500">{member.matricNumber ?? 'N/A'}</p>
                          </div>
                          {(member.matricNumber ?? (member as any).matric) === student?.matric_number && (
                            <span className="text-xs bg-[#1F7A8C]/15 text-[#1F7A8C] px-2 py-1 rounded-full font-medium">You</span>
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
                      <div className="flex items-center gap-4 p-4 bg-[#E1E5F2]/50 border border-[#BFDBF7]/50 rounded-xl">
                        <div className="w-12 h-12 bg-[#1F7A8C] rounded-full flex items-center justify-center shrink-0">
                          <UserCheck className="text-white" size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-[#022B3A]">{studentGroup.supervisor}</p>
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
      </div>
    </MainLayout>
  );
}
