import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../lib/api';

export function Project() {
  const [project, setProject] = useState<any>(null);
  const [hasGroup, setHasGroup] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    objectives: ''
  });

  const loadProject = async () => {
    setLoading(true);
    setMessage(null);
    const [projectRes, groupRes] = await Promise.all([
      apiClient.getMyProject(),
      apiClient.getMyGroup()
    ]);
    if (projectRes.success) setProject(projectRes.data);
    setHasGroup(groupRes.success && groupRes.data != null);
    setLoading(false);
  };

  useEffect(() => {
    loadProject();
  }, []);

  useEffect(() => {
    if (project) {
      setForm({
        title: project.title || '',
        description: project.description || '',
        objectives: project.objectives || ''
      });
    }
  }, [project]);

  const submitProject = async () => {
    if (!form.title?.trim() || !form.description?.trim() || !form.objectives?.trim()) {
      setMessage({ type: 'error', text: 'Title, description, and objectives are required.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const response = await apiClient.submitProject(form);
    if (response.success) {
      setMessage({ type: 'success', text: 'Project proposal submitted successfully. Your supervisor will review it.' });
      await loadProject();
    } else {
      setMessage({ type: 'error', text: (response as any).message || 'Failed to submit. Please ensure you are in a group.' });
    }
    setSubmitting(false);
  };

  const updateProject = async () => {
    if (!project?.id) return;
    if (!form.title?.trim() || !form.description?.trim() || !form.objectives?.trim()) {
      setMessage({ type: 'error', text: 'Title, description, and objectives are required.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const response = await apiClient.updateProject(project.id, form);
    if (response.success) {
      setMessage({ type: 'success', text: 'Proposal updated successfully.' });
      await loadProject();
    } else {
      setMessage({ type: 'error', text: (response as any).message || 'Failed to update.' });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <MainLayout title="Project">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading project...</div>
        </div>
      </MainLayout>
    );
  }

  if (!project && hasGroup === false) {
    return (
      <MainLayout title="Project">
        <Card>
          <h2 className="text-xl font-semibold text-[#1a237e] mb-2">Project Proposal</h2>
          <p className="text-gray-600">
            You need to be assigned to a group before you can submit a project proposal.
            Contact your administrator or check the My Group page.
          </p>
        </Card>
      </MainLayout>
    );
  }

  if (!project) {
    return (
      <MainLayout title="Project">
        <div className="space-y-6">
          <Card>
            <h2 className="text-xl font-semibold text-[#1a237e] mb-4">Submit Project Proposal</h2>
            <p className="text-sm text-gray-600 mb-4">
              Submit your group's project topic for supervisor approval. Once approved, you can begin working on the project.
            </p>
            {message && (
              <div className={`p-3 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {message.text}
              </div>
            )}
            <div className="space-y-3">
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Project Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Description"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Objectives (one per line or numbered list)"
                rows={6}
                value={form.objectives}
                onChange={(e) => setForm({ ...form, objectives: e.target.value })}
              />
              <div className="flex gap-2">
                <Button onClick={submitProject} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit for Approval'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const statusLabel = project.status === 'pending' ? 'Pending Supervisor Approval' : project.status === 'approved' ? 'Approved' : project.status === 'rejected' ? 'Rejected' : project.status;

  return (
    <MainLayout title="Project">
      <div className="space-y-6">
        <Card>
          <h2 className="text-xl font-semibold text-[#1a237e] mb-2">Project Details</h2>
          <div className="flex items-center gap-2 mb-4">
            <span className={`inline-flex px-2 py-1 rounded-full text-sm font-medium ${
              project.status === 'approved' ? 'bg-green-100 text-green-800' :
              project.status === 'rejected' ? 'bg-red-100 text-red-800' :
              'bg-amber-100 text-amber-800'
            }`}>
              {statusLabel}
            </span>
            {project.rejection_reason && (
              <span className="text-sm text-red-600">Reason: {project.rejection_reason}</span>
            )}
          </div>
          {message && (
            <div className={`p-3 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message.text}
            </div>
          )}
          <div className="space-y-3">
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Project Title"
              value={form.title || project.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={project.status !== 'pending' && project.status !== 'rejected'}
            />
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Description"
              rows={4}
              value={form.description || project.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              disabled={project.status !== 'pending' && project.status !== 'rejected'}
            />
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Objectives"
              rows={4}
              value={form.objectives || project.objectives || ''}
              onChange={(e) => setForm({ ...form, objectives: e.target.value })}
              disabled={project.status !== 'pending' && project.status !== 'rejected'}
            />
            {project.status === 'pending' && (
              <Button onClick={updateProject} disabled={submitting}>
                {submitting ? 'Updating...' : 'Update Proposal'}
              </Button>
            )}
            {project.status === 'rejected' && (
              <Button onClick={submitProject} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Resubmit Proposal'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
