import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../lib/api';

export function ReportsAnalytics() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const response = await apiClient.getAdminStats();
      if (response.success) {
        setStats(response.data);
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  return (
    <MainLayout title="Reports & Analytics">
      <div className="space-y-6">
        <Card>
          <h2 className="text-xl font-semibold text-[#1a237e] mb-4">System Performance</h2>
          {loading ? (
            <div className="text-gray-500">Loading analytics...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">Total Groups</p>
                <p className="text-lg font-semibold">{stats?.systemPerformance?.totalGroups || 0}</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">Projects Submitted</p>
                <p className="text-lg font-semibold">{stats?.systemPerformance?.projectsSubmitted || 0}</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">Reports Submitted</p>
                <p className="text-lg font-semibold">{stats?.systemPerformance?.totalReports || 0}</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">Reports Reviewed</p>
                <p className="text-lg font-semibold">{stats?.systemPerformance?.reviewedReports || 0}</p>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">Grouping Quality</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-600">Ideal Groups</p>
              <p className="text-lg font-semibold">{stats?.groupingQuality?.idealGroups || 0}</p>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-600">Fallback Groups</p>
              <p className="text-lg font-semibold">{stats?.groupingQuality?.fallbackGroups || 0}</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">Supervisor Workload</h2>
          <div className="space-y-3">
            {(stats?.supervisorWorkload || []).map((sup: any, index: number) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{sup.supervisor_name}</p>
                    <p className="text-sm text-gray-600">{sup.department}</p>
                  </div>
                  <div className="text-sm text-gray-600">
                    {sup.current_groups}/{sup.max_groups}
                  </div>
                </div>
              </div>
            ))}
            {stats?.supervisorWorkload?.length === 0 && (
              <div className="text-gray-500">No supervisor workload data available.</div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
