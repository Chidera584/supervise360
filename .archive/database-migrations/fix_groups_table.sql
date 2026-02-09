-- ============================================
-- FIX FOR GROUPS TABLE (RESERVED KEYWORD ISSUE)
-- ============================================

-- If you already created the groups table, drop it first
-- DROP TABLE IF EXISTS groups;

-- Create the student_groups table (renamed from groups)
CREATE TABLE student_groups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_number INT NOT NULL UNIQUE,
    supervisor_id INT DEFAULT NULL,
    department VARCHAR(100) NOT NULL,
    max_members INT DEFAULT 3,
    current_members INT DEFAULT 0,
    is_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (supervisor_id) REFERENCES supervisors(id) ON DELETE SET NULL,
    CONSTRAINT chk_group_capacity CHECK (current_members <= max_members),
    
    INDEX idx_group_number (group_number),
    INDEX idx_supervisor (supervisor_id),
    INDEX idx_department (department),
    INDEX idx_complete (is_complete)
) ENGINE=InnoDB;

-- Add foreign key to students table
ALTER TABLE students 
ADD CONSTRAINT fk_student_group 
FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE SET NULL;

-- Continue with projects table
CREATE TABLE projects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    objectives TEXT,
    methodology TEXT,
    expected_outcomes TEXT,
    status ENUM('pending', 'approved', 'rejected', 'in_progress', 'completed') DEFAULT 'pending',
    rejection_reason TEXT,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE,
    CONSTRAINT chk_progress CHECK (progress_percentage >= 0.00 AND progress_percentage <= 100.00),
    
    INDEX idx_status (status),
    INDEX idx_group (group_id),
    INDEX idx_progress (progress_percentage)
) ENGINE=InnoDB;