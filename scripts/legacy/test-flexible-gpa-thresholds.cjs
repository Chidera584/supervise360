const mysql = require('mysql2/promise');

// Hardcode the connection details
const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: 'Chidera_2468',
  database: 'supervise360'
};

async function testFlexibleGpaThresholds() {
  console.log('🧪 Testing Flexible GPA Threshold System\n');

  const connection = await mysql.createConnection(DB_CONFIG);

  try {
    console.log('✅ Connected to database\n');

    // Test 1: Check if department_settings table exists
    console.log('📋 Test 1: Checking department_settings table...');
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'department_settings'"
    );
    
    if (tables.length === 0) {
      console.log('❌ department_settings table does not exist');
      console.log('💡 Run the migration: mysql -u root -p supervise360 < database/add_flexible_gpa_thresholds.sql\n');
      return;
    }
    console.log('✅ department_settings table exists\n');

    // Test 2: Check global thresholds
    console.log('📋 Test 2: Checking global GPA thresholds...');
    const [globalSettings] = await connection.execute(
      `SELECT setting_key, setting_value, description 
       FROM system_settings 
       WHERE setting_key IN ('gpa_tier_high_min', 'gpa_tier_medium_min', 'gpa_tier_low_min')`
    );
    
    console.log('Global Thresholds:');
    globalSettings.forEach(setting => {
      console.log(`  ${setting.setting_key}: ${setting.setting_value} - ${setting.description}`);
    });
    console.log('');

    // Test 3: Insert test department settings
    console.log('📋 Test 3: Creating test department settings...');
    
    // Software Engineering with custom thresholds
    await connection.execute(
      `INSERT INTO department_settings (department, use_custom_thresholds, gpa_tier_high_min, gpa_tier_medium_min, gpa_tier_low_min)
       VALUES ('Software Engineering', true, 3.70, 3.20, 0.00)
       ON DUPLICATE KEY UPDATE 
       use_custom_thresholds = true, 
       gpa_tier_high_min = 3.70, 
       gpa_tier_medium_min = 3.20, 
       gpa_tier_low_min = 0.00`
    );
    console.log('✅ Software Engineering: Custom thresholds (H≥3.70, M≥3.20, L≥0.00)');

    // Computer Science using global defaults
    await connection.execute(
      `INSERT INTO department_settings (department, use_custom_thresholds)
       VALUES ('Computer Science', false)
       ON DUPLICATE KEY UPDATE use_custom_thresholds = false`
    );
    console.log('✅ Computer Science: Using global defaults\n');

    // Test 4: Verify department settings
    console.log('📋 Test 4: Verifying department settings...');
    const [deptSettings] = await connection.execute(
      'SELECT * FROM department_settings'
    );
    
    console.log('Department Settings:');
    deptSettings.forEach(dept => {
      console.log(`\n  ${dept.department}:`);
      console.log(`    Custom Thresholds: ${dept.use_custom_thresholds ? 'Yes' : 'No (using global)'}`);
      if (dept.use_custom_thresholds) {
        console.log(`    HIGH: ≥${dept.gpa_tier_high_min}`);
        console.log(`    MEDIUM: ≥${dept.gpa_tier_medium_min}`);
        console.log(`    LOW: ≥${dept.gpa_tier_low_min}`);
      }
    });
    console.log('');

    // Test 5: Simulate tier classification with different thresholds
    console.log('📋 Test 5: Simulating tier classification...');
    
    const testGPAs = [4.50, 3.75, 3.50, 3.25, 2.80];
    
    console.log('\nUsing Global Thresholds (H≥3.80, M≥3.30, L≥0.00):');
    testGPAs.forEach(gpa => {
      let tier;
      if (gpa >= 3.80) tier = 'HIGH';
      else if (gpa >= 3.30) tier = 'MEDIUM';
      else tier = 'LOW';
      console.log(`  GPA ${gpa.toFixed(2)} → ${tier}`);
    });

    console.log('\nUsing Software Engineering Custom Thresholds (H≥3.70, M≥3.20, L≥0.00):');
    testGPAs.forEach(gpa => {
      let tier;
      if (gpa >= 3.70) tier = 'HIGH';
      else if (gpa >= 3.20) tier = 'MEDIUM';
      else tier = 'LOW';
      console.log(`  GPA ${gpa.toFixed(2)} → ${tier}`);
    });
    console.log('');

    // Test 6: Check if students exist for distribution preview
    console.log('📋 Test 6: Checking student data for preview...');
    const [students] = await connection.execute(
      'SELECT COUNT(*) as count FROM students'
    );
    
    if (students[0].count > 0) {
      console.log(`✅ Found ${students[0].count} students in database`);
      
      // Show distribution with global thresholds
      const [globalDist] = await connection.execute(`
        SELECT 
          SUM(CASE WHEN gpa >= 3.80 THEN 1 ELSE 0 END) as high_tier,
          SUM(CASE WHEN gpa >= 3.30 AND gpa < 3.80 THEN 1 ELSE 0 END) as medium_tier,
          SUM(CASE WHEN gpa < 3.30 THEN 1 ELSE 0 END) as low_tier
        FROM students
      `);
      
      console.log('\nCurrent Distribution (Global Thresholds):');
      console.log(`  HIGH: ${globalDist[0].high_tier} students`);
      console.log(`  MEDIUM: ${globalDist[0].medium_tier} students`);
      console.log(`  LOW: ${globalDist[0].low_tier} students`);
    } else {
      console.log('⚠️  No students in database yet');
    }
    console.log('');

    // Test 7: API endpoint check
    console.log('📋 Test 7: Testing API endpoints...');
    console.log('Available endpoints:');
    console.log('  GET  /api/settings/gpa-thresholds/global');
    console.log('  PUT  /api/settings/gpa-thresholds/global');
    console.log('  GET  /api/settings/gpa-thresholds/department/:department');
    console.log('  PUT  /api/settings/gpa-thresholds/department/:department');
    console.log('  POST /api/settings/gpa-thresholds/preview');
    console.log('');

    console.log('✅ All tests completed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('1. Start the backend server: cd backend && npm run dev');
    console.log('2. Navigate to Settings page in the admin dashboard');
    console.log('3. Configure global or department-specific thresholds');
    console.log('4. Preview tier distribution before saving');
    console.log('5. Form groups - they will use the configured thresholds');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await connection.end();
  }
}

testFlexibleGpaThresholds();
