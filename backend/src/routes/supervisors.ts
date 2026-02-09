import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { authenticateToken } from '../middleware/auth';
import { SupervisorAssignmentService } from '../services/supervisorAssignmentService';

const router = Router();

export function createSupervisorsRouter(db: Pool) {
  const assignmentService = new SupervisorAssignmentService(db);

  // Get all supervisors workload
  router.get('/workload', authenticateToken, async (req, res) => {
    try {
      const [supervisors] = await db.execute(`
        SELECT 
          id,
          supervisor_name as name,
          department,
          max_groups,
          current_groups,
          is_available,
          (max_groups - current_groups) as available_slots,
          CASE 
            WHEN max_groups > 0 THEN ROUND((current_groups / max_groups) * 100, 2)
            ELSE 0
          END as workload_percentage
        FROM supervisor_workload
        ORDER BY department, supervisor_name
      `);
      
      // Group supervisors by department
      const supervisorsByDepartment: any = {};
      let totalCapacity = 0;
      let totalAssigned = 0;
      let availableSlots = 0;
      
      (supervisors as any[]).forEach(sup => {
        if (!supervisorsByDepartment[sup.department]) {
          supervisorsByDepartment[sup.department] = {
            department: sup.department,
            supervisors: [],
            departmentStats: {
              count: 0,
              totalCapacity: 0,
              totalAssigned: 0,
              availableSlots: 0,
              averageWorkload: 0
            }
          };
        }
        
        supervisorsByDepartment[sup.department].supervisors.push(sup);
        supervisorsByDepartment[sup.department].departmentStats.count++;
        supervisorsByDepartment[sup.department].departmentStats.totalCapacity += sup.max_groups;
        supervisorsByDepartment[sup.department].departmentStats.totalAssigned += sup.current_groups;
        supervisorsByDepartment[sup.department].departmentStats.availableSlots += sup.available_slots;
        
        totalCapacity += sup.max_groups;
        totalAssigned += sup.current_groups;
        availableSlots += sup.available_slots;
      });
      
      // Calculate average workload per department
      Object.values(supervisorsByDepartment).forEach((dept: any) => {
        if (dept.departmentStats.totalCapacity > 0) {
          dept.departmentStats.averageWorkload = Math.round(
            (dept.departmentStats.totalAssigned / dept.departmentStats.totalCapacity) * 100
          );
        }
      });
      
      const totalStats = {
        totalSupervisors: (supervisors as any[]).length,
        totalCapacity,
        totalAssigned,
        availableSlots,
        departments: Object.keys(supervisorsByDepartment).length,
        averageWorkload: totalCapacity > 0 ? Math.round((totalAssigned / totalCapacity) * 100) : 0
      };
      
      res.json({
        success: true,
        data: {
          supervisors: supervisors,
          supervisorsByDepartment,
          totalStats
        }
      });
    } catch (error) {
      console.error('Error fetching supervisor workload:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch supervisor workload' 
      });
    }
  });

  // Upload supervisors data
  router.post('/upload', authenticateToken, async (req, res) => {
    try {
      console.log('🔍 Supervisor upload endpoint called');
      const { supervisors } = req.body;
      console.log('📊 Received supervisors:', supervisors);
      
      if (!supervisors || !Array.isArray(supervisors)) {
        return res.status(400).json({ error: 'Supervisors array is required' });
      }

      const connection = await db.getConnection();
      
      try {
        await connection.beginTransaction();

        // Clear existing supervisors to avoid duplicates
        await connection.execute('DELETE FROM supervisor_workload');
        console.log('🗑️  Cleared existing supervisors');

        // Insert new supervisors
        let insertedCount = 0;
        for (const supervisor of supervisors) {
          console.log('📝 Inserting supervisor:', supervisor);
          await connection.execute(
            `INSERT INTO supervisor_workload (supervisor_name, department, max_groups, current_groups, is_available) 
             VALUES (?, ?, ?, 0, TRUE)`,
            [supervisor.name, supervisor.department, supervisor.maxGroups || 3]
          );
          insertedCount++;
        }

        await connection.commit();
        console.log('✅ Successfully uploaded', insertedCount, 'supervisors');
        
        res.json({ 
          success: true, 
          message: `${supervisors.length} supervisors uploaded successfully` 
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('❌ Error uploading supervisors:', error);
      res.status(500).json({ error: 'Failed to upload supervisors' });
    }
  });

  // Auto-assign supervisors to groups using ASP-based algorithm
  router.post('/auto-assign', authenticateToken, async (req, res) => {
    try {
      console.log('🔍 ASP-based auto-assign supervisors endpoint called');
      
      const result = await assignmentService.assignSupervisorsToGroups();
      
      if (result.success) {
        console.log(`✅ ${result.assignments.length} groups assigned successfully`);
        
        res.json({
          success: true,
          message: result.message,
          assignedCount: result.assignments.length,
          totalGroups: result.assignments.length + result.unassigned.length,
          assignments: result.assignments,
          unassigned: result.unassigned
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          unassigned: result.unassigned
        });
      }
    } catch (error) {
      console.error('❌ Error auto-assigning supervisors:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to auto-assign supervisors' 
      });
    }
  });

  // Sync supervisor workload from actual assignments
  router.post('/sync-workload', authenticateToken, async (req, res) => {
    try {
      console.log('🔄 Syncing supervisor workload...');
      
      await assignmentService.syncSupervisorWorkload();
      
      res.json({
        success: true,
        message: 'Supervisor workload synced successfully'
      });
    } catch (error) {
      console.error('❌ Error syncing workload:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to sync supervisor workload' 
      });
    }
  });

  // Get workload statistics
  router.get('/stats', authenticateToken, async (req, res) => {
    try {
      const stats = await assignmentService.getSupervisorWorkloadStats();
      res.json(stats);
    } catch (error) {
      console.error('❌ Error fetching stats:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch supervisor statistics' 
      });
    }
  });

  // Validate assignments
  router.get('/validate', authenticateToken, async (req, res) => {
    try {
      const validation = await assignmentService.validateAssignments();
      res.json(validation);
    } catch (error) {
      console.error('❌ Error validating assignments:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to validate assignments' 
      });
    }
  });

  return router;
}