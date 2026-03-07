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
import { stripGroupName, stripProjectTitle, getGroupNumber } from '../../utils/supervisorDisplay';

interface PendingItem {
  project_id: number;
  title: string;
  group_name: string;
  group_id?: number;
}

interface CompletedItem {
  id: number;
  project_id: number;
  project_title: string;
  group_name: string;
  total_score: number;
  grade?: string;
  feedback?: string;
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
  const [selectedProject, setSelectedProject] = useState<PendingItem | null>(null);
  const [scores, setScores] = useState({
    documentation_score: 20,
    implementation_score: 30,
    presentation_score: 15,
    innovation_score: 10,
    feedback: '',
    strengths: '',
    weaknesses: '',
    recommendations: '',
  });
  const hasAutoOpenedRef = useRef(false);

  const loadEvaluations = async () => {
    setLoading(true);
    // Use groups-with-projects (matches by supervisor_name like my-groups) for reliable data
    const groupsRes = await apiClient.getGroupsWithProjects();
    if (groupsRes.success && Array.isArray(groupsRes.data)) {
      const items = groupsRes.data as { group_id: number; group_name: string; project_id: number; project_title: string; has_evaluation: boolean; evaluation?: { id: number; total_score: number; grade?: string; feedback?: string; evaluated_at?: string } }[];
      const pendingItems: PendingItem[] = items
        .filter((i) => !i.has_evaluation)
        .map((i) => ({ project_id: i.project_id, title: i.project_title, group_name: i.group_name, group_id: i.group_id }));
      const completedItems: CompletedItem[] = items
        .filter((i) => i.has_evaluation && i.evaluation)
        .map((i) => ({
          id: i.evaluation!.id,
          project_id: i.project_id,
          project_title: i.project_title,
          group_name: i.group_name,
          total_score: i.evaluation!.total_score,
          grade: i.evaluation!.grade,
          feedback: i.evaluation!.feedback,
          evaluated_at: i.evaluation!.evaluated_at,
        }));
      setPending(pendingItems.sort((a, b) => getGroupNumber(a.group_name) - getGroupNumber(b.group_name)));
      setCompleted(completedItems.sort((a, b) => getGroupNumber(a.group_name) - getGroupNumber(b.group_name)));
    } else {
      // Fallback to legacy endpoints
      const [pendingRes, completedRes] = await Promise.all([
        apiClient.getPendingEvaluations(),
        apiClient.getCompletedEvaluations(),
      ]);
      if (pendingRes.success) setPending(pendingRes.data || []);
      if (completedRes.success) setCompleted(completedRes.data || []);
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
      setSelectedProject(match);
      setScores({
        documentation_score: 20,
        implementation_score: 30,
        presentation_score: 15,
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
    setSelectedProject(item);
    setScores({
      documentation_score: 20,
      implementation_score: 30,
      presentation_score: 15,
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
    setSelectedProject(null);
  };

  const submitEvaluation = async () => {
    if (!selectedProject) return;
    setSubmitLoading(true);
    try {
      const res = await apiClient.submitEvaluation({
        project_id: selectedProject.project_id,
        evaluation_type: 'internal',
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

  const totalMax = 20 + 30 + 15 + 10; // 75
  const totalScore = scores.documentation_score + scores.implementation_score + scores.presentation_score + scores.innovation_score;

  return (
    <MainLayout title="Evaluations">
      <div className="space-y-6">
        {/* Header */}
        <Card className="border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1F7A8C]/10 rounded-lg">
              <Award className="text-[#1F7A8C]" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Evaluations</h2>
              <p className="text-sm text-slate-600">Review and score your assigned groups’ project work</p>
              <p className="text-xs text-slate-500 mt-1.5">
                Groups appear here when they have a project. Use <strong>Start evaluation</strong> to grade a group, or go to <strong>My Groups</strong> → pick a group → <strong>Grade Work</strong>.
              </p>
            </div>
          </div>
        </Card>

        {/* Evaluation status summary for assigned groups */}
        <Card className="border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Star className="text-[#1F7A8C]" size={20} />
            Evaluation Status
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-50 border border-amber-100">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="text-amber-700" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{pending.length}</p>
                <p className="text-sm text-slate-600">Pending evaluations</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="text-emerald-700" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{completed.length}</p>
                <p className="text-sm text-slate-600">Completed evaluations</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Pending evaluations */}
        <Card className="border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="text-amber-600" size={20} />
            Pending evaluations
          </h3>
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : pending.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
              <FileCheck className="mx-auto h-12 w-12 text-slate-300 mb-2" />
              <p>No pending evaluations. All assigned groups with projects have been evaluated.</p>
              <p className="text-sm mt-1">Groups need a project before they can be evaluated. Check <strong>My Groups</strong> for your assigned groups.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {pending.map((item) => (
                <li
                  key={item.project_id}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg border border-slate-200 bg-white hover:border-[#1F7A8C]/30 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{stripGroupName(item.group_name)}</p>
                    <p className="text-sm text-slate-500">{stripProjectTitle(item.title, item.group_name)}</p>
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
            Completed evaluations
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
                      <p className="font-medium text-slate-900 truncate">{stripGroupName(item.group_name)}</p>
                      <p className="text-sm text-slate-500">{stripProjectTitle(item.project_title, item.group_name)}</p>
                      {item.feedback && (
                        <p className="text-sm text-slate-600 mt-2">{item.feedback}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-[#022B3A]">{item.total_score} / 75</p>
                      {item.grade && (
                        <p className="text-sm font-medium text-slate-600">Grade: {item.grade}</p>
                      )}
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
      {evalModalOpen && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Submit evaluation</h3>
                <p className="text-sm text-slate-500">{stripGroupName(selectedProject.group_name)} · {stripProjectTitle(selectedProject.title, selectedProject.group_name)}</p>
              </div>
              <button onClick={closeEvalModal} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Documentation (0–20)</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={scores.documentation_score}
                  onChange={(e) => setScores((s) => ({ ...s, documentation_score: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Implementation (0–30)</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={scores.implementation_score}
                  onChange={(e) => setScores((s) => ({ ...s, implementation_score: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Presentation (0–15)</label>
                <input
                  type="number"
                  min={0}
                  max={15}
                  value={scores.presentation_score}
                  onChange={(e) => setScores((s) => ({ ...s, presentation_score: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Innovation (0–10)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={scores.innovation_score}
                  onChange={(e) => setScores((s) => ({ ...s, innovation_score: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent"
                />
              </div>
              <p className="text-sm text-slate-600">Total: {totalScore} / {totalMax}</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Feedback</label>
                <textarea
                  value={scores.feedback}
                  onChange={(e) => setScores((s) => ({ ...s, feedback: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent"
                  placeholder="Overall feedback to the group"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Strengths (optional)</label>
                <textarea
                  value={scores.strengths}
                  onChange={(e) => setScores((s) => ({ ...s, strengths: e.target.value }))}
                  rows={1}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Areas for improvement (optional)</label>
                <textarea
                  value={scores.weaknesses}
                  onChange={(e) => setScores((s) => ({ ...s, weaknesses: e.target.value }))}
                  rows={1}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recommendations (optional)</label>
                <textarea
                  value={scores.recommendations}
                  onChange={(e) => setScores((s) => ({ ...s, recommendations: e.target.value }))}
                  rows={1}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1F7A8C] focus:border-transparent"
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
