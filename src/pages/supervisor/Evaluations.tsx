import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import {
  FileCheck,
  CheckCircle,
  Clock,
  Star,
  X,
  ChevronRight,
  Award,
  MessageSquare,
} from 'lucide-react';
import { stripGroupName, getGroupNumber } from '../../utils/supervisorDisplay';

interface PendingItem {
  student_user_id: number;
  student_name: string;
  matric_number?: string;
  group_name: string;
  group_id?: number;
}

interface CompletedItem {
  id: number;
  student_user_id: number;
  student_name: string;
  group_name: string;
  total_score: number;
  evaluated_at?: string;
}

export function Evaluations() {
  const location = useLocation();
  const navState = location.state as { groupId?: number } | null;
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [completed, setCompleted] = useState<CompletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<PendingItem | null>(null);
  const [scores, setScores] = useState({
    documentation_score: 20,
    implementation_score: 20,
    presentation_score: 10,
    innovation_score: 10,
    feedback: '',
    strengths: '',
    weaknesses: '',
    recommendations: '',
  });
  const hasAutoOpenedRef = useRef(false);

  const loadEvaluations = async () => {
    setLoading(true);
    const res = await apiClient.getEvaluationStudents();
    if (res.success && Array.isArray(res.data)) {
      const items = res.data as {
        student_user_id: number;
        student_name: string;
        matric_number?: string;
        group_id?: number;
        group_name: string;
        project_id?: number;
        evaluation_id?: number;
        total_score?: number;
        evaluated_at?: string;
      }[];
      const pendingItems: PendingItem[] = items
        .filter((i) => !i.evaluation_id)
        .map((i) => ({
          student_user_id: i.student_user_id,
          student_name: i.student_name,
          matric_number: i.matric_number,
          group_name: i.group_name,
          group_id: i.group_id,
        }));
      const completedItems: CompletedItem[] = items
        .filter((i) => !!i.evaluation_id)
        .map((i) => ({
          id: i.evaluation_id!,
          student_user_id: i.student_user_id,
          student_name: i.student_name,
          group_name: i.group_name,
          total_score: i.total_score ?? 0,
          evaluated_at: i.evaluated_at,
        }));
      const sortByGroupThenName = <T extends { group_name: string; student_name: string }>(a: T, b: T) => {
        const gDiff = getGroupNumber(a.group_name) - getGroupNumber(b.group_name);
        if (gDiff !== 0) return gDiff;
        return a.student_name.localeCompare(b.student_name);
      };
      setPending(pendingItems.sort(sortByGroupThenName));
      setCompleted(completedItems.sort(sortByGroupThenName));
    } else {
      setPending([]);
      setCompleted([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEvaluations();
  }, []);

  // When navigated from My Groups (Grade Work), open modal for that group's project if pending (once)
  useEffect(() => {
    if (hasAutoOpenedRef.current || !navState?.groupId || loading || !pending.length) return;
    const groupId = navState.groupId;
    const groupName = (navState as { groupName?: string }).groupName;
    const match = groupId
      ? pending.find((p) => p.group_id === groupId)
      : groupName
        ? pending.find((p) => p.group_name === groupName)
        : pending[0];
    if (match) {
      hasAutoOpenedRef.current = true;
      setSelectedStudent(match);
      setScores({
        documentation_score: 20,
        implementation_score: 20,
        presentation_score: 10,
        innovation_score: 10,
        feedback: '',
        strengths: '',
        weaknesses: '',
        recommendations: '',
      });
      setEvalModalOpen(true);
    }
  }, [loading, pending, navState?.groupId, (navState as any)?.groupName]);

  const openEvalModal = (item: PendingItem) => {
    setSelectedStudent(item);
    setScores({
      documentation_score: 20,
      implementation_score: 20,
      presentation_score: 10,
      innovation_score: 10,
      feedback: '',
      strengths: '',
      weaknesses: '',
      recommendations: '',
    });
    setEvalModalOpen(true);
  };

  const closeEvalModal = () => {
    setEvalModalOpen(false);
    setSelectedStudent(null);
  };

  const submitEvaluation = async () => {
    if (!selectedStudent) return;
    setSubmitLoading(true);
    try {
      const res = await apiClient.submitStudentEvaluation({
        student_user_id: selectedStudent.student_user_id,
        group_id: selectedStudent.group_id,
        documentation_score: scores.documentation_score,
        implementation_score: scores.implementation_score,
        presentation_score: scores.presentation_score,
        innovation_score: scores.innovation_score,
        feedback: scores.feedback,
        strengths: scores.strengths,
        weaknesses: scores.weaknesses,
        recommendations: scores.recommendations,
      });
      if (res.success) {
        closeEvalModal();
        await loadEvaluations();
      } else {
        alert((res as any).message || 'Failed to submit evaluation');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setSubmitLoading(false);
    }
  };

  const totalMax = 20 + 20 + 10 + 10; // 60
  const totalScore = scores.documentation_score + scores.implementation_score + scores.presentation_score + scores.innovation_score;

  return (
    <MainLayout title="Evaluations">
      <div className="space-y-6">
        {/* Header */}
        <Card className="border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-600/10 rounded-lg">
              <Award className="text-brand-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Evaluations</h2>
              <p className="text-sm text-slate-600">Review and score each individual student under your supervision.</p>
            </div>
          </div>
        </Card>

        {/* Evaluation status summary for assigned groups */}
        <Card className="border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Star className="text-brand-600" size={20} />
            Evaluation Status
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-50 border border-amber-100">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="text-amber-700" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{pending.length}</p>
                <p className="text-sm text-slate-600">Students not yet evaluated</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="text-emerald-700" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{completed.length}</p>
                <p className="text-sm text-slate-600">Students evaluated</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Pending evaluations */}
        <Card className="border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="text-amber-600" size={20} />
            Students still to evaluate
          </h3>
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : pending.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
              <FileCheck className="mx-auto h-12 w-12 text-slate-300 mb-2" />
              <p>No pending evaluations. All your students have been evaluated.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {pending.map((item) => (
                <li
                  key={item.project_id}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg border border-slate-200 bg-white hover:border-brand-600/30 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{item.student_name}</p>
                    <p className="text-sm text-slate-500">
                      {stripGroupName(item.group_name)}
                      {item.matric_number && ` · ${item.matric_number}`}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => openEvalModal(item)} className="shrink-0">
                    <span className="flex items-center gap-2">
                      Start evaluation
                      <ChevronRight size={16} />
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Completed evaluations */}
        <Card className="border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle className="text-emerald-600" size={20} />
            Students already evaluated
          </h3>
          {loading ? null : completed.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
              <MessageSquare className="mx-auto h-12 w-12 text-slate-300 mb-2" />
              <p>No completed evaluations yet.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {completed.map((item) => (
                <li
                  key={item.id}
                  className="p-4 rounded-lg border border-slate-200 bg-white"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{item.student_name}</p>
                      <p className="text-sm text-slate-500">{stripGroupName(item.group_name)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-slate-900">{item.total_score} / 60</p>
                      {item.evaluated_at && (
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(item.evaluated_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Evaluation form modal */}
      {evalModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Submit evaluation</h3>
                <p className="text-sm text-slate-500">
                  {selectedStudent.student_name} · {stripGroupName(selectedStudent.group_name)}
                </p>
              </div>
              <button onClick={closeEvalModal} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project quality (0–20)</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={scores.documentation_score}
                  onChange={(e) => setScores((s) => ({ ...s, documentation_score: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Individual contribution (0–20)</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={scores.implementation_score}
                  onChange={(e) => setScores((s) => ({ ...s, implementation_score: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Overall performance (0–10)</label>
                <input
                  type="number"
                  min={0}
                  max={15}
                  value={scores.presentation_score}
                  onChange={(e) => setScores((s) => ({ ...s, presentation_score: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Participation (0–10)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={scores.innovation_score}
                  onChange={(e) => setScores((s) => ({ ...s, innovation_score: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <p className="text-sm text-slate-600">Total: {totalScore} / {totalMax}</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Feedback</label>
                <textarea
                  value={scores.feedback}
                  onChange={(e) => setScores((s) => ({ ...s, feedback: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Overall feedback to the group"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Strengths (optional)</label>
                <textarea
                  value={scores.strengths}
                  onChange={(e) => setScores((s) => ({ ...s, strengths: e.target.value }))}
                  rows={1}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Areas for improvement (optional)</label>
                <textarea
                  value={scores.weaknesses}
                  onChange={(e) => setScores((s) => ({ ...s, weaknesses: e.target.value }))}
                  rows={1}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recommendations (optional)</label>
                <textarea
                  value={scores.recommendations}
                  onChange={(e) => setScores((s) => ({ ...s, recommendations: e.target.value }))}
                  rows={1}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <Button variant="outline" onClick={closeEvalModal}>Cancel</Button>
              <Button onClick={submitEvaluation} disabled={submitLoading}>
                {submitLoading ? 'Submitting...' : 'Submit evaluation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
