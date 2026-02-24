const mysql = require('mysql2/promise');

async function clearAllGroups() {
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
    console.log('🗑️  Clearing all groups...\n');

    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get counts before deletion
      const [groupCount] = await connection.execute('SELECT COUNT(*) as count FROM project_groups');
      const [memberCount] = await connection.execute('SELECT COUNT(*) as count FROM group_members');
      
      console.log(`Found ${groupCount[0].count} groups with ${memberCount[0].count} members`);

      // Clear group members first (foreign key constraint)
      await connection.execute('DELETE FROM group_members');
      console.log('✅ Cleared group_members table');
      
      // Clear groups
      await connection.execute('DELETE FROM project_groups');
      console.log('✅ Cleared project_groups table');
      
      // Reset supervisor workload
      await connection.execute('UPDATE supervisor_workload SET current_groups = 0, updated_at = NOW()');
      console.log('✅ Reset supervisor workload');

      await connection.commit();
      console.log('\n✅ All groups cleared successfully!');
      console.log('You can now upload your CSV file again.');
      
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

clearAllGroups();
