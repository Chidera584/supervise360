const mysql = require('mysql2/promise');
require('dotenv').config();

async function cleanDatabase() {
  console.log('🧹 Cleaning up test data from your database...\n');
  
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'supervise360',
    port: parseInt(process.env.DB_PORT || '3306'),
  };

  try {
    const connection = await mysql.createConnection(dbConfig);
    
    console.log('1. Checking current data...');
    
    // Check current groups
    const [currentGroups] = await connection.execute('SELECT COUNT(*) as count FROM project_groups');
    const [currentMembers] = await connection.execute('SELECT COUNT(*) as count FROM group_members');
    const [currentSupervisors] = await connection.execute('SELECT COUNT(*) as count FROM supervisor_workload');
    
    console.log(`   Current groups: ${currentGroups[0].count}`);
    console.log(`   Current group members: ${currentMembers[0].count}`);
    console.log(`   Current supervisors: ${currentSupervisors[0].count}`);
    
    console.log('\n2. Cleaning up test data...');
    
    await connection.beginTransaction();
    
    try {
      // Clear all group members first (foreign key constraint)
      await connection.execute('DELETE FROM group_members');
      console.log('   ✅ Cleared all group members');
      
      // Clear all groups
      await connection.execute('DELETE FROM project_groups');
      console.log('   ✅ Cleared all groups');
      
      // Clear supervisor workload (keep the table structure)
      await connection.execute('DELETE FROM supervisor_workload');
      console.log('   ✅ Cleared supervisor workload');
      
      // Reset auto-increment counters
      await connection.execute('ALTER TABLE project_groups AUTO_INCREMENT = 1');
      await connection.execute('ALTER TABLE group_members AUTO_INCREMENT = 1');
      await connection.execute('ALTER TABLE supervisor_workload AUTO_INCREMENT = 1');
      console.log('   ✅ Reset ID counters');
      
      await connection.commit();
      console.log('\n✅ Database cleaned successfully!');
      
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    
    console.log('\n3. Verifying cleanup...');
    
    const [finalGroups] = await connection.execute('SELECT COUNT(*) as count FROM project_groups');
    const [finalMembers] = await connection.execute('SELECT COUNT(*) as count FROM group_members');
    const [finalSupervisors] = await connection.execute('SELECT COUNT(*) as count FROM supervisor_workload');
    
    console.log(`   Groups remaining: ${finalGroups[0].count}`);
    console.log(`   Group members remaining: ${finalMembers[0].count}`);
    console.log(`   Supervisors remaining: ${finalSupervisors[0].count}`);
    
    await connection.end();
    
    console.log('\n🎉 Your database is now clean!');
    console.log('📝 Now you can:');
    console.log('   1. Upload your own student CSV files');
    console.log('   2. Auto-form groups from YOUR data');
    console.log('   3. Upload your own supervisors');
    console.log('   4. Auto-assign supervisors to groups');
    console.log('   5. Only YOUR data will be saved and persist');
    
  } catch (error) {
    console.error('❌ Error cleaning database:', error.message);
  }
}

cleanDatabase();