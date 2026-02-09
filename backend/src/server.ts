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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// CORS configuration - allow both 5173 and 5174
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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
    
    // Create and register routes that need database connection
    const groupsRouter = createGroupsRouter(db);
    const supervisorsRouter = createSupervisorsRouter(db);
    const settingsRouter = createSettingsRouter(db);
    
    // Register API routes
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/groups', groupsRouter);
    app.use('/api/supervisors', supervisorsRouter);
    app.use('/api/settings', settingsRouter);
    
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
