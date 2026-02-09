import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { 
  Users, Upload, Download, UserCheck, AlertCircle, 
  Eye, Edit, CheckCircle, Clock, FileText, Building 
} from 'lucide-react';
import { parseCSV, generateCSV, readFileAsText } from '../../lib/csv-parser';
import { useGroups } from '../../contexts/GroupsContext';
import { useDepartment } from '../../contexts/DepartmentContext';
import { apiClient } from '../../lib/api';

export function SupervisorAssignment() {
  const { groups, updateGroup, syncWithDatabase } = useGroups();
  const { userDepartment, isSystemAdmin, filterByDepartment } = useDepartment();
  const [supervisors, setSupervisors] = useState([]);
  const [supervisorsByDepartment, setSupervisorsByDepartment] = useState({});
  const [totalStats, setTotalStats] = useState({
    totalSupervisors: 0,
    totalCapacity: 0,
    totalAssigned: 0,
    availableSlots: 0,
    departments: 0,
    averageWorkload: 0,
    userDepartment: '',
    isSystemAdmin: false
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [uploadedSupervisors, setUploadedSupervisors] = useState([]);
  const fileInputRef = useRef(null);

  // Load supervisor workload from database
  useEffect(() => {
    loadSupervisorWorkload();
  }, []);

  const loadSupervisorWorkload = async () => {
    try {
      const response = await apiClient.getSupervisorWorkload();
      if (response.success && response.data) {
        setSupervisors(response.data.supervisors || []);
        setSupervisorsByDepartment(response.data.supervisorsByDepartment || {});
        setTotalStats(response.data.totalStats || {
          totalSupervisors: 0,
          totalCapacity: 0,
          totalAssigned: 0,
          availableSlots: 0,
          departments: 0,
          averageWorkload: 0,
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
        throw new Error('This appears to be a database export with only primary keys. Please export a CSV with the actual data columns needed (Name, Department, Max Groups).');
      }
      
      // Validate required columns for supervisors
      const nameColumns = ['name', 'supervisor name', 'full name'];
      const deptColumns = ['department', 'dept', 'division'];
      const maxColumns = ['max groups', 'max', 'capacity', 'maximum groups'];
      
      const hasNameColumn = nameColumns.some(col => 
        parsedData.headers.some(header => header.toLowerCase().includes(col))
      );
      
      const hasDeptColumn = deptColumns.some(col => 
        parsedData.headers.some(header => header.toLowerCase().includes(col))
      );
      
      const hasMaxColumn = maxColumns.some(col => 
        parsedData.headers.some(header => header.toLowerCase().includes(col))
      );
      
      if (!hasNameColumn) {
        throw new Error(`CSV must contain a name column. Found columns: ${parsedData.headers.join(', ')}`);
      }
      
      if (!hasDeptColumn) {
        throw new Error(`CSV must contain a department column. Found columns: ${parsedData.headers.join(', ')}`);
      }
      
      if (!hasMaxColumn) {
        throw new Error(`CSV must contain a max groups column. Found columns: ${parsedData.headers.join(', ')}`);
      }
      
      const processedSupervisors = parsedData.rows.map(row => {
        // Find name column
        const nameKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('name')
        );
        
        // Find department column
        const deptKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('department') || 
          key.toLowerCase().includes('dept')
        );
        
        // Find max groups column
        const maxKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('max') || 
          key.toLowerCase().includes('capacity')
        );
        
        return {
          name: nameKey ? row[nameKey] : row.name || row.Name,
          department: deptKey ? row[deptKey] : row.department || row.Department || userDepartment,
          maxGroups: parseInt(maxKey ? row[maxKey] : row['max groups'] || row['Max Groups'] || row.maxGroups || '3')
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

      // Refresh data
      await loadSupervisorWorkload();
      await syncWithDatabase();
      
      setUploadedSupervisors([]);
      setAssigning(false);
      
      alert(`Successfully assigned supervisors to ${assignResponse.data?.assignedCount || 0} groups`);
    } catch (error) {
      console.error('Error in auto-assignment:', error);
      alert(error instanceof Error ? error.message : 'Failed to assign supervisors');
      setAssigning(false);
    }
  };

  const downloadAssignmentsCSV = () => {
    if (convertedGroups.length === 0) {
      alert('No assignments to download');
      return;
    }

    const csvData = convertedGroups.flatMap(group => 
      (Array.isArray(group.members) ? group.members : []).map((memberName, index) => {
        // Find the member's matric number from the original group data
        const originalGroup = departmentGroups.find(g => g.id === group.id);
        const member = Array.isArray(originalGroup?.members) ? originalGroup.members[index] : null;
        
        return {
          'GROUP': group.name.replace('Group ', ''), // Just the number
          'MATRIC NUM': member?.matricNumber || 'N/A',
          'NAME': memberName,
          'PROJECT TITLE': 'Agree on a topic with your supervisor and get approval from the Project Coordinator',
          'SUPERVISOR': group.supervisor || 'Not Assigned'
        };
      })
    );

    generateCSV(csvData, `${userDepartment.toLowerCase().replace(/\s+/g, '_')}_supervisor_assignments.csv`);
  };

  const unassignedGroups = convertedGroups.filter(g => !g.supervisor);
  const assignedGroups = convertedGroups.filter(g => g.supervisor);

  if (loading) {
    return (
      <MainLayout title="Supervisor Assignment">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading supervisor assignment data...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Supervisor Assignment">
      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#1a237e]">Supervisor Assignment</h2>
              <div className="flex items-center gap-2 mt-1">
                <Building className="text-gray-500" size={16} />
                <p className="text-gray-600">
                  {isSystemAdmin ? 'System Admin - All Departments' : `${userDepartment} Department`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2" size={16} />
                Upload Supervisors
              </Button>
              {convertedGroups.length > 0 && (
                <Button variant="outline" onClick={downloadAssignmentsCSV}>
                  <Download className="mr-2" size={16} />
                  Download Assignments
                </Button>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          {/* Persistence Indicator */}
          {convertedGroups.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <p className="text-sm text-blue-800 font-medium">
                  Supervisor assignments are automatically saved and persist across sessions
                </p>
              </div>
              <p className="text-xs text-blue-700 mt-1 ml-4">
                Assignments remain active until groups are cleared by admin or reassigned
              </p>
            </div>
          )}
        </Card>

        {/* Upload Status */}
        {uploading && (
          <Card>
            <div className="flex items-center gap-3 text-blue-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span>Processing uploaded supervisor data...</span>
            </div>
          </Card>
        )}

        {/* Uploaded Supervisors Preview */}
        {uploadedSupervisors.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1a237e]">
                Uploaded Supervisors ({uploadedSupervisors.length})
              </h3>
              <Button 
                onClick={handleAutoAssignSupervisors}
                disabled={assigning}
                className="bg-green-600 hover:bg-green-700"
              >
                {assigning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Assigning Supervisors...
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2" size={16} />
                    Auto-Assign Supervisors
                  </>
                )}
              </Button>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-blue-600 mt-0.5" size={16} />
                <div>
                  <h4 className="font-medium text-blue-900">Assignment Rules</h4>
                  <ul className="text-sm text-blue-800 mt-1 space-y-1">
                    <li>• Supervisors are matched to groups from the same department</li>
                    <li>• Each supervisor has a maximum group capacity</li>
                    <li>• Groups are assigned based on availability and workload balance</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {uploadedSupervisors.map((supervisor, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium">{supervisor.name}</h4>
                  <p className="text-sm text-gray-600">{supervisor.department}</p>
                  <p className="text-xs text-gray-500">Max Groups: {supervisor.maxGroups}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Groups</p>
                <p className="text-2xl font-bold text-[#1a237e]">{convertedGroups.length}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Assigned</p>
                <p className="text-2xl font-bold text-[#1a237e]">{assignedGroups.length}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Awaiting Assignment</p>
                <p className="text-2xl font-bold text-[#1a237e]">{unassignedGroups.length}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <UserCheck className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Available Supervisors</p>
                <p className="text-2xl font-bold text-[#1a237e]">
                  {totalStats.availableSlots}
                </p>
                <p className="text-xs text-gray-500">Available Slots</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Groups List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unassigned Groups */}
          <Card>
            <h3 className="text-lg font-semibold text-[#1a237e] mb-4">
              Groups Awaiting Assignment ({unassignedGroups.length})
            </h3>
            <div className="space-y-3">
              {unassignedGroups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p>No groups awaiting supervisor assignment</p>
                  <p className="text-sm mt-1">Groups will appear here after formation</p>
                </div>
              ) : (
                unassignedGroups.map((group) => (
                  <div key={group.id} className="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{group.name}</h4>
                        <p className="text-sm text-gray-600">Members: {group.members.join(', ')}</p>
                        <p className="text-sm text-gray-600">Department: {group.department}</p>
                        <p className="text-xs text-gray-500">{group.members.length} members</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline">
                          <Eye className="mr-1" size={12} />
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Assigned Groups */}
          <Card>
            <h3 className="text-lg font-semibold text-[#1a237e] mb-4">
              Assigned Groups ({assignedGroups.length})
            </h3>
            <div className="space-y-3">
              {assignedGroups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <UserCheck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p>No groups have been assigned supervisors yet</p>
                  <p className="text-sm mt-1">Assigned groups will appear here</p>
                </div>
              ) : (
                assignedGroups.map((group) => (
                  <div key={group.id} className="border border-green-200 bg-green-50 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{group.name}</h4>
                        <p className="text-sm text-gray-600">Members: {group.members.join(', ')}</p>
                        <p className="text-sm text-green-700 font-medium">Supervisor: {group.supervisor}</p>
                        <p className="text-xs text-gray-500">{group.members.length} members</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline">
                          <Eye className="mr-1" size={12} />
                          View
                        </Button>
                        <Button size="sm" variant="outline">
                          <Edit className="mr-1" size={12} />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Supervisors Overview */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-[#1a237e]">Supervisor Workload - {totalStats.userDepartment || 'Software Engineering'}</h3>
            {totalStats.totalSupervisors > 0 && (
              <div className="text-sm text-gray-600">
                {totalStats.totalSupervisors} supervisors in your department
              </div>
            )}
          </div>
          
          {supervisors.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <p className="text-lg font-medium">No supervisors loaded</p>
              <p className="text-sm mt-1">Upload supervisor data to see workload distribution</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Department Breakdown */}
              {Object.keys(supervisorsByDepartment).length > 0 && (
                <div>
                  <div className="space-y-4">
                    {Object.values(supervisorsByDepartment).map((dept: any) => (
                      <div key={dept.department} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h5 className="font-semibold text-gray-900">{dept.department}</h5>
                            <p className="text-sm text-gray-600">
                              {dept.departmentStats.count} supervisors • 
                              {dept.departmentStats.totalAssigned}/{dept.departmentStats.totalCapacity} capacity • 
                              {dept.departmentStats.availableSlots} slots available
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-[#1a237e]">
                              {dept.departmentStats.averageWorkload}%
                            </span>
                            <p className="text-xs text-gray-500">Average Load</p>
                          </div>
                        </div>
                        
                        {/* Department Progress Bar */}
                        <div className="mb-4">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                dept.departmentStats.averageWorkload >= 90 
                                  ? 'bg-red-500' 
                                  : dept.departmentStats.averageWorkload >= 70 
                                  ? 'bg-yellow-500' 
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(dept.departmentStats.averageWorkload, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Individual Supervisors */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {dept.supervisors.map((supervisor: any) => (
                            <div key={supervisor.id} className="bg-white border border-gray-100 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h6 className="font-medium text-gray-900 text-sm">{supervisor.name}</h6>
                                  <p className="text-xs text-gray-600">
                                    {supervisor.current_groups}/{supervisor.max_groups} groups
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <span className={`text-sm font-medium ${
                                      supervisor.workload_percentage >= 100 
                                        ? 'text-red-600' 
                                        : supervisor.workload_percentage >= 80 
                                        ? 'text-yellow-600' 
                                        : 'text-green-600'
                                    }`}>
                                      {supervisor.workload_percentage}%
                                    </span>
                                  </div>
                                  <div className="w-16 h-2 bg-gray-200 rounded-full">
                                    <div
                                      className={`h-2 rounded-full transition-all duration-300 ${
                                        supervisor.workload_percentage >= 100 
                                          ? 'bg-red-500' 
                                          : supervisor.workload_percentage >= 80 
                                          ? 'bg-yellow-500' 
                                          : 'bg-green-500'
                                      }`}
                                      style={{ 
                                        width: `${Math.min(supervisor.workload_percentage, 100)}%` 
                                      }}
                                    />
                                  </div>
                                  {supervisor.is_available ? (
                                    <div className="w-2 h-2 bg-green-500 rounded-full" title="Available" />
                                  ) : (
                                    <div className="w-2 h-2 bg-red-500 rounded-full" title="Unavailable" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}