import { Pool } from 'mysql2/promise';

export interface Department {
  id: number;
  name: string;
  code: string;
}

export interface DepartmentStats {
  id: number;
  name: string;
  code: string;
  studentCount: number;
  supervisorCount: number;
  groupCount: number;
  unassignedCount: number;
}

export class DepartmentService {
  constructor(private db: Pool) {}

  /** List all departments */
  async listDepartments(): Promise<Department[]> {
    const [rows] = await this.db.execute('SELECT id, name, code FROM departments ORDER BY name');
    return rows as Department[];
  }

  /** Get department IDs/names an admin can access. Empty array = all departments (super admin) */
  async getAdminDepartmentIds(adminUserId: number): Promise<number[] | null> {
    const [rows] = await this.db.execute(
      'SELECT department_id FROM admin_departments WHERE user_id = ?',
      [adminUserId]
    );
    const ids = (rows as { department_id: number }[]).map((r) => r.department_id);
    return ids.length === 0 ? null : ids;
  }

  /** Get department names an admin can access. null = all departments */
  async getAdminDepartmentNames(adminUserId: number): Promise<string[] | null> {
    const [rows] = await this.db.execute(
      `SELECT d.name FROM admin_departments ad
       JOIN departments d ON d.id = ad.department_id
       WHERE ad.user_id = ?
       ORDER BY d.name`,
      [adminUserId]
    );
    const names = (rows as { name: string }[]).map((r) => r.name);
    return names.length === 0 ? null : names;
  }

  /** Assign admin to departments. Pass empty array to make super admin (manages all) */
  async setAdminDepartments(adminUserId: number, departmentIds: number[]): Promise<void> {
    const conn = await this.db.getConnection();
    try {
      await conn.execute('DELETE FROM admin_departments WHERE user_id = ?', [adminUserId]);
      if (departmentIds.length > 0) {
        for (const deptId of departmentIds) {
          await conn.execute(
            'INSERT INTO admin_departments (user_id, department_id) VALUES (?, ?)',
            [adminUserId, deptId]
          );
        }
      }
    } finally {
      conn.release();
    }
  }

  /** System-wide totals from institutional data (uploaded CSV - group_members, supervisor_workload).
   * Does NOT use users/students/supervisors tables - those are for registered accounts only. */
  async getSystemWideTotals(): Promise<{ totalStudents: number; totalSupervisors: number }> {
    const [gmRows] = await this.db.execute('SELECT COUNT(*) as c FROM group_members') as any;
    const totalStudents = Number(gmRows?.[0]?.c ?? 0);

    const [workloadRows] = await this.db.execute('SELECT COUNT(*) as c FROM supervisor_workload') as any;
    const totalSupervisors = Number(workloadRows?.[0]?.c ?? 0);

    return { totalStudents, totalSupervisors };
  }

  /** Get stats per department from institutional data (uploaded CSV).
   * Students: group_members via project_groups. Supervisors: supervisor_workload. */
  async getDepartmentStats(departmentNames?: string[] | null): Promise<DepartmentStats[]> {
    const depts = await this.listDepartments();
    const stats: DepartmentStats[] = [];

    for (const dept of depts) {
      if (departmentNames !== null && departmentNames && !departmentNames.includes(dept.name)) {
        continue;
      }

      const [studentRows] = await this.db.execute(
        `SELECT COUNT(*) as c FROM group_members gm
         JOIN project_groups pg ON pg.id = gm.group_id
         WHERE pg.department = ?`,
        [dept.name]
      );
      const studentCount = Number((studentRows as any[])[0]?.c ?? 0);

      const [supervisorRows] = await this.db.execute(
        'SELECT COUNT(*) as c FROM supervisor_workload WHERE department = ?',
        [dept.name]
      );
      const supervisorCount = Number((supervisorRows as any[])[0]?.c ?? 0);

      const [groupRows] = await this.db.execute(
        'SELECT COUNT(*) as c FROM project_groups WHERE department = ?',
        [dept.name]
      );
      const groupCount = Number((groupRows as any[])[0]?.c ?? 0);

      const [unassignedRows] = await this.db.execute(
        `SELECT COUNT(*) as c FROM group_members gm
         JOIN project_groups pg ON pg.id = gm.group_id
         WHERE pg.department = ? AND (pg.supervisor_name IS NULL OR pg.supervisor_name = '')`,
        [dept.name]
      );
      const unassignedCount = Number((unassignedRows as any[])[0]?.c ?? 0);

      stats.push({
        id: dept.id,
        name: dept.name,
        code: dept.code,
        studentCount,
        supervisorCount,
        groupCount,
        unassignedCount,
      });
    }

    return stats;
  }

