#!/usr/bin/env node
/**
 * Fix emails: Paul Ahmed -> sharonmesigo246@gmail.com, Admin stays munachimesigo@gmail.com
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'supervise360',
    port: parseInt(process.env.DB_PORT || '3306'),
  });

  try {
    // Paul Ahmed (supervisor) -> sharonmesigo246@gmail.com
    const [paul] = await pool.execute(
      "SELECT id, email FROM users WHERE first_name LIKE '%Paul%' AND last_name LIKE '%Ahmed%' AND role = 'supervisor' LIMIT 1"
    );
    if (paul.length > 0) {
      await pool.execute('UPDATE users SET email = ? WHERE id = ?', ['sharonmesigo246@gmail.com', paul[0].id]);
      console.log(`Paul Ahmed (supervisor) email set to: sharonmesigo246@gmail.com`);
    }

    // Admin -> munachimesigo@gmail.com (ensure it's set)
    const [admin] = await pool.execute("SELECT id, email FROM users WHERE role = 'admin' LIMIT 1");
    if (admin.length > 0) {
      await pool.execute('UPDATE users SET email = ? WHERE id = ?', ['munachimesigo@gmail.com', admin[0].id]);
      console.log(`Admin email set to: munachimesigo@gmail.com`);
    }

    console.log('Done.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
