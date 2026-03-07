/**
 * Fix projects table to work with project_groups
 * Run: node scripts/legacy/fix-projects-table.cjs
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
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
    console.log('Checking projects table...');
    
    const [tables] = await conn.execute(
      "SHOW TABLES LIKE 'projects'"
    );
    if (tables.length === 0) {
      console.log('Creating projects table...');
      await conn.execute(`
        CREATE TABLE projects (
          id INT PRIMARY KEY AUTO_INCREMENT,
          group_id INT NOT NULL UNIQUE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          objectives TEXT,
          methodology TEXT,
          expected_outcomes TEXT,
          status ENUM('pending', 'approved', 'rejected', 'in_progress', 'completed') DEFAULT 'pending',
          rejection_reason TEXT,
          progress_percentage DECIMAL(5,2) DEFAULT 0.00,
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          approved_at TIMESTAMP NULL,
          completed_at TIMESTAMP NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_status (status),
          INDEX idx_group (group_id),
          FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
      console.log('✅ Projects table created');
      return;
    }

    const [fks] = await conn.execute(
      `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME 
       FROM information_schema.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'group_id' AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [dbConfig.database]
    );

    if (fks.length > 0) {
      const fk = fks[0];
      if (fk.REFERENCED_TABLE_NAME === 'student_groups') {
        console.log('Removing FK to student_groups...');
        await conn.execute(`ALTER TABLE projects DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
        console.log('Adding FK to project_groups...');
        await conn.execute(`
          ALTER TABLE projects ADD CONSTRAINT fk_projects_group 
          FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE
        `);
        console.log('✅ FK fixed');
      } else if (fk.REFERENCED_TABLE_NAME === 'project_groups') {
        console.log('✅ projects.group_id already references project_groups');
      } else {
        console.log('⚠️ projects.group_id references', fk.REFERENCED_TABLE_NAME);
      }
    } else {
      console.log('Adding FK to project_groups...');
      await conn.execute(`
        ALTER TABLE projects ADD CONSTRAINT fk_projects_group 
        FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE
      `);
      console.log('✅ FK added');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
