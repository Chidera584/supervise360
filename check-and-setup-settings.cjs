const mysql = require('mysql2/promise');

async function setupSettings() {
  console.log('🔧 Setting up GPA Threshold Settings...\n');
  
  // Try to connect using common configurations
  let connection;
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: 'Chidera_2468',
      database: 'supervise360',
      port: 3307
    });
  } catch (err) {
    console.log('❌ Cannot connect to MySQL');
    console.log('   Make sure XAMPP MySQL is running');
    console.log('   Error:', err.message);
    return;
  }

  try {
    // Check and create system_settings table
    console.log('1️⃣ Checking system_settings table...');
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'system_settings'"
    );
    
    if (tables.length === 0) {
      console.log('   Creating system_settings table...');
      await connection.execute(`
        CREATE TABLE system_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          setting_key VARCHAR(100) UNIQUE NOT NULL,
          setting_value TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Created system_settings table');
    } else {
      console.log('   ✅ system_settings table exists');
    }
    
    // Check and insert GPA threshold settings
    console.log('\n2️⃣ Checking GPA threshold settings...');
    const [settings] = await connection.execute(
      `SELECT * FROM system_settings WHERE setting_key LIKE 'gpa_tier%'`
    );
    
    if (settings.length === 0) {
      console.log('   Inserting default GPA thresholds...');
      await connection.execute(`
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES
        ('gpa_tier_high_min', '3.5', 'Minimum GPA for HIGH tier'),
        ('gpa_tier_medium_min', '2.5', 'Minimum GPA for MEDIUM tier'),
        ('gpa_tier_low_min', '0.0', 'Minimum GPA for LOW tier')
      `);
      console.log('   ✅ Inserted default GPA thresholds');
    } else {
      console.log('   ✅ GPA thresholds already exist:');
      settings.forEach(s => {
        console.log(`      ${s.setting_key} = ${s.setting_value}`);
      });
    }
    
    // Check and create department_settings table
    console.log('\n3️⃣ Checking department_settings table...');
    const [deptTables] = await connection.execute(
      "SHOW TABLES LIKE 'department_settings'"
    );
    
    if (deptTables.length === 0) {
      console.log('   Creating department_settings table...');
      await connection.execute(`
        CREATE TABLE department_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          department VARCHAR(100) UNIQUE NOT NULL,
          use_custom_thresholds BOOLEAN DEFAULT FALSE,
          gpa_tier_high_min DECIMAL(3,2),
          gpa_tier_medium_min DECIMAL(3,2),
          gpa_tier_low_min DECIMAL(3,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Created department_settings table');
    } else {
      console.log('   ✅ department_settings table exists');
    }
    
    console.log('\n✅ All settings tables are ready!');
    console.log('\n💡 You can now use the Settings page in the admin panel');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

setupSettings();
