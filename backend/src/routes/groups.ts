import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { GroupFormationService } from '../services/groupFormationService';
import { authenticateToken, requireStudent } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import {
  notifyGroupingAndSupervisor,
  notifyNewStudentAssignment,
} from '../services/notificationEmailService';
import {
  adjustSupervisorWorkload,
  checkSupervisorCap,
  syncSupervisorWorkloadWithConnection,
} from '../services/workloadService';

const router = Router();

export function createGroupsRouter(db: Pool) {
  const groupService = new GroupFormationService(db);

  const resetEvaluationsForDepartment = async (
    connection: any,
    department: string,
    sessionId?: number | null
  ) => {
    const dept = String(department || '').trim();
    if (!dept) return;
    if (sessionId != null) {
      await connection.execute(
        `DELETE e FROM evaluations e
         INNER JOIN projects p ON p.id = e.project_id
         INNER JOIN project_groups pg ON pg.id = p.group_id
         WHERE TRIM(COALESCE(pg.department,'')) = TRIM(?) AND pg.session_id = ?`,
        [dept, sessionId]
      );
      try {
        await connection.execute(
          `DELETE se FROM student_evaluations se
           INNER JOIN project_groups pg ON pg.id = se.group_id
           WHERE TRIM(COALESCE(pg.department,'')) = TRIM(?) AND pg.session_id = ?`,
          [dept, sessionId]
        );
      } catch {
        /* */
      }
      return;
    }
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

      const group = await groupService.getGroupForStudentUser(userId);

      if (!group) {
        console.log('⚠️ /groups/my-group: no group found for user', userId);
        return res.json({
          success: true,
          data: null,
          message: 'No group assigned yet. Groups are typically formed by your department admin.'
        });
      }
      console.log('✅ /groups/my-group: group found', { id: group.id, name: group.name });

      let supervisorEmail: string | null = null;
      let supervisorPhone: string | null = null;
      if (group.supervisor && group.department) {
        try {
          const [cw] = await db.execute(
            `SELECT email, phone FROM supervisor_workload
             WHERE TRIM(supervisor_name) = TRIM(?) AND TRIM(COALESCE(department,'')) = TRIM(?)
             LIMIT 1`,
            [group.supervisor, group.department]
          );
          const cr = (cw as any[])[0];
          if (cr) {
            supervisorEmail = cr.email ?? null;
            supervisorPhone = cr.phone ?? null;
          }
        } catch {
          /* */
        }
      }

      res.json({
        success: true,
        data: {
          id: group.id,
          name: group.name,
          sessionId: group.session_id,
          members: group.members.map(m => ({
            name: m.name,
            matricNumber: (m as any).matricNumber,
            email: (m as any).email ?? null,
            phone: (m as any).phone ?? null,
          })),
          supervisor: group.supervisor,
          supervisorEmail,
          supervisorPhone,
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
      let groups = await groupService.getAllGroups();
      const sessionId = req.query.sessionId ? Number(req.query.sessionId) : NaN;
      if (!Number.isNaN(sessionId)) {
        groups = groups.filter((g) => Number((g as any).session_id) === sessionId);
      }
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
      const { students, department, sessionId: sessionIdRaw } = req.body;
      
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

      const sessionId = Number(sessionIdRaw);
      if (!sessionIdRaw || Number.isNaN(sessionId)) {
        return res.status(400).json({
          success: false,
          error: 'sessionId is required',
          message: 'sessionId is required (academic session / cohort)',
        });
      }
      const [sessRows] = await db.execute('SELECT id FROM academic_sessions WHERE id = ?', [sessionId]);
      if ((sessRows as any[]).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid sessionId',
          message: 'The selected academic session does not exist.',
        });
      }

      // Clear existing groups for this department so we get a clean formation (no duplicates)
      const deptToClear = department || students[0]?.department;
      if (deptToClear) {
        // Reset evaluations for this department before regrouping.
        const connection = await db.getConnection();
        try {
          await connection.beginTransaction();
          await resetEvaluationsForDepartment(connection, deptToClear, sessionId);
          await connection.commit();
        } catch (e) {
          await connection.rollback();
          throw e;
        } finally {
          connection.release();
        }
        await groupService.clearGroupsForDepartment(deptToClear, sessionId);
        console.log('🧹 [GROUPS/FORM] Cleared existing groups for department:', deptToClear, 'session:', sessionId);
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
      const groupIds = await groupService.saveGroupsToDatabase(groups, sessionId);
      
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
      let supervisorChanged = false;
      
      try {
        await connection.beginTransaction();

        const [pgRows] = await connection.execute(
          'SELECT supervisor_name, department FROM project_groups WHERE id = ? FOR UPDATE',
          [groupId]
        );
        const pgRow = (pgRows as any[])[0];
        if (!pgRow) {
          await connection.rollback();
          return res.status(404).json({
            success: false,
            error: 'Group not found',
            message: 'Group not found',
          });
        }

        const oldSup = pgRow.supervisor_name ? String(pgRow.supervisor_name).trim() : '';
        const dept = String(pgRow.department || '').trim();
        const newSup = String(supervisorName).trim();

        if (oldSup !== newSup) {
          supervisorChanged = true;
          if (newSup) {
            const cap = await checkSupervisorCap(connection, newSup, dept);
            if (!cap.ok) {
              await connection.rollback();
              return res.status(400).json({ success: false, message: cap.message });
            }
          }

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

          await connection.execute(
            'UPDATE project_groups SET supervisor_name = ?, updated_at = NOW() WHERE id = ?',
            [supervisorName, groupId]
          );

          if (oldSup) {
            await adjustSupervisorWorkload(connection, oldSup, dept, -1);
          }
          if (newSup) {
            await adjustSupervisorWorkload(connection, newSup, dept, 1);
          }
        }

        await connection.commit();

        if (!supervisorChanged) {
          return res.json({ success: true, message: 'Supervisor unchanged' });
        }

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
          const [pgNameRows] = await db.execute('SELECT name FROM project_groups WHERE id = ?', [groupId]);
          const groupName = (pgNameRows as any[])[0]?.name || `Group ${groupId}`;
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
          await syncSupervisorWorkloadWithConnection(connection);
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
          await syncSupervisorWorkloadWithConnection(connection);
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