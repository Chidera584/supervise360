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

  async listPendingReviews(supervisorUserId: number) {
    const [supRows] = await this.db.execute(
      'SELECT id FROM supervisors WHERE user_id = ? LIMIT 1',
      [supervisorUserId]
    );
    const supervisorId = (supRows as any[])[0]?.id;

    // Match by supervisor_id OR by supervisor_name (users first_name + last_name) for name-based assignment
    const [rows] = await this.db.execute(
      `SELECT r.*, pg.name as group_name, p.title as project_title
       FROM reports r
       INNER JOIN projects p ON r.project_id = p.id
       INNER JOIN project_groups pg ON p.group_id = pg.id
       WHERE r.reviewed = FALSE
       AND (
         pg.supervisor_id = ?
         OR pg.supervisor_name = (SELECT TRIM(CONCAT(IFNULL(first_name,''), ' ', IFNULL(last_name,''))) FROM users WHERE id = ?)
       )
       ORDER BY r.submitted_at ASC`,
      [supervisorId, supervisorUserId]
    );
    return rows as any[];
  }

  async reviewReport(reportId: number, reviewerId: number, comments: string, approved: boolean) {
    await this.db.execute(
      `UPDATE reports 
       SET reviewed = ?, reviewed_by = ?, reviewed_at = NOW(), review_comments = ?
       WHERE id = ?`,
      [approved ? 1 : 1, reviewerId, comments, reportId]
    );
  }

  async deleteReport(reportId: number, userId: number) {
    await this.db.execute(
      'DELETE FROM reports WHERE id = ? AND submitted_by = ?',
      [reportId, userId]
    );
  }
}
