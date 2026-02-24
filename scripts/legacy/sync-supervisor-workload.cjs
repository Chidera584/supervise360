const mysql = require('mysql2/promise');

async function syncSupervisorWorkload() {
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
    console.log('🔄 Syncing supervisor workload with actual assignments...\n');

    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get actual group counts per supervisor
      const [actualCounts] = await connection.execute(`
        SELECT 
          supervisor_name,
          COUNT(*) as actual_count
        FROM project_groups
        WHERE supervisor_name IS NOT NULL AND supervisor_name != ''
        GROUP BY supervisor_name
      `);

      console.log('📊 Actual assignments:');
      actualCounts.forEach(row => {
        console.log(`   ${row.supervisor_name}: ${row.actual_count} groups`);
      });

      // Reset all supervisor workloads to 0
      await connection.execute('UPDATE supervisor_workload SET current_groups = 0');
      console.log('\n🔄 Reset all supervisor workloads to 0');

      // Update each supervisor's workload based on actual assignments
      for (const row of actualCounts) {
        await connection.execute(
          'UPDATE supervisor_workload SET current_groups = ? WHERE supervisor_name = ?',
          [row.actual_count, row.supervisor_name]
        );
        console.log(`✅ Updated ${row.supervisor_name}: ${row.actual_count} groups`);
      }

      await connection.commit();
      console.log('\n✅ Supervisor workload synced successfully!');

      // Show final status
      const [supervisors] = await connection.execute(`
        SELECT supervisor_name, max_groups, current_groups, 
               (max_groups - current_groups) as available_slots
        FROM supervisor_workload
        ORDER BY supervisor_name
      `);

      console.log('\n📊 Final Supervisor Status:');
      console.log('============================');
      supervisors.forEach(sup => {
        console.log(`${sup.supervisor_name}:`);
        console.log(`  Current: ${sup.current_groups}/${sup.max_groups} groups`);
        console.log(`  Available: ${sup.available_slots} slots`);
      });
      
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

syncSupervisorWorkload();
