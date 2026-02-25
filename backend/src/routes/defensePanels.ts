import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { authenticateToken, requireStudent, requireSupervisor, requireAdmin } from '../middleware/auth';
import { DefensePanelService } from '../services/defensePanelService';
import { DefenseAllocationService } from '../services/defenseAllocationService';
import { computeAllocation } from '../services/defenseSchedulingService';
import { notifyDefenseScheduled } from '../services/notificationEmailService';
import { AuthenticatedRequest } from '../types';

const router = Router();

export function createDefensePanelsRouter(db: Pool) {
  const defenseService = new DefensePanelService(db);
  const defenseAllocService = new DefenseAllocationService(db);

  // Defense scheduling allocation (admin) - staff/venues CSV processing
  router.post('/allocate', authenticateToken, requireAdmin, async (req, res) => {
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

  router.get('/my-defense', authenticateToken, requireStudent, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const [studentRows] = await db.execute(
        'SELECT matric_number FROM students WHERE user_id = ?',
        [userId]
      );
      const matric = (studentRows as any[])[0]?.matric_number;
      if (!matric) return res.json({ success: true, data: null });
      // First try defense_panels (manual scheduling); fallback to defense_allocations
      let data = await defenseService.getStudentDefense(matric);
      if (!data) {
        const allocData = await defenseAllocService.getStudentDefenseSchedule(matric);
        if (allocData) {
          data = { source: 'allocation', venue: allocData.venue, assessors: allocData.assessors, groupRange: allocData.groupRange } as any;
        }
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error('My defense error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch defense schedule' });
    }
  });

  // Defense schedule from admin's CSV-based allocation (venue + assessors)
  router.get('/my-defense-schedule', authenticateToken, requireStudent, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const [[studentRows], [userRows], [groupRows]] = await Promise.all([
        db.execute('SELECT matric_number FROM students WHERE user_id = ?', [userId]),
        db.execute('SELECT first_name, last_name FROM users WHERE id = ?', [userId]),
        db.execute(
          `SELECT gm.group_id FROM group_members gm
           INNER JOIN students s ON (s.matric_number = gm.matric_number OR TRIM(s.matric_number) = TRIM(gm.matric_number))
           WHERE s.user_id = ?
           LIMIT 1`,
          [userId]
        )
      ]);
      let data = null;
      const matric = (studentRows as any[])[0]?.matric_number;
      const user = (userRows as any[])[0];
      const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : null;
      data = await defenseAllocService.getStudentDefenseSchedule(matric || null, userName);
      // Fallback: find group via students->matric->group_members join
      if (!data && (groupRows as any[]).length > 0) {
        const groupId = (groupRows as any[])[0].group_id;
        data = await defenseAllocService.getDefenseScheduleByGroupId(groupId);
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error('My defense schedule error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch defense schedule' });
    }
  });

  // Defense schedules for all groups assigned to this supervisor
    // Admin: publish existing allocations to DB (for allocations already in localStorage from before persist was added)
  router.post('/publish-allocations', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { allocations, groupRanges } = req.body;
      if (!Array.isArray(allocations) || allocations.length === 0) {
        return res.status(400).json({ success: false, message: 'allocations array required' });
      }
      const ranges = Array.isArray(groupRanges) ? groupRanges : [];
      const rangeByIndex = new Map<number, { department: string; start: number; end: number }>();
      ranges.forEach((r: any) => rangeByIndex.set(r.venue_index, { department: String(r.department || '').trim(), start: Number(r.start) || 0, end: Number(r.end) || 0 }));

      const toSave = allocations.map((a: any, i: number) => {
        const r = rangeByIndex.get(i);
        return {
          venue: a.venue || '',
          groupRange: r && r.department ? { department: r.department, start: r.start, end: r.end } : undefined,
          assessors: Array.isArray(a.assessors) ? a.assessors : []
        };
      });
      await defenseAllocService.saveAllocations(toSave);

      // Notify students via in-app notification + email
      const studentsToNotify = await defenseAllocService.getStudentsToNotifyForPublishedDefense();
      for (const s of studentsToNotify) {
        notifyDefenseScheduled(db, s.userId, s.email, s.studentName, s.venue, s.assessors, s.groupName).catch(() => {});
      }

      res.json({ success: true, message: 'Allocations published. Students and supervisors can now see their defense schedule.' });
    } catch (error) {
      console.error('Publish allocations error:', error);
      res.status(500).json({ success: false, message: 'Failed to publish allocations' });
    }
  });

  // Get defense schedule by group ID (student with group from getMyGroup)
  router.get('/schedule-for-group/:groupId', authenticateToken, requireStudent, async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId, 10);
      if (isNaN(groupId)) return res.status(400).json({ success: false, message: 'Invalid group ID' });
      const data = await defenseAllocService.getDefenseScheduleByGroupId(groupId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Schedule for group error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch defense schedule' });
    }
  });

  router.get('/my-groups-defense-schedules', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const data = await defenseAllocService.getSupervisorGroupsDefenseSchedules(userId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Supervisor groups defense schedules error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch defense schedules' });
    }
  });

  router.get('/my-panels', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const [supRows] = await db.execute(
        'SELECT id FROM supervisors WHERE user_id = ? LIMIT 1',
        [userId]
      );
      const supervisorId = (supRows as any[])[0]?.id;
      if (!supervisorId) return res.json({ success: true, data: [] });
      const [rows] = await db.execute(
        `SELECT * FROM defense_panels 
         WHERE internal_supervisor_id = ? OR external_supervisor_id = ?
         ORDER BY defense_date ASC`,
        [supervisorId, supervisorId]
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Supervisor panels error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch defense panels' });
    }
  });

  return router;
}
