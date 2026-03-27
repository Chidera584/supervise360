import { Pool } from 'mysql2/promise';

/**
 * Ensures projects and reports tables work with project_groups (not student_groups).
 * Runs on server startup so report submission works without manual migration.
 */
export async function ensureProjectGroupsSchema(db: Pool): Promise<void> {
  const dbName = process.env.DB_NAME || 'supervise360';

  try {
    // 1. Fix projects.group_id FK
    const [projFks] = await db.execute(
      `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME 
       FROM information_schema.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'group_id' AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [dbName]
    );
    const projFk = (projFks as any[])[0];
    if (projFk) {
      if (projFk.REFERENCED_TABLE_NAME === 'student_groups') {
        await db.execute(`ALTER TABLE projects DROP FOREIGN KEY \`${projFk.CONSTRAINT_NAME}\``);
        await db.execute(
          `ALTER TABLE projects ADD CONSTRAINT fk_projects_group 
           FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE`
        );
        console.log('✅ Fixed projects.group_id FK -> project_groups');
      }
    } else {
      try {
        await db.execute(
          `ALTER TABLE projects ADD CONSTRAINT fk_projects_group 
           FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE`
        );
        console.log('✅ Added projects.group_id FK -> project_groups');
      } catch (e) {
        // May already exist or table structure differs
      }
    }

    // 2. Fix reports.group_id FK (may reference student_groups)
    const [repFks] = await db.execute(
      `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME 
       FROM information_schema.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'group_id' AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [dbName]
    );
    const repFk = (repFks as any[])[0];
    if (repFk && repFk.REFERENCED_TABLE_NAME === 'student_groups') {
      await db.execute(`ALTER TABLE reports DROP FOREIGN KEY \`${repFk.CONSTRAINT_NAME}\``);
      try {
        await db.execute(
          `ALTER TABLE reports ADD CONSTRAINT fk_reports_group 
           FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE`
        );
        console.log('✅ Fixed reports.group_id FK -> project_groups');
      } catch (e) {
        // If project_groups doesn't exist or other issue, leave without FK
      }
    }
  } catch (err) {
    console.warn('Schema fix (non-fatal):', (err as Error).message);
  }
}

/**
 * Report review UI expects `reports.approved` (1 = approved, 0 = changes required).
 * Older databases created from improved_schema.sql before this column existed will 500 on POST /reports/:id/review.
 */
export async function ensureReportsApprovedColumn(db: Pool): Promise<void> {
  try {
    const [cols] = await db.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'approved'`
    );
    if ((cols as any[]).length > 0) return;

    await db.execute(
      `ALTER TABLE reports ADD COLUMN approved TINYINT(1) NULL DEFAULT NULL AFTER review_comments`
    );
    console.log('✅ Added reports.approved column (report review)');
  } catch (err) {
    console.warn('Schema fix reports.approved (non-fatal):', (err as Error).message);
  }
}

/**
 * Create project records for groups that don't have one.
 */
export async function backfillProjectsForGroups(db: Pool): Promise<number> {
  let created = 0;
  try {
    const [rows] = await db.execute(
      `SELECT pg.id, pg.name FROM project_groups pg
       LEFT JOIN projects p ON p.group_id = pg.id
       WHERE p.id IS NULL`
    );
    const groups = rows as { id: number; name: string }[];
    for (const g of groups) {
      try {
        await db.execute(
          `INSERT INTO projects (group_id, title, description, status, submitted_at)
           VALUES (?, ?, ?, 'pending', NOW())`,
          [g.id, `Project for ${g.name}`, 'Auto-created for report submission.']
        );
        created++;
        console.log(`Created project for group ${g.name}`);
      } catch (e) {
        console.warn('Backfill project failed for group', g.id, (e as Error).message);
      }
    }
  } catch (err) {
    console.warn('Backfill projects failed:', (err as Error).message);
  }
  return created;
}

/**
 * Ensure departments and admin_departments tables exist (multi-department admin support).
 */
export async function ensureDepartmentsTables(db: Pool): Promise<void> {
  try {
    const [tables] = await db.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'departments'"
    );
    const tableExists = (tables as any[]).length > 0;

    if (!tableExists) {
    await db.execute(`
      CREATE TABLE departments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        code VARCHAR(50) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_code (code)
      ) ENGINE=InnoDB
    `);
    await db.execute(`
      INSERT IGNORE INTO departments (name, code) VALUES
        ('Computer Science', 'computer_sci'),
        ('Software Engineering', 'software_eng'),
        ('Computer Technology', 'computer_tech'),
        ('Information Technology', 'info_tech'),
        ('Computer Information Systems', 'computer_info_sys')
    `);

    await db.execute(`
      CREATE TABLE admin_departments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        department_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_admin_dept (user_id, department_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
        INDEX idx_user (user_id),
        INDEX idx_department (department_id)
      ) ENGINE=InnoDB
    `);
    console.log('✅ Created departments and admin_departments tables');
    }

    // Always remove deprecated departments (Cybersecurity, Data Science, Information Systems)
    if (tableExists) {
      const toRemove = ['Cybersecurity', 'Data Science', 'Information Systems'];
      for (const name of toRemove) {
        try {
          const [check] = await db.execute('SELECT id FROM departments WHERE name = ?', [name]);
          if ((check as any[]).length === 0) continue;
          const id = (check as any[])[0].id;
          await db.execute('DELETE FROM admin_departments WHERE department_id = ?', [id]);
          await db.execute('DELETE FROM departments WHERE id = ?', [id]);
          console.log(`✅ Removed deprecated department: ${name}`);
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('Departments tables (non-fatal):', (err as Error).message);
  }
}
