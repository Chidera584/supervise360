import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../lib/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Users, Calendar, MessageCircle, FileText, 
  Eye, Star, Clock, CheckCircle, AlertCircle 
} from 'lucide-react';

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
      if (res.success && res.data) setGroups(res.data as SupervisorGroup[]);
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
  const avgProgress = groups.length > 0
    ? Math.round(groups.reduce((s, g) => s + (g.project?.progress_percentage ?? 0), 0) / groups.length)
    : 0;

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
        {/* Header */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#1a237e]">My Supervised Groups</h2>
              <p className="text-gray-600 mt-1">
                Manage and monitor your assigned project groups
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Current Load</div>
              <div className="text-2xl font-bold text-[#1a237e]">
                {groups.length} / {supervisor?.max_capacity || 7}
              </div>
            </div>
          </div>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Groups</p>
                <p className="text-2xl font-bold text-[#1a237e]">
                  {groups.filter(g => g.status === 'active').length}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Reports Pending</p>
                <p className="text-2xl font-bold text-[#1a237e]">
                  {totalReportsPending}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Calendar className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Reports Reviewed</p>
                <p className="text-2xl font-bold text-[#1a237e]">
                  {groups.reduce((s, g) => s + g.reportsReviewed, 0)}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Star className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Progress</p>
                <p className="text-2xl font-bold text-[#1a237e]">
                  {avgProgress}%
                </p>
              </div>
            </div>
          </Card>
        </div>
        {/* Groups List */}
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.id} id={`group-card-${group.id}`}>
            <Card>
              <div className="space-y-4">
                {/* Group Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-[#1a237e]">{group.name}</h3>
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(group.status)}`}>
                        {getStatusIcon(group.status)}
                        {group.status.charAt(0).toUpperCase() + group.status.slice(1)}
                      </div>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      {group.project?.title || 'No project yet'}
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {group.project?.submitted_at && (
                        <>
                          <span>Submitted: {new Date(group.project.submitted_at).toLocaleDateString()}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>{group.members.length} members</span>
                      {group.department && (
                        <>
                          <span>•</span>
                          <span>{group.department}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => document.getElementById(`group-card-${group.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                      <Eye className="mr-2" size={14} />
                      View Details
                    </Button>
                    <Button onClick={() => navigate('/messages', { state: { groupId: group.id, groupName: group.name } })}>
                      <MessageCircle className="mr-2" size={14} />
                      Message Group
                    </Button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Project Progress</span>
                    <span>{group.project?.progress_percentage ?? 0}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-2 bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300"
                      style={{ width: `${group.project?.progress_percentage ?? 0}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Group Members */}
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Group Members</h5>
                    <div className="space-y-2">
                      {Array.isArray(group.members) ? group.members.map((member, index) => (
                        <div key={member.id ?? index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-xs">
                              {member.name.split(' ').map((n: string) => n[0]).join('')}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <span>{member.matricNumber || 'N/A'}</span>
                              {member.gpa != null && <span>• GPA: {member.gpa}</span>}
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="p-2 text-gray-500 text-sm">No members data available</div>
                      )}
                    </div>
                  </div>

                  {/* Reports */}
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Reports</h5>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">Submitted</span>
                        <span className="font-semibold">{group.reportsTotal}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">Reviewed</span>
                        <span className="font-semibold text-green-600">{group.reportsReviewed}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <span className="text-sm text-gray-600">Pending Review</span>
                        <span className="font-semibold text-amber-600">{group.reportsPending}</span>
                      </div>
                    </div>
                  </div>

                  {/* Group Stats */}
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Group Info</h5>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">Department</span>
                        <span className="font-semibold">{group.department || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  <Button variant="outline" onClick={() => navigate('/messages', { state: { groupId: group.id, groupName: group.name } })}>
                    <Calendar className="mr-2" size={14} />
                    Schedule Meeting
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/report-reviews', { state: { groupId: group.id } })}>
                    <FileText className="mr-2" size={14} />
                    Review Reports {group.reportsPending > 0 && `(${group.reportsPending})`}
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/evaluations', { state: { groupId: group.id } })}>
                    <Star className="mr-2" size={14} />
                    Grade Work
                  </Button>
                </div>
              </div>
            </Card>
            </div>
          ))}
        </div>

        {/* Empty State */}
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