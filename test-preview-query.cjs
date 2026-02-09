const mysql = require('mysql2/promise');

async function testPreviewQuery() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: 'Chidera_2468',
      database: 'supervise360',
      port: 3307
    });

    console.log('🔍 Testing preview query...\n');

    const department = 'Software Engineering';
    const query = 'SELECT s.gpa FROM students s INNER JOIN users u ON s.user_id = u.id WHERE s.gpa IS NOT NULL AND u.department = ?';
    const params = [department];

    console.log('Query:', query);
    console.log('Params:', params);
    console.log('');

    const [students] = await connection.execute(query, params);
    
    console.log(`✅ Found ${students.length} students`);
    console.log('\nSample students:');
    students.slice(0, 5).forEach((s, i) => {
      console.log(`  ${i + 1}. GPA: ${s.gpa} (type: ${typeof s.gpa})`);
    });

    // Test distribution calculation
    const high = 4;
    const medium = 3.3;
    const low = 1.2;
    
    const distribution = { HIGH: 0, MEDIUM: 0, LOW: 0, total: students.length };
    students.forEach((s) => {
      const gpa = typeof s.gpa === 'number' ? s.gpa : parseFloat(s.gpa);
      if (isNaN(gpa)) return;
      
      if (gpa >= high) distribution.HIGH++;
      else if (gpa >= medium) distribution.MEDIUM++;
      else distribution.LOW++;
    });

    console.log('\n📊 Distribution:');
    console.log(`  HIGH (≥${high}): ${distribution.HIGH}`);
    console.log(`  MEDIUM (≥${medium}): ${distribution.MEDIUM}`);
    console.log(`  LOW (≥${low}): ${distribution.LOW}`);
    console.log(`  Total: ${distribution.total}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testPreviewQuery();

