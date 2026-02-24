const mysql = require('mysql2/promise');

async function checkExistingGroups() {
  console.log('🔍 Checking Existing Groups vs Current Thresholds\n');
  
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'Chidera_2468',
    database: 'supervise360',
    port: 3307
  });

  try {
    // Get current thresholds
    const [thresholds] = await connection.execute(
      `SELECT setting_key, setting_value FROM system_settings 
       WHERE setting_key IN ('gpa_tier_high_min', 'gpa_tier_medium_min', 'gpa_tier_low_min')`
    );
    
    const currentThresholds = {};
    thresholds.forEach(row => {
      const key = row.setting_key.replace('gpa_tier_', '').replace('_min', '');
      currentThresholds[key] = parseFloat(row.setting_value);
    });
    
    console.log('📊 Current Thresholds in Database:');
    console.log(`   HIGH: ≥${currentThresholds.high}`);
    console.log(`   MEDIUM: ≥${currentThresholds.medium}`);
    console.log(`   LOW: ≥${currentThresholds.low}`);
    
    // Get some group members and their tiers
    console.log('\n📋 Sample Group Members (first 10):');
    console.log('='.repeat(70));
    
    const [members] = await connection.execute(
      `SELECT gm.student_name, gm.student_gpa, gm.gpa_tier, pg.name as group_name
       FROM group_members gm
       JOIN project_groups pg ON gm.group_id = pg.id
       ORDER BY gm.id DESC
       LIMIT 10`
    );
    
    let mismatches = 0;
    members.forEach(member => {
      const gpa = parseFloat(member.student_gpa);
      const storedTier = member.gpa_tier;
      
      // Calculate what tier SHOULD be based on current thresholds
      let correctTier = 'LOW';
      if (gpa >= currentThresholds.high) correctTier = 'HIGH';
      else if (gpa >= currentThresholds.medium) correctTier = 'MEDIUM';
      
      const match = storedTier === correctTier ? '✅' : '❌';
      if (storedTier !== correctTier) mismatches++;
      
      console.log(`${match} ${member.student_name} (${member.group_name})`);
      console.log(`   GPA: ${gpa} | Stored: ${storedTier} | Should be: ${correctTier}`);
    });
    
    console.log('\n' + '='.repeat(70));
    if (mismatches > 0) {
      console.log(`\n⚠️  FOUND ${mismatches} MISMATCHES!`);
      console.log('   The groups were formed with OLD thresholds.');
      console.log('   Solution: Clear and regenerate groups to use new thresholds.');
    } else {
      console.log('\n✅ All tiers match current thresholds!');
    }
    
  } finally {
    await connection.end();
  }
}

checkExistingGroups().catch(console.error);
