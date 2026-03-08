import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { authenticateToken, requireStudent, requireSupervisor } from '../middleware/auth';
import { EvaluationService } from '../services/evaluationService';
import { AuthenticatedRequest } from '../types';

const router = Router();

export function createEvaluationsRouter(db: Pool) {
  const evaluationService = new EvaluationService(db);

  // For supervisors: list all their students with evaluation status
  router.get('/students', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const data = await evaluationService.getStudentsForSupervisor(userId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Students evaluations overview error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch students for evaluation' });
    }
  });

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

  // For supervisors: submit an individual student's evaluation (out of 60)
  router.post('/student-submit', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const supervisorId = await evaluationService.getSupervisorId(userId);
      if (!supervisorId) return res.status(400).json({ success: false, message: 'Supervisor profile not found' });
      const result = await evaluationService.submitStudentEvaluation(supervisorId, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Submit student evaluation error:', error);
      res.status(500).json({ success: false, message: 'Failed to submit student evaluation' });
    }
  });

  router.get('/my-evaluation', authenticateToken, requireStudent, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const row = await evaluationService.getStudentSelfEvaluation(userId);
      const data = row ? [row] : [];
      res.json({ success: true, data });
    } catch (error) {
      console.error('Student evaluation error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch evaluation' });
    }
  });

  return router;
}
