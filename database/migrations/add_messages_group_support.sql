-- Add group_id and parent_id to messages for group-based messaging
-- Run: mysql -u root -p supervise360 < database/migrations/add_messages_group_support.sql
-- Run once. If columns exist, you may need to comment out the ADD COLUMN lines.

-- Add group_id column (nullable - for group/broadcast messages)
ALTER TABLE messages ADD COLUMN group_id INT NULL AFTER recipient_id;
ALTER TABLE messages ADD CONSTRAINT fk_messages_group FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE SET NULL;

-- Add parent_id for reply threading (when supervisor replies, we use it to get group context)
ALTER TABLE messages ADD COLUMN parent_id INT NULL AFTER group_id;
ALTER TABLE messages ADD CONSTRAINT fk_messages_parent FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE SET NULL;

-- Update message_type ENUM to include student, group, broadcast
ALTER TABLE messages MODIFY COLUMN message_type ENUM('direct', 'group', 'announcement', 'student', 'broadcast') DEFAULT 'direct';

-- Index for group queries
CREATE INDEX idx_messages_group ON messages(group_id);
CREATE INDEX idx_messages_parent ON messages(parent_id);
