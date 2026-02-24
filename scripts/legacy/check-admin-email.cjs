#!/usr/bin/env node
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
  const [rows] = await pool.execute(
    "SELECT id, email, first_name, last_name, role FROM users WHERE email IN ('admin@supervise360.com', 'munachimesigo@gmail.com')"
  );
  console.log('Users with these emails:', rows);
  await pool.end();
}
main();
