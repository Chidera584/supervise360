const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'supervise360',
  port: parseInt(process.env.DB_PORT || '3306'),
  charset: 'utf8mb4',
  timezone: '+00:00',
  connectionLimit: 10,
  queueLimit: 0,
  waitForConnections: true
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Get user by email
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Get role-specific data
    let student = null;
    let supervisor = null;

    if (user.role === 'student') {
      const [students] = await pool.execute('SELECT * FROM students WHERE user_id = ?', [user.id]);
      student = students[0] || null;
    } else if (user.role === 'supervisor' || user.role === 'external_supervisor') {
      const [supervisors] = await pool.execute('SELECT * FROM supervisors WHERE user_id = ?', [user.id]);
      supervisor = supervisors[0] || null;
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        student,
        supervisor,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { first_name, last_name, email, password, role, department, matric_number, gpa } = req.body;

    // Validation
    if (!first_name || !last_name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if email already exists
    const [existingUsers] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if matric number already exists (for students)
    if (role === 'student' && matric_number) {
      const [existingStudents] = await pool.execute('SELECT id FROM students WHERE matric_number = ?', [matric_number]);
      if (existingStudents.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Matric number already registered'
        });
      }
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Create user
    const [userResult] = await pool.execute(
      'INSERT INTO users (first_name, last_name, email, password_hash, role, department, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [first_name, last_name, email, password_hash, role, department, false]
    );

    const userId = userResult.insertId;

    // Create role-specific record
    if (role === 'student' && matric_number && gpa !== undefined) {
      await pool.execute(
        'INSERT INTO students (user_id, matric_number, gpa) VALUES (?, ?, ?)',
        [userId, matric_number, gpa]
      );
    } else if (role === 'supervisor' || role === 'external_supervisor') {
      await pool.execute(
        'INSERT INTO supervisors (user_id, department) VALUES (?, ?)',
        [userId, department || 'General']
      );
    }

    // Auto-login after successful registration
    const loginResponse = await fetch(`http://localhost:${PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      return res.status(201).json(loginData);
    } else {
      return res.status(201).json({
        success: true,
        message: 'Registration successful. Please login.'
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [req.user.id]);
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    let student = null;
    let supervisor = null;

    if (user.role === 'student') {
      const [students] = await pool.execute('SELECT * FROM students WHERE user_id = ?', [user.id]);
      student = students[0] || null;
    } else if (user.role === 'supervisor' || user.role === 'external_supervisor') {
      const [supervisors] = await pool.execute('SELECT * FROM supervisors WHERE user_id = ?', [user.id]);
      supervisor = supervisors[0] || null;
    }

    // Generate new token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: 'User data retrieved successfully',
      data: {
        user: userWithoutPassword,
        student,
        supervisor,
        token
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user data'
    });
  }
});

// User endpoints
app.get('/api/users/students', authenticateToken, async (req, res) => {
  try {
    const [students] = await pool.execute('SELECT * FROM v_students_complete ORDER BY last_name, first_name');
    res.status(200).json({
      success: true,
      message: 'Students retrieved successfully',
      data: students
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve students'
    });
  }
});

app.get('/api/users/supervisors', authenticateToken, async (req, res) => {
  try {
    // Query the supervisor_workload table directly since that's where uploaded supervisors are stored
    const [supervisors] = await pool.execute(`
      SELECT 
        id,
        supervisor_name as name,
        supervisor_name as first_name,
        '' as last_name,
        '' as email,
        department,
        max_groups,
        current_groups,
        is_available,
        created_at,
        updated_at
      FROM supervisor_workload 
      ORDER BY supervisor_name
    `);
    
    console.log('✅ Supervisors fetched from supervisor_workload table:', supervisors.length);
    
    res.status(200).json({
      success: true,
      message: 'Supervisors retrieved successfully',
      data: supervisors
    });
  } catch (error) {
    console.error('Get supervisors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve supervisors'
    });
  }
});

// Groups endpoints
app.get('/api/groups', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Groups endpoint called');
    
    // Get user's department from the token/user info
    const [userInfo] = await pool.execute(
      'SELECT department, role FROM users WHERE id = ?',
      [req.user.id]
    );
    
    const userDepartment = userInfo[0]?.department;
    const userRole = userInfo[0]?.role;
    const isSystemAdmin = userRole === 'admin' && userDepartment === 'Administration';
    
    // Build query based on user role and department
    let whereClause = '';
    let queryParams = [];
    
    // If not system admin, filter by department
    if (!isSystemAdmin && userDepartment) {
      whereClause = 'WHERE g.department = ?';
      queryParams.push(userDepartment);
    }
    
    const [groups] = await pool.execute(`
      SELECT 
        g.*,
        COUNT(gm.id) as member_count,
        GROUP_CONCAT(
          CONCAT(gm.student_name, ' (', gm.student_gpa, ')')
          ORDER BY gm.student_gpa DESC
          SEPARATOR ', '
        ) as members
      FROM project_groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      ${whereClause}
      GROUP BY g.id
      ORDER BY 
        CASE 
          WHEN g.name REGEXP '^Group [0-9]+$' THEN 
            CAST(SUBSTRING(g.name, 7) AS UNSIGNED)
          ELSE 999999 
        END ASC,
        g.name ASC
    `, queryParams);
    
    console.log('✅ Groups fetched successfully:', groups.length, 'for department:', userDepartment || 'All');
    res.json({
      success: true,
      data: groups,
      userDepartment,
      isSystemAdmin
    });
  } catch (error) {
    console.error('❌ Error fetching groups:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch groups' 
    });
  }
});

app.post('/api/groups/form', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Form groups endpoint called');
    const { students } = req.body;
    
    if (!students || !Array.isArray(students)) {
      return res.status(400).json({ 
        success: false,
        error: 'Students array is required' 
      });
    }

    // Get user's department
    const [userInfo] = await pool.execute(
      'SELECT department FROM users WHERE id = ?',
      [req.user.id]
    );
    
    const userDepartment = userInfo[0]?.department || 'Software Engineering';

    console.log('📊 Received students for grouping:', students.length, 'for department:', userDepartment);

    // Use ASP-based group formation algorithm with academic balance priority
    const { GroupFormationService } = require('./groupFormationService-balanced');
    const groupService = new GroupFormationService(pool);
    
    // Process student data with proper tier classification
    const processedStudents = groupService.processStudentData(students);
    
    // Form groups using ASP algorithm (1 HIGH + 1 MEDIUM + 1 LOW per group)
    const groups = groupService.formGroupsUsingASP(processedStudents);
    
    // Validate formation
    const validation = groupService.validateGroupFormation(groups);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false,
        error: 'Group formation validation failed', 
        message: 'Group formation validation failed',
        violations: validation.violations 
      });
    }

    // Save to database with department information
    const groupIds = await groupService.saveGroupsToDatabase(groups, userDepartment);
    
    // Return formed groups with IDs and proper structure
    const groupsWithIds = groups.map((group, index) => ({
      id: groupIds[index],
      name: group.name,
      members: group.members, // Already includes tier information
      avgGpa: group.avg_gpa,
      department: userDepartment
    }));

    res.json({
      success: true,
      message: `${groupsWithIds.length} groups formed successfully for ${userDepartment}`,
      data: {
        groups: groupsWithIds,
        statistics: {
          totalStudents: students.length,
          totalGroups: groupsWithIds.length,
          averageGroupSize: 3,
          department: userDepartment
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error forming groups:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to form groups',
      message: error.message || 'Failed to form groups'
    });
  }
});

app.delete('/api/groups/clear', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Clear groups endpoint called');
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Clear group members first (foreign key constraint)
      await connection.execute('DELETE FROM group_members');
      
      // Clear groups
      await connection.execute('DELETE FROM project_groups');

      await connection.commit();
      
      console.log('✅ All groups cleared successfully');
      res.json({ 
        success: true, 
        message: 'All groups cleared successfully' 
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('❌ Error clearing groups:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear groups' 
    });
  }
});

// Supervisors endpoints
app.get('/api/supervisors/workload', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Supervisor workload endpoint called');
    
    // Get user's department from the token/user info
    const [userInfo] = await pool.execute(
      'SELECT department, role FROM users WHERE id = ?',
      [req.user.id]
    );
    
    const userDepartment = userInfo[0]?.department;
    const userRole = userInfo[0]?.role;
    const isSystemAdmin = userRole === 'admin' && userDepartment === 'Administration';
    
    // Build query based on user role and department
    let whereClause = 'WHERE supervisor_name IS NOT NULL AND supervisor_name != \'\'';
    let queryParams = [];
    
    // If not system admin, filter by department
    if (!isSystemAdmin && userDepartment) {
      whereClause += ' AND department = ?';
      queryParams.push(userDepartment);
    }
    
    const [supervisors] = await pool.execute(`
      SELECT 
        id,
        supervisor_name as name,
        department,
        max_groups,
        current_groups,
        is_available,
        (max_groups - current_groups) as available_slots,
        CASE 
          WHEN max_groups > 0 THEN ROUND((current_groups / max_groups) * 100, 2)
          ELSE 0
        END as workload_percentage,
        created_at,
        updated_at
      FROM supervisor_workload
      ${whereClause}
      ORDER BY department ASC, supervisor_name ASC
    `, queryParams);
    
    // Group supervisors by department for better organization
    const supervisorsByDepartment = {};
    const totalStats = {
      totalSupervisors: supervisors.length,
      totalCapacity: 0,
      totalAssigned: 0,
      availableSlots: 0,
      departments: new Set(),
      isSystemAdmin
    };
    
    supervisors.forEach(supervisor => {
      const dept = supervisor.department || 'Unassigned';
      
      if (!supervisorsByDepartment[dept]) {
        supervisorsByDepartment[dept] = {
          department: dept,
          supervisors: [],
          departmentStats: {
            count: 0,
            totalCapacity: 0,
            totalAssigned: 0,
            availableSlots: 0,
            averageWorkload: 0
          }
        };
      }
      
      supervisorsByDepartment[dept].supervisors.push(supervisor);
      supervisorsByDepartment[dept].departmentStats.count++;
      supervisorsByDepartment[dept].departmentStats.totalCapacity += supervisor.max_groups;
      supervisorsByDepartment[dept].departmentStats.totalAssigned += supervisor.current_groups;
      supervisorsByDepartment[dept].departmentStats.availableSlots += supervisor.available_slots;
      
      totalStats.totalCapacity += supervisor.max_groups;
      totalStats.totalAssigned += supervisor.current_groups;
      totalStats.availableSlots += supervisor.available_slots;
      totalStats.departments.add(dept);
    });
    
    // Calculate average workload per department
    Object.values(supervisorsByDepartment).forEach(dept => {
      if (dept.departmentStats.totalCapacity > 0) {
        dept.departmentStats.averageWorkload = Math.round(
          (dept.departmentStats.totalAssigned / dept.departmentStats.totalCapacity) * 100
        );
      }
    });
    
    totalStats.departments = totalStats.departments.size;
    totalStats.averageWorkload = totalStats.totalCapacity > 0 
      ? Math.round((totalStats.totalAssigned / totalStats.totalCapacity) * 100)
      : 0;
    
    console.log('✅ Supervisor workload fetched successfully:', supervisors.length, 'for department:', userDepartment || 'All');
    res.json({
      success: true,
      data: {
        supervisors,
        supervisorsByDepartment,
        totalStats,
        userDepartment,
        isSystemAdmin
      }
    });
  } catch (error) {
    console.error('❌ Error fetching supervisor workload:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch supervisor workload' 
    });
  }
});

app.post('/api/supervisors/upload', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Supervisor upload endpoint called');
    const { supervisors } = req.body;
    console.log('📊 Received supervisors:', supervisors);
    
    if (!supervisors || !Array.isArray(supervisors)) {
      return res.status(400).json({ 
        success: false,
        error: 'Supervisors array is required' 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Insert new supervisors (without clearing existing ones for persistence)
      let insertedCount = 0;
      let updatedCount = 0;
      
      for (const supervisor of supervisors) {
        console.log('📝 Processing supervisor:', supervisor);
        
        // Validate supervisor data
        if (!supervisor.name || !supervisor.department) {
          console.log('⚠️ Skipping invalid supervisor:', supervisor);
          continue;
        }
        
        // Check if supervisor already exists
        const [existing] = await connection.execute(
          'SELECT id FROM supervisor_workload WHERE supervisor_name = ? AND department = ?',
          [supervisor.name.trim(), supervisor.department.trim()]
        );
        
        if (existing.length > 0) {
          // Update existing supervisor
          await connection.execute(
            'UPDATE supervisor_workload SET max_groups = ?, updated_at = NOW() WHERE supervisor_name = ? AND department = ?',
            [
              supervisor.maxGroups || supervisor.max_groups || 3,
              supervisor.name.trim(),
              supervisor.department.trim()
            ]
          );
          updatedCount++;
          console.log('🔄 Updated existing supervisor:', supervisor.name);
        } else {
          // Insert new supervisor
          await connection.execute(
            'INSERT INTO supervisor_workload (supervisor_name, department, max_groups, current_groups, is_available, created_at, updated_at) VALUES (?, ?, ?, 0, TRUE, NOW(), NOW())',
            [
              supervisor.name.trim(), 
              supervisor.department.trim(), 
              supervisor.maxGroups || supervisor.max_groups || 3
            ]
          );
          insertedCount++;
          console.log('➕ Added new supervisor:', supervisor.name);
        }
      }

      await connection.commit();
      console.log('✅ Successfully processed supervisors - Inserted:', insertedCount, 'Updated:', updatedCount);
      
      res.json({ 
        success: true, 
        message: `${insertedCount} supervisors added, ${updatedCount} supervisors updated`,
        data: {
          insertedCount,
          updatedCount,
          totalProcessed: insertedCount + updatedCount,
          totalReceived: supervisors.length
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('❌ Error uploading supervisors:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to upload supervisors' 
    });
  }
});

app.post('/api/supervisors/auto-assign', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Auto-assign supervisors endpoint called');
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get unassigned groups
      const [unassignedGroups] = await connection.execute(`
        SELECT id, name, department 
        FROM project_groups 
        WHERE supervisor_name IS NULL OR supervisor_name = ''
        ORDER BY created_at ASC
      `);
      console.log('📊 Found unassigned groups:', unassignedGroups.length);

      // Get available supervisors
      const [availableSupervisors] = await connection.execute(`
        SELECT supervisor_name, department, max_groups, current_groups
        FROM supervisor_workload 
        WHERE is_available = TRUE AND current_groups < max_groups
        ORDER BY current_groups ASC, supervisor_name ASC
      `);
      console.log('📊 Found available supervisors:', availableSupervisors.length);

      let assignmentCount = 0;

      for (const group of unassignedGroups) {
        console.log('🔍 Processing group:', group.name, 'in department:', group.department);
        
        // Find available supervisor in same department or any department if none found
        let availableSupervisor = availableSupervisors.find(sup => 
          sup.department === group.department && sup.current_groups < sup.max_groups
        );

        // If no supervisor in same department, find any available supervisor
        if (!availableSupervisor) {
          availableSupervisor = availableSupervisors.find(sup => 
            sup.current_groups < sup.max_groups
          );
        }

        if (availableSupervisor) {
          console.log('✅ Assigning', availableSupervisor.supervisor_name, 'to', group.name);
          
          // Assign supervisor to group
          await connection.execute(
            'UPDATE project_groups SET supervisor_name = ?, updated_at = NOW() WHERE id = ?',
            [availableSupervisor.supervisor_name, group.id]
          );

          // Update supervisor workload
          await connection.execute(
            'UPDATE supervisor_workload SET current_groups = current_groups + 1, updated_at = NOW() WHERE supervisor_name = ?',
            [availableSupervisor.supervisor_name]
          );

          // Update local supervisor data to prevent over-assignment
          availableSupervisor.current_groups++;
          assignmentCount++;
        } else {
          console.log('❌ No available supervisor found for group:', group.name);
        }
      }

      await connection.commit();
      console.log('✅ Assignment completed:', assignmentCount, 'groups assigned');
      
      res.json({ 
        success: true, 
        message: `${assignmentCount} groups assigned supervisors successfully`,
        data: {
          assignedCount: assignmentCount,
          totalGroups: unassignedGroups.length
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('❌ Error auto-assigning supervisors:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to auto-assign supervisors' 
    });
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
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('Failed to connect to database. Please check your configuration.');
      process.exit(1);
    }
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n🔗 API Endpoints:`);
        console.log(`   Health Check: http://localhost:${PORT}/health`);
        console.log(`   Auth: http://localhost:${PORT}/api/auth`);
        console.log(`   Users: http://localhost:${PORT}/api/users`);
        console.log(`   Groups: http://localhost:${PORT}/api/groups`);
        console.log(`   Supervisors: http://localhost:${PORT}/api/supervisors`);
      }
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