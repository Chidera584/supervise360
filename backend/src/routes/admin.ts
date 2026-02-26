import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { AdminService } from '../services/adminService';
import { DefensePanelService } from '../services/defensePanelService';
import { DefenseAllocationService } from '../services/defenseAllocationService';
import { ProjectService } from '../services/projectService';
import { computeAllocation } from '../services/defenseSchedulingService';
import { notifyUnassignedStudentsAlert } from '../services/notificationEmailService';
import { sendTestEmail, isEmailConfigured } from '../services/emailService';

const router = Router();

export function createAdminRouter(db: Pool) {
  const adminService = new AdminService(db);
  const defenseService = new DefensePanelService(db);
  const defenseAllocService = new DefenseAllocationService(db);
  const projectService = new ProjectService(db);

  router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const data = await adminService.getDashboardStats();
      res.json({ success: true, data });
    } catch (error) {
      console.error('Admin dashboard error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch admin dashboard' });
    }
  });

  // Test email - send a sample notification to verify SMTP works
  router.post('/test-email', authenticateToken, requireAdmin, async (req, res) => {
    try {
      console.log('📧 Test email endpoint hit');
      if (!isEmailConfigured()) {
        console.warn('📧 Test email failed: SMTP not configured');
        return res.status(400).json({
          success: false,
          message: 'Email not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to .env (see .env.example)',
        });
      }
      const authUser = (req as import('../types').AuthenticatedRequest).user;
      const email = req.body?.email || authUser?.email;
      if (!email) {
        return res.status(400).json({ success: false, message: 'No email to send to. Provide email in body or use your account email.' });
      }
      console.log(`📧 Sending test email to ${email}...`);
      const result = await sendTestEmail(email);
      if (result.ok) {
        console.log(`📧 Test email sent successfully to ${email}`);
        res.json({ success: true, message: `Test email sent to ${email}. Check your inbox (and spam folder).` });
      } else {
        console.error('📧 Test email failed:', result.error);
        res.status(500).json({
          success: false,
          message: 'Failed to send email.',
          error: result.error,
        });
      }
    } catch (error) {
      console.error('📧 Test email error:', error);
      res.status(500).json({ success: false, message: 'Failed to send test email' });
    }
  });

  router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const data = await adminService.getAnalyticsStats();
      res.json({ success: true, data });
    } catch (error) {
      console.error('Admin stats error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch admin statistics' });
    }
  });

  // Send unassigned students alert to all admins (email + in-app)
  router.post('/send-unassigned-alert', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT pg.department, pg.name as group_name, gm.student_name, gm.matric_number
         FROM project_groups pg
         LEFT JOIN group_members gm ON gm.group_id = pg.id
         WHERE (pg.supervisor_name IS NULL OR pg.supervisor_name = '')
         ORDER BY pg.department, pg.name`
      );
      const data = rows as any[];
      const byDept: Record<string, string[]> = {};
      for (const r of data) {
        const dept = r.department || 'Unknown';
        if (!byDept[dept]) byDept[dept] = [];
        const label = r.student_name ? `${r.student_name} (${r.matric_number || ''})` : r.group_name;
        if (label && !byDept[dept].includes(label)) byDept[dept].push(label);
      }
      const [adminRows] = await db.execute(
        'SELECT id, email FROM users WHERE role = ? AND is_active = TRUE',
        ['admin']
      );
      const admins = adminRows as any[];
      const adminIds = admins.map((a: any) => a.id);
      const adminEmails = admins.map((a: any) => a.email || '');

      for (const [department, studentList] of Object.entries(byDept)) {
        if (studentList.length > 0) {
          notifyUnassignedStudentsAlert(db, adminIds, adminEmails, department, studentList, studentList.length).catch(() => {});
        }
      }
      res.json({ success: true, message: 'Unassigned students alert sent to admins' });
    } catch (error) {
      console.error('Send unassigned alert error:', error);
      res.status(500).json({ success: false, message: 'Failed to send alert' });
    }
  });

  router.put('/projects/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
    try {
      await projectService.approveProject(Number(req.params.id));
      res.json({ success: true, message: 'Project approved' });
    } catch (error) {
      console.error('Approve project error:', error);
      res.status(500).json({ success: false, message: 'Failed to approve project' });
    }
  });

  router.put('/projects/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required' });
      }
      await projectService.rejectProject(Number(req.params.id), reason);
      res.json({ success: true, message: 'Project rejected' });
    } catch (error) {
      console.error('Reject project error:', error);
      res.status(500).json({ success: false, message: 'Failed to reject project' });
    }
  });

    // Debug: why isn't a student seeing defense schedule? ?name=Grace%20Ayo or ?matric=20/1234
  router.get('/debug-defense-schedule', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { name, matric } = req.query;
      let userId: number | null = null;
      let matricNumber: string | null = null;
      let userName: string | null = null;

      if (matric) {
        const [rows] = await db.execute('SELECT user_id, matric_number FROM students WHERE matric_number = ? OR TRIM(matric_number) = ?', [String(matric).trim(), String(matric).trim()]);
        const r = (rows as any[])[0];
        if (r) {
          userId = r.user_id;
          matricNumber = r.matric_number;
          const [u] = await db.execute('SELECT first_name, last_name FROM users WHERE id = ?', [userId]);
          userName = (u as any[])[0] ? `${(u as any[])[0].first_name} ${(u as any[])[0].last_name}`.trim() : null;
        }
      } else if (name) {
        const search = String(name).trim().replace(/\s+/g, '%');
        const [rows] = await db.execute(
          "SELECT id, first_name, last_name FROM users WHERE role = 'student' AND (CONCAT(first_name, ' ', last_name) LIKE ? OR CONCAT(last_name, ' ', first_name) LIKE ?)",
          [`%${search}%`, `%${search}%`]
        );
        const r = (rows as any[])[0];
        if (r) {
          userId = r.id;
          userName = `${r.first_name} ${r.last_name}`.trim();
          const [s] = await db.execute('SELECT matric_number FROM students WHERE user_id = ?', [userId]);
          matricNumber = (s as any[])[0]?.matric_number || null;
        }
      }

      if (!userId && !matricNumber && !userName) {
        return res.json({ success: true, data: { error: 'Student not found. Try ?name=Grace%20Ayo or ?matric=20/1234' } });
      }

      await defenseAllocService.ensureTable();
      const [allocCount] = await db.execute('SELECT COUNT(*) as c FROM defense_allocations');
      const allocTotal = (allocCount as any[])[0]?.c ?? 0;

      const result = await defenseAllocService.getStudentDefenseSchedule(matricNumber, userName);

      const [gmByMatric] = matricNumber ? await db.execute('SELECT group_id, student_name, matric_number FROM group_members WHERE matric_number = ? OR TRIM(matric_number) = ?', [matricNumber, matricNumber]) : [[]];
      const [gmByName] = userName ? await db.execute('SELECT group_id, student_name, matric_number FROM group_members WHERE student_name = ? OR TRIM(student_name) = ?', [userName, userName]) : [[]];

      res.json({
        success: true,
        data: {
          student: { userId, matricNumber, userName },
          groupMemberByMatric: (gmByMatric as any[]).length > 0 ? (gmByMatric as any[])[0] : null,
          groupMemberByName: (gmByName as any[]).length > 0 ? (gmByName as any[])[0] : null,
          defenseAllocationsCount: allocTotal,
          defenseSchedule: result,
          hint: !result && allocTotal > 0 ? 'Check: group name has format "Group X", department in project_groups matches allocation (SE=Software Engineering), group number in range.' : null
        }
      });
    } catch (e) {
      console.error('Debug defense schedule error:', e);
      res.status(500).json({ success: false, message: 'Debug failed' });
    }
  });

  router.get('/defense-panels', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const panels = await defenseService.listPanels();
      res.json({ success: true, data: panels });
    } catch (error) {
      console.error('Defense panels error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch defense panels' });
    }
  });

  router.post('/defense-panels/schedule-bulk', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { date, startTime, durationMinutes, assignments } = req.body;
      if (!date || !startTime || !durationMinutes || !Array.isArray(assignments)) {
        return res.status(400).json({ success: false, message: 'Invalid schedule payload' });
      }
      const result = await defenseService.scheduleBulk({ date, startTime, durationMinutes, assignments });
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Bulk defense schedule error:', error);
      res.status(500).json({ success: false, message: 'Failed to schedule defenses' });
    }
  });

  router.post('/defense-scheduling/allocate', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { staff, venues, groupRanges } = req.body;
      if (!Array.isArray(staff) || !Array.isArray(venues)) {
        return res.status(400).json({ success: false, message: 'staff and venues arrays are required' });
      }
      const ranges = Array.isArray(groupRanges) ? groupRanges : [];
      const result = computeAllocation(staff, venues, ranges);
      res.json({ success: true, data: result });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Allocation failed';
      console.error('Defense scheduling allocate error:', error);
      res.status(400).json({ success: false, message: msg });
    }
  });

  router.put('/defense-panels/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const updates = req.body;
      const result = await defenseService.updatePanel(Number(req.params.id), updates);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.message });
      }
      res.json({ success: true, message: 'Defense panel updated' });
    } catch (error) {
      console.error('Update defense panel error:', error);
      res.status(500).json({ success: false, message: 'Failed to update defense panel' });
    }
  });

  router.post('/groups/swap-members', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { member1, member2 } = req.body;
      const id1 = member1?.memberId ?? member1?.id;
      const id2 = member2?.memberId ?? member2?.id;
      const g1 = Number(member1?.groupId);
      const g2 = Number(member2?.groupId);
      if ((!id1 && !member1?.matricNumber) || (!id2 && !member2?.matricNumber) || !g1 || !g2) {
        return res.status(400).json({ success: false, message: 'Both members must have memberId (or matricNumber) and groupId' });
      }
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        let r1: any, r2: any;
        if (id1 && id2) {
          const [[rows1], [rows2]] = await Promise.all([
            conn.execute('SELECT id, group_id, gpa_tier FROM group_members WHERE id = ?', [id1]) as any,
            conn.execute('SELECT id, group_id, gpa_tier FROM group_members WHERE id = ?', [id2]) as any
          ]);
          r1 = (rows1 as any[])[0];
          r2 = (rows2 as any[])[0];
        } else {
          const m1 = member1?.matricNumber;
          const m2 = member2?.matricNumber;
          if (!m1 || !m2) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'matricNumber required when memberId not provided' });
          }
          const [[rows1], [rows2]] = await Promise.all([
            conn.execute('SELECT id, group_id, gpa_tier FROM group_members WHERE group_id = ? AND matric_number = ?', [g1, m1]) as any,
            conn.execute('SELECT id, group_id, gpa_tier FROM group_members WHERE group_id = ? AND matric_number = ?', [g2, m2]) as any
          ]);
          r1 = (rows1 as any[])[0];
          r2 = (rows2 as any[])[0];
        }
        if (!r1 || !r2 || r1.group_id !== g1 || r2.group_id !== g2) {
          await conn.rollback();
          return res.status(404).json({ success: false, message: 'Members not found or group mismatch' });
        }
        const tier1 = r1.gpa_tier ?? null;
        const tier2 = r2.gpa_tier ?? null;
        if (tier1 !== tier2) {
          await conn.rollback();
          return res.status(400).json({ success: false, message: 'Students must be in the same GPA tier to swap (HIGH↔HIGH, MEDIUM↔MEDIUM, LOW↔LOW)' });
        }
        await conn.execute('UPDATE group_members SET group_id = ? WHERE id = ?', [g2, r1.id]);
        await conn.execute('UPDATE group_members SET group_id = ? WHERE id = ?', [g1, r2.id]);
        await conn.commit();
        res.json({ success: true, message: 'Students swapped successfully' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('Swap members error:', error);
      res.status(500).json({ success: false, message: 'Failed to swap students' });
    }
  });

  return router;
}
