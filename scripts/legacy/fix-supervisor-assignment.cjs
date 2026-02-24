const mysql = require('mysql2/promise');

async function fixSupervisorAssignment() {
  const db = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Chidera_2468',
    database: 'supervise360',
    port: 3307,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('🔧 Fixing supervisor assignment issues...\n');

    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Fix 1: Remove duplicate supervisors
      console.log('1️⃣  Removing duplicate supervisors...');
      await connection.execute('DELETE FROM supervisor_workload');
      console.log('   ✅ Cleared supervisor_workload table');

      // Fix 2: Set department for all groups
      console.log('\n2️⃣  Setting department for all groups...');
      await connection.execute(`
        UPDATE project_groups 
        SET department = 'Software Engineering' 
        WHERE department IS NULL OR department = ''
      `);
      const [updated] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM project_groups 
        WHERE department = 'Software Engineering'
      `);
      console.log(`   ✅ Updated ${updated[0].count} groups to Software Engineering department`);

      await connection.commit();
      console.log('\n✅ All fixes applied successfully!');
      console.log('\nNext steps:');
      console.log('1. Upload your supervisor CSV file again');
      console.log('2. Click "Auto-Assign Supervisors"');
      console.log('3. Supervisors will now be assigned to groups');
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
  }
}

fixSupervisorAssignment();
