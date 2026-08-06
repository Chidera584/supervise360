import { Pool } from 'mysql2/promise';
import { logger } from '../logger';

export class ReportService {
  constructor(private db: Pool) {}

  async getGroupIdByMatric(matricNumber: string, department?: string) {
    const raw = String(matricNumber || '').trim();
    if (!raw) return null;
    const compact = raw.replace(/\s+/g, '');
    const compactNoSlash = compact.replace(/\//g, '');
    const dept = String(department || '').trim();
    const [rows] = await this.db.execute(
      `SELECT gm.group_id
       FROM group_members gm
       INNER JOIN project_groups pg ON pg.id = gm.group_id
       WHERE (
         gm.matric_number = ?
         OR TRIM(COALESCE(gm.matric_number, '')) = ?
         OR REPLACE(TRIM(COALESCE(gm.matric_number, '')), ' ', '') = ?
         OR REPLACE(REPLACE(TRIM(COALESCE(gm.matric_number, '')), ' ', ''), '/', '') = ?
       )
       AND (? = '' OR TRIM(COALESCE(pg.department,'')) = TRIM(?))
       ORDER BY gm.group_id DESC
       LIMIT 1`,
      [raw, raw, compact, compactNoSlash, dept, dept]
    );
    return (rows as any[])[0]?.group_id || null;
  }

  /**
   * Get project ID for a group. If no project exists, auto-create one so students can submit reports
   * without having to submit a project proposal first.
   */
  async getProjectIdByGroup(groupId: number): Promise<number | null> {
    const [rows] = await this.db.execute(
      'SELECT id FROM projects WHERE group_id = ? LIMIT 1',
      [groupId]
    );
    const existing = (rows as any[])[0]?.id;
    if (existing) return existing;

    // Auto-create project so report submission works (group has supervisor but no project yet)
    const [pgRows] = await this.db.execute(
      'SELECT name FROM project_groups WHERE id = ? LIMIT 1',
      [groupId]
    );
    const groupName = (pgRows as any[])[0]?.name || `Group ${groupId}`;
    try {
      const [result] = await this.db.execute(
        `INSERT INTO projects (group_id, title, description, status, submitted_at)
         VALUES (?, ?, ?, 'pending', NOW())`,
        [groupId, `Project for ${groupName}`, 'Auto-created for report submission.']
      );
      return (result as any).insertId ?? null;
    } catch (err) {
      logger.error('Auto-create project failed for group', groupId, (err as Error).message);
      return null;
    }
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

  /**
   * Get group IDs for a supervisor - same logic as my-groups endpoint. Prefers the reliable
   * supervisor_user_id link; falls back to fuzzy name matching only for groups that haven't
   * been ID-linked yet (see IdLinkingService), so two supervisors with similar names can't
   * cross-wire once linked.
   */
  async getSupervisorGroupIds(supervisorUserId: number): Promise<number[]> {
    const [userRows] = await this.db.execute(
      'SELECT first_name, last_name, COALESCE(NULLIF(TRIM(department), \'\'), \'\') as department FROM users WHERE id = ?',
      [supervisorUserId]
    );
    const user = (userRows as any[])[0];
    const firstName = (user?.first_name || '').trim();
    const lastName = (user?.last_name || '').trim();
    const fullName = `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
    const userDepartment = String(user?.department || '').trim();
    if (!fullName && !firstName && !lastName) return [];

    const params: any[] = [supervisorUserId, fullName, fullName];
    if (firstName && lastName) params.push(firstName, lastName);
    const bothClause = firstName && lastName
      ? "OR (supervisor_name LIKE CONCAT('%', ?, '%') AND supervisor_name LIKE CONCAT('%', ?, '%'))"
      : '';
    const [rows] = await this.db.execute(
      `SELECT id FROM project_groups
       WHERE (
         supervisor_user_id = ?
         OR (supervisor_user_id IS NULL AND (TRIM(COALESCE(supervisor_name, '')) = ? OR supervisor_name LIKE CONCAT('%', ?, '%') ${bothClause}))
       )
         AND (? = '' OR TRIM(COALESCE(department,'')) = TRIM(?))`,
      [...params, userDepartment, userDepartment]
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

  /**
   * True if userId may view/review this report: the student who submitted it, any member
   * of the report's group, the group's assigned supervisor, or an admin.
   */
  async userCanAccessReport(reportId: number, userId: number, role: string): Promise<boolean> {
    if (role === 'admin') return true;

    const [reportRows] = await this.db.execute(
      'SELECT submitted_by, group_id FROM reports WHERE id = ?',
      [reportId]
    );
    const report = (reportRows as any[])[0];
    if (!report) return false;
    if (Number(report.submitted_by) === Number(userId)) return true;
    if (!report.group_id) return false;

    if (role === 'supervisor' || role === 'external_supervisor') {
      const groupIds = await this.getSupervisorGroupIds(userId);
      return groupIds.includes(Number(report.group_id));
    }

    // Student: allowed if they're a member of the report's group (same matric matching
    // used across the app for group membership - see groupFormationService).
    const [studentRows] = await this.db.execute(
      'SELECT matric_number FROM students WHERE user_id = ?',
      [userId]
    );
    const matric = (studentRows as any[])[0]?.matric_number;
    if (!matric) return false;
    const raw = String(matric).trim();
    const compact = raw.replace(/\s+/g, '');
    const compactNoSlash = compact.replace(/\//g, '');
    const [memberRows] = await this.db.execute(
      `SELECT 1 FROM group_members
       WHERE group_id = ?
         AND (
           matric_number = ?
           OR TRIM(COALESCE(matric_number, '')) = ?
           OR REPLACE(TRIM(COALESCE(matric_number, '')), ' ', '') = ?
           OR REPLACE(REPLACE(TRIM(COALESCE(matric_number, '')), ' ', ''), '/', '') = ?
         )
       LIMIT 1`,
      [report.group_id, raw, raw, compact, compactNoSlash]
    );
    return (memberRows as any[]).length > 0;
  }

  async reviewReport(reportId: number, reviewerId: number, comments: string, approved: boolean) {
    await this.db.execute(
      `UPDATE reports 
       SET reviewed = 1, reviewed_by = ?, reviewed_at = NOW(), review_comments = ?, approved = ?
       WHERE id = ?`,
      [reviewerId, comments, approved ? 1 : 0, reportId]
    );
  }

  /** Deletes only if the caller is the submitter. Returns false if not found or not owned. */
  async deleteReport(reportId: number, userId: number): Promise<boolean> {
    const [result] = await this.db.execute(
      'DELETE FROM reports WHERE id = ? AND submitted_by = ?',
      [reportId, userId]
    );
    return ((result as any).affectedRows ?? 0) > 0;
  }
}
