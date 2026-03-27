import { Pool } from 'mysql2/promise';

const CREATE_MESSAGES_SQL = `
CREATE TABLE IF NOT EXISTS messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sender_id INT NOT NULL,
  recipient_id INT NOT NULL,
  group_id INT NULL,
  parent_id INT NULL,
  subject VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  message_type ENUM('direct', 'group', 'announcement', 'student', 'broadcast') DEFAULT 'direct',
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  read_status BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  INDEX idx_sender (sender_id),
  INDEX idx_recipient (recipient_id),
  INDEX idx_messages_group (group_id),
  INDEX idx_messages_parent (parent_id),
  INDEX idx_read_status (read_status),
  INDEX idx_sent_at (sent_at),
  INDEX idx_type (message_type),
  INDEX idx_priority (priority)
) ENGINE=InnoDB`;

export type Contact = {
  id: number;
  name: string;
  email: string;
  label?: string;
  type?: 'user' | 'group' | 'broadcast';
};

export class MessageService {
  constructor(private db: Pool) {}

  private async ensureTable() {
    try {
      await this.db.execute(CREATE_MESSAGES_SQL);
    } catch (e) {
      // Ignore if table already exists or cannot be created in this environment
      console.warn('Messages ensureTable warning:', (e as Error).message);
    }
  }

