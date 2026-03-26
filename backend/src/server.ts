import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Import database initialization
import { initializeDatabase } from './config/database';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import { createGroupsRouter } from './routes/groups';
import { createSupervisorsRouter } from './routes/supervisors';
import { createSettingsRouter } from './routes/settings';
import { createAdminRouter } from './routes/admin';
import { createProjectsRouter } from './routes/projects';
import { createReportsRouter } from './routes/reports';
import { createEvaluationsRouter } from './routes/evaluations';
import { createMessagesRouter } from './routes/messages';
import { createNotificationsRouter } from './routes/notifications';
import { NotificationService } from './services/notificationService';
import { createDefensePanelsRouter } from './routes/defensePanels';
import { authenticateToken, requireAdmin, requireSupervisor } from './middleware/auth';
import type { AuthenticatedRequest } from './types';
import { computeAllocation } from './services/defenseSchedulingService';
import { DefenseAllocationService } from './services/defenseAllocationService';
import { ensureProjectGroupsSchema, backfillProjectsForGroups, ensureDepartmentsTables } from './services/schemaFixService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
// Note: This API is consumed cross-origin by the Railway-hosted frontend.
// Helmet's default Cross-Origin-Resource-Policy ("same-origin") can cause browsers to block
// cross-origin API responses in ways that surface as CORS/network errors.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration - allow frontend URL, localhost, and Railway domains
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    const allowed = [
      frontendUrl,
      frontendUrl.replace(/\/$/, ''),
      'http://localhost:5173',
      'http://localhost:5174'
    ];
    if (!origin || allowed.includes(origin) || origin.endsWith('.railway.app') || origin.endsWith('.up.railway.app')) {
      cb(null, true);
    } else {
      cb(null, true); // Allow for deployment flexibility
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Ensure preflight requests are answered consistently before hitting auth middleware/routes.
app.options('*', cors(corsOptions));

// Rate limiting - more lenient in development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || (process.env.NODE_ENV === 'development' ? '1000' : '100')), // Higher limit for development
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  // Skip rate limiting for health checks in development
  skip: (req) => process.env.NODE_ENV === 'development' && req.path === '/health'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection
    const db = await initializeDatabase();

    // Fix schema (projects/reports FKs) and backfill projects so report submission works
    await ensureProjectGroupsSchema(db);
    const backfilled = await backfillProjectsForGroups(db);
    if (backfilled > 0) {
      console.log(`✅ Backfilled ${backfilled} project(s) for groups`);
    }
    await ensureDepartmentsTables(db);

    // Create and register routes that need database connection
    const groupsRouter = createGroupsRouter(db);
    const supervisorsRouter = createSupervisorsRouter(db);
    const settingsRouter = createSettingsRouter(db);
    const adminRouter = createAdminRouter(db);
    const projectsRouter = createProjectsRouter(db);
    const reportsRouter = createReportsRouter(db);
    const evaluationsRouter = createEvaluationsRouter(db);
    const messagesRouter = createMessagesRouter(db);
    const notificationsRouter = createNotificationsRouter(db);
    const defensePanelsRouter = createDefensePanelsRouter(db);
    
    // Register API routes (standalone my-groups before supervisors router so it's guaranteed to work)
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/groups', groupsRouter);
    app.get('/api/supervisors/my-groups', authenticateToken, requireSupervisor, async (req, res) => {
      try {
        const userId = (req as AuthenticatedRequest).user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
        const [userRows] = await db.execute('SELECT first_name, last_name FROM users WHERE id = ?', [userId]);
        const user = (userRows as any[])[0];
        const firstName = (user?.first_name || '').trim();
        const lastName = (user?.last_name || '').trim();
        const fullName = `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
        if (!fullName && !firstName && !lastName) return res.json({ success: true, data: [] });
        const groupParams: any[] = [fullName, fullName];
        let groupWhere = `WHERE TRIM(COALESCE(supervisor_name, '')) = ? OR supervisor_name LIKE CONCAT('%', ?, '%')`;
        if (firstName && lastName) {
          groupWhere += ` OR (supervisor_name LIKE CONCAT('%', ?, '%') AND supervisor_name LIKE CONCAT('%', ?, '%'))`;
          groupParams.push(firstName, lastName);
        }
        const [groupRows] = await db.execute(
          `SELECT id, name, department, status, avg_gpa, supervisor_name, created_at FROM project_groups ${groupWhere} ORDER BY name ASC`,
          groupParams
        );
        const groups = groupRows as any[];
        const result = await Promise.all(groups.map(async (g: any) => {
          const [memberRows] = await db.execute(
            'SELECT id, student_name, student_gpa, gpa_tier, matric_number, member_order FROM group_members WHERE group_id = ? ORDER BY member_order ASC',
            [g.id]
          );
          const members = (memberRows as any[]).map(m => ({ id: m.id, name: m.student_name, gpa: m.student_gpa, tier: m.gpa_tier, matricNumber: m.matric_number }));
          const [projectRows] = await db.execute('SELECT id, title, status, progress_percentage, submitted_at FROM projects WHERE group_id = ? LIMIT 1', [g.id]);
          const project = (projectRows as any[])[0] || null;
          const [reportCounts] = await db.execute(
            `SELECT COUNT(*) as total, SUM(CASE WHEN reviewed = TRUE THEN 1 ELSE 0 END) as reviewed
             FROM reports r INNER JOIN projects p ON r.project_id = p.id WHERE p.group_id = ?`,
            [g.id]
          );
          const counts = (reportCounts as any[])[0] || { total: 0, reviewed: 0 };
          const totalReports = Number(counts.total) || 0, reportsReviewed = Number(counts.reviewed) || 0;
          return { id: g.id, name: g.name, department: g.department, status: g.status || 'formed', avg_gpa: g.avg_gpa, supervisor: g.supervisor_name, members, project: project ? { id: project.id, title: project.title, status: project.status, progress_percentage: project.progress_percentage, submitted_at: project.submitted_at } : null, reportsTotal: totalReports, reportsReviewed, reportsPending: totalReports - reportsReviewed };
        }));
        res.json({ success: true, data: result });
      } catch (err) {
        console.error('[my-groups]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch your groups' });
      }
    });
    app.use('/api/supervisors', supervisorsRouter);
    app.use('/api/settings', settingsRouter);
    app.use('/api/admin', adminRouter);
    app.use('/api/projects', projectsRouter);
    app.use('/api/reports', reportsRouter);
    app.use('/api/evaluations', evaluationsRouter);
    app.use('/api/messages', messagesRouter);
    // Explicit unread-count route (avoids any router mounting issues)
    app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
      try {
        const userId = (req as AuthenticatedRequest).user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
        const count = await new NotificationService(db).getUnreadCount(userId);
        res.json({ success: true, data: count });
      } catch (error) {
        console.error('Unread count error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
      }
    });
    app.use('/api/notifications', notificationsRouter);
    app.use('/api/defense-panels', defensePanelsRouter);

    // Defense scheduling allocation - standalone path (avoids router mounting issues)
    app.post('/api/allocate-defense', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { staff, venues, groupRanges } = req.body;
        if (!Array.isArray(staff) || !Array.isArray(venues)) {
          return res.status(400).json({ success: false, message: 'staff and venues arrays are required' });
        }
        const ranges = Array.isArray(groupRanges) ? groupRanges : [];
        const result = computeAllocation(staff, venues, ranges);

        // Persist to database so students and supervisors can see their defense info
        const allocService = new DefenseAllocationService(db);
        const toSave = (result.allocations || []).map((a: any) => ({
          venue: a.venue?.venue_name || '',
          groupRange: a.groupRange ? { department: a.groupRange.department, start: a.groupRange.start, end: a.groupRange.end } : undefined,
          assessors: (a.team?.members || []).map((m: any) => m.name || '')
        }));
        await allocService.saveAllocations(toSave);

        // Notify students via in-app notification + email
        const { notifyDefenseScheduled } = await import('./services/notificationEmailService');
        const studentsToNotify = await allocService.getStudentsToNotifyForPublishedDefense();
        for (const s of studentsToNotify) {
          notifyDefenseScheduled(db, s.userId, s.email, s.studentName, s.venue, s.assessors, s.groupName).catch(() => {});
        }

        res.json({ success: true, data: result });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Allocation failed';
        console.error('Defense scheduling allocate error:', error);
        res.status(400).json({ success: false, message: msg });
      }
    });
    
    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    });

    // Global error handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Global error handler:', err);
      
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });
    
    // Start server (capture instance so we can handle errors like EADDRINUSE)
    const server = app.listen(Number(PORT), () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`📁 Upload directory: ${process.env.UPLOAD_DIR || 'uploads'}`);
      console.log(`📧 Email: ${process.env.SMTP_HOST && process.env.SMTP_USER ? 'configured' : 'NOT configured (add SMTP_* to .env)'}`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n🔗 API Endpoints:`);
        console.log(`   Health Check: http://localhost:${PORT}/health`);
        console.log(`   Auth: http://localhost:${PORT}/api/auth`);
        console.log(`   Users: http://localhost:${PORT}/api/users`);
        console.log(`   Groups: http://localhost:${PORT}/api/groups`);
        console.log(`   Supervisors: http://localhost:${PORT}/api/supervisors`);
        console.log(`   Settings: http://localhost:${PORT}/api/settings`);
      }
    });

    // Handle server errors explicitly to provide clearer guidance
    server.on('error', (err: any) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`✖ Port ${PORT} is already in use. Kill the process using the port or set a different PORT environment variable.`);
        console.error('  Example (PowerShell): netstat -ano | findstr :5000  then taskkill /PID <pid> /F');
        process.exit(1);
      }

      console.error('Server error:', err);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer();
