/**
 * One-time script to remove Cybersecurity, Data Science, and Information Systems
 * from the departments table. Run from project root: node scripts/remove-deprecated-departments.cjs
 */
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// Load .env from backend if it exists
const envPath = path.join(__dirname, '../backend/.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'supervise360',
};

const TO_REMOVE = ['Cybersecurity', 'Data Science', 'Information Systems'];

async function run() {
  console.log('Removing deprecated departments: Cybersecurity, Data Science, Information Systems\n');

  const conn = await mysql.createConnection(DB_CONFIG);

  try {
    for (const name of TO_REMOVE) {
      const [rows] = await conn.execute('SELECT id FROM departments WHERE name = ?', [name]);
      if (rows.length === 0) {
        console.log(`  ${name}: not found (already removed)`);
        continue;
      }
      const id = rows[0].id;
      await conn.execute('DELETE FROM admin_departments WHERE department_id = ?', [id]);
      await conn.execute('DELETE FROM departments WHERE id = ?', [id]);
      console.log(`  ${name}: removed`);
    }
    console.log('\nDone. Restart the backend server to pick up changes.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
