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

  router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
      }
      const { label, starts_on, ends_on, is_active } = req.body;
      const updates: string[] = [];
      const vals: unknown[] = [];
      if (label !== undefined) {
        const trimmed = String(label).trim();
        if (trimmed === '') {
          return res.status(400).json({ success: false, message: 'label cannot be empty' });
        }
        updates.push('label = ?');
        vals.push(trimmed);
      }
      if (starts_on !== undefined) {
        updates.push('starts_on = ?');
        vals.push(starts_on || null);
      }
      if (ends_on !== undefined) {
        updates.push('ends_on = ?');
        vals.push(ends_on || null);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        vals.push(!!is_active);
      }
      if (updates.length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }
      vals.push(id);
      await db.execute(
        `UPDATE academic_sessions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        vals
      );
      res.json({ success: true, message: 'Session updated' });
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: 'A session with this label already exists' });
      }
      console.error('Session update error:', error);
      res.status(500).json({ success: false, message: 'Failed to update session' });
    }
  });

  router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
      }
      const [pg] = await db.execute(
        'SELECT COUNT(*) as c FROM project_groups WHERE session_id = ?',
        [id]
      );
      const [st] = await db.execute('SELECT COUNT(*) as c FROM students WHERE session_id = ?', [id]);
      const pgC = Number((pg as any[])[0]?.c ?? 0);
      const stC = Number((st as any[])[0]?.c ?? 0);
      if (pgC > 0 || stC > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete session: ${pgC} group(s) and ${stC} student(s) still reference it. Reassign or remove them first.`,
        });
      }
      await db.execute('DELETE FROM academic_sessions WHERE id = ?', [id]);
      res.json({ success: true, message: 'Session removed' });
    } catch (error) {
      console.error('Session delete error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete session' });
    }
  });

  return router;
}
