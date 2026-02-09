const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAdminUser() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'supervise360',
    port: parseInt(process.env.DB_PORT || '3306'),
  };

  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Check admin user details
    const [users] = await connection.execute(
      'SELECT id, email, role, department FROM users WHERE email = ?',
      ['admin@supervise360.com']
    );
    
    console.log('Admin user details:', users[0]);
    
    // Check groups in database
    const [groups] = await connection.execute(`
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
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `);
    
    console.log('\nAll groups in database:');
    groups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.name} (${group.department}) - ${group.member_count} members`);
      console.log(`   Members: ${group.members || 'None'}`);
      console.log(`   Supervisor: ${group.supervisor_name || 'Not assigned'}`);
    });
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAdminUser();