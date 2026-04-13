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

async function columnExists(db: Pool, table: string, column: string): Promise<boolean> {
  const [rows] = await db.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return (rows as any[]).length > 0;
}

async function tableExists(db: Pool, name: string): Promise<boolean> {
  const [rows] = await db.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name]
  );
  return (rows as any[]).length > 0;
}

/**
 * Academic sessions, session scoping, contact fields, workload caps, meetings & progressive assessment.
 * Idempotent — safe to run on every server start.
 */
export async function ensureFeatureExpansionSchema(db: Pool): Promise<void> {
  try {
    // --- academic_sessions ---
    if (!(await tableExists(db, 'academic_sessions'))) {
      await db.execute(`
        CREATE TABLE academic_sessions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          label VARCHAR(50) NOT NULL,
          starts_on DATE NULL,
          ends_on DATE NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_label (label)
        ) ENGINE=InnoDB
      `);
      await db.execute(
        `INSERT INTO academic_sessions (label, starts_on, ends_on, is_active) VALUES ('2024/2025', NULL, NULL, TRUE)`
      );
      console.log('✅ Created academic_sessions');
    }

    const [sessRows] = await db.execute('SELECT id FROM academic_sessions ORDER BY id ASC LIMIT 1');
    const defaultSessionId = (sessRows as any[])[0]?.id;
    if (!defaultSessionId) {
      await db.execute(
        `INSERT INTO academic_sessions (label, is_active) VALUES ('2024/2025', TRUE)`
      );
    }
    const [sess2] = await db.execute('SELECT id FROM academic_sessions ORDER BY id ASC LIMIT 1');
    const sessionIdDefault = (sess2 as any[])[0]?.id;

    // --- project_groups.session_id ---
    if (!(await columnExists(db, 'project_groups', 'session_id'))) {
      await db.execute(
        `ALTER TABLE project_groups ADD COLUMN session_id INT NULL AFTER department`
      );
      if (sessionIdDefault) {
        await db.execute('UPDATE project_groups SET session_id = ? WHERE session_id IS NULL', [
          sessionIdDefault
        ]);
      }
      try {
        await db.execute(
          `ALTER TABLE project_groups ADD CONSTRAINT fk_project_groups_session
           FOREIGN KEY (session_id) REFERENCES academic_sessions(id) ON DELETE RESTRICT`
        );
      } catch {
        /* FK may exist or MySQL version */
      }
      try {
        await db.execute(`CREATE INDEX idx_project_groups_session ON project_groups(session_id)`);
      } catch {
        /* */
      }
      console.log('✅ Added project_groups.session_id');
    }

    // --- students.session_id ---
    if (await tableExists(db, 'students')) {
      if (!(await columnExists(db, 'students', 'session_id'))) {
        await db.execute(`ALTER TABLE students ADD COLUMN session_id INT NULL AFTER academic_year`);
        if (sessionIdDefault) {
          await db.execute('UPDATE students SET session_id = ? WHERE session_id IS NULL', [
            sessionIdDefault
          ]);
        }
        try {
          await db.execute(
            `ALTER TABLE students ADD CONSTRAINT fk_students_session
             FOREIGN KEY (session_id) REFERENCES academic_sessions(id) ON DELETE SET NULL`
          );
        } catch {
          /* */
        }
        try {
          await db.execute(`CREATE INDEX idx_students_session ON students(session_id)`);
        } catch {
          /* */
        }
        console.log('✅ Added students.session_id');
      }
    }

    // --- group_members contact ---
    if (!(await columnExists(db, 'group_members', 'email'))) {
      await db.execute(
        `ALTER TABLE group_members ADD COLUMN email VARCHAR(255) NULL AFTER matric_number`
      );
      console.log('✅ Added group_members.email');
    }
    if (!(await columnExists(db, 'group_members', 'phone'))) {
      await db.execute(`ALTER TABLE group_members ADD COLUMN phone VARCHAR(50) NULL AFTER email`);
      console.log('✅ Added group_members.phone');
    }

    // --- supervisor_workload caps & contact (table may not exist on minimal DBs — skip without failing whole migration) ---
    if (await tableExists(db, 'supervisor_workload')) {
      if (!(await columnExists(db, 'supervisor_workload', 'max_groups'))) {
        await db.execute(
          `ALTER TABLE supervisor_workload ADD COLUMN max_groups INT NULL DEFAULT NULL AFTER current_groups`
        );
        console.log('✅ Added supervisor_workload.max_groups');
      }
      if (!(await columnExists(db, 'supervisor_workload', 'email'))) {
        await db.execute(
          `ALTER TABLE supervisor_workload ADD COLUMN email VARCHAR(255) NULL AFTER supervisor_name`
        );
        console.log('✅ Added supervisor_workload.email');
      }
      if (!(await columnExists(db, 'supervisor_workload', 'phone'))) {
        await db.execute(
          `ALTER TABLE supervisor_workload ADD COLUMN phone VARCHAR(50) NULL AFTER email`
        );
        console.log('✅ Added supervisor_workload.phone');
      }
    }

    // --- supervision_meetings ---
    if (!(await tableExists(db, 'supervision_meetings'))) {
      await db.execute(`
        CREATE TABLE supervision_meetings (
          id INT PRIMARY KEY AUTO_INCREMENT,
          group_id INT NOT NULL,
          session_id INT NOT NULL,
          supervisor_user_id INT NOT NULL,
          title VARCHAR(255) NOT NULL DEFAULT 'Supervision meeting',
          starts_at DATETIME NOT NULL,
          ends_at DATETIME NULL,
          location VARCHAR(255) NULL,
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_sm_group (group_id),
          INDEX idx_sm_session (session_id),
          INDEX idx_sm_supervisor (supervisor_user_id),
          CONSTRAINT fk_sm_group FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE,
          CONSTRAINT fk_sm_session FOREIGN KEY (session_id) REFERENCES academic_sessions(id) ON DELETE RESTRICT,
          CONSTRAINT fk_sm_supervisor_user FOREIGN KEY (supervisor_user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
      console.log('✅ Created supervision_meetings');
    }

    // --- meeting_attendance ---
    if (!(await tableExists(db, 'meeting_attendance'))) {
      await db.execute(`
        CREATE TABLE meeting_attendance (
          id INT PRIMARY KEY AUTO_INCREMENT,
          meeting_id INT NOT NULL,
          group_member_id INT NOT NULL,
          present BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_meeting_member (meeting_id, group_member_id),
          INDEX idx_ma_meeting (meeting_id),
          CONSTRAINT fk_ma_meeting FOREIGN KEY (meeting_id) REFERENCES supervision_meetings(id) ON DELETE CASCADE,
          CONSTRAINT fk_ma_member FOREIGN KEY (group_member_id) REFERENCES group_members(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
      console.log('✅ Created meeting_attendance');
    }

    if (await tableExists(db, 'supervision_meetings')) {
      if (!(await columnExists(db, 'supervision_meetings', 'bulk_series_id'))) {
        // Avoid AFTER notes — legacy tables may omit `notes`
        await db.execute(`ALTER TABLE supervision_meetings ADD COLUMN bulk_series_id VARCHAR(36) NULL`);
        try {
          await db.execute(`CREATE INDEX idx_sm_bulk_series ON supervision_meetings (bulk_series_id)`);
        } catch {
          /* index may exist */
        }
        console.log('✅ Added supervision_meetings.bulk_series_id');
      }
      if (!(await columnExists(db, 'supervision_meetings', 'attendance_locked'))) {
        await db.execute(
          `ALTER TABLE supervision_meetings ADD COLUMN attendance_locked BOOLEAN NOT NULL DEFAULT FALSE`
        );
        console.log('✅ Added supervision_meetings.attendance_locked');
      }
    }

    // --- student_assessment_entries ---
    if (!(await tableExists(db, 'student_assessment_entries'))) {
      await db.execute(`
        CREATE TABLE student_assessment_entries (
          id INT PRIMARY KEY AUTO_INCREMENT,
          student_user_id INT NOT NULL,
          supervisor_id INT NOT NULL,
          session_id INT NOT NULL,
          category ENUM('meeting_attendance','participation','quiz','general') NOT NULL DEFAULT 'general',
          points DECIMAL(8,2) NULL,
          max_points DECIMAL(8,2) NULL,
          title VARCHAR(255) NULL,
          notes TEXT NULL,
          meeting_id INT NULL,
          recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_sae_student (student_user_id),
          INDEX idx_sae_supervisor (supervisor_id),
          INDEX idx_sae_session (session_id),
          INDEX idx_sae_meeting (meeting_id),
          CONSTRAINT fk_sae_student FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT fk_sae_supervisor FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT fk_sae_session FOREIGN KEY (session_id) REFERENCES academic_sessions(id) ON DELETE RESTRICT,
          CONSTRAINT fk_sae_meeting FOREIGN KEY (meeting_id) REFERENCES supervision_meetings(id) ON DELETE SET NULL
        ) ENGINE=InnoDB
      `);
      console.log('✅ Created student_assessment_entries');
    }

    const [sessFinal] = await db.execute('SELECT id FROM academic_sessions ORDER BY id ASC LIMIT 1');
    if ((sessFinal as any[]).length === 0) {
      await db.execute(`INSERT INTO academic_sessions (label, is_active) VALUES ('2024/2025', TRUE)`);
    }
    const [sessIdRow] = await db.execute('SELECT id FROM academic_sessions ORDER BY id ASC LIMIT 1');
    const sid = (sessIdRow as any[])[0]?.id;
    if (sid && (await columnExists(db, 'project_groups', 'session_id'))) {
      await db.execute('UPDATE project_groups SET session_id = ? WHERE session_id IS NULL', [sid]);
    }
    if (sid && (await tableExists(db, 'students')) && (await columnExists(db, 'students', 'session_id'))) {
      await db.execute('UPDATE students SET session_id = ? WHERE session_id IS NULL', [sid]);
    }
  } catch (err) {
    console.warn('Feature expansion schema (non-fatal):', (err as Error).message);
  }
}

/**
 * Adds supervision_meetings.bulk_series_id and attendance_locked if missing.
 * Runs after ensureFeatureExpansionSchema so a failure earlier in that migration
 * (e.g. missing supervisor_workload table) does not leave production without these columns.
 */
export async function ensureSupervisionMeetingsColumns(db: Pool): Promise<void> {
  try {
    if (!(await tableExists(db, 'supervision_meetings'))) {
      return;
    }
    if (!(await columnExists(db, 'supervision_meetings', 'bulk_series_id'))) {
      await db.execute(`ALTER TABLE supervision_meetings ADD COLUMN bulk_series_id VARCHAR(36) NULL`);
      try {
        await db.execute(`CREATE INDEX idx_sm_bulk_series ON supervision_meetings (bulk_series_id)`);
      } catch {
        /* exists */
      }
      console.log('✅ Added supervision_meetings.bulk_series_id (redundant ensure)');
    }
    if (!(await columnExists(db, 'supervision_meetings', 'attendance_locked'))) {
      await db.execute(
        `ALTER TABLE supervision_meetings ADD COLUMN attendance_locked BOOLEAN NOT NULL DEFAULT FALSE`
      );
      console.log('✅ Added supervision_meetings.attendance_locked (redundant ensure)');
    }
  } catch (err) {
    console.warn('ensureSupervisionMeetingsColumns (non-fatal):', (err as Error).message);
  }
}
