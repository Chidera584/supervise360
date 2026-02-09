import { testConnection, executeQuery, getOne } from '../src/lib/database.js';
import { AuthService, UserService, StudentService } from '../src/lib/database-service.js';

async function runDatabaseTests() {
  console.log('🔍 Testing MySQL Database Connection...\n');

  // Test 1: Basic Connection
  console.log('1. Testing basic connection...');
  const connectionSuccess = await testConnection();
  if (!connectionSuccess) {
    console.error('❌ Database connection failed!');
    process.exit(1);
  }
  console.log('✅ Database connection successful!\n');

  // Test 2: Check if tables exist
  console.log('2. Checking database schema...');
  try {
    const tables = await executeQuery('SHOW TABLES');
    if (tables.success && tables.data.length > 0) {
      console.log(`✅ Found ${tables.data.length} tables:`);
      tables.data.forEach(table => {
        const tableName = Object.values(table)[0];
        console.log(`   - ${tableName}`);
      });
    } else {
      console.log('⚠️  No tables found. Please run the schema creation script.');
    }
  } catch (error) {
    console.error('❌ Error checking tables:', error.message);
  }
  console.log('');

  // Test 3: Check views
  console.log('3. Checking database views...');
  try {
    const views = await executeQuery('SHOW FULL TABLES WHERE Table_type = "VIEW"');
    if (views.success && views.data.length > 0) {
      console.log(`✅ Found ${views.data.length} views:`);
      views.data.forEach(view => {
        const viewName = Object.values(view)[0];
        console.log(`   - ${viewName}`);
      });
    } else {
      console.log('⚠️  No views found. Please run the views creation script.');
    }
  } catch (error) {
    console.error('❌ Error checking views:', error.message);
  }
  console.log('');

  // Test 4: Check system settings
  console.log('4. Checking system settings...');
  try {
    const settings = await executeQuery('SELECT * FROM system_settings LIMIT 5');
    if (settings.success && settings.data.length > 0) {
      console.log('✅ System settings found:');
      settings.data.forEach(setting => {
        console.log(`   - ${setting.setting_key}: ${setting.setting_value}`);
      });
    } else {
      console.log('⚠️  No system settings found.');
    }
  } catch (error) {
    console.error('❌ Error checking system settings:', error.message);
  }
  console.log('');

  // Test 5: Test service layer (if tables exist)
  console.log('5. Testing service layer...');
  try {
    const userCount = await getOne('SELECT COUNT(*) as count FROM users');
    console.log(`✅ Service layer working. Users in database: ${userCount?.count || 0}`);
  } catch (error) {
    console.error('❌ Service layer error:', error.message);
  }
  console.log('');

  // Test 6: Test triggers (if possible)
  console.log('6. Checking triggers...');
  try {
    const triggers = await executeQuery('SHOW TRIGGERS');
    if (triggers.success && triggers.data.length > 0) {
      console.log(`✅ Found ${triggers.data.length} triggers:`);
      triggers.data.forEach(trigger => {
        console.log(`   - ${trigger.Trigger} on ${trigger.Table}`);
      });
    } else {
      console.log('⚠️  No triggers found. Please run the triggers creation script.');
    }
  } catch (error) {
    console.error('❌ Error checking triggers:', error.message);
  }
  console.log('');

  console.log('🎉 Database test completed!\n');
  
  console.log('📋 Next Steps:');
  console.log('1. If tables are missing, run: mysql -u root -p < database/improved_schema.sql');
  console.log('2. If triggers are missing, run: mysql -u root -p < database/triggers.sql');
  console.log('3. If views are missing, run: mysql -u root -p < database/views.sql');
  console.log('4. Update your .env file with correct MySQL credentials');
  console.log('5. Start your application with: npm run dev\n');

  process.exit(0);
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  console.log('\n💡 Common solutions:');
  console.log('- Check if MySQL server is running');
  console.log('- Verify credentials in .env file');
  console.log('- Ensure database "supervise360" exists');
  console.log('- Check if user has proper privileges');
  process.exit(1);
});

runDatabaseTests();