import { useState, useEffect } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../lib/api';
import { Mail, Building2, Calendar, Key } from 'lucide-react';

export function AdminProfile() {
  const { user } = useAuth();
  const [usersCount, setUsersCount] = useState(0);
  const [groupsCount, setGroupsCount] = useState(0);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.getUsers(),
      apiClient.getGroups(),
    ]).then(([usersRes, groupsRes]) => {
      if (usersRes.success && Array.isArray(usersRes.data)) {
        setUsersCount((usersRes.data as any[]).length);
      }
      if (groupsRes.success && Array.isArray(groupsRes.data)) {
        setGroupsCount((groupsRes.data as any[]).length);
      }
    }).catch(err => console.error('Failed to load profile data:', err));
  }, []);

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
      <div className="space-y-6">
        <Card>
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
              <p className="text-sm text-gray-600">Administrator</p>
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <Building2 size={14} />
                {user?.department || '—'}
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <p className="text-sm text-gray-600 mb-1">Users</p>
            <p className="text-xl font-bold text-[#022B3A]">{usersCount}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-600 mb-1">Groups</p>
            <p className="text-xl font-bold text-[#022B3A]">{groupsCount}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-600 mb-1">Role</p>
            <p className="text-xl font-bold text-[#022B3A]">Admin</p>
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
