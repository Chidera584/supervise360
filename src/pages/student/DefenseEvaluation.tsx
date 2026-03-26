import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../lib/api';
import { FileText, MapPin, UsersRound } from 'lucide-react';

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

  // Use allocation-based schedule (venue + assessors) or defense_panels (location).
  // Per your request, we never display schedule date/time on this student page.
  const hasVenue = !!(defenseSchedule?.venue || defense?.location);
  const venueText = defenseSchedule?.venue || defense?.location || '';
  const assessors = Array.isArray(defenseSchedule?.assessors) ? defenseSchedule.assessors : [];

  return (
    <MainLayout title="Defense & Evaluation">
      <div className="space-y-6">
        <Card>
          <h2 className="text-lg font-semibold text-[#022B3A] mb-4">Defense Schedule</h2>
          {hasVenue ? (
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 font-medium">Venue</p>
                    <p className="font-semibold text-gray-900">{venueText}</p>
                    {defenseSchedule?.groupRange && (
                      <p className="text-xs text-amber-700 mt-1">{defenseSchedule.groupRange}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 mt-0.5 rounded-full bg-amber-200 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-amber-800 font-medium">Status</p>
                    <p className="font-semibold text-gray-900">{defense?.status || 'Pending'}</p>
                  </div>
                </div>
              </div>

              {assessors.length > 0 ? (
                <div className="pt-3 border-t border-amber-100">
                  <div className="flex items-center gap-3 mb-3">
                    <UsersRound className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
                      Board of assessors
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {assessors.map((a: string, i: number) => (
                      <div key={`${a}-${i}`} className="flex items-start gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1F7A8C]/60 mt-2 flex-shrink-0" />
                        <span className="text-sm text-gray-800 leading-snug">{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-800">
                  Assessors will be listed once the defense board is confirmed.
                </p>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No defense scheduled yet.</div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[#022B3A] mb-4">Evaluation Results (out of 60)</h2>
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
            <div className="text-center py-14 text-slate-500 bg-slate-50 rounded-xl border border-slate-100 relative overflow-hidden">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-white border border-slate-200/70 flex items-center justify-center mb-4">
                <FileText className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-slate-700 font-semibold">No evaluations yet.</p>
              <p className="mt-2 text-sm text-slate-500 px-4 leading-relaxed">
                Results will be published here once the defense board completes their review.
              </p>
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
