import { Pool } from 'mysql2/promise';
import { trySupervisorAssignmentWithClingo } from './asp/aspEncodings';
import { syncSupervisorWorkloadWithConnection } from './workloadService';

/**
 * Supervisor assignment: uses Potassco Clingo (answer set programming) when available to minimize
 * peak supervisor load; otherwise greedy same-department load balancing.
 */

export interface SupervisorData {
  id?: number;
  name: string;
  department: string;
  currentGroups: number;
  isAvailable: boolean;
  /** When set, auto-assign will not exceed this many groups in this department row */
  maxGroups?: number | null;
}

export interface GroupData {
  id: number;
  name: string;
  department: string;
  supervisorName?: string | null;
}

export interface AssignmentResult {
  groupId: number;
  groupName: string;
  supervisorName: string;
  supervisorDepartment: string; // supervisor's dept (for workload table lookup)
}

export class SupervisorAssignmentService {
  constructor(private db: Pool) {}

  /**
   * Assignment rules:
   * 1. Each group gets exactly one supervisor
   * 2. Supervisor and group must be in the same department
   * 3. No limit on groups per supervisor - distribute as evenly as possible.
   *    When uneven is unavoidable (e.g. 7 groups, 3 supervisors → 2,2,3), that's allowed.
   */
  async assignSupervisorsToGroups(department?: string): Promise<{
    success: boolean;
    assignments: AssignmentResult[];
    unassigned: GroupData[];
    message: string;
  }> {
    const connection = await this.db.getConnection();

    try {
      await connection.beginTransaction();

      const deptFilter = String(department || '').trim();
      // Fetch unassigned groups (optionally department-scoped)
      const [unassignedGroupsRows] = await connection.execute(
        `SELECT id, name, department
         FROM project_groups
         WHERE (supervisor_name IS NULL OR supervisor_name = '')
           AND (? = '' OR TRIM(COALESCE(department,'')) = TRIM(?))
         ORDER BY id ASC`,
        [deptFilter, deptFilter]
      );
      const unassignedGroups = unassignedGroupsRows as GroupData[];

      console.log(`📊 [Assign v2 - no limit] Found ${unassignedGroups.length} unassigned groups`);

      if (unassignedGroups.length === 0) {
        await connection.commit();
        return {
          success: true,
          assignments: [],
          unassigned: [],
          message: 'No unassigned groups found'
        };
      }

      // Fetch all supervisors (no capacity limit; include all regardless of is_available)
      const [supervisorsRows] = await connection.execute(`
        SELECT 
          supervisor_name as name,
          department,
          current_groups as currentGroups,
          COALESCE(is_available, TRUE) as isAvailable,
          max_groups as maxGroups
        FROM supervisor_workload
        ORDER BY current_groups ASC, supervisor_name ASC
      `);
      const supervisors = supervisorsRows as SupervisorData[];

      console.log(`📊 [Assign v2 - no limit] Found ${supervisors.length} supervisors (all used, no capacity limit)`);

      if (supervisors.length === 0) {
        await connection.rollback();
        return {
          success: false,
          assignments: [],
          unassigned: unassignedGroups,
          message: 'No available supervisors found'
        };
      }

      const assignments = await this.computeOptimalAssignment(unassignedGroups, supervisors);

      console.log(`✅ Computed ${assignments.length} assignments`);

      // Apply assignments to database
      for (const assignment of assignments) {
        // Update project_groups table
        await connection.execute(
          `UPDATE project_groups 
           SET supervisor_name = ?, updated_at = NOW() 
           WHERE id = ?`,
          [assignment.supervisorName, assignment.groupId]
        );

        // Update supervisor_workload table
        await connection.execute(
          `UPDATE supervisor_workload 
           SET current_groups = current_groups + 1, updated_at = NOW() 
           WHERE supervisor_name = ? AND department = ?`,
          [assignment.supervisorName, assignment.supervisorDepartment]
        );

        console.log(`✅ Assigned ${assignment.supervisorName} to ${assignment.groupName}`);
      }

      await connection.commit();

      const stillUnassigned = unassignedGroups.filter(
        g => !assignments.find(a => a.groupId === g.id)
      );

      return {
        success: true,
        assignments,
        unassigned: stillUnassigned,
        message: `Successfully assigned ${assignments.length} groups to supervisors`
      };

    } catch (error) {
      await connection.rollback();
      console.error('❌ Error in supervisor assignment:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Prefer Potassco Clingo (answer set programming): minimize maximum total load per supervisor
   * subject to same-department eligibility. Falls back to greedy load balancing if Clingo is unavailable.
   */
  private async computeOptimalAssignment(
    groups: GroupData[],
    supervisors: SupervisorData[]
  ): Promise<AssignmentResult[]> {
    const anyCap = supervisors.some((s) => s.maxGroups != null);
    const asp = anyCap ? null : await trySupervisorAssignmentWithClingo(groups, supervisors);
    if (asp) return asp;

    const assignments: AssignmentResult[] = [];
    
    // Create a working copy of supervisors to track assignments
    const supervisorPool = supervisors.map(s => ({
      ...s,
      assignedInThisRound: 0
    }));

    // Sort groups by id for consistent ordering
    const sortedGroups = [...groups].sort((a, b) => a.id - b.id);

    for (const group of sortedGroups) {
      // Only supervisors from the SAME department can be assigned to this group
      let eligibleSupervisors = supervisorPool.filter(
        s => (s.department || '').trim() === (group.department || '').trim()
      );
      eligibleSupervisors = eligibleSupervisors.filter((s) => {
        const cap = s.maxGroups;
        if (cap == null) return true;
        return s.currentGroups + s.assignedInThisRound < cap;
      });
      if (eligibleSupervisors.length === 0) {
        console.warn(`⚠️  No supervisor in department "${group.department}" for ${group.name} (or all at capacity)`);
        continue;
      }

      // Select supervisor with minimum current load (spread evenly)
      eligibleSupervisors.sort((a, b) => {
        const loadA = a.currentGroups + a.assignedInThisRound;
        const loadB = b.currentGroups + b.assignedInThisRound;
        if (loadA !== loadB) return loadA - loadB;
        return a.name.localeCompare(b.name);
      });

      const selectedSupervisor = eligibleSupervisors[0];
      
      assignments.push({
        groupId: group.id,
        groupName: group.name,
        supervisorName: selectedSupervisor.name,
        supervisorDepartment: selectedSupervisor.department
      });

      selectedSupervisor.assignedInThisRound++;
      
      const newLoad = selectedSupervisor.currentGroups + selectedSupervisor.assignedInThisRound;
      console.log(`📋 Assignment: ${group.name} → ${selectedSupervisor.name} (${newLoad} groups)`);
    }

    return assignments;
  }

  /**
   * Sync supervisor workload from actual group assignments
   * This fixes any inconsistencies between project_groups and supervisor_workload
   */
  async syncSupervisorWorkload(): Promise<void> {
    const connection = await this.db.getConnection();

    try {
      await connection.beginTransaction();

      console.log('🔄 Syncing supervisor workload (per department)...');
      await syncSupervisorWorkloadWithConnection(connection);

      await connection.commit();
      console.log('✅ Supervisor workload sync completed');

    } catch (error) {
      await connection.rollback();
      console.error('❌ Error syncing supervisor workload:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get supervisor workload statistics
   */
  async getSupervisorWorkloadStats(): Promise<{
    supervisors: Array<{
      name: string;
      department: string;
      currentGroups: number;
    }>;
    totalGroups: number;
    assignedGroups: number;
    unassignedGroups: number;
  }> {
    const connection = await this.db.getConnection();

    try {
      // Get supervisor stats (no max capacity - workload spread evenly)
      const [supervisorsRows] = await connection.execute(`
        SELECT 
          supervisor_name as name,
          department,
          current_groups as currentGroups,
          max_groups as maxGroups
        FROM supervisor_workload
        ORDER BY department, supervisor_name
      `);

      // Get group counts
      const [groupStats] = await connection.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN supervisor_name IS NOT NULL AND supervisor_name != '' THEN 1 ELSE 0 END) as assigned,
          SUM(CASE WHEN supervisor_name IS NULL OR supervisor_name = '' THEN 1 ELSE 0 END) as unassigned
        FROM project_groups
      `);

      const stats = (groupStats as any[])[0];

      return {
        supervisors: supervisorsRows as any[],
        totalGroups: stats.total,
        assignedGroups: stats.assigned,
        unassignedGroups: stats.unassigned
      };

    } finally {
      connection.release();
    }
  }

  /**
   * Validate assignment constraints (ASP constraint checking)
   */
  async validateAssignments(): Promise<{
    isValid: boolean;
    violations: string[];
  }> {
    const connection = await this.db.getConnection();
    const violations: string[] = [];

    try {
      // Check 1: Every group has at most one supervisor
      const [duplicateAssignments] = await connection.execute(`
        SELECT id, name, supervisor_name
        FROM project_groups
        WHERE supervisor_name IS NOT NULL 
        GROUP BY id
        HAVING COUNT(DISTINCT supervisor_name) > 1
      `);

      if ((duplicateAssignments as any[]).length > 0) {
        violations.push('Some groups have multiple supervisors assigned');
      }

      // Check 2: Workload sync (per supervisor_name + department)
      const [syncCheck] = await connection.execute(`
        SELECT 
          s.supervisor_name,
          s.department,
          s.current_groups as recorded_count,
          COALESCE(COUNT(g.id), 0) as actual_count
        FROM supervisor_workload s
        LEFT JOIN project_groups g ON g.supervisor_name = s.supervisor_name
          AND TRIM(COALESCE(g.department,'')) = TRIM(COALESCE(s.department,''))
        GROUP BY s.id, s.supervisor_name, s.department, s.current_groups
        HAVING recorded_count != actual_count
      `);

      for (const sync of syncCheck as any[]) {
        violations.push(
          `Supervisor ${sync.supervisor_name} (${sync.department}) workload out of sync: recorded=${sync.recorded_count}, actual=${sync.actual_count}`
        );
      }

      return {
        isValid: violations.length === 0,
        violations
      };

    } finally {
      connection.release();
    }
  }
}
