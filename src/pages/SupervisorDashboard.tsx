import { useEffect, useState } from 'react';
import { MainLayout } from '../components/Layout/MainLayout';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { Users, FileText, MessageSquare, CheckCircle, Eye } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { stripGroupName, stripProjectTitle, sortGroupsByNumber } from '../utils/supervisorDisplay';

interface SupervisorGroup {
  id: number;
  name: string;
  department?: string;
  status: string;
  avg_gpa?: number;
  supervisor?: string;
  members: { id: number; name: string; gpa?: number; matricNumber?: string }[];
  project: { id: number; title: string; status?: string; progress_percentage?: number } | null;
  reportsTotal: number;
  reportsReviewed: number;
  reportsPending: number;
}

export function SupervisorDashboard() {
  const { user, supervisor } = useAuth();
  const navigate = useNavigate();
  const [supervisorGroups, setSupervisorGroups] = useState<SupervisorGroup[]>([]);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [reportsReviewedCount, setReportsReviewedCount] = useState(0);
  const [inboxCount, setInboxCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const [myGroupsRes, inboxRes] = await Promise.all([
        apiClient.getSupervisorMyGroups(),
        apiClient.getInbox(),
      ]);
      if (myGroupsRes.success && Array.isArray(myGroupsRes.data)) {
        const groups = sortGroupsByNumber(myGroupsRes.data as SupervisorGroup[]);
        setSupervisorGroups(groups);
        setPendingReviewsCount(groups.reduce((s, g) => s + (g.reportsPending ?? 0), 0));
        setReportsReviewedCount(groups.reduce((s, g) => s + (g.reportsReviewed ?? 0), 0));
      } else if (!myGroupsRes.success) {
        const pendingRes = await apiClient.getPendingReportReviews().catch(() => ({ success: false, data: [] }));
        if (pendingRes.success && Array.isArray(pendingRes.data)) {
          setPendingReviewsCount((pendingRes.data as any[]).length);
        }
      }
      if (inboxRes.success && Array.isArray(inboxRes.data)) {
        setInboxCount((inboxRes.data as any[]).length);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout title="Supervisor Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Supervisor Dashboard">
      <div className="-m-6">
        {/* Hero Section - Full-width blue header */}
        <div className="relative bg-[#022B3A] px-6 pt-8 pb-24 text-white">
          <h1 className="text-2xl md:text-3xl font-bold">
            Welcome, {user?.first_name}
          </h1>
          <p className="text-[#BFDBF7] mt-1">
            {supervisorGroups.length} group{supervisorGroups.length !== 1 ? 's' : ''} assigned
          </p>
        </div>

        {/* Floating Cards */}
        <div className="relative -mt-16 px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100/80 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1F7A8C]/10 flex items-center justify-center shrink-0">
                  <Users className="text-[#1F7A8C]" size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Assigned Groups</p>
                  <p className="text-xl font-bold text-[#022B3A] mt-0.5">{supervisorGroups.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100/80 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1F7A8C]/10 flex items-center justify-center shrink-0">
                  <FileText className="text-[#1F7A8C]" size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Pending Reviews</p>
                  <p className="text-xl font-bold text-[#022B3A] mt-0.5">{pendingReviewsCount}</p>
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
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100/80 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1F7A8C]/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="text-[#1F7A8C]" size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Reports Reviewed</p>
                  <p className="text-xl font-bold text-[#022B3A] mt-0.5">{reportsReviewedCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="mt-6 px-6 pb-8 bg-gradient-to-b from-slate-50 to-white min-h-[50vh]">
          <div className="w-full space-y-6">
            <Card className="rounded-2xl shadow-sm border-slate-100">
              <h2 className="text-lg font-semibold text-[#022B3A] mb-4">My Assigned Groups</h2>
              {supervisorGroups.length > 0 ? (
                <div className="space-y-4">
                  {supervisorGroups.map((group) => (
                    <div key={group.id} className="border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow bg-white">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-slate-900">{stripGroupName(group.name)}</h3>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              group.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {group.status === 'active' ? 'Active' : 'Formed'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">
                            {group.members.length} members • {group.project ? stripProjectTitle(group.project.title, group.name) : 'No project yet'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link to="/my-groups" state={{ groupId: group.id, groupName: group.name }}>
                            <Button variant="outline" size="sm">
                              <Eye className="mr-2" size={14} />
                              View
                            </Button>
                          </Link>
                          <Button size="sm" onClick={() => navigate('/messages', { state: { groupId: group.id, groupName: group.name } })}>
                            <MessageSquare className="mr-2" size={14} />
                            Message
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/report-reviews', { state: { groupId: group.id } })}>
                            <FileText className="mr-2" size={14} />
                            Reports {group.reportsPending > 0 && `(${group.reportsPending})`}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/evaluations', { state: { groupId: group.id, groupName: group.name } })}>
                            <CheckCircle className="mr-2" size={14} />
                            Grade
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(group.members) && group.members.slice(0, 4).map((member, index) => (
                            <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
                              <div className="w-6 h-6 bg-[#1F7A8C] rounded-full flex items-center justify-center">
                                <span className="text-white text-xs font-medium">
                                  {member.name.split(' ').map(n => n[0]).join('')}
                                </span>
                              </div>
                              <span className="text-sm text-slate-700">{member.name}</span>
                            </div>
                          ))}
                          {group.members.length > 4 && (
                            <span className="text-sm text-slate-500 px-2 py-1">+{group.members.length - 4} more</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No Groups Assigned</h3>
                  <p className="text-slate-600 mb-4">Groups will be assigned by the administrator.</p>
                  <div className="bg-[#E1E5F2]/50 border border-[#BFDBF7]/50 rounded-xl p-4 max-w-md mx-auto text-left">
                    <ul className="text-sm text-slate-700 space-y-1">
                      <li>• Admin forms and assigns groups</li>
                      <li>• You'll see them here automatically</li>
                      <li>• Check back for updates</li>
                    </ul>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
