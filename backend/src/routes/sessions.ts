import { Router } from 'express';
import { Pool } from 'mysql2/promise';
import { authenticateToken, requireAdmin } from '../middleware/auth';

export function createSessionsRouter(db: Pool) {
  const router = Router();

  router.get('/', authenticateToken, async (_req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT id, label, starts_on, ends_on, is_active, created_at
         FROM academic_sessions
         ORDER BY id DESC`
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Sessions list error:', error);
      res.status(500).json({ success: false, message: 'Failed to list academic sessions' });
    }
  });

  router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { label, starts_on, ends_on, is_active } = req.body;
      if (!label || String(label).trim() === '') {
        return res.status(400).json({ success: false, message: 'label is required' });
      }
      const [r] = await db.execute(
        `INSERT INTO academic_sessions (label, starts_on, ends_on, is_active)
         VALUES (?, ?, ?, ?)`,
        [String(label).trim(), starts_on || null, ends_on || null, is_active !== false]
      );
      res.json({ success: true, data: { id: (r as any).insertId } });
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: 'A session with this label already exists' });
      }
      console.error('Session create error:', error);
      res.status(500).json({ success: false, message: 'Failed to create session' });
    }
  });

  return router;
}
