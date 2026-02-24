/**
 * Migration: Add group_id and parent_id to messages table
 * Run: node backend/scripts/migrate-messages-group.cjs
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

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
    const [cols] = await conn.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'messages'",
      [dbConfig.database]
    );
    const existing = (cols || []).map((r) => r.COLUMN_NAME);

    if (!existing.includes('group_id')) {
      await conn.execute('ALTER TABLE messages ADD COLUMN group_id INT NULL AFTER recipient_id');
      console.log('Added group_id column');
    } else {
      console.log('group_id already exists');
    }

    if (!existing.includes('parent_id')) {
      await conn.execute('ALTER TABLE messages ADD COLUMN parent_id INT NULL AFTER group_id');
      console.log('Added parent_id column');
    } else {
      console.log('parent_id already exists');
    }

    await conn.execute(`
      ALTER TABLE messages MODIFY COLUMN message_type 
      ENUM('direct', 'group', 'announcement', 'student', 'broadcast') DEFAULT 'direct'
    `);
    console.log('Updated message_type ENUM');

    try {
      await conn.execute('CREATE INDEX idx_messages_group ON messages(group_id)');
      console.log('Created idx_messages_group');
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') throw e;
    }
    try {
      await conn.execute('CREATE INDEX idx_messages_parent ON messages(parent_id)');
      console.log('Created idx_messages_parent');
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') throw e;
    }

    console.log('Migration complete');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
