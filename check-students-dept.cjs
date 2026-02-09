const mysql = require('mysql2/promise');

async function checkStudents() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: 'Chidera_2468',
      database: 'supervise360',
      port: 3307
    });

    console.log('🔍 Checking students and departments...\n');

    // Check all students
    const [allStudents] = await connection.execute(
      'SELECT s.id, s.gpa, u.department, u.first_name, u.last_name FROM students s LEFT JOIN users u ON s.user_id = u.id LIMIT 10'
    );
    
    console.log(`📊 Total students found: ${allStudents.length}`);
    console.log('\nSample students:');
    allStudents.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.first_name} ${s.last_name} - GPA: ${s.gpa}, Dept: ${s.department || 'NULL'}`);
    });

    // Check students with Software Engineering department
    const [seStudents] = await connection.execute(
      'SELECT COUNT(*) as count FROM students s INNER JOIN users u ON s.user_id = u.id WHERE u.department = ?',
      ['Software Engineering']
    );
    console.log(`\n📊 Students in Software Engineering: ${seStudents[0].count}`);

    // Check students with any department
    const [deptStudents] = await connection.execute(
      'SELECT COUNT(*) as count FROM students s INNER JOIN users u ON s.user_id = u.id WHERE u.department IS NOT NULL'
    );
    console.log(`📊 Students with any department: ${deptStudents[0].count}`);

    // Check students with GPAs
    const [gpaStudents] = await connection.execute(
      'SELECT COUNT(*) as count FROM students WHERE gpa IS NOT NULL'
    );
    console.log(`📊 Students with GPA: ${gpaStudents[0].count}`);

    // Check unique departments
    const [depts] = await connection.execute(
      'SELECT DISTINCT u.department, COUNT(*) as count FROM users u INNER JOIN students s ON u.id = s.user_id GROUP BY u.department'
    );
    console.log('\n📊 Departments with students:');
    depts.forEach(d => {
      console.log(`  ${d.department || 'NULL'}: ${d.count} students`);
    });

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkStudents();

