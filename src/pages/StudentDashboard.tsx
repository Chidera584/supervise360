import { useEffect, useState } from 'react';
import { MainLayout } from '../components/Layout/MainLayout';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { useAuth } from '../contexts/AuthContext';
import { useGroups } from '../contexts/GroupsContext';
import { Link } from 'react-router-dom';
import { Users, FileText, MessageSquare, BookOpen, Award, UserCheck, Calendar } from 'lucide-react';

export function StudentDashboard() {
  const { user, student } = useAuth();
  const { groups, syncWithDatabase } = useGroups();
  const [loading, setLoading] = useState(true);

  // Find the student's group - use matric number as primary identifier (unique)
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
      <div className="space-y-6">
        {/* Student Information Card */}
        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">Student Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="font-medium">{user?.first_name} {user?.last_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Matric Number</p>
              <p className="font-medium">{student?.matric_number || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Department</p>
              <p className="font-medium">{user?.department || 'Not specified'}</p>
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
                <p className="text-sm text-gray-600">Group Status</p>
                <p className="text-lg font-bold text-[#1a237e]">
                  {studentGroup ? 'Assigned' : 'Not Assigned'}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <BookOpen className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Project Status</p>
                <p className="text-lg font-bold text-[#1a237e]">Not Started</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <FileText className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Reports</p>
                <p className="text-lg font-bold text-[#1a237e]">0</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Messages</p>
                <p className="text-lg font-bold text-[#1a237e]">0</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Academic Information */}
        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">Academic Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Academic Year</p>
              <p className="font-medium">2024/2025</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Program</p>
              <p className="font-medium">Bachelor of Computer Science</p>
            </div>
          </div>
        </Card>

        {/* Group Information */}
        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">Group Information</h2>
          {studentGroup ? (
            <div className="space-y-6">
              {/* Group Overview */}
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <p className="font-medium text-green-800">You are assigned to {studentGroup.name}!</p>
                  <p className="text-sm text-green-600">Status: {studentGroup.status}</p>
                </div>
                <Link to="/my-group">
                  <Button>View Group Details</Button>
                </Link>
              </div>

              {/* Group Members */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Group Members ({Array.isArray(studentGroup.members) ? studentGroup.members.length : 0})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.isArray(studentGroup.members) ? studentGroup.members.map((member, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-xs">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                        <p className="text-xs text-gray-600">{member.matricNumber ?? 'N/A'}</p>
                      </div>
                      {(member.matricNumber ?? (member as any).matric) === student?.matric_number && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">You</span>
                      )}
                    </div>
                  )) : (
                    <div className="col-span-3 p-3 text-gray-500 text-sm">No members data available</div>
                  )}
                </div>
              </div>

              {/* Supervisor Information */}
              {studentGroup.supervisor && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Supervisor</h3>
                  <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                      <UserCheck className="text-white" size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-blue-900">{studentGroup.supervisor}</p>
                      <p className="text-sm text-blue-700">Project Supervisor</p>
                    </div>
                    <Button variant="outline">
                      <MessageSquare className="mr-2" size={14} />
                      Contact
                    </Button>
                  </div>
                </div>
              )}

              {/* Project Information */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Project</h3>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Project Title</p>
                  <p className="font-medium text-gray-900">
                    {studentGroup.project || "Agree on a topic with your supervisor and get approval from the Project Coordinator"}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline">
                  <Calendar className="mr-2" size={16} />
                  Schedule Meeting
                </Button>
                <Button variant="outline">
                  <FileText className="mr-2" size={16} />
                  Submit Report
                </Button>
                <Button variant="outline">
                  <MessageSquare className="mr-2" size={16} />
                  Group Chat
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Group Assigned</h3>
              <p className="text-gray-600 mb-4">
                You haven't been assigned to a group yet. Groups will be formed by the administrator based on academic performance and department.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
                <ul className="text-sm text-blue-800 space-y-1 text-left">
                  <li>• Groups are formed automatically by the admin</li>
                  <li>• You'll be notified when assigned to a group</li>
                  <li>• Each group will have 3 members and a supervisor</li>
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
            <Button className="w-full">
              <FileText className="mr-2" size={16} />
              Submit Report
            </Button>
            <Button variant="outline" className="w-full">
              <MessageSquare className="mr-2" size={16} />
              Contact Supervisor
            </Button>
            <Button variant="outline" className="w-full">
              <Award className="mr-2" size={16} />
              View Progress
            </Button>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">Recent Activity</h2>
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600">No recent activity to display.</p>
          </div>
        </Card>

        {/* Welcome Message */}
        <Card>
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-[#1a237e] mb-2">
              Welcome to Supervise360, {user?.first_name}!
            </h2>
            <p className="text-gray-600 mb-4">
              Your student portal is ready. Here you can track your project progress, 
              submit reports, communicate with your supervisor, and manage your academic journey.
            </p>
            <div className="flex justify-center gap-4">
              <Button>Get Started</Button>
              <Button variant="outline">View Guidelines</Button>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}