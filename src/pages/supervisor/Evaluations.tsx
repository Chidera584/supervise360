import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';

export function Evaluations() {
  const [pending, setPending] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvaluations = async () => {
    setLoading(true);
    const [pendingRes, completedRes] = await Promise.all([
      apiClient.getPendingEvaluations(),
      apiClient.getCompletedEvaluations()
    ]);
    if (pendingRes.success) setPending(pendingRes.data || []);
    if (completedRes.success) setCompleted(completedRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadEvaluations();
  }, []);

  const submitEvaluation = async (projectId: number) => {
    const documentation = Number(prompt('Documentation score (0-20)'));
    const implementation = Number(prompt('Implementation score (0-30)'));
    const presentation = Number(prompt('Presentation score (0-15)'));
    const innovation = Number(prompt('Innovation score (0-10)'));
    const feedback = prompt('Feedback') || '';
    await apiClient.submitEvaluation({
      project_id: projectId,
      evaluation_type: 'internal',
      documentation_score: documentation,
      implementation_score: implementation,
      presentation_score: presentation,
      innovation_score: innovation,
      feedback
    });
    loadEvaluations();
  };

  return (
    <MainLayout title="Evaluations">
      <div className="space-y-6">
        <Card>
          <h2 className="text-2xl font-bold text-[#1a237e]">Evaluations</h2>
          <p className="text-gray-600 mt-1">Review and score group projects</p>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-[#1a237e] mb-4">Pending Evaluations</h3>
          {loading ? (
            <div className="text-gray-500">Loading evaluations...</div>
          ) : (
            <div className="space-y-3">
              {pending.map((item) => (
                <div key={item.project_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-600">{item.group_name}</p>
                    </div>
                    <Button size="sm" onClick={() => submitEvaluation(item.project_id)}>
                      Start Evaluation
                    </Button>
                  </div>
                </div>
              ))}
              {pending.length === 0 && (
                <div className="text-gray-500">No pending evaluations.</div>
              )}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-[#1a237e] mb-4">Completed Evaluations</h3>
          <div className="space-y-3">
            {completed.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{item.project_title}</p>
                    <p className="text-sm text-gray-600">{item.group_name}</p>
                  </div>
                  <div className="text-sm text-gray-600">Score: {item.total_score}</div>
                </div>
                {item.feedback && (
                  <p className="text-sm text-gray-600 mt-2">{item.feedback}</p>
                )}
              </div>
            ))}
            {completed.length === 0 && (
              <div className="text-gray-500">No completed evaluations.</div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
