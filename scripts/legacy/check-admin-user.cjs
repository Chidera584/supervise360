const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DEV_EMAIL = 'admin@gmail.com';

async function checkAndCreateAdmin() {
  const allow =
    process.env.NODE_ENV === 'development' ||
    process.env.ALLOW_ADMIN_SEED === 'true' ||
    process.env.ALLOW_ADMIN_SEED === '1';
  if (!allow) {
    console.log('Skipping dev admin seed (set NODE_ENV=development or ALLOW_ADMIN_SEED=true).');
    return;
  }

  console.log('Checking admin seed (dev)…\n');

  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'supervise360',
    port: parseInt(process.env.DB_PORT || '3307', 10),
  };

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [existing] = await connection.execute(
      'SELECT id, email FROM users WHERE email = ? LIMIT 1',
      [DEV_EMAIL]
    );
    const plain =
      process.env.ADMIN_SEED_PASSWORD ||
      (process.env.NODE_ENV === 'development' || process.env.ALLOW_ADMIN_SEED === 'true'
        ? 'admin1234'
        : '');
    if (!plain || String(plain).trim() === '') {
      console.error('Set ADMIN_SEED_PASSWORD or enable development / ALLOW_ADMIN_SEED.');
      await connection.end();
      return;
    }
    const hashedPassword = await bcrypt.hash(String(plain), 12);

    if (existing.length === 0) {
      await connection.execute(
        `INSERT INTO users (first_name, last_name, email, password_hash, role, department, is_active, email_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['Admin', 'User', DEV_EMAIL, hashedPassword, 'admin', 'Administration', true, true]
      );
      console.log(`Inserted dev admin: ${DEV_EMAIL} (password from ADMIN_SEED_PASSWORD only — not logged).`);
    } else {
      await connection.execute(
        'UPDATE users SET password_hash = ?, role = ?, is_active = TRUE, email_verified = TRUE WHERE email = ?',
        [hashedPassword, 'admin', DEV_EMAIL]
      );
      console.log(`Updated password hash for ${DEV_EMAIL} (password from ADMIN_SEED_PASSWORD only — not logged).`);
    }

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAndCreateAdmin();