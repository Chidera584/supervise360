import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { authenticateToken } from '../middleware/auth';
import { MessageService } from '../services/messageService';
import { AuthenticatedRequest } from '../types';

const router = Router();

export function createMessagesRouter(db: Pool) {
  const messageService = new MessageService(db);

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
      const { recipient_id, recipient_ids, subject, content, message_type, priority } = req.body;
      if (!subject || !content) {
        return res.status(400).json({ success: false, message: 'Subject and content are required' });
      }
      const recipients = Array.isArray(recipient_ids)
        ? recipient_ids
        : recipient_id
          ? [recipient_id]
          : [];
      if (recipients.length === 0) {
        return res.status(400).json({ success: false, message: 'Recipient is required' });
      }
      const ids = await messageService.sendMessage({
        senderId: userId,
        recipientIds: recipients,
        subject,
        content,
        messageType: message_type,
        priority
      });
      res.json({ success: true, data: { ids } });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ success: false, message: 'Failed to send message' });
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
