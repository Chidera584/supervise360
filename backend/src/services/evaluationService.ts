import { Pool } from 'mysql2/promise';

export class EvaluationService {
  constructor(private db: Pool) {}

  async getSupervisorId(userId: number) {
    const [rows] = await this.db.execute(
      'SELECT id FROM supervisors WHERE user_id = ? LIMIT 1',
      [userId]
    );
    return (rows as any[])[0]?.id || null;
  }

  async getSupervisorFullName(userId: number) {
    const [rows] = await this.db.execute(
      'SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const u = (rows as any[])[0];
    if (!u) return '';
    return `${(u.first_name || '').trim()} ${(u.last_name || '').trim()}`.replace(/\s+/g, ' ').trim();
  }

  /** Get groups with projects for supervisor - matches by supervisor_name (same as my-groups) */
  async getGroupsWithProjects(userId: number) {
    const fullName = await this.getSupervisorFullName(userId);
    if (!fullName) return [];

    const [groupRows] = await this.db.execute(
      `SELECT pg.id as group_id, pg.name as group_name, p.id as project_id, p.title as project_title
       FROM project_groups pg
       LEFT JOIN projects p ON p.group_id = pg.id
       WHERE TRIM(COALESCE(pg.supervisor_name, '')) = ?
       AND p.id IS NOT NULL`,
      [fullName]
    );
    const groups = groupRows as any[];

    const result = [];
    for (const g of groups) {
      const [evalRows] = await this.db.execute(
        'SELECT id, total_score, grade, feedback, evaluated_at FROM evaluations WHERE project_id = ? AND evaluation_type = ? ORDER BY evaluated_at DESC LIMIT 1',
        [g.project_id, 'internal']
      );
      const ev = (evalRows as any[])[0] || null;
      result.push({
        group_id: g.group_id,
        group_name: g.group_name,
        project_id: g.project_id,
        project_title: g.project_title,
        has_evaluation: !!ev,
        evaluation: ev ? { id: ev.id, total_score: ev.total_score, grade: ev.grade, feedback: ev.feedback, evaluated_at: ev.evaluated_at } : null,
      });
    }
    return result;
  }

  async getPendingEvaluations(supervisorId: number, supervisorUserId: number, supervisorFullName?: string) {
    const [userRows] = await this.db.execute(
      'SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1',
      [supervisorUserId]
    );
    const u = (userRows as any[])[0];
    const fullName = supervisorFullName || (u ? `${(u.first_name || '').trim()} ${(u.last_name || '').trim()}`.replace(/\s+/g, ' ').trim() : '');

    const [rows] = await this.db.execute(
      `SELECT p.id as project_id, p.title, pg.name as group_name
       FROM projects p
       INNER JOIN project_groups pg ON p.group_id = pg.id
       LEFT JOIN evaluations e 
         ON e.project_id = p.id 
         AND e.supervisor_id = ? 
         AND e.evaluation_type = 'internal'
       WHERE e.id IS NULL
       AND (pg.supervisor_id = ? OR TRIM(COALESCE(pg.supervisor_name, '')) = ?)
       ORDER BY pg.name ASC`,
      [supervisorId, supervisorId, fullName]
    );
    return rows as any[];
  }

  async getCompletedEvaluations(supervisorId: number) {
    const [rows] = await this.db.execute(
      `SELECT e.*, p.title as project_title, pg.name as group_name
       FROM evaluations e
       INNER JOIN projects p ON e.project_id = p.id
       INNER JOIN project_groups pg ON p.group_id = pg.id
       WHERE e.supervisor_id = ?
       ORDER BY e.evaluated_at DESC`,
      [supervisorId]
    );
    return rows as any[];
  }

  async submitEvaluation(supervisorId: number, data: any) {
    const totalScore =
      (data.documentation_score || 0) +
      (data.implementation_score || 0) +
      (data.presentation_score || 0) +
      (data.innovation_score || 0);

    const grade = totalScore >= 70 ? 'A' : totalScore >= 60 ? 'B' : totalScore >= 50 ? 'C' : totalScore >= 45 ? 'D' : 'F';

    const [existing] = await this.db.execute(
      `SELECT id FROM evaluations 
       WHERE project_id = ? AND supervisor_id = ? AND evaluation_type = ?`,
      [data.project_id, supervisorId, data.evaluation_type]
    );

    if ((existing as any[]).length > 0) {
      const evalId = (existing as any[])[0].id;
      await this.db.execute(
        `UPDATE evaluations
         SET documentation_score = ?, implementation_score = ?, presentation_score = ?, innovation_score = ?,
             total_score = ?, grade = ?, feedback = ?, strengths = ?, weaknesses = ?, recommendations = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          data.documentation_score || null,
          data.implementation_score || null,
          data.presentation_score || null,
          data.innovation_score || null,
          totalScore,
          grade,
          data.feedback || null,
          data.strengths || null,
          data.weaknesses || null,
          data.recommendations || null,
          evalId
        ]
      );
      return { success: true, id: evalId };
    }

    const [result] = await this.db.execute(
      `INSERT INTO evaluations 
       (project_id, supervisor_id, evaluation_type, documentation_score, implementation_score, presentation_score, innovation_score,
        total_score, grade, feedback, strengths, weaknesses, recommendations, evaluated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        data.project_id,
        supervisorId,
        data.evaluation_type,
        data.documentation_score || null,
        data.implementation_score || null,
        data.presentation_score || null,
        data.innovation_score || null,
        totalScore,
        grade,
        data.feedback || null,
        data.strengths || null,
        data.weaknesses || null,
        data.recommendations || null
      ]
    );

    return { success: true, id: (result as any).insertId };
  }

  async getStudentEvaluation(projectId: number) {
    const [rows] = await this.db.execute(
      `SELECT * FROM evaluations WHERE project_id = ? ORDER BY evaluated_at DESC`,
      [projectId]
    );
    return rows as any[];
  }
}
