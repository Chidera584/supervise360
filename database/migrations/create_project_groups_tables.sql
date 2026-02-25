-- Create project_groups and group_members tables (required by backend)
-- Run this in MySQL Workbench after improved_schema.sql
-- USE supervise360;

CREATE TABLE IF NOT EXISTS project_groups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    avg_gpa DECIMAL(3, 2) DEFAULT NULL,
    status VARCHAR(50) DEFAULT 'formed',
    department VARCHAR(100) NOT NULL DEFAULT 'Software Engineering',
    supervisor_name VARCHAR(255) DEFAULT NULL,
    supervisor_id INT DEFAULT NULL,
    formation_method VARCHAR(50) DEFAULT NULL,
    formation_date DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_department (department),
    INDEX idx_status (status),
    INDEX idx_supervisor (supervisor_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS group_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    student_gpa DECIMAL(3, 2) DEFAULT NULL,
    gpa_tier ENUM('HIGH', 'MEDIUM', 'LOW') DEFAULT NULL,
    member_order INT DEFAULT 1,
    matric_number VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE,
    INDEX idx_group (group_id),
    INDEX idx_matric (matric_number)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS supervisor_workload (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supervisor_name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    current_groups INT DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_supervisor_dept (supervisor_name, department)
) ENGINE=InnoDB;
