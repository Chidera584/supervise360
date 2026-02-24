const mysql = require('mysql2/promise');

async function checkGroupsData() {
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
    console.log('🔍 Checking groups data in database...\n');

    // Check project_groups table
    const [groups] = await db.execute('SELECT * FROM project_groups ORDER BY created_at DESC LIMIT 5');
    console.log('📊 Project Groups:');
    console.log('==================');
    if (groups.length === 0) {
      console.log('❌ No groups found in database');
    } else {
      groups.forEach(group => {
        console.log(`\nGroup ID: ${group.id}`);
        console.log(`Name: ${group.name}`);
        console.log(`Avg GPA: ${group.avg_gpa}`);
        console.log(`Status: ${group.status}`);
        console.log(`Formation Method: ${group.formation_method}`);
        console.log(`Created: ${group.created_at}`);
      });
    }

    console.log('\n\n📊 Group Members:');
    console.log('==================');
    
    // Check group_members table
    const [members] = await db.execute(`
      SELECT gm.*, pg.name as group_name 
      FROM group_members gm
      JOIN project_groups pg ON gm.group_id = pg.id
      ORDER BY pg.id, gm.member_order
      LIMIT 20
    `);
    
    if (members.length === 0) {
      console.log('❌ No group members found in database');
    } else {
      let currentGroupId = null;
      members.forEach(member => {
        if (currentGroupId !== member.group_id) {
          console.log(`\n${member.group_name} (ID: ${member.group_id}):`);
          currentGroupId = member.group_id;
        }
        console.log(`  ${member.member_order}. ${member.student_name}`);
        console.log(`     GPA: ${member.student_gpa} | Tier: ${member.gpa_tier}`);
      });
    }

    console.log('\n\n📈 Summary:');
    console.log('==================');
    const [groupCount] = await db.execute('SELECT COUNT(*) as count FROM project_groups');
    const [memberCount] = await db.execute('SELECT COUNT(*) as count FROM group_members');
    console.log(`Total Groups: ${groupCount[0].count}`);
    console.log(`Total Members: ${memberCount[0].count}`);
    
    // Check for members without GPA or tier
    const [missingData] = await db.execute(`
      SELECT COUNT(*) as count 
      FROM group_members 
      WHERE student_gpa IS NULL OR gpa_tier IS NULL
    `);
    
    if (missingData[0].count > 0) {
      console.log(`\n⚠️  WARNING: ${missingData[0].count} members have missing GPA or tier data!`);
      
      const [problematicMembers] = await db.execute(`
        SELECT gm.*, pg.name as group_name
        FROM group_members gm
        JOIN project_groups pg ON gm.group_id = pg.id
        WHERE gm.student_gpa IS NULL OR gm.gpa_tier IS NULL
      `);
      
      console.log('\nProblematic members:');
      problematicMembers.forEach(member => {
        console.log(`  ${member.group_name}: ${member.student_name}`);
        console.log(`    GPA: ${member.student_gpa || 'NULL'} | Tier: ${member.gpa_tier || 'NULL'}`);
      });
    } else {
      console.log('✅ All members have GPA and tier data');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
  }
}

checkGroupsData();
