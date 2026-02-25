-- ============================================
-- SUPERVISE360 DATABASE SCHEMA (IMPROVED VERSION)
-- ============================================

-- Drop existing database if needed (use carefully!)
-- DROP DATABASE IF EXISTS supervise360;

CREATE DATABASE IF NOT EXISTS supervise360 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE supervise360;

-- ============================================
-- 1. USERS TABLE (Base table for all users)
-- ============================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'supervisor', 'student', 'external_supervisor') NOT NULL,
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_department (department),
    INDEX idx_active (is_active)
) ENGINE=InnoDB;

-- ============================================
-- 2. STUDENTS TABLE
-- ============================================
CREATE TABLE students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    matric_number VARCHAR(50) NOT NULL UNIQUE,
    gpa DECIMAL(3, 2) NOT NULL,
    gpa_tier ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL,
    group_id INT DEFAULT NULL,
    academic_year VARCHAR(20) DEFAULT NULL,
    program VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_gpa_range CHECK (gpa >= 0.00 AND gpa <= 5.00),
    
    INDEX idx_gpa_tier (gpa_tier),
    INDEX idx_group_id (group_id),
    INDEX idx_matric (matric_number),
    INDEX idx_academic_year (academic_year)
) ENGINE=InnoDB;

-- ============================================
-- 3. SUPERVISORS TABLE
-- ============================================
CREATE TABLE supervisors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    department VARCHAR(100) NOT NULL,
    max_capacity INT DEFAULT 7,
    current_load INT DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    specialization TEXT,
    office_location VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_capacity CHECK (current_load <= max_capacity),
    CONSTRAINT chk_max_capacity CHECK (max_capacity > 0),
    
    INDEX idx_department (department),
    INDEX idx_availability (is_available),
    INDEX idx_workload (current_load, max_capacity)
) ENGINE=InnoDB;

-- ============================================
-- 4. STUDENT_GROUPS TABLE (renamed from groups - reserved keyword)
-- ============================================
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

-- Add foreign key to students table after student_groups is created
ALTER TABLE students 
ADD CONSTRAINT fk_student_group 
FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE SET NULL;

-- ============================================
-- 5. PROJECTS TABLE
-- ============================================
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

-- ============================================
-- 6. REPORTS TABLE
-- ============================================
CREATE TABLE reports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    group_id INT NOT NULL,
    report_type ENUM('proposal', 'progress', 'final', 'other') NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT,
    mime_type VARCHAR(100),
    submitted_by INT NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    review_comments TEXT,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_project (project_id),
    INDEX idx_group (group_id),
    INDEX idx_type (report_type),
    INDEX idx_reviewed (reviewed),
    INDEX idx_submitted_at (submitted_at)
) ENGINE=InnoDB;

-- ============================================
-- 7. EVALUATIONS TABLE
-- ============================================
CREATE TABLE evaluations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    supervisor_id INT NOT NULL,
    evaluation_type ENUM('internal', 'external') NOT NULL,
    
    -- Scoring criteria (0-100 scale)
    documentation_score DECIMAL(5, 2) DEFAULT NULL,
    implementation_score DECIMAL(5, 2) DEFAULT NULL,
    presentation_score DECIMAL(5, 2) DEFAULT NULL,
    innovation_score DECIMAL(5, 2) DEFAULT NULL,
    total_score DECIMAL(5, 2) DEFAULT NULL,
    grade CHAR(2) DEFAULT NULL, --  A, B, C, D, E, F
    
    feedback TEXT,
    strengths TEXT,
    weaknesses TEXT,
    recommendations TEXT,
    
    evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (supervisor_id) REFERENCES supervisors(id) ON DELETE CASCADE,
    
    -- Ensure only one evaluation per supervisor per project per type
    UNIQUE KEY unique_evaluation (project_id, supervisor_id, evaluation_type),
    
    CONSTRAINT chk_scores CHECK (
        (documentation_score IS NULL OR (documentation_score >= 0 AND documentation_score <= 100)) AND
        (implementation_score IS NULL OR (implementation_score >= 0 AND implementation_score <= 100)) AND
        (presentation_score IS NULL OR (presentation_score >= 0 AND presentation_score <= 100)) AND
        (innovation_score IS NULL OR (innovation_score >= 0 AND innovation_score <= 100)) AND
        (total_score IS NULL OR (total_score >= 0 AND total_score <= 400))
    ),
    
    INDEX idx_project (project_id),
    INDEX idx_supervisor (supervisor_id),
    INDEX idx_type (evaluation_type),
    INDEX idx_grade (grade)
) ENGINE=InnoDB;

