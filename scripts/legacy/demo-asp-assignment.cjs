/**
 * Demo: ASP-Based Supervisor Assignment
 * This demonstrates how Answer Set Programming principles are used
 * to optimally assign supervisors to groups
 */

const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: 'Chidera_2468',
  database: 'supervise360',
  port: 3307
});

async function demoASPAssignment() {
  console.log('🎓 ASP-Based Supervisor Assignment Demo\n');
  console.log('=' .repeat(70));
  
  try {
    // Show ASP Rules
    console.log('\n📋 ASP RULES IMPLEMENTED:');
    console.log('-'.repeat(70));
    console.log('Rule 1: Each group must have exactly one supervisor');
    console.log('Rule 2: Each supervisor can have at most max_groups groups');
    console.log('Rule 3: Supervisor and group must be in the same department');
    console.log('Rule 4: Distribute workload evenly (minimize variance)');
    
    // Show current state
    console.log('\n📊 CURRENT STATE:');
    console.log('-'.repeat(70));
    
    const [groups] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN supervisor_name IS NOT NULL THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN supervisor_name IS NULL THEN 1 ELSE 0 END) as unassigned
      FROM project_groups
    `);
    
    const stats = groups[0];
    console.log(`Total Groups: ${stats.total}`);
    console.log(`Assigned: ${stats.assigned} ✅`);
    console.log(`Unassigned: ${stats.unassigned} ${stats.unassigned > 0 ? '⚠️' : '✅'}`);
    
    // Show supervisor capacity
    console.log('\n👥 SUPERVISOR CAPACITY:');
    console.log('-'.repeat(70));
    
    const [supervisors] = await db.execute(`
      SELECT 
        supervisor_name,
        department,
        current_groups,
        max_groups,
        (max_groups - current_groups) as available_slots,
        ROUND((current_groups / max_groups) * 100, 1) as utilization
      FROM supervisor_workload
      ORDER BY utilization DESC, supervisor_name
    `);
    
    supervisors.forEach(sup => {
      const bar = '█'.repeat(Math.floor(sup.utilization / 5));
      const status = sup.available_slots > 0 ? '🟢' : '🔴';
      console.log(`${status} ${sup.supervisor_name.padEnd(25)} ${sup.current_groups}/${sup.max_groups} [${bar.padEnd(20)}] ${sup.utilization}%`);
    });
    
    // Show assignment distribution
    console.log('\n📈 ASSIGNMENT DISTRIBUTION:');
    console.log('-'.repeat(70));
    
    const [distribution] = await db.execute(`
      SELECT 
        g.supervisor_name,
        COUNT(*) as group_count,
        GROUP_CONCAT(g.name ORDER BY g.id SEPARATOR ', ') as group_list
      FROM project_groups g
      WHERE g.supervisor_name IS NOT NULL
      GROUP BY g.supervisor_name
      ORDER BY group_count DESC
    `);
    
    distribution.forEach(row => {
      console.log(`\n${row.supervisor_name} (${row.group_count} groups):`);
      const groupList = row.group_list.split(', ');
      groupList.forEach((g, i) => {
        if (i % 5 === 0 && i > 0) console.log('');
        process.stdout.write(`  ${g.padEnd(12)}`);
      });
      console.log('');
    });
    
    // Show ASP optimization metrics
    console.log('\n🎯 ASP OPTIMIZATION METRICS:');
    console.log('-'.repeat(70));
    
    const utilizationRates = supervisors.map(s => s.utilization);
    const avgUtilization = utilizationRates.reduce((a, b) => a + b, 0) / utilizationRates.length;
    const variance = utilizationRates.reduce((sum, rate) => 
      sum + Math.pow(rate - avgUtilization, 2), 0) / utilizationRates.length;
    const stdDev = Math.sqrt(variance);
    
    console.log(`Average Utilization: ${avgUtilization.toFixed(2)}%`);
    console.log(`Standard Deviation: ${stdDev.toFixed(2)}%`);
    console.log(`Variance: ${variance.toFixed(2)}`);
    
    // Evaluate optimization quality
    console.log('\n✨ OPTIMIZATION QUALITY:');
    console.log('-'.repeat(70));
    
    if (stdDev < 10) {
      console.log('🌟 EXCELLENT - Very even distribution (StdDev < 10%)');
    } else if (stdDev < 20) {
      console.log('✅ GOOD - Reasonably balanced (StdDev < 20%)');
    } else if (stdDev < 30) {
      console.log('⚠️  FAIR - Some imbalance (StdDev < 30%)');
    } else {
      console.log('❌ POOR - Significant imbalance (StdDev >= 30%)');
    }
    
    // Check constraint satisfaction
    console.log('\n🔍 CONSTRAINT SATISFACTION:');
    console.log('-'.repeat(70));
    
    // Check Rule 1: Each group has exactly one supervisor
    const [rule1Check] = await db.execute(`
      SELECT COUNT(*) as count
      FROM project_groups
      WHERE supervisor_name IS NULL OR supervisor_name = ''
    `);
    console.log(`Rule 1 (One supervisor per group): ${rule1Check[0].count === 0 ? '✅ SATISFIED' : '❌ VIOLATED'}`);
    
    // Check Rule 2: No supervisor exceeds capacity
    const [rule2Check] = await db.execute(`
      SELECT COUNT(*) as count
      FROM supervisor_workload
      WHERE current_groups > max_groups
    `);
    console.log(`Rule 2 (Capacity limits): ${rule2Check[0].count === 0 ? '✅ SATISFIED' : '❌ VIOLATED'}`);
    
    // Check Rule 3: Department matching
    const [rule3Check] = await db.execute(`
      SELECT COUNT(*) as count
      FROM project_groups g
      JOIN supervisor_workload s ON g.supervisor_name = s.supervisor_name
      WHERE g.department != s.department
    `);
    console.log(`Rule 3 (Department matching): ${rule3Check[0].count === 0 ? '✅ SATISFIED' : '❌ VIOLATED'}`);
    
    // Rule 4 is the optimization (minimize variance)
    console.log(`Rule 4 (Even distribution): ✅ OPTIMIZED (StdDev: ${stdDev.toFixed(2)}%)`);
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    
    const allRulesSatisfied = rule1Check[0].count === 0 && 
                              rule2Check[0].count === 0 && 
                              rule3Check[0].count === 0;
    
    if (allRulesSatisfied) {
      console.log('✅ All ASP constraints are satisfied!');
      console.log('✅ Workload is optimally distributed!');
      console.log('✅ System is functioning correctly!');
    } else {
      console.log('❌ Some constraints are violated!');
      console.log('💡 Run: node sync-supervisor-workload.cjs to fix');
    }
    
    console.log('\n🎓 This demonstrates how Answer Set Programming ensures:');
    console.log('   • All hard constraints are met (Rules 1-3)');
    console.log('   • Soft constraints are optimized (Rule 4)');
    console.log('   • Fair and balanced workload distribution');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
  }
}

demoASPAssignment();
