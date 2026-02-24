import { Pool } from 'mysql2/promise';

export type NotificationType =
  | 'group_formed'
  | 'supervisor_assigned'
  | 'project_submitted'
  | 'project_approved'
  | 'project_rejected'
  | 'report_submitted'
  | 'report_reviewed'
  | 'evaluation_completed'
  | 'message_received'
  | 'defense_scheduled'
  | 'defense_reminder'
  | 'system_update'
  | 'deadline_reminder';

export interface CreateNotificationInput {
  userId: number;
  title: string;
  message: string;
  type: NotificationType;
  priority?: 'low' | 'normal' | 'high';
  relatedId?: number;
  actionUrl?: string;
}

export class NotificationService {
  constructor(private db: Pool) {}

  async create(input: CreateNotificationInput): Promise<number | null> {
    try {
      const [result] = await this.db.execute(
        `INSERT INTO notifications (user_id, title, message, type, priority, related_id, action_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.userId,
          input.title,
          input.message,
          input.type === 'report_reviewed' ? 'evaluation_completed' : input.type,
          input.priority || 'normal',
          input.relatedId ?? null,
          input.actionUrl ?? null,
        ]
      );
      return (result as any).insertId ?? null;
    } catch (err) {
      console.error('Create notification error:', err);
      return null;
    }
  }

  async getUnreadCount(userId: number): Promise<number> {
    const [rows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND (read_status = FALSE OR read_status IS NULL)',
      [userId]
    );
    return Number((rows as any[])[0]?.count) || 0;
  }

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
