const mysql = require('mysql2/promise');
require('dotenv').config();

async function addMatricColumn() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Chidera_2468',
      database: process.env.DB_NAME || 'supervise360',
      port: process.env.DB_PORT || 3307
    });

    console.log('🔧 Adding matric_number column to group_members...');

    // Check if column exists
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM group_members LIKE 'matric_number'"
    );

    if (columns.length > 0) {
      console.log('✅ matric_number column already exists');
      return;
    }

    await connection.execute(
      'ALTER TABLE group_members ADD COLUMN matric_number VARCHAR(50) NULL AFTER member_order'
    );
    console.log('✅ Added matric_number column');

    await connection.execute(
      'ALTER TABLE group_members ADD INDEX idx_matric_number (matric_number)'
    );
    console.log('✅ Added index on matric_number');

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

addMatricColumn();
