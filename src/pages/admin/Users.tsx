import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { useDepartment } from '../../contexts/DepartmentContext';
import { useSearchParams, Link } from 'react-router-dom';
import { Users as UsersIcon, UserPlus, Edit, Trash2, Mail, Download, ChevronLeft, ChevronRight } from 'lucide-react';

const TEAL = '#006D6D';
const PAGE_SIZE = 10;

function csvEscape(cell: string) {
  const s = String(cell ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isUserActive(u: any) {
  return u.is_active !== false;
}

function roleLabel(role: string) {
  if (role === 'external_supervisor') return 'Supervisor';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function Users() {
  const [searchParams] = useSearchParams();
  const deptFromUrl = searchParams.get('department') || '';
  const { filterByDepartment } = useDepartment();
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [studentDetails, setStudentDetails] = useState<Record<string, any>>({});
  const [supervisorDetails, setSupervisorDetails] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [departmentFilter, setDepartmentFilter] = useState(deptFromUrl);
  const [headerSearch, setHeaderSearch] = useState('');
  const [page, setPage] = useState(1);
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
        apiClient.getDepartments().catch(() => ({ success: false, data: [] })),
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

  useEffect(() => {
    setPage(1);
  }, [filter, statusFilter, departmentFilter, headerSearch]);

  const scopeFiltered = filterByDepartment(users);

  const filteredUsers = scopeFiltered.filter((user) => {
    const name = `${user.first_name} ${user.last_name}`.trim();
    const matchesFilter =
      filter === 'all' ||
      user.role === filter ||
      (filter === 'supervisor' && user.role === 'external_supervisor');
    const matchesDept = !departmentFilter || (user.department || '') === departmentFilter;
    const matchesSearch =
      name.toLowerCase().includes(headerSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(headerSearch.toLowerCase());
    const active = isUserActive(user);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && active) ||
      (statusFilter === 'inactive' && !active);
    return matchesFilter && matchesDept && matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pageRows = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const deptBalance = useMemo(() => {
    const counts: Record<string, number> = {};
    scopeFiltered.forEach((u) => {
      const d = u.department || '—';
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [scopeFiltered]);

  const maxDept = Math.max(...deptBalance.map(([, c]) => c), 1);

  const inactiveInScope = scopeFiltered.filter((u) => !isUserActive(u)).length;

  const exportCsv = () => {
    const headers = ['first_name', 'last_name', 'email', 'role', 'department', 'active'];
    const lines = [
      headers.join(','),
      ...filteredUsers.map((u) =>
        [
          csvEscape(u.first_name || ''),
          csvEscape(u.last_name || ''),
          csvEscape(u.email || ''),
          csvEscape(u.role || ''),
          csvEscape(u.department || ''),
          isUserActive(u) ? 'yes' : 'no',
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supervise360-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'student':
        return 'text-sky-800 bg-sky-100 border-sky-200/80';
      case 'supervisor':
      case 'external_supervisor':
        return 'text-amber-900 bg-amber-100 border-amber-200/80';
      case 'admin':
        return 'text-violet-800 bg-violet-100 border-violet-200/80';
      default:
        return 'text-slate-700 bg-slate-100 border-slate-200';
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

  const filterPill = (key: string, label: string) => {
    const active = filter === key;
    return (
      <button
        type="button"
        onClick={() => setFilter(key)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
          active
            ? 'text-white border-transparent shadow-sm'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
        }`}
        style={active ? { backgroundColor: TEAL } : undefined}
      >
        {label}
      </button>
    );
  };

  if (loading) {
    return (
      <MainLayout
        title="Users"
        topBarSearch={{
          placeholder: 'Search academic records…',
          value: headerSearch,
          onChange: setHeaderSearch,
        }}
      >
        <div className="flex items-center justify-center h-64 text-slate-500">Loading users…</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Users"
      topBarSearch={{
        placeholder: 'Search academic records…',
        value: headerSearch,
        onChange: setHeaderSearch,
      }}
    >
      <div className="space-y-6 min-w-0">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-center justify-between gap-3">
            <span className="text-sm">{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-sm font-semibold shrink-0">
              Dismiss
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">User directory</h1>
            <p className="text-[#4A4A4A] mt-2 text-sm sm:text-base max-w-xl">
              Audit accounts, departments, and access roles across your administrative scope.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              type="button"
              onClick={exportCsv}
              disabled={filteredUsers.length === 0}
              className="!rounded-[10px] border-slate-200"
            >
              <Download className="w-4 h-4" strokeWidth={1.75} />
              Export CSV
            </Button>
            <Button
              type="button"
              title="Account provisioning may require your identity system"
              className="!rounded-[10px] !bg-[#006D6D] hover:!bg-[#005a5a] !text-white border-0"
            >
              <UserPlus className="w-4 h-4" strokeWidth={1.75} />
              Add new user
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="!p-4 sm:!p-5 !rounded-xl !shadow-sm border border-slate-200/90">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Filter by role</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {filterPill('all', 'All users')}
            {filterPill('student', 'Students')}
            {filterPill('supervisor', 'Supervisors')}
            {filterPill('admin', 'Admins')}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <label className="text-xs font-semibold text-slate-500 block mb-1">Department</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-[10px] border border-slate-200 bg-[#F8F9FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#006D6D]/25"
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-xs font-semibold text-slate-500 block mb-1">Account status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="w-full px-3 py-2.5 rounded-[10px] border border-slate-200 bg-[#F8F9FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#006D6D]/25"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Deactivated</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Summary */}
        <div className="rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50 to-white p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-800/80">Total managed</p>
            <p className="text-3xl font-bold text-[#1a1a1a] tabular-nums mt-1">{filteredUsers.length.toLocaleString()}</p>
            <p className="text-sm text-slate-600 mt-1">Matches current filters · {scopeFiltered.length.toLocaleString()} in scope</p>
          </div>
          <div className="h-10 w-24 rounded-lg bg-sky-100/80 border border-sky-200/60 flex items-end gap-0.5 px-2 pb-1">
            {[40, 65, 45, 80, 55].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-sky-400/70" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8F9FA] text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Role</th>
                  <th className="px-4 py-3 font-semibold hidden lg:table-cell">Department</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-slate-500">
                      <UsersIcon size={40} className="mx-auto mb-3 opacity-40" strokeWidth={1.25} />
                      <p className="font-medium text-slate-700">No users found</p>
                      <p className="text-sm mt-1">
                        {headerSearch || filter !== 'all' || statusFilter !== 'all'
                          ? 'Try adjusting search or filters.'
                          : 'Users appear here once they are registered.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((user) => {
                    const name = `${user.first_name} ${user.last_name}`.trim();
                    const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || '?';
                    const active = isUserActive(user);
                    const student = studentDetails[user.email];
                    const supervisor = supervisorDetails[user.email];
                    return (
                      <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ backgroundColor: TEAL }}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#1a1a1a] truncate">{name || user.email}</p>
                              <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                <Mail className="w-3 h-3 shrink-0 opacity-60" />
                                {user.email}
                              </p>
                              {student?.matric_number && (
                                <p className="text-xs text-slate-400 mt-0.5">Matric {student.matric_number}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadge(
                              user.role
                            )}`}
                          >
                            {roleLabel(user.role)}
                          </span>
                          {supervisor?.current_load != null && (
                            <p className="text-xs text-slate-500 mt-1">Load {supervisor.current_load}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-slate-700">
                          {user.department || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-emerald-500' : 'bg-red-500'}`}
                            />
                            <span className="text-slate-700 font-medium">{active ? 'Active' : 'Deactivated'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex flex-wrap justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditUser({ ...user, ...supervisorDetails[user.email] })}
                              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#006D6D]"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(user)}
                              className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                              title="Deactivate"
                              disabled={!active}
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filteredUsers.length > PAGE_SIZE && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-[#F8F9FA]/50">
              <p className="text-xs text-slate-500 tabular-nums">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredUsers.length)} of{' '}
                {filteredUsers.length} users
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-600 tabular-nums px-2">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom widgets */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="!p-5 !rounded-xl border border-slate-200/90 !shadow-sm">
            <h3 className="font-semibold text-[#1a1a1a] mb-3">Department balance</h3>
            <ul className="space-y-3">
              {deptBalance.length === 0 ? (
                <li className="text-sm text-slate-500">No data</li>
              ) : (
                deptBalance.map(([dept, count]) => (
                  <li key={dept}>
                    <div className="flex justify-between text-xs mb-1 gap-2">
                      <span className="text-slate-700 truncate">{dept}</span>
                      <span className="tabular-nums text-slate-500">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round((count / maxDept) * 100)}%`, backgroundColor: TEAL }}
                      />
                    </div>
                  </li>
                ))
              )}
            </ul>
          </Card>
          {/* Removed: Directory health + Attention required blocks */}
        </div>
      </div>

      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4">Edit user</h3>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First name</label>
                <input
                  type="text"
                  value={editUser.first_name || ''}
                  onChange={(e) => setEditUser({ ...editUser, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#006D6D]/25"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last name</label>
                <input
                  type="text"
                  value={editUser.last_name || ''}
                  onChange={(e) => setEditUser({ ...editUser, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#006D6D]/25"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                <select
                  value={editUser.department || ''}
                  onChange={(e) => setEditUser({ ...editUser, department: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#006D6D]/25"
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              {(editUser.role === 'supervisor' || editUser.role === 'external_supervisor') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={editUser.phone || ''}
                      onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#006D6D]/25"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Office location</label>
                    <input
                      type="text"
                      value={editUser.office_location || ''}
                      onChange={(e) => setEditUser({ ...editUser, office_location: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#006D6D]/25"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Specialization</label>
                    <input
                      type="text"
                      value={editUser.specialization || ''}
                      onChange={(e) => setEditUser({ ...editUser, specialization: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#006D6D]/25"
                    />
                  </div>
                </>
              )}
              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={saving}
                  className="!rounded-[10px] !bg-[#006D6D] hover:!bg-[#005a5a] !text-white"
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditUser(null)} className="!rounded-[10px]">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">Deactivate user</h3>
            <p className="text-slate-600 text-sm mb-4">
              Deactivate {deleteConfirm.first_name} {deleteConfirm.last_name}? They will no longer be able to log in.
            </p>
            <div className="flex gap-2">
              <Button variant="danger" onClick={handleDeactivate} disabled={saving} className="!rounded-[10px]">
                {saving ? 'Deactivating…' : 'Deactivate'}
              </Button>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={saving} className="!rounded-[10px]">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
