import { Pool } from 'mysql2/promise';

const CREATE_STUDENT_EVALUATIONS_SQL = `
CREATE TABLE IF NOT EXISTS student_evaluations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_user_id INT NOT NULL,
  supervisor_id INT NOT NULL,
  group_id INT NULL,
  project_id INT NULL,
  documentation_score INT NULL,
  implementation_score INT NULL,
  presentation_score INT NULL,
  innovation_score INT NULL,
  total_score INT NOT NULL,
  grade VARCHAR(2) NULL,
  feedback TEXT NULL,
  strengths TEXT NULL,
  weaknesses TEXT NULL,
  recommendations TEXT NULL,
  evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_student (student_user_id),
  INDEX idx_supervisor (supervisor_id)
) ENGINE=InnoDB`;

export class EvaluationService {
  constructor(private db: Pool) {}

  private async ensureStudentEvaluationsTable() {
    try {
      await this.db.execute(CREATE_STUDENT_EVALUATIONS_SQL);
    } catch (e) {
      // Ignore if already exists or limited permissions in certain environments
      console.warn('student_evaluations ensureTable warning:', (e as Error).message);
    }
  }

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

  /**
   * Get all students under a supervisor, with evaluation status for each.
   * Used to build the supervisor's Evaluation page.
   */
  async getStudentsForSupervisor(userId: number) {
    await this.ensureStudentEvaluationsTable();
    const fullName = await this.getSupervisorFullName(userId);
    const supervisorId = await this.getSupervisorId(userId);
    if (!fullName) return [];

    const [nameRows] = await this.db.execute(
      'SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const nameUser = (nameRows as any[])[0];
    const firstName = (nameUser?.first_name || '').trim();
    const lastName = (nameUser?.last_name || '').trim();
    const bothClause =
      firstName && lastName
        ? " OR (pg.supervisor_name LIKE CONCAT('%', ?, '%') AND pg.supervisor_name LIKE CONCAT('%', ?, '%'))"
        : '';
    const supervisorIdParam = supervisorId ?? -1;
    const params: any[] = [supervisorIdParam, supervisorIdParam, fullName, fullName];
    if (firstName && lastName) params.push(firstName, lastName);

    const [rows] = await this.db.execute(
      `SELECT 
         u.id as student_user_id,
         CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')) as student_name,
         s.matric_number,
         pg.id as group_id,
         pg.name as group_name,
         p.id as project_id,
         se.id as evaluation_id,
         se.total_score,
         se.evaluated_at
       FROM project_groups pg
       INNER JOIN group_members gm ON gm.group_id = pg.id
       INNER JOIN users u 
         ON u.role = 'student' AND COALESCE(u.is_active, TRUE) = TRUE
       INNER JOIN students s
         ON s.user_id = u.id
        AND (
          s.matric_number = gm.matric_number
          OR TRIM(COALESCE(s.matric_number, '')) = TRIM(COALESCE(gm.matric_number, ''))
          OR REPLACE(COALESCE(s.matric_number, ''), '/', '') = REPLACE(COALESCE(gm.matric_number, ''), '/', '')
          OR TRIM(COALESCE(gm.student_name, '')) = TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))
          OR gm.student_name LIKE CONCAT('%', COALESCE(u.first_name, ''), '%', COALESCE(u.last_name, ''), '%')
          OR gm.student_name LIKE CONCAT('%', COALESCE(u.last_name, ''), '%', COALESCE(u.first_name, ''), '%')
        )
       LEFT JOIN projects p ON p.group_id = pg.id
       LEFT JOIN student_evaluations se 
         ON se.student_user_id = u.id AND se.supervisor_id = ?
       WHERE (
         pg.supervisor_id = ?
         OR TRIM(COALESCE(pg.supervisor_name, '')) = ?
         OR pg.supervisor_name LIKE CONCAT('%', ?, '%')
         ${bothClause}
       )
       ORDER BY pg.name ASC, u.last_name ASC, u.first_name ASC`,
      params
    );
    return rows as any[];
  }

  /**
   * Create or update an individual student's evaluation for a supervisor.
   * Scores are interpreted as:
   * - documentation_score: project quality (0–20)
   * - implementation_score: individual contribution (0–20)
   * - presentation_score: overall performance (0–10)
   * - innovation_score: participation (0–10)
   * Total is out of 60.
   */
  async submitStudentEvaluation(supervisorId: number, data: any) {
    await this.ensureStudentEvaluationsTable();
    const totalScore =
      (data.documentation_score || 0) +
      (data.implementation_score || 0) +
      (data.presentation_score || 0) +
      (data.innovation_score || 0);

    const studentUserId = Number(data.student_user_id);
    const groupId = data.group_id ? Number(data.group_id) : null;
    const projectId = data.project_id ? Number(data.project_id) : null;

    const [existing] = await this.db.execute(
      `SELECT id FROM student_evaluations 
       WHERE student_user_id = ? AND supervisor_id = ? LIMIT 1`,
      [studentUserId, supervisorId]
    );

    if ((existing as any[]).length > 0) {
      const evalId = (existing as any[])[0].id;
      await this.db.execute(
        `UPDATE student_evaluations
         SET documentation_score = ?, implementation_score = ?, presentation_score = ?, innovation_score = ?,
             total_score = ?, feedback = ?, strengths = ?, weaknesses = ?, recommendations = ?, 
             group_id = ?, project_id = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          data.documentation_score || null,
          data.implementation_score || null,
          data.presentation_score || null,
          data.innovation_score || null,
          totalScore,
          data.feedback || null,
          data.strengths || null,
          data.weaknesses || null,
          data.recommendations || null,
          groupId,
          projectId,
          evalId
        ]
      );
      return { success: true, id: evalId };
    }

    const [result] = await this.db.execute(
      `INSERT INTO student_evaluations 
       (student_user_id, supervisor_id, group_id, project_id, documentation_score, implementation_score, presentation_score, innovation_score,
        total_score, feedback, strengths, weaknesses, recommendations, evaluated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        studentUserId,
        supervisorId,
        groupId,
        projectId,
        data.documentation_score || null,
        data.implementation_score || null,
        data.presentation_score || null,
        data.innovation_score || null,
        totalScore,
        data.feedback || null,
        data.strengths || null,
        data.weaknesses || null,
        data.recommendations || null
      ]
    );

    return { success: true, id: (result as any).insertId };
  }

  /**
   * Get the latest individual evaluation for a student (by user id).
   */
  async getStudentSelfEvaluation(userId: number) {
    await this.ensureStudentEvaluationsTable();
    const [rows] = await this.db.execute(
      `SELECT 
         id,
         'supervisor_evaluation' as evaluation_type,
         documentation_score,
         implementation_score,
         presentation_score,
         innovation_score,
         total_score,
         feedback,
         strengths,
         weaknesses,
         recommendations,
         evaluated_at
       FROM student_evaluations
       WHERE student_user_id = ?
       ORDER BY evaluated_at DESC
       LIMIT 1`,
      [userId]
    );
    return (rows as any[])[0] || null;
  }

  /**
   * Student-facing view: confirms evaluation exists but hides scores, grades, and rubric fields.
   */
  async getStudentSelfEvaluationPublic(userId: number) {
    const row = await this.getStudentSelfEvaluation(userId);
    if (!row) return null;
    return {
      id: row.id,
      evaluation_received: true,
      evaluated_at: row.evaluated_at,
    };
  }
}
