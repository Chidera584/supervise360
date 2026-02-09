const mysql = require('mysql2/promise');

async function checkSupervisorAssignment() {
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
    console.log('🔍 Checking supervisor assignment status...\n');

    // Check supervisors in supervisor_workload table
    const [supervisors] = await db.execute('SELECT * FROM supervisor_workload ORDER BY supervisor_name');
    console.log('📊 Supervisors in database:');
    console.log('============================');
    if (supervisors.length === 0) {
      console.log('❌ No supervisors found in supervisor_workload table');
    } else {
      supervisors.forEach(sup => {
        console.log(`\nName: ${sup.supervisor_name}`);
        console.log(`Department: ${sup.department}`);
        console.log(`Max Groups: ${sup.max_groups}`);
        console.log(`Current Groups: ${sup.current_groups}`);
        console.log(`Available: ${sup.is_available ? 'Yes' : 'No'}`);
      });
    }

    // Check groups
    console.log('\n\n📊 Groups in database:');
    console.log('======================');
    const [groups] = await db.execute(`
      SELECT id, name, department, supervisor_name, supervisor_id 
      FROM project_groups 
      ORDER BY id 
      LIMIT 10
    `);
    
    if (groups.length === 0) {
      console.log('❌ No groups found in project_groups table');
    } else {
      groups.forEach(group => {
        console.log(`\n${group.name}:`);
        console.log(`  Department: ${group.department || 'NULL'}`);
        console.log(`  Supervisor Name: ${group.supervisor_name || 'NULL'}`);
        console.log(`  Supervisor ID: ${group.supervisor_id || 'NULL'}`);
      });
    }

    // Check unassigned groups
    const [unassigned] = await db.execute(`
      SELECT COUNT(*) as count 
      FROM project_groups 
      WHERE supervisor_name IS NULL OR supervisor_name = ''
    `);
    
    console.log('\n\n📈 Summary:');
    console.log('===========');
    console.log(`Total Supervisors: ${supervisors.length}`);
    console.log(`Total Groups: ${groups.length}`);
    console.log(`Unassigned Groups: ${unassigned[0].count}`);
    console.log(`Assigned Groups: ${groups.length - unassigned[0].count}`);

    // Check for department mismatches
    console.log('\n\n🔍 Checking for potential issues:');
    console.log('==================================');
    
    // Check if groups have department set
    const [groupsWithoutDept] = await db.execute(`
      SELECT COUNT(*) as count 
      FROM project_groups 
      WHERE department IS NULL OR department = ''
    `);
    
    if (groupsWithoutDept[0].count > 0) {
      console.log(`⚠️  ${groupsWithoutDept[0].count} groups have no department set!`);
      
      const [exampleGroups] = await db.execute(`
        SELECT id, name, department 
        FROM project_groups 
        WHERE department IS NULL OR department = ''
        LIMIT 5
      `);
      
      console.log('   Example groups without department:');
      exampleGroups.forEach(g => {
        console.log(`   - ${g.name}: department = "${g.department}"`);
      });
    } else {
      console.log('✅ All groups have department set');
    }

    // Check if supervisors and groups have matching departments
    if (supervisors.length > 0 && groups.length > 0) {
      const supervisorDepts = [...new Set(supervisors.map(s => s.department))];
      const groupDepts = [...new Set(groups.map(g => g.department).filter(d => d))];
      
      console.log('\n📋 Departments:');
      console.log(`   Supervisor departments: ${supervisorDepts.join(', ')}`);
      console.log(`   Group departments: ${groupDepts.join(', ')}`);
      
      const commonDepts = supervisorDepts.filter(d => groupDepts.includes(d));
      if (commonDepts.length === 0) {
        console.log('❌ No matching departments between supervisors and groups!');
      } else {
        console.log(`✅ Matching departments: ${commonDepts.join(', ')}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
  }
}

checkSupervisorAssignment();
