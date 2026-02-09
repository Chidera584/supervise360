const mysql = require('mysql2/promise');

async function checkSchema() {
  console.log('🔍 Checking Settings Schema...\n');
  
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'supervise360'
  });

  try {
    // Check if system_settings table exists
    console.log('1️⃣ Checking system_settings table...');
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'system_settings'"
    );
    
    if (tables.length === 0) {
      console.log('❌ system_settings table does NOT exist');
      console.log('   Need to create it!\n');
    } else {
      console.log('✅ system_settings table exists');
      
      // Check for GPA threshold settings
      console.log('\n2️⃣ Checking GPA threshold settings...');
      const [settings] = await connection.execute(
        `SELECT * FROM system_settings WHERE setting_key LIKE 'gpa_tier%'`
      );
      
      if (settings.length === 0) {
        console.log('❌ No GPA threshold settings found');
        console.log('   Need to insert default values!\n');
      } else {
        console.log('✅ Found GPA threshold settings:');
        settings.forEach(s => {
          console.log(`   ${s.setting_key} = ${s.setting_value}`);
        });
      }
    }
    
    // Check if department_settings table exists
    console.log('\n3️⃣ Checking department_settings table...');
    const [deptTables] = await connection.execute(
      "SHOW TABLES LIKE 'department_settings'"
    );
    
    if (deptTables.length === 0) {
      console.log('❌ department_settings table does NOT exist');
      console.log('   Need to create it!\n');
    } else {
      console.log('✅ department_settings table exists\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkSchema();
