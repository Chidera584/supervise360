import { useState, useRef, useEffect } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { ConfirmationModal } from '../../components/UI/ConfirmationModal';
import { Users, Upload, RefreshCw, AlertCircle, Trash2, Building, Settings } from 'lucide-react';
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-[#1a237e]">Group Management</h1>
            <p className="text-gray-600 mt-1">
              Department: {userDepartment} • {groups.length} groups formed
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#1a237e] hover:bg-[#0d47a1]"
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
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-[#1a237e]" />
              <p className="text-gray-600">Loading groups data...</p>
            </div>
          </Card>
        )}

        {/* Groups Statistics */}
        {!isLoading && groups.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <div className="p-6">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-[#1a237e]" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{groups.length}</p>
                    <p className="text-gray-600">Total Groups</p>
                  </div>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="p-6">
                <div className="flex items-center">
                  <Building className="w-8 h-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{groups.length * 3}</p>
                    <p className="text-gray-600">Total Students</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center">
                  <AlertCircle className="w-8 h-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{userDepartment}</p>
                    <p className="text-gray-600">Department</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center">
                  <Settings className="w-8 h-8 text-blue-600" />
                  <div className="ml-4">
                    {thresholdsLoading ? (
                      <p className="text-sm text-gray-500">Loading...</p>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-gray-900">GPA Thresholds</p>
                        <p className="text-xs text-gray-600">
                          H≥{thresholds.high.toFixed(2)} M≥{thresholds.medium.toFixed(2)} L≥{thresholds.low.toFixed(2)}
                        </p>
                        {process.env.NODE_ENV === 'development' && (
                          <p className="text-xs text-gray-400 mt-1">
                            Debug: {JSON.stringify(thresholds)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Groups List */}
        {!isLoading && groups.length > 0 && (
          <Card>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Formed Groups</h2>
                <Button
                  onClick={() => setShowClearConfirm(true)}
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Groups
                </Button>
              </div>

              <div className="space-y-4">
                {groups.map((group) => {
                  // Ensure members is an array and has valid data
                  const members = Array.isArray(group.members) ? group.members : [];
                  
                  return (
                    <div key={group.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900 mb-2">
                            {group.name}
                          </h3>
                          {members.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {members.map((member, index) => {
                                const isLeader = index === 0; // First member (HIGH tier) is leader
                                return (
                                  <div key={index} className="flex items-center space-x-2">
                                    {isLeader && <span className="text-yellow-500">👑</span>}
                                    <div>
                                      <p className="font-medium text-gray-900">{member.name || 'Unknown'}</p>
                                      <p className="text-sm text-gray-600">
                                        GPA: {member.gpa || 'N/A'} • {member.tier || 'N/A'} Tier
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-gray-500 italic">No members data available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                Upload student data to automatically form groups using ASP algorithm.
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#1a237e] hover:bg-[#0d47a1]"
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