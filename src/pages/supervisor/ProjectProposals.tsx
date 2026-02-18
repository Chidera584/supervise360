import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';
import { FileText, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface PendingProject {
  id: number;
  group_id: number;
  group_name: string;
  title: string;
  description: string;
  objectives: string;
  methodology?: string;
  expected_outcomes?: string;
  status: string;
  submitted_at: string;
}

export function ProjectProposals() {
  const [pending, setPending] = useState<PendingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadPending = async () => {
    setLoading(true);
    const res = await apiClient.getPendingProjectProposals();
    if (res.success && Array.isArray(res.data)) {
      setPending(res.data as PendingProject[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleApprove = async (projectId: number) => {
    setApprovingId(projectId);
    setMessage(null);
    const res = await apiClient.approveProjectProposal(projectId);
    if (res.success) {
      setMessage({ type: 'success', text: 'Project approved. The group can now proceed with their project.' });
      await loadPending();
    } else {
      setMessage({ type: 'error', text: (res as any).message || 'Failed to approve' });
    }
    setApprovingId(null);
  };

  const handleReject = async (projectId: number) => {
    const reason = window.prompt('Provide a reason for rejection (required):');
    if (!reason?.trim()) {
      if (reason !== null) setMessage({ type: 'error', text: 'Rejection reason is required.' });
      return;
    }
    setRejectingId(projectId);
    setMessage(null);
    const res = await apiClient.rejectProjectProposal(projectId, reason.trim());
    if (res.success) {
      setMessage({ type: 'success', text: 'Project rejected. The group can revise and resubmit.' });
      await loadPending();
    } else {
      setMessage({ type: 'error', text: (res as any).message || 'Failed to reject' });
    }
    setRejectingId(null);
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <MainLayout title="Project Proposals">
      <div className="space-y-6">
        <Card>
          <h2 className="text-xl font-semibold text-[#1a237e] mb-2">Project Proposals</h2>
          <p className="text-sm text-gray-600">
            Review and approve or reject project proposals from your assigned groups. Approved projects allow students to proceed with their work.
          </p>
        </Card>

        {message && (
          <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <Card>
          <h3 className="text-lg font-semibold text-[#1a237e] mb-4">Pending Review</h3>
          {loading ? (
            <div className="text-gray-500">Loading proposals...</div>
          ) : pending.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p>No pending project proposals.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((p) => (
                <div key={p.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleExpand(p.id)}
                  >
                    <div>
                      <h4 className="font-semibold text-gray-900">{p.title}</h4>
                      <p className="text-sm text-gray-600">{p.group_name} • Submitted {p.submitted_at?.split('T')[0]}</p>
                    </div>
                    {expandedId === p.id ? (
                      <ChevronUp size={20} className="text-gray-500" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-500" />
                    )}
                  </div>
                  {expandedId === p.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">Description</p>
                        <p className="text-gray-900 whitespace-pre-wrap">{p.description || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">Objectives</p>
                        <p className="text-gray-900 whitespace-pre-wrap">{p.objectives || '—'}</p>
                      </div>
                      {p.methodology && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Methodology</p>
                          <p className="text-gray-900 whitespace-pre-wrap">{p.methodology}</p>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleApprove(p.id); }}
                          disabled={approvingId === p.id}
                        >
                          <CheckCircle size={14} className="mr-1" />
                          {approvingId === p.id ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleReject(p.id); }}
                          disabled={rejectingId === p.id}
                        >
                          <XCircle size={14} className="mr-1" />
                          {rejectingId === p.id ? 'Rejecting...' : 'Reject'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
