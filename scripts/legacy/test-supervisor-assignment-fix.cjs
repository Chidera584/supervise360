const mysql = require('mysql2/promise');

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

async function testSupervisorAssignment() {
  console.log('🧪 Testing Supervisor Assignment Fix\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Check current state
    console.log('\n📊 TEST 1: Current State');
    console.log('-'.repeat(60));
    
    const [groups] = await db.execute(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN supervisor_name IS NOT NULL AND supervisor_name != '' THEN 1 ELSE 0 END) as assigned,
             SUM(CASE WHEN supervisor_name IS NULL OR supervisor_name = '' THEN 1 ELSE 0 END) as unassigned
      FROM project_groups
    `);
    
    const groupStats = groups[0];
    console.log(`Total Groups: ${groupStats.total}`);
    console.log(`Assigned: ${groupStats.assigned}`);
    console.log(`Unassigned: ${groupStats.unassigned}`);

    const [supervisors] = await db.execute(`
      SELECT supervisor_name, department, current_groups, max_groups
      FROM supervisor_workload
      ORDER BY supervisor_name
    `);
    
    console.log(`\nSupervisors: ${supervisors.length}`);
    supervisors.forEach(sup => {
      console.log(`  ${sup.supervisor_name}: ${sup.current_groups}/${sup.max_groups} groups (${sup.department})`);
    });

    // Test 2: Check for workload sync issues
    console.log('\n📊 TEST 2: Workload Sync Check');
    console.log('-'.repeat(60));
    
    const [syncCheck] = await db.execute(`
      SELECT 
        s.supervisor_name,
        s.current_groups as recorded_count,
        COUNT(g.id) as actual_count,
        (COUNT(g.id) - s.current_groups) as difference
      FROM supervisor_workload s
      LEFT JOIN project_groups g ON s.supervisor_name = g.supervisor_name
      GROUP BY s.supervisor_name, s.current_groups
      ORDER BY difference DESC
    `);
    
    let syncIssues = 0;
    syncCheck.forEach(row => {
      if (row.difference !== 0) {
        console.log(`❌ ${row.supervisor_name}: Recorded=${row.recorded_count}, Actual=${row.actual_count}, Diff=${row.difference}`);
        syncIssues++;
      } else {
        console.log(`✅ ${row.supervisor_name}: Synced (${row.actual_count} groups)`);
      }
    });
    
    if (syncIssues > 0) {
      console.log(`\n⚠️  Found ${syncIssues} supervisors with sync issues!`);
    } else {
      console.log('\n✅ All supervisors are in sync!');
    }

    // Test 3: Check department matching
    console.log('\n📊 TEST 3: Department Matching');
    console.log('-'.repeat(60));
    
    const [deptCheck] = await db.execute(`
      SELECT 
        g.id,
        g.name as group_name,
        g.department as group_dept,
        s.department as supervisor_dept,
        g.supervisor_name
      FROM project_groups g
      LEFT JOIN supervisor_workload s ON g.supervisor_name = s.supervisor_name
      WHERE g.supervisor_name IS NOT NULL 
        AND g.supervisor_name != ''
        AND g.department != s.department
    `);
    
    if (deptCheck.length > 0) {
      console.log(`❌ Found ${deptCheck.length} department mismatches:`);
      deptCheck.forEach(row => {
        console.log(`  ${row.group_name}: Group(${row.group_dept}) vs Supervisor(${row.supervisor_dept})`);
      });
    } else {
      console.log('✅ All groups match supervisor departments!');
    }

    // Test 4: Check capacity violations
    console.log('\n📊 TEST 4: Capacity Violations');
    console.log('-'.repeat(60));
    
    const [capacityCheck] = await db.execute(`
      SELECT supervisor_name, current_groups, max_groups
      FROM supervisor_workload
      WHERE current_groups > max_groups
    `);
    
    if (capacityCheck.length > 0) {
      console.log(`❌ Found ${capacityCheck.length} capacity violations:`);
      capacityCheck.forEach(row => {
        console.log(`  ${row.supervisor_name}: ${row.current_groups}/${row.max_groups} (overloaded by ${row.current_groups - row.max_groups})`);
      });
    } else {
      console.log('✅ No capacity violations!');
    }

    // Test 5: Distribution analysis
    console.log('\n📊 TEST 5: Workload Distribution');
    console.log('-'.repeat(60));
    
    const [distribution] = await db.execute(`
      SELECT 
        supervisor_name,
        current_groups,
        max_groups,
        ROUND((current_groups / max_groups) * 100, 2) as utilization_pct
      FROM supervisor_workload
      ORDER BY utilization_pct DESC
    `);
    
    const utilizationRates = distribution.map(d => d.utilization_pct);
    const avgUtilization = utilizationRates.reduce((a, b) => a + b, 0) / utilizationRates.length;
    const maxUtilization = Math.max(...utilizationRates);
    const minUtilization = Math.min(...utilizationRates);
    const variance = utilizationRates.reduce((sum, rate) => sum + Math.pow(rate - avgUtilization, 2), 0) / utilizationRates.length;
    
    console.log('Utilization by Supervisor:');
    distribution.forEach(row => {
      const bar = '█'.repeat(Math.floor(row.utilization_pct / 5));
      console.log(`  ${row.supervisor_name.padEnd(25)} ${row.current_groups}/${row.max_groups} [${bar}] ${row.utilization_pct}%`);
    });
    
    console.log(`\nDistribution Statistics:`);
    console.log(`  Average Utilization: ${avgUtilization.toFixed(2)}%`);
    console.log(`  Max Utilization: ${maxUtilization.toFixed(2)}%`);
    console.log(`  Min Utilization: ${minUtilization.toFixed(2)}%`);
    console.log(`  Variance: ${variance.toFixed(2)}`);
    console.log(`  Standard Deviation: ${Math.sqrt(variance).toFixed(2)}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));
    
    const allTestsPassed = syncIssues === 0 && 
                          deptCheck.length === 0 && 
                          capacityCheck.length === 0;
    
    if (allTestsPassed) {
      console.log('✅ ALL TESTS PASSED!');
      console.log('   - Workload is synced');
      console.log('   - Departments match');
      console.log('   - No capacity violations');
      console.log('   - Distribution is balanced');
    } else {
      console.log('❌ ISSUES FOUND:');
      if (syncIssues > 0) console.log(`   - ${syncIssues} workload sync issues`);
      if (deptCheck.length > 0) console.log(`   - ${deptCheck.length} department mismatches`);
      if (capacityCheck.length > 0) console.log(`   - ${capacityCheck.length} capacity violations`);
      console.log('\n💡 Run: node sync-supervisor-workload.cjs to fix sync issues');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
  }
}

testSupervisorAssignment();
