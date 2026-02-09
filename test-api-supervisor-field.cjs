const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: 'Chidera_2468',
  database: 'supervise360',
  port: 3307
});

async function testAPIResponse() {
  console.log('🧪 Testing API Response Format\n');
  
  try {
    // Simulate what the API does
    const [groupRows] = await db.execute(`
      SELECT g.*, 
             COUNT(gm.id) as member_count
      FROM project_groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      GROUP BY g.id
      ORDER BY g.created_at DESC
      LIMIT 5
    `);
    
    console.log('📊 Sample Groups from Database:');
    console.log('='.repeat(70));
    
    for (const group of groupRows) {
      console.log(`\nGroup ID: ${group.id}`);
      console.log(`Name: ${group.name}`);
      console.log(`Department: ${group.department}`);
      console.log(`Supervisor Name: ${group.supervisor_name || 'NULL'}`);
      console.log(`Supervisor ID: ${group.supervisor_id || 'NULL'}`);
      console.log(`Member Count: ${group.member_count}`);
      
      // Get members
      const [members] = await db.execute(
        'SELECT * FROM group_members WHERE group_id = ? ORDER BY member_order ASC',
        [group.id]
      );
      
      console.log(`Members:`);
      members.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.student_name} (${m.gpa_tier}, GPA: ${m.student_gpa})`);
      });
    }
    
    // Check what the API would return
    console.log('\n\n📤 API Response Format:');
    console.log('='.repeat(70));
    
    const apiGroups = [];
    for (const group of groupRows) {
      const [memberRows] = await db.execute(
        'SELECT * FROM group_members WHERE group_id = ? ORDER BY member_order ASC',
        [group.id]
      );
      
      const members = memberRows.map(member => ({
        name: member.student_name,
        gpa: member.student_gpa,
        tier: member.gpa_tier
      }));
      
      apiGroups.push({
        id: group.id,
        name: group.name,
        members,
        avg_gpa: group.avg_gpa,
        status: group.status,
        supervisor_id: group.supervisor_id,
        supervisor: group.supervisor_name || null, // THIS IS THE KEY FIELD
        department: group.department
      });
    }
    
    console.log(JSON.stringify(apiGroups[0], null, 2));
    
    // Verify supervisor field
    console.log('\n\n✅ Verification:');
    console.log('='.repeat(70));
    
    const groupsWithSupervisors = apiGroups.filter(g => g.supervisor);
    const groupsWithoutSupervisors = apiGroups.filter(g => !g.supervisor);
    
    console.log(`Groups with supervisors: ${groupsWithSupervisors.length}`);
    console.log(`Groups without supervisors: ${groupsWithoutSupervisors.length}`);
    
    if (groupsWithSupervisors.length > 0) {
      console.log('\n✅ Sample group with supervisor:');
      console.log(`   ${groupsWithSupervisors[0].name} → ${groupsWithSupervisors[0].supervisor}`);
    }
    
    if (groupsWithoutSupervisors.length > 0) {
      console.log('\n❌ Sample group without supervisor:');
      console.log(`   ${groupsWithoutSupervisors[0].name} → ${groupsWithoutSupervisors[0].supervisor}`);
    }
    
    // Check total in database
    const [total] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN supervisor_name IS NOT NULL AND supervisor_name != '' THEN 1 ELSE 0 END) as with_supervisor
      FROM project_groups
    `);
    
    console.log('\n📊 Database Totals:');
    console.log(`   Total groups: ${total[0].total}`);
    console.log(`   With supervisors: ${total[0].with_supervisor}`);
    console.log(`   Without supervisors: ${total[0].total - total[0].with_supervisor}`);
    
    if (total[0].with_supervisor === total[0].total) {
      console.log('\n🎉 SUCCESS! All groups have supervisors assigned!');
      console.log('   The API should now return supervisor data correctly.');
    } else {
      console.log('\n⚠️  Some groups are missing supervisors.');
      console.log('   Run: node sync-supervisor-workload.cjs');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
  }
}

testAPIResponse();
