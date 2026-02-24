const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: 'Chidera_2468',
  database: 'supervise360',
  port: 3307
});

async function clearSupervisorAssignments() {
  try {
    console.log('🗑️  Clearing supervisor assignments...\n');
    
    // Clear supervisor assignments
    await db.execute('UPDATE project_groups SET supervisor_name = NULL, supervisor_id = NULL');
    console.log('✅ Cleared all supervisor assignments from groups');
    
    // Reset supervisor workload
    await db.execute('UPDATE supervisor_workload SET current_groups = 0');
    console.log('✅ Reset supervisor workload counters');
    
    // Verify
    const [groups] = await db.execute('SELECT id, name, supervisor_name FROM project_groups LIMIT 10');
    console.log('\n📊 Sample groups (should all be NULL):');
    groups.forEach(g => {
      console.log(`  ${g.name}: ${g.supervisor_name || 'NULL'}`);
    });
    
    const [total] = await db.execute('SELECT COUNT(*) as count FROM project_groups WHERE supervisor_name IS NULL');
    console.log(`\n✅ ${total[0].count} groups ready for assignment`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
  }
}

clearSupervisorAssignments();
