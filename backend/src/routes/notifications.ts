import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { authenticateToken } from '../middleware/auth';
import { NotificationService } from '../services/notificationService';
import { AuthenticatedRequest } from '../types';

const router = Router();

export function createNotificationsRouter(db: Pool) {
  const notificationService = new NotificationService(db);

  router.get('/unread-count', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const count = await notificationService.getUnreadCount(userId);
      res.json({ success: true, data: count });
    } catch (error) {
      console.error('Unread count error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
    }
  });

  router.get('/recent', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const limit = req.query.limit ? Number(req.query.limit) : 5;
      const data = await notificationService.listNotifications(userId, limit);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Recent notifications error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
  });

  router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const data = await notificationService.listNotifications(userId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Notifications error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
  });

  router.put('/:id/read', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      await notificationService.markRead(userId, Number(req.params.id));
      res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
      console.error('Mark notification read error:', error);
      res.status(500).json({ success: false, message: 'Failed to update notification' });
    }
  });

  router.put('/read-all', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      await notificationService.markAllRead(userId);
      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      console.error('Mark all notifications read error:', error);
      res.status(500).json({ success: false, message: 'Failed to update notifications' });
    }
  });

  router.delete('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      await notificationService.deleteAll(userId);
      res.json({ success: true, message: 'All notifications cleared' });
    } catch (error) {
      console.error('Clear all notifications error:', error);
      res.status(500).json({ success: false, message: 'Failed to clear notifications' });
    }
  });

  router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
      await notificationService.delete(userId, Number(req.params.id));
      res.json({ success: true, message: 'Notification cleared' });
    } catch (error) {
      console.error('Clear notification error:', error);
      res.status(500).json({ success: false, message: 'Failed to clear notification' });
    }
  });

  return router;
}
