import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { useDepartment } from '../../contexts/DepartmentContext';
import { apiClient } from '../../lib/api';
import { Building2, Users, UserCheck, FileText, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { ConfirmationModal } from '../../components/UI/ConfirmationModal';

interface DepartmentStats {
  id: number;
  name: string;
  code: string;
  studentCount: number;
  supervisorCount: number;
  groupCount: number;
  unassignedCount: number;
}

export function Departments() {
  const navigate = useNavigate();
  const { managesAllDepartments, refreshAdminDepartments } = useDepartment();
  const [stats, setStats] = useState<DepartmentStats[]>([]);
  const [totals, setTotals] = useState<{ totalStudents: number; totalSupervisors: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<DepartmentStats | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    const res = await apiClient.getDepartmentStats();
    if (res.success && Array.isArray(res.data)) {
      setStats(res.data as DepartmentStats[]);
    }
    if (res.success && (res as any).totals) {
      setTotals((res as any).totals);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!newName.trim()) {
      setAddError('Department name is required');
      return;
    }
    setAdding(true);
    const res = await apiClient.createDepartment(newName.trim(), newCode.trim() || undefined);
    if (res.success) {
      setNewName('');
      setNewCode('');
      await loadStats();
      await refreshAdminDepartments();
    } else {
      setAddError((res as any).message || 'Failed to add department');
    }
    setAdding(false);
  };

  const handleDeleteDepartment = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setAddError('');
    const res = await apiClient.deleteDepartment(deleteConfirm.id);
    if (res.success) {
      setDeleteConfirm(null);
      await loadStats();
      await refreshAdminDepartments();
    } else {
      setAddError((res as any).message || 'Failed to delete');
      setDeleting(false);
      throw new Error((res as any).message || 'Failed to delete');
    }
    setDeleting(false);
  };

  const totalStudents = totals?.totalStudents ?? stats.reduce((s, d) => s + d.studentCount, 0);
  const totalSupervisors = totals?.totalSupervisors ?? stats.reduce((s, d) => s + d.supervisorCount, 0);
  const totalGroups = stats.reduce((s, d) => s + d.groupCount, 0);
  const totalUnassigned = stats.reduce((s, d) => s + d.unassignedCount, 0);

  return (
    <MainLayout title="Departments">
      <div className="space-y-6 min-w-0">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1F7A8C]/10 flex items-center justify-center">
                <Users className="text-[#1F7A8C]" size={20} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Students</p>
                <p className="text-xl font-bold text-[#022B3A]">{loading ? '—' : totalStudents}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1F7A8C]/10 flex items-center justify-center">
                <UserCheck className="text-[#1F7A8C]" size={20} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Supervisors</p>
                <p className="text-xl font-bold text-[#022B3A]">{loading ? '—' : totalSupervisors}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1F7A8C]/10 flex items-center justify-center">
                <FileText className="text-[#1F7A8C]" size={20} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Groups</p>
                <p className="text-xl font-bold text-[#022B3A]">{loading ? '—' : totalGroups}</p>
              </div>
            </div>
          </Card>
          <Card className={`p-4 ${totalUnassigned > 0 ? 'border-amber-200 bg-amber-50/50' : ''}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalUnassigned > 0 ? 'bg-amber-100' : 'bg-[#1F7A8C]/10'}`}>
                <Users className={totalUnassigned > 0 ? 'text-amber-600' : 'text-[#1F7A8C]'} size={20} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Without Supervisor</p>
                <p className={`text-xl font-bold ${totalUnassigned > 0 ? 'text-amber-700' : 'text-[#022B3A]'}`}>
                  {loading ? '—' : totalUnassigned}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Admin scope notice */}
        {!managesAllDepartments && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
            You are managing selected departments only. Go to Settings to change your department scope.
          </div>
        )}

        {/* Add Department */}
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[#022B3A] mb-4">Add Department</h2>
          <form onSubmit={handleAddDepartment} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Department name (e.g. Mechanical Engineering)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Code (optional, auto-generated)"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="w-full sm:w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent"
            />
            <Button type="submit" disabled={adding || !newName.trim()}>
              {adding ? 'Adding...' : <><Plus size={18} className="inline mr-1" /> Add</>}
            </Button>
          </form>
          {addError && <p className="text-sm text-red-600 mt-2">{addError}</p>}
        </Card>

        {/* Department cards */}
        <div>
          <h2 className="text-lg font-semibold text-[#022B3A] mb-4">Departments</h2>
          {loading ? (
            <div className="text-slate-500">Loading...</div>
          ) : stats.length === 0 ? (
            <div className="text-slate-500">No departments yet. Add one above.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.map((dept) => (
                <Card key={dept.id} className="p-5 hover:shadow-md transition-shadow relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-[#1F7A8C]/10 flex items-center justify-center shrink-0">
                        <Building2 className="text-[#1F7A8C]" size={24} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[#022B3A] truncate">{dept.name}</h3>
                        <p className="text-xs text-slate-500">{dept.studentCount} students · {dept.supervisorCount} supervisors</p>
                        {dept.unassignedCount > 0 && (
                          <p className="text-xs text-amber-600 font-medium mt-0.5">{dept.unassignedCount} need supervisor</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
                      onClick={() => { setAddError(''); setDeleteConfirm(dept); }}
                      disabled={(dept.studentCount + dept.supervisorCount + dept.groupCount) > 0}
                      title={(dept.studentCount + dept.supervisorCount + dept.groupCount) > 0 ? 'Cannot delete: has users, supervisors, or groups' : 'Delete department'}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/users?department=${encodeURIComponent(dept.name)}`)}
                    >
                      View Students
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/supervisor-assignment?department=${encodeURIComponent(dept.name)}`)}
                    >
                      Assign Supervisors
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/groups?department=${encodeURIComponent(dept.name)}`)}
                    >
                      Groups
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <ConfirmationModal
          isOpen={!!deleteConfirm}
          onClose={() => { if (!deleting) { setDeleteConfirm(null); setAddError(''); } }}
          onConfirm={handleDeleteDepartment}
          title="Delete Department"
          message={deleteConfirm ? `Are you sure you want to delete "${deleteConfirm.name}"? This cannot be undone.` : ''}
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          loading={deleting}
          loadingText="Deleting..."
          error={addError}
        />
      </div>
    </MainLayout>
  );
}