  /**
   * Resolve the registered supervisor user for a group's messaging recipient.
   * Prefer project_groups.supervisor_id → supervisors.user_id; otherwise match name only among
   * users linked to the supervisors table (never arbitrary non-supervisor users).
   */
  private async resolveSupervisorUserForGroup(
    groupId: number
  ): Promise<{ id: number; first_name: string; last_name: string; email: string } | null> {
    const [pgRows] = await this.db.execute(
      `SELECT supervisor_name, supervisor_id, department FROM project_groups WHERE id = ? LIMIT 1`,
      [groupId]
    );
    const pg = (pgRows as any[])[0];
    if (!pg) return null;

    const sidRaw = pg.supervisor_id;
    if (sidRaw != null && sidRaw !== '' && !Number.isNaN(Number(sidRaw))) {
      const sid = Number(sidRaw);
      if (sid > 0) {
        const [bySupPk] = await this.db.execute(
          `SELECT u.id, u.first_name, u.last_name, u.email
           FROM supervisors s INNER JOIN users u ON u.id = s.user_id WHERE s.id = ? LIMIT 1`,
          [sid]
        );
        const u1 = (bySupPk as any[])[0];
        if (u1) return u1;
        const [byUserId] = await this.db.execute(
          `SELECT u.id, u.first_name, u.last_name, u.email
           FROM users u
           INNER JOIN supervisors s ON s.user_id = u.id
           WHERE u.id = ? LIMIT 1`,
          [sid]
        );
        const u2 = (byUserId as any[])[0];
        if (u2) return u2;
      }
    }

    const supervisorName = pg.supervisor_name;
    if (!supervisorName || !String(supervisorName).trim()) return null;

    let sn = String(supervisorName).trim();
    if (sn.includes(',')) {
      const commaParts = sn.split(',').map((s: string) => s.trim());
      if (commaParts.length >= 2 && commaParts[0] && commaParts[1]) {
        sn = `${commaParts[1]} ${commaParts[0]}`;
      }
    }
    const snNorm = sn.replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Engr\.?)\s+/i, '').trim();

    const [exactRows] = await this.db.execute(
      `SELECT u.id, u.first_name, u.last_name, u.email
       FROM users u
       INNER JOIN supervisors s ON s.user_id = u.id
       WHERE TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) = TRIM(?)
          OR TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) = TRIM(?)
       LIMIT 1`,
      [sn, snNorm]
    );
    let u = (exactRows as any[])[0];
    if (u) return u;

    const dept = pg.department ? String(pg.department).trim() : '';
    if (dept) {
      const [deptRows] = await this.db.execute(
        `SELECT u.id, u.first_name, u.last_name, u.email
         FROM users u
         INNER JOIN supervisors s ON s.user_id = u.id
         WHERE (TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) = TRIM(?)
            OR TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) = TRIM(?))
           AND TRIM(COALESCE(s.department,'')) = TRIM(?)
         LIMIT 1`,
        [sn, snNorm, dept]
      );
      u = (deptRows as any[])[0];
      if (u) return u;
    }

    const [likeRows] = await this.db.execute(
      `SELECT u.id, u.first_name, u.last_name, u.email
       FROM users u
       INNER JOIN supervisors s ON s.user_id = u.id
       WHERE TRIM(COALESCE(u.first_name,'')) != '' AND TRIM(COALESCE(u.last_name,'')) != ''
         AND ? LIKE CONCAT('%', TRIM(u.first_name), '%')
         AND ? LIKE CONCAT('%', TRIM(u.last_name), '%')
       ORDER BY
         CASE WHEN TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) = TRIM(?) THEN 0 ELSE 1 END,
         CASE WHEN TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) = TRIM(?) THEN 0 ELSE 1 END,
         u.id ASC
       LIMIT 1`,
      [sn, sn, sn, snNorm]
    );
    u = (likeRows as any[])[0];
    if (u) return u;

    // Account exists as supervisor role but no row in supervisors table (exact name only)
    const [roleRows] = await this.db.execute(
      `SELECT u.id, u.first_name, u.last_name, u.email FROM users u
       WHERE u.role IN ('supervisor', 'external_supervisor')
         AND (TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) = TRIM(?)
           OR TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) = TRIM(?))
       LIMIT 1`,
      [sn, snNorm]
    );
    u = (roleRows as any[])[0];
    return u || null;
  }

  /** Get user IDs for all members of a group (students with user accounts) */
  async getGroupMemberUserIds(groupId: number): Promise<number[]> {
    const [memberRows] = await this.db.execute(
      'SELECT matric_number, student_name FROM group_members WHERE group_id = ?',
      [groupId]
    );
    const userIds: number[] = [];
    for (const m of (memberRows as any[])) {
      let uid: number | undefined;
      if (m.matric_number) {
        const [sRows] = await this.db.execute(
          'SELECT user_id FROM students WHERE matric_number = ? OR TRIM(matric_number) = TRIM(?)',
          [m.matric_number, m.matric_number]
        );
        uid = (sRows as any[])[0]?.user_id;
      }
      if (!uid && m.student_name) {
        const parts = String(m.student_name).trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 1) {
          const [uRows] = await this.db.execute(
            `SELECT u.id FROM users u INNER JOIN students s ON s.user_id = u.id
             WHERE (TRIM(CONCAT(u.first_name,' ',u.last_name)) = ? OR u.first_name LIKE ? OR u.last_name LIKE ?) LIMIT 1`,
            [m.student_name.trim(), `%${parts[0]}%`, `%${parts[parts.length - 1]}%`]
          );
          uid = (uRows as any[])[0]?.id;
        }
      }
      if (uid) userIds.push(uid);
    }
    return [...new Set(userIds)];
  }

  /** Get message by ID (for reply context) */
  async getMessageById(messageId: number): Promise<{ sender_id: number; group_id?: number } | null> {
    const [rows] = await this.db.execute('SELECT sender_id, group_id FROM messages WHERE id = ?', [messageId]);
    return (rows as any[])[0] || null;
  }

  /** Get list of contacts for messaging. Students: supervisor only. Supervisors: groups + broadcast. */
  async getContacts(
    _db: Pool,
    groupService: { getGroupByMatricNumber(matric: string): Promise<{ id?: number } | null> },
    reportService: { getSupervisorGroupIds(supervisorUserId: number): Promise<number[]> },
    userId: number,
    role: string,
    _groupId?: number
  ): Promise<Contact[]> {
    const contacts: Contact[] = [];
    const seen = new Set<number>();

    const addUser = (id: number, name: string, email: string, label?: string) => {
      if (id === userId || seen.has(id)) return;
      seen.add(id);
      contacts.push({ id, name, email, label, type: 'user' });
    };

    const addGroup = (groupId: number, name: string) => {
      if (seen.has(100000 + groupId)) return;
      seen.add(100000 + groupId);
      contacts.push({ id: groupId, name, email: '', label: 'Group', type: 'group' });
    };

    const addBroadcast = () => {
      contacts.push({ id: -1, name: 'All My Groups', email: '', label: 'Broadcast', type: 'broadcast' });
    };

    if (role === 'student') {
      // Student: only their supervisor (no group members)
      const [studentRows] = await this.db.execute('SELECT matric_number FROM students WHERE user_id = ?', [userId]);
      const matric = (studentRows as any[])[0]?.matric_number;
      let group = matric && String(matric).trim()
        ? await groupService.getGroupByMatricNumber(String(matric).trim())
        : null;
      // Fallback: matric may not match (format diff between registration vs CSV) - try by student name
      if (!group || group.id == null) {
        const [userRows] = await this.db.execute('SELECT first_name, last_name FROM users WHERE id = ?', [userId]);
        const u = (userRows as any[])[0];
        const fullName = u ? `${(u.first_name || '')} ${(u.last_name || '')}`.trim().replace(/\s+/g, ' ') : '';
        if (fullName) {
          const [gmRows] = await this.db.execute(
            `SELECT gm.group_id FROM group_members gm
             WHERE TRIM(COALESCE(gm.student_name,'')) = ? OR gm.student_name LIKE ? OR gm.student_name LIKE ?`,
            [fullName, `%${fullName.split(' ')[0]}%`, `%${fullName.split(' ').pop()}%`]
          );
          const gid = (gmRows as any[])[0]?.group_id;
          if (gid) {
            const [pgRows] = await this.db.execute('SELECT id, supervisor_name FROM project_groups WHERE id = ?', [gid]);
            const pg = (pgRows as any[])[0];
            if (pg) group = { id: pg.id, supervisor: pg.supervisor_name } as any;
          }
        }
      }
      if (!group || group.id == null) return contacts;

      const resolved = await this.resolveSupervisorUserForGroup(group.id);
      if (resolved) {
        addUser(
          resolved.id,
          `${resolved.first_name || ''} ${resolved.last_name || ''}`.trim(),
          resolved.email || '',
          'Supervisor'
        );
      }
    } else if (role === 'supervisor') {
      // Supervisor: groups as contacts (message goes to all in group) + "All My Groups" broadcast
      const groupIds = await reportService.getSupervisorGroupIds(userId);
      if (groupIds.length === 0) return contacts;

      for (const gid of groupIds) {
        const [groupRows] = await this.db.execute('SELECT name FROM project_groups WHERE id = ?', [gid]);
        const groupName = (groupRows as any[])[0]?.name || `Group ${gid}`;
        addGroup(gid, groupName);
      }
      if (groupIds.length > 1) addBroadcast();
    }
    return contacts;
  }

  async getInbox(userId: number) {
    await this.ensureTable();
    const [rows] = await this.db.execute(
      `SELECT m.*, u.first_name, u.last_name, u.email as sender_email,
              COALESCE(
                (SELECT pg.name FROM students st
                 INNER JOIN group_members gm ON gm.matric_number = st.matric_number
                 INNER JOIN project_groups pg ON pg.id = gm.group_id
                 WHERE st.user_id = m.sender_id LIMIT 1),
                (SELECT pg.name FROM group_members gm
                 INNER JOIN project_groups pg ON pg.id = gm.group_id
                 WHERE TRIM(COALESCE(gm.student_name,'')) = TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')))
                    OR gm.student_name LIKE CONCAT('%', u.first_name, '%', u.last_name, '%')
                    OR gm.student_name LIKE CONCAT('%', u.last_name, '%', u.first_name, '%')
                 LIMIT 1)
              ) as sender_group_name
       FROM messages m
       INNER JOIN users u ON m.sender_id = u.id
       WHERE m.recipient_id = ? AND (m.archived = FALSE OR m.archived IS NULL)
       ORDER BY m.sent_at DESC`,
      [userId]
    );
    return rows as any[];
  }

  async getSent(userId: number) {
    await this.ensureTable();
    const [rows] = await this.db.execute(
      `SELECT m.*, u.first_name, u.last_name, u.email as recipient_email,
              COALESCE(
                (SELECT pg.name FROM students st
                 INNER JOIN group_members gm ON gm.matric_number = st.matric_number
                 INNER JOIN project_groups pg ON pg.id = gm.group_id
                 WHERE st.user_id = m.recipient_id LIMIT 1),
                (SELECT pg.name FROM group_members gm
                 INNER JOIN project_groups pg ON pg.id = gm.group_id
                 WHERE TRIM(COALESCE(gm.student_name,'')) = TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')))
                    OR gm.student_name LIKE CONCAT('%', u.first_name, '%', u.last_name, '%')
                    OR gm.student_name LIKE CONCAT('%', u.last_name, '%', u.first_name, '%')
                 LIMIT 1)
              ) as recipient_group_name
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
    groupId?: number;
    parentId?: number;
  }) {
    await this.ensureTable();
    const sent: number[] = [];
    const msgType = payload.messageType || 'direct';
    const groupId = payload.groupId ?? null;
    const parentId = payload.parentId ?? null;

    for (const recipientId of payload.recipientIds) {
      try {
        const [result] = await this.db.execute(
          `INSERT INTO messages 
           (sender_id, recipient_id, group_id, parent_id, subject, content, message_type, priority, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            payload.senderId,
            recipientId,
            groupId,
            parentId,
            payload.subject,
            payload.content,
            msgType,
            payload.priority || 'normal'
          ]
        );
        sent.push((result as any).insertId);
      } catch (e) {
        console.error('Messages insert error, falling back to minimal schema:', (e as Error).message);
        const [result] = await this.db.execute(
          `INSERT INTO messages (sender_id, recipient_id, subject, content, sent_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [payload.senderId, recipientId, payload.subject, payload.content]
        );
        sent.push((result as any).insertId);
      }
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

  async clearInbox(userId: number): Promise<number> {
    const [result] = await this.db.execute(
      'DELETE FROM messages WHERE recipient_id = ?',
      [userId]
    );
    return (result as any).affectedRows ?? 0;
  }

  async clearSent(userId: number): Promise<number> {
    const [result] = await this.db.execute(
      'DELETE FROM messages WHERE sender_id = ?',
      [userId]
    );
    return (result as any).affectedRows ?? 0;
  }
}
