const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Chidera_2468',
  database: process.env.DB_NAME || 'supervise360',
  port: parseInt(process.env.DB_PORT || '3307')
};

// Create database connection pool
const pool = mysql.createPool(dbConfig);

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Get all groups
app.get('/api/groups', async (req, res) => {
  try {
    const [groups] = await pool.execute(`
      SELECT g.*, 
             COUNT(gm.id) as member_count
      FROM project_groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `);

    const groupsWithMembers = [];
    
    for (const group of groups) {
      const [members] = await pool.execute(
        'SELECT * FROM group_members WHERE group_id = ? ORDER BY member_order ASC',
        [group.id]
      );
      
      groupsWithMembers.push({
        id: group.id,
        name: group.name,
        avg_gpa: group.avg_gpa,
        status: group.status,
        supervisor_name: group.supervisor_name,
        department: group.department,
        members: members.map(m => ({
          name: m.student_name,
          gpa: m.student_gpa,
          tier: m.gpa_tier,
          matric_number: m.matric_number
        }))
      });
    }

    res.json({ success: true, data: groupsWithMembers });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch groups' });
  }
});

// Form groups from student data
app.post('/api/groups/form', async (req, res) => {
  try {
    const { students } = req.body;
    
    if (!students || !Array.isArray(students)) {
      return res.status(400).json({ success: false, error: 'Students array is required' });
    }

    // Process students and classify by GPA tiers
    const processedStudents = students.map(student => {
      const gpa = parseFloat(student.gpa || student.GPA || 0);
      let tier = 'LOW';
      if (gpa >= 3.80) tier = 'HIGH';
      else if (gpa >= 3.30) tier = 'MEDIUM';
      
      return {
        name: student.name || student.Name,
        gpa: gpa,
        tier: tier,
        matric_number: student.matric_number || student.matricNumber || student.ID || 'N/A'
      };
    });

    // Separate by tiers
    const highTier = processedStudents.filter(s => s.tier === 'HIGH');
    const mediumTier = processedStudents.filter(s => s.tier === 'MEDIUM');
    const lowTier = processedStudents.filter(s => s.tier === 'LOW');

    // Form groups (1 from each tier)
    const maxGroups = Math.min(highTier.length, mediumTier.length, lowTier.length);
    
    if (maxGroups === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot form groups: insufficient students in one or more tiers' 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const formedGroups = [];
      
      for (let i = 0; i < maxGroups; i++) {
        const groupMembers = [highTier[i], mediumTier[i], lowTier[i]];
        groupMembers.sort((a, b) => b.gpa - a.gpa); // Sort by GPA desc
        
        const avgGpa = parseFloat(
          (groupMembers.reduce((sum, member) => sum + member.gpa, 0) / 3).toFixed(2)
        );
        
        // Insert group
        const [groupResult] = await connection.execute(
          `INSERT INTO project_groups (name, avg_gpa, status, formation_method, department, created_at) 
           VALUES (?, ?, 'formed', 'asp', 'Computer Science', NOW())`,
          [`Group ${String.fromCharCode(65 + i)}`, avgGpa]
        );
        
        const groupId = groupResult.insertId;
        
        // Insert members
        for (let j = 0; j < groupMembers.length; j++) {
          const member = groupMembers[j];
          await connection.execute(
            `INSERT INTO group_members (group_id, student_name, student_gpa, gpa_tier, member_order, matric_number) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [groupId, member.name, member.gpa, member.tier, j + 1, member.matric_number]
          );
        }
        
        formedGroups.push({
          id: groupId,
          name: `Group ${String.fromCharCode(65 + i)}`,
          avg_gpa: avgGpa,
          status: 'formed',
          members: groupMembers
        });
      }
      
      await connection.commit();
      
      res.json({
        success: true,
        data: {
          groups: formedGroups,
          statistics: {
            totalGroups: formedGroups.length,
            totalStudents: processedStudents.length,
            averageGpa: parseFloat((formedGroups.reduce((sum, g) => sum + g.avg_gpa, 0) / formedGroups.length).toFixed(2))
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
    console.error('Error forming groups:', error);
    res.status(500).json({ success: false, error: 'Failed to form groups' });
  }
});

// Clear all groups
app.delete('/api/groups/clear', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      await connection.execute('DELETE FROM group_members');
      await connection.execute('DELETE FROM project_groups');
      await connection.execute('UPDATE supervisor_workload SET current_groups = 0');
      
      await connection.commit();
      
      res.json({ success: true, message: 'All groups cleared successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error clearing groups:', error);
    res.status(500).json({ success: false, error: 'Failed to clear groups' });
  }
});

// Get supervisor workload
app.get('/api/supervisors/workload', async (req, res) => {
  try {
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
    
    res.json({ success: true, data: supervisors });
  } catch (error) {
    console.error('Error fetching supervisor workload:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch supervisor workload' });
  }
});

// Upload supervisors
app.post('/api/supervisors/upload', async (req, res) => {
  try {
    const { supervisors } = req.body;
    
    if (!supervisors || !Array.isArray(supervisors)) {
      return res.status(400).json({ success: false, error: 'Supervisors array is required' });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      for (const supervisor of supervisors) {
        await connection.execute(
          `INSERT INTO supervisor_workload (supervisor_name, department, max_groups, current_groups, is_available) 
           VALUES (?, ?, ?, 0, TRUE)
           ON DUPLICATE KEY UPDATE 
           max_groups = VALUES(max_groups),
           updated_at = NOW()`,
          [supervisor.name, supervisor.department, supervisor.maxGroups || 3]
        );
      }

      await connection.commit();
      
      res.json({ 
        success: true, 
        message: `${supervisors.length} supervisors uploaded successfully` 
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error uploading supervisors:', error);
    res.status(500).json({ success: false, error: 'Failed to upload supervisors' });
  }
});

// Auto-assign supervisors
app.post('/api/supervisors/auto-assign', async (req, res) => {
  try {
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

      // Get available supervisors
      const [availableSupervisors] = await connection.execute(`
        SELECT supervisor_name, department, max_groups, current_groups
        FROM supervisor_workload 
        WHERE is_available = TRUE AND current_groups < max_groups
        ORDER BY current_groups ASC, supervisor_name ASC
      `);

      let assignmentCount = 0;

      for (const group of unassignedGroups) {
        // Find available supervisor in same department
        const availableSupervisor = availableSupervisors.find(sup => 
          sup.department === group.department && sup.current_groups < sup.max_groups
        );

        if (availableSupervisor) {
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
        }
      }

      await connection.commit();
      
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
    console.error('Error auto-assigning supervisors:', error);
    res.status(500).json({ success: false, error: 'Failed to auto-assign supervisors' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple server running on port ${PORT}`);
  console.log(`🌐 Frontend URL: http://localhost:5173`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Test database connection
pool.getConnection()
  .then(connection => {
    console.log('✅ Database connected successfully');
    connection.release();
  })
  .catch(error => {
    console.error('❌ Database connection failed:', error.message);
  });