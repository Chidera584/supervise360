import { useEffect, useState } from 'react';
import { MainLayout } from '../components/Layout/MainLayout';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { useAuth } from '../contexts/AuthContext';
import { useGroups } from '../contexts/GroupsContext';
import { apiClient } from '../lib/api';
import { Users, FileText, MessageSquare, CheckCircle, Calendar, Eye } from 'lucide-react';

export function SupervisorDashboard() {
  const { user, supervisor } = useAuth();
  const { groups } = useGroups();
  const [students, setStudents] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Find groups assigned to this supervisor
  const supervisorGroups = groups.filter(group => 
    group.supervisor && group.supervisor.toLowerCase().includes(user?.first_name?.toLowerCase() || '') &&
    group.supervisor.toLowerCase().includes(user?.last_name?.toLowerCase() || '')
  );

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch students and supervisors data
      const [studentsResponse, supervisorsResponse] = await Promise.all([
        apiClient.getStudents(),
        apiClient.getSupervisors()
      ]);

      if (studentsResponse.success) {
        setStudents(studentsResponse.data || []);
      }

      if (supervisorsResponse.success) {
        setSupervisors(supervisorsResponse.data || []);
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

  const availableSlots = (supervisor?.max_capacity || 7) - supervisorGroups.length;
  const workloadPercentage = supervisor?.max_capacity ? Math.round((supervisorGroups.length / supervisor.max_capacity) * 100) : 0;

  return (
    <MainLayout title="Supervisor Dashboard">
      <div className="space-y-6">
        {/* Supervisor Information Card */}
        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">Supervisor Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="font-medium">{user?.first_name} {user?.last_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Department</p>
              <p className="font-medium">{user?.department || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Load</p>
              <p className="font-medium">{supervisorGroups.length} / {supervisor?.max_capacity || 7} groups</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Available Slots</p>
              <p className="font-medium text-green-600">{availableSlots} slots</p>
            </div>
          </div>
          
          {/* Workload Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Workload</span>
              <span>{workloadPercentage}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full">
              <div
                className={`h-2 rounded-full ${
                  workloadPercentage > 80 ? 'bg-red-500' : 
                  workloadPercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(workloadPercentage, 100)}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Assigned Groups</p>
                <p className="text-2xl font-bold text-[#1a237e]">{supervisorGroups.length}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <FileText className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Reviews</p>
                <p className="text-2xl font-bold text-[#1a237e]">0</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Messages</p>
                <p className="text-2xl font-bold text-[#1a237e]">0</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-[#1a237e]">0</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Contact Information */}
        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">Contact Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
          </div>
        </Card>

        {/* Assigned Groups */}
        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">My Assigned Groups</h2>
          {supervisorGroups.length > 0 ? (
            <div className="space-y-4">
              {supervisorGroups.map((group) => (
                <div key={group.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          group.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {group.status === 'active' ? 'Active' : 'Formed'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {group.members.length} members • Department: {group.department || user?.department}
                      </p>
                      <p className="text-sm text-gray-600">
                        Project: {group.project || "Agree on a topic with your supervisor and get approval from the Project Coordinator"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline">
                        <Eye className="mr-2" size={14} />
                        View Details
                      </Button>
                      <Button>
                        <MessageSquare className="mr-2" size={14} />
                        Message Group
                      </Button>
                    </div>
                  </div>

                  {/* Group Members */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Group Members</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {Array.isArray(group.members) ? group.members.map((member, index) => (
                        <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-xs">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                            <p className="text-xs text-gray-600">{member.matricNumber}</p>
                          </div>
                        </div>
                      )) : (
                        <div className="col-span-3 p-2 text-gray-500 text-sm">No members data available</div>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-3 pt-3 mt-3 border-t border-gray-200">
                    <Button variant="outline">
                      <Calendar className="mr-2" size={14} />
                      Schedule Meeting
                    </Button>
                    <Button variant="outline">
                      <FileText className="mr-2" size={14} />
                      Review Reports
                    </Button>
                    <Button variant="outline">
                      <CheckCircle className="mr-2" size={14} />
                      Grade Work
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Groups Assigned</h3>
              <p className="text-gray-600 mb-4">
                You haven't been assigned any groups yet. Groups will be assigned by the administrator after formation.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
                <ul className="text-sm text-blue-800 space-y-1 text-left">
                  <li>• Admin will form groups and assign supervisors</li>
                  <li>• You'll see your assigned groups here automatically</li>
                  <li>• Each group typically has 3 students</li>
                  <li>• Check back here regularly for updates</li>
                </ul>
              </div>
              <Button variant="outline">Contact Administrator</Button>
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button className="w-full" disabled={supervisorGroups.length === 0}>
              <Users className="mr-2" size={16} />
              View My Groups ({supervisorGroups.length})
            </Button>
            <Button variant="outline" className="w-full">
              <FileText className="mr-2" size={16} />
              Review Reports
            </Button>
            <Button variant="outline" className="w-full">
              <MessageSquare className="mr-2" size={16} />
              Send Message
            </Button>
          </div>
        </Card>

        {/* System Status */}
        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">System Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Total Students</h3>
              <p className="text-2xl font-bold text-blue-600">{students.length}</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Total Supervisors</h3>
              <p className="text-2xl font-bold text-green-600">{supervisors.length}</p>
            </div>
          </div>
        </Card>

        {/* Welcome Message */}
        <Card>
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-[#1a237e] mb-2">
              Welcome to Supervise360, {user?.first_name}!
            </h2>
            <p className="text-gray-600 mb-4">
              Your supervision management system is ready. You can manage your assigned groups, 
              review student reports, and track project progress all in one place.
            </p>
            <div className="flex justify-center gap-4">
              <Button>Get Started</Button>
              <Button variant="outline">View Tutorial</Button>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}