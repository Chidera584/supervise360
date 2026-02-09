const mysql = require('mysql2/promise');

async function fixGpaThresholds() {
  let connection;
  
  try {
    // Create connection - using same config as check-and-setup-settings.cjs
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: 'Chidera_2468',
      database: 'supervise360',
      port: 3307
    });

    console.log('🔍 Checking GPA threshold settings in database...\n');

    // Check if settings exist
    const [existing] = await connection.execute(
      `SELECT setting_key, setting_value FROM system_settings 
       WHERE setting_key IN ('gpa_tier_high_min', 'gpa_tier_medium_min', 'gpa_tier_low_min')`
    );

    console.log(`📊 Found ${existing.length} threshold settings in database:`);
    existing.forEach(row => {
      console.log(`   ${row.setting_key} = ${row.setting_value}`);
    });

    // Check which ones are missing
    const keys = ['gpa_tier_high_min', 'gpa_tier_medium_min', 'gpa_tier_low_min'];
    const existingKeys = existing.map(r => r.setting_key);
    const missingKeys = keys.filter(k => !existingKeys.includes(k));

    if (missingKeys.length > 0) {
      console.log(`\n⚠️  Missing settings: ${missingKeys.join(', ')}`);
      console.log('   Inserting missing settings...\n');

      const defaults = {
        'gpa_tier_high_min': '3.80',
        'gpa_tier_medium_min': '3.30',
        'gpa_tier_low_min': '0.00'
      };

      for (const key of missingKeys) {
        const value = defaults[key];
        await connection.execute(
          `INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) 
           VALUES (?, ?, 'number', ?, true)`,
          [
            key,
            value,
            `Minimum GPA for ${key.replace('gpa_tier_', '').replace('_min', '').toUpperCase()} tier (Global Default)`
          ]
        );
        console.log(`   ✅ Inserted ${key} = ${value}`);
      }
    } else {
      console.log('\n✅ All threshold settings exist in database!');
    }

    // Verify final state
    console.log('\n🔍 Verifying final state...');
    const [final] = await connection.execute(
      `SELECT setting_key, setting_value FROM system_settings 
       WHERE setting_key IN ('gpa_tier_high_min', 'gpa_tier_medium_min', 'gpa_tier_low_min')
       ORDER BY setting_key`
    );

    console.log('\n📋 Current GPA Threshold Settings:');
    final.forEach(row => {
      console.log(`   ${row.setting_key}: ${row.setting_value}`);
    });

    // Check department_settings table
    console.log('\n🔍 Checking department_settings table...');
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'department_settings'"
    );

    if (tables.length === 0) {
      console.log('   ⚠️  department_settings table does not exist. Creating...');
      await connection.execute(`
        CREATE TABLE department_settings (
          id INT PRIMARY KEY AUTO_INCREMENT,
          department VARCHAR(100) NOT NULL UNIQUE,
          use_custom_thresholds BOOLEAN DEFAULT FALSE,
          gpa_tier_high_min DECIMAL(3, 2) DEFAULT NULL,
          gpa_tier_medium_min DECIMAL(3, 2) DEFAULT NULL,
          gpa_tier_low_min DECIMAL(3, 2) DEFAULT NULL,
          updated_by INT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_department (department),
          INDEX idx_custom_thresholds (use_custom_thresholds)
        ) ENGINE=InnoDB
      `);
      console.log('   ✅ Created department_settings table');
    } else {
      console.log('   ✅ department_settings table exists');
    }

    console.log('\n✅ Database is now properly configured!');
    console.log('\n💡 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Go to Settings page and update thresholds');
    console.log('   3. Check Groups page to see updated values');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixGpaThresholds();

