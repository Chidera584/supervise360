-- Add matric_number column to group_members for student identification
-- Run this migration to enable matric-based student lookup
-- Ignore error if column already exists

USE supervise360;

ALTER TABLE group_members ADD COLUMN matric_number VARCHAR(50) NULL AFTER member_order;
ALTER TABLE group_members ADD INDEX idx_matric_number (matric_number);
