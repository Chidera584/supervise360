const mysql = require('mysql2/promise');

async function checkAllAssignments() {
  const db = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Chidera_2468',
    database: 'supervise360',
    port: 3307
  });

  try {
    console.log('🔍 Checking ALL group assignments...\n');

    // Get all groups with their supervisors
    const [groups] = await db.execute(`
      SELECT id, name, department, supervisor_name 
      FROM project_groups 
      ORDER BY id
    `);

    console.log(`📊 Total Groups: ${groups.length}\n`);

    // Count assigned vs unassigned
    const assigned = groups.filter(g => g.supervisor_name && g.supervisor_name !== '');
    const unassigned = groups.filter(g => !g.supervisor_name || g.supervisor_name === '');

    console.log(`✅ Assigned: ${assigned.length}`);
    console.log(`❌ Unassigned: ${unassigned.length}\n`);

    // Show all groups
    console.log('📋 All Groups:');
    console.log('==============');
    groups.forEach(group => {
      const status = group.supervisor_name ? '✅' : '❌';
      const supervisor = group.supervisor_name || 'NOT ASSIGNED';
      console.log(`${status} ${group.name}: ${supervisor}`);
    });

    // Show supervisor distribution
    if (assigned.length > 0) {
      console.log('\n📊 Supervisor Distribution:');
      console.log('===========================');
      const distribution = {};
      assigned.forEach(g => {
        distribution[g.supervisor_name] = (distribution[g.supervisor_name] || 0) + 1;
      });
      
      Object.entries(distribution).forEach(([name, count]) => {
        console.log(`${name}: ${count} groups`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
  }
}

checkAllAssignments();
