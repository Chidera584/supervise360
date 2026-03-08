/**
 * Defense Allocation Service
 * Persists and retrieves defense scheduling (venue + assessors) by department & group range.
 * Links students/supervisors to their defense venue and assessors.
 */

import { Pool } from 'mysql2/promise';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS defense_allocations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  venue_name VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL,
  group_start INT NOT NULL,
  group_end INT NOT NULL,
  assessors JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dept_range (department, group_start, group_end)
) ENGINE=InnoDB
`;

function parseGroupNumber(groupName: string): number | null {
  const match = String(groupName).match(/group\s*(\d+)/i);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function normalizeDepartment(dept: string): string {
  return String(dept || '').trim();
}

// Map abbreviations and alternate spellings for department matching
const DEPARTMENT_ALIASES: Record<string, string[]> = {
  'software engineering': ['se', 'software eng', 'softeng', 'swe'],
  'information technology': ['it', 'infotech', 'information tech'],
  'computer science': ['cs', 'compsci', 'comp sci'],
};

function getDepartmentMatchVariants(dept: string): string[] {
  const d = normalizeDepartment(dept).toLowerCase();
  if (!d) return [];
  const variants = new Set<string>([d]);
  for (const [canonical, aliases] of Object.entries(DEPARTMENT_ALIASES)) {
    if (d === canonical || aliases.includes(d)) {
      variants.add(canonical);
      aliases.forEach(a => variants.add(a));
    }
  }
  return Array.from(variants);
}

export interface AllocationInput {
  venue: string;
  groupRange?: { department: string; start: number; end: number };
  assessors: string[];
}

export interface StudentDefenseInfo {
  venue: string;
  groupRange: string;
  assessors: string[];
  department: string;
  groupNumber: number;
}

export interface SupervisorGroupDefenseInfo {
  groupId: number;
  groupName: string;
  department: string;
  groupNumber: number;
  venue: string;
  groupRange: string;
  assessors: string[];
}

export class DefenseAllocationService {
  constructor(private db: Pool) {}

  async ensureTable() {
    await this.db.execute(CREATE_TABLE_SQL);
  }

  /**
   * Save allocations from Defense Scheduling. Replaces all existing.
   */
  async saveAllocations(allocations: AllocationInput[]): Promise<void> {
    await this.ensureTable();
    const connection = await this.db.getConnection();
    try {
      await connection.execute('DELETE FROM defense_allocations');
      for (const a of allocations) {
        const dept = a.groupRange?.department?.trim() || '';
        const start = a.groupRange?.start ?? 0;
        const end = a.groupRange?.end ?? 0;
        if (!dept || !a.venue) continue;
        await connection.execute(
          `INSERT INTO defense_allocations (venue_name, department, group_start, group_end, assessors)
           VALUES (?, ?, ?, ?, ?)`,
          [a.venue, dept, start, end, JSON.stringify(a.assessors || [])]
        );
      }
    } finally {
      connection.release();
    }
  }

  async listAllocations(): Promise<AllocationInput[]> {
    await this.ensureTable();
    const [rows] = await this.db.execute(
      'SELECT venue_name, department, group_start, group_end, assessors FROM defense_allocations ORDER BY id ASC'
    );
    return (rows as any[]).map((r: any) => {
      let assessors: string[] = [];
      try {
        assessors = typeof r.assessors === 'string' ? JSON.parse(r.assessors) : (r.assessors || []);
      } catch {
        assessors = [];
      }
      return {
        venue: r.venue_name,
        groupRange: { department: r.department, start: r.group_start, end: r.group_end },
        assessors,
      };
    });
  }

  /**
   * Find group_id for a student - try matric_number first, then student_name
   */
  private async findGroupForStudent(matricNumber: string | null, userName: string | null): Promise<{ groupId: number } | null> {
    if (matricNumber && matricNumber.trim()) {
      const [byMatric] = await this.db.execute(
        'SELECT group_id FROM group_members WHERE matric_number = ? LIMIT 1',
        [matricNumber.trim()]
      );
      if ((byMatric as any[]).length > 0) return { groupId: (byMatric as any[])[0].group_id };
      // Try trimmed/loose match (spaces, case)
      const [byMatricLoose] = await this.db.execute(
        'SELECT group_id FROM group_members WHERE TRIM(matric_number) = ? OR matric_number = ? LIMIT 1',
        [matricNumber.trim(), matricNumber]
      );
      if ((byMatricLoose as any[]).length > 0) return { groupId: (byMatricLoose as any[])[0].group_id };
    }
    if (userName) {
      const nm = userName.trim();
      const [byName] = await this.db.execute(
        'SELECT group_id FROM group_members WHERE TRIM(student_name) = ? OR student_name = ? LIMIT 1',
        [nm, nm]
      );
      if ((byName as any[]).length > 0) return { groupId: (byName as any[])[0].group_id };
      // Try matching with parts (e.g. "Grace Ayo" vs "Ayo Grace" or "Grace" in name)
      const parts = nm.split(/\s+/).filter(Boolean);
      if (parts.length >= 1) {
        const [byPart] = await this.db.execute(
          `SELECT group_id FROM group_members WHERE ${parts.map(() => 'student_name LIKE ?').join(' AND ')} LIMIT 1`,
          parts.map(p => `%${p}%`)
        );
        if ((byPart as any[]).length > 0) return { groupId: (byPart as any[])[0].group_id };
      }
    }
    return null;
  }

  /**
   * Get defense info by group ID (alternative path - use when matric/name lookup fails)
   */
  async getDefenseScheduleByGroupId(groupId: number): Promise<StudentDefenseInfo | null> {
    await this.ensureTable();
    const [groupRows] = await this.db.execute(
      'SELECT id, name, department FROM project_groups WHERE id = ?',
      [groupId]
    );
    const groups = groupRows as any[];
    if (groups.length === 0) return null;

    const group = groups[0];
    const groupNumber = parseGroupNumber(group.name);
    if (groupNumber === null) return null;

    const department = normalizeDepartment(group.department);
    const deptVariants = getDepartmentMatchVariants(department);
    if (deptVariants.length === 0 && !department) {
      // Try matching without department - use any allocation that has group number in range
      const [fallbackRows] = await this.db.execute(
        `SELECT venue_name, department, group_start, group_end, assessors
         FROM defense_allocations
         WHERE ? >= group_start AND ? <= group_end
         LIMIT 1`,
        [groupNumber, groupNumber]
      );
      const allocs = fallbackRows as any[];
      if (allocs.length > 0) {
        const a = allocs[0];
        let assessors: string[] = [];
        try {
          assessors = typeof a.assessors === 'string' ? JSON.parse(a.assessors) : (a.assessors || []);
        } catch {
          assessors = [];
        }
        return {
          venue: a.venue_name,
          groupRange: `${a.department} Groups ${a.group_start}–${a.group_end}`,
          assessors,
          department: a.department,
          groupNumber
        };
      }
    }
    if (deptVariants.length === 0) return null;

    const placeholders = deptVariants.map(() => '?').join(',');
    let [allocRows] = await this.db.execute(
      `SELECT venue_name, department, group_start, group_end, assessors
       FROM defense_allocations
       WHERE LOWER(TRIM(department)) IN (${placeholders})
         AND ? >= group_start AND ? <= group_end
       LIMIT 1`,
      [...deptVariants, groupNumber, groupNumber]
    );
    let allocs = allocRows as any[];
    // Fallback: match by group number only (e.g. when dept names differ)
    if (allocs.length === 0) {
      [allocRows] = await this.db.execute(
        `SELECT venue_name, department, group_start, group_end, assessors
         FROM defense_allocations
         WHERE ? >= group_start AND ? <= group_end
         LIMIT 1`,
        [groupNumber, groupNumber]
      );
      allocs = allocRows as any[];
    }
    if (allocs.length === 0) return null;

    const a = allocs[0];
    let assessors: string[] = [];
    try {
      assessors = typeof a.assessors === 'string' ? JSON.parse(a.assessors) : (a.assessors || []);
    } catch {
      assessors = [];
    }
    return {
      venue: a.venue_name,
      groupRange: `${a.department} Groups ${a.group_start}–${a.group_end}`,
      assessors,
      department: a.department,
      groupNumber
    };
  }

  /**
   * Get defense info for a student by matric number.
   */
  async getStudentDefenseSchedule(matricNumber: string | null, userName?: string | null): Promise<StudentDefenseInfo | null> {
    await this.ensureTable();
    const found = await this.findGroupForStudent(matricNumber, userName);
    if (!found) return null;
    return this.getDefenseScheduleByGroupId(found.groupId);
  }

  /**
   * Get defense info for all groups supervised by a supervisor (by user_id).
   */
  async getSupervisorGroupsDefenseSchedules(supervisorUserId: number): Promise<SupervisorGroupDefenseInfo[]> {
    await this.ensureTable();
    const [userRows] = await this.db.execute(
      'SELECT first_name, last_name FROM users WHERE id = ?',
      [supervisorUserId]
    );
    const users = userRows as any[];
    const fullName = users[0] ? `${(users[0].first_name || '')} ${(users[0].last_name || '')}`.trim() : '';
    if (!fullName) return [];

    const [groupRows] = await this.db.execute(
      `SELECT id, name, department, supervisor_name FROM project_groups
       WHERE supervisor_name = ?`,
      [fullName]
    );
    const groups = groupRows as any[];
    if (groups.length === 0) return [];

    const results: SupervisorGroupDefenseInfo[] = [];

    for (const g of groups) {
      const groupNumber = parseGroupNumber(g.name);
      if (groupNumber === null) continue;

      const department = normalizeDepartment(g.department);
      if (!department) continue;

      const deptVariants = getDepartmentMatchVariants(department);
      if (deptVariants.length === 0) continue;

      const placeholders = deptVariants.map(() => '?').join(',');
      const [allocRows] = await this.db.execute(
        `SELECT venue_name, department, group_start, group_end, assessors
         FROM defense_allocations
         WHERE LOWER(TRIM(department)) IN (${placeholders})
           AND ? >= group_start AND ? <= group_end
         LIMIT 1`,
        [...deptVariants, groupNumber, groupNumber]
      );
      const allocs = allocRows as any[];
      if (allocs.length === 0) continue;

      const a = allocs[0];
      let assessors: string[] = [];
      try {
        assessors = typeof a.assessors === 'string' ? JSON.parse(a.assessors) : (a.assessors || []);
      } catch {
        assessors = [];
      }

      results.push({
        groupId: g.id,
        groupName: g.name,
        department: g.department,
        groupNumber,
        venue: a.venue_name,
        groupRange: `${a.department} Groups ${a.group_start}–${a.group_end}`,
        assessors
      });
    }

    return results.sort((a, b) => a.groupNumber - b.groupNumber);
  }

  /**
   * Get all students to notify when defense allocations are published.
   * Returns { userId, email, studentName, venue, assessors, groupName } for each student.
   */
  async getStudentsToNotifyForPublishedDefense(): Promise<Array<{
    userId: number;
    email: string;
    studentName: string;
    venue: string;
    assessors: string[];
    groupName: string;
  }>> {
    await this.ensureTable();
    const results: Array<{ userId: number; email: string; studentName: string; venue: string; assessors: string[]; groupName: string }> = [];
    try {
      const [allocRows] = await this.db.execute(
        'SELECT venue_name, department, group_start, group_end, assessors FROM defense_allocations'
      );
      const allocations = allocRows as any[];
      if (allocations.length === 0) return results;

      for (const alloc of allocations) {
        const dept = normalizeDepartment(alloc.department);
        const start = Number(alloc.group_start) || 0;
        const end = Number(alloc.group_end) || 0;
        const venue = String(alloc.venue_name || '').trim();
        let assessors: string[] = [];
        try {
          assessors = typeof alloc.assessors === 'string' ? JSON.parse(alloc.assessors) : (alloc.assessors || []);
        } catch {
          assessors = [];
        }
        if (!venue) continue;

        const deptVariants = getDepartmentMatchVariants(dept);
        if (deptVariants.length === 0 && !dept) continue;

        const placeholders = deptVariants.map(() => '?').join(',');
        const [groupRows] = await this.db.execute(
          `SELECT id, name, department FROM project_groups
           WHERE LOWER(TRIM(department)) IN (${placeholders})`,
          deptVariants
        );
        const groups = groupRows as any[];
        for (const g of groups) {
          const groupNumber = parseGroupNumber(g.name);
          if (groupNumber === null || groupNumber < start || groupNumber > end) continue;

          const [memberRows] = await this.db.execute(
            'SELECT matric_number, student_name FROM group_members WHERE group_id = ?',
            [g.id]
          );
          const members = memberRows as any[];
          for (const m of members) {
            const matric = m.matric_number ? String(m.matric_number).trim() : null;
            const studentName = String(m.student_name || '').trim() || 'Student';
            if (!matric) continue;

            const [studentRows] = await this.db.execute(
              'SELECT user_id FROM students WHERE TRIM(matric_number) = ? OR matric_number = ? LIMIT 1',
              [matric, matric]
            );
            const students = studentRows as any[];
            if (students.length === 0) continue;

            const userId = students[0].user_id;
            const [userRows] = await this.db.execute(
              'SELECT email, first_name, last_name FROM users WHERE id = ? LIMIT 1',
              [userId]
            );
            const users = userRows as any[];
            if (users.length === 0) continue;

            const u = users[0];
            const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || studentName;
            results.push({
              userId,
              email: u.email || '',
              studentName: fullName,
              venue,
              assessors,
              groupName: g.name || `Group ${groupNumber}`,
            });
          }
        }
      }
    } catch (err) {
      console.error('getStudentsToNotifyForPublishedDefense error:', err);
    }
    return results;
  }
}
