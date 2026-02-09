import { MainLayout } from '../components/Layout/MainLayout';
import { Card } from '../components/UI/Card';
import { useAuth } from '../contexts/AuthContext';
import { useGroups } from '../contexts/GroupsContext';
import { Users, UserCheck, Building } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';

export function AdminDashboard() {
  const { user } = useAuth();
  const { groups, syncWithDatabase } = useGroups();
  const [supervisorCount, setSupervisorCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load groups data on mount
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        console.log('🚀 AdminDashboard: Loading dashboard data...');
        // Sync groups data from database
        await syncWithDatabase();
        console.log('✅ AdminDashboard: Groups data loaded');
      } catch (error) {
        console.error('❌ AdminDashboard: Failed to load groups data:', error);
      }
    };

    loadDashboardData();
  }, [syncWithDatabase]);

  // Fetch real supervisor count from API (uploaded supervisors in supervisor_workload)
  useEffect(() => {
    const fetchSupervisorCount = async () => {
      try {
        const response = await apiClient.getSupervisorWorkload();
        if (response.success && response.data?.totalStats?.totalSupervisors !== undefined) {
          setSupervisorCount(response.data.totalStats.totalSupervisors);
        } else if (response.success && Array.isArray(response.data?.supervisors)) {
          setSupervisorCount(response.data.supervisors.length);
        }
      } catch (error) {
        console.error('Failed to fetch supervisor count:', error);
        // Fallback: calculate from groups data (assigned supervisors)
        const assignedSupervisors = new Set(groups.filter(g => g.supervisor).map(g => g.supervisor)).size;
        setSupervisorCount(assignedSupervisors);
      } finally {
        setLoading(false);
      }
    };

    fetchSupervisorCount();
  }, [groups]);

  // Calculate statistics from groups data
  const totalGroups = groups.length;
  const totalStudents = groups.reduce((total, group) => total + group.members.length, 0);
  const studentsWithGroups = totalStudents; // All students in groups have groups
  
  // Calculate supervisor statistics
  const assignedSupervisors = new Set(groups.filter(g => g.supervisor).map(g => g.supervisor)).size;
  const totalSupervisors = supervisorCount; // Use real count from API
  const availableSupervisors = Math.max(0, totalSupervisors - assignedSupervisors);

  return (
    <MainLayout title="Admin Dashboard">
      <div className="space-y-6">
        {/* Welcome Card */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#1a237e]">
                Welcome back, {user?.first_name}!
              </h2>
              <p className="text-gray-600 mt-1">
                Here's an overview of your Supervise360 system
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">System Status</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-600">Online</span>
              </div>
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
                <p className="text-sm text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-[#1a237e]">{totalStudents}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <UserCheck className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Supervisors</p>
                <p className="text-2xl font-bold text-[#1a237e]">
                  {loading ? '...' : totalSupervisors}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Building className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Groups</p>
                <p className="text-2xl font-bold text-[#1a237e]">{totalGroups}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <UserCheck className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Assigned Supervisors</p>
                <p className="text-2xl font-bold text-[#1a237e]">{assignedSupervisors}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Group and Assignment Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-lg font-semibold text-[#1a237e] mb-4">Group Overview</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Groups Formed</span>
                <span className="font-semibold">{totalGroups}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Students in Groups</span>
                <span className="font-semibold text-green-600">{studentsWithGroups}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Groups with Supervisors</span>
                <span className="font-semibold text-blue-600">{groups.filter(g => g.supervisor).length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Groups Awaiting Assignment</span>
                <span className="font-semibold text-orange-600">{groups.filter(g => !g.supervisor).length}</span>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#1a237e] mb-4">Supervisor Overview</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Available Supervisors</span>
                <span className="font-semibold text-green-600">{availableSupervisors}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Assigned Supervisors</span>
                <span className="font-semibold">{assignedSupervisors}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Average Groups per Supervisor</span>
                <span className="font-semibold text-blue-600">
                  {assignedSupervisors > 0 ? Math.round((totalGroups / assignedSupervisors) * 10) / 10 : 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Supervision Capacity Used</span>
                <span className="font-semibold text-purple-600">
                  {totalSupervisors > 0 ? Math.round((assignedSupervisors / totalSupervisors) * 100) : 0}%
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* System Information */}
        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">System Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Database Status</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-600">Connected</span>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Last Updated</h3>
              <p className="text-sm text-gray-600">{new Date().toLocaleString()}</p>
            </div>
          </div>
          
          {/* Demo Data Section - Only show if no groups exist */}
          {totalGroups === 0 && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Quick Start</h3>
              <p className="text-sm text-blue-800 mb-3">
                No groups have been formed yet. To see the dashboard in action, you can:
              </p>
              <ul className="text-sm text-blue-800 space-y-1 mb-3">
                <li>• Go to the Groups page to upload student CSV and form groups</li>
                <li>• Go to Supervisor Assignment to assign supervisors to groups</li>
                <li>• The dashboard will automatically update with real data</li>
              </ul>
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">Group Formation Status</h2>
          {totalGroups > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{totalGroups}</div>
                  <div className="text-sm text-blue-700">Groups Formed</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{groups.filter(g => g.supervisor).length}</div>
                  <div className="text-sm text-green-700">Supervisors Assigned</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{groups.filter(g => !g.supervisor).length}</div>
                  <div className="text-sm text-orange-700">Awaiting Assignment</div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-3">Recent Groups</h3>
                <div className="space-y-2">
                  {groups.slice(0, 5).map((group) => (
                    <div key={group.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{group.name}</p>
                        <p className="text-sm text-gray-600">
                          {group.members.length} members • {group.department || 'No department'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {group.supervisor || 'No supervisor'}
                        </p>
                        <p className={`text-xs ${group.supervisor ? 'text-green-600' : 'text-orange-600'}`}>
                          {group.supervisor ? 'Assigned' : 'Pending'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Building className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600">No groups have been formed yet.</p>
              <p className="text-sm text-gray-500 mt-2">
                Go to the Groups page to upload students and form groups using ASP algorithm.
              </p>
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}