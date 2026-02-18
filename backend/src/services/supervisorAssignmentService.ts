import { Pool } from 'mysql2/promise';

/**
 * ASP-based Supervisor Assignment Service
 * Uses Answer Set Programming principles for optimal supervisor-to-group assignment
 */

export interface SupervisorData {
  id?: number;
  name: string;
  department: string;
  maxGroups: number;
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
  department: string;
}

export class SupervisorAssignmentService {
  constructor(private db: Pool) {}

  /**
   * ASP Rule 1: Each group must have exactly one supervisor
   * ASP Rule 2: Each supervisor can have at most max_groups groups
   * ASP Rule 3: Supervisor and group must be in the same department
   * ASP Rule 4: Distribute workload evenly (minimize variance)
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

      console.log(`📊 Found ${unassignedGroups.length} unassigned groups`);

      if (unassignedGroups.length === 0) {
        await connection.commit();
        return {
          success: true,
          assignments: [],
          unassigned: [],
          message: 'No unassigned groups found'
        };
      }

      // Fetch available supervisors with current workload
      const [supervisorsRows] = await connection.execute(`
        SELECT 
          supervisor_name as name,
          department,
          max_groups as maxGroups,
          current_groups as currentGroups,
          is_available as isAvailable
        FROM supervisor_workload
        WHERE is_available = TRUE
        ORDER BY current_groups ASC, supervisor_name ASC
      `);
      const supervisors = supervisorsRows as SupervisorData[];

      console.log(`📊 Found ${supervisors.length} available supervisors`);

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

        // Update supervisor_workload table (match by name and department)
        await connection.execute(
          `UPDATE supervisor_workload 
           SET current_groups = current_groups + 1, updated_at = NOW() 
           WHERE supervisor_name = ? AND department = ?`,
          [assignment.supervisorName, assignment.department]
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
   * ASP-based optimal assignment algorithm
   * Implements Answer Set Programming constraints:
   * 1. Department matching (hard constraint)
   * 2. Capacity limits (hard constraint)
   * 3. Even workload distribution (soft constraint - optimization)
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

    // Sort groups by department for better locality
    const sortedGroups = [...groups].sort((a, b) => 
      a.department.localeCompare(b.department)
    );

    for (const group of sortedGroups) {
      // Find eligible supervisors for this group
      const eligibleSupervisors = supervisorPool.filter(sup => 
        sup.department === group.department &&
        (sup.currentGroups + sup.assignedInThisRound) < sup.maxGroups &&
        sup.isAvailable
      );

      if (eligibleSupervisors.length === 0) {
        console.warn(`⚠️  No eligible supervisor for ${group.name} in ${group.department}`);
        continue;
      }

      // ASP Optimization: Select supervisor with minimum current load
      // This minimizes workload variance across supervisors
      eligibleSupervisors.sort((a, b) => {
        const loadA = a.currentGroups + a.assignedInThisRound;
        const loadB = b.currentGroups + b.assignedInThisRound;
        
        if (loadA !== loadB) {
          return loadA - loadB; // Prefer less loaded supervisor
        }
        
        // Tie-breaker: prefer supervisor with higher capacity
        if (a.maxGroups !== b.maxGroups) {
          return b.maxGroups - a.maxGroups;
        }
        
        // Final tie-breaker: alphabetical
        return a.name.localeCompare(b.name);
      });

      const selectedSupervisor = eligibleSupervisors[0];
      
      assignments.push({
        groupId: group.id,
        groupName: group.name,
        supervisorName: selectedSupervisor.name,
        department: group.department
      });

      selectedSupervisor.assignedInThisRound++;
      
      console.log(`📋 ASP Assignment: ${group.name} → ${selectedSupervisor.name} (load: ${selectedSupervisor.currentGroups + selectedSupervisor.assignedInThisRound}/${selectedSupervisor.maxGroups})`);
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

      // Get actual group counts per supervisor (by name and department)
      const [actualCounts] = await connection.execute(`
        SELECT 
          supervisor_name,
          department,
          COUNT(*) as actual_count
        FROM project_groups
        WHERE supervisor_name IS NOT NULL AND supervisor_name != ''
        GROUP BY supervisor_name, department
      `);

      // Reset all supervisor counts to 0
      await connection.execute(`
        UPDATE supervisor_workload 
        SET current_groups = 0
      `);

      // Update with actual counts (match by name and department)
      for (const row of actualCounts as any[]) {
        const [result] = await connection.execute(
          `UPDATE supervisor_workload 
           SET current_groups = ? 
           WHERE supervisor_name = ? AND department = ?`,
          [row.actual_count, row.supervisor_name, row.department || '']
        );
        const affected = (result as any).affectedRows;
        if (affected > 0) {
          console.log(`✅ Synced ${row.supervisor_name} (${row.department}): ${row.actual_count} groups`);
        } else {
          console.warn(`⚠️ No supervisor_workload row for ${row.supervisor_name} in ${row.department} - assignment exists in project_groups but not in workload table`);
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
      maxGroups: number;
      availableSlots: number;
      workloadPercentage: number;
    }>;
    totalGroups: number;
    assignedGroups: number;
    unassignedGroups: number;
  }> {
    const connection = await this.db.getConnection();

    try {
      // Get supervisor stats
      const [supervisorsRows] = await connection.execute(`
        SELECT 
          supervisor_name as name,
          department,
          current_groups as currentGroups,
          max_groups as maxGroups,
          (max_groups - current_groups) as availableSlots,
          ROUND((current_groups / max_groups) * 100, 2) as workloadPercentage
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

      // Check 2: No supervisor exceeds max capacity
      const [overloadedSupervisors] = await connection.execute(`
        SELECT supervisor_name, current_groups, max_groups
        FROM supervisor_workload
        WHERE current_groups > max_groups
      `);

      for (const sup of overloadedSupervisors as any[]) {
        violations.push(
          `Supervisor ${sup.supervisor_name} is overloaded: ${sup.current_groups}/${sup.max_groups} groups`
        );
      }

      // Check 3: Department matching
      const [mismatchedDepts] = await connection.execute(`
        SELECT g.id, g.name, g.department as group_dept, s.department as sup_dept
        FROM project_groups g
        JOIN supervisor_workload s ON g.supervisor_name = s.supervisor_name
        WHERE g.department != s.department
      `);

      for (const mismatch of mismatchedDepts as any[]) {
        violations.push(
          `Group ${mismatch.name} (${mismatch.group_dept}) assigned to supervisor in different department (${mismatch.sup_dept})`
        );
      }

      // Check 4: Workload sync
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
