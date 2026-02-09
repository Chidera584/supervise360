const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkRealDatabase() {
  console.log('🔍 Checking your actual database connection and data...\n');
  
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'supervise360',
    port: parseInt(process.env.DB_PORT || '3306'),
  };

  console.log('Database Config:');
  console.log(`  Host: ${dbConfig.host}`);
  console.log(`  Port: ${dbConfig.port}`);
  console.log(`  Database: ${dbConfig.database}`);
  console.log(`  User: ${dbConfig.user}`);
  console.log('');

  try {
    console.log('1. Testing database connection...');
    const connection = await mysql.createConnection(dbConfig);
    console.log('   ✅ Database connection successful');
    
    // Check if tables exist
    console.log('\n2. Checking if required tables exist...');
    const [tables] = await connection.execute("SHOW TABLES");
    console.log('   Tables found:', tables.map(t => Object.values(t)[0]));
    
    const requiredTables = ['users', 'project_groups', 'group_members', 'supervisor_workload'];
    const existingTables = tables.map(t => Object.values(t)[0]);
    
    for (const table of requiredTables) {
      if (existingTables.includes(table)) {
        console.log(`   ✅ ${table} table exists`);
      } else {
        console.log(`   ❌ ${table} table missing`);
      }
    }
    
    // Check admin user
    console.log('\n3. Checking admin user...');
    try {
      const [users] = await connection.execute(
        'SELECT id, email, role, department FROM users WHERE email = ?',
        ['admin@supervise360.com']
      );
      
      if (users.length > 0) {
        console.log('   ✅ Admin user found:', users[0]);
      } else {
        console.log('   ❌ Admin user not found');
      }
    } catch (error) {
      console.log('   ❌ Error checking users table:', error.message);
    }
    
    // Check groups
    console.log('\n4. Checking groups in database...');
    try {
      const [allGroups] = await connection.execute('SELECT * FROM project_groups ORDER BY created_at DESC');
      console.log(`   Total groups in database: ${allGroups.length}`);
      
      if (allGroups.length > 0) {
        console.log('   Groups found:');
        allGroups.forEach((group, index) => {
          console.log(`   ${index + 1}. ID: ${group.id}, Name: ${group.name}, Department: ${group.department || 'NULL'}`);
        });
      } else {
        console.log('   ❌ No groups found in database');
      }
      
      // Check group members
      const [allMembers] = await connection.execute('SELECT * FROM group_members ORDER BY group_id, member_order');
      console.log(`   Total group members: ${allMembers.length}`);
      
      if (allMembers.length > 0) {
        console.log('   Sample members:');
        allMembers.slice(0, 5).forEach((member, index) => {
          console.log(`   ${index + 1}. Group ${member.group_id}: ${member.student_name} (GPA: ${member.student_gpa})`);
        });
      }
      
    } catch (error) {
      console.log('   ❌ Error checking groups:', error.message);
    }
    
    // Check supervisor workload
    console.log('\n5. Checking supervisor workload...');
    try {
      const [supervisors] = await connection.execute('SELECT * FROM supervisor_workload');
      console.log(`   Total supervisors: ${supervisors.length}`);
      
      if (supervisors.length > 0) {
        console.log('   Supervisors found:');
        supervisors.slice(0, 5).forEach((sup, index) => {
          console.log(`   ${index + 1}. ${sup.supervisor_name} (${sup.department}) - ${sup.current_groups}/${sup.max_groups} groups`);
        });
      }
    } catch (error) {
      console.log('   ❌ Error checking supervisors:', error.message);
    }
    
    await connection.end();
    console.log('\n✅ Database check completed');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\nPossible issues:');
    console.log('- MySQL server not running');
    console.log('- Wrong port (you\'re using 3307, not default 3306)');
    console.log('- Wrong credentials');
    console.log('- Database doesn\'t exist');
  }
}

checkRealDatabase();