import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { authenticateToken, requireStudent, requireSupervisor } from '../middleware/auth';
import { EvaluationService } from '../services/evaluationService';
import { AuthenticatedRequest } from '../types';

const router = Router();

export function createEvaluationsRouter(db: Pool) {
  const evaluationService = new EvaluationService(db);

  router.get('/groups-with-projects', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const data = await evaluationService.getGroupsWithProjects(userId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Groups with projects error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch groups' });
    }
  });

  router.get('/pending', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const supervisorId = await evaluationService.getSupervisorId(userId);
      if (!supervisorId) return res.status(400).json({ success: false, message: 'Supervisor profile not found' });
      const data = await evaluationService.getPendingEvaluations(supervisorId, userId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Pending evaluations error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch evaluations' });
    }
  });

  router.get('/completed', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const supervisorId = await evaluationService.getSupervisorId(userId);
      if (!supervisorId) return res.status(400).json({ success: false, message: 'Supervisor profile not found' });
      const data = await evaluationService.getCompletedEvaluations(supervisorId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Completed evaluations error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch evaluations' });
    }
  });

  router.post('/submit', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const supervisorId = await evaluationService.getSupervisorId(userId);
      if (!supervisorId) return res.status(400).json({ success: false, message: 'Supervisor profile not found' });
      const result = await evaluationService.submitEvaluation(supervisorId, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Submit evaluation error:', error);
      res.status(500).json({ success: false, message: 'Failed to submit evaluation' });
    }
  });

  router.get('/my-evaluation', authenticateToken, requireStudent, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const [studentRows] = await db.execute(
        'SELECT matric_number FROM students WHERE user_id = ?',
        [userId]
      );
      const matric = (studentRows as any[])[0]?.matric_number;
      if (!matric) return res.json({ success: true, data: [] });

      const [groupRows] = await db.execute(
        'SELECT group_id FROM group_members WHERE matric_number = ? LIMIT 1',
        [matric]
      );
      const groupId = (groupRows as any[])[0]?.group_id;
      if (!groupId) return res.json({ success: true, data: [] });

      const [projectRows] = await db.execute(
        'SELECT id FROM projects WHERE group_id = ? LIMIT 1',
        [groupId]
      );
      const projectId = (projectRows as any[])[0]?.id;
      if (!projectId) return res.json({ success: true, data: [] });

      const data = await evaluationService.getStudentEvaluation(projectId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Student evaluation error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch evaluation' });
    }
  });

  return router;
}
