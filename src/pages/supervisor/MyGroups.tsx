import { useState, useEffect } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useGroups } from '../../contexts/GroupsContext';
import { 
  Users, Calendar, MessageCircle, FileText, 
  Eye, Star, Clock, CheckCircle, AlertCircle 
} from 'lucide-react';

export function MyGroups() {
  const { user, supervisor } = useAuth();
  const { groups } = useGroups();
  const [loading, setLoading] = useState(false);

  // Find groups assigned to this supervisor
  const supervisorGroups = groups.filter(group => 
    group.supervisor && group.supervisor.toLowerCase().includes(user?.first_name?.toLowerCase() || '') &&
    group.supervisor.toLowerCase().includes(user?.last_name?.toLowerCase() || '')
  );

  // Convert to the format expected by the existing UI
  const formattedGroups = supervisorGroups.map(group => ({
    id: group.id,
    name: group.name,
    project: group.project || 'Agree on a topic with your supervisor and get approval from the Project Coordinator',
    status: group.status,
    progress: Math.floor(Math.random() * 100), // Random progress for demo
    members: Array.isArray(group.members) ? group.members.map(member => ({
      name: member.name,
      matric: member.matricNumber,
      role: 'Member'
    })) : [],
    lastMeeting: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    nextMeeting: new Date(Date.now() + Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    reportsSubmitted: Math.floor(Math.random() * 8),
    totalReports: 10,
    avgGrade: ['A', 'A-', 'B+', 'B', 'B-'][Math.floor(Math.random() * 5)],
    startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    deadline: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }));

  useEffect(() => {
    // No need to simulate loading since we're using real data
    setLoading(false);
  }, []);

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
                {formattedGroups.length} / {supervisor?.max_capacity || 7}
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
                  {formattedGroups.filter(g => g.status === 'active').length}
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
                  {formattedGroups.reduce((sum, g) => sum + (g.totalReports - g.reportsSubmitted), 0)}
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
                <p className="text-sm text-gray-600">Meetings This Week</p>
                <p className="text-2xl font-bold text-[#1a237e]">
                  {formattedGroups.filter(g => {
                    const nextMeeting = new Date(g.nextMeeting);
                    const now = new Date();
                    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    return nextMeeting >= now && nextMeeting <= weekFromNow;
                  }).length}
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
                  {formattedGroups.length > 0 ? Math.round(formattedGroups.reduce((sum, g) => sum + g.progress, 0) / formattedGroups.length) : 0}%
                </p>
              </div>
            </div>
          </Card>
        </div>
        {/* Groups List */}
        <div className="space-y-6">
          {formattedGroups.map((group) => (
            <Card key={group.id}>
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
                    <h4 className="font-medium text-gray-900 mb-2">{group.project}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Started: {new Date(group.startDate).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Deadline: {new Date(group.deadline).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{group.members.length} members</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline">
                      <Eye className="mr-2" size={14} />
                      View Details
                    </Button>
                    <Button>
                      <MessageCircle className="mr-2" size={14} />
                      Message Group
                    </Button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Project Progress</span>
                    <span>{group.progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-2 bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300"
                      style={{ width: `${group.progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Group Members */}
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Group Members</h5>
                    <div className="space-y-2">
                      {Array.isArray(group.members) ? group.members.map((member, index) => (
                        <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-xs">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                            <p className="text-xs text-gray-600">{member.role}</p>
                          </div>
                        </div>
                      )) : (
                        <div className="p-2 text-gray-500 text-sm">No members data available</div>
                      )}
                    </div>
                  </div>

                  {/* Meeting Schedule */}
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Meeting Schedule</h5>
                    <div className="space-y-3">
                      <div className="p-3 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar size={14} className="text-gray-600" />
                          <span className="text-sm font-medium text-gray-900">Last Meeting</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {new Date(group.lastMeeting).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="p-3 border border-blue-200 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar size={14} className="text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">Next Meeting</span>
                        </div>
                        <p className="text-sm text-blue-800">
                          {new Date(group.nextMeeting).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Performance</h5>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">Reports Submitted</span>
                        <span className="font-semibold">{group.reportsSubmitted}/{group.totalReports}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">Average Grade</span>
                        <span className="font-semibold text-green-600">{group.avgGrade}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  <Button variant="outline">
                    <Calendar className="mr-2" size={14} />
                    Schedule Meeting
                  </Button>
                  <Button variant="outline">
                    <FileText className="mr-2" size={14} />
                    Review Reports
                  </Button>
                  <Button variant="outline">
                    <Star className="mr-2" size={14} />
                    Grade Submissions
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {formattedGroups.length === 0 && (
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