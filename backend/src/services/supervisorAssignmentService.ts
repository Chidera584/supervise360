import { Pool } from 'mysql2/promise';

/**
 * ASP-based Supervisor Assignment Service
 * Uses Answer Set Programming principles for optimal supervisor-to-group assignment
 */

export interface SupervisorData {
  id?: number;
  name: string;
  department: string;
  currentGroups: number;
  isAvailable: boolean;
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
  async assignSupervisorsToGroups(): Promise<{
    success: boolean;
    assignments: AssignmentResult[];
    unassigned: GroupData[];
    message: string;
  }> {
    const connection = await this.db.getConnection();

    try {
      await connection.beginTransaction();

      // Fetch unassigned groups
      const [unassignedGroupsRows] = await connection.execute(`
        SELECT id, name, department 
        FROM project_groups 
        WHERE supervisor_name IS NULL OR supervisor_name = ''
        ORDER BY id ASC
      `);
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
          COALESCE(is_available, TRUE) as isAvailable
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

      // Apply ASP-based assignment algorithm
      const assignments = this.computeOptimalAssignment(unassignedGroups, supervisors);

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
   * Optimal assignment: no capacity limit. Always assign to the supervisor
   * with the fewest groups in the same department. This minimizes variance;
   * when uneven is unavoidable (odd groups, dept size), some get more than others.
   */
  private computeOptimalAssignment(
    groups: GroupData[],
    supervisors: SupervisorData[]
  ): AssignmentResult[] {
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
      const eligibleSupervisors = supervisorPool.filter(
        s => (s.department || '').trim() === (group.department || '').trim()
      );
      if (eligibleSupervisors.length === 0) {
        console.warn(`⚠️  No supervisor in department "${group.department}" for ${group.name}`);
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

      console.log('🔄 Syncing supervisor workload...');

      // Get actual group counts per supervisor (by name only - supervisors can have groups from any dept)
      const [actualCounts] = await connection.execute(`
        SELECT 
          supervisor_name,
          COUNT(*) as actual_count
        FROM project_groups
        WHERE supervisor_name IS NOT NULL AND supervisor_name != ''
        GROUP BY supervisor_name
      `);

      // Reset all supervisor counts to 0
      await connection.execute(`
        UPDATE supervisor_workload 
        SET current_groups = 0
      `);

      // Update with actual counts (match by supervisor name - each supervisor has one row)
      for (const row of actualCounts as any[]) {
        const [result] = await connection.execute(
          `UPDATE supervisor_workload 
           SET current_groups = ? 
           WHERE supervisor_name = ?`,
          [row.actual_count, row.supervisor_name]
        );
        const affected = (result as any).affectedRows;
        if (affected > 0) {
          console.log(`✅ Synced ${row.supervisor_name}: ${row.actual_count} groups`);
        } else {
          console.warn(`⚠️ No supervisor_workload row for ${row.supervisor_name} - assignment exists in project_groups but not in workload table`);
        }
      }

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
          current_groups as currentGroups
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

      // Check 2: Workload sync
      const [syncCheck] = await connection.execute(`
        SELECT 
          s.supervisor_name,
          s.current_groups as recorded_count,
          COUNT(g.id) as actual_count
        FROM supervisor_workload s
        LEFT JOIN project_groups g ON s.supervisor_name = g.supervisor_name
        GROUP BY s.supervisor_name
        HAVING recorded_count != actual_count
      `);

      for (const sync of syncCheck as any[]) {
        violations.push(
          `Supervisor ${sync.supervisor_name} workload out of sync: recorded=${sync.recorded_count}, actual=${sync.actual_count}`
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
