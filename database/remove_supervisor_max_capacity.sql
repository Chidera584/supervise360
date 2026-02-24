-- Remove max capacity from supervisor workload (equal workload distribution)
-- Run after clearing supervisor list. Run each statement separately; ignore errors if object doesn't exist.

-- 1. supervisor_workload: remove max_groups column
ALTER TABLE supervisor_workload DROP COLUMN max_groups;

-- 2. supervisors table: drop constraints that reference max_capacity, then drop column
ALTER TABLE supervisors DROP CONSTRAINT IF EXISTS chk_capacity;
ALTER TABLE supervisors DROP CONSTRAINT IF EXISTS chk_max_capacity;
ALTER TABLE supervisors DROP COLUMN max_capacity;
