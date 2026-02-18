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

  async getPendingProjectsForSupervisor(supervisorName: string) {
    const [rows] = await this.db.execute(
      `SELECT p.id, p.group_id, p.title, p.description, p.objectives, p.methodology, p.expected_outcomes,
              p.status, p.submitted_at, pg.name as group_name
       FROM projects p
       INNER JOIN project_groups pg ON p.group_id = pg.id
       WHERE pg.supervisor_name = ? AND p.status = 'pending'
       ORDER BY p.submitted_at DESC`,
      [supervisorName]
    );
    return rows as any[];
  }

  async isProjectUnderSupervisor(projectId: number, supervisorName: string): Promise<boolean> {
    const [rows] = await this.db.execute(
      `SELECT 1 FROM projects p
       INNER JOIN project_groups pg ON p.group_id = pg.id
       WHERE p.id = ? AND pg.supervisor_name = ?`,
      [projectId, supervisorName]
    );
    return (rows as any[]).length > 0;
  }
}
