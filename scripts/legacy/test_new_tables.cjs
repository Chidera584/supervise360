const mysql = require('mysql2/promise');
require('dotenv').config();

async function testNewTables() {
  console.log('🧪 Testing new tables...\n');
  
  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Chidera_2468',
    database: process.env.DB_NAME || 'supervise360',
    port: parseInt(process.env.DB_PORT || '3307')
  };
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Test project_groups table
    console.log('\n📋 Project Groups:');
    const [groups] = await connection.execute('SELECT * FROM project_groups');
    console.log(`Found ${groups.length} groups`);
    
    // Test group_members table
    console.log('\n👥 Group Members:');
    const [members] = await connection.execute('SELECT * FROM group_members');
    console.log(`Found ${members.length} group members`);
    
    // Test supervisor_workload table
    console.log('\n🎓 Supervisor Workload:');
    const [supervisors] = await connection.execute('SELECT * FROM supervisor_workload');
    console.log(`Found ${supervisors.length} supervisors in workload table`);
    supervisors.forEach(sup => {
      console.log(`   ${sup.supervisor_name} - Dept: ${sup.department} - Max: ${sup.max_groups} - Current: ${sup.current_groups}`);
    });
    
    // Test unified groups view
    console.log('\n📊 Unified Groups View:');
    const [unifiedGroups] = await connection.execute('SELECT * FROM v_unified_groups');
    console.log(`Found ${unifiedGroups.length} groups in unified view`);
    
    // Test supervisor workload view
    console.log('\n📊 Supervisor Workload View:');
    const [workloadView] = await connection.execute('SELECT * FROM v_supervisor_workload_complete');
    console.log(`Found ${workloadView.length} supervisors in workload view`);
    workloadView.forEach(sup => {
      console.log(`   ${sup.name} - Dept: ${sup.department} - Available: ${sup.available_slots}/${sup.max_groups}`);
    });
    
    await connection.end();
    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testNewTables();