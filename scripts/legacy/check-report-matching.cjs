/**
 * Diagnostic: Check report/supervisor matching for "Ngozi Nwoye"
 * Run: node backend/check-report-matching.cjs
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
};

async function main() {
  const c = await mysql.createConnection(dbConfig);
  console.log('\n=== Unreviewed reports (with group and supervisor) ===');
  const [reports] = await c.execute(`
    SELECT r.id, r.title, r.reviewed, p.group_id, pg.name as group_name, pg.supervisor_name
    FROM reports r
    INNER JOIN projects p ON r.project_id = p.id
    INNER JOIN project_groups pg ON p.group_id = pg.id
    WHERE r.reviewed = FALSE OR r.reviewed = 0
  `);
  console.log(reports);

  console.log('\n=== Supervisor users (Ngozi Nwoye) ===');
  const [users] = await c.execute(
    "SELECT id, first_name, last_name, email FROM users WHERE first_name LIKE '%Ngozi%' OR last_name LIKE '%Nwoye%'"
  );
  console.log(users);

  console.log('\n=== project_groups with supervisor_name (sample) ===');
  const [groups] = await c.execute(
    "SELECT id, name, supervisor_name FROM project_groups WHERE supervisor_name IS NOT NULL LIMIT 10"
  );
  console.log(groups);

  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
