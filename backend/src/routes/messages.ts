import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { authenticateToken } from '../middleware/auth';
import { MessageService } from '../services/messageService';
import { GroupFormationService } from '../services/groupFormationService';
import { ReportService } from '../services/reportService';
import { AuthenticatedRequest } from '../types';
import {
  notifySupervisorMessage,
  notifyStudentMessage,
} from '../services/notificationEmailService';
import { NotificationService } from '../services/notificationService';

const router = Router();

export function createMessagesRouter(db: Pool) {
  const messageService = new MessageService(db);
  const groupService = new GroupFormationService(db);
  const reportService = new ReportService(db);

  router.get('/contacts', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const groupId = req.query.group_id ? Number(req.query.group_id) : undefined;
      const [sRows] = await db.execute('SELECT 1 FROM students WHERE user_id = ?', [userId]);
      const [supRows] = await db.execute('SELECT 1 FROM supervisors WHERE user_id = ?', [userId]);
      const role = (supRows as any[]).length > 0 ? 'supervisor' : (sRows as any[]).length > 0 ? 'student' : 'student';
      const data = await messageService.getContacts(db, groupService, reportService, userId, role, groupId);
      const json: Record<string, unknown> = { success: true, data };
      if (data.length === 0 && req.query.debug === '1') {
        const [studentRows] = await db.execute('SELECT matric_number FROM students WHERE user_id = ?', [userId]);
        const [userRows] = await db.execute('SELECT first_name, last_name FROM users WHERE id = ?', [userId]);
        let debug: Record<string, unknown> = { role, userId, matric: (studentRows as any[])[0]?.matric_number, userName: (userRows as any[])[0] };
        if (role === 'student') {
          const matric = (studentRows as any[])[0]?.matric_number;
          const group = matric ? await groupService.getGroupByMatricNumber(String(matric).trim()) : null;
          const [pgRows] = group?.id ? await db.execute('SELECT supervisor_name FROM project_groups WHERE id = ?', [group.id]) : [[]];
          debug = { ...debug, groupFound: !!group, groupId: group?.id, supervisorName: (pgRows as any[])[0]?.supervisor_name };
        } else {
          const groupIds = await reportService.getSupervisorGroupIds(userId);
          debug = { ...debug, groupIds };
        }
        json._debug = debug;
      }
      res.json(json);
    } catch (error) {
      console.error('Contacts error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch contacts' });
    }
  });

  router.get('/inbox', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const data = await messageService.getInbox(userId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Inbox error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch inbox' });
    }
  });

  router.get('/sent', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const data = await messageService.getSent(userId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Sent error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch sent messages' });
    }
  });

  router.post('/send', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const { recipient_id, recipient_ids, group_id, broadcast, parent_id, subject, content, message_type, priority } = req.body;
      if (!subject || !content) {
        return res.status(400).json({ success: false, message: 'Subject and content are required' });
      }

      const [studentCheckRows] = await db.execute('SELECT 1 FROM students WHERE user_id = ?', [userId]);
      const [supRows] = await db.execute('SELECT 1 FROM supervisors WHERE user_id = ?', [userId]);
      const isStudent = (studentCheckRows as any[]).length > 0;
      const isSupervisor = (supRows as any[]).length > 0;

      let recipients: number[] = [];
      let groupId: number | undefined;
      let msgType = message_type || 'direct';

      if (parent_id) {
        // Reply: supervisor replying to student message -> send to all in that student's group
        if (!isSupervisor) return res.status(403).json({ success: false, message: 'Only supervisors can reply to group messages' });
        const parentMsg = await messageService.getMessageById(Number(parent_id));
        if (!parentMsg) return res.status(404).json({ success: false, message: 'Original message not found' });
        let senderGroupId = parentMsg.group_id;
        if (!senderGroupId) {
          const [parentStudentRows] = await db.execute('SELECT matric_number FROM students WHERE user_id = ?', [parentMsg.sender_id]);
          const matric = (parentStudentRows as any[])[0]?.matric_number;
          if (matric) {
            const [gmRows] = await db.execute('SELECT group_id FROM group_members WHERE matric_number = ? OR TRIM(matric_number) = TRIM(?) LIMIT 1', [matric, matric]);
            senderGroupId = (gmRows as any[])[0]?.group_id;
          }
          if (!senderGroupId) {
            const [uRows] = await db.execute('SELECT first_name, last_name FROM users WHERE id = ?', [parentMsg.sender_id]);
            const u = (uRows as any[])[0];
            const fullName = u ? `${(u.first_name || '')} ${(u.last_name || '')}`.trim() : '';
            if (fullName) {
              const [gmRows] = await db.execute(
                'SELECT group_id FROM group_members WHERE TRIM(student_name) = ? OR student_name LIKE ? LIMIT 1',
                [fullName, `%${fullName.split(' ')[0]}%`]
              );
              senderGroupId = (gmRows as any[])[0]?.group_id;
            }
          }
        }
        if (!senderGroupId) return res.status(400).json({ success: false, message: 'Could not determine group for reply' });
        recipients = await messageService.getGroupMemberUserIds(senderGroupId);
        groupId = senderGroupId;
        msgType = 'group';
      } else if (broadcast && isSupervisor) {
        const groupIds = await reportService.getSupervisorGroupIds(userId);
        const allUserIds = new Set<number>();
        for (const gid of groupIds) {
          const uids = await messageService.getGroupMemberUserIds(gid);
          uids.forEach((uid) => allUserIds.add(uid));
        }
        recipients = [...allUserIds];
        msgType = 'broadcast';
      } else if (group_id && isSupervisor) {
        const gid = Number(group_id);
        const groupIds = await reportService.getSupervisorGroupIds(userId);
        if (!groupIds.includes(gid)) return res.status(403).json({ success: false, message: 'You can only message your assigned groups' });
        recipients = await messageService.getGroupMemberUserIds(gid);
        groupId = gid;
        msgType = 'group';
      } else {
        const rawRecipients = Array.isArray(recipient_ids) ? recipient_ids : recipient_id ? [recipient_id] : [];
        if (rawRecipients.length === 0) return res.status(400).json({ success: false, message: 'Recipient is required' });
        recipients = rawRecipients.map(Number);

        if (isStudent) {
          const contacts = await messageService.getContacts(db, groupService, reportService, userId, 'student');
          const allowedIds = contacts.filter((c) => c.type === 'user').map((c) => c.id);
          if (recipients.some((r) => !allowedIds.includes(r))) {
            return res.status(403).json({ success: false, message: 'You can only message your assigned supervisor' });
          }
          const [studentRows] = await db.execute('SELECT matric_number FROM students WHERE user_id = ?', [userId]);
          const matric = (studentRows as any[])[0]?.matric_number;
          const group = matric ? await groupService.getGroupByMatricNumber(String(matric).trim()) : null;
          if (!group?.id) {
            const [userRows] = await db.execute('SELECT first_name, last_name FROM users WHERE id = ?', [userId]);
            const u = (userRows as any[])[0];
            const fullName = u ? `${(u.first_name || '')} ${(u.last_name || '')}`.trim() : '';
            if (fullName) {
              const [gmRows] = await db.execute(
                'SELECT group_id FROM group_members WHERE TRIM(student_name) = ? OR student_name LIKE ? LIMIT 1',
                [fullName, `%${fullName.split(' ')[0]}%`]
              );
              const gid = (gmRows as any[])[0]?.group_id;
              if (gid) groupId = gid;
            }
          } else {
            groupId = group.id;
          }
          msgType = 'student';
        }
      }

      if (recipients.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid recipients found for this message' });
      }

      const ids = await messageService.sendMessage({
        senderId: userId,
        recipientIds: recipients,
        subject,
        content,
        messageType: msgType,
        priority,
        groupId,
        parentId: parent_id ? Number(parent_id) : undefined
      });

      // Notify each recipient (email + in-app)
      const [senderRows] = await db.execute('SELECT first_name, last_name FROM users WHERE id = ?', [userId]);
      const sender = (senderRows as any[])[0];
      const senderName = sender ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() : 'User';
      const senderIsStudent = isStudent;

      for (const recipientId of recipients) {
        const [recRows] = await db.execute('SELECT first_name, last_name, email FROM users WHERE id = ?', [recipientId]);
        const rec = (recRows as any[])[0];
        if (!rec) continue;
        const recName = `${rec.first_name || ''} ${rec.last_name || ''}`.trim();
        const [rRows] = await db.execute('SELECT 1 FROM students WHERE user_id = ?', [recipientId]);
        const recipientIsStudent = (rRows as any[]).length > 0;
        const preview = content.length > 150 ? content.substring(0, 150) + '...' : content;

        if (recipientIsStudent && !senderIsStudent) {
          notifySupervisorMessage(db, recipientId, rec.email, recName, senderName, subject, preview).catch(() => {});
        } else if (!recipientIsStudent && senderIsStudent) {
          notifyStudentMessage(db, recipientId, rec.email, recName, senderName, subject, preview).catch(() => {});
        } else {
          // Same role or admin - still create in-app notification
          const ns = new NotificationService(db);
          ns.create({
            userId: recipientId,
            title: `New message from ${senderName}`,
            message: preview,
            type: 'message_received',
            actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/messages`,
          }).catch(() => {});
        }
      }

      res.json({ success: true, data: { ids } });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ success: false, message: 'Failed to send message' });
    }
  });

  router.delete('/inbox', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const deleted = await messageService.clearInbox(userId);
      res.json({ success: true, data: { deleted }, message: `${deleted} message(s) cleared from inbox` });
    } catch (error) {
      console.error('Clear inbox error:', error);
      res.status(500).json({ success: false, message: 'Failed to clear inbox' });
    }
  });

  router.delete('/sent', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const deleted = await messageService.clearSent(userId);
      res.json({ success: true, data: { deleted }, message: `${deleted} message(s) cleared from sent` });
    } catch (error) {
      console.error('Clear sent error:', error);
      res.status(500).json({ success: false, message: 'Failed to clear sent messages' });
    }
  });

  router.put('/:id/read', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      await messageService.markRead(Number(req.params.id), userId);
      res.json({ success: true, message: 'Message marked as read' });
    } catch (error) {
      console.error('Read message error:', error);
      res.status(500).json({ success: false, message: 'Failed to update message' });
    }
  });

  return router;
}
