import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { useDepartment } from '../../contexts/DepartmentContext';
import { apiClient } from '../../lib/api';
import {
  Building2,
  Plus,
  Trash2,
  Pencil,
  Filter,
  ArrowUpDown,
  Shield,
  Landmark,
  Cpu,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/UI/Button';
import { ConfirmationModal } from '../../components/UI/ConfirmationModal';

const TEAL = '#006D6D';
const PAGE_SIZE = 8;
const COURSE_CODE_BY_NAME: Record<string, string> = {
  'Software Engineering': 'SE',
  'Computer Science': 'CS',
  'Computer Information Systems': 'CIS',
  'Computer Technology': 'CT',
  'Information Technology': 'IT',
};

function getCourseCode(dept: { name?: string; code?: string; id?: number }) {
  const name = dept.name?.trim();
  if (name && COURSE_CODE_BY_NAME[name]) return COURSE_CODE_BY_NAME[name];
  const code = dept.code?.toString().trim().toUpperCase();
  if (code) {
    const normalized = code.replace(/\s+/g, '');
    if (normalized) return normalized;
  }
  return dept.id ? `ID ${dept.id}` : '—';
}

interface DepartmentStats {
  id: number;
  name: string;
  code: string;
  studentCount: number;
  supervisorCount: number;
  groupCount: number;
  unassignedCount: number;
}

const deptAccentIcons = [Cpu, Building2, Landmark];

export function Departments() {
  const navigate = useNavigate();
  const { managesAllDepartments, refreshAdminDepartments } = useDepartment();
  const [headerSearch, setHeaderSearch] = useState('');
  const [stats, setStats] = useState<DepartmentStats[]>([]);
  const [totals, setTotals] = useState<{ totalStudents: number; totalSupervisors: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<DepartmentStats | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [page, setPage] = useState(1);

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

  const filtered = useMemo(() => {
    const q = headerSearch.trim().toLowerCase();
    if (!q) return stats;
    return stats.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.code && d.code.toLowerCase().includes(q))
    );
  }, [stats, headerSearch]);

  useEffect(() => {
    setPage(1);
  }, [headerSearch]);

  const sortedForTable = useMemo(
    () => [...filtered].sort((a, b) => a.name.localeCompare(b.name)),
    [filtered]
  );

  const totalPages = Math.max(1, Math.ceil(sortedForTable.length / PAGE_SIZE));
  const pageRows = sortedForTable.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const spotlightDepartments = useMemo(() => {
    // Keep all departments; sort by enrollment for a meaningful order.
    return [...stats].sort((a, b) => b.studentCount - a.studentCount);
  }, [stats]);

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
      setAddPanelOpen(false);
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
  const totalListed = stats.length;

  return (
    <MainLayout
      title="Departments"
      topBarSearch={{
        placeholder: 'Search departments…',
        value: headerSearch,
        onChange: setHeaderSearch,
      }}
    >
      <div className="space-y-8 min-w-0">
        {/* Page header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">Departments</h1>
            <p className="text-[#4A4A4A] mt-2 text-sm sm:text-base leading-relaxed">
              Centralized oversight for academic units. Monitor workload distribution, student placement, and
              organizational health across your scope.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddPanelOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[10px] text-white text-sm font-semibold shadow-sm hover:opacity-95 transition-opacity shrink-0"
            style={{ backgroundColor: TEAL }}
          >
            <Plus className="w-5 h-5" strokeWidth={2} />
            Add new department
          </button>
        </div>

        {!managesAllDepartments && (
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={{ backgroundColor: `${TEAL}10`, borderColor: `${TEAL}33`, color: '#0f4a4a' }}
          >
            You are managing selected departments only. Change scope in Settings if needed.
          </div>
        )}

        {/* Spotlight cards (scrollable) */}
        {!loading && spotlightDepartments.length > 0 && (
          <div className="-mx-4 sm:-mx-8 lg:-mx-10 px-4 sm:px-8 lg:px-10">
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
              {spotlightDepartments.map((dept, idx) => {
              const Icon = deptAccentIcons[idx % deptAccentIcons.length];
              const unassigned = dept.unassignedCount ?? 0;
              return (
                <div
                  key={dept.id}
                  className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 flex flex-col gap-3 snap-start shrink-0 w-[280px] sm:w-[320px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${TEAL}14` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: TEAL }} strokeWidth={1.75} />
                    </div>
                    <span className="text-xs font-bold tabular-nums" style={{ color: TEAL }}>
                      {getCourseCode(dept)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-[#1a1a1a]">{dept.name}</p>
                    <p className="text-sm text-slate-500 mt-1 tabular-nums">
                      {dept.studentCount.toLocaleString()} students · {dept.supervisorCount} supervisors
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Unassigned</span>
                    <span
                      className={`text-sm font-bold tabular-nums ${unassigned > 0 ? 'text-red-600' : ''}`}
                      style={unassigned === 0 ? { color: TEAL } : undefined}
                    >
                      {unassigned > 0 ? unassigned : '0'}
                    </span>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* Add department panel */}
        {addPanelOpen && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">Add department</h2>
            <form onSubmit={handleAddDepartment} className="flex flex-col lg:flex-row gap-3">
              <input
                type="text"
                placeholder="Department name (e.g. Mechanical Engineering)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-[10px] bg-[#F8F9FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#006D6D]/25"
              />
              <input
                type="text"
                placeholder="Code (optional)"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="w-full lg:w-44 px-4 py-2.5 border border-slate-200 rounded-[10px] bg-[#F8F9FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#006D6D]/25"
              />
              <Button type="submit" disabled={adding || !newName.trim()} className="!rounded-[10px] !bg-[#006D6D] hover:!bg-[#005a5a] !text-white border-0">
                {adding ? 'Adding…' : 'Save department'}
              </Button>
            </form>
            <div className="flex justify-end mt-2">
              <button type="button" onClick={() => setAddPanelOpen(false)} className="text-sm text-slate-500 hover:text-slate-800">
                Close
              </button>
            </div>
            {addError && <p className="text-sm text-red-600 mt-3">{addError}</p>}
          </div>
        )}

        {/* Academic inventory table */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-[#1a1a1a]">Academic inventory</h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {loading ? 'Loading…' : `${totalListed} departments · ${totalStudents.toLocaleString()} students · ${totalSupervisors} supervisors`}
              </p>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Filter className="w-4 h-4" strokeWidth={1.75} />
              <ArrowUpDown className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8F9FA] text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-semibold">Department</th>
                  <th className="px-5 py-3 font-semibold hidden md:table-cell">Scope</th>
                  <th className="px-5 py-3 font-semibold">Groups</th>
                  <th className="px-5 py-3 font-semibold hidden sm:table-cell">Unassigned</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                      Loading departments…
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                      {stats.length === 0
                        ? 'No departments yet. Add one to get started.'
                        : 'No departments match your search.'}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((dept) => {
                    const canDelete = dept.studentCount + dept.supervisorCount + dept.groupCount === 0;
                    return (
                      <tr key={dept.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${TEAL}12` }}
                            >
                              <Building2 className="w-5 h-5" style={{ color: TEAL }} strokeWidth={1.75} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#1a1a1a] truncate">{dept.name}</p>
                              <p className="text-xs text-slate-500 font-mono">{getCourseCode(dept)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          <div className="flex flex-wrap gap-1.5">
                            {managesAllDepartments ? (
                              <>
                                <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">University</span>
                                <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-[#006D6D]/10 text-[#006D6D]">Admin</span>
                              </>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800">Scoped</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 tabular-nums font-medium text-slate-800">{dept.groupCount}</td>
                        <td className="px-5 py-4 hidden sm:table-cell">
                          <span
                            className={`font-semibold tabular-nums ${dept.unassignedCount > 0 ? 'text-red-600' : ''}`}
                            style={dept.unassignedCount === 0 ? { color: TEAL } : undefined}
                          >
                            {dept.unassignedCount}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Open directory"
                              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#006D6D]"
                              onClick={() =>
                                navigate(`/users?department=${encodeURIComponent(dept.name)}`)
                              }
                            >
                              <Pencil className="w-4 h-4" strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              title={canDelete ? 'Delete department' : 'Remove users and groups first'}
                              disabled={!canDelete}
                              className={`p-2 rounded-lg ${
                                canDelete
                                  ? 'text-slate-500 hover:bg-red-50 hover:text-red-600'
                                  : 'text-slate-300 cursor-not-allowed'
                              }`}
                              onClick={() => {
                                if (canDelete) {
                                  setAddError('');
                                  setDeleteConfirm(dept);
                                }
                              }}
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

          {!loading && sortedForTable.length > PAGE_SIZE && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 bg-[#F8F9FA]/50">
              <p className="text-xs text-slate-500 tabular-nums">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedForTable.length)} of{' '}
                {sortedForTable.length} departments
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="max-w-2xl">
          <div
            className="rounded-xl border p-5 flex gap-4"
            style={{ backgroundColor: `${TEAL}08`, borderColor: `${TEAL}2a` }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-white shadow-sm"
              style={{ color: TEAL }}
            >
              <Shield className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-semibold text-[#1a1a1a]">Deleting departments</h3>
              <p className="text-sm text-[#4A4A4A] mt-1 leading-relaxed">
                You can only delete a department when it has no students, supervisors, or groups. Move or reassign those
                records first.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => {
          if (!deleting) {
            setDeleteConfirm(null);
            setAddError('');
          }
        }}
        onConfirm={handleDeleteDepartment}
        title="Delete department"
        message={
          deleteConfirm
            ? `Are you sure you want to delete "${deleteConfirm.name}"? This cannot be undone.`
            : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={deleting}
        loadingText="Deleting…"
        error={addError}
      />
    </MainLayout>
  );
}
