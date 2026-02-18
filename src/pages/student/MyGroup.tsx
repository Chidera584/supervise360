import { useState, useEffect } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../lib/api';
import { Users, Mail, UserCheck, RefreshCw } from 'lucide-react';

interface GroupMember {
  name: string;
  gpa?: number;
  tier?: string;
  matricNumber?: string;
}

interface GroupData {
  id: number;
  name: string;
  members: GroupMember[];
  supervisor: string | null;
  department?: string;
  avg_gpa?: number;
  status?: string;
}

export function MyGroup() {
  const { user, student } = useAuth();
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyGroup = async () => {
    try {
      setLoading(true);
      setError(null);
      const groupRes = await apiClient.getMyGroup();
      if (groupRes.success && groupRes.data) {
        setGroupData(groupRes.data);
      } else {
        if (!groupRes.success) {
          setError(groupRes.message || groupRes.error || 'Failed to load group information');
        }
        setGroupData(null);
      }
    } catch (err) {
      console.error('Failed to fetch group:', err);
      setError('Failed to load group information');
      setGroupData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyGroup();
  }, [student?.matric_number]);

  if (loading) {
    return (
      <MainLayout title="My Group">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <RefreshCw className="w-8 h-8 text-[#1a237e] animate-spin" />
          <p className="text-gray-500">Loading group information...</p>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout title="My Group">
        <Card>
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchMyGroup}>
              <RefreshCw className="mr-2" size={16} />
              Try Again
            </Button>
          </div>
        </Card>
      </MainLayout>
    );
  }

  if (!groupData) {
    return (
      <MainLayout title="My Group">
        <div className="space-y-6">
          <Card>
            <div className="text-center py-12">
              <Users className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Group Assigned</h3>
              <p className="text-gray-600 mb-6">
                You haven't been assigned to a group yet. Groups are typically formed when your department admin uploads students and generates groups. Changes appear here in real-time.
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Your matric number: <strong>{student?.matric_number || 'Not set'}</strong>
              </p>
              <Button variant="outline" onClick={fetchMyGroup}>
                <RefreshCw className="mr-2" size={16} />
                Refresh
              </Button>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="My Group">
      <div className="space-y-6">
        {/* Group Overview */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#1a237e]">{groupData.name}</h2>
              <p className="text-gray-600">
                {groupData.department && `Department: ${groupData.department}`}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchMyGroup}>
              <RefreshCw className="mr-2" size={16} />
              Refresh
            </Button>
          </div>
        </Card>

        {/* Supervisor Information */}
        {groupData.supervisor && (
          <Card>
            <h3 className="text-lg font-semibold text-[#1a237e] mb-4">Supervisor</h3>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-12 h-12 bg-[#26a69a] rounded-full flex items-center justify-center">
                <UserCheck className="text-white" size={24} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{groupData.supervisor}</h4>
                <p className="text-sm text-gray-600">Project Supervisor</p>
              </div>
              <Button variant="outline" size="sm">
                <Mail className="mr-2" size={14} />
                Contact
              </Button>
            </div>
          </Card>
        )}

        {/* Group Members - Identified by Matric Number */}
        <Card>
          <h3 className="text-lg font-semibold text-[#1a237e] mb-4">Group Members</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupData.members.map((member, index) => {
              const isCurrentUser = member.matricNumber === student?.matric_number;
              return (
                <div
                  key={member.matricNumber || index}
                  className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                    isCurrentUser ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{member.name}</h4>
                      <p className="text-xs text-gray-600">Member</p>
                    </div>
                    {isCurrentUser && (
                      <span className="ml-auto text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">You</span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Matric:</span>
                      <span className="font-medium">{member.matricNumber || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

      </div>
    </MainLayout>
  );
}
