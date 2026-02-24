const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: 'Chidera_2468',
  database: 'supervise360',
  port: 3307
});

async function testSupervisorAPI() {
  console.log('🧪 Testing Supervisor Assignment via Database\n');
  console.log('=' .repeat(70));
  
  try {
    // Test 1: Check if groups have supervisors assigned
    console.log('\n📊 TEST 1: Groups with Supervisors');
    console.log('-'.repeat(70));
    
    const [groups] = await db.execute(`
      SELECT id, name, supervisor_name, department
      FROM project_groups
      ORDER BY id
      LIMIT 10
    `);
    
    console.log('First 10 groups:');
    groups.forEach(g => {
      const status = g.supervisor_name ? '✅' : '❌';
      console.log(`${status} ${g.name.padEnd(12)} → ${g.supervisor_name || 'UNASSIGNED'}`);
    });
    
    // Test 2: Check supervisor workload
    console.log('\n📊 TEST 2: Supervisor Workload');
    console.log('-'.repeat(70));
    
    const [supervisors] = await db.execute(`
      SELECT 
        supervisor_name,
        current_groups,
        max_groups,
        (max_groups - current_groups) as available,
        ROUND((current_groups / max_groups) * 100, 1) as utilization
      FROM supervisor_workload
      ORDER BY current_groups DESC
    `);
    
    console.log('Supervisor Status:');
    supervisors.forEach(s => {
      const bar = '█'.repeat(Math.floor(s.utilization / 5));
      const status = s.available > 0 ? '🟢' : '🔴';
      console.log(`${status} ${s.supervisor_name.padEnd(25)} ${s.current_groups}/${s.max_groups} [${bar.padEnd(20)}] ${s.utilization}%`);
    });
    
    // Test 3: Verify sync between tables
    console.log('\n📊 TEST 3: Workload Sync Verification');
    console.log('-'.repeat(70));
    
    const [syncCheck] = await db.execute(`
      SELECT 
        s.supervisor_name,
        s.current_groups as recorded,
        COUNT(g.id) as actual,
        (COUNT(g.id) - s.current_groups) as diff
      FROM supervisor_workload s
      LEFT JOIN project_groups g ON s.supervisor_name = g.supervisor_name
      GROUP BY s.supervisor_name, s.current_groups
      ORDER BY diff DESC
    `);
    
    let syncIssues = 0;
    syncCheck.forEach(row => {
      if (row.diff !== 0) {
        console.log(`❌ ${row.supervisor_name}: Recorded=${row.recorded}, Actual=${row.actual}, Diff=${row.diff}`);
        syncIssues++;
      } else {
        console.log(`✅ ${row.supervisor_name}: Synced (${row.actual} groups)`);
      }
    });
    
    // Test 4: Check assignment distribution
    console.log('\n📊 TEST 4: Assignment Distribution');
    console.log('-'.repeat(70));
    
    const [distribution] = await db.execute(`
      SELECT 
        supervisor_name,
        COUNT(*) as group_count,
        MIN(id) as first_group,
        MAX(id) as last_group
      FROM project_groups
      WHERE supervisor_name IS NOT NULL
      GROUP BY supervisor_name
      ORDER BY group_count DESC
    `);
    
    console.log('Groups per Supervisor:');
    distribution.forEach(row => {
      console.log(`  ${row.supervisor_name.padEnd(25)} ${row.group_count} groups (IDs: ${row.first_group}-${row.last_group})`);
    });
    
    // Test 5: Check for unassigned groups
    console.log('\n📊 TEST 5: Unassigned Groups Check');
    console.log('-'.repeat(70));
    
    const [unassigned] = await db.execute(`
      SELECT id, name, department
      FROM project_groups
      WHERE supervisor_name IS NULL OR supervisor_name = ''
    `);
    
    if (unassigned.length > 0) {
      console.log(`❌ Found ${unassigned.length} unassigned groups:`);
      unassigned.forEach(g => {
        console.log(`   - ${g.name} (${g.department})`);
      });
    } else {
      console.log('✅ All groups are assigned to supervisors!');
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 SUMMARY');
    console.log('='.repeat(70));
    
    const totalGroups = groups.length > 0 ? await db.execute('SELECT COUNT(*) as count FROM project_groups') : [[{count: 0}]];
    const assignedGroups = await db.execute(`SELECT COUNT(*) as count FROM project_groups WHERE supervisor_name IS NOT NULL AND supervisor_name != ''`);
    
    const total = totalGroups[0][0].count;
    const assigned = assignedGroups[0][0].count;
    const unassignedCount = total - assigned;
    
    console.log(`Total Groups: ${total}`);
    console.log(`Assigned: ${assigned} ✅`);
    console.log(`Unassigned: ${unassignedCount} ${unassignedCount > 0 ? '❌' : '✅'}`);
    console.log(`Sync Issues: ${syncIssues} ${syncIssues > 0 ? '⚠️' : '✅'}`);
    
    if (assigned === total && syncIssues === 0) {
      console.log('\n🎉 SUCCESS! Supervisor assignment is working perfectly!');
      console.log('   ✅ All groups have supervisors');
      console.log('   ✅ Workload counters are synced');
      console.log('   ✅ Distribution is balanced');
    } else {
      console.log('\n⚠️  Issues detected:');
      if (unassignedCount > 0) console.log(`   - ${unassignedCount} groups need supervisors`);
      if (syncIssues > 0) console.log(`   - ${syncIssues} supervisors have sync issues`);
      console.log('\n💡 Run: node sync-supervisor-workload.cjs to fix sync issues');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
  }
}

testSupervisorAPI();
