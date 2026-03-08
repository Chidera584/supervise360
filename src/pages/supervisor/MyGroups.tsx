import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../lib/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Users, Calendar, MessageCircle, FileText, 
  Star, Clock, CheckCircle, AlertCircle 
} from 'lucide-react';
import { stripGroupName, stripProjectTitle, sortGroupsByNumber } from '../../utils/supervisorDisplay';

interface SupervisorGroup {
  id: number;
  name: string;
  department?: string;
  status: string;
  avg_gpa?: number;
  supervisor?: string;
  members: { id: number; name: string; gpa?: number; matricNumber?: string }[];
  project: { id: number; title: string; status?: string; progress_percentage?: number; submitted_at?: string } | null;
  reportsTotal: number;
  reportsReviewed: number;
  reportsPending: number;
}

export function MyGroups() {
  const { user, supervisor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [groups, setGroups] = useState<SupervisorGroup[]>([]);
  const hasScrolledToGroup = useRef(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const res = await apiClient.getSupervisorMyGroups();
      if (res.success && res.data) {
        const raw = res.data as SupervisorGroup[];
        setGroups(sortGroupsByNumber(raw));
      }
      setLoading(false);
    };
    fetch();
  }, []);

  // Scroll to group when navigated from Dashboard with state.groupId
  useEffect(() => {
    const state = location.state as { groupId?: number } | null;
    if (state?.groupId && !loading && !hasScrolledToGroup.current) {
      const el = document.getElementById(`group-card-${state.groupId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        hasScrolledToGroup.current = true;
      }
    }
  }, [loading, location.state]);

  const totalReportsPending = groups.reduce((s, g) => s + g.reportsPending, 0);

  if (loading) {
    return (
      <MainLayout title="My Groups">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading groups...</div>
        </div>
      </MainLayout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'planning': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle size={16} className="text-green-600" />;
      case 'planning': return <Clock size={16} className="text-blue-600" />;
      case 'completed': return <Star size={16} className="text-gray-600" />;
      default: return <AlertCircle size={16} className="text-gray-600" />;
    }
  };

  return (
    <MainLayout title="My Groups">
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Supervised Groups</h1>
            <p className="text-slate-600 mt-0.5">Manage and monitor your assigned project groups</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-slate-500">Assigned groups</p>
              <p className="text-2xl font-bold text-[#022B3A]">{groups.length}</p>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5 border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#1F7A8C]/10 flex items-center justify-center">
                <Users className="text-[#1F7A8C]" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Active groups</p>
                <p className="text-xl font-bold text-slate-900">{groups.filter(g => g.status === 'active').length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <FileText className="text-amber-700" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Reports pending review</p>
                <p className="text-xl font-bold text-slate-900">{totalReportsPending}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="text-emerald-700" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Reports reviewed</p>
                <p className="text-xl font-bold text-slate-900">{groups.reduce((s, g) => s + g.reportsReviewed, 0)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Groups list */}
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-slate-900">Groups</h2>
          {groups.map((group) => (
            <Card key={group.id} id={`group-card-${group.id}`} className="border border-slate-200 overflow-hidden">
              {/* Group header row */}
              <div className="p-5 pb-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-slate-900">{stripGroupName(group.name)}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(group.status)}`}>
                        {getStatusIcon(group.status)}
                        {group.status.charAt(0).toUpperCase() + group.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{group.project ? stripProjectTitle(group.project.title, group.name) : 'No project yet'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {group.members.length} members
                      {group.project?.submitted_at && ` · Submitted ${new Date(group.project.submitted_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" onClick={() => navigate('/messages', { state: { groupId: group.id, groupName: group.name } })}>
                      <MessageCircle className="mr-2" size={14} />
                      Message
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate('/report-reviews', { state: { groupId: group.id } })}>
                      <FileText className="mr-2" size={14} />
                      Reports {group.reportsPending > 0 && `(${group.reportsPending})`}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate('/evaluations', { state: { groupId: group.id, groupName: group.name } })}>
                      <Star className="mr-2" size={14} />
                      Grade Work
                    </Button>
                  </div>
                </div>
              </div>

              {/* Report stats inline */}
              <div className="px-5 py-3 flex flex-wrap gap-6 border-b border-slate-100 text-sm">
                <span className="flex items-center gap-1.5">
                  <FileText size={16} className="text-slate-400" />
                  <span className="text-slate-600">{group.reportsTotal} submitted</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle size={16} className="text-emerald-500" />
                  <span className="text-slate-600">{group.reportsReviewed} reviewed</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={16} className="text-amber-500" />
                  <span className="text-slate-600">{group.reportsPending} pending</span>
                </span>
              </div>

              {/* Members */}
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Members</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.isArray(group.members) ? group.members.map((member, index) => (
                    <div
                      key={member.id ?? index}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#1F7A8C] flex items-center justify-center shrink-0">
                        <span className="text-white font-medium text-sm">
                          {member.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{member.name}</p>
                        <p className="text-xs text-slate-500">{member.matricNumber || '—'}</p>
                        {member.gpa != null && <p className="text-xs text-slate-600">GPA: {member.gpa}</p>}
                      </div>
                    </div>
                  )) : (
                    <p className="col-span-full text-sm text-slate-500">No members data</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty state */}
        {groups.length === 0 && (
          <Card>
            <div className="text-center py-12">
              <Users className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Groups Assigned</h3>
              <p className="text-gray-600 mb-6">
                You haven't been assigned any groups yet. Groups will appear here once assigned by the administrator.
              </p>
              <Button variant="outline">Contact Administrator</Button>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}