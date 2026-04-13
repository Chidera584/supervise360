import { randomUUID } from 'crypto';
import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { authenticateToken, requireStudent, requireSupervisor } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types';
import { ReportService } from '../services/reportService';
import { NotificationService } from '../services/notificationService';

async function getSupervisorFullName(db: Pool, userId: number): Promise<string> {
  const [rows] = await db.execute('SELECT first_name, last_name FROM users WHERE id = ?', [userId]);
  const u = (rows as any[])[0];
  return u ? `${(u.first_name || '').trim()} ${(u.last_name || '').trim()}`.trim().replace(/\s+/g, ' ') : '';
}

async function notifyStudentsMeetingScheduled(
  db: Pool,
  meetingId: number,
  groupId: number,
  title: string,
  startsAt: string,
  supervisorDisplayName: string
) {
  const ns = new NotificationService(db);
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  const [members] = await db.execute(
    'SELECT matric_number FROM group_members WHERE group_id = ?',
    [groupId]
  );
  for (const row of members as any[]) {
    const matric = String(row.matric_number || '').trim();
    if (!matric) continue;
    const [stRows] = await db.execute(
      'SELECT user_id FROM students WHERE matric_number = ? OR TRIM(matric_number) = ? LIMIT 1',
      [matric, matric]
    );
    const uid = (stRows as any[])[0]?.user_id;
    if (!uid) continue;
    await ns
      .create({
        userId: uid,
        title: 'Supervision meeting scheduled',
        message: `${title} — ${startsAt}${supervisorDisplayName ? ` · Supervisor: ${supervisorDisplayName}` : ''}`,
        type: 'supervision_meeting_scheduled',
        relatedId: meetingId,
        actionUrl: `${frontend}/supervision-meetings`,
      })
      .catch(() => {});
  }
}

async function assertSupervisorOwnsGroup(
  db: Pool,
  supervisorUserId: number,
  groupId: number
): Promise<boolean> {
  const fullName = await getSupervisorFullName(db, supervisorUserId);
  if (!fullName) return false;
  const [rows] = await db.execute(
    `SELECT id FROM project_groups WHERE id = ? AND TRIM(COALESCE(supervisor_name,'')) = TRIM(?)`,
    [groupId, fullName]
  );
  return (rows as any[]).length > 0;
}

async function persistMeetingAttendanceForGroup(
  conn: any,
  userId: number,
  meet: { id: number; group_id: number; session_id: number },
  attendance: { group_member_id: number; present: boolean }[]
): Promise<void> {
  const mid = meet.id;
  await conn.execute('DELETE FROM meeting_attendance WHERE meeting_id = ?', [mid]);
  await conn.execute('DELETE FROM student_assessment_entries WHERE meeting_id = ?', [mid]);
  for (const row of attendance) {
    const gmid = Number(row.group_member_id);
    const present = !!row.present;
    const [gmRows] = await conn.execute(
      'SELECT id, group_id, matric_number, student_name FROM group_members WHERE id = ?',
      [gmid]
    );
    const gm = (gmRows as any[])[0];
    if (!gm || Number(gm.group_id) !== Number(meet.group_id)) continue;

    await conn.execute(
      `INSERT INTO meeting_attendance (meeting_id, group_member_id, present) VALUES (?, ?, ?)`,
      [mid, gmid, present]
    );

    let studentUserId: number | null = null;
    if (gm.matric_number) {
      const [sRows] = await conn.execute(
        'SELECT user_id FROM students WHERE matric_number = ? OR TRIM(matric_number) = ? LIMIT 1',
        [gm.matric_number, gm.matric_number]
      );
      studentUserId = (sRows as any[])[0]?.user_id ?? null;
    }
    if (studentUserId) {
      await conn.execute(
        `INSERT INTO student_assessment_entries
         (student_user_id, supervisor_id, session_id, category, points, max_points, title, notes, meeting_id, recorded_at)
         VALUES (?, ?, ?, 'meeting_attendance', ?, 1, ?, ?, ?, NOW())`,
        [
          studentUserId,
          userId,
          meet.session_id,
          present ? 1 : 0,
          `Meeting attendance`,
          present ? 'Present' : 'Absent',
          mid,
        ]
      );
    }
  }
}

export function createSupervisionRouter(db: Pool) {
  const router = Router();
  const reportService = new ReportService(db);

  // Supervisor: list meetings — bulk rows with same bulk_series_id are grouped into one item
  router.get('/meetings', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const fullName = await getSupervisorFullName(db, userId);
      const sessionId = req.query.sessionId ? Number(req.query.sessionId) : NaN;
      const sessionFilter = !Number.isNaN(sessionId) ? 'AND pg.session_id = ?' : '';
      const params: any[] = [fullName];
      if (!Number.isNaN(sessionId)) params.push(sessionId);

      const [rows] = await db.execute(
        `SELECT m.id, m.group_id, m.session_id, m.title, m.starts_at, m.ends_at, m.location, m.notes, m.created_at,
                m.bulk_series_id, m.attendance_locked,
                pg.name AS group_name, pg.department
         FROM supervision_meetings m
         INNER JOIN project_groups pg ON pg.id = m.group_id
         WHERE TRIM(COALESCE(pg.supervisor_name,'')) = TRIM(?) ${sessionFilter}
         ORDER BY m.starts_at DESC`,
        params
      );
      const list = rows as any[];
      const bySeries = new Map<string, any[]>();
      const singles: any[] = [];
      for (const r of list) {
        const sid = r.bulk_series_id ? String(r.bulk_series_id) : '';
        if (sid) {
          if (!bySeries.has(sid)) bySeries.set(sid, []);
          bySeries.get(sid)!.push(r);
        } else {
          singles.push(r);
        }
      }
      const out: any[] = [];
      for (const [, groupRows] of bySeries) {
        if (groupRows.length === 0) continue;
        const first = groupRows[0];
        const depts = [...new Set(groupRows.map((x: any) => String(x.department || '').trim()).filter(Boolean))];
        const [sessRows] = await db.execute(`SELECT label FROM academic_sessions WHERE id = ? LIMIT 1`, [
          first.session_id,
        ]);
        const sessLabel = (sessRows as any[])[0]?.label || `Session ${first.session_id}`;
        let display_label: string;
        if (depts.length === 1) {
          display_label = `${first.title} – All ${depts[0]} groups · ${sessLabel}`;
        } else if (depts.length > 1) {
          display_label = `${first.title} – All groups (${depts.join(', ')}) · ${sessLabel}`;
        } else {
          display_label = `${first.title} – All supervised groups · ${sessLabel}`;
        }
        out.push({
          kind: 'series',
          bulk_series_id: first.bulk_series_id,
          title: first.title,
          starts_at: first.starts_at,
          session_id: first.session_id,
          session_label: sessLabel,
          location: first.location,
          meeting_ids: groupRows.map((x: any) => x.id),
          group_ids: groupRows.map((x: any) => x.group_id),
          group_names: groupRows.map((x: any) => x.group_name),
          departments: depts,
          display_label,
          attendance_locked: groupRows.every((x: any) => x.attendance_locked),
        });
      }
      for (const r of singles) {
        out.push({
          kind: 'single',
          id: r.id,
          group_id: r.group_id,
          session_id: r.session_id,
          title: r.title,
          starts_at: r.starts_at,
          ends_at: r.ends_at,
          location: r.location,
          notes: r.notes,
          created_at: r.created_at,
          group_name: r.group_name,
          department: r.department,
          attendance_locked: !!r.attendance_locked,
        });
      }
      out.sort((a, b) => {
        const ta = new Date(a.starts_at || 0).getTime();
        const tb = new Date(b.starts_at || 0).getTime();
        return tb - ta;
      });
      res.json({ success: true, data: out });
    } catch (error) {
      console.error('Supervisor meetings list error:', error);
      res.status(500).json({ success: false, message: 'Failed to list meetings' });
    }
  });

  router.post('/meetings', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const { group_id, session_id, title, starts_at, ends_at, location, notes } = req.body;
      const gid = Number(group_id);
      const sid = Number(session_id);
      if (!gid || !sid || !starts_at) {
        return res.status(400).json({
          success: false,
          message: 'group_id, session_id, and starts_at are required',
        });
      }
      const ok = await assertSupervisorOwnsGroup(db, userId, gid);
      if (!ok) {
        return res.status(403).json({ success: false, message: 'You do not supervise this group' });
      }
      const [pgRows] = await db.execute(
        'SELECT session_id FROM project_groups WHERE id = ?',
        [gid]
      );
      const gsid = (pgRows as any[])[0]?.session_id;
      if (gsid != null && Number(gsid) !== sid) {
        return res.status(400).json({ success: false, message: 'session_id must match the group session' });
      }
      const meetTitle = (title && String(title).trim()) || 'Supervision meeting';
      const [ins] = await db.execute(
        `INSERT INTO supervision_meetings (group_id, session_id, supervisor_user_id, title, starts_at, ends_at, location, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          gid,
          sid,
          userId,
          meetTitle,
          starts_at,
          ends_at || null,
          location || null,
          notes || null,
        ]
      );
      const newId = (ins as any).insertId as number;
      const supName = await getSupervisorFullName(db, userId);
      await notifyStudentsMeetingScheduled(db, newId, gid, meetTitle, String(starts_at), supName);
      res.json({ success: true, data: { id: newId } });
    } catch (error) {
      console.error('Create meeting error:', error);
      res.status(500).json({ success: false, message: 'Failed to create meeting' });
    }
  });

  router.post('/meetings/bulk', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const { session_id, starts_at, ends_at, location, title, scope, group_id } = req.body as {
        session_id?: number;
        starts_at?: string;
        ends_at?: string | null;
        location?: string | null;
        title?: string | null;
        scope?: 'all_groups' | 'single_group';
        group_id?: number;
      };
      const sid = Number(session_id);
      const sc = String(scope || 'all_groups');
      if (!sid || !starts_at) {
        return res.status(400).json({ success: false, message: 'session_id and starts_at are required' });
      }
      if (sc !== 'all_groups' && sc !== 'single_group') {
        return res.status(400).json({ success: false, message: 'scope must be all_groups or single_group' });
      }

      let targetGroupIds: number[] = [];
      if (sc === 'single_group') {
        const gid = Number(group_id);
        if (!gid) {
          return res.status(400).json({ success: false, message: 'group_id is required for single_group scope' });
        }
        const ok = await assertSupervisorOwnsGroup(db, userId, gid);
        if (!ok) {
          return res.status(403).json({ success: false, message: 'You do not supervise this group' });
        }
        const [pgRows] = await db.execute(
          'SELECT session_id FROM project_groups WHERE id = ?',
          [gid]
        );
        const gsid = (pgRows as any[])[0]?.session_id;
        if (gsid != null && Number(gsid) !== sid) {
          return res.status(400).json({ success: false, message: 'session_id must match the group session' });
        }
        targetGroupIds = [gid];
      } else {
        const mine = await reportService.getSupervisorGroupIds(userId);
        if (mine.length === 0) {
          return res.status(400).json({ success: false, message: 'No supervised groups found for this session' });
        }
        const ph = mine.map(() => '?').join(',');
        const [rows] = await db.execute(
          `SELECT id FROM project_groups WHERE id IN (${ph}) AND session_id = ?`,
          [...mine, sid]
        );
        targetGroupIds = (rows as any[]).map((r: any) => r.id);
        if (targetGroupIds.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No supervised groups in the selected academic session',
          });
        }
      }

      const meetTitle = (title && String(title).trim()) || 'Supervision meeting';
      const supName = await getSupervisorFullName(db, userId);
      const seriesId = randomUUID();
      const conn = await db.getConnection();
      const createdIds: number[] = [];
      try {
        await conn.beginTransaction();
        for (const gid of targetGroupIds) {
          const [ins] = await conn.execute(
            `INSERT INTO supervision_meetings (group_id, session_id, supervisor_user_id, title, starts_at, ends_at, location, notes, bulk_series_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              gid,
              sid,
              userId,
              meetTitle,
              starts_at,
              ends_at || null,
              location || null,
              null,
              seriesId,
            ]
          );
          const newId = (ins as any).insertId as number;
          createdIds.push(newId);
        }
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }

      for (let i = 0; i < createdIds.length; i++) {
        await notifyStudentsMeetingScheduled(
          db,
          createdIds[i],
          targetGroupIds[i],
          meetTitle,
          String(starts_at),
          supName
        );
      }

      res.json({ success: true, data: { ids: createdIds, count: createdIds.length } });
    } catch (error) {
      console.error('Bulk create meetings error:', error);
      res.status(500).json({ success: false, message: 'Failed to schedule meetings' });
    }
  });

  router.get(
    '/meetings/series/:bulkSeriesId/attendance',
    authenticateToken,
    requireSupervisor,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const bulkSeriesId = String(req.params.bulkSeriesId || '').trim();
        if (!bulkSeriesId) {
          return res.status(400).json({ success: false, message: 'bulk_series_id required' });
        }
        const fullName = await getSupervisorFullName(db, userId);
        const [rows] = await db.execute(
          `SELECT m.id AS meeting_id, m.group_id, m.session_id, m.title, m.attendance_locked,
                  pg.name AS group_name, gm.id AS group_member_id, gm.student_name, gm.matric_number,
                  ma.present
           FROM supervision_meetings m
           INNER JOIN project_groups pg ON pg.id = m.group_id
           INNER JOIN group_members gm ON gm.group_id = pg.id
           LEFT JOIN meeting_attendance ma ON ma.meeting_id = m.id AND ma.group_member_id = gm.id
           WHERE m.bulk_series_id = ? AND TRIM(COALESCE(pg.supervisor_name,'')) = TRIM(?)
           ORDER BY pg.name ASC, gm.member_order ASC, gm.id ASC`,
          [bulkSeriesId, fullName]
        );
        const list = rows as any[];
        if (list.length === 0) {
          return res.status(404).json({ success: false, message: 'Series not found' });
        }
        const locked = list.every((r) => r.attendance_locked);
        const students = list.map((r) => ({
          meeting_id: r.meeting_id,
          group_id: r.group_id,
          group_name: r.group_name,
          group_member_id: r.group_member_id,
          student_name: r.student_name,
          matric_number: r.matric_number,
          present: r.present === null || r.present === undefined ? null : !!r.present,
        }));
        res.json({
          success: true,
          data: {
            bulk_series_id: bulkSeriesId,
            title: list[0].title,
            locked,
            students,
          },
        });
      } catch (error) {
        console.error('Series attendance GET error:', error);
        res.status(500).json({ success: false, message: 'Failed to load attendance' });
      }
    }
  );

  router.post(
    '/meetings/series/:bulkSeriesId/attendance',
    authenticateToken,
    requireSupervisor,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const bulkSeriesId = String(req.params.bulkSeriesId || '').trim();
        const { attendance } = req.body as { attendance?: { group_member_id: number; present: boolean }[] };
        if (!bulkSeriesId || !Array.isArray(attendance)) {
          return res.status(400).json({ success: false, message: 'attendance array required' });
        }
        const fullName = await getSupervisorFullName(db, userId);
        const [mrows] = await db.execute(
          `SELECT m.id, m.group_id, m.session_id, m.supervisor_user_id, m.attendance_locked
           FROM supervision_meetings m
           INNER JOIN project_groups pg ON pg.id = m.group_id
           WHERE m.bulk_series_id = ? AND TRIM(COALESCE(pg.supervisor_name,'')) = TRIM(?)`,
          [bulkSeriesId, fullName]
        );
        const meetings = mrows as any[];
        if (meetings.length === 0) {
          return res.status(404).json({ success: false, message: 'Series not found' });
        }
        if (meetings.some((m) => m.attendance_locked)) {
          return res
            .status(403)
            .json({ success: false, message: 'Attendance is already saved for this meeting' });
        }
        const groupToMeet = new Map<number, { id: number; group_id: number; session_id: number }>();
        for (const m of meetings) {
          groupToMeet.set(Number(m.group_id), {
            id: Number(m.id),
            group_id: Number(m.group_id),
            session_id: Number(m.session_id),
          });
        }
        const byMeeting = new Map<number, { group_member_id: number; present: boolean }[]>();
        for (const row of attendance) {
          const gmid = Number(row.group_member_id);
          const [gmRows] = await db.execute('SELECT id, group_id FROM group_members WHERE id = ?', [gmid]);
          const gm = (gmRows as any[])[0];
          if (!gm) continue;
          const gid = Number(gm.group_id);
          const meet = groupToMeet.get(gid);
          if (!meet) continue;
          const arr = byMeeting.get(meet.id) || [];
          arr.push({ group_member_id: gmid, present: !!row.present });
          byMeeting.set(meet.id, arr);
        }
        const conn = await db.getConnection();
        try {
          await conn.beginTransaction();
          for (const m of meetings) {
            const mid = Number(m.id);
            const slice = byMeeting.get(mid) || [];
            await persistMeetingAttendanceForGroup(
              conn,
              userId,
              {
                id: mid,
                group_id: Number(m.group_id),
                session_id: Number(m.session_id),
              },
              slice
            );
          }
          await conn.execute(
            `UPDATE supervision_meetings SET attendance_locked = TRUE, updated_at = NOW() WHERE bulk_series_id = ?`,
            [bulkSeriesId]
          );
          await conn.commit();
          res.json({ success: true, message: 'Attendance saved' });
        } catch (e) {
          await conn.rollback();
          throw e;
        } finally {
          conn.release();
        }
      } catch (error) {
        console.error('Series attendance POST error:', error);
        res.status(500).json({ success: false, message: 'Failed to save attendance' });
      }
    }
  );

  router.get('/meetings/:id/attendance', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const mid = Number(req.params.id);
      if (!Number.isFinite(mid) || mid <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid meeting id' });
      }
      const [mrows] = await db.execute(
        `SELECT m.id, m.supervisor_user_id, m.bulk_series_id, m.attendance_locked
         FROM supervision_meetings m WHERE m.id = ?`,
        [mid]
      );
      const meet = (mrows as any[])[0];
      if (!meet) return res.status(404).json({ success: false, message: 'Meeting not found' });
      if (Number(meet.supervisor_user_id) !== userId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      if (meet.bulk_series_id) {
        return res.status(400).json({
          success: false,
          message: 'Use the combined attendance view for all-groups meetings',
          bulk_series_id: meet.bulk_series_id,
        });
      }
      const [arows] = await db.execute(
        `SELECT ma.group_member_id, ma.present, gm.student_name, gm.matric_number
         FROM meeting_attendance ma
         INNER JOIN group_members gm ON gm.id = ma.group_member_id
         WHERE ma.meeting_id = ?
         ORDER BY gm.member_order ASC, gm.id ASC`,
        [mid]
      );
      res.json({
        success: true,
        data: {
          locked: !!meet.attendance_locked,
          attendance: arows,
        },
      });
    } catch (error) {
      console.error('Meeting attendance GET error:', error);
      res.status(500).json({ success: false, message: 'Failed to load attendance' });
    }
  });

  router.put('/meetings/:id', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const mid = Number(req.params.id);
      const [mrows] = await db.execute(
        'SELECT id, supervisor_user_id, attendance_locked FROM supervision_meetings WHERE id = ?',
        [mid]
      );
      const m = (mrows as any[])[0];
      if (!m) return res.status(404).json({ success: false, message: 'Meeting not found' });
      if (Number(m.supervisor_user_id) !== userId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      if (m.attendance_locked) {
        return res.status(403).json({
          success: false,
          message: 'This meeting is locked after attendance was saved',
        });
      }
      const { title, starts_at, ends_at, location, notes } = req.body;
      const sets: string[] = [];
      const vals: any[] = [];
      if (title !== undefined) {
        sets.push('title = ?');
        vals.push(title);
      }
      if (starts_at !== undefined) {
        sets.push('starts_at = ?');
        vals.push(starts_at);
      }
      if (ends_at !== undefined) {
        sets.push('ends_at = ?');
        vals.push(ends_at);
      }
      if (location !== undefined) {
        sets.push('location = ?');
        vals.push(location);
      }
      if (notes !== undefined) {
        sets.push('notes = ?');
        vals.push(notes);
      }
      if (sets.length === 0) {
        return res.json({ success: true, message: 'No changes' });
      }
      vals.push(mid);
      await db.execute(
        `UPDATE supervision_meetings SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`,
        vals
      );
      res.json({ success: true, message: 'Meeting updated' });
    } catch (error) {
      console.error('Update meeting error:', error);
      res.status(500).json({ success: false, message: 'Failed to update meeting' });
    }
  });

  router.post('/meetings/:id/attendance', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const mid = Number(req.params.id);
      const { attendance } = req.body as { attendance?: { group_member_id: number; present: boolean }[] };
      if (!Array.isArray(attendance)) {
        return res.status(400).json({ success: false, message: 'attendance array required' });
      }
      const [mrows] = await db.execute(
        `SELECT m.id, m.group_id, m.session_id, m.supervisor_user_id, m.bulk_series_id, m.attendance_locked
         FROM supervision_meetings m
         INNER JOIN project_groups pg ON pg.id = m.group_id
         WHERE m.id = ?`,
        [mid]
      );
      const meet = (mrows as any[])[0];
      if (!meet) return res.status(404).json({ success: false, message: 'Meeting not found' });
      if (Number(meet.supervisor_user_id) !== userId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      if (meet.bulk_series_id) {
        return res.status(400).json({
          success: false,
          message: 'Use the combined attendance view for all-groups meetings',
          bulk_series_id: meet.bulk_series_id,
        });
      }
      if (meet.attendance_locked) {
        return res
          .status(403)
          .json({ success: false, message: 'Attendance is already saved for this meeting' });
      }

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await persistMeetingAttendanceForGroup(
          conn,
          userId,
          {
            id: mid,
            group_id: Number(meet.group_id),
            session_id: Number(meet.session_id),
          },
          attendance
        );
        await conn.execute(
          `UPDATE supervision_meetings SET attendance_locked = TRUE, updated_at = NOW() WHERE id = ?`,
          [mid]
        );
        await conn.commit();
        res.json({ success: true, message: 'Attendance saved' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('Attendance save error:', error);
      res.status(500).json({ success: false, message: 'Failed to save attendance' });
    }
  });

  router.post('/assessments', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const {
        student_user_id,
        session_id,
        category,
        points,
        max_points,
        title,
        notes,
        group_id,
      } = req.body;
      const sid = Number(session_id);
      const stu = Number(student_user_id);
      const gid = group_id != null ? Number(group_id) : null;
      if (!stu || !sid || !category) {
        return res.status(400).json({
          success: false,
          message: 'student_user_id, session_id, and category are required',
        });
      }
      if (gid) {
        const ok = await assertSupervisorOwnsGroup(db, userId, gid);
        if (!ok) {
          return res.status(403).json({ success: false, message: 'You do not supervise this group' });
        }
      }
      const [ins] = await db.execute(
        `INSERT INTO student_assessment_entries
         (student_user_id, supervisor_id, session_id, category, points, max_points, title, notes, meeting_id, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW())`,
        [
          stu,
          userId,
          sid,
          category,
          points != null ? Number(points) : null,
          max_points != null ? Number(max_points) : null,
          title || null,
          notes || null,
        ]
      );
      res.json({ success: true, data: { id: (ins as any).insertId } });
    } catch (error: any) {
      console.error('Assessment create error:', error);
      res.status(500).json({ success: false, message: error?.message || 'Failed to save assessment' });
    }
  });

  router.get('/assessments', authenticateToken, requireSupervisor, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const sessionId = req.query.sessionId ? Number(req.query.sessionId) : NaN;
      const sessionFilter = !Number.isNaN(sessionId) ? 'AND e.session_id = ?' : '';
      const params: any[] = [userId];
      if (!Number.isNaN(sessionId)) params.push(sessionId);
      const [rows] = await db.execute(
        `SELECT e.*, u.first_name, u.last_name, u.email
         FROM student_assessment_entries e
         INNER JOIN users u ON u.id = e.student_user_id
         WHERE e.supervisor_id = ? ${sessionFilter}
         ORDER BY e.recorded_at DESC`,
        params
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Supervisor assessments list error:', error);
      res.status(500).json({ success: false, message: 'Failed to list assessments' });
    }
  });

  // Student: meetings for their group
  router.get('/my-meetings', authenticateToken, requireStudent, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const [stRows] = await db.execute(
        `SELECT s.matric_number, s.session_id FROM students s WHERE s.user_id = ?`,
        [userId]
      );
      const st = (stRows as any[])[0];
      if (!st?.matric_number) {
        return res.json({ success: true, data: [] });
      }
      const matric = String(st.matric_number).trim();
      const qParams: any[] = [matric, matric];
      let sessionClause = '';
      if (st.session_id != null) {
        sessionClause = ' AND pg.session_id = ?';
        qParams.push(st.session_id);
      }
      const [gRows] = await db.execute(
        `SELECT gm.group_id
         FROM group_members gm
         INNER JOIN project_groups pg ON pg.id = gm.group_id
         WHERE (gm.matric_number = ? OR TRIM(gm.matric_number) = ?) ${sessionClause}
         ORDER BY gm.group_id DESC LIMIT 1`,
        qParams
      );
      const gid = (gRows as any[])[0]?.group_id;
      if (!gid) {
        return res.json({ success: true, data: [] });
      }
      const [rows] = await db.execute(
        `SELECT m.id, m.title, m.starts_at, m.ends_at, m.location, m.notes
         FROM supervision_meetings m
         WHERE m.group_id = ?
         ORDER BY m.starts_at ASC`,
        [gid]
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Student meetings error:', error);
      res.status(500).json({ success: false, message: 'Failed to load meetings' });
    }
  });

  // Student: progressive assessment summary (no numeric scores — qualitative only)
  router.get('/my-assessments', authenticateToken, requireStudent, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const [rows] = await db.execute(
        `SELECT e.id, e.category, e.title, e.notes, e.recorded_at, e.meeting_id
         FROM student_assessment_entries e
         WHERE e.student_user_id = ?
         ORDER BY e.recorded_at DESC`,
        [userId]
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Student assessments error:', error);
      res.status(500).json({ success: false, message: 'Failed to load assessments' });
    }
  });

  return router;
}
