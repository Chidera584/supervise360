const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'supervise360',
  port: parseInt(process.env.DB_PORT || '3307'),
  charset: 'utf8mb4',
  timezone: '+00:00'
};

// Create database connection pool
const pool = mysql.createPool(dbConfig);

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);

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
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await pool.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

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

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
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

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE id = ? AND is_active = TRUE',
      [req.user.userId]
    );

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

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, ...userWithoutPassword } = user;

    res.json({
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

// Groups routes
app.get('/api/groups', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Groups endpoint called');
    
    // Get all groups with member information
    const [groups] = await pool.execute(`
      SELECT 
        g.id,
        g.name,
        g.department,
        g.supervisor_name,
        g.created_at,
        COUNT(gm.id) as member_count,
        GROUP_CONCAT(
          CONCAT(gm.student_name, ' (GPA: ', gm.student_gpa, ')')
          ORDER BY gm.student_gpa DESC
          SEPARATOR ', '
        ) as members
      FROM project_groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `);
    
    console.log('✅ Groups fetched successfully:', groups.length);
    res.json({
      success: true,
      data: groups
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

    console.log('📊 Received students for grouping:', students.length);

    // Process students and assign GPA tiers
    const processedStudents = students.map(student => {
      const gpa = parseFloat(student.gpa) || 0;
      let tier;
      if (gpa >= 3.5) tier = 'HIGH';
      else if (gpa >= 2.5) tier = 'MEDIUM';
      else tier = 'LOW';
      
      return {
        name: student.name,
        gpa: gpa,
        tier: tier,
        department: student.department || 'Computer Science'
      };
    });

    // Simple group formation algorithm (3 students per group)
    const groupSize = 3;
    const groups = [];
    
    // Sort students by GPA (descending)
    processedStudents.sort((a, b) => b.gpa - a.gpa);
    
    // Form groups with balanced GPA distribution
    for (let i = 0; i < processedStudents.length; i += groupSize) {
      const groupMembers = processedStudents.slice(i, i + groupSize);
      if (groupMembers.length > 0) {
        const avgGpa = groupMembers.reduce((sum, s) => sum + s.gpa, 0) / groupMembers.length;
        groups.push({
          name: `Group ${groups.length + 1}`,
          members: groupMembers,
          avgGpa: Math.round(avgGpa * 100) / 100,
          department: groupMembers[0].department
        });
      }
    }

    console.log('✅ Formed groups:', groups.length);

    // Save groups to database
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const savedGroups = [];
      
      for (const group of groups) {
        // Insert group
        const [groupResult] = await connection.execute(
          'INSERT INTO project_groups (name, department, avg_gpa, created_at) VALUES (?, ?, ?, NOW())',
          [group.name, group.department, group.avgGpa]
        );
        
        const groupId = groupResult.insertId;
        
        // Insert group members
        for (let i = 0; i < group.members.length; i++) {
          const member = group.members[i];
          await connection.execute(
            'INSERT INTO group_members (group_id, student_name, student_gpa, gpa_tier, member_order) VALUES (?, ?, ?, ?, ?)',
            [groupId, member.name, member.gpa, member.tier, i + 1]
          );
        }
        
        savedGroups.push({
          id: groupId,
          ...group
        });
      }

      await connection.commit();
      console.log('✅ Groups saved to database');

      res.json({
        success: true,
        message: `${groups.length} groups formed successfully`,
        data: {
          groups: savedGroups,
          statistics: {
            totalStudents: students.length,
            totalGroups: groups.length,
            averageGroupSize: Math.round((students.length / groups.length) * 100) / 100
          }
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('❌ Error forming groups:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to form groups' 
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
      console.log('✅ All groups cleared');
      
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

// Supervisors routes
app.get('/api/supervisors/workload', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Supervisor workload endpoint called');
    
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
        END as workload_percentage
      FROM supervisor_workload
      ORDER BY department, supervisor_name
    `);
    
    console.log('✅ Supervisor workload fetched:', supervisors.length);
    res.json({
      success: true,
      data: supervisors
    });
  } catch (error) {
    console.error('❌ Error fetching supervisor workload:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch supervisor workload' 
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  console.log('❌ Route not found:', req.method, req.originalUrl);
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Frontend URL: http://localhost:5174`);
      console.log(`\n🔗 Available API Endpoints:`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   Auth: http://localhost:${PORT}/api/auth/*`);
      console.log(`   Groups: http://localhost:${PORT}/api/groups/*`);
      console.log(`   Supervisors: http://localhost:${PORT}/api/supervisors/*`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();