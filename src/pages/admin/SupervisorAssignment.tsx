import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { ConfirmationModal } from '../../components/UI/ConfirmationModal';
import { 
  Users, Upload, UserCheck, 
  Eye, Edit, CheckCircle, Clock, Building, X, Trash2, ChevronDown, FileSpreadsheet, FileText, File, SlidersHorizontal
} from 'lucide-react';
import { parseCSV, readFileAsText } from '../../lib/csv-parser';
import { downloadAssignmentsAsCSV, downloadAssignmentsAsPDF, downloadAssignmentsAsWord } from '../../lib/export-utils';
import { useSearchParams } from 'react-router-dom';
import { useGroups } from '../../contexts/GroupsContext';
import { useDepartment } from '../../contexts/DepartmentContext';
import { apiClient } from '../../lib/api';

export function SupervisorAssignment() {
  const [searchParams, setSearchParams] = useSearchParams();
  const deptFromUrl = searchParams.get('department') || '';
  const { groups, syncWithDatabase } = useGroups();
  const { userDepartment, isSystemAdmin, filterByDepartment } = useDepartment();
  const [departments, setDepartments] = useState<{ id: number; name: string; code: string }[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState(deptFromUrl || '');
  const [supervisors, setSupervisors] = useState([]);
  const [supervisorsByDepartment, setSupervisorsByDepartment] = useState({});
  const [totalStats, setTotalStats] = useState({
    totalSupervisors: 0,
    totalAssigned: 0,
    departments: 0,
    userDepartment: '',
    isSystemAdmin: false
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [uploadedSupervisors, setUploadedSupervisors] = useState<any[]>([]);
  const [viewGroupsSupervisor, setViewGroupsSupervisor] = useState<string | null>(null);
  const [editSwapModal, setEditSwapModal] = useState(false);
  const [swapMember1, setSwapMember1] = useState<{ groupId: number; memberId: number; name: string; tier?: string } | null>(null);
  const [swapMember2, setSwapMember2] = useState<{ groupId: number; memberId: number; name: string; tier?: string } | null>(null);
  const [swapSearch1, setSwapSearch1] = useState('');
  const [swapSearch2, setSwapSearch2] = useState('');
  const [swapping, setSwapping] = useState(false);
  const [clearAllModal, setClearAllModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [activeTab, setActiveTab] = useState<'workload' | 'groups' | 'upload'>('workload');
  const [groupsSearch, setGroupsSearch] = useState('');
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);
  const [sessions, setSessions] = useState<{ id: number; label: string }[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  const [swapWizardTab, setSwapWizardTab] = useState<'swap' | 'move' | 'reassign'>('swap');
  const [moveSearch, setMoveSearch] = useState('');
  const [moveStudent, setMoveStudent] = useState<{ groupId: number; memberId: number; name: string } | null>(null);
  const [moveTargetGroupId, setMoveTargetGroupId] = useState<number | ''>('');
  const [moveDoing, setMoveDoing] = useState(false);
  const [reassignGroupId, setReassignGroupId] = useState<number | ''>('');
  const [reassignSupervisorName, setReassignSupervisorName] = useState('');
  const [reassignDoing, setReassignDoing] = useState(false);
  /** Local draft for max-groups cap inputs (keyed by workload row id) */
  const [workloadCapInput, setWorkloadCapInput] = useState<Record<number, string>>({});
  const [workloadEditSupervisor, setWorkloadEditSupervisor] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    const m: Record<number, string> = {};
    (supervisors as any[]).forEach((s: any) => {
      m[s.id] = s.max_groups != null ? String(s.max_groups) : '';
    });
    setWorkloadCapInput(m);
  }, [supervisors]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(e.target as Node)) {
        setActionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const loadSessions = async () => {
      const res = await apiClient.getSessions().catch(() => ({ success: false, data: [] }));
      if (res.success && Array.isArray(res.data)) {
        const list = res.data as { id: number; label: string }[];
        setSessions(list);
        if (list.length === 1 && selectedSessionId === '') setSelectedSessionId(list[0].id);
      }
    };
    loadSessions();
  }, []);

  // Fetch departments
  useEffect(() => {
    const load = async () => {
      const res = await apiClient.getDepartments().catch(() => ({ success: false, data: [] }));
      if (res.success && Array.isArray(res.data)) {
        setDepartments(res.data as { id: number; name: string; code: string }[]);
        if (deptFromUrl && (res.data as any[]).some((d: any) => d.name === deptFromUrl)) {
          setSelectedDepartment(deptFromUrl);
        }
      }
    };
    load();
  }, [deptFromUrl]);

  // Sync groups and load supervisor workload - groups precede supervisors, keep in sync
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await syncWithDatabase();
      await loadSupervisorWorkload();
      setLoading(false);
    };
    load();
  }, []);

  const handleDepartmentChange = (dept: string) => {
    setSelectedDepartment(dept);
    setSearchParams(dept ? { department: dept } : {}, { replace: true });
  };

  const loadSupervisorWorkload = async () => {
    try {
      // Sync workload with actual group assignments first (keep them in sync)
      await apiClient.syncSupervisorWorkload();
      const response = await apiClient.getSupervisorWorkload();
      if (response.success && response.data) {
        setSupervisors(response.data.supervisors || []);
        setSupervisorsByDepartment(response.data.supervisorsByDepartment || {});
        setTotalStats(response.data.totalStats || {
          totalSupervisors: 0,
          totalAssigned: 0,
          departments: 0,
          userDepartment: response.data.userDepartment || '',
          isSystemAdmin: response.data.isSystemAdmin || false
        });
      }
    } catch (error) {
      console.error('Failed to load supervisor workload:', error);
    }
  };

  // Filter groups by selected department (each department has its own lecturers - no cross-department)
  // When no department selected, show nothing - user must pick a department first
  const departmentGroups = selectedDepartment
    ? filterByDepartment(groups).filter((g) => {
        if ((g.department || '') !== selectedDepartment) return false;
        if (selectedSessionId !== '' && Number((g as any).session_id) !== Number(selectedSessionId)) {
          return false;
        }
        return true;
      })
    : [];

  // Supervisors in the selected department only (for group assignment context)
  const departmentSupervisors = selectedDepartment
    ? (supervisors as any[]).filter((s) => (s.department || '').trim() === selectedDepartment.trim())
    : (supervisors as any[]);
  // Always show ALL departments with their counts (18 SE + 7 CS = 25 total), not just selected
  const departmentSupervisorsByDept = supervisorsByDepartment;

  // Convert groups to the format expected by this component
  const convertedGroups = departmentGroups.map(group => ({
    id: group.id,
    name: group.name,
    members: Array.isArray(group.members) ? group.members.map(m => m.name) : [],
    department: group.department || userDepartment,
    supervisor: group.supervisor || null,
    status: group.supervisor ? 'assigned' : 'awaiting_supervisor'
  }));

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    
    try {
      const csvText = await readFileAsText(file);
      const parsedData = parseCSV(csvText);
      
      // Check if this looks like a database export with only PK
      if (parsedData.headers.length === 1 && parsedData.headers[0].toLowerCase().includes('pk')) {
        throw new Error('This appears to be a database export with only primary keys. Please export a CSV with the actual data columns needed (Name, Department).');
      }
      
      // Validate required columns for supervisors (Name, Department; optional Workload / max_groups)
      const nameColumns = ['name', 'supervisor name', 'full name'];
      const deptColumns = ['department', 'dept', 'division'];
      
      const hasNameColumn = nameColumns.some(col => 
        parsedData.headers.some(header => header.toLowerCase().includes(col))
      );
      
      const hasDeptColumn = deptColumns.some(col => 
        parsedData.headers.some(header => header.toLowerCase().includes(col))
      );
      
      if (!hasNameColumn) {
        throw new Error(`CSV must contain a name column. Found columns: ${parsedData.headers.join(', ')}`);
      }
      
      if (!hasDeptColumn) {
        throw new Error(`CSV must contain a department column. Found columns: ${parsedData.headers.join(', ')}`);
      }
      
      const processedSupervisors = parsedData.rows.map(row => {
        // Name: key with 'name' but NOT 'department' (avoid "Department Name" as name)
        const nameKey = Object.keys(row).find(key => {
          const k = key.toLowerCase();
          return k.includes('name') && !k.includes('department');
        }) || Object.keys(row).find(key => key.toLowerCase() === 'name');
        // Department: use ONLY the value from CSV so we never overwrite another department
        const deptKey = Object.keys(row).find(key => {
          const k = key.toLowerCase();
          return k.includes('department') || k.includes('dept');
        });
        const name = (nameKey ? row[nameKey] : row.name || row.Name || '').toString().trim();
        const department = (deptKey ? (row[deptKey] ?? '') : (row.department ?? row.Department ?? '')).toString().trim();
        const emailKey = Object.keys(row).find((k) => k.toLowerCase().includes('email'));
        const phoneKey = Object.keys(row).find(
          (k) => k.toLowerCase().includes('phone') || k.toLowerCase().includes('tel') || k.toLowerCase().includes('mobile')
        );
        const email = emailKey ? String(row[emailKey] ?? '').trim() || undefined : undefined;
        const phone = phoneKey ? String(row[phoneKey] ?? '').trim() || undefined : undefined;
        const workloadKey = Object.keys(row).find((k) => {
          const x = k.toLowerCase().replace(/\s+/g, '_');
          return (
            x === 'workload' ||
            x === 'max_groups' ||
            x === 'maxgroups' ||
            (x.includes('max') && x.includes('group'))
          );
        });
        let max_groups: number | undefined;
        if (workloadKey) {
          const v = String(row[workloadKey] ?? '').trim();
          if (v !== '') {
            const n = Number(v);
            if (!Number.isNaN(n) && n >= 0) max_groups = n;
          }
        }
        const rowOut: Record<string, unknown> = { name: name || 'Unknown', department, email, phone };
        if (max_groups !== undefined) rowOut.max_groups = max_groups;
        return rowOut;
      }).filter(s => s.name && s.name !== 'Unknown' && s.department);
      
      if (processedSupervisors.length === 0) {
        throw new Error('No valid supervisor rows found. Ensure CSV has Name and Department columns with non-empty values. Department must match exactly (e.g. "Computer Science").');
      }
      
      setUploadedSupervisors(processedSupervisors as any[]);
      setUploading(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error processing file. Please check the format.');
      setUploading(false);
    }
    
    // Reset file input
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleAutoAssignSupervisors = async () => {
    if (uploadedSupervisors.length === 0) {
      alert('Please upload supervisor data first');
      return;
    }

    setAssigning(true);
    
    try {
      // First upload the supervisors to database
      const uploadResponse = await apiClient.uploadSupervisors(uploadedSupervisors);
      if (!uploadResponse.success) {
        throw new Error(uploadResponse.message || 'Failed to upload supervisors');
      }

      // Then auto-assign supervisors to groups
      const assignResponse = await apiClient.autoAssignSupervisors(selectedDepartment || undefined);
      if (!assignResponse.success) {
        throw new Error(assignResponse.message || 'Failed to auto-assign supervisors');
      }

      // Sync workload counters from actual project_groups (fixes 0 groups display)
      await apiClient.syncSupervisorWorkload();
      await loadSupervisorWorkload();
      await syncWithDatabase();
      
      setUploadedSupervisors([]);
      setAssigning(false);
    } catch (error) {
      console.error('Error in auto-assignment:', error);
      alert(error instanceof Error ? error.message : 'Failed to assign supervisors');
      setAssigning(false);
    }
  };

  /** Auto-assign using existing supervisors in the system (no upload needed) - for when groups were reformed but supervisors already exist */
  const handleAutoAssignFromExisting = async () => {
    if (supervisors.length === 0) {
      alert('No supervisors in the system. Upload supervisor CSV in the Upload & Assign tab first.');
      return;
    }
    if (unassignedGroups.length === 0) {
      alert('No groups awaiting assignment. All groups are already assigned.');
      return;
    }
    setAssigning(true);
    try {
      const assignResponse = await apiClient.autoAssignSupervisors(selectedDepartment || undefined);
      if (!assignResponse.success) {
        throw new Error(assignResponse.message || 'Failed to auto-assign supervisors');
      }
      await apiClient.syncSupervisorWorkload();
      await loadSupervisorWorkload();
      await syncWithDatabase();
      setAssigning(false);
    } catch (error) {
      console.error('Error in auto-assignment:', error);
      alert(error instanceof Error ? error.message : 'Failed to assign supervisors');
      setAssigning(false);
    }
  };

  const getMemberMatric = (groupId: number, memberIndex: number) => {
    const g = departmentGroups.find(gg => gg.id === groupId);
    const member = Array.isArray(g?.members) ? g.members[memberIndex] : null;
    return (member as any)?.matricNumber || 'N/A';
  };

  const handleClearAllSupervisors = async () => {
    setClearing(true);
    try {
      const res = await apiClient.clearAllSupervisors(selectedDepartment || undefined);
      if (res.success) {
        await loadSupervisorWorkload();
        await syncWithDatabase();
        setClearAllModal(false);
        setUploadedSupervisors([]);
      } else {
        alert(res.message || res.error || 'Failed to clear');
      }
    } catch (e) {
      alert('Failed to clear supervisors');
    } finally {
      setClearing(false);
    }
  };

  const downloadAssignments = (format: 'csv' | 'pdf' | 'word') => {
    if (convertedGroups.length === 0) {
      alert('No assignments to download');
      return;
    }
    const filename = `${userDepartment.toLowerCase().replace(/\s+/g, '_')}_supervisor_assignments`;
    const normalizeGroupName = (name: string) => {
      const m = String(name || '').match(/Group\s*(\d+)/i) || String(name || '').match(/(\d+)\s*$/);
      return m ? `Group ${m[1]}` : String(name || '').trim();
    };
    const groupsWithId = convertedGroups.map(g => ({
      id: g.id,
      name: normalizeGroupName(g.name),
      members: g.members,
      supervisor: g.supervisor
    }));
    if (format === 'csv') {
      downloadAssignmentsAsCSV(groupsWithId, getMemberMatric, `${filename}.csv`);
    } else if (format === 'pdf') {
      downloadAssignmentsAsPDF(groupsWithId, getMemberMatric);
    } else {
      downloadAssignmentsAsWord(groupsWithId, getMemberMatric);
    }
  };

  const unassignedGroups = convertedGroups.filter(g => !g.supervisor);
  const assignedGroups = convertedGroups.filter(g => g.supervisor);
  const groupsForSupervisor = (name: string) => {
    if (name.startsWith('__group_')) {
      const gid = parseInt(name.replace('__group_', ''), 10);
      const g = departmentGroups.find(gg => gg.id === gid);
      return g ? [g] : [];
    }
    return departmentGroups.filter(g => g.supervisor && g.supervisor === name);
  };

  const handleSwap = async () => {
    if (!swapMember1 || !swapMember2) return;
    setSwapping(true);
    try {
      const res = await apiClient.swapGroupMembers(
        { groupId: swapMember1.groupId, memberId: swapMember1.memberId },
        { groupId: swapMember2.groupId, memberId: swapMember2.memberId }
      );
      if (res.success) {
        await syncWithDatabase();
        await loadSupervisorWorkload();
        setEditSwapModal(false);
        setSwapMember1(null);
        setSwapMember2(null);
      } else {
        alert(res.message || res.error || 'Swap failed');
      }
    } catch (e) {
      alert('Failed to swap students');
    } finally {
      setSwapping(false);
    }
  };

  const normalizeText = (value: string) => value.toLowerCase().trim();
  const getMemberLabel = (groupName: string, member: any) =>
    `${member.name} (${groupName})${member.tier ? ` - ${member.tier}` : ''}`;

  const swapOptionsA = departmentGroups.flatMap((g) =>
    Array.isArray(g.members)
      ? g.members
          .filter((m: any) => {
            const q = normalizeText(swapSearch1);
            if (!q) return true;
            const haystack = normalizeText(`${m.name} ${m.matricNumber || ''} ${g.name}`);
            return haystack.includes(q);
          })
          .map((m: any) => ({
            groupId: g.id,
            memberId: m.id,
            label: getMemberLabel(g.name, m),
            name: m.name,
            tier: m.tier
          }))
      : []
  );

  const swapOptionsB = swapMember1
    ? departmentGroups.flatMap((g) =>
        Array.isArray(g.members)
          ? g.members
              .filter((m: any) => {
                const sameTier = (m.tier || '') === (swapMember1.tier || '');
                const notSameMember = !(g.id === swapMember1.groupId && m.id === swapMember1.memberId);
                if (!sameTier || !notSameMember) return false;
                const q = normalizeText(swapSearch2);
                if (!q) return true;
                const haystack = normalizeText(`${m.name} ${m.matricNumber || ''} ${g.name}`);
                return haystack.includes(q);
              })
              .map((m: any) => ({
                groupId: g.id,
                memberId: m.id,
                label: `${m.name} (${g.name})`,
                name: m.name,
                tier: m.tier
              }))
          : []
      )
    : [];

  const moveStudentOptions = departmentGroups.flatMap((g) =>
    Array.isArray(g.members)
      ? g.members
          .filter((m: any) => {
            const q = normalizeText(moveSearch);
            if (!q) return true;
            const haystack = normalizeText(`${m.name} ${m.matricNumber || ''} ${g.name}`);
            return haystack.includes(q);
          })
          .map((m: any) => ({
            groupId: g.id,
            memberId: m.id,
            label: getMemberLabel(g.name, m),
            name: m.name,
          }))
      : []
  );

  const moveTargetGroups = moveStudent
    ? departmentGroups.filter((g) => g.id !== moveStudent.groupId)
    : [];

  const handleMoveStudentToGroup = async () => {
    if (!moveStudent || moveTargetGroupId === '') return;
    setMoveDoing(true);
    try {
      const res = await apiClient.moveGroupMember({
        memberId: moveStudent.memberId,
        fromGroupId: moveStudent.groupId,
        toGroupId: Number(moveTargetGroupId),
        swapType: 'STUDENT_GROUP',
      });
      if (res.success) {
        await syncWithDatabase();
        await loadSupervisorWorkload();
        setMoveStudent(null);
        setMoveTargetGroupId('');
        setMoveSearch('');
        setEditSwapModal(false);
      } else {
        alert((res as any).message || 'Move failed');
      }
    } catch {
      alert('Failed to move student');
    } finally {
      setMoveDoing(false);
    }
  };

  const handleReassignGroupSupervisor = async () => {
    if (reassignGroupId === '' || !reassignSupervisorName.trim()) return;
    setReassignDoing(true);
    try {
      const res = await apiClient.assignSupervisor(Number(reassignGroupId), reassignSupervisorName.trim());
      if (res.success) {
        await syncWithDatabase();
        await loadSupervisorWorkload();
        setReassignGroupId('');
        setReassignSupervisorName('');
        setEditSwapModal(false);
      } else {
        alert((res as any).message || 'Reassignment failed');
      }
    } catch {
      alert('Failed to assign supervisor');
    } finally {
      setReassignDoing(false);
    }
  };

  if (loading) {
    return (
      <MainLayout title="Supervisor Assignment">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading supervisor assignment data...</div>
        </div>
      </MainLayout>
    );
  }

  const filteredUnassigned = groupsSearch
    ? unassignedGroups.filter(g => g.name.toLowerCase().includes(groupsSearch.toLowerCase()) || g.members.some((m: string) => m.toLowerCase().includes(groupsSearch.toLowerCase())))
    : unassignedGroups;
  const filteredAssigned = groupsSearch
    ? assignedGroups.filter(g => g.name.toLowerCase().includes(groupsSearch.toLowerCase()) || g.supervisor?.toLowerCase().includes(groupsSearch.toLowerCase()) || g.members.some((m: string) => m.toLowerCase().includes(groupsSearch.toLowerCase())))
    : assignedGroups;

  const tabs = [
    { id: 'workload' as const, label: 'Supervisor Workload', icon: UserCheck },
    { id: 'groups' as const, label: 'Groups', icon: Users },
    { id: 'upload' as const, label: 'Upload & Assign', icon: Upload }
  ];

  return (
    <MainLayout title="Supervisor Assignment">
      <div className="flex flex-col gap-4 flex-1 min-h-0">
        {/* Header */}
        <Card className="border border-slate-200 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Supervisor Assignment</h2>
              <p className="text-sm text-slate-600 flex items-center gap-1 mt-0.5">
                <Building size={14} />
                {selectedDepartment || (isSystemAdmin ? 'Select a department above' : userDepartment)}
              </p>
            </div>
            <div className="relative" ref={actionsDropdownRef}>
              <Button
                variant="outline"
                onClick={() => setActionsMenuOpen((o) => !o)}
                disabled={!selectedDepartment}
                className="min-w-[140px]"
              >
                <Edit size={14} className="mr-1.5" />
                Actions
                <ChevronDown size={14} className={`ml-1.5 transition-transform ${actionsMenuOpen ? 'rotate-180' : ''}`} />
              </Button>
              {actionsMenuOpen && selectedDepartment && (
                <div className="absolute right-0 top-full mt-1 py-1 min-w-[220px] bg-white border border-slate-200 rounded-lg shadow-lg z-20">
                  {convertedGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setClearAllModal(true);
                        setActionsMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 text-red-600"
                    >
                      <Trash2 size={14} />
                      Clear all supervisors
                    </button>
                  )}
                  {convertedGroups.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          downloadAssignments('csv');
                          setActionsMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                      >
                        <FileSpreadsheet size={14} />
                        Export CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          downloadAssignments('pdf');
                          setActionsMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                      >
                        <FileText size={14} />
                        Export PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          downloadAssignments('word');
                          setActionsMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                      >
                        <File size={14} />
                        Export Word
                      </button>
                    </>
                  )}
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setSwapWizardTab('swap');
                      setEditSwapModal(true);
                      setActionsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-800 font-medium"
                  >
                    <Users size={14} />
                    Swaps &amp; transfers
                  </button>
                </div>
              )}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
        </Card>

        {/* Department selector */}
        <Card className="border border-[#1F7A8C]/30 bg-[#1F7A8C]/5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-[#022B3A] flex items-center gap-2">
              <Building className="w-4 h-4 text-[#1F7A8C]" />
              Select Department
            </h2>
            <div className="relative min-w-[220px]">
              <select
                value={selectedDepartment}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="w-full appearance-none px-3 py-2 pr-9 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent bg-white text-slate-900"
              >
                <option value="">Select department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative min-w-[200px]">
              <select
                value={selectedSessionId === '' ? '' : String(selectedSessionId)}
                onChange={(e) => setSelectedSessionId(e.target.value ? Number(e.target.value) : '')}
                className="w-full appearance-none px-3 py-2 pr-9 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent bg-white text-slate-900"
              >
                <option value="">All sessions</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {selectedDepartment && (
              <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Working on: {selectedDepartment}
              </span>
            )}
          </div>
        </Card>

        {/* Stats - total supervisors always; groups/assigned/awaiting when department selected */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{convertedGroups.length}</p>
                <p className="text-sm text-slate-500">Total Groups{selectedDepartment ? ` (${selectedDepartment})` : ''}</p>
              </div>
            </div>
          </Card>
          <Card className="border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1F7A8C]/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-[#1F7A8C]" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{assignedGroups.length}</p>
                <p className="text-sm text-slate-500">Assigned</p>
              </div>
            </div>
          </Card>
          <Card className="border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1F7A8C]/10 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#1F7A8C]" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{unassignedGroups.length}</p>
                <p className="text-sm text-slate-500">Awaiting</p>
              </div>
            </div>
          </Card>
          <Card className="border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1F7A8C]/10 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-[#1F7A8C]" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{totalStats.totalSupervisors}</p>
                <p className="text-sm text-slate-500">Total Supervisors (all departments)</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === id ? 'bg-white border border-slate-200 border-b-0 text-slate-900 -mb-px' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon size={16} />
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab: Supervisor Workload (Default) - only show when groups exist (groups precede supervisors) */}
        {activeTab === 'workload' && (
        <>
        <Card className="border border-slate-200 p-6 flex-1 min-h-0 flex flex-col">
          {!selectedDepartment ? (
            <div className="text-center py-12 text-slate-500">
              <Building className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <p className="font-medium">Select a department above</p>
              <p className="text-sm mt-1">Each department has its own lecturers. Pick a department to view and assign supervisors.</p>
            </div>
          ) : (
          <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-slate-900">Supervisor Workload – {selectedDepartment}</h3>
              {departmentSupervisors.length > 0 && (
                <span className="text-sm text-slate-500">{departmentSupervisors.length} supervisors in this department</span>
              )}
            </div>
            {departmentSupervisors.length > 0 && unassignedGroups.length > 0 && (
              <Button onClick={handleAutoAssignFromExisting} disabled={assigning} className="bg-[#1F7A8C] hover:bg-[#2a8a9c]">
                {assigning ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />Assigning...</>
                ) : (
                  <><UserCheck className="mr-2" size={16} />Auto-Assign</>
                )}
              </Button>
            )}
          </div>
          {departmentSupervisors.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <p className="font-medium">No supervisors in {selectedDepartment}</p>
              <p className="text-sm mt-1">Upload supervisor CSV in the Upload & Assign tab (include Department column matching &quot;{selectedDepartment}&quot;)</p>
              <Button variant="outline" className="mt-4" onClick={() => setActiveTab('upload')}>Go to Upload</Button>
            </div>
          ) : (
            <>
            <div className="space-y-5 flex-1 min-h-0 overflow-y-auto">
              {(selectedDepartment && (departmentSupervisorsByDept as Record<string, any>)[selectedDepartment]
                ? [(departmentSupervisorsByDept as Record<string, any>)[selectedDepartment]]
                : Object.values(departmentSupervisorsByDept)
              ).map((dept: any) => (
                <div key={dept.department} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h5 className="font-semibold text-slate-900">{dept.department}</h5>
                      <p className="text-xs text-slate-500">
                        {dept.departmentStats.count} supervisors · {dept.departmentStats.totalAssigned} groups assigned
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#1F7A8C]/15 text-[#1F7A8C]">
                        {dept.departmentStats.totalAssigned} groups
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dept.supervisors.map((supervisor: any) => {
                      const supGroups = groupsForSupervisor(supervisor.name);
                      return (
                        <div key={supervisor.id} className="bg-slate-50 border border-slate-100 rounded-lg p-4 hover:border-slate-200 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h6 className="text-base font-medium text-slate-900 truncate">{supervisor.name}</h6>
                              <p className="text-sm text-slate-500">{(supervisor.current_groups || 0)} groups assigned</p>
                              <p className="text-xs text-slate-600 mt-2">
                                Cap:{' '}
                                {supervisor.max_groups != null && supervisor.max_groups !== ''
                                  ? supervisor.max_groups
                                  : 'None'}
                              </p>
                              {(supervisor.email || supervisor.phone) && (
                                <p className="text-xs text-slate-500 mt-1 truncate">
                                  {[supervisor.email, supervisor.phone].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-[#1F7A8C]/15 text-[#1F7A8C]">
                                {(supervisor.current_groups || 0)} groups
                              </span>
                              <div className="flex gap-1">
                                {supGroups.length > 0 && (
                                  <button onClick={() => setViewGroupsSupervisor(supervisor.name)} className="p-1.5 rounded hover:bg-slate-200 text-slate-600" title="View groups">
                                    <Eye size={14} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWorkloadEditSupervisor({ id: supervisor.id, name: supervisor.name });
                                    setWorkloadCapInput((prev) => ({
                                      ...prev,
                                      [supervisor.id]:
                                        supervisor.max_groups != null && supervisor.max_groups !== ''
                                          ? String(supervisor.max_groups)
                                          : '',
                                    }));
                                  }}
                                  className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                                  title="Edit workload cap"
                                >
                                  <SlidersHorizontal size={14} />
                                </button>
                                {supGroups.length > 0 && (
                                  <button onClick={() => { setSwapWizardTab('swap'); setEditSwapModal(true); }} className="p-1.5 rounded hover:bg-slate-200 text-slate-600" title="Edit / Swap">
                                    <Edit size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
          </>
          )}
        </Card>
        {workloadEditSupervisor && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setWorkloadEditSupervisor(null)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-slate-900">Workload cap</h3>
                <button
                  type="button"
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                  onClick={() => setWorkloadEditSupervisor(null)}
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-slate-800 font-medium">{workloadEditSupervisor.name}</p>
              <p className="text-xs text-slate-500">
                Usually set from supervisor CSV; you can override here. Leave empty for no limit.
              </p>
              <div>
                <label className="text-xs font-medium text-slate-700" htmlFor="workload-cap-modal">
                  Max groups
                </label>
                <input
                  id="workload-cap-modal"
                  type="number"
                  min={0}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="No cap"
                  value={workloadCapInput[workloadEditSupervisor.id] ?? ''}
                  onChange={(e) =>
                    setWorkloadCapInput((prev) => ({
                      ...prev,
                      [workloadEditSupervisor.id]: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setWorkloadEditSupervisor(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-[#1F7A8C]"
                  onClick={async () => {
                    const raw = (workloadCapInput[workloadEditSupervisor.id] ?? '').trim();
                    const v = raw === '' ? null : Number(raw);
                    if (v !== null && (Number.isNaN(v) || v < 0)) {
                      alert('Enter a non-negative number or leave empty for no cap');
                      return;
                    }
                    await apiClient.updateSupervisorWorkloadCap(workloadEditSupervisor.id, v);
                    await loadSupervisorWorkload();
                    setWorkloadEditSupervisor(null);
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
        </>
        )}

        {/* Tab: Groups */}
        {activeTab === 'groups' && (
        <div className="space-y-4">
          {!selectedDepartment ? (
            <Card className="border border-slate-200 p-12 text-center">
              <Building className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <p className="font-medium text-slate-600">Select a department above</p>
              <p className="text-sm text-slate-500 mt-1">Groups and assignments are shown per department.</p>
            </Card>
          ) : (
          <>
          <Card className="border border-slate-200 p-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Search groups or members..."
                value={groupsSearch}
                onChange={(e) => setGroupsSearch(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Awaiting Assignment ({filteredUnassigned.length})</h3>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredUnassigned.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    {groupsSearch ? 'No matches' : 'No groups awaiting assignment'}
                  </div>
                ) : (
                  filteredUnassigned.map((group) => {
                    const fullGroup = departmentGroups.find(g => g.id === group.id);
                    return (
                      <div key={group.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="text-base font-medium text-slate-900 truncate">{group.name}</p>
                          <p className="text-sm text-slate-500 truncate">{group.members.join(', ')}</p>
                        </div>
                        <button onClick={() => fullGroup && setViewGroupsSupervisor(`__group_${fullGroup.id}`)} className="p-2 rounded hover:bg-slate-200 text-slate-600">
                          <Eye size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
            <Card className="border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Assigned ({filteredAssigned.length})</h3>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredAssigned.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    {groupsSearch ? 'No matches' : 'No assigned groups yet'}
                  </div>
                ) : (
                  filteredAssigned.map((group) => (
                    <div key={group.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="text-base font-medium text-slate-900 truncate">{group.name}</p>
                        <p className="text-sm text-[#1F7A8C] font-medium">{group.supervisor}</p>
                        <p className="text-sm text-slate-500 truncate">{group.members.join(', ')}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => group.supervisor && setViewGroupsSupervisor(group.supervisor)} className="p-2 rounded hover:bg-slate-200 text-slate-600" title="View">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => { setSwapWizardTab('swap'); setEditSwapModal(true); }} className="p-2 rounded hover:bg-slate-200 text-slate-600" title="Edit">
                          <Edit size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
          </>
          )}
        </div>
        )}

        {/* Tab: Upload & Assign */}
        {activeTab === 'upload' && (
        <div className={`flex flex-col gap-4 ${uploadedSupervisors.length > 0 ? 'flex-1 min-h-0' : ''}`}>
          {uploading && (
            <Card className="border border-slate-200 p-4">
              <div className="flex items-center gap-3 text-slate-600">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-slate-600" />
                <span>Processing uploaded supervisor data...</span>
              </div>
            </Card>
          )}
          {uploadedSupervisors.length > 0 ? (
            <Card className="border border-slate-200 p-6 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Uploaded Supervisors ({uploadedSupervisors.length})</h3>
                <Button onClick={handleAutoAssignSupervisors} disabled={assigning} className="bg-[#1F7A8C] hover:bg-[#2a8a9c]">
                  {assigning ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />Assigning...</>
                  ) : (
                    <><UserCheck className="mr-2" size={16} />Auto-Assign</>
                  )}
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 flex-1 min-h-0 overflow-y-auto">
                {uploadedSupervisors.map((s, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-4">
                    <p className="text-base font-medium truncate">{s.name}</p>
                    <p className="text-sm text-slate-500">{s.department}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="py-12 text-center">
              <Upload className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <p className="font-medium text-slate-700">Upload supervisor CSV to get started</p>
              <p className="text-sm text-slate-500 mt-1">Required columns: Name, Department</p>
              <Button className="mt-4" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2" size={16} />
                Choose File
              </Button>
            </Card>
          )}
        </div>
        )}

        {/* View Groups Modal */}
        {viewGroupsSupervisor && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewGroupsSupervisor(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  {viewGroupsSupervisor.startsWith('__group_') ? 'Group Details' : `Groups – ${viewGroupsSupervisor}`}
                </h3>
                <button onClick={() => setViewGroupsSupervisor(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
                {groupsForSupervisor(viewGroupsSupervisor).map((g) => (
                  <div key={g.id} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">{g.name}</h4>
                    <div className="space-y-2">
                      {Array.isArray(g.members) ? g.members.map((m: any, i: number) => (
                        <div key={i} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                          <span className="font-medium">{m.name}</span>
                          <span className="text-gray-600">{m.matricNumber || 'N/A'}</span>
                          <span className="text-gray-600">GPA: {m.gpa != null ? m.gpa : 'N/A'}</span>
                        </div>
                      )) : (
                        <p className="text-gray-500">No members</p>
                      )}
                    </div>
                  </div>
                ))}
                {groupsForSupervisor(viewGroupsSupervisor).length === 0 && (
                  <p className="text-gray-500 text-center py-6">No groups to display</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Clear All Confirmation */}
        <ConfirmationModal
          isOpen={clearAllModal}
          onClose={() => !clearing && setClearAllModal(false)}
          onConfirm={handleClearAllSupervisors}
          title="Clear Supervisors"
          message={selectedDepartment
            ? `This will clear supervisors and assignments for ${selectedDepartment}.`
            : 'This will remove all supervisors and unassign all groups.'}
          confirmText="Clear"
          cancelText="Cancel"
          type="danger"
        />

        {/* Swaps & transfers (swap / move / reassign supervisor) */}
        {editSwapModal && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => !swapping && !moveDoing && !reassignDoing && setEditSwapModal(false)}
          >
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Swaps &amp; transfers</h3>
                <button
                  onClick={() => !swapping && !moveDoing && !reassignDoing && setEditSwapModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex gap-1 px-4 pt-3 border-b border-slate-100">
                {(
                  [
                    { id: 'swap' as const, label: 'Student ↔ Student' },
                    { id: 'move' as const, label: 'Move to group' },
                    { id: 'reassign' as const, label: 'Group ↔ Supervisor' },
                  ]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSwapWizardTab(t.id)}
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
                      swapWizardTab === t.id
                        ? 'border-[#1F7A8C] text-[#022B3A]'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {swapWizardTab === 'swap' && (
              <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
                <p className="text-sm text-gray-600">Select two students from different groups to swap. Students can only be swapped within the same GPA tier (HIGH↔HIGH, MEDIUM↔MEDIUM, LOW↔LOW).</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Student A</label>
                    <input
                      type="text"
                      value={swapSearch1}
                      onChange={(e) => setSwapSearch1(e.target.value)}
                      placeholder="Search by name, matric, or group..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
                    />
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={swapMember1 ? `${swapMember1.groupId}-${swapMember1.memberId}` : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) { setSwapMember1(null); setSwapMember2(null); return; }
                        const [gid, mid] = v.split('-').map(Number);
                        const g = departmentGroups.find(gg => gg.id === gid);
                        const m = g?.members?.find((mm: any) => mm.id === mid);
                        if (m) {
                          setSwapMember1({ groupId: gid, memberId: mid, name: m.name, tier: m.tier });
                          setSwapMember2(null);
                        } else {
                          setSwapMember1(null);
                          setSwapMember2(null);
                        }
                      }}
                    >
                      <option value="">Select student...</option>
                      {swapOptionsA.map((opt) => (
                        <option key={`${opt.groupId}-${opt.memberId}`} value={`${opt.groupId}-${opt.memberId}`}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {swapSearch1 && (
                      <p className="text-xs text-slate-500 mt-1">{swapOptionsA.length} match(es)</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Student B (same tier only)</label>
                    <input
                      type="text"
                      value={swapSearch2}
                      onChange={(e) => setSwapSearch2(e.target.value)}
                      placeholder={swapMember1 ? 'Search by name, matric, or group...' : 'Select Student A first'}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
                      disabled={!swapMember1}
                    />
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={swapMember2 ? `${swapMember2.groupId}-${swapMember2.memberId}` : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) { setSwapMember2(null); return; }
                        const [gid, mid] = v.split('-').map(Number);
                        const g = departmentGroups.find(gg => gg.id === gid);
                        const m = g?.members?.find((mm: any) => mm.id === mid);
                        setSwapMember2(m ? { groupId: gid, memberId: mid, name: m.name, tier: m.tier } : null);
                      }}
                      disabled={!swapMember1}
                    >
                      <option value="">{swapMember1 ? `Select ${swapMember1.tier || 'same tier'} student...` : 'Select Student A first'}</option>
                      {swapOptionsB.map((opt) => (
                        <option key={`${opt.groupId}-${opt.memberId}`} value={`${opt.groupId}-${opt.memberId}`}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {swapMember1 && swapSearch2 && (
                      <p className="text-xs text-slate-500 mt-1">{swapOptionsB.length} match(es)</p>
                    )}
                  </div>
                </div>
                {swapMember1 && swapMember2 && swapMember1.groupId === swapMember2.groupId && (
                  <p className="text-sm text-[#1F7A8C]">Select students from different groups.</p>
                )}
                {swapMember1 && swapMember2 && swapMember1.tier !== swapMember2.tier && (
                  <p className="text-sm text-red-600">Students must be in the same tier to swap.</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditSwapModal(false)} disabled={swapping}>Cancel</Button>
                  <Button
                    onClick={handleSwap}
                    disabled={swapping || !swapMember1 || !swapMember2 || swapMember1.groupId === swapMember2.groupId || swapMember1.tier !== swapMember2.tier}
                  >
                    {swapping ? 'Swapping...' : 'Swap Students'}
                  </Button>
                </div>
              </div>
              )}

              {swapWizardTab === 'move' && (
                <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
                  <p className="text-sm text-gray-600">
                    Move one student into another group in this department. Source and target must share the same academic session; formation rules (tier balance, max 3 per group) still apply.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Search student</label>
                    <input
                      type="text"
                      value={moveSearch}
                      onChange={(e) => setMoveSearch(e.target.value)}
                      placeholder="Name, matric, or group..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
                    />
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={moveStudent ? `${moveStudent.groupId}-${moveStudent.memberId}` : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) {
                          setMoveStudent(null);
                          setMoveTargetGroupId('');
                          return;
                        }
                        const [gid, mid] = v.split('-').map(Number);
                        const g = departmentGroups.find((gg) => gg.id === gid);
                        const m = g?.members?.find((mm: any) => mm.id === mid);
                        if (m) {
                          setMoveStudent({ groupId: gid, memberId: mid, name: m.name });
                          setMoveTargetGroupId('');
                        } else {
                          setMoveStudent(null);
                        }
                      }}
                    >
                      <option value="">Select student...</option>
                      {moveStudentOptions.map((opt) => (
                        <option key={`${opt.groupId}-${opt.memberId}`} value={`${opt.groupId}-${opt.memberId}`}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target group</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={moveTargetGroupId === '' ? '' : String(moveTargetGroupId)}
                      onChange={(e) => setMoveTargetGroupId(e.target.value ? Number(e.target.value) : '')}
                      disabled={!moveStudent}
                    >
                      <option value="">{moveStudent ? 'Choose destination group...' : 'Select a student first'}</option>
                      {moveTargetGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                          {(g as any).supervisor ? ` — ${(g as any).supervisor}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setEditSwapModal(false)} disabled={moveDoing}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleMoveStudentToGroup}
                      disabled={moveDoing || !moveStudent || moveTargetGroupId === ''}
                    >
                      {moveDoing ? 'Moving...' : 'Move student'}
                    </Button>
                  </div>
                </div>
              )}

              {swapWizardTab === 'reassign' && (
                <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
                  <p className="text-sm text-gray-600">
                    Assign or change the supervisor for a group. Workload caps and notifications follow the same rules as the main assignment flow.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Group</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={reassignGroupId === '' ? '' : String(reassignGroupId)}
                      onChange={(e) => setReassignGroupId(e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">Select group...</option>
                      {departmentGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                          {(g as any).supervisor ? ` — current: ${(g as any).supervisor}` : ' — unassigned'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Supervisor</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={reassignSupervisorName}
                      onChange={(e) => setReassignSupervisorName(e.target.value)}
                    >
                      <option value="">Select supervisor...</option>
                      {(departmentSupervisors as any[]).map((s: any) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setEditSwapModal(false)} disabled={reassignDoing}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleReassignGroupSupervisor}
                      disabled={reassignDoing || reassignGroupId === '' || !reassignSupervisorName.trim()}
                    >
                      {reassignDoing ? 'Saving...' : 'Assign supervisor'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}