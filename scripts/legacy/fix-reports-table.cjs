/**
 * Fix reports table to work with project_groups
 * Run: node backend/fix-reports-table.cjs
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
    console.log('Checking reports table...');

    const [tables] = await conn.execute("SHOW TABLES LIKE 'reports'");
    if (tables.length === 0) {
      console.log('Creating reports table...');
      await conn.execute(`
        CREATE TABLE reports (
          id INT PRIMARY KEY AUTO_INCREMENT,
          project_id INT NOT NULL,
          group_id INT NOT NULL,
          report_type ENUM('proposal', 'progress', 'final', 'other') NOT NULL,
          title VARCHAR(255) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          file_size INT,
          mime_type VARCHAR(100),
          submitted_by INT NOT NULL,
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          reviewed BOOLEAN DEFAULT FALSE,
          reviewed_by INT NULL,
          reviewed_at TIMESTAMP NULL,
          review_comments TEXT,
          INDEX idx_project (project_id),
          INDEX idx_group (group_id),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE,
          FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
      console.log('✅ Reports table created');
      return;
    }

    const [fks] = await conn.execute(
      `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME 
       FROM information_schema.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'group_id' AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [dbConfig.database]
    );

    if (fks.length > 0) {
      const fk = fks[0];
      if (fk.REFERENCED_TABLE_NAME === 'student_groups') {
        console.log('Removing reports.group_id FK to student_groups...');
        await conn.execute(`ALTER TABLE reports DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
        console.log('Adding FK to project_groups...');
        await conn.execute(`
          ALTER TABLE reports ADD CONSTRAINT fk_reports_group 
          FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE
        `);
        console.log('✅ reports.group_id FK fixed');
      } else if (fk.REFERENCED_TABLE_NAME === 'project_groups') {
        console.log('✅ reports.group_id already references project_groups');
      } else {
        console.log('⚠️ reports.group_id references', fk.REFERENCED_TABLE_NAME);
      }
    } else {
      console.log('Adding reports.group_id FK to project_groups...');
      await conn.execute(`
        ALTER TABLE reports ADD CONSTRAINT fk_reports_group 
        FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE
      `);
      console.log('✅ FK added');
    }

    // Add approved column if missing (for approved vs rejected decision)
    const [cols] = await conn.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'approved'`,
      [dbConfig.database]
    );
    if (cols.length === 0) {
      console.log('Adding reports.approved column...');
      await conn.execute(`ALTER TABLE reports ADD COLUMN approved TINYINT(1) NULL AFTER review_comments`);
      console.log('✅ reports.approved column added');
    } else {
      console.log('✅ reports.approved column exists');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
