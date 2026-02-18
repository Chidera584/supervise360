import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../lib/api';
import { MapPin, UsersRound } from 'lucide-react';

export function DefenseEvaluation() {
  const [defense, setDefense] = useState<any>(null);
  const [defenseSchedule, setDefenseSchedule] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [defenseRes, scheduleRes, evalRes, groupRes] = await Promise.all([
        apiClient.getMyDefense(),
        apiClient.getMyDefenseSchedule(),
        apiClient.getMyEvaluation(),
        apiClient.getMyGroup()
      ]);
      if (defenseRes.success) setDefense(defenseRes.data);
      if (scheduleRes.success) setDefenseSchedule(scheduleRes.data);
      if (evalRes.success) setEvaluations(evalRes.data || []);
      // Fallback: if schedule is null but we have a group, fetch by group ID (same path as My Group)
      if (!scheduleRes.data && groupRes.success && groupRes.data?.id) {
        const byGroup = await apiClient.getDefenseScheduleForGroup(groupRes.data.id);
        if (byGroup.success && byGroup.data) setDefenseSchedule(byGroup.data);
      }
    };
    loadData();
  }, []);

  // Use allocation-based schedule (venue + assessors) or defense_panels (date + location)
  const hasDefensePanel = defense && (defense.defense_date || defense.location);
  const hasAllocationSchedule = defenseSchedule && defenseSchedule.venue;

  return (
    <MainLayout title="Defense & Evaluation">
      <div className="space-y-6">
        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">Defense Schedule</h2>
          {hasDefensePanel ? (
            <div className="space-y-2 text-sm text-gray-700">
              {defense.defense_date && (
                <>
                  <div>Date: {new Date(defense.defense_date).toLocaleDateString()}</div>
                  <div>Time: {new Date(defense.defense_date).toLocaleTimeString()}</div>
                </>
              )}
              <div>Location: {defense.location}</div>
              <div>Status: {defense.status}</div>
            </div>
          ) : hasAllocationSchedule ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800 font-medium">Venue</p>
                  <p className="font-semibold text-gray-900">{defenseSchedule.venue}</p>
                  {defenseSchedule.groupRange && (
                    <p className="text-xs text-amber-700 mt-1">{defenseSchedule.groupRange}</p>
                  )}
                </div>
              </div>
              {defenseSchedule.assessors && defenseSchedule.assessors.length > 0 && (
                <div className="flex items-start gap-3">
                  <UsersRound className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 font-medium">Assessors</p>
                    <ul className="text-sm text-gray-800 space-y-1">
                      {defenseSchedule.assessors.map((a: string, i: number) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No defense scheduled yet.</div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[#1a237e] mb-4">Evaluation Results</h2>
          {evaluations.length > 0 ? (
            <div className="space-y-3">
              {evaluations.map((evalItem) => (
                <div key={evalItem.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600">Type: {evalItem.evaluation_type}</div>
                  <div className="text-sm text-gray-600">Total: {evalItem.total_score}</div>
                  {evalItem.feedback && (
                    <div className="text-sm text-gray-700 mt-2">{evalItem.feedback}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No evaluations yet.</div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
