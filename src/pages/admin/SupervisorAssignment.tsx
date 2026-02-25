import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { ConfirmationModal } from '../../components/UI/ConfirmationModal';
import { 
  Users, Upload, Download, UserCheck, 
  Eye, Edit, CheckCircle, Clock, Building, X, Trash2, ChevronDown, FileSpreadsheet, FileText, File 
} from 'lucide-react';
import { parseCSV, readFileAsText } from '../../lib/csv-parser';
import { downloadAssignmentsAsCSV, downloadAssignmentsAsPDF, downloadAssignmentsAsWord } from '../../lib/export-utils';
import { useNavigate } from 'react-router-dom';
import { useGroups } from '../../contexts/GroupsContext';
import { useDepartment } from '../../contexts/DepartmentContext';
import { apiClient } from '../../lib/api';

export function SupervisorAssignment() {
  const navigate = useNavigate();
  const { groups, updateGroup, syncWithDatabase } = useGroups();
  const { userDepartment, isSystemAdmin, filterByDepartment } = useDepartment();
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
  const [uploadedSupervisors, setUploadedSupervisors] = useState([]);
  const [viewGroupsSupervisor, setViewGroupsSupervisor] = useState<string | null>(null);
  const [editSwapModal, setEditSwapModal] = useState(false);
  const [swapMember1, setSwapMember1] = useState<{ groupId: number; memberId: number; name: string } | null>(null);
  const [swapMember2, setSwapMember2] = useState<{ groupId: number; memberId: number; name: string } | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [clearAllModal, setClearAllModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [activeTab, setActiveTab] = useState<'workload' | 'groups' | 'upload'>('workload');
  const [groupsSearch, setGroupsSearch] = useState('');
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const fileInputRef = useRef(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Filter groups by department
  const departmentGroups = filterByDepartment(groups);

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
      
      // Validate required columns for supervisors (Name, Department only - no max groups)
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
        const nameKey = Object.keys(row).find(key => key.toLowerCase().includes('name'));
        const deptKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('department') || key.toLowerCase().includes('dept')
        );
        return {
          name: nameKey ? row[nameKey] : row.name || row.Name,
          department: deptKey ? row[deptKey] : row.department || row.Department || userDepartment
        };
      });
      
      setUploadedSupervisors(processedSupervisors);
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
      const assignResponse = await apiClient.autoAssignSupervisors();
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
      const assignResponse = await apiClient.autoAssignSupervisors();
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
      const res = await apiClient.clearAllSupervisors();
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
    const groupsWithId = convertedGroups.map(g => ({
      id: g.id,
      name: g.name,
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
                {isSystemAdmin ? 'All Departments' : userDepartment}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {convertedGroups.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setClearAllModal(true)} className="text-red-600 hover:text-red-700 hover:border-red-300" title="Clear all supervisor assignments from groups">
                  <Trash2 size={14} className="mr-1.5" />
                  Clear All
                </Button>
              )}
              {convertedGroups.length > 0 && (
                <div className="relative" ref={exportDropdownRef}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExportDropdownOpen(o => !o)}
                  >
                    <Download size={14} className="mr-1.5" />
                    Export
                    <ChevronDown size={14} className={`ml-1.5 transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} />
                  </Button>
                  {exportDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 py-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                      <button
                        onClick={() => { downloadAssignments('csv'); setExportDropdownOpen(false); }}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                      >
                        <FileSpreadsheet size={14} className="flex-shrink-0" />
                        CSV
                      </button>
                      <button
                        onClick={() => { downloadAssignments('pdf'); setExportDropdownOpen(false); }}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                      >
                        <FileText size={14} className="flex-shrink-0" />
                        PDF
                      </button>
                      <button
                        onClick={() => { downloadAssignments('word'); setExportDropdownOpen(false); }}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                      >
                        <File size={14} className="flex-shrink-0" />
                        Word
                      </button>
                    </div>
                  )}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => setEditSwapModal(true)}>
                <Edit size={14} className="mr-1.5" />
                Swap Students
              </Button>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{convertedGroups.length}</p>
                <p className="text-sm text-slate-500">Total Groups</p>
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
                <p className="text-sm text-slate-500">Supervisors</p>
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
        <Card className="border border-slate-200 p-6 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-slate-900">Supervisor Workload</h3>
              {totalStats.totalSupervisors > 0 && (
                <span className="text-sm text-slate-500">{totalStats.totalSupervisors} supervisors</span>
              )}
            </div>
            {supervisors.length > 0 && unassignedGroups.length > 0 && (
              <Button onClick={handleAutoAssignFromExisting} disabled={assigning} className="bg-[#1F7A8C] hover:bg-[#2a8a9c]">
                {assigning ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />Assigning...</>
                ) : (
                  <><UserCheck className="mr-2" size={16} />Auto-Assign</>
                )}
              </Button>
            )}
          </div>
          {supervisors.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <p className="font-medium">No supervisors in the system</p>
              <p className="text-sm mt-1">Upload supervisor CSV in the Upload & Assign tab to add supervisors</p>
              <Button variant="outline" className="mt-4" onClick={() => setActiveTab('upload')}>Go to Upload</Button>
            </div>
          ) : (
            <>
            <div className="space-y-5 flex-1 min-h-0 overflow-y-auto">
              {Object.values(supervisorsByDepartment).map((dept: any) => (
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
                              <p className="text-sm text-slate-500">{(supervisor.current_groups || 0)} groups</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-[#1F7A8C]/15 text-[#1F7A8C]">
                                {(supervisor.current_groups || 0)} groups
                              </span>
                              {supGroups.length > 0 && (
                                <div className="flex gap-1">
                                  <button onClick={() => setViewGroupsSupervisor(supervisor.name)} className="p-1.5 rounded hover:bg-slate-200 text-slate-600" title="View groups">
                                    <Eye size={14} />
                                  </button>
                                  <button onClick={() => setEditSwapModal(true)} className="p-1.5 rounded hover:bg-slate-200 text-slate-600" title="Edit / Swap">
                                    <Edit size={14} />
                                  </button>
                                </div>
                              )}
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
        </Card>
        )}

        {/* Tab: Groups */}
        {activeTab === 'groups' && (
        <div className="space-y-4">
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
                        <button onClick={() => setEditSwapModal(true)} className="p-2 rounded hover:bg-slate-200 text-slate-600" title="Edit">
                          <Edit size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
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
          title="Clear All Supervisors"
          message="This will remove all supervisors and unassign all groups. You will need to upload a new supervisor list and re-assign. This cannot be undone."
          confirmText="Clear All"
          cancelText="Cancel"
          type="danger"
        />

        {/* Edit / Swap Members Modal */}
        {editSwapModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !swapping && setEditSwapModal(false)}>
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Swap Students Between Groups</h3>
                <button onClick={() => !swapping && setEditSwapModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <p className="text-sm text-gray-600">Select two students from different groups to swap their assignments.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Student A</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={swapMember1 ? `${swapMember1.groupId}-${swapMember1.memberId}` : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) { setSwapMember1(null); return; }
                        const [gid, mid] = v.split('-').map(Number);
                        const g = departmentGroups.find(gg => gg.id === gid);
                        const m = g?.members?.find((mm: any) => mm.id === mid);
                        setSwapMember1(m ? { groupId: gid, memberId: mid, name: m.name } : null);
                      }}
                    >
                      <option value="">Select student...</option>
                      {departmentGroups.map(g => 
                        Array.isArray(g.members) ? g.members.map((m: any) => (
                          <option key={`${g.id}-${m.id}`} value={`${g.id}-${m.id}`}>
                            {m.name} ({g.name})
                          </option>
                        )) : null
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Student B</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={swapMember2 ? `${swapMember2.groupId}-${swapMember2.memberId}` : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) { setSwapMember2(null); return; }
                        const [gid, mid] = v.split('-').map(Number);
                        const g = departmentGroups.find(gg => gg.id === gid);
                        const m = g?.members?.find((mm: any) => mm.id === mid);
                        setSwapMember2(m ? { groupId: gid, memberId: mid, name: m.name } : null);
                      }}
                    >
                      <option value="">Select student...</option>
                      {departmentGroups.map(g => 
                        Array.isArray(g.members) ? g.members.map((m: any) => (
                          <option key={`${g.id}-${m.id}`} value={`${g.id}-${m.id}`}>
                            {m.name} ({g.name})
                          </option>
                        )) : null
                      )}
                    </select>
                  </div>
                </div>
                {swapMember1 && swapMember2 && swapMember1.groupId === swapMember2.groupId && (
                  <p className="text-sm text-[#1F7A8C]">Select students from different groups.</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditSwapModal(false)} disabled={swapping}>Cancel</Button>
                  <Button
                    onClick={handleSwap}
                    disabled={swapping || !swapMember1 || !swapMember2 || swapMember1.groupId === swapMember2.groupId}
                  >
                    {swapping ? 'Swapping...' : 'Swap Students'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}