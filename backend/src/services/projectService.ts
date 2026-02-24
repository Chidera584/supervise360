import { Pool } from 'mysql2/promise';

export class ProjectService {
  constructor(private db: Pool) {}

  async getProjectByGroupId(groupId: number) {
    const [rows] = await this.db.execute(
      'SELECT * FROM projects WHERE group_id = ? LIMIT 1',
      [groupId]
    );
    return (rows as any[])[0] || null;
  }

  async submitProject(groupId: number, data: any) {
    const existing = await this.getProjectByGroupId(groupId);
    if (existing && existing.status !== 'rejected') {
      return { success: false, message: 'Project already submitted' };
    }

    if (existing && existing.status === 'rejected') {
      await this.db.execute(
        `UPDATE projects 
         SET title = ?, description = ?, objectives = ?, methodology = ?, expected_outcomes = ?, 
             status = 'pending', rejection_reason = NULL, submitted_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [
          data.title,
          data.description || null,
          data.objectives || null,
          data.methodology || null,
          data.expected_outcomes || null,
          existing.id
        ]
      );
      return { success: true, projectId: existing.id };
    }

    try {
      const [result] = await this.db.execute(
        `INSERT INTO projects 
         (group_id, title, description, objectives, methodology, expected_outcomes, status, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [
          groupId,
          data.title,
          data.description || null,
          data.objectives || null,
          data.methodology || null,
          data.expected_outcomes || null
        ]
      );
      return { success: true, projectId: (result as any).insertId };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('foreign key') || msg.includes('Foreign key')) {
        return { success: false, message: 'Database schema issue: projects table may reference wrong groups table. Run: node backend/fix-projects-table.cjs' };
      }
      if (msg.includes("doesn't exist")) {
        return { success: false, message: 'Projects table missing. Run: node backend/fix-projects-table.cjs' };
      }
      throw err;
    }
  }

  async updateProject(projectId: number, data: any) {
    const [rows] = await this.db.execute(
      'SELECT status FROM projects WHERE id = ? LIMIT 1',
      [projectId]
    );
    const project = (rows as any[])[0];
    if (!project) return { success: false, message: 'Project not found' };

    if (project.status !== 'pending') {
      return { success: false, message: 'Only pending projects can be updated' };
    }

    await this.db.execute(
      `UPDATE projects 
       SET title = ?, description = ?, objectives = ?, methodology = ?, expected_outcomes = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        data.title,
        data.description || null,
        data.objectives || null,
        data.methodology || null,
        data.expected_outcomes || null,
        projectId
      ]
    );

    return { success: true };
  }

  async approveProject(projectId: number) {
    await this.db.execute(
      `UPDATE projects 
       SET status = 'approved', approved_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [projectId]
    );
  }

  async rejectProject(projectId: number, reason: string) {
    await this.db.execute(
      `UPDATE projects 
       SET status = 'rejected', rejection_reason = ?, updated_at = NOW()
       WHERE id = ?`,
      [reason]
    );
  }

  /** Get group IDs for a supervisor - same flexible matching as my-groups and report reviews */
  async getSupervisorGroupIds(supervisorUserId: number): Promise<number[]> {
    const [userRows] = await this.db.execute(
      'SELECT first_name, last_name FROM users WHERE id = ?',
      [supervisorUserId]
    );
    const user = (userRows as any[])[0];
    const firstName = (user?.first_name || '').trim();
    const lastName = (user?.last_name || '').trim();
    const fullName = `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
    if (!fullName && !firstName && !lastName) return [];

    const params: any[] = [fullName, fullName];
    if (firstName && lastName) params.push(firstName, lastName);
    const bothClause = firstName && lastName
      ? "OR (supervisor_name LIKE CONCAT('%', ?, '%') AND supervisor_name LIKE CONCAT('%', ?, '%'))"
      : '';
    const [rows] = await this.db.execute(
      `SELECT id FROM project_groups
       WHERE TRIM(COALESCE(supervisor_name, '')) = ? OR supervisor_name LIKE CONCAT('%', ?, '%') ${bothClause}`,
      params
    );
    return (rows as any[]).map((r: any) => r.id);
  }

  async getPendingProjectsForSupervisor(supervisorUserId: number) {
    const groupIds = await this.getSupervisorGroupIds(supervisorUserId);
    if (groupIds.length === 0) return [];

    const placeholders = groupIds.map(() => '?').join(',');
    const [rows] = await this.db.execute(
      `SELECT p.id, p.group_id, p.title, p.description, p.objectives, p.methodology, p.expected_outcomes,
              p.status, p.submitted_at, p.rejection_reason, pg.name as group_name
       FROM projects p
       INNER JOIN project_groups pg ON p.group_id = pg.id
       WHERE p.group_id IN (${placeholders}) AND p.status = 'pending'
       ORDER BY p.submitted_at DESC`,
      groupIds
    );
    return rows as any[];
  }

  async getAllProjectsForSupervisor(supervisorUserId: number) {
    const groupIds = await this.getSupervisorGroupIds(supervisorUserId);
    if (groupIds.length === 0) return [];

    const placeholders = groupIds.map(() => '?').join(',');
    const [rows] = await this.db.execute(
      `SELECT p.id, p.group_id, p.title, p.description, p.objectives, p.methodology, p.expected_outcomes,
              p.status, p.submitted_at, p.rejection_reason, p.approved_at, pg.name as group_name
       FROM projects p
       INNER JOIN project_groups pg ON p.group_id = pg.id
       WHERE p.group_id IN (${placeholders})
       ORDER BY CASE p.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, p.submitted_at DESC`,
      groupIds
    );
    return rows as any[];
  }

  async clearProjectByGroupId(groupId: number): Promise<{ success: boolean; message?: string }> {
    const [rows] = await this.db.execute(
      'SELECT id, status FROM projects WHERE group_id = ? LIMIT 1',
      [groupId]
    );
    const project = (rows as any[])[0];
    if (!project) return { success: false, message: 'No project to clear' };
    if (project.status === 'approved') {
      return { success: false, message: 'Cannot clear an approved project' };
    }
    await this.db.execute('DELETE FROM projects WHERE group_id = ?', [groupId]);
    return { success: true };
  }

  async isProjectUnderSupervisor(projectId: number, supervisorUserId: number): Promise<boolean> {
    const groupIds = await this.getSupervisorGroupIds(supervisorUserId);
    if (groupIds.length === 0) return false;
    const placeholders = groupIds.map(() => '?').join(',');
    const [rows] = await this.db.execute(
      `SELECT 1 FROM projects WHERE id = ? AND group_id IN (${placeholders})`,
      [projectId, ...groupIds]
    );
    return (rows as any[]).length > 0;
  }
}
