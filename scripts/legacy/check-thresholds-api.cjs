const mysql = require('mysql2/promise');

async function checkThresholds() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: 'Chidera_2468',
      database: 'supervise360',
      port: 3307
    });

    console.log('🔍 Checking all GPA threshold settings...\n');

    // Check global settings
    console.log('1️⃣ Global Settings (system_settings):');
    const [global] = await connection.execute(
      `SELECT setting_key, setting_value FROM system_settings 
       WHERE setting_key IN ('gpa_tier_high_min', 'gpa_tier_medium_min', 'gpa_tier_low_min')
       ORDER BY setting_key`
    );
    global.forEach(row => {
      console.log(`   ${row.setting_key}: ${row.setting_value}`);
    });

    // Check department settings
    console.log('\n2️⃣ Department-Specific Settings:');
    const [dept] = await connection.execute(
      `SELECT department, use_custom_thresholds, gpa_tier_high_min, gpa_tier_medium_min, gpa_tier_low_min 
       FROM department_settings`
    );
    
    if (dept.length === 0) {
      console.log('   No department-specific settings found');
    } else {
      dept.forEach(row => {
        console.log(`\n   Department: ${row.department}`);
        console.log(`   Uses Custom: ${row.use_custom_thresholds ? 'YES' : 'NO'}`);
        if (row.use_custom_thresholds) {
          console.log(`   HIGH: ${row.gpa_tier_high_min}`);
          console.log(`   MEDIUM: ${row.gpa_tier_medium_min}`);
          console.log(`   LOW: ${row.gpa_tier_low_min}`);
        }
      });
    }

    // Test what the API would return for "Software Engineering"
    console.log('\n3️⃣ What API would return for "Software Engineering":');
    const deptName = 'Software Engineering';
    const [deptRows] = await connection.execute(
      `SELECT use_custom_thresholds, gpa_tier_high_min, gpa_tier_medium_min, gpa_tier_low_min 
       FROM department_settings 
       WHERE department = ?`,
      [deptName]
    );

    if (deptRows.length > 0 && deptRows[0].use_custom_thresholds) {
      console.log('   Using department-specific thresholds:');
      console.log(`   HIGH: ${deptRows[0].gpa_tier_high_min}`);
      console.log(`   MEDIUM: ${deptRows[0].gpa_tier_medium_min}`);
      console.log(`   LOW: ${deptRows[0].gpa_tier_low_min}`);
    } else {
      console.log('   Using global thresholds:');
      global.forEach(row => {
        const key = row.setting_key.replace('gpa_tier_', '').replace('_min', '');
        console.log(`   ${key.toUpperCase()}: ${row.setting_value}`);
      });
    }

    console.log('\n✅ Check complete!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkThresholds();

