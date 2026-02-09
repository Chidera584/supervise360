-- Simple schema fix for supervisor assignment issues
-- Avoiding reserved keywords and complex triggers

USE supervise360;

-- 1. Create the missing 'project_groups' table (avoiding 'groups' reserved keyword)
CREATE TABLE IF NOT EXISTS project_groups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    avg_gpa DECIMAL(3,2),
    status ENUM('formed', 'active', 'completed') DEFAULT 'formed',
    supervisor_id INT DEFAULT NULL,
    supervisor_name VARCHAR(255) DEFAULT NULL,
    department VARCHAR(100),
    formation_method ENUM('manual', 'asp') DEFAULT 'asp',
    formation_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_project_groups_status (status),
    INDEX idx_project_groups_department (department),
    INDEX idx_project_groups_supervisor (supervisor_id),
    INDEX idx_project_groups_supervisor_name (supervisor_name)
) ENGINE=InnoDB;

-- 2. Create the missing group_members table
CREATE TABLE IF NOT EXISTS group_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    student_gpa DECIMAL(3,2),
    gpa_tier ENUM('HIGH', 'MEDIUM', 'LOW'),
    member_order INT DEFAULT 1,
    matric_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE,
    INDEX idx_group_members_group_id (group_id),
    INDEX idx_group_members_tier (gpa_tier),
    INDEX idx_group_members_order (member_order),
    INDEX idx_group_members_matric (matric_number)
) ENGINE=InnoDB;

-- 3. Create supervisor_workload table
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
    INDEX idx_supervisor_workload_available (is_available),
    INDEX idx_supervisor_workload_name (supervisor_name)
) ENGINE=InnoDB;

-- 4. Insert test supervisors
INSERT IGNORE INTO supervisor_workload (supervisor_name, department, max_groups, current_groups) VALUES
('Dr. John Smith', 'Computer Science', 3, 0),
('Prof. Mary Johnson', 'Computer Science', 4, 0),
('Dr. David Wilson', 'Computer Science', 3, 0);

-- 5. Create view for unified groups
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
FROM project_groups g
LEFT JOIN group_members gm ON g.id = gm.group_id
GROUP BY g.id;

-- 6. Create view for complete supervisor workload
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
    s.id + 10000 as id,
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