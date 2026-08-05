import { Pool } from 'mysql2/promise';
import { columnExists } from '../../services/schemaFixService';

/**
 * Adds nullable FK columns so group membership and supervisor assignment can be resolved by
 * user id instead of free-text name matching. `group_members.student_name` and
 * `project_groups.supervisor_name` are kept as display labels (CSV uploads can name students/
 * supervisors before they have an account, or an account may never be created for some rows) -
 * these columns are populated where a confident match exists (see the backfill script and
 * `resolveStudentUserId`/`resolveSupervisorUserId` helpers used going forward when saving groups
 * or assigning supervisors), with NULL meaning "not linked yet", not "no such student/supervisor".
 */
export async function addIdLinkingColumns(db: Pool): Promise<void> {
  if (!(await columnExists(db, 'group_members', 'student_user_id'))) {
    await db.execute(`ALTER TABLE group_members ADD COLUMN student_user_id INT NULL AFTER matric_number`);
    try {
      await db.execute(
        `ALTER TABLE group_members ADD CONSTRAINT fk_group_members_student_user
         FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE SET NULL`
      );
    } catch (e) {
      console.warn('group_members.student_user_id FK constraint skipped (non-fatal):', (e as Error).message);
    }
    try {
      await db.execute(`CREATE INDEX idx_group_members_student_user ON group_members(student_user_id)`);
    } catch {
      /* index may already exist */
    }
    console.log('✅ Added group_members.student_user_id');
  }

  if (!(await columnExists(db, 'project_groups', 'supervisor_user_id'))) {
    await db.execute(`ALTER TABLE project_groups ADD COLUMN supervisor_user_id INT NULL AFTER supervisor_name`);
    try {
      await db.execute(
        `ALTER TABLE project_groups ADD CONSTRAINT fk_project_groups_supervisor_user
         FOREIGN KEY (supervisor_user_id) REFERENCES users(id) ON DELETE SET NULL`
      );
    } catch (e) {
      console.warn('project_groups.supervisor_user_id FK constraint skipped (non-fatal):', (e as Error).message);
    }
    try {
      await db.execute(`CREATE INDEX idx_project_groups_supervisor_user ON project_groups(supervisor_user_id)`);
    } catch {
      /* index may already exist */
    }
    console.log('✅ Added project_groups.supervisor_user_id');
  }
}
