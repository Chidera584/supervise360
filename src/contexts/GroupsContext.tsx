import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Group } from '../lib/asp-group-formation';
import { apiClient } from '../lib/api';

interface GroupsContextType {
  groups: Group[];
  setGroups: (groups: Group[]) => void;
  addGroups: (newGroups: Group[]) => void;
  clearGroups: () => void;
  updateGroup: (groupId: number, updates: Partial<Group>) => void;
  formGroupsFromStudents: (students: any[]) => Promise<{ success: boolean; error?: string }>;
  syncWithDatabase: () => Promise<void>;
  forceRefresh: () => Promise<void>;
}

const GroupsContext = createContext<GroupsContextType | undefined>(undefined);

// Use a system-wide key for groups that persists across all users
const GROUPS_STORAGE_KEY = 'supervise360_system_groups';

export function GroupsProvider({ children }: { children: ReactNode }) {
  const [groups, setGroupsState] = useState<Group[]>([]);

  // Load groups from database on mount, fallback to localStorage if needed
  useEffect(() => {
    const initializeGroups = async () => {
      try {
        localStorage.removeItem(GROUPS_STORAGE_KEY);
        localStorage.removeItem(GROUPS_STORAGE_KEY + '_backup');
      } catch (error) {
        console.error('Failed to initialize GroupsContext:', error);
        // Only load from localStorage if database sync fails
        loadGroupsFromStorage();
      }
    };
    
    // Add a small delay to prevent blocking the UI
    const timeoutId = setTimeout(initializeGroups, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  const loadGroupsFromStorage = () => {
    let savedGroups = localStorage.getItem(GROUPS_STORAGE_KEY);
    
    // If main storage is empty, try backup
    if (!savedGroups) {
      const backupData = localStorage.getItem(GROUPS_STORAGE_KEY + '_backup');
      if (backupData) {
        try {
          const backup = JSON.parse(backupData);
          savedGroups = JSON.stringify(backup.groups);
        } catch (error) {
          console.error('Error loading backup groups:', error);
        }
      }
    }
    
    if (savedGroups) {
      try {
        const parsedGroups = JSON.parse(savedGroups);
        setGroupsState(parsedGroups);
      } catch (error) {
        console.error('Error loading saved groups:', error);
      }
    }
  };

  // Sync with database
  const syncWithDatabase = useCallback(async () => {
    try {
      const response = await apiClient.getGroups();

      if (response.success && response.data) {
        // The backend now returns proper member objects with tier information
        const dbGroups = response.data.map((dbGroup: any) => {
          // Parse members if it's a string (legacy format)
          let members = [];
          if (typeof dbGroup.members === 'string') {
            // Parse string format like "Ekanem Stephen (1.52)"
            const memberStrings = dbGroup.members.split(',').map((s: string) => s.trim());
            members = memberStrings.map((memberStr: string) => {
              const match = memberStr.match(/^(.+?)\s*\(([0-9.]+)\)$/);
              if (match) {
                const name = match[1].trim();
                const gpa = parseFloat(match[2]);
                // Note: Tier classification is done by backend using current thresholds
                // This is just for display of legacy data - actual classification happens server-side
                // We'll use a generic tier here since we don't have access to current thresholds
                let tier = 'LOW'; // Default, will be updated by backend during group formation
                return { name, gpa, tier, matricNumber: 'N/A' };
              }
              return { name: memberStr, gpa: 0, tier: 'LOW', matricNumber: 'N/A' };
            });
          } else if (Array.isArray(dbGroup.members)) {
            // Normalize members - ensure matricNumber and id are present
            members = dbGroup.members.map((m: any) => ({
              id: m.id,
              name: m.name,
              gpa: m.gpa,
              tier: m.tier || 'LOW',
              matricNumber: m.matricNumber ?? m.matric_number ?? m.student_id ?? 'N/A'
            }));
          }
          
          // Ensure avgGpa is a number
          const avgGpa = typeof dbGroup.avg_gpa === 'number' ? dbGroup.avg_gpa : 
                        typeof dbGroup.avgGpa === 'number' ? dbGroup.avgGpa :
                        parseFloat(dbGroup.avg_gpa || dbGroup.avgGpa || '0') || 0;
          
          return {
            id: dbGroup.id,
            name: dbGroup.name,
            members: members,
            status: 'formed' as const,
            supervisor: dbGroup.supervisor || dbGroup.supervisor_name || null,
            department: dbGroup.department || 'Software Engineering',
            avgGpa: avgGpa
          };
        });

        // CLIENT-SIDE SORTING: By department, then group number (1, 2, 3... n)
        // Handles "Group 1" and "Department - Group 1" formats
        const extractGroupNum = (name: string): number => {
          const m = name.match(/Group\s+(\d+)$/i) || name.match(/(\d+)$/);
          return m ? parseInt(m[1], 10) : 999999;
        };
        const sortedGroups = dbGroups.sort((a: Group, b: Group) => {
          const deptA = a.department || '';
          const deptB = b.department || '';
          if (deptA !== deptB) return deptA.localeCompare(deptB);
          return extractGroupNum(a.name) - extractGroupNum(b.name);
        });

        // Update state with sorted groups
        setGroupsState(sortedGroups);

        // Also update localStorage for offline access
        localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(sortedGroups));

        return dbGroups;
      } else {
        // If database has no data, clear localStorage too and set empty state
        setGroupsState([]);
        localStorage.removeItem(GROUPS_STORAGE_KEY);
        localStorage.removeItem(GROUPS_STORAGE_KEY + '_backup');
        return [];
      }
    } catch (error) {
      console.error('Failed to sync with database:', error);
      // Re-throw error so the calling function can handle fallback
      throw error;
    }
  }, []);

  // Save groups to localStorage whenever groups change
  useEffect(() => {
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));

    // Also save to a backup key as additional protection
    localStorage.setItem(GROUPS_STORAGE_KEY + '_backup', JSON.stringify({
      groups,
      timestamp: new Date().toISOString(),
      version: '1.0'
    }));
  }, [groups]);

  const setGroups = (newGroups: Group[]) => {
    setGroupsState(newGroups);
  };

  const addGroups = useCallback((newGroups: Group[]) => {
    setGroupsState(prevGroups => {
      // Assign new IDs to avoid conflicts
      const maxId = prevGroups.length > 0 ? Math.max(...prevGroups.map(g => g.id)) : 0;
      const groupsWithNewIds = newGroups.map((group, index) => ({
        ...group,
        id: maxId + index + 1
      }));
      return [...prevGroups, ...groupsWithNewIds];
    });
  }, []);

  const clearGroups = useCallback(async () => {
    try {
      // Clear from database first - this will clear all groups (backend handles department filtering)
      await apiClient.clearGroups();
    } catch (error) {
      console.error('Failed to clear groups from database:', error);
    }
    
    // Sync with database to get the updated state
    try {
      await syncWithDatabase();
    } catch (error) {
      console.error('Failed to sync after clearing groups:', error);
      // If sync fails, clear local state anyway
      setGroupsState([]);
      localStorage.removeItem(GROUPS_STORAGE_KEY);
      localStorage.removeItem(GROUPS_STORAGE_KEY + '_backup');
    }
  }, [syncWithDatabase]);

  const updateGroup = (groupId: number, updates: Partial<Group>) => {
    setGroupsState(prevGroups =>
      prevGroups.map(group =>
        group.id === groupId ? { ...group, ...updates } : group
      )
    );
  };

  const formGroupsFromStudents = useCallback(async (students: any[]): Promise<{ success: boolean; error?: string }> => {
    try {
      // Extract department from first student (all should have same department)
      const department = students[0]?.department;

      const response = await apiClient.formGroups(students, department);

      // Check if the response indicates an HTTP error
      if (!response.success) {
        console.error('API returned error response:', response);
        
        // Check for specific error patterns
        if (response.message && response.message.includes('500')) {
          return { success: false, error: `Server Error (HTTP 500): ${response.message}` };
        } else if (response.message && response.message.includes('401')) {
          return { success: false, error: `Authentication Error (HTTP 401): Please log in again` };
        } else if (response.message && response.message.includes('404')) {
          return { success: false, error: `API Not Found (HTTP 404): Backend endpoint missing` };
        } else {
          return { success: false, error: response.message || response.error || 'API request failed' };
        }
      }
      
      if (response.success && response.data && response.data.groups) {
        // Convert API response to frontend format
        const newGroups = response.data.groups.map((group: any) => {
          // Ensure members is an array
          let members = [];
          if (Array.isArray(group.members)) {
            members = group.members.map((member: any) => ({
              name: member.name,
              gpa: member.gpa,
              tier: member.tier, // Include tier information
              matricNumber: member.student_id || 'N/A'
            }));
          } else if (typeof group.members === 'string') {
            // Handle string format if needed
            const memberStrings = group.members.split(',').map((s: string) => s.trim());
            members = memberStrings.map((memberStr: string) => {
              const match = memberStr.match(/^(.+?)\s*\(([0-9.]+)\)$/);
              if (match) {
                const name = match[1].trim();
                const gpa = parseFloat(match[2]);
                // Note: Tier is classified by backend using current thresholds
                // This is just for legacy display - actual classification happens server-side
                let tier = 'LOW'; // Default, will be updated by backend during group formation
                
                return { name, gpa, tier, matricNumber: 'N/A' };
              }
              return { name: memberStr, gpa: 0, tier: 'LOW', matricNumber: 'N/A' };
            });
          } else {
            console.warn('Group members is not an array or string:', group.members);
          }
          
          return {
            id: group.id,
            name: group.name,
            members: members,
            status: 'formed' as const,
            supervisor: null,
            department: students[0]?.department || 'Software Engineering',
            avgGpa: group.avgGpa || group.avg_gpa // Handle both property names
          };
        });

        // Add to existing groups
        addGroups(newGroups);
        
        // Sync with database to get the latest data
        await syncWithDatabase();
        
        return { success: true };
      } else {
        console.error('API call failed - invalid response structure:', response);
        return { success: false, error: 'Invalid response from server - no groups data received' };
      }
    } catch (error) {
      console.error('Exception in formGroupsFromStudents:', error);
      
      // Handle different types of errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return { success: false, error: 'Network error: Cannot connect to server. Please check if the backend is running.' };
      } else if (error instanceof Error) {
        return { success: false, error: `Request failed: ${error.message}` };
      } else {
        return { success: false, error: 'Unknown error occurred during group formation' };
      }
    }
  }, [addGroups, syncWithDatabase]);

  // Force refresh function that clears cache and syncs with database
  const forceRefresh = useCallback(async () => {
    try {
      // Clear localStorage cache
      localStorage.removeItem(GROUPS_STORAGE_KEY);
      localStorage.removeItem(GROUPS_STORAGE_KEY + '_backup');
      
      // Clear current state
      setGroupsState([]);
      
      // Force sync with database
      await syncWithDatabase();
    } catch (error) {
      console.error('Force refresh failed:', error);
      throw error;
    }
  }, [syncWithDatabase]);

  return (
    <GroupsContext.Provider value={{
      groups,
      setGroups,
      addGroups,
      clearGroups,
      updateGroup,
      formGroupsFromStudents,
      syncWithDatabase,
      forceRefresh
    }}>
      {children}
    </GroupsContext.Provider>
  );
}

export function useGroups() {
  const context = useContext(GroupsContext);
  if (context === undefined) {
    throw new Error('useGroups must be used within a GroupsProvider');
  }
  return context;
}