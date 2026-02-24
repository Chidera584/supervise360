import { useState, useRef, useEffect } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { ConfirmationModal } from '../../components/UI/ConfirmationModal';
import { Users, Upload, RefreshCw, AlertCircle, Trash2, Building, Settings, Search } from 'lucide-react';
import { parseCSV, readFileAsText } from '../../lib/csv-parser';
import { useGroups } from '../../contexts/GroupsContext';
import { useDepartment } from '../../contexts/DepartmentContext';
import { useGpaThresholds } from '../../hooks/useGpaThresholds';

export function Groups() {
  const { groups, syncWithDatabase, clearGroups, forceRefresh, formGroupsFromStudents } = useGroups();
  const { userDepartment } = useDepartment();
  const { thresholds, loading: thresholdsLoading, refetch: refetchThresholds } = useGpaThresholds(userDepartment);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showThresholdNotice, setShowThresholdNotice] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  console.log('🔍 Groups component rendering with full functionality...');
  console.log('📊 Current GPA thresholds:', thresholds);
  console.log('📊 Thresholds breakdown:', {
    high: thresholds.high,
    medium: thresholds.medium,
    low: thresholds.low,
    loading: thresholdsLoading,
    department: userDepartment
  });

  // Check if thresholds have changed and listen for updates
  useEffect(() => {
    const checkThresholdsChanged = () => {
      const thresholdsChanged = localStorage.getItem('gpa_thresholds_changed');
      if (thresholdsChanged) {
        setShowThresholdNotice(true);
      }
    };

    // Check on mount
    checkThresholdsChanged();

    // Listen for threshold change events - FORCE IMMEDIATE REFETCH
    const handleThresholdChange = () => {
      console.log('🔄 Groups page: Thresholds changed, FORCING immediate refetch...');
      checkThresholdsChanged();
      // Force immediate refetch - no delays
      setTimeout(() => {
        refetchThresholds();
      }, 100); // Small delay to ensure backend has saved
    };

    window.addEventListener('gpa_thresholds_changed', handleThresholdChange);
    window.addEventListener('refresh_gpa_thresholds', handleThresholdChange);
    
    // Also listen for storage events
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'gpa_thresholds_changed') {
        handleThresholdChange();
      }
    };
    window.addEventListener('storage', handleStorage);
    
    return () => {
      window.removeEventListener('gpa_thresholds_changed', handleThresholdChange);
      window.removeEventListener('refresh_gpa_thresholds', handleThresholdChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refetchThresholds]);

  const dismissThresholdNotice = () => {
    localStorage.removeItem('gpa_thresholds_changed');
    setShowThresholdNotice(false);
  };

  // Load groups on component mount
  useEffect(() => {
    const loadGroups = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('🔄 Loading groups from database...');
        await syncWithDatabase();
        console.log('✅ Groups loaded successfully');
      } catch (err) {
        console.error('❌ Failed to load groups:', err);
        setError('Failed to load groups data');
      } finally {
        setIsLoading(false);
      }
    };

    loadGroups();
  }, [syncWithDatabase]);

  // Debug: Log groups data structure
  useEffect(() => {
    console.log('📊 Current groups data:', groups);
    if (groups.length > 0) {
      console.log('📋 Sample group structure:', groups[0]);
      console.log('👥 Sample group members:', groups[0].members);
    }
  }, [groups]);

  const filteredGroups = searchQuery.trim()
    ? groups.filter((group) => {
        const q = searchQuery.toLowerCase();
        const nameMatch = (group.name || '').toLowerCase().includes(q);
        const supervisorMatch = (group.supervisor || '').toLowerCase().includes(q);
        const memberMatch = Array.isArray(group.members)
          ? group.members.some((m: any) => (m.name || '').toLowerCase().includes(q) || (m.matricNumber || m.matric_number || '').toLowerCase().includes(q))
          : false;
        return nameMatch || supervisorMatch || memberMatch;
      })
    : groups;

  const totalStudents = groups.reduce((sum, group) => {
    const members = Array.isArray(group.members) ? group.members : [];
    return sum + members.length;
  }, 0);

  return (
    <MainLayout title="Groups">
      <div className="space-y-6">
        {/* GPA Threshold Change Notice */}
        {showThresholdNotice && (
          <Card>
            <div className="p-4 bg-blue-50 border-l-4 border-blue-400">
              <div className="flex items-start justify-between">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div className="ml-3">
                    <h3 className="text-sm font-semibold text-blue-800">GPA Thresholds Updated</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      The GPA tier thresholds have been changed. To apply the new thresholds to your groups, 
                      please upload students again or regenerate existing groups.
                    </p>
                  </div>
                </div>
                <button
                  onClick={dismissThresholdNotice}
                  className="text-blue-400 hover:text-blue-600"
                >
                  <span className="sr-only">Dismiss</span>
                  ×
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Header */}
        <Card className="border border-slate-200 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Group Management</h1>
              <p className="text-sm text-slate-600 mt-1">
                Department: {userDepartment} • {groups.length} groups formed
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#022B3A] hover:bg-[#1F7A8C]"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Students
              </Button>
              <Button
                onClick={() => forceRefresh()}
                variant="outline"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </Card>

        {/* Error Display */}
        {error && (
          <Card>
            <div className="p-4 bg-red-50 border-l-4 border-red-400">
              <div className="flex">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <Card>
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-[#022B3A]" />
              <p className="text-gray-600">Loading groups data...</p>
            </div>
          </Card>
        )}

        {/* Groups Statistics */}
        {!isLoading && groups.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{groups.length}</p>
                  <p className="text-sm text-slate-500">Total Groups</p>
                </div>
              </div>
            </Card>
            
            <Card className="border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Building className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{totalStudents}</p>
                  <p className="text-sm text-slate-500">Total Students</p>
                </div>
              </div>
            </Card>

            <Card className="border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{userDepartment}</p>
                  <p className="text-sm text-slate-500">Department</p>
                </div>
              </div>
            </Card>

            <Card className="border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Settings className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  {thresholdsLoading ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-slate-900">GPA Thresholds</p>
                      <p className="text-xs text-slate-500">
                        H≥{thresholds.high.toFixed(2)} M≥{thresholds.medium.toFixed(2)} L≥{thresholds.low.toFixed(2)}
                      </p>
                      </>
                    )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Groups List */}
        {!isLoading && groups.length > 0 && (
          <Card className="border border-slate-200 p-6">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Formed Groups
                  <span className="text-slate-500 font-normal ml-1">({filteredGroups.length})</span>
                </h2>
                <Button
                  onClick={() => setShowClearConfirm(true)}
                  variant="outline"
                  className="text-slate-600 border-slate-300 hover:bg-slate-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Groups
                </Button>
              </div>
              <div className="mb-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by group name, member, supervisor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#022B3A] focus:border-transparent text-slate-900 placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {filteredGroups.length === 0 ? (
                  <p className="py-8 text-center text-slate-500">No groups match your search</p>
                ) : (
                filteredGroups.map((group) => {
                  // Ensure members is an array and has valid data
                  const members = Array.isArray(group.members) ? group.members : [];
                  
                  return (
                    <div key={group.id} className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-base text-slate-900">
                            {group.name}
                          </h3>
                          <span className="text-xs text-slate-500">
                            {members.length} members
                          </span>
                        </div>
                        {members.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {members.map((member, index) => (
                              <div key={index} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm text-slate-900 truncate">{member.name || 'Unknown'}</p>
                                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-600">
                                    <span>GPA: {member.gpa || 'N/A'}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-700 bg-white">
                                      {member.tier || 'N/A'} Tier
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-500 text-sm italic">No members data available</p>
                        )}
                      </div>
                    </div>
                  );
                })
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && groups.length === 0 && (
          <Card>
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Groups Found</h3>
              <p className="text-gray-600 mb-6">
                Upload student data to automatically form groups.
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#022B3A] hover:bg-[#1F7A8C]"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Students
              </Button>
            </div>
          </Card>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            try {
              setIsLoading(true);
              setError(null);

              // Read and parse CSV file
              const csvText = await readFileAsText(file);
              const parsedData = parseCSV(csvText);
              
              if (parsedData.rows.length === 0) {
                setError('No valid student data found in CSV file');
                return;
              }

              // Process student data with department
              const studentsWithDepartment = parsedData.rows.map((student: any) => ({
                ...student,
                department: userDepartment
              }));

              // Form groups using ASP algorithm
              console.log('🔄 Calling formGroupsFromStudents with:', studentsWithDepartment.length, 'students');
              const result = await formGroupsFromStudents(studentsWithDepartment);
              console.log('📥 formGroupsFromStudents result:', result);
              
              if (result.success) {
                console.log('✅ Group formation successful, refreshing data...');
                // Refresh to show new groups
                await syncWithDatabase();
                console.log('✅ Data refresh completed');
              } else {
                console.error('❌ Group formation failed:', result.error);
                setError(result.error || 'Failed to form groups');
              }
            } catch (err) {
              console.error('❌ File upload error:', err);
              console.error('❌ Error details:', {
                message: err instanceof Error ? err.message : 'Unknown error',
                stack: err instanceof Error ? err.stack : undefined,
                type: typeof err,
                err
              });
              
              // Check if it's a specific HTTP error
              if (err instanceof Error) {
                if (err.message.includes('500')) {
                  setError('Server error (HTTP 500): The server encountered an internal error. Please check the backend logs.');
                } else if (err.message.includes('404')) {
                  setError('API endpoint not found (HTTP 404). Please check if the backend server is running.');
                } else if (err.message.includes('401')) {
                  setError('Authentication error (HTTP 401). Please try logging in again.');
                } else {
                  setError(`Upload failed: ${err.message}`);
                }
              } else {
                setError('Failed to process file: Unknown error occurred');
              }
            } finally {
              setIsLoading(false);
              // Reset file input
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }
          }}
        />

        {/* Clear Confirmation Modal */}
        <ConfirmationModal
          isOpen={showClearConfirm}
          onClose={() => setShowClearConfirm(false)}
          onConfirm={async () => {
            try {
              setIsLoading(true);
              await clearGroups();
              setShowClearConfirm(false);
            } catch (err) {
              setError('Failed to clear groups');
            } finally {
              setIsLoading(false);
            }
          }}
          title="Clear All Groups"
          message="Are you sure you want to clear all groups? This action cannot be undone."
          confirmText="Clear Groups"
          cancelText="Cancel"
        />
      </div>
    </MainLayout>
  );
}