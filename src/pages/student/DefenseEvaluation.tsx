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
          <h2 className="text-lg font-semibold text-[#022B3A] mb-4">Defense Schedule</h2>
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
          <h2 className="text-lg font-semibold text-[#022B3A] mb-4">Supervisor Evaluation (out of 60)</h2>
          {evaluations.length > 0 ? (
            <div className="space-y-4">
              {evaluations.map((evalItem: any) => (
                <div key={evalItem.id} className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[#1F7A8C]/15 text-[#1F7A8C] capitalize">
                        {evalItem.evaluation_type || 'Evaluation'}
                      </span>
                      {evalItem.evaluated_at && (
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(evalItem.evaluated_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#022B3A]">
                        {evalItem.total_score != null ? `${evalItem.total_score} / 60` : '—'}
                      </p>
                      <p className="text-sm text-slate-600">Total score</p>
                    </div>
                  </div>
                  {(evalItem.documentation_score != null || evalItem.implementation_score != null || evalItem.presentation_score != null || evalItem.innovation_score != null) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 pt-3 border-t border-slate-200">
                      {evalItem.documentation_score != null && (
                        <div>
                          <p className="text-xs text-slate-500">Project quality</p>
                          <p className="font-medium text-slate-900">{evalItem.documentation_score}</p>
                        </div>
                      )}
                      {evalItem.implementation_score != null && (
                        <div>
                          <p className="text-xs text-slate-500">Individual contribution</p>
                          <p className="font-medium text-slate-900">{evalItem.implementation_score}</p>
                        </div>
                      )}
                      {evalItem.presentation_score != null && (
                        <div>
                          <p className="text-xs text-slate-500">Overall performance</p>
                          <p className="font-medium text-slate-900">{evalItem.presentation_score}</p>
                        </div>
                      )}
                      {evalItem.innovation_score != null && (
                        <div>
                          <p className="text-xs text-slate-500">Participation</p>
                          <p className="font-medium text-slate-900">{evalItem.innovation_score}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {evalItem.feedback && (
                    <div className="pt-3 border-t border-slate-200">
                      <p className="text-xs font-medium text-slate-500 mb-1">Feedback</p>
                      <p className="text-sm text-slate-800">{evalItem.feedback}</p>
                    </div>
                  )}
                  {(evalItem.strengths || evalItem.weaknesses || evalItem.recommendations) && (
                    <div className="pt-3 mt-3 border-t border-slate-200 space-y-2 text-sm">
                      {evalItem.strengths && (
                        <div>
                          <p className="text-xs font-medium text-slate-500">Strengths</p>
                          <p className="text-slate-700">{evalItem.strengths}</p>
                        </div>
                      )}
                      {evalItem.weaknesses && (
                        <div>
                          <p className="text-xs font-medium text-slate-500">Areas for improvement</p>
                          <p className="text-slate-700">{evalItem.weaknesses}</p>
                        </div>
                      )}
                      {evalItem.recommendations && (
                        <div>
                          <p className="text-xs font-medium text-slate-500">Recommendations</p>
                          <p className="text-slate-700">{evalItem.recommendations}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
              <p>No evaluation results yet. Scores and feedback will appear here after your supervisor completes the assessment.</p>
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
