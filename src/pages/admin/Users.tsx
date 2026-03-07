import { useState, useEffect } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { useDepartment } from '../../contexts/DepartmentContext';
import { useSearchParams } from 'react-router-dom';
import { Users as UsersIcon, UserPlus, Search, Edit, Trash2, Mail, Phone, MoreVertical } from 'lucide-react';

export function Users() {
  const [searchParams] = useSearchParams();
  const deptFromUrl = searchParams.get('department') || '';
  const { filterByDepartment } = useDepartment();
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [studentDetails, setStudentDetails] = useState<Record<string, any>>({});
  const [supervisorDetails, setSupervisorDetails] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState(deptFromUrl);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, studentsRes, supervisorsRes, deptRes] = await Promise.all([
        apiClient.getUsers(),
        apiClient.getStudents(),
        apiClient.getSupervisors(),
        apiClient.getDepartments().catch(() => ({ success: false, data: [] }))
      ]);

      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data);
      } else {
        setError(usersRes.message || 'Failed to load users');
      }
      if (deptRes.success && Array.isArray(deptRes.data)) {
        const names = (deptRes.data as { name: string }[]).map((d) => d.name).sort();
        setDepartments(names);
      }
      if (studentsRes.success && studentsRes.data) {
        const map: Record<string, any> = {};
        (studentsRes.data as any[]).forEach((student: any) => {
          map[student.email] = student;
        });
        setStudentDetails(map);
      }
      if (supervisorsRes.success && supervisorsRes.data) {
        const map: Record<string, any> = {};
        (supervisorsRes.data as any[]).forEach((supervisor: any) => {
          map[supervisor.email] = supervisor;
        });
        setSupervisorDetails(map);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    setDepartmentFilter(deptFromUrl);
  }, [deptFromUrl]);

  const scopeFiltered = filterByDepartment(users);
  const filteredUsers = scopeFiltered.filter((user) => {
    const name = `${user.first_name} ${user.last_name}`.trim();
    const matchesFilter = filter === 'all' || user.role === filter ||
      (filter === 'supervisor' && user.role === 'external_supervisor');
    const matchesDept = !departmentFilter || (user.department || '') === departmentFilter;
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesDept && matchesSearch;
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'student': return 'text-blue-600 bg-blue-100';
      case 'supervisor': return 'text-green-600 bg-green-100';
      case 'admin': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    if (!editUser) return;
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiClient.updateUser(editUser.id, {
        first_name: editUser.first_name,
        last_name: editUser.last_name,
        department: editUser.department || undefined,
        phone: editUser.phone || undefined,
        office_location: editUser.office_location || undefined,
        specialization: editUser.specialization || undefined,
      });
      if (res.success) {
        setEditUser(null);
        fetchUsers();
      } else {
        setError(res.message || 'Failed to update user');
      }
    } catch (err) {
      setError('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deleteConfirm) return;
    setSaving(true);
    try {
      const res = await apiClient.updateUserStatus(deleteConfirm.id, false);
      if (res.success) {
        setDeleteConfirm(null);
        fetchUsers();
      } else {
        setError(res.message || 'Failed to deactivate user');
      }
    } catch (err) {
      setError('Failed to deactivate user');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout title="Users">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading users...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Users">
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-medium">Dismiss</button>
          </div>
        )}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#022B3A]">User Management</h2>
              <p className="text-gray-600 mt-1">Manage students, supervisors, and administrators</p>
            </div>
            <Button>
              <UserPlus className="mr-2" size={16} />
              Add New User
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Users</option>
              <option value="student">Students</option>
              <option value="supervisor">Supervisors</option>
              <option value="admin">Admins</option>
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </Card>

        <div className="space-y-4">
          {filteredUsers.length === 0 && (
            <Card>
              <div className="text-center py-12 text-gray-500">
                <UsersIcon size={48} className="mx-auto mb-4 opacity-50" />
                <p className="font-medium">No users found</p>
                <p className="text-sm mt-1">
                  {searchTerm || filter !== 'all' ? 'Try adjusting your search or filter.' : 'Users will appear here once they register.'}
                </p>
              </div>
            </Card>
          )}
          {filteredUsers.map((user) => {
            const name = `${user.first_name} ${user.last_name}`.trim();
            const student = studentDetails[user.email];
            const supervisor = supervisorDetails[user.email];
            return (
              <Card key={user.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{name}</h3>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(user.role)}`}>
                        {user.role}
                      </span>
                      <span className="text-xs text-gray-500">{user.department || '—'}</span>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreVertical size={16} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail size={14} />
                    <span>{user.email}</span>
                  </div>
                  {student?.matric_number && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <UsersIcon size={14} />
                      <span>Matric: {student.matric_number}</span>
                    </div>
                  )}
                  {student?.gpa && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <UsersIcon size={14} />
                      <span>GPA: {student.gpa}</span>
                    </div>
                  )}
                  {supervisor?.current_load != null && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <UsersIcon size={14} />
                      <span>Groups: {supervisor.current_load}</span>
                    </div>
                  )}
                  {supervisor?.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone size={14} />
                      <span>{supervisor.phone}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditUser({ ...user, ...supervisorDetails[user.email] })}>
                    <Edit size={14} className="mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:border-red-300" onClick={() => setDeleteConfirm(user)}>
                    <Trash2 size={14} className="mr-1" />
                    Deactivate
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Edit User Modal */}
        {editUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-[#022B3A] mb-4">Edit User</h3>
              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={editUser.first_name || ''}
                    onChange={(e) => setEditUser({ ...editUser, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editUser.last_name || ''}
                    onChange={(e) => setEditUser({ ...editUser, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={editUser.department || ''}
                    onChange={(e) => setEditUser({ ...editUser, department: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                {(editUser.role === 'supervisor' || editUser.role === 'external_supervisor') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="text"
                        value={editUser.phone || ''}
                        onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Office Location</label>
                      <input
                        type="text"
                        value={editUser.office_location || ''}
                        onChange={(e) => setEditUser({ ...editUser, office_location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
                      <input
                        type="text"
                        value={editUser.specialization || ''}
                        onChange={(e) => setEditUser({ ...editUser, specialization: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                  <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete/Deactivate Confirmation */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-[#022B3A] mb-2">Deactivate User</h3>
              <p className="text-gray-600 mb-4">
                Deactivate {deleteConfirm.first_name} {deleteConfirm.last_name}? They will no longer be able to log in.
              </p>
              <div className="flex gap-2">
                <Button variant="danger" onClick={handleDeactivate} disabled={saving}>
                  {saving ? 'Deactivating...' : 'Deactivate'}
                </Button>
                <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={saving}>Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
