import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { GroupFormationService } from '../services/groupFormationService';
import { authenticateToken, requireStudent } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

export function createGroupsRouter(db: Pool) {
  const groupService = new GroupFormationService(db);

  // Get current student's group by matric number (student only, real-time data)
  router.get('/my-group', authenticateToken, requireStudent, async (req, res) => {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      console.log('🔍 /groups/my-group called for user:', userId);
      const [studentRows] = await db.execute(
        'SELECT matric_number FROM students WHERE user_id = ?',
        [userId]
      );
      const students = studentRows as any[];
      console.log('🔍 /groups/my-group student lookup:', students);
      if (students.length === 0 || !students[0].matric_number) {
        return res.json({
          success: true,
          data: null,
          message: 'No group assigned. Your matric number may not be linked to a group yet.'
        });
      }

      const matricNumber = students[0].matric_number;
      console.log('🔍 /groups/my-group matric number:', matricNumber);
      const group = await groupService.getGroupByMatricNumber(matricNumber);

      if (!group) {
        console.log('⚠️ /groups/my-group: no group found for matric', matricNumber);
        return res.json({
          success: true,
          data: null,
          message: 'No group assigned yet. Groups are typically formed by your department admin.'
        });
      }
      console.log('✅ /groups/my-group: group found', { id: group.id, name: group.name });

      res.json({
        success: true,
        data: {
          id: group.id,
          name: group.name,
          members: group.members.map(m => ({
            name: m.name,
            matricNumber: (m as any).matricNumber
          })),
          supervisor: group.supervisor,
          department: group.department,
          status: group.status
        }
      });
    } catch (error) {
      console.error('Error fetching student group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch your group'
      });
    }
  });

  // Get all groups
  router.get('/', authenticateToken, async (req, res) => {
    try {
      console.log('🔍 Groups endpoint called');
      const groups = await groupService.getAllGroups();
      console.log('✅ Groups fetched successfully:', groups.length);
      
      // Return in the expected API format
      res.json({
        success: true,
        data: groups,
        message: `Found ${groups.length} groups`
      });
    } catch (error) {
      console.error('❌ Error fetching groups:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch groups',
        message: 'Failed to fetch groups'
      });
    }
  });

  // Form groups from uploaded student data
  router.post('/form', authenticateToken, async (req, res) => {
    try {
      const { students, department } = req.body;
      
      console.log('📥 [GROUPS/FORM] Received request to form groups');
      console.log('   - Students count:', students?.length || 0);
      console.log('   - Department:', department || 'not specified');
      
      if (!students || !Array.isArray(students)) {
        return res.status(400).json({ 
          success: false,
          error: 'Students array is required',
          message: 'Students array is required'
        });
      }

      // Process student data with department for threshold lookup
      // This will fetch fresh thresholds from database
      console.log('🔄 [GROUPS/FORM] Processing students with department:', department);
      const processedStudents = await groupService.processStudentData(students, department);
      
      // Form groups using ASP algorithm
      console.log('🔄 [GROUPS/FORM] Forming groups using ASP algorithm');
      const groups = await groupService.formGroupsUsingASP(processedStudents, department);
      
      // Validate formation
      const validation = groupService.validateGroupFormation(groups);
      if (!validation.isValid) {
        return res.status(400).json({ 
          success: false,
          error: 'Group formation validation failed', 
          message: 'Group formation validation failed',
          violations: validation.violations 
        });
      }

      // Save to database
      const groupIds = await groupService.saveGroupsToDatabase(groups);
      
      // Return formed groups with IDs
      const groupsWithIds = groups.map((group, index) => ({
        ...group,
        id: groupIds[index]
      }));

      res.json({
        success: true,
        data: {
          groups: groupsWithIds,
          statistics: groupService.calculateGroupStatistics(groups)
        },
        message: `Successfully formed ${groupsWithIds.length} groups`
      });
    } catch (error) {
      console.error('Error forming groups:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to form groups',
        message: 'Failed to form groups'
      });
    }
  });

  // Assign supervisor to group
  router.put('/:groupId/supervisor', authenticateToken, async (req, res) => {
    try {
      const { groupId } = req.params;
      const { supervisorName } = req.body;

      if (!supervisorName) {
        return res.status(400).json({ 
          success: false,
          error: 'Supervisor name is required',
          message: 'Supervisor name is required'
        });
      }

      const connection = await db.getConnection();
      
      try {
        await connection.beginTransaction();

        // Update group with supervisor
        await connection.execute(
          'UPDATE project_groups SET supervisor_name = ?, updated_at = NOW() WHERE id = ?',
          [supervisorName, groupId]
        );

        // Update supervisor workload
        await connection.execute(
          'UPDATE supervisor_workload SET current_groups = current_groups + 1, updated_at = NOW() WHERE supervisor_name = ?',
          [supervisorName]
        );

        await connection.commit();
        
        res.json({ success: true, message: 'Supervisor assigned successfully' });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error assigning supervisor:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to assign supervisor',
        message: 'Failed to assign supervisor'
      });
    }
  });

  // Clear all groups (admin only)
  router.delete('/clear', authenticateToken, async (req, res) => {
    try {
      const connection = await db.getConnection();
      
      try {
        await connection.beginTransaction();

        // Clear group members first (foreign key constraint)
        await connection.execute('DELETE FROM group_members');
        
        // Clear groups
        await connection.execute('DELETE FROM project_groups');
        
        // Reset supervisor workload
        await connection.execute('UPDATE supervisor_workload SET current_groups = 0, updated_at = NOW()');

        await connection.commit();
        
        res.json({ success: true, message: 'All groups cleared successfully' });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error clearing groups:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to clear groups',
        message: 'Failed to clear groups'
      });
    }
  });

  return router;
}