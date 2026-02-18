import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { authenticateToken, requireStudent, requireSupervisor } from '../middleware/auth';
import { ReportService } from '../services/reportService';
import { AuthenticatedRequest } from '../types';

const router = Router();

export function createReportsRouter(db: Pool) {
  const reportService = new ReportService(db);
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const reportsDir = path.join(__dirname, '../../', uploadDir, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, reportsDir),
    filename: (_req, file, cb) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/\s+/g, '_');
      cb(null, `${timestamp}_${safeName}`);
    }
  });

  const upload = multer({ storage });

  router.post('/upload', authenticateToken, requireStudent, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const { report_type, title } = req.body;
      if (!req.file || !report_type) {
        return res.status(400).json({ success: false, message: 'Report file and type are required' });
      }

      const [studentRows] = await db.execute(
        'SELECT matric_number FROM students WHERE user_id = ?',
        [userId]
      );
      const matric = (studentRows as any[])[0]?.matric_number;
      if (!matric) return res.status(400).json({ success: false, message: 'Matric number not found' });

      const groupId = await reportService.getGroupIdByMatric(matric);
      if (!groupId) return res.status(400).json({ success: false, message: 'Group not found' });

      const projectId = await reportService.getProjectIdByGroup(groupId);
      if (!projectId) return res.status(400).json({ success: false, message: 'Project not found for group' });

      const [result] = await db.execute(
        `INSERT INTO reports 
         (project_id, group_id, report_type, title, file_name, file_path, file_size, mime_type, submitted_by, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          projectId,
          groupId,
          report_type,
          title || report_type,
          req.file.originalname,
          path.relative(path.join(__dirname, '../../'), req.file.path),
          req.file.size,
          req.file.mimetype,
          userId
        ]
      );

      res.json({ success: true, message: 'Report uploaded', data: { id: (result as any).insertId } });
    } catch (error) {
      console.error('Upload report error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload report' });
    }
  });

  router.get('/my-reports', authenticateToken, requireStudent, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const data = await reportService.listMyReports(userId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('My reports error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch reports' });
    }
  });

  router.get('/pending-review', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const data = await reportService.listPendingReviews(userId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Pending review reports error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch pending reports' });
    }
  });

  router.post('/:id/review', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const { comments, approved } = req.body;
      if (!comments) return res.status(400).json({ success: false, message: 'Review comments are required' });
      await reportService.reviewReport(Number(req.params.id), userId, comments, !!approved);
      res.json({ success: true, message: 'Report reviewed' });
    } catch (error) {
      console.error('Review report error:', error);
      res.status(500).json({ success: false, message: 'Failed to review report' });
    }
  });

  router.get('/:id/download', authenticateToken, async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT file_path, file_name FROM reports WHERE id = ?', [req.params.id]);
      const report = (rows as any[])[0];
      if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
      const fullPath = path.join(__dirname, '../../', report.file_path);
      return res.download(fullPath, report.file_name);
    } catch (error) {
      console.error('Download report error:', error);
      res.status(500).json({ success: false, message: 'Failed to download report' });
    }
  });

  router.delete('/:id', authenticateToken, requireStudent, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      await reportService.deleteReport(Number(req.params.id), userId);
      res.json({ success: true, message: 'Report deleted' });
    } catch (error) {
      console.error('Delete report error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete report' });
    }
  });

  return router;
}
