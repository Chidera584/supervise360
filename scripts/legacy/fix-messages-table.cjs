/**
 * Ensure messages table exists with correct schema
 * Run: node backend/fix-messages-table.cjs
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'supervise360',
  port: parseInt(process.env.DB_PORT || '3306'),
};

async function main() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const [tables] = await conn.execute("SHOW TABLES LIKE 'messages'");
    if (tables.length === 0) {
      console.log('Creating messages table...');
      await conn.execute(`
        CREATE TABLE messages (
          id INT PRIMARY KEY AUTO_INCREMENT,
          sender_id INT NOT NULL,
          recipient_id INT NOT NULL,
          subject VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          message_type ENUM('direct', 'group', 'announcement') DEFAULT 'direct',
          priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
          read_status BOOLEAN DEFAULT FALSE,
          archived BOOLEAN DEFAULT FALSE,
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          read_at TIMESTAMP NULL,
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_sender (sender_id),
          INDEX idx_recipient (recipient_id),
          INDEX idx_read_status (read_status),
          INDEX idx_sent_at (sent_at)
        ) ENGINE=InnoDB
      `);
      console.log('✅ Messages table created');
    } else {
      console.log('✅ Messages table exists');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
