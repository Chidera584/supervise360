const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDatabase() {
  console.log('🔍 Testing MySQL Database Connection...\n');
  
  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'supervise360',
    port: parseInt(process.env.DB_PORT || '3307')
  };
  
  console.log('Database Configuration:');
  console.log(`Host: ${dbConfig.host}`);
  console.log(`User: ${dbConfig.user}`);
  console.log(`Password: ${dbConfig.password ? '***' : '(empty)'}`);
  console.log(`Database: ${dbConfig.database}`);
  console.log(`Port: ${dbConfig.port}\n`);
  
  try {
    console.log('Attempting to connect...');
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connection successful!');
    
    // Test if database exists
    const [databases] = await connection.execute('SHOW DATABASES LIKE "supervise360"');
    if (databases.length > 0) {
      console.log(`✅ Database '${dbConfig.database}' exists`);
      
      // Test if tables exist
      const [tables] = await connection.execute('SHOW TABLES');
      console.log(`✅ Found ${tables.length} tables:`);
      tables.forEach(table => {
        const tableName = Object.values(table)[0];
        console.log(`   - ${tableName}`);
      });
      
      // Test a simple query
      const [result] = await connection.execute('SELECT COUNT(*) as count FROM users');
      console.log(`✅ Users table has ${result[0].count} records`);
      
    } else {
      console.log(`❌ Database '${dbConfig.database}' does not exist`);
      console.log('Please create the database first using:');
      console.log(`CREATE DATABASE ${dbConfig.database};`);
    }
    
    await connection.end();
    console.log('\n🎉 Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Possible solutions:');
      console.log('- Check your MySQL username and password');
      console.log('- Make sure MySQL server is running');
      console.log('- Verify user has proper privileges');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Possible solutions:');
      console.log('- Make sure MySQL server is running');
      console.log('- Check if MySQL is running on the correct port');
      console.log('- Verify host and port settings');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n💡 Database does not exist. Create it first:');
      console.log(`CREATE DATABASE ${dbConfig.database};`);
    }
  }
}

testDatabase();