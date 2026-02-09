-- ASP-based Group Formation Schema Updates
-- This file contains the database schema updates to support ASP-based group formation

-- Update groups table to include new fields
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS avg_gpa DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS formation_method ENUM('manual', 'asp') DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS formation_date TIMESTAMP NULL;

-- Create group_members table to store individual group members
CREATE TABLE IF NOT EXISTS group_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    student_gpa DECIMAL(3,2) NOT NULL,
    gpa_tier ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL,
    member_order INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    INDEX idx_group_members_group_id (group_id),
    INDEX idx_group_members_tier (gpa_tier),
    INDEX idx_group_members_order (member_order)
);

-- Create group_formation_logs table to track formation history
CREATE TABLE IF NOT EXISTS group_formation_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    formation_session_id VARCHAR(36) NOT NULL,
    total_students INT NOT NULL,
    high_tier_count INT NOT NULL,
    medium_tier_count INT NOT NULL,
    low_tier_count INT NOT NULL,
    groups_formed INT NOT NULL,
    formation_method ENUM('manual', 'asp') DEFAULT 'asp',
    admin_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_formation_logs_session (formation_session_id),
    INDEX idx_formation_logs_date (created_at)
);

-- Create supervisor_assignments table to track supervisor assignments
CREATE TABLE IF NOT EXISTS supervisor_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    supervisor_id INT NOT NULL,
    assigned_by INT,
    assignment_method ENUM('manual', 'auto') DEFAULT 'manual',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_group_supervisor (group_id, supervisor_id),
    INDEX idx_supervisor_assignments_group (group_id),
    INDEX idx_supervisor_assignments_supervisor (supervisor_id)
);

-- Create supervisor_capacity table to manage supervisor workload
CREATE TABLE IF NOT EXISTS supervisor_capacity (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supervisor_id INT NOT NULL,
    max_groups INT DEFAULT 3,
    current_groups INT DEFAULT 0,
    department VARCHAR(100),
    is_available BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_supervisor_capacity (supervisor_id),
    INDEX idx_supervisor_capacity_dept (department),
    INDEX idx_supervisor_capacity_available (is_available)
);

-- Insert default supervisor capacity for existing supervisors
INSERT IGNORE INTO supervisor_capacity (supervisor_id, max_groups, department)
SELECT id, 3, 'Computer Science' 
FROM users 
WHERE role IN ('supervisor', 'external_supervisor');

-- Create view for group details with members
CREATE OR REPLACE VIEW group_details AS
SELECT 
    g.id,
    g.name,
    g.avg_gpa,
    g.status,
    g.formation_method,
    g.formation_date,
    g.created_at,
    COUNT(gm.id) as member_count,
    GROUP_CONCAT(
        CONCAT(gm.student_name, ' (', gm.student_gpa, ', ', gm.gpa_tier, ')')
        ORDER BY gm.member_order ASC, gm.student_gpa DESC
        SEPARATOR '; '
    ) as members_list,
    SUM(CASE WHEN gm.gpa_tier = 'HIGH' THEN 1 ELSE 0 END) as high_tier_count,
    SUM(CASE WHEN gm.gpa_tier = 'MEDIUM' THEN 1 ELSE 0 END) as medium_tier_count,
    SUM(CASE WHEN gm.gpa_tier = 'LOW' THEN 1 ELSE 0 END) as low_tier_count,
    u.first_name as supervisor_first_name,
    u.last_name as supervisor_last_name,
    u.email as supervisor_email
FROM groups g
LEFT JOIN group_members gm ON g.id = gm.group_id
LEFT JOIN supervisor_assignments sa ON g.id = sa.group_id
LEFT JOIN users u ON sa.supervisor_id = u.id
GROUP BY g.id;

-- Create view for supervisor workload
CREATE OR REPLACE VIEW supervisor_workload AS
SELECT 
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    sc.max_groups,
    sc.current_groups,
    sc.department,
    sc.is_available,
    (sc.max_groups - sc.current_groups) as available_slots,
    ROUND((sc.current_groups / sc.max_groups) * 100, 2) as workload_percentage
FROM users u
JOIN supervisor_capacity sc ON u.id = sc.supervisor_id
WHERE u.role IN ('supervisor', 'external_supervisor');

-- Triggers to maintain supervisor capacity
DELIMITER //

CREATE TRIGGER IF NOT EXISTS update_supervisor_capacity_on_assignment
AFTER INSERT ON supervisor_assignments
FOR EACH ROW
BEGIN
    UPDATE supervisor_capacity 
    SET current_groups = current_groups + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE supervisor_id = NEW.supervisor_id;
END//

CREATE TRIGGER IF NOT EXISTS update_supervisor_capacity_on_unassignment
AFTER DELETE ON supervisor_assignments
FOR EACH ROW
BEGIN
    UPDATE supervisor_capacity 
    SET current_groups = GREATEST(current_groups - 1, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE supervisor_id = OLD.supervisor_id;
END//

DELIMITER ;

-- Insert sample data for testing (optional)
-- This can be removed in production

-- Sample group formation log
INSERT IGNORE INTO group_formation_logs 
(formation_session_id, total_students, high_tier_count, medium_tier_count, low_tier_count, groups_formed, formation_method)
VALUES 
('sample-session-001', 9, 3, 3, 3, 3, 'asp');

-- Update existing groups to have proper structure
UPDATE groups 
SET formation_method = 'manual', 
    formation_date = created_at 
WHERE formation_method IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_groups_formation_method ON groups(formation_method);
CREATE INDEX IF NOT EXISTS idx_groups_status ON groups(status);
CREATE INDEX IF NOT EXISTS idx_groups_avg_gpa ON groups(avg_gpa);

-- Add constraints to ensure data integrity
ALTER TABLE group_members 
ADD CONSTRAINT IF NOT EXISTS chk_gpa_range 
CHECK (student_gpa >= 0.0 AND student_gpa <= 5.0);

ALTER TABLE supervisor_capacity 
ADD CONSTRAINT IF NOT EXISTS chk_max_groups_positive 
CHECK (max_groups > 0);

ALTER TABLE supervisor_capacity 
ADD CONSTRAINT IF NOT EXISTS chk_current_groups_non_negative 
CHECK (current_groups >= 0);