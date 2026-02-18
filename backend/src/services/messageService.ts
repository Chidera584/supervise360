import { Pool } from 'mysql2/promise';

export class MessageService {
  constructor(private db: Pool) {}

  async getInbox(userId: number) {
    const [rows] = await this.db.execute(
      `SELECT m.*, u.first_name, u.last_name, u.email as sender_email
       FROM messages m
       INNER JOIN users u ON m.sender_id = u.id
       WHERE m.recipient_id = ? AND m.archived = FALSE
       ORDER BY m.sent_at DESC`,
      [userId]
    );
    return rows as any[];
  }

  async getSent(userId: number) {
    const [rows] = await this.db.execute(
      `SELECT m.*, u.first_name, u.last_name, u.email as recipient_email
       FROM messages m
       INNER JOIN users u ON m.recipient_id = u.id
       WHERE m.sender_id = ?
       ORDER BY m.sent_at DESC`,
      [userId]
    );
    return rows as any[];
  }

  async sendMessage(payload: {
    senderId: number;
    recipientIds: number[];
    subject: string;
    content: string;
    messageType?: string;
    priority?: string;
  }) {
    const sent: number[] = [];
    for (const recipientId of payload.recipientIds) {
      const [result] = await this.db.execute(
        `INSERT INTO messages 
         (sender_id, recipient_id, subject, content, message_type, priority, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          payload.senderId,
          recipientId,
          payload.subject,
          payload.content,
          payload.messageType || 'direct',
          payload.priority || 'normal'
        ]
      );
      sent.push((result as any).insertId);
    }
    return sent;
  }

  async markRead(messageId: number, userId: number) {
    await this.db.execute(
      `UPDATE messages 
       SET read_status = TRUE, read_at = NOW()
       WHERE id = ? AND recipient_id = ?`,
      [messageId, userId]
    );
  }
}
