const mysql = require('mysql2/promise');

async function checkThresholds() {
  console.log('🔍 Checking Current GPA Thresholds in Database\n');
  
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'Chidera_2468',
    database: 'supervise360',
    port: 3307
  });

  try {
    // Check system_settings table
    console.log('📊 System Settings (Global Thresholds):');
    console.log('='.repeat(50));
    
    const [settings] = await connection.execute(
      `SELECT setting_key, setting_value 
       FROM system_settings 
       WHERE setting_key LIKE 'gpa_tier%'
       ORDER BY setting_key`
    );
    
    if (settings.length === 0) {
      console.log('❌ No GPA threshold settings found in system_settings!');
    } else {
      settings.forEach(row => {
        console.log(`   ${row.setting_key}: ${row.setting_value}`);
      });
    }
    
    // Check department_settings table
    console.log('\n📊 Department Settings:');
    console.log('='.repeat(50));
    
    const [deptSettings] = await connection.execute(
      `SELECT department, use_custom_thresholds, 
              gpa_tier_high_min, gpa_tier_medium_min, gpa_tier_low_min
       FROM department_settings`
    );
    
    if (deptSettings.length === 0) {
      console.log('   No department-specific settings found');
    } else {
      deptSettings.forEach(row => {
        console.log(`\n   Department: ${row.department}`);
        console.log(`   Custom Thresholds: ${row.use_custom_thresholds ? 'YES' : 'NO'}`);
        if (row.use_custom_thresholds) {
          console.log(`   HIGH: ${row.gpa_tier_high_min}`);
          console.log(`   MEDIUM: ${row.gpa_tier_medium_min}`);
          console.log(`   LOW: ${row.gpa_tier_low_min}`);
        }
      });
    }
    
    // Show what the API returns
    console.log('\n📡 Testing API Response:');
    console.log('='.repeat(50));
    
    const apiRes = await fetch('http://localhost:5000/api/settings/gpa-thresholds/global');
    if (apiRes.ok) {
      const data = await apiRes.json();
      console.log('   API returns:', JSON.stringify(data.data, null, 2));
    } else {
      console.log('   ❌ API request failed:', apiRes.status);
    }
    
  } finally {
    await connection.end();
  }
}

checkThresholds().catch(console.error);
