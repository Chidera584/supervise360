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

  async getPendingEvaluations(supervisorId: number, supervisorUserId: number) {
    const [rows] = await this.db.execute(
      `SELECT p.id as project_id, p.title, pg.name as group_name
       FROM projects p
       INNER JOIN project_groups pg ON p.group_id = pg.id
       LEFT JOIN evaluations e 
         ON e.project_id = p.id 
         AND e.supervisor_id = ? 
         AND e.evaluation_type = 'internal'
       WHERE e.id IS NULL
       AND (pg.supervisor_id = ? OR pg.supervisor_name IN (
         SELECT CONCAT(u.first_name, ' ', u.last_name)
         FROM users u WHERE u.id = ?
       ))
       ORDER BY p.submitted_at DESC`,
      [supervisorId, supervisorId, supervisorUserId]
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
