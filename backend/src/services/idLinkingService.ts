import { Pool } from 'mysql2/promise';

export interface UnmatchedGroupMember {
  groupMemberId: number;
  groupId: number;
  groupName: string;
  studentName: string;
  matricNumber: string | null;
}

export interface UnmatchedSupervisorGroup {
  groupId: number;
  groupName: string;
  department: string | null;
  supervisorName: string;
}

/**
 * Resolves group_members.student_user_id and project_groups.supervisor_user_id from the existing
 * free-text student_name/matric_number and supervisor_name columns, using the same fuzzy-matching
 * rules already used throughout the app (matric normalization, title-prefix stripping,
 * first+last name matching) - but instead of re-guessing on every request, this runs once per
 * row and persists a confident match, or leaves it NULL for an admin to resolve. Only ever
 * writes a match when exactly one candidate is found; ambiguous or absent matches are left
 * unlinked and reported via getUnmatchedLinks() rather than guessed with LIMIT 1.
 */
export class IdLinkingService {
  constructor(private db: Pool) {}

  /** Attempts to link every group_members row with a NULL student_user_id. Returns match count. */
  async backfillStudentUserIds(): Promise<{ matched: number; total: number }> {
    const [rows] = await this.db.execute(
      `SELECT id, matric_number FROM group_members WHERE student_user_id IS NULL AND matric_number IS NOT NULL AND TRIM(matric_number) != ''`
    );
    const candidates = rows as { id: number; matric_number: string }[];
    let matched = 0;

    for (const c of candidates) {
      const raw = String(c.matric_number).trim();
      if (!raw) continue;
      const compact = raw.replace(/\s+/g, '');
      const compactNoSlash = compact.replace(/\//g, '');

      const [studentRows] = await this.db.execute(
        `SELECT user_id FROM students
         WHERE matric_number = ?
            OR TRIM(matric_number) = ?
            OR REPLACE(TRIM(matric_number), ' ', '') = ?
            OR REPLACE(REPLACE(TRIM(matric_number), ' ', ''), '/', '') = ?
         LIMIT 2`,
        [raw, raw, compact, compactNoSlash]
      );
      const students = studentRows as { user_id: number }[];
      // Only write when there's exactly one candidate - ambiguous matches stay unlinked.
      if (students.length === 1) {
        await this.db.execute('UPDATE group_members SET student_user_id = ? WHERE id = ?', [
          students[0].user_id,
          c.id,
        ]);
        matched++;
      }
    }

    return { matched, total: candidates.length };
  }

  /** Attempts to link every project_groups row with a NULL supervisor_user_id. Returns match count. */
  async backfillSupervisorUserIds(): Promise<{ matched: number; total: number }> {
    const [rows] = await this.db.execute(
      `SELECT id, supervisor_name, department FROM project_groups
       WHERE supervisor_user_id IS NULL AND supervisor_name IS NOT NULL AND TRIM(supervisor_name) != ''`
    );
    const candidates = rows as { id: number; supervisor_name: string; department: string | null }[];
    let matched = 0;

    for (const c of candidates) {
      const sn = String(c.supervisor_name)
        .trim()
        .replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Engr\.?)\s+/i, '');
      if (!sn) continue;
      const dept = String(c.department || '').trim();

      const [supRows] = await this.db.execute(
        `SELECT u.id FROM users u
         INNER JOIN supervisors s ON s.user_id = u.id
         WHERE ? LIKE CONCAT('%', TRIM(COALESCE(u.first_name,'')), '%')
           AND ? LIKE CONCAT('%', TRIM(COALESCE(u.last_name,'')), '%')
           AND COALESCE(u.first_name,'') != '' AND COALESCE(u.last_name,'') != ''
           AND (? = '' OR TRIM(COALESCE(u.department,'')) = TRIM(?))
         LIMIT 2`,
        [sn, sn, dept, dept]
      );
      const sups = supRows as { id: number }[];
      if (sups.length === 1) {
        await this.db.execute('UPDATE project_groups SET supervisor_user_id = ? WHERE id = ?', [
          sups[0].id,
          c.id,
        ]);
        matched++;
      }
    }

    return { matched, total: candidates.length };
  }

  /** Current state (post-backfill): rows an admin still needs to resolve manually. */
  async getUnmatchedLinks(): Promise<{
    students: UnmatchedGroupMember[];
    supervisors: UnmatchedSupervisorGroup[];
  }> {
    const [studentRows] = await this.db.execute(
      `SELECT gm.id as groupMemberId, gm.group_id as groupId, pg.name as groupName,
              gm.student_name as studentName, gm.matric_number as matricNumber
       FROM group_members gm
       INNER JOIN project_groups pg ON pg.id = gm.group_id
       WHERE gm.student_user_id IS NULL
       ORDER BY pg.department, pg.name`
    );
    const [supervisorRows] = await this.db.execute(
      `SELECT id as groupId, name as groupName, department, supervisor_name as supervisorName
       FROM project_groups
       WHERE supervisor_user_id IS NULL AND supervisor_name IS NOT NULL AND TRIM(supervisor_name) != ''
       ORDER BY department, name`
    );
    return {
      students: studentRows as UnmatchedGroupMember[],
      supervisors: supervisorRows as UnmatchedSupervisorGroup[],
    };
  }
}
