import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { GroupFormationService } from '../services/groupFormationService';
import { authenticateToken, requireStudent } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import {
  notifyGroupingAndSupervisor,
  notifyNewStudentAssignment,
} from '../services/notificationEmailService';

const router = Router();

export function createGroupsRouter(db: Pool) {
  const groupService = new GroupFormationService(db);

  const resetEvaluationsForDepartment = async (connection: any, department: string) => {
    const dept = String(department || '').trim();
    if (!dept) return;
    // Reset project-level and student-level evaluations tied to groups in this department.
    await connection.execute(
      `DELETE e FROM evaluations e
       INNER JOIN projects p ON p.id = e.project_id
       INNER JOIN project_groups pg ON pg.id = p.group_id
       WHERE TRIM(COALESCE(pg.department,'')) = TRIM(?)`,
      [dept]
    );
    try {
      await connection.execute(
        `DELETE se FROM student_evaluations se
         INNER JOIN project_groups pg ON pg.id = se.group_id
         WHERE TRIM(COALESCE(pg.department,'')) = TRIM(?)`,
        [dept]
      );
    } catch {
      // student_evaluations may not exist in older environments
    }
  };

  // Get current student's group by matric number (student only, real-time data)
  router.get('/my-group', authenticateToken, requireStudent, async (req, res) => {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      console.log('🔍 /groups/my-group called for user:', userId);
      const [studentRows] = await db.execute(
        `SELECT s.matric_number, COALESCE(NULLIF(TRIM(u.department), ''), '') as department
         FROM students s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.user_id = ?`,
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
      const studentDepartment = students[0].department || '';
      console.log('🔍 /groups/my-group matric number:', matricNumber);
      const group = await groupService.getGroupByMatricNumber(matricNumber, studentDepartment);

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

      // Clear existing groups for this department so we get a clean formation (no duplicates)
      const deptToClear = department || students[0]?.department;
      if (deptToClear) {
        // Reset evaluations for this department before regrouping.
        const connection = await db.getConnection();
        try {
          await connection.beginTransaction();
          await resetEvaluationsForDepartment(connection, deptToClear);
          await connection.commit();
        } catch (e) {
          await connection.rollback();
          throw e;
        } finally {
          connection.release();
        }
        await groupService.clearGroupsForDepartment(deptToClear);
        console.log('🧹 [GROUPS/FORM] Cleared existing groups for department:', deptToClear);
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
      const err = error as Error;
      console.error('Error forming groups:', err);
      res.status(500).json({ 
        success: false,
        error: err.message || 'Failed to form groups',
        message: err.message || 'Failed to form groups'
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

        // Reset evaluations for this group when supervisor changes.
        await connection.execute(
          `DELETE e FROM evaluations e
           INNER JOIN projects p ON p.id = e.project_id
           WHERE p.group_id = ?`,
          [groupId]
        );
        try {
          await connection.execute('DELETE FROM student_evaluations WHERE group_id = ?', [groupId]);
        } catch {
          // student_evaluations may not exist in older environments
        }

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

        // Notify students (grouping + supervisor) and supervisor (new assignment)
        const [memberRows] = await db.execute(
          'SELECT gm.matric_number, gm.student_name FROM group_members gm WHERE gm.group_id = ?',
          [groupId]
        );
        const members = (memberRows as any[]);
        const studentUserIds: number[] = [];
        const studentEmails: string[] = [];
        const studentNames: string[] = [];
        for (const m of members) {
          let uid: number | undefined;
          const matric = m.matric_number ? String(m.matric_number).trim() : null;
          if (matric) {
            const [sRows] = await db.execute(
              'SELECT user_id FROM students WHERE matric_number = ? OR TRIM(matric_number) = ? OR REPLACE(matric_number, "/", "") = REPLACE(?, "/", "")',
              [matric, matric, matric]
            );
            uid = (sRows as any[])[0]?.user_id;
          }
          if (!uid && m.student_name) {
            const name = String(m.student_name).trim();
            const parts = name.split(/[\s,]+/).filter(Boolean);
            const firstPart = parts[0] || '';
            const lastPart = parts[parts.length - 1] || firstPart;
            const [uRows] = await db.execute(
              `SELECT u.id FROM users u INNER JOIN students s ON s.user_id = u.id
               WHERE TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) = ?
                  OR (u.first_name LIKE ? AND u.last_name LIKE ?)
                  OR (u.last_name LIKE ? AND u.first_name LIKE ?)
               LIMIT 1`,
              [name, `%${firstPart}%`, `%${lastPart}%`, `%${firstPart}%`, `%${lastPart}%`]
            );
            uid = (uRows as any[])[0]?.id;
          }
          if (uid) {
            const [uRows] = await db.execute('SELECT first_name, last_name, email FROM users WHERE id = ?', [uid]);
            const u = (uRows as any[])[0];
            if (u) {
              studentUserIds.push(uid);
              studentEmails.push(u.email || '');
              studentNames.push(`${u.first_name || ''} ${u.last_name || ''}`.trim() || m.student_name);
            }
          }
        }
        if (studentUserIds.length > 0) {
          const [pgRows] = await db.execute('SELECT name FROM project_groups WHERE id = ?', [groupId]);
          const groupName = (pgRows as any[])[0]?.name || `Group ${groupId}`;
          notifyGroupingAndSupervisor(db, studentUserIds, studentEmails, studentNames, groupName, supervisorName).catch(() => {});
        }

        // Notify supervisor
        const sn = String(supervisorName).trim().replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Engr\.?)\s+/i, '');
        const [supRows] = await db.execute(
          `SELECT u.id, u.email, u.first_name, u.last_name FROM users u
           INNER JOIN supervisors s ON s.user_id = u.id
           WHERE ? LIKE CONCAT('%', TRIM(u.first_name), '%') AND ? LIKE CONCAT('%', TRIM(u.last_name), '%') LIMIT 1`,
          [sn, sn]
        );
        const supUser = (supRows as any[])[0];
        if (supUser) {
          const supFullName = `${supUser.first_name || ''} ${supUser.last_name || ''}`.trim();
          const studentCount = studentNames.length;
          const groupCount = 1;
          notifyNewStudentAssignment(db, supUser.id, supUser.email, supFullName, studentCount, groupCount).catch(() => {});
        }

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

  // Clear groups (department-specific when provided)
  router.delete('/clear', authenticateToken, async (req, res) => {
    try {
      const department = String((req.query.department as string) || '').trim();
      const connection = await db.getConnection();
      
      try {
        await connection.beginTransaction();

        if (department) {
          await resetEvaluationsForDepartment(connection, department);
          // Clear members/groups for selected department only
          await connection.execute(
            `DELETE gm FROM group_members gm
             INNER JOIN project_groups pg ON pg.id = gm.group_id
             WHERE TRIM(COALESCE(pg.department,'')) = TRIM(?)`,
            [department]
          );
          await connection.execute(
            'DELETE FROM projects WHERE group_id IN (SELECT id FROM (SELECT id FROM project_groups WHERE TRIM(COALESCE(department,\'\')) = TRIM(?)) t)',
            [department]
          );
          await connection.execute(
            'DELETE FROM project_groups WHERE TRIM(COALESCE(department,\'\')) = TRIM(?)',
            [department]
          );
          // Recompute workload globally from remaining assignments
          await connection.execute('UPDATE supervisor_workload SET current_groups = 0, updated_at = NOW()');
          await connection.execute(
            `UPDATE supervisor_workload sw
             INNER JOIN (
               SELECT supervisor_name, COUNT(*) as c
               FROM project_groups
               WHERE supervisor_name IS NOT NULL AND supervisor_name <> ''
               GROUP BY supervisor_name
             ) x ON x.supervisor_name = sw.supervisor_name
             SET sw.current_groups = x.c, sw.updated_at = NOW()`
          );
        } else {
          // Legacy behavior: clear all departments
          await connection.execute('DELETE FROM evaluations');
          try {
            await connection.execute('DELETE FROM student_evaluations');
          } catch {
            // student_evaluations may not exist in older environments
          }
          await connection.execute('DELETE FROM group_members');
          await connection.execute('DELETE FROM projects');
          await connection.execute('DELETE FROM project_groups');
          await connection.execute('UPDATE supervisor_workload SET current_groups = 0, updated_at = NOW()');
        }

        await connection.commit();
        
        res.json({
          success: true,
          message: department
            ? `Groups cleared for ${department}`
            : 'All groups cleared successfully'
        });
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