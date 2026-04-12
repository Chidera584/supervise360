import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { authenticateToken, requireAdmin, requireSupervisor } from '../middleware/auth';
import { SupervisorAssignmentService } from '../services/supervisorAssignmentService';
import { AuthenticatedRequest } from '../types';
import {
  notifyGroupingAndSupervisor,
  notifyNewStudentAssignment,
} from '../services/notificationEmailService';
import { isEmailConfigured } from '../services/emailService';

const router = Router();

export function createSupervisorsRouter(db: Pool) {
  const assignmentService = new SupervisorAssignmentService(db);

  const resetEvaluationsForGroupIds = async (connection: any, groupIds: number[]) => {
    if (!groupIds.length) return;
    const placeholders = groupIds.map(() => '?').join(',');
    await connection.execute(
      `DELETE e FROM evaluations e
       INNER JOIN projects p ON p.id = e.project_id
       WHERE p.group_id IN (${placeholders})`,
      groupIds
    );
    try {
      await connection.execute(
        `DELETE FROM student_evaluations WHERE group_id IN (${placeholders})`,
        groupIds
      );
    } catch {
      // student_evaluations may not exist in older environments
    }
  };

  // Get supervisor's assigned groups with real data (project, reports, members)
  router.get('/my-groups', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    console.log('[my-groups] Request received for user:', req.user?.id);
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

      const [userRows] = await db.execute(
        'SELECT first_name, last_name FROM users WHERE id = ?',
        [userId]
      );
      const user = (userRows as any[])[0];
      const fullName = user ? `${(user.first_name || '')} ${(user.last_name || '')}`.trim().replace(/\s+/g, ' ') : '';
      if (!fullName) {
        console.log('[my-groups] No user or name for userId:', userId);
        return res.json({ success: true, data: [] });
      }

      // Match by name (trim both sides to handle DB whitespace)
      const [groupRows] = await db.execute(
        `SELECT id, name, department, status, avg_gpa, supervisor_name, created_at
         FROM project_groups
         WHERE TRIM(COALESCE(supervisor_name, '')) = ?
         ORDER BY name ASC`,
        [fullName]
      );
      const groups = groupRows as any[];

      const result = await Promise.all(groups.map(async (g) => {
        const [memberRows] = await db.execute(
          `SELECT id, student_name, student_gpa, gpa_tier, matric_number, member_order
           FROM group_members WHERE group_id = ? ORDER BY member_order ASC`,
          [g.id]
        );
        const members = (memberRows as any[]).map(m => ({
          id: m.id,
          name: m.student_name,
          gpa: m.student_gpa,
          tier: m.gpa_tier,
          matricNumber: m.matric_number
        }));

        const [projectRows] = await db.execute(
          'SELECT id, title, status, progress_percentage, submitted_at FROM projects WHERE group_id = ? LIMIT 1',
          [g.id]
        );
        const project = (projectRows as any[])[0] || null;

        const [reportCounts] = await db.execute(
          `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN reviewed = TRUE THEN 1 ELSE 0 END) as reviewed
           FROM reports r
           INNER JOIN projects p ON r.project_id = p.id
           WHERE p.group_id = ?`,
          [g.id]
        );
        const counts = (reportCounts as any[])[0] || { total: 0, reviewed: 0 };
        const totalReports = Number(counts.total) || 0;
        const reportsReviewed = Number(counts.reviewed) || 0;
        const reportsPending = totalReports - reportsReviewed;

        return {
          id: g.id,
          name: g.name,
          department: g.department,
          status: g.status || 'formed',
          avg_gpa: g.avg_gpa,
          supervisor: g.supervisor_name,
          members,
          project: project ? {
            id: project.id,
            title: project.title,
            status: project.status,
            progress_percentage: project.progress_percentage,
            submitted_at: project.submitted_at
          } : null,
          reportsTotal: totalReports,
          reportsReviewed,
          reportsPending
        };
      }));

      console.log('[my-groups] Returning', result.length, 'groups for', fullName);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('[my-groups] Error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch your groups' });
    }
  });

  // Get all supervisors workload
  router.get('/workload', authenticateToken, async (req, res) => {
    try {
      const [supervisors] = await db.execute(`
        SELECT 
          id,
          supervisor_name as name,
          department,
          current_groups,
          max_groups,
          email,
          phone,
          is_available
        FROM supervisor_workload
        ORDER BY department, supervisor_name
      `);
      
      // Group supervisors by department (normalize key by trim so all departments aggregate correctly)
      const supervisorsByDepartment: any = {};
      let totalAssigned = 0;
      
      (supervisors as any[]).forEach(sup => {
        const deptKey = (sup.department || '').trim() || '(Unassigned)';
        if (!supervisorsByDepartment[deptKey]) {
          supervisorsByDepartment[deptKey] = {
            department: deptKey === '(Unassigned)' ? '' : deptKey,
            supervisors: [],
            departmentStats: {
              count: 0,
              totalAssigned: 0
            }
          };
        }
        
        supervisorsByDepartment[deptKey].supervisors.push(sup);
        supervisorsByDepartment[deptKey].departmentStats.count++;
        supervisorsByDepartment[deptKey].departmentStats.totalAssigned += sup.current_groups || 0;
        
        totalAssigned += sup.current_groups || 0;
      });
      
      const totalStats = {
        totalSupervisors: (supervisors as any[]).length,
        totalAssigned,
        departments: Object.keys(supervisorsByDepartment).length
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

        // Get unique departments in this upload - only replace supervisors from THESE departments
        const departmentsInUpload = [...new Set(
          supervisors
            .map((s: any) => (s.department || '').trim())
            .filter((d: string) => d.length > 0)
        )];
        
        if (departmentsInUpload.length === 0) {
          await connection.rollback();
          return res.status(400).json({ error: 'No valid department found in upload. Ensure CSV has a Department column with values.' });
        }

        // Delete only supervisors from departments in this upload (keeps other departments intact)
        // Also clear supervisor assignments from groups in those departments (avoid orphaned refs)
        for (const dept of departmentsInUpload) {
          await connection.execute(
            'UPDATE project_groups SET supervisor_name = NULL WHERE department = ?',
            [dept]
          );
          const [delResult] = await connection.execute(
            'DELETE FROM supervisor_workload WHERE department = ?',
            [dept]
          );
          const deleted = (delResult as any).affectedRows || 0;
          console.log(`🗑️  Cleared ${deleted} existing supervisors for department: ${dept}`);
        }

        // Insert new supervisors
        let insertedCount = 0;
        for (const supervisor of supervisors) {
          const name = (supervisor.name || '').trim();
          const department = (supervisor.department || '').trim();
          if (!name || !department) {
            console.warn('⚠️  Skipping row with missing name or department:', supervisor);
            continue;
          }
          const email = supervisor.email != null ? String(supervisor.email).trim() || null : null;
          const phone = supervisor.phone != null ? String(supervisor.phone).trim() || null : null;
          await connection.execute(
            `INSERT INTO supervisor_workload (supervisor_name, email, phone, department, current_groups, is_available) 
             VALUES (?, ?, ?, ?, 0, TRUE)`,
            [name, email, phone, department]
          );
          insertedCount++;
        }

        await connection.commit();
        console.log('✅ Successfully uploaded', insertedCount, 'supervisors for departments:', departmentsInUpload.join(', '));
        
        res.json({ 
          success: true, 
          message: `${insertedCount} supervisors uploaded successfully (${departmentsInUpload.length} department(s))` 
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
      const department = String(req.body?.department || '').trim();
      const result = await assignmentService.assignSupervisorsToGroups(department || undefined);

      if (result.success && result.assignments.length > 0) {
        const connection = await db.getConnection();
        try {
          await connection.beginTransaction();
          await resetEvaluationsForGroupIds(connection, result.assignments.map((a) => a.groupId));
          await connection.commit();
        } catch (e) {
          await connection.rollback();
          throw e;
        } finally {
          connection.release();
        }
        console.log(`✅ ${result.assignments.length} groups assigned successfully`);
        if (!isEmailConfigured()) {
          console.warn('📧 Email not configured (SMTP_HOST, SMTP_USER, SMTP_PASS in .env) - no emails will be sent');
        }

        // Notify students (per group) and aggregate supervisor notifications
        const supervisorStudentsMap = new Map<number, { supUser: any; studentCount: number; groupCount: number }>();

        for (const a of result.assignments) {
          const [memberRows] = await db.execute(
            'SELECT matric_number, student_name FROM group_members WHERE group_id = ?',
            [a.groupId]
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
            } else {
              console.warn(`📧 Could not match student for email: ${m.student_name || matric} (matric: ${matric})`);
            }
          }

          if (studentUserIds.length > 0) {
            console.log(`📧 Notifying ${studentUserIds.length} student(s) for ${a.groupName}: ${studentEmails.join(', ')}`);
            notifyGroupingAndSupervisor(db, studentUserIds, studentEmails, studentNames, a.groupName, a.supervisorName).catch((err) => {
              console.error('📧 notifyGroupingAndSupervisor error:', err);
            });
          } else {
            console.warn(`📧 No students matched for group ${a.groupName} - check matric_number/student_name in group_members vs students table`);
          }

          const snRaw = String(a.supervisorName).trim();
          const sn = snRaw.replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Engr\.?)\s+/i, '');
          const snReversed = sn.includes(',') ? sn.split(',').map((x: string) => x.trim()).reverse().join(' ') : sn;
          const [supRows] = await db.execute(
            `SELECT u.id, u.email, u.first_name, u.last_name FROM users u
             INNER JOIN supervisors s ON s.user_id = u.id
             WHERE (? LIKE CONCAT('%', TRIM(u.first_name), '%') AND ? LIKE CONCAT('%', TRIM(u.last_name), '%'))
                OR (? LIKE CONCAT('%', TRIM(u.first_name), '%') AND ? LIKE CONCAT('%', TRIM(u.last_name), '%'))
             LIMIT 1`,
            [sn, sn, snReversed, snReversed]
          );
          const supUser = (supRows as any[])[0];
          if (supUser) {
            const existing = supervisorStudentsMap.get(supUser.id);
            if (existing) {
              existing.studentCount += studentNames.length;
              existing.groupCount += 1;
            } else {
              supervisorStudentsMap.set(supUser.id, { supUser, studentCount: studentNames.length, groupCount: 1 });
            }
          } else {
            console.warn(`📧 Could not match supervisor "${a.supervisorName}" to a user - check supervisor_workload names vs users table`);
          }
        }

        for (const { supUser, studentCount, groupCount } of supervisorStudentsMap.values()) {
          if (studentCount > 0) {
            const supFullName = `${supUser.first_name || ''} ${supUser.last_name || ''}`.trim();
            console.log(`📧 Notifying supervisor ${supUser.email} with ${studentCount} student(s), ${groupCount} group(s)`);
            notifyNewStudentAssignment(db, supUser.id, supUser.email, supFullName, studentCount, groupCount).catch((err) => {
              console.error('📧 notifyNewStudentAssignment error:', err);
            });
          }
        }
      }

      if (result.success) {
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

  // Clear supervisors and assignments (department-specific when provided)
  router.post('/clear-all', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const department = String(req.body?.department || '').trim();
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        if (department) {
          const [grpRows] = await connection.execute(
            `SELECT id FROM project_groups WHERE TRIM(COALESCE(department,'')) = TRIM(?)`,
            [department]
          );
          const groupIds = (grpRows as any[]).map((r) => Number(r.id)).filter(Boolean);
          await resetEvaluationsForGroupIds(connection, groupIds);
          await connection.execute(
            `UPDATE project_groups
             SET supervisor_name = NULL
             WHERE TRIM(COALESCE(department,'')) = TRIM(?)`,
            [department]
          );
          await connection.execute(
            `DELETE FROM supervisor_workload WHERE TRIM(COALESCE(department,'')) = TRIM(?)`,
            [department]
          );
        } else {
          await connection.execute('UPDATE project_groups SET supervisor_name = NULL WHERE 1=1');
          await connection.execute('DELETE FROM supervisor_workload');
          await connection.execute('DELETE FROM evaluations');
          try {
            await connection.execute('DELETE FROM student_evaluations');
          } catch {
            // student_evaluations may not exist in older environments
          }
        }
        await connection.commit();
        res.json({
          success: true,
          message: department
            ? `Supervisors and assignments cleared for ${department}.`
            : 'All supervisors and assignments cleared. Upload a new list to start fresh.'
        });
      } catch (e) {
        await connection.rollback();
        throw e;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error clearing supervisors:', error);
      res.status(500).json({ success: false, error: 'Failed to clear supervisors' });
    }
  });

  // Admin: set per-department max groups cap for a workload row
  router.put('/workload/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { max_groups } = req.body as { max_groups?: number | null };
      if (Number.isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
      }
      if (max_groups !== undefined && max_groups !== null && (typeof max_groups !== 'number' || max_groups < 0)) {
        return res.status(400).json({ success: false, message: 'max_groups must be null or a non-negative number' });
      }
      if (max_groups === undefined) {
        return res.status(400).json({ success: false, message: 'max_groups is required (use null to clear cap)' });
      }
      await db.execute(`UPDATE supervisor_workload SET max_groups = ?, updated_at = NOW() WHERE id = ?`, [
        max_groups,
        id,
      ]);
      res.json({ success: true, message: 'Workload cap updated' });
    } catch (error) {
      console.error('Workload cap update error:', error);
      res.status(500).json({ success: false, message: 'Failed to update cap' });
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