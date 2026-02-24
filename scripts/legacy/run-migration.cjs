const mysql = require('mysql2/promise');
const fs = require('fs');

// Hardcode the connection details from .env
const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: 'Chidera_2468',
  database: 'supervise360',
  multipleStatements: true
};

async function runMigration() {
  console.log('🚀 Running Flexible GPA Thresholds Migration...\n');

  const connection = await mysql.createConnection(DB_CONFIG);

  try {
    console.log('✅ Connected to database');
    console.log(`   Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    console.log(`   Database: ${DB_CONFIG.database}\n`);

    // Read migration file
    const migrationSQL = fs.readFileSync('database/add_flexible_gpa_thresholds.sql', 'utf8');
    
    console.log('📝 Executing migration SQL...\n');
    
    // Execute migration
    const [results] = await connection.query(migrationSQL);
    
    console.log('✅ Migration executed successfully!\n');

    // Verify the changes
    console.log('🔍 Verifying migration...\n');
    
    // Check if department_settings table exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'department_settings'"
    );
    
    if (tables.length > 0) {
      console.log('✅ department_settings table created');
    } else {
      console.log('❌ department_settings table not found');
    }

    // Check global settings
    const [settings] = await connection.execute(
      `SELECT setting_key, setting_value, description 
       FROM system_settings 
       WHERE setting_key IN ('gpa_tier_high_min', 'gpa_tier_medium_min', 'gpa_tier_low_min')`
    );
    
    console.log('\n📊 Global GPA Thresholds:');
    settings.forEach(setting => {
      console.log(`   ${setting.setting_key}: ${setting.setting_value}`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: node test-flexible-gpa-thresholds.cjs');
    console.log('   2. Start backend: cd backend && npm run dev');
    console.log('   3. Start frontend: npm run dev');
    console.log('   4. Navigate to Settings page to configure thresholds');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
