import { Pool } from 'mysql2/promise';
import { columnExists, tableExists } from '../../services/schemaFixService';

/**
 * Drops the legacy `student_groups` table (superseded by `project_groups`, see migration
 * 001_project_groups_schema) along with the two remaining FKs still pointing at it -
 * `students.group_id` (unused; group membership is tracked via `group_members`) and
 * `messages.group_id` (repointed at `project_groups`, which is what the app actually writes/reads
 * as a message's group - see messageService.ts).
 */
export async function dropStudentGroupsTable(db: Pool): Promise<void> {
  const dbName = process.env.DB_NAME || 'supervise360';

  if (await columnExists(db, 'messages', 'group_id')) {
    const [fks] = await db.execute(
      `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'group_id' AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [dbName]
    );
    const fk = (fks as any[])[0];
    if (fk && fk.REFERENCED_TABLE_NAME === 'student_groups') {
      await db.execute(`ALTER TABLE messages DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
      try {
        await db.execute(
          `ALTER TABLE messages ADD CONSTRAINT fk_messages_group
           FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE SET NULL`
        );
        console.log('✅ Fixed messages.group_id FK -> project_groups');
      } catch (e) {
        console.warn('messages.group_id FK -> project_groups skipped (non-fatal):', (e as Error).message);
      }
    }
  }

  if (await columnExists(db, 'students', 'group_id')) {
    const [fks] = await db.execute(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'students' AND COLUMN_NAME = 'group_id' AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [dbName]
    );
    const fk = (fks as any[])[0];
    if (fk) {
      await db.execute(`ALTER TABLE students DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
    }
    await db.execute(`ALTER TABLE students DROP COLUMN group_id`);
    console.log('✅ Dropped students.group_id (dead column; membership is tracked via group_members)');
  }

  if (await tableExists(db, 'student_groups')) {
    const [remaining] = await db.execute(
      `SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME = 'student_groups'`,
      [dbName]
    );
    if ((remaining as any[]).length > 0) {
      console.warn(
        '⚠️ Skipping DROP TABLE student_groups - still referenced by:',
        JSON.stringify(remaining)
      );
      return;
    }
    await db.execute(`DROP TABLE student_groups`);
    console.log('✅ Dropped unused student_groups table');
  }
}
