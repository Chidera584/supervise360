const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSEGroupsDetails() {
  console.log('🔍 Checking Software Engineering groups details...\n');
  
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'supervise360',
    port: parseInt(process.env.DB_PORT || '3306'),
  };

  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Get Software Engineering groups with their members (same query as backend)
    const [seGroups] = await connection.execute(`
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
      WHERE g.department = 'Software Engineering'
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `);
    
    console.log(`Found ${seGroups.length} Software Engineering groups:\n`);
    
    seGroups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.name} (ID: ${group.id})`);
      console.log(`   Department: ${group.department}`);
      console.log(`   Member Count: ${group.member_count}`);
      console.log(`   Members: ${group.members || 'No members'}`);
      console.log(`   Supervisor: ${group.supervisor_name || 'Not assigned'}`);
      console.log(`   Created: ${group.created_at}`);
      console.log(`   Formation Method: ${group.formation_method || 'N/A'}`);
      console.log('');
    });
    
    // This is exactly what the backend API returns
    console.log('📤 This is the exact data your backend API is returning to the frontend.');
    console.log('If the frontend shows "dummy data", the issue is in the frontend display logic.');
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSEGroupsDetails();