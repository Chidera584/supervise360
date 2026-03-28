import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { authenticateToken, requireStudent, requireSupervisor } from '../middleware/auth';
import { ReportService } from '../services/reportService';
import { AuthenticatedRequest } from '../types';
import {
  notifySubmissionConfirmation,
  notifySupervisorFeedback,
  notifyStudentSubmission,
} from '../services/notificationEmailService';
import { backfillProjectsForGroups } from '../services/schemaFixService';

const router = Router();

/** Multer saves as `${timestamp}_${originalWithSpacesToUnderscores}` — try to find file on disk when DB path differs (deploy cwd, Windows paths, etc.). */
function collectReportsDirectories(uploadDir: string, reportsDir: string): string[] {
  const codeRoot = path.resolve(__dirname, '../../');
  const dirs = [
    reportsDir,
    path.join(codeRoot, uploadDir, 'reports'),
    path.join(codeRoot, 'uploads', 'reports'),
    path.join(process.cwd(), uploadDir, 'reports'),
    path.join(process.cwd(), 'uploads', 'reports'),
    path.join(process.cwd(), 'backend', uploadDir, 'reports'),
    path.join(process.cwd(), 'backend', 'uploads', 'reports'),
  ];
  const envRoot = process.env.UPLOADS_ROOT?.trim();
  if (envRoot) {
    dirs.push(path.join(envRoot, 'reports'));
    dirs.push(path.join(envRoot, uploadDir, 'reports'));
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of dirs) {
    const n = path.normalize(d);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function findReportFileByScanning(
  dirs: string[],
  fileName: string | null | undefined,
  storedRelativePath: string | null | undefined
): string | null {
  const safeOriginal = String(fileName || '')
    .trim()
    .replace(/\s+/g, '_');
  const basenameFromDb = storedRelativePath
    ? path.basename(String(storedRelativePath).replace(/\\/g, '/'))
    : '';

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }
    if (basenameFromDb && files.includes(basenameFromDb)) {
      const full = path.join(dir, basenameFromDb);
      if (fs.statSync(full).isFile()) return full;
    }
    if (safeOriginal) {
      const match = files.find(
        (f) =>
          f === safeOriginal ||
          f.endsWith(`_${safeOriginal}`) ||
          f.endsWith(safeOriginal)
      );
      if (match) {
        const full = path.join(dir, match);
        try {
          if (fs.statSync(full).isFile()) return full;
        } catch {
          /* ignore */
        }
      }
    }
  }
  return null;
}

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

      let projectId = await reportService.getProjectIdByGroup(groupId);
      if (!projectId) {
        await backfillProjectsForGroups(db);
        projectId = await reportService.getProjectIdByGroup(groupId);
      }
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

      // Notify student (submission confirmation) and supervisor (student submission)
      const reportTitle = title || report_type;
      const [userRows] = await db.execute('SELECT first_name, last_name, email FROM users WHERE id = ?', [userId]);
      const submitter = (userRows as any[])[0];
      const submitterName = submitter ? `${submitter.first_name || ''} ${submitter.last_name || ''}`.trim() : 'Student';
      notifySubmissionConfirmation(db, userId, submitter?.email, submitterName, reportTitle, req.file.originalname).catch(() => {});

      // Get supervisor for this group and notify them
      const [pgRows] = await db.execute('SELECT supervisor_name FROM project_groups WHERE id = ?', [groupId]);
      const supName = (pgRows as any[])[0]?.supervisor_name;
      if (supName) {
        const sn = String(supName).trim().replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Engr\.?)\s+/i, '');
        const parts = sn.split(/[\s,]+/).filter(Boolean);
        const lastPart = parts[parts.length - 1];
        const [supUserRows] = await db.execute(
          `SELECT u.id, u.email, u.first_name, u.last_name FROM users u
           INNER JOIN supervisors s ON s.user_id = u.id
           WHERE ? LIKE CONCAT('%', TRIM(COALESCE(u.first_name,'')), '%')
             AND ? LIKE CONCAT('%', TRIM(COALESCE(u.last_name,'')), '%')
             AND COALESCE(u.first_name,'') != '' AND COALESCE(u.last_name,'') != ''
           LIMIT 1`,
          [sn, sn]
        );
        let supUser = (supUserRows as any[])[0];
        if (!supUser && lastPart) {
          const [fallback] = await db.execute(
            `SELECT u.id, u.email, u.first_name, u.last_name FROM users u
             INNER JOIN supervisors s ON s.user_id = u.id
             WHERE (u.last_name = ? OR ? LIKE CONCAT('%', u.last_name, '%')) LIMIT 1`,
            [lastPart, sn]
          );
          supUser = (fallback as any[])[0];
        }
        if (supUser) {
          const supFullName = `${supUser.first_name || ''} ${supUser.last_name || ''}`.trim();
          notifyStudentSubmission(db, supUser.id, supUser.email, supFullName, submitterName, reportTitle, req.file.originalname).catch(() => {});
        }
      }

      res.json({ success: true, message: 'Report uploaded', data: { id: (result as any).insertId } });
    } catch (error: any) {
      console.error('Upload report error:', error);
      const msg = error?.message || String(error);
      const isFkError = msg.toLowerCase().includes('foreign key') || msg.includes("doesn't exist");
      res.status(500).json({
        success: false,
        message: isFkError ? `Database error: ${msg}. Run: node backend/fix-reports-table.cjs` : (process.env.NODE_ENV === 'development' ? msg : 'Failed to upload report')
      });
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

      if (data.length === 0) {
        const [userRows] = await db.execute('SELECT id, first_name, last_name FROM users WHERE id = ?', [userId]);
        const groupIds = await reportService.getSupervisorGroupIds(userId);
        const [allUnreviewed] = await db.execute(
          `SELECT r.id, r.title, r.reviewed, r.group_id as r_group_id, r.project_id, p.group_id as p_group_id, pg.supervisor_name
           FROM reports r
           LEFT JOIN projects p ON r.project_id = p.id
           LEFT JOIN project_groups pg ON COALESCE(p.group_id, r.group_id) = pg.id
           WHERE r.reviewed = 0 OR r.reviewed = FALSE OR r.reviewed IS NULL`
        );
        const [allGroups] = await db.execute(
          'SELECT id, name, supervisor_name FROM project_groups WHERE supervisor_name IS NOT NULL'
        );
        return res.json({
          success: true,
          data,
          _debug: {
            userId,
            userName: (userRows as any[])[0],
            myGroupIds: groupIds,
            allUnreviewedReports: allUnreviewed,
            allGroupsWithSupervisor: allGroups,
          },
        });
      }
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
      const reportId = Number(req.params.id);

      // Get report and submitter before review
      const [reportRows] = await db.execute(
        'SELECT r.title, r.submitted_by FROM reports r WHERE r.id = ?',
        [reportId]
      );
      const report = (reportRows as any[])[0];
      const submittedBy = report?.submitted_by;

      await reportService.reviewReport(reportId, userId, comments, !!approved);

      // Notify student of supervisor feedback
      if (submittedBy) {
        const [submitterRows] = await db.execute('SELECT first_name, last_name, email FROM users WHERE id = ?', [submittedBy]);
        const [reviewerRows] = await db.execute('SELECT first_name, last_name FROM users WHERE id = ?', [userId]);
        const submitter = (submitterRows as any[])[0];
        const reviewer = (reviewerRows as any[])[0];
        const submitterName = submitter ? `${submitter.first_name || ''} ${submitter.last_name || ''}`.trim() : 'Student';
        const reviewerName = reviewer ? `${reviewer.first_name || ''} ${reviewer.last_name || ''}`.trim() : 'Supervisor';
        notifySupervisorFeedback(
          db,
          submittedBy,
          submitter?.email,
          submitterName,
          reviewerName,
          report?.title || 'Report',
          comments,
          !!approved,
          !approved ? comments : undefined
        ).catch(() => {});
      }

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

      const allReportDirs = collectReportsDirectories(uploadDir, reportsDir);
      const candidatePaths: string[] = [];
      const push = (p: string) => {
        const n = path.normalize(p);
        if (!candidatePaths.includes(n)) candidatePaths.push(n);
      };

      if (report.file_path) {
        // Normalize Windows/Unix separators so uploads created on Windows still resolve on Linux.
        const normalizedPath = String(report.file_path).replace(/\\/g, '/').trim();
        const trimmedRelative = normalizedPath.replace(/^\.?\//, '');

        // If DB already stores an absolute path, try it directly.
        if (path.isAbsolute(normalizedPath)) {
          push(normalizedPath);
        }

        // Common relative forms from DB (e.g. uploads/reports/file.pdf).
        push(path.resolve(__dirname, '../../', trimmedRelative));

        // Same relative path under every candidate reports root.
        for (const dir of allReportDirs) {
          push(path.join(dir, path.basename(trimmedRelative)));
          const reportsSegment = trimmedRelative.includes('/reports/')
            ? trimmedRelative.split('/reports/').pop()
            : trimmedRelative.split('reports/').pop();
          if (reportsSegment) push(path.join(dir, reportsSegment));
        }
      }
      if (report.file_name) {
        for (const dir of allReportDirs) {
          push(path.join(dir, report.file_name));
          const safe = String(report.file_name).trim().replace(/\s+/g, '_');
          push(path.join(dir, safe));
        }
      }

      const foundPath = candidatePaths.find((p) => {
        try {
          return fs.existsSync(p) && fs.statSync(p).isFile();
        } catch {
          return false;
        }
      });

      const scannedPath =
        foundPath ||
        findReportFileByScanning(allReportDirs, report.file_name, report.file_path);

      if (!scannedPath) {
        const debug =
          process.env.NODE_ENV === 'development'
            ? {
                reportFilePath: report.file_path,
                reportFileName: report.file_name,
                candidatePaths,
                scannedDirs: allReportDirs,
              }
            : undefined;

        return res.status(404).json({
          success: false,
          message:
            'Report file not found on server. If the app was redeployed, local uploads may have been cleared—use persistent storage (e.g. Railway volume) or ask the student to re-upload.',
          ...(debug ? { _debug: debug } : {}),
        });
      }

      return res.download(scannedPath, report.file_name);
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
