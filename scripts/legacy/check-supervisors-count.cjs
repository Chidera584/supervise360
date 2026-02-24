// Check supervisors count and data in database
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSupervisors() {
  console.log('🔍 Checking supervisors in database...\n');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'supervise360'
  });

  try {
    // Get all supervisors
    const [supervisors] = await connection.execute(`
      SELECT s.*, u.first_name, u.last_name, u.email, u.department 
      FROM supervisors s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.id ASC
    `);

    console.log(`📊 Total supervisors found: ${supervisors.length}`);
    console.log('\n📋 Supervisor details:');
    
    supervisors.forEach((supervisor, index) => {
      console.log(`${index + 1}. ID: ${supervisor.id}`);
      console.log(`   Name: ${supervisor.first_name || 'N/A'} ${supervisor.last_name || 'N/A'}`);
      console.log(`   Email: ${supervisor.email || 'N/A'}`);
      console.log(`   Department: ${supervisor.department || 'N/A'}`);
      console.log(`   Expertise: ${supervisor.expertise || 'N/A'}`);
      console.log(`   Created: ${supervisor.created_at || 'N/A'}`);
      console.log('');
    });

    // Check for duplicates or test data
    console.log('🔍 Analysis:');
    
    // Group by email to find duplicates
    const emailGroups = {};
    supervisors.forEach(s => {
      const email = s.email || 'no-email';
      if (!emailGroups[email]) emailGroups[email] = [];
      emailGroups[email].push(s);
    });

    const duplicates = Object.entries(emailGroups).filter(([email, sups]) => sups.length > 1);
    if (duplicates.length > 0) {
      console.log('⚠️  Duplicate emails found:');
      duplicates.forEach(([email, sups]) => {
        console.log(`   ${email}: ${sups.length} entries (IDs: ${sups.map(s => s.id).join(', ')})`);
      });
    }

    // Check for test/dummy data patterns
    const testPatterns = [
      'test', 'dummy', 'sample', 'example', 'demo', 'fake',
      '@test.com', '@example.com', '@dummy.com'
    ];
    
    const testData = supervisors.filter(s => {
      const fullText = `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase();
      return testPatterns.some(pattern => fullText.includes(pattern));
    });

    if (testData.length > 0) {
      console.log('\n🧪 Potential test/dummy data found:');
      testData.forEach(s => {
        console.log(`   ID ${s.id}: ${s.first_name} ${s.last_name} (${s.email})`);
      });
    }

    // Check by department
    const deptGroups = {};
    supervisors.forEach(s => {
      const dept = s.department || 'Unknown';
      if (!deptGroups[dept]) deptGroups[dept] = 0;
      deptGroups[dept]++;
    });

    console.log('\n📊 By Department:');
    Object.entries(deptGroups).forEach(([dept, count]) => {
      console.log(`   ${dept}: ${count} supervisors`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkSupervisors();