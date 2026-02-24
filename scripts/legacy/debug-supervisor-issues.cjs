const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugSupervisorIssues() {
  console.log('🔍 Debugging supervisor assignment issues...\n');
  
  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Chidera_2468',
    database: process.env.DB_NAME || 'supervise360',
    port: parseInt(process.env.DB_PORT || '3307')
  };
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Check what tables exist
    console.log('\n📋 Available Tables:');
    const [tables] = await connection.execute('SHOW TABLES');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   - ${tableName}`);
    });
    
    // Check users table for supervisors
    console.log('\n👥 Users with supervisor role:');
    const [supervisorUsers] = await connection.execute(`
      SELECT id, first_name, last_name, email, role, department, is_active 
      FROM users 
      WHERE role IN ('supervisor', 'external_supervisor')
      ORDER BY created_at DESC
    `);
    
    if (supervisorUsers.length === 0) {
      console.log('   ❌ No supervisor users found in users table');
    } else {
      supervisorUsers.forEach(user => {
        console.log(`   ${user.id}: ${user.first_name} ${user.last_name} (${user.email}) - ${user.role} - ${user.department || 'N/A'} - ${user.is_active ? 'Active' : 'Inactive'}`);
      });
    }
    
    // Check supervisors table
    console.log('\n🎓 Supervisors table:');
    try {
      const [supervisors] = await connection.execute(`
        SELECT s.*, u.first_name, u.last_name, u.email 
        FROM supervisors s
        JOIN users u ON s.user_id = u.id
        ORDER BY s.created_at DESC
      `);
      
      if (supervisors.length === 0) {
        console.log('   ❌ No records found in supervisors table');
      } else {
        supervisors.forEach(sup => {
          console.log(`   ${sup.id}: ${sup.first_name} ${sup.last_name} - Dept: ${sup.department} - Max: ${sup.max_capacity} - Current: ${sup.current_load}`);
        });
      }
    } catch (error) {
      console.log('   ❌ Error querying supervisors table:', error.message);
    }
    
    // Check groups tables
    console.log('\n👥 Groups in student_groups table:');
    try {
      const [groups] = await connection.execute(`
        SELECT * FROM student_groups ORDER BY created_at DESC LIMIT 10
      `);
      
      if (groups.length === 0) {
        console.log('   ❌ No groups found in student_groups table');
      } else {
        groups.forEach(group => {
          console.log(`   ${group.id}: ${group.name || 'Unnamed'} - Dept: ${group.department || 'N/A'} - Status: ${group.status || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log('   ❌ Error querying student_groups table:', error.message);
    }
    
    // Check if there's a groups table (different from student_groups)
    console.log('\n👥 Groups in groups table (if exists):');
    try {
      const [groups] = await connection.execute(`
        SELECT * FROM groups ORDER BY created_at DESC LIMIT 10
      `);
      
      if (groups.length === 0) {
        console.log('   ❌ No groups found in groups table');
      } else {
        groups.forEach(group => {
          console.log(`   ${group.id}: ${group.name || 'Unnamed'} - Avg GPA: ${group.avg_gpa || 'N/A'} - Status: ${group.status || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log('   ❌ Groups table does not exist or error:', error.message);
    }
    
    // Check group_members table
    console.log('\n👨‍🎓 Group members:');
    try {
      const [members] = await connection.execute(`
        SELECT * FROM group_members ORDER BY group_id, member_order LIMIT 20
      `);
      
      if (members.length === 0) {
        console.log('   ❌ No group members found');
      } else {
        members.forEach(member => {
          console.log(`   Group ${member.group_id}: ${member.student_name} - GPA: ${member.student_gpa} - Tier: ${member.gpa_tier} - Order: ${member.member_order}`);
        });
      }
    } catch (error) {
      console.log('   ❌ Error querying group_members table:', error.message);
    }
    
    // Check students table
    console.log('\n👨‍🎓 Students in database:');
    const [students] = await connection.execute(`
      SELECT u.first_name, u.last_name, u.email, s.matric_number, s.gpa, s.gpa_tier, s.group_id
      FROM users u
      JOIN students s ON u.id = s.user_id
      ORDER BY u.created_at DESC
      LIMIT 10
    `);
    
    if (students.length === 0) {
      console.log('   ❌ No students found in database');
    } else {
      students.forEach(student => {
        console.log(`   ${student.first_name} ${student.last_name} (${student.matric_number}) - GPA: ${student.gpa || 'N/A'} - Tier: ${student.gpa_tier || 'N/A'} - Group: ${student.group_id || 'None'}`);
      });
    }
    
    // Check views
    console.log('\n📊 Available Views:');
    try {
      const [views] = await connection.execute(`
        SELECT TABLE_NAME FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'VIEW'
      `, [process.env.DB_NAME || 'supervise360']);
      
      if (views.length === 0) {
        console.log('   ❌ No views found');
      } else {
        views.forEach(view => {
          console.log(`   - ${view.TABLE_NAME}`);
        });
      }
    } catch (error) {
      console.log('   ❌ Error querying views:', error.message);
    }
    
    await connection.end();
    console.log('\n🎉 Debug completed!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    process.exit(1);
  }
}

debugSupervisorIssues();