/**
 * Verify institutional student and supervisor counts in the database.
 * Run from project root: node scripts/verify-institutional-counts.cjs
 * 
 * These are the same counts used by Departments page, Admin Dashboard, etc.
 */
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

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

async function run() {
  console.log('Verifying institutional counts (group_members, supervisor_workload)\n');

  const conn = await mysql.createConnection(DB_CONFIG);

  try {
    const [[gm]] = await conn.execute('SELECT COUNT(*) as c FROM group_members');
    const [[sw]] = await conn.execute('SELECT COUNT(*) as c FROM supervisor_workload');
    const [deptRows] = await conn.execute(
      `SELECT pg.department, 
              COUNT(DISTINCT gm.id) as students,
              (SELECT COUNT(*) FROM supervisor_workload WHERE department = pg.department) as supervisors
       FROM project_groups pg
       LEFT JOIN group_members gm ON gm.group_id = pg.id
       GROUP BY pg.department`
    );

    console.log('System-wide totals (what Departments/Dashboard show):');
    console.log('  Students:   ', gm.c);
    console.log('  Supervisors:', sw.c);
    console.log('\nPer department:');
    deptRows.forEach((r) => {
      console.log(`  ${r.department}: ${r.students} students, ${r.supervisors} supervisors`);
    });
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
