const mysql = require('mysql2/promise');

async function checkTable() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'Chidera_2468',
    database: 'supervise360',
    port: 3307
  });

  try {
    console.log('📋 Students Table Structure:\n');
    const [columns] = await connection.execute('DESCRIBE students');
    columns.forEach(col => {
      console.log(`  ${col.Field} (${col.Type})`);
    });
    
    console.log('\n📊 Sample Data:\n');
    const [rows] = await connection.execute('SELECT * FROM students LIMIT 3');
    console.log(rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkTable();
