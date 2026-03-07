import { Pool } from 'mysql2/promise';

export class AdminService {
  constructor(private db: Pool) {}

  /** Dashboard stats use institutional data (uploaded CSV) - group_members, supervisor_workload.
   * Does NOT use users/students/supervisors - those are for registered accounts (Users page only). */
  async getDashboardStats() {
    const [studentRows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM group_members'
    ) as any;
    const totalStudents = Number(studentRows[0]?.count ?? 0);

    const [groupRows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM project_groups'
    ) as any;
    const totalGroups = groupRows[0]?.count ?? 0;

    const [workloadRows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM supervisor_workload'
    ) as any;
    const totalSupervisors = Number(workloadRows?.[0]?.count ?? 0);

    const [projectRows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM projects'
    ) as any;
    const totalProjects = projectRows[0]?.count ?? 0;

    const [pendingRows] = await this.db.execute(
      "SELECT COUNT(*) as count FROM projects WHERE status = 'pending'"
    ) as any;
    const pendingProjects = pendingRows[0]?.count ?? 0;

    const [approvedRows] = await this.db.execute(
      "SELECT COUNT(*) as count FROM projects WHERE status = 'approved'"
    ) as any;
    const approvedProjects = approvedRows[0]?.count ?? 0;

    const [completedRows] = await this.db.execute(
      "SELECT COUNT(*) as count FROM projects WHERE status = 'completed'"
    ) as any;
    const completedProjects = completedRows[0]?.count ?? 0;

    const [reportRows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM reports'
    ) as any;
    const reportsSubmitted = reportRows[0]?.count ?? 0;

    const [unreviewedRows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM reports WHERE reviewed = FALSE'
    ) as any;
    const unreviewedReports = unreviewedRows[0]?.count ?? 0;

    const [defenseRows] = await this.db.execute(
      "SELECT COUNT(*) as count FROM defense_panels WHERE status = 'scheduled'"
    ) as any;
    const scheduledDefenses = defenseRows[0]?.count ?? 0;

    const [assignedRows] = await this.db.execute(
      "SELECT COUNT(*) as count FROM project_groups WHERE supervisor_name IS NOT NULL AND supervisor_name <> ''"
    ) as any;
    const groupsWithSupervisor = assignedRows[0]?.count ?? 0;

    const [gpaRows] = await this.db.execute(
      `SELECT gpa_tier, COUNT(*) as count
       FROM group_members
       GROUP BY gpa_tier`
    );

    const gpaDistribution = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    (gpaRows as any[]).forEach(row => {
      if (row.gpa_tier && gpaDistribution[row.gpa_tier as 'HIGH' | 'MEDIUM' | 'LOW'] !== undefined) {
        gpaDistribution[row.gpa_tier as 'HIGH' | 'MEDIUM' | 'LOW'] = row.count;
      }
    });

    return {
      totals: {
        students: totalStudents,
        groups: totalGroups,
        supervisors: totalSupervisors,
        projects: totalProjects
      },
      projectStatus: {
        pending: pendingProjects,
        approved: approvedProjects,
        completed: completedProjects
      },
      reports: {
        submitted: reportsSubmitted,
        unreviewed: unreviewedReports
      },
      defenses: {
        scheduled: scheduledDefenses
      },
      supervisorsAllocated: groupsWithSupervisor,
      gpaDistribution
    };
  }

  async getAnalyticsStats() {
    const [totalGroupRows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM project_groups'
    ) as any;
    const totalGroups = totalGroupRows[0]?.count ?? 0;
    const [tierCounts] = await this.db.execute(
      `SELECT group_id,
              SUM(CASE WHEN gpa_tier = 'HIGH' THEN 1 ELSE 0 END) as high_count,
              SUM(CASE WHEN gpa_tier = 'MEDIUM' THEN 1 ELSE 0 END) as medium_count,
              SUM(CASE WHEN gpa_tier = 'LOW' THEN 1 ELSE 0 END) as low_count
       FROM group_members
       GROUP BY group_id`
    );

    let idealGroups = 0;
    (tierCounts as any[]).forEach(row => {
      if (row.high_count >= 1 && row.medium_count >= 1 && row.low_count >= 1) {
        idealGroups += 1;
      }
    });

    const [projectCountRows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM projects'
    ) as any;
    const totalProjects = projectCountRows[0]?.count ?? 0;

    const [submittedRows] = await this.db.execute(
      "SELECT COUNT(*) as count FROM projects WHERE status IN ('pending','approved','in_progress','completed')"
    ) as any;
    const projectsSubmitted = submittedRows[0]?.count ?? 0;

    const [reportCountRows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM reports'
    ) as any;
    const totalReports = reportCountRows[0]?.count ?? 0;

    const [reviewedRows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM reports WHERE reviewed = TRUE'
    ) as any;
    const reviewedReports = reviewedRows[0]?.count ?? 0;

    const [supervisorWorkload] = await this.db.execute(
      `SELECT supervisor_name, department, current_groups
       FROM supervisor_workload
       ORDER BY department, supervisor_name`
    );

    return {
      systemPerformance: {
        totalGroups,
        totalProjects,
        projectsSubmitted,
        totalReports,
        reviewedReports
      },
      groupingQuality: {
        idealGroups,
        fallbackGroups: Math.max(totalGroups - idealGroups, 0)
      },
      supervisorWorkload
    };
  }
}
