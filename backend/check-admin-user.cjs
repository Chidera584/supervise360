const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' });

async function checkAndCreateAdmin() {
  console.log('🔍 Checking for admin users...\n');
  
  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'supervise360',
    port: parseInt(process.env.DB_PORT || '3307')
  };
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Check existing users
    const [users] = await connection.execute('SELECT id, first_name, last_name, email, role FROM users');
    console.log('Existing users:');
    users.forEach(user => {
      console.log(`  - ${user.first_name} ${user.last_name} (${user.email}) - Role: ${user.role}`);
    });
    
    // Check if admin user exists
    const [adminUsers] = await connection.execute('SELECT * FROM users WHERE role = "admin"');
    
    if (adminUsers.length === 0) {
      console.log('\n❌ No admin user found. Creating default admin user...');
      
      // Create admin user
      const adminPassword = 'admin123';
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      const [result] = await connection.execute(
        'INSERT INTO users (first_name, last_name, email, password_hash, role, department, is_active, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['Admin', 'User', 'admin@supervise360.com', hashedPassword, 'admin', 'Administration', true, true]
      );
      
      console.log('✅ Admin user created successfully!');
      console.log('   Email: admin@supervise360.com');
      console.log('   Password: admin123');
      console.log('   Please change this password after first login!');
      
    } else {
      console.log('\n✅ Admin user already exists:');
      adminUsers.forEach(admin => {
        console.log(`   - ${admin.first_name} ${admin.last_name} (${admin.email})`);
      });
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAndCreateAdmin();