const mysql = require('mysql2/promise');

async function testThresholdApplication() {
  console.log('🧪 Testing GPA Threshold Application\n');
  
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'Chidera_2468',
    database: 'supervise360',
    port: 3307
  });

  try {
    // Step 1: Check current thresholds
    console.log('1️⃣ Current GPA Thresholds in Database:');
    const [thresholds] = await connection.execute(
      `SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'gpa_tier%'`
    );
    
    thresholds.forEach(t => {
      console.log(`   ${t.setting_key}: ${t.setting_value}`);
    });
    console.log('');

    // Step 2: Check students in database
    console.log('2️⃣ Students in Database:');
    const [students] = await connection.execute(
      `SELECT student_name, gpa, tier FROM students LIMIT 10`
    );
    
    if (students.length === 0) {
      console.log('   ⚠️  No students found in database');
    } else {
      students.forEach(s => {
        console.log(`   ${s.student_name}: GPA ${s.gpa} → Tier: ${s.tier}`);
      });
    }
    console.log('');

    // Step 3: Simulate classification with current thresholds
    console.log('3️⃣ Testing Classification Logic:');
    const thresholdMap = thresholds.reduce((acc, t) => {
      const key = t.setting_key.replace('gpa_tier_', '').replace('_min', '');
      acc[key] = parseFloat(t.setting_value);
      return acc;
    }, {});
    
    console.log(`   Thresholds: HIGH ≥ ${thresholdMap.high}, MEDIUM ≥ ${thresholdMap.medium}, LOW ≥ ${thresholdMap.low}`);
    
    const testGPAs = [4.5, 3.9, 3.8, 3.7, 3.5, 3.3, 3.0, 2.5, 2.0, 1.5];
    console.log('   Test GPAs:');
    testGPAs.forEach(gpa => {
      let tier = 'LOW';
      if (gpa >= thresholdMap.high) tier = 'HIGH';
      else if (gpa >= thresholdMap.medium) tier = 'MEDIUM';
      console.log(`     GPA ${gpa} → ${tier}`);
    });
    console.log('');

    // Step 4: Check groups
    console.log('4️⃣ Recent Groups:');
    const [groups] = await connection.execute(
      `SELECT g.id, g.name, g.avg_gpa, COUNT(gm.student_id) as member_count 
       FROM \`groups\` g 
       LEFT JOIN group_members gm ON g.id = gm.group_id 
       GROUP BY g.id 
       ORDER BY g.created_at DESC 
       LIMIT 5`
    );
    
    if (groups.length === 0) {
      console.log('   ⚠️  No groups found');
    } else {
      for (const group of groups) {
        console.log(`   ${group.name} (Avg GPA: ${group.avg_gpa}, Members: ${group.member_count})`);
        
        // Get members
        const [members] = await connection.execute(
          `SELECT s.student_name, s.gpa, s.tier 
           FROM group_members gm 
           JOIN students s ON gm.student_id = s.id 
           WHERE gm.group_id = ?`,
          [group.id]
        );
        
        members.forEach(m => {
          console.log(`     - ${m.student_name}: GPA ${m.gpa} (${m.tier})`);
        });
      }
    }
    console.log('');

    console.log('✅ Test Complete\n');
    console.log('📝 Summary:');
    console.log('   - Thresholds are stored in system_settings table');
    console.log('   - Backend should fetch these thresholds when processing students');
    console.log('   - Students should be classified based on current thresholds');
    console.log('   - If you see mismatched tiers, the backend may be using cached values');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

testThresholdApplication();
