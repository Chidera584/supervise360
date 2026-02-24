#!/usr/bin/env node
/**
 * Update admin user email to a real address.
 * Run: node backend/update-admin-email.cjs
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mysql = require('mysql2/promise');

const NEW_ADMIN_EMAIL = 'munachimesigo@gmail.com';

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'supervise360',
    port: parseInt(process.env.DB_PORT || '3306'),
  });

  try {
    // Check if munachimesigo@gmail.com is already used by another account
    const [existing] = await pool.execute(
      'SELECT id, email, role FROM users WHERE email = ?',
      [NEW_ADMIN_EMAIL]
    );
    if (existing.length > 0 && existing[0].role !== 'admin') {
      // Move that user to +alias so admin can use the main address
      const altEmail = NEW_ADMIN_EMAIL.replace('@', '+supervisor@');
      await pool.execute('UPDATE users SET email = ? WHERE id = ?', [altEmail, existing[0].id]);
      console.log(`Moved ${existing[0].role} (id ${existing[0].id}) to ${altEmail} (same Gmail inbox)`);
    }

    const [adminRows] = await pool.execute(
      "SELECT id, email FROM users WHERE role = 'admin' LIMIT 1"
    );
    const admin = adminRows[0];
    if (!admin) {
      console.log('No admin user found.');
      process.exit(1);
    }

    await pool.execute('UPDATE users SET email = ? WHERE id = ?', [NEW_ADMIN_EMAIL, admin.id]);
    console.log(`Admin email updated: ${admin.email} -> ${NEW_ADMIN_EMAIL}`);
    console.log('\nNote: If supervisor Paul Ahmed was using munachimesigo@gmail.com, he will now log in with munachimesigo+supervisor@gmail.com (same Gmail inbox).');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
