import { useState, useEffect } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useGroups } from '../../contexts/GroupsContext';
import { apiClient } from '../../lib/api';
import { Mail, Building2, Calendar, Key } from 'lucide-react';

export function Profile() {
  const { user, student } = useAuth();
  const { groups, syncWithDatabase } = useGroups();
  const [reportsCount, setReportsCount] = useState(0);
  const [inboxCount, setInboxCount] = useState(0);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const studentGroup = groups.find(group =>
    group.members.some(member => {
      const matric = member.matricNumber ?? (member as any).matric;
      return matric === student?.matric_number;
    })
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        await syncWithDatabase();
        const [reportsRes, inboxRes] = await Promise.all([
          apiClient.getMyReports(),
          apiClient.getInbox(),
        ]);
        if (reportsRes.success && Array.isArray(reportsRes.data)) {
          setReportsCount((reportsRes.data as any[]).length);
        }
        if (inboxRes.success && Array.isArray(inboxRes.data)) {
          setInboxCount((inboxRes.data as any[]).length);
        }
      } catch (err) {
        console.error('Failed to load profile data:', err);
      }
    };
    loadData();
  }, [syncWithDatabase]);

  const handleChangePassword = async () => {
    setPasswordError('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    const res = await apiClient.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
    if (res.success) {
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowChangePassword(false);
    } else {
      setPasswordError(res.message || 'Failed to change password');
    }
  };

  return (
    <MainLayout title="Profile">
      <div className="space-y-6 min-w-0 max-w-full overflow-x-hidden pb-8">
        <Card className="min-w-0 overflow-visible">
          <h2 className="text-lg font-semibold text-[#022B3A] mb-4">Profile</h2>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="w-16 h-16 bg-[#1F7A8C] rounded-full flex items-center justify-center shrink-0">
              <span className="text-xl font-semibold text-white">
                {user?.first_name?.[0]}
                {user?.last_name?.[0]}
              </span>
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-lg font-medium text-gray-900">
                {user?.first_name} {user?.last_name}
              </h3>
              <p className="text-sm text-gray-600">Student</p>
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <Building2 size={14} />
                {user?.department || '—'}
              </p>
              {student?.matric_number && (
                <p className="text-sm text-gray-600">Matric: {student.matric_number}</p>
              )}
              {studentGroup && (
                <p className="text-sm text-gray-600">Group: {studentGroup.name}</p>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <Card className="min-w-0">
            <p className="text-sm text-gray-600 mb-1">Group Status</p>
            <p className="text-xl font-bold text-[#022B3A]">
              {studentGroup ? studentGroup.name : 'Not Assigned'}
            </p>
            {studentGroup && (
              <p className="text-xs text-gray-500">Assigned</p>
            )}
          </Card>
          <Card className="min-w-0">
            <p className="text-sm text-gray-600 mb-1">Reports</p>
            <p className="text-xl font-bold text-[#022B3A]">{reportsCount}</p>
          </Card>
          <Card className="min-w-0">
            <p className="text-sm text-gray-600 mb-1">Messages</p>
            <p className="text-xl font-bold text-[#022B3A]">{inboxCount}</p>
          </Card>
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-[#022B3A] mb-4">Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-medium flex items-center gap-2">
                <Mail size={14} />
                {user?.email}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Department</p>
              <p className="font-medium flex items-center gap-2">
                <Building2 size={14} />
                {user?.department || '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Member since</p>
              <p className="font-medium flex items-center gap-2">
                <Calendar size={14} />
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
              </p>
            </div>
            {student?.gpa != null && (
              <div>
                <p className="text-sm text-gray-600">GPA</p>
                <p className="font-medium">{student.gpa.toFixed(2)}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[#022B3A] mb-4">Password</h2>
          {passwordSuccess && (
            <p className="text-sm text-green-600 mb-4">Password updated.</p>
          )}
          {showChangePassword ? (
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Current password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#022B3A]"
              />
              <input
                type="password"
                placeholder="New password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#022B3A]"
              />
              <input
                type="password"
                placeholder="Confirm"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#022B3A]"
              />
              {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleChangePassword}>
                  Update
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowChangePassword(false);
                    setPasswordError('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key size={16} className="text-gray-500" />
                <span className="text-sm text-gray-600">Change your password</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowChangePassword(true)}>
                Change
              </Button>
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
