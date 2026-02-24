import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { authenticateToken, requireStudent, requireSupervisor } from '../middleware/auth';
import { ProjectService } from '../services/projectService';
import { AuthenticatedRequest } from '../types';

const router = Router();

export function createProjectsRouter(db: Pool) {
  const projectService = new ProjectService(db);

  router.get('/my-project', authenticateToken, requireStudent, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

      const [studentRows] = await db.execute(
        'SELECT matric_number FROM students WHERE user_id = ?',
        [userId]
      );
      const matric = (studentRows as any[])[0]?.matric_number;
      if (!matric) return res.json({ success: true, data: null });

      const [groupRows] = await db.execute(
        'SELECT group_id FROM group_members WHERE matric_number = ? LIMIT 1',
        [matric]
      );
      const groupId = (groupRows as any[])[0]?.group_id;
      if (!groupId) return res.json({ success: true, data: null });

      const project = await projectService.getProjectByGroupId(groupId);
      res.json({ success: true, data: project });
    } catch (error) {
      console.error('My project error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch project' });
    }
  });

  router.post('/submit', authenticateToken, requireStudent, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const { title, description, objectives, methodology, expected_outcomes } = req.body;
      if (!title || !description || !objectives) {
        return res.status(400).json({ success: false, message: 'Title, description, objectives are required' });
      }

      const [studentRows] = await db.execute(
        'SELECT matric_number FROM students WHERE user_id = ?',
        [userId]
      );
      const matric = (studentRows as any[])[0]?.matric_number;
      if (!matric) return res.status(400).json({ success: false, message: 'Matric number not found' });

      const [groupRows] = await db.execute(
        'SELECT group_id FROM group_members WHERE matric_number = ? LIMIT 1',
        [matric]
      );
      const groupId = (groupRows as any[])[0]?.group_id;
      if (!groupId) return res.status(400).json({ success: false, message: 'Group not found' });

      const result = await projectService.submitProject(groupId, {
        title,
        description,
        objectives,
        methodology,
        expected_outcomes
      });

      if (!result.success) {
        return res.status(400).json({ success: false, message: result.message || 'Submit failed' });
      }

      res.json({ success: true, message: 'Project submitted', data: { id: result.projectId } });
    } catch (error: any) {
      console.error('Submit project error:', error);
      const msg = error?.message || String(error);
      const isSchemaError = msg.toLowerCase().includes('foreign key') || msg.includes("doesn't exist");
      res.status(500).json({
        success: false,
        message: isSchemaError ? `Database error: ${msg}. Run: node backend/fix-projects-table.cjs` : (process.env.NODE_ENV === 'development' ? msg : 'Failed to submit project')
      });
    }
  });

  router.delete('/clear', authenticateToken, requireStudent, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

      const [studentRows] = await db.execute(
        'SELECT matric_number FROM students WHERE user_id = ?',
        [userId]
      );
      const matric = (studentRows as any[])[0]?.matric_number;
      if (!matric) return res.status(400).json({ success: false, message: 'Matric number not found' });

      const [groupRows] = await db.execute(
        'SELECT group_id FROM group_members WHERE matric_number = ? LIMIT 1',
        [matric]
      );
      const groupId = (groupRows as any[])[0]?.group_id;
      if (!groupId) return res.status(400).json({ success: false, message: 'Group not found' });

      const result = await projectService.clearProjectByGroupId(groupId);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.message });
      }
      res.json({ success: true, message: 'Project proposal cleared' });
    } catch (error) {
      console.error('Clear project error:', error);
      res.status(500).json({ success: false, message: 'Failed to clear project' });
    }
  });

  router.put('/:id/update', authenticateToken, requireStudent, async (req, res) => {
    try {
      const { title, description, objectives, methodology, expected_outcomes } = req.body;
      const result = await projectService.updateProject(Number(req.params.id), {
        title,
        description,
        objectives,
        methodology,
        expected_outcomes
      });
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.message });
      }
      res.json({ success: true, message: 'Project updated' });
    } catch (error) {
      console.error('Update project error:', error);
      res.status(500).json({ success: false, message: 'Failed to update project' });
    }
  });

  // Supervisor: get pending project proposals for their groups
  router.get('/pending-for-supervisor', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const projects = await projectService.getPendingProjectsForSupervisor(userId);
      res.json({ success: true, data: projects });
    } catch (error) {
      console.error('Pending projects error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch pending projects' });
    }
  });

  // Supervisor: get ALL project proposals (pending, approved, rejected) for their groups
  router.get('/all-for-supervisor', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const projects = await projectService.getAllProjectsForSupervisor(userId);
      res.json({ success: true, data: projects });
    } catch (error) {
      console.error('All projects error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch project proposals' });
    }
  });

  // Supervisor: approve project proposal
  router.put('/:id/supervisor-approve', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const projectId = Number(req.params.id);
      const allowed = await projectService.isProjectUnderSupervisor(projectId, userId);
      if (!allowed) return res.status(403).json({ success: false, message: 'Project not under your supervision' });
      await projectService.approveProject(projectId);
      res.json({ success: true, message: 'Project approved' });
    } catch (error) {
      console.error('Approve project error:', error);
      res.status(500).json({ success: false, message: 'Failed to approve project' });
    }
  });

  // Supervisor: reject project proposal
  router.put('/:id/supervisor-reject', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const projectId = Number(req.params.id);
      const { reason } = req.body;
      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required' });
      }
      const allowed = await projectService.isProjectUnderSupervisor(projectId, userId);
      if (!allowed) return res.status(403).json({ success: false, message: 'Project not under your supervision' });
      await projectService.rejectProject(projectId, reason.trim());
      res.json({ success: true, message: 'Project rejected' });
    } catch (error) {
      console.error('Reject project error:', error);
      res.status(500).json({ success: false, message: 'Failed to reject project' });
    }
  });

  return router;
}
