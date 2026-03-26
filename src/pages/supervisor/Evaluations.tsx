import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { FileCheck, CheckCircle, Clock, Star, Award, X } from 'lucide-react';
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

type Scores = {
  documentation_score: number;
  implementation_score: number;
  presentation_score: number;
  innovation_score: number;
  feedback: string;
  strengths: string;
  weaknesses: string;
  recommendations: string;
};

const TEAL = '#006D6D';

const defaultScores: Scores = {
  documentation_score: 20,
  implementation_score: 20,
  presentation_score: 10,
  innovation_score: 10,
  feedback: '',
  strengths: '',
  weaknesses: '',
  recommendations: '',
};

export function Evaluations() {
  const location = useLocation();
  const navState = location.state as { groupId?: number } | null;

  const [pending, setPending] = useState<PendingItem[]>([]);
  const [completed, setCompleted] = useState<CompletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<PendingItem | null>(null);
  const [scores, setScores] = useState<Scores>(defaultScores);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const hasAutoOpenedRef = useRef(false);

  const draftKey = (item: PendingItem) => `supervisor-eval-draft:${item.student_user_id}:${item.group_id ?? 'na'}`;

  const loadDraft = (item: PendingItem) => {
    try {
      const raw = localStorage.getItem(draftKey(item));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<Scores>;
      return { ...defaultScores, ...parsed };
    } catch {
      return null;
    }
  };

  const saveDraft = (item: PendingItem) => {
    try {
      localStorage.setItem(draftKey(item), JSON.stringify(scores));
      setMessage({ type: 'success', text: 'Draft saved locally.' });
    } catch {
      setMessage({ type: 'error', text: 'Could not save draft locally.' });
    }
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select first relevant pending student once (from navigation state).
  useEffect(() => {
    if (hasAutoOpenedRef.current || !navState?.groupId || loading || !pending.length) return;

    const groupId = navState.groupId;
    const groupName = (navState as any).groupName as string | undefined;
    const match = groupId
      ? pending.find((p) => p.group_id === groupId)
      : groupName
        ? pending.find((p) => p.group_name === groupName)
        : pending[0];

    if (!match) return;

    hasAutoOpenedRef.current = true;
    setSelectedStudent(match);
    const draft = loadDraft(match);
    setScores(draft || defaultScores);
    setMessage(null);
  }, [loading, pending, navState?.groupId, (navState as any)?.groupName]);

  const openEvaluation = (item: PendingItem) => {
    setSelectedStudent(item);
    const draft = loadDraft(item);
    setScores(draft || defaultScores);
    setMessage(null);
  };

  const totalMax = 20 + 20 + 10 + 10; // 60
  const totalScore = scores.documentation_score + scores.implementation_score + scores.presentation_score + scores.innovation_score;

  const submitEvaluation = async () => {
    if (!selectedStudent) return;
    setSubmitLoading(true);
    setMessage(null);
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
        setMessage({ type: 'success', text: 'Evaluation submitted successfully.' });
        setSelectedStudent(null);
        await loadEvaluations();
      } else {
        setMessage({ type: 'error', text: (res as any).message || 'Failed to submit evaluation' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to submit evaluation' });
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <MainLayout title="Evaluations">
      <div className="max-w-6xl mx-auto space-y-6 min-w-0">
        {/* Header */}
        <Card className="border border-slate-200/90 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1F7A8C]/10 rounded-lg">
              <Award className="text-[#1F7A8C]" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Evaluations</h2>
              <p className="text-sm text-slate-600">Review and score each individual student under your supervision.</p>
            </div>
          </div>
        </Card>

        {/* Summary */}
        <Card className="border border-slate-200/90 rounded-2xl p-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-5">
          {/* Pending list */}
          <Card className="border border-slate-200/90 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Clock className="text-amber-600" size={20} />
              Students still to evaluate
            </h3>
            {loading ? (
              <p className="text-slate-500">Loading…</p>
            ) : pending.length === 0 ? (
              <div className="text-center py-10 text-slate-500 bg-slate-50/60 border border-slate-100 rounded-2xl">
                <FileCheck className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                <p>No pending evaluations. All students have been evaluated.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map((item) => {
                  const isSelected = selectedStudent?.student_user_id === item.student_user_id;
                  return (
                    <div
                      key={`${item.student_user_id}:${item.group_id ?? 'na'}`}
                      className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${
                        isSelected ? 'border-[#006D6D]/30 bg-[#006D6D]/5' : 'border-slate-200 bg-white hover:border-[#006D6D]/20'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{item.student_name}</p>
                        <p className="text-sm text-slate-500 truncate">
                          {stripGroupName(item.group_name)}
                          {item.matric_number ? ` · ${item.matric_number}` : ''}
                        </p>
                      </div>
                      <Button
                        className="!rounded-[10px] !px-3 !py-2 !bg-[#006D6D] !text-white hover:!bg-[#005a5a] border-0"
                        onClick={() => openEvaluation(item)}
                      >
                        Start evaluation
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Evaluation form */}
          <Card className="border border-slate-200/90 rounded-2xl p-5">
            {!selectedStudent ? (
              <div className="py-14 text-center text-slate-500">
                Select a student to evaluate.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Top */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Evaluating</p>
                    <p className="text-lg font-semibold text-slate-900 mt-1">{selectedStudent.student_name}</p>
                    <p className="text-sm text-slate-600 mt-1">{stripGroupName(selectedStudent.group_name)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                    aria-label="Close evaluation panel"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Current score */}
                <div className="rounded-2xl bg-[#006D6D]/5 border border-[#006D6D]/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Current score</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1">{totalScore}</p>
                      <p className="text-sm text-slate-600 mt-1">/ {totalMax}</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-[#006D6D] text-white flex items-center justify-center">
                      <Star className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {message && (
                  <div
                    className={`p-4 rounded-xl border ${
                      message.type === 'success'
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                        : 'bg-red-50 border-red-100 text-red-800'
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                {/* Structured scoring */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ScoreSlider
                    label="Project Quality"
                    value={scores.documentation_score}
                    max={20}
                    onChange={(v) => setScores((s) => ({ ...s, documentation_score: v }))}
                  />
                  <ScoreSlider
                    label="Individual Contribution"
                    value={scores.implementation_score}
                    max={20}
                    onChange={(v) => setScores((s) => ({ ...s, implementation_score: v }))}
                  />
                  <ScoreSlider
                    label="Overall Performance"
                    value={scores.presentation_score}
                    max={10}
                    onChange={(v) => setScores((s) => ({ ...s, presentation_score: v }))}
                  />
                  <ScoreSlider
                    label="Participation"
                    value={scores.innovation_score}
                    max={10}
                    onChange={(v) => setScores((s) => ({ ...s, innovation_score: v }))}
                  />
                </div>

                {/* Narrative */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="font-semibold text-slate-900">Narrative Assessment</p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">General feedback *</p>
                  </div>

                  <label className="block text-sm font-semibold text-slate-900 mb-2">General Feedback</label>
                  <textarea
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#006D6D]/30"
                    rows={4}
                    placeholder="Provide a comprehensive summary of the student's overall performance during this evaluation period…"
                    value={scores.feedback}
                    onChange={(e) => setScores((s) => ({ ...s, feedback: e.target.value }))}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <SmallField
                      label="Strengths (optional)"
                      value={scores.strengths}
                      onChange={(v) => setScores((s) => ({ ...s, strengths: v }))}
                    />
                    <SmallField
                      label="Areas for improvement (optional)"
                      value={scores.weaknesses}
                      onChange={(v) => setScores((s) => ({ ...s, weaknesses: v }))}
                    />
                    <div className="sm:col-span-2">
                      <SmallField
                        label="Recommendations (optional)"
                        value={scores.recommendations}
                        onChange={(v) => setScores((s) => ({ ...s, recommendations: v }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    className="!rounded-[12px] !px-4 !py-2 !border-slate-200 !text-slate-700 hover:!bg-slate-50"
                    onClick={() => saveDraft(selectedStudent)}
                    disabled={submitLoading}
                  >
                    Save Draft
                  </Button>
                  <Button
                    className="!rounded-[12px] !px-4 !py-2 !bg-[#006D6D] !text-white hover:!bg-[#005a5a] border-0"
                    onClick={submitEvaluation}
                    disabled={submitLoading || !scores.feedback.trim()}
                  >
                    {submitLoading ? 'Submitting…' : 'Submit Evaluation'}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Completed */}
        <Card className="border border-slate-200/90 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle className="text-emerald-600" size={20} />
            Students already evaluated
          </h3>
          {loading ? null : completed.length === 0 ? (
            <div className="text-center py-10 text-slate-500 bg-slate-50/60 border border-slate-100 rounded-2xl">
              <p>No completed evaluations yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {completed.map((item) => (
                <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{item.student_name}</p>
                      <p className="text-sm text-slate-500">{stripGroupName(item.group_name)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#022B3A]">{item.total_score} / 60</p>
                      {item.evaluated_at && (
                        <p className="text-xs text-slate-400 mt-1">{new Date(item.evaluated_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}

function ScoreSlider({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{label}</p>
          <p className="text-xs text-slate-500 mt-1">
            {value} / {max}
          </p>
        </div>
        <div className="text-xs font-bold rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(0,109,109,0.10)', color: TEAL }}>
          {pct}%
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[#006D6D]"
      />
    </div>
  );
}

function SmallField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#006D6D]/30"
      />
    </div>
  );
}

