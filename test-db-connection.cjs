const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('🔍 Testing database connection...\n');

  const config = {
    host: '127.0.0.1',
    user: 'root',
    password: 'Chidera_2468',
    database: 'supervise360',
    port: 3307
  };

  console.log('Configuration:');
  console.log('  Host:', config.host);
  console.log('  Port:', config.port);
  console.log('  User:', config.user);
  console.log('  Database:', config.database);
  console.log('');

  try {
    console.log('Attempting to connect...');
    const connection = await mysql.createConnection(config);
    console.log('✅ Connection successful!');

    // Test query
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM project_groups');
    console.log(`✅ Query successful! Found ${rows[0].count} groups`);

    await connection.end();
    console.log('✅ Connection closed');
  } catch (error) {
    console.error('❌ Connection failed!');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('');
    console.error('Possible issues:');
    console.error('  1. MySQL server is not running');
    console.error('  2. Wrong port (should be 3307)');
    console.error('  3. Wrong password');
    console.error('  4. Database "supervise360" does not exist');
  }
}

testConnection();