  /** Create a new department. Code is auto-generated from name if not provided. */
  async createDepartment(name: string, code?: string): Promise<Department> {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Department name is required');
    const finalCode = (code || trimmedName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')).trim() || 'dept';
    const [result] = await this.db.execute(
      'INSERT INTO departments (name, code) VALUES (?, ?)',
      [trimmedName, finalCode]
    );
    const insertId = (result as any).insertId;
    const [rows] = await this.db.execute('SELECT id, name, code FROM departments WHERE id = ?', [insertId]);
    return (rows as Department[])[0];
  }

  /** Delete a department. Fails if it has users, supervisors, groups, or institutional data. */
  async deleteDepartment(id: number): Promise<{ ok: boolean; error?: string }> {
    const [dept] = await this.db.execute('SELECT id, name FROM departments WHERE id = ?', [id]);
    const d = (dept as any[])[0];
    if (!d) return { ok: false, error: 'Department not found' };

    const [userRows] = await this.db.execute('SELECT COUNT(*) as c FROM users WHERE department = ?', [d.name]);
    const [supRows] = await this.db.execute('SELECT COUNT(*) as c FROM supervisors WHERE department = ?', [d.name]);
    const [groupRows] = await this.db.execute('SELECT COUNT(*) as c FROM project_groups WHERE department = ?', [d.name]);
    const [workloadRows] = await this.db.execute('SELECT COUNT(*) as c FROM supervisor_workload WHERE department = ?', [d.name]);

    const userCount = Number((userRows as any[])[0]?.c ?? 0);
    const supCount = Number((supRows as any[])[0]?.c ?? 0);
    const groupCount = Number((groupRows as any[])[0]?.c ?? 0);
    const workloadCount = Number((workloadRows as any[])[0]?.c ?? 0);

    if (userCount > 0 || supCount > 0 || groupCount > 0 || workloadCount > 0) {
      const parts = [];
      if (userCount > 0) parts.push(`${userCount} user(s)`);
      if (supCount > 0) parts.push(`${supCount} supervisor(s)`);
      if (groupCount > 0) parts.push(`${groupCount} group(s)`);
      if (workloadCount > 0) parts.push(`${workloadCount} uploaded supervisor(s)`);
      return { ok: false, error: `Cannot delete: ${d.name} has ${parts.join(', ')}. Remove or reassign them first.` };
    }

    await this.db.execute('DELETE FROM admin_departments WHERE department_id = ?', [id]);
    await this.db.execute('DELETE FROM departments WHERE id = ?', [id]);
    return { ok: true };
  }

  /** Build SQL WHERE clause for department filter. Returns [sql, params] or [null, []] if no filter */
  buildDepartmentFilter(
    adminUserId: number,
    departmentColumn: string
  ): Promise<{ sql: string; params: (string | number)[] }> {
    return this.getAdminDepartmentNames(adminUserId).then((names) => {
      if (names === null) return { sql: '', params: [] };
      if (names.length === 0) return { sql: '1=0', params: [] };
      const placeholders = names.map(() => '?').join(',');
      return {
        sql: `${departmentColumn} IN (${placeholders})`,
        params: names,
      };
    });
  }
}