-- ============================================
-- 8. DEFENSE_PANELS TABLE
-- ============================================
CREATE TABLE defense_panels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_number INT NOT NULL UNIQUE,
    project_id INT NOT NULL,
    internal_supervisor_id INT NOT NULL,
    external_supervisor_id INT,
    defense_date DATETIME NOT NULL,
    location VARCHAR(255) NOT NULL,
    duration_minutes INT DEFAULT 60,
    status ENUM('scheduled', 'completed', 'cancelled', 'rescheduled') DEFAULT 'scheduled',
    final_grade CHAR(2) DEFAULT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (internal_supervisor_id) REFERENCES supervisors(id) ON DELETE CASCADE,
    FOREIGN KEY (external_supervisor_id) REFERENCES supervisors(id) ON DELETE SET NULL,
    
    INDEX idx_group_number (group_number),
    INDEX idx_defense_date (defense_date),
    INDEX idx_location (location),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- ============================================
-- 9. MESSAGES TABLE
-- ============================================
CREATE TABLE messages (
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
    
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE SET NULL,
    
    INDEX idx_sender (sender_id),
    INDEX idx_recipient (recipient_id),
    INDEX idx_messages_group (group_id),
    INDEX idx_messages_parent (parent_id),
    INDEX idx_read_status (read_status),
    INDEX idx_sent_at (sent_at),
    INDEX idx_type (message_type),
    INDEX idx_priority (priority)
) ENGINE=InnoDB;

-- ============================================
-- 10. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM(
        'group_formed', 
        'supervisor_assigned', 
        'project_submitted', 
        'project_approved', 
        'project_rejected', 
        'report_submitted', 
        'evaluation_completed', 
        'message_received', 
        'defense_scheduled', 
        'defense_reminder', 
        'system_update',
        'deadline_reminder'
    ) NOT NULL,
    priority ENUM('low', 'normal', 'high') DEFAULT 'normal',
    read_status BOOLEAN DEFAULT FALSE,
    related_id INT COMMENT 'ID of related entity (project, group, etc.)',
    action_url VARCHAR(500) COMMENT 'URL for notification action',
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user (user_id),
    INDEX idx_read_status (read_status),
    INDEX idx_type (type),
    INDEX idx_priority (priority),
    INDEX idx_created_at (created_at),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB;

-- ============================================
-- 11. SYSTEM_SETTINGS TABLE
-- ============================================
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_key (setting_key),
    INDEX idx_type (setting_type),
    INDEX idx_public (is_public)
) ENGINE=InnoDB;

-- ============================================
-- 12. AUDIT_LOGS TABLE (New - for tracking changes)
-- ============================================
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    table_name VARCHAR(100) NOT NULL,
    record_id INT NOT NULL,
    action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_user (user_id),
    INDEX idx_table (table_name),
    INDEX idx_record (record_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- ============================================
-- 13. DEPARTMENT_SETTINGS TABLE (For department-specific overrides)
-- ============================================
CREATE TABLE department_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    department VARCHAR(100) NOT NULL UNIQUE,
    use_custom_thresholds BOOLEAN DEFAULT FALSE,
    gpa_tier_high_min DECIMAL(3, 2) DEFAULT NULL,
    gpa_tier_medium_min DECIMAL(3, 2) DEFAULT NULL,
    gpa_tier_low_min DECIMAL(3, 2) DEFAULT NULL,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT chk_dept_high_threshold CHECK (gpa_tier_high_min IS NULL OR (gpa_tier_high_min >= 0.00 AND gpa_tier_high_min <= 5.00)),
    CONSTRAINT chk_dept_medium_threshold CHECK (gpa_tier_medium_min IS NULL OR (gpa_tier_medium_min >= 0.00 AND gpa_tier_medium_min <= 5.00)),
    CONSTRAINT chk_dept_low_threshold CHECK (gpa_tier_low_min IS NULL OR (gpa_tier_low_min >= 0.00 AND gpa_tier_low_min <= 5.00)),
    
    INDEX idx_department (department),
    INDEX idx_custom_thresholds (use_custom_thresholds)
) ENGINE=InnoDB;

-- Insert default settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES 
('gpa_tier_high_min', '3.80', 'number', 'Minimum GPA for HIGH tier (Global Default)', true),
('gpa_tier_medium_min', '3.30', 'number', 'Minimum GPA for MEDIUM tier (Global Default)', true),
('gpa_tier_low_min', '0.00', 'number', 'Minimum GPA for LOW tier (Global Default)', true),
('supervisor_max_capacity', '7', 'number', 'Default maximum groups per supervisor', true),
('students_per_group', '3', 'number', 'Number of students per group', true),
('defense_duration_minutes', '60', 'number', 'Default defense duration in minutes', true),
('report_max_file_size', '10485760', 'number', 'Maximum report file size in bytes (10MB)', false),
('allowed_file_types', '["pdf", "doc", "docx"]', 'json', 'Allowed file types for reports', false),
('academic_year_current', '2024/2025', 'string', 'Current academic year', true),
('registration_open', 'true', 'boolean', 'Whether student registration is open', true);