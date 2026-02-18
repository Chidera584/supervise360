import { Pool } from 'mysql2/promise';

export class NotificationService {
  constructor(private db: Pool) {}

  async listNotifications(userId: number, limit?: number) {
    const [rows] = await this.db.execute(
      `SELECT * FROM notifications 
       WHERE user_id = ?
       ORDER BY created_at DESC
       ${limit ? 'LIMIT ' + Number(limit) : ''}`,
      [userId]
    );
    return rows as any[];
  }

  async markRead(userId: number, notificationId: number) {
    await this.db.execute(
      `UPDATE notifications 
       SET read_status = TRUE, read_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );
  }

  async markAllRead(userId: number) {
    await this.db.execute(
      `UPDATE notifications 
       SET read_status = TRUE, read_at = NOW()
       WHERE user_id = ? AND read_status = FALSE`,
      [userId]
    );
  }
}
