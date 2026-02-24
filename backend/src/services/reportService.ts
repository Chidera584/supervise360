import { Pool } from 'mysql2/promise';

export class ReportService {
  constructor(private db: Pool) {}

  async getGroupIdByMatric(matricNumber: string) {
    const [rows] = await this.db.execute(
      'SELECT group_id FROM group_members WHERE matric_number = ? LIMIT 1',
      [matricNumber]
    );
    return (rows as any[])[0]?.group_id || null;
  }

  async getProjectIdByGroup(groupId: number) {
    const [rows] = await this.db.execute(
      'SELECT id FROM projects WHERE group_id = ? LIMIT 1',
      [groupId]
    );
    return (rows as any[])[0]?.id || null;
  }

  async listMyReports(userId: number) {
    const [rows] = await this.db.execute(
      `SELECT r.*, p.title as project_title
       FROM reports r
       LEFT JOIN projects p ON r.project_id = p.id
       WHERE r.submitted_by = ?
       ORDER BY r.submitted_at DESC`,
      [userId]
    );
    return rows as any[];
  }

  /** Get group IDs for a supervisor - same logic as my-groups endpoint */
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

  async listPendingReviews(supervisorUserId: number) {
    const groupIds = await this.getSupervisorGroupIds(supervisorUserId);
    if (groupIds.length === 0) return [];

    const placeholders = groupIds.map(() => '?').join(',');
    const [rows] = await this.db.execute(
      `SELECT r.*, pg.name as group_name, p.title as project_title
       FROM reports r
       LEFT JOIN projects p ON r.project_id = p.id
       LEFT JOIN project_groups pg ON r.group_id = pg.id
       WHERE (r.reviewed = FALSE OR r.reviewed = 0 OR r.reviewed IS NULL)
       AND r.group_id IN (${placeholders})
       ORDER BY r.submitted_at ASC`,
      groupIds
    );
    return rows as any[];
  }

  async reviewReport(reportId: number, reviewerId: number, comments: string, approved: boolean) {
    await this.db.execute(
      `UPDATE reports 
       SET reviewed = 1, reviewed_by = ?, reviewed_at = NOW(), review_comments = ?, approved = ?
       WHERE id = ?`,
      [reviewerId, comments, approved ? 1 : 0, reportId]
    );
  }

  async deleteReport(reportId: number, userId: number) {
    await this.db.execute(
      'DELETE FROM reports WHERE id = ? AND submitted_by = ?',
      [reportId, userId]
    );
  }
}
