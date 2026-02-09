-- Fix schema mismatch issues for supervisor assignment and group formation
-- This script addresses the critical database schema issues identified

USE supervise360;

-- 1. Create the missing 'groups' table that the frontend code expects
-- This will coexist with student_groups for now, but groups will be the primary table
CREATE TABLE IF NOT EXISTS groups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    avg_gpa DECIMAL(3,2),
    status ENUM('formed', 'active', 'completed') DEFAULT 'formed',
    supervisor_id INT DEFAULT NULL,
    department VARCHAR(100),
    formation_method ENUM('manual', 'asp') DEFAULT 'asp',
    formation_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_groups_status (status),
    INDEX idx_groups_department (department),
    INDEX idx_groups_supervisor (supervisor_id)
) ENGINE=InnoDB;

-- 2. Create the missing group_members table for ASP group formation
CREATE TABLE IF NOT EXISTS group_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    student_gpa DECIMAL(3,2),
    gpa_tier ENUM('HIGH', 'MEDIUM', 'LOW'),
    member_order INT DEFAULT 1,
    matric_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    INDEX idx_group_members_group_id (group_id),
    INDEX idx_group_members_tier (gpa_tier),
    INDEX idx_group_members_order (member_order),
    INDEX idx_group_members_matric (matric_number)
) ENGINE=InnoDB;

-- 3. Create supervisor_workload table for tracking supervisor assignments
CREATE TABLE IF NOT EXISTS supervisor_workload (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supervisor_name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    max_groups INT DEFAULT 3,
    current_groups INT DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_supervisor_workload_dept (department),
    INDEX idx_supervisor_workload_available (is_available)
) ENGINE=InnoDB;

-- 4. Update groups table to include supervisor name (for compatibility with frontend)
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS supervisor_name VARCHAR(255) DEFAULT NULL;

-- 5. Create view to bridge the gap between groups and student_groups
CREATE OR REPLACE VIEW v_unified_groups AS
SELECT 
    g.id,
    g.name,
    g.avg_gpa,
    g.status,
    g.supervisor_id,
    g.supervisor_name,
    g.department,
    g.formation_method,
    g.created_at,
    COUNT(gm.id) as member_count,
    GROUP_CONCAT(
        CONCAT(gm.student_name, ' (', COALESCE(gm.matric_number, 'N/A'), ')')
        ORDER BY gm.member_order ASC
        SEPARATOR ', '
    ) as members_list
FROM groups g
LEFT JOIN group_members gm ON g.id = gm.group_id
GROUP BY g.id;

-- 6. Create view for supervisor workload that combines uploaded and database supervisors
CREATE OR REPLACE VIEW v_supervisor_workload_complete AS
SELECT 
    sw.id,
    sw.supervisor_name as name,
    sw.department,
    sw.max_groups,
    sw.current_groups,
    sw.is_available,
    (sw.max_groups - sw.current_groups) as available_slots,
    CASE 
        WHEN sw.max_groups > 0 THEN ROUND((sw.current_groups / sw.max_groups) * 100, 2)
        ELSE 0
    END as workload_percentage
FROM supervisor_workload sw
UNION ALL
SELECT 
    s.id + 10000 as id, -- Offset to avoid ID conflicts
    CONCAT(u.first_name, ' ', u.last_name) as name,
    s.department,
    s.max_capacity as max_groups,
    s.current_load as current_groups,
    s.is_available,
    (s.max_capacity - s.current_load) as available_slots,
    CASE 
        WHEN s.max_capacity > 0 THEN ROUND((s.current_load / s.max_capacity) * 100, 2)
        ELSE 0
    END as workload_percentage
FROM supervisors s
JOIN users u ON s.user_id = u.id
WHERE u.role IN ('supervisor', 'external_supervisor');

-- 7. Insert some test data to verify the schema works
-- This will be replaced by actual uploaded data

-- Test supervisors
INSERT IGNORE INTO supervisor_workload (supervisor_name, department, max_groups, current_groups) VALUES
('Dr. John Smith', 'Computer Science', 3, 0),
('Prof. Mary Johnson', 'Computer Science', 4, 0),
('Dr. David Wilson', 'Computer Science', 3, 0);

-- 8. Create triggers to maintain supervisor workload when groups are assigned
DELIMITER //

CREATE TRIGGER IF NOT EXISTS update_supervisor_workload_on_group_assignment
AFTER UPDATE ON groups
FOR EACH ROW
BEGIN
    -- If supervisor was assigned (changed from NULL to a name)
    IF OLD.supervisor_name IS NULL AND NEW.supervisor_name IS NOT NULL THEN
        UPDATE supervisor_workload 
        SET current_groups = current_groups + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE supervisor_name = NEW.supervisor_name;
    END IF;
    
    -- If supervisor was changed
    IF OLD.supervisor_name IS NOT NULL AND NEW.supervisor_name IS NOT NULL AND OLD.supervisor_name != NEW.supervisor_name THEN
        -- Decrease old supervisor's load
        UPDATE supervisor_workload 
        SET current_groups = GREATEST(current_groups - 1, 0),
            updated_at = CURRENT_TIMESTAMP
        WHERE supervisor_name = OLD.supervisor_name;
        
        -- Increase new supervisor's load
        UPDATE supervisor_workload 
        SET current_groups = current_groups + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE supervisor_name = NEW.supervisor_name;
    END IF;
    
    -- If supervisor was removed
    IF OLD.supervisor_name IS NOT NULL AND NEW.supervisor_name IS NULL THEN
        UPDATE supervisor_workload 
        SET current_groups = GREATEST(current_groups - 1, 0),
            updated_at = CURRENT_TIMESTAMP
        WHERE supervisor_name = OLD.supervisor_name;
    END IF;
END//

DELIMITER ;

-- 9. Add constraints for data integrity
ALTER TABLE groups 
ADD CONSTRAINT IF NOT EXISTS chk_groups_avg_gpa 
CHECK (avg_gpa IS NULL OR (avg_gpa >= 0.0 AND avg_gpa <= 5.0));

ALTER TABLE group_members 
ADD CONSTRAINT IF NOT EXISTS chk_group_members_gpa 
CHECK (student_gpa IS NULL OR (student_gpa >= 0.0 AND student_gpa <= 5.0));

ALTER TABLE supervisor_workload 
ADD CONSTRAINT IF NOT EXISTS chk_supervisor_workload_capacity 
CHECK (max_groups > 0 AND current_groups >= 0 AND current_groups <= max_groups);

-- 10. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
CREATE INDEX IF NOT EXISTS idx_groups_supervisor_name ON groups(supervisor_name);
CREATE INDEX IF NOT EXISTS idx_group_members_name ON group_members(student_name);

COMMIT;