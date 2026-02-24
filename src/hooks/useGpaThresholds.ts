import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../lib/api';

export interface GpaThresholds {
  high: number;
  medium: number;
  low: number;
}

export function useGpaThresholds(department?: string) {
  const [thresholds, setThresholds] = useState<GpaThresholds>({ high: 3.8, medium: 3.3, low: 0.0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThresholds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // ALWAYS clear cache - no caching allowed
      localStorage.removeItem('cached_gpa_thresholds');
      
      const token = localStorage.getItem('supervise360_token') || localStorage.getItem('token');
      const url = department 
        ? `${API_BASE_URL}/settings/gpa-thresholds/department/${encodeURIComponent(department)}?t=${Date.now()}`
        : `${API_BASE_URL}/settings/gpa-thresholds/global?t=${Date.now()}`;
      
      console.log(`🔍 [useGpaThresholds] Fetching FRESH thresholds from: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        cache: 'no-store',
        method: 'GET'
      });
      
      if (!response.ok) {
        // If 404 for department, try global
        if (response.status === 404 && department) {
          console.log('⚠️ Department endpoint not found, fetching global thresholds');
          const globalUrl = `${API_BASE_URL}/settings/gpa-thresholds/global?t=${Date.now()}`;
          const globalResponse = await fetch(globalUrl, {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            cache: 'no-store'
          });
          
          if (globalResponse.ok) {
            const globalData = await globalResponse.json();
            const globalThresholds = globalData.data;
            if (globalThresholds && typeof globalThresholds.high === 'number') {
              console.log('✅ Using global thresholds:', globalThresholds);
              setThresholds(globalThresholds);
              return;
            }
          }
        }
        throw new Error(`Failed to fetch thresholds: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📥 Raw API response:', data);
      
      let newThresholds: GpaThresholds;
      
      // Handle both department and global responses
      if (data.data && data.data.thresholds) {
        // Department response with thresholds object
        newThresholds = data.data.thresholds;
      } else if (data.data && (data.data.high !== undefined || data.data.medium !== undefined)) {
        // Global response with thresholds directly in data
        newThresholds = data.data;
      } else {
        console.error('❌ Unexpected threshold response structure:', data);
        throw new Error('Invalid response structure from server');
      }
      
      // Validate thresholds are numbers
      if (typeof newThresholds.high === 'number' && typeof newThresholds.medium === 'number' && typeof newThresholds.low === 'number') {
        console.log('✅ GPA thresholds fetched successfully:', newThresholds);
        console.log('🔍 Setting thresholds state with values:', {
          high: newThresholds.high,
          medium: newThresholds.medium,
          low: newThresholds.low,
          highType: typeof newThresholds.high,
          mediumType: typeof newThresholds.medium,
          lowType: typeof newThresholds.low
        });
        setThresholds(newThresholds);
      } else {
        console.error('❌ Invalid threshold values:', newThresholds);
        console.error('❌ Threshold types:', {
          high: typeof newThresholds.high,
          medium: typeof newThresholds.medium,
          low: typeof newThresholds.low
        });
        throw new Error('Invalid threshold values received from server');
      }
    } catch (err) {
      console.error('❌ Error fetching GPA thresholds:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch thresholds');
      // DO NOT use cached values - always show error or defaults
    } finally {
      setLoading(false);
    }
  }, [department]);

  // Fetch on mount and when department changes
  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds]);

  // Listen for threshold changes - ALWAYS refetch
  useEffect(() => {
    const handleThresholdChange = () => {
      console.log('🔄 GPA thresholds changed event received, refetching immediately...');
      fetchThresholds();
    };

    window.addEventListener('gpa_thresholds_changed', handleThresholdChange);
    window.addEventListener('refresh_gpa_thresholds', handleThresholdChange);
    
    // Listen for storage changes (cross-tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gpa_thresholds_changed') {
        console.log('🔄 Storage event: thresholds changed, refetching...');
        fetchThresholds();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('gpa_thresholds_changed', handleThresholdChange);
      window.removeEventListener('refresh_gpa_thresholds', handleThresholdChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchThresholds]);

  return {
    thresholds,
    loading,
    error,
    refetch: fetchThresholds
  };
}
