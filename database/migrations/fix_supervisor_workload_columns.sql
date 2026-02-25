-- Fix supervisor_workload table for Supervisor Assignment page
-- Run this in MySQL Workbench if you get 500 on /api/supervisors/workload or /upload
-- USE supervise360;

-- Recreate table with correct columns (current_groups, is_available)
DROP TABLE IF EXISTS supervisor_workload;
CREATE TABLE supervisor_workload (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supervisor_name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    current_groups INT DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_supervisor_dept (supervisor_name, department)
) ENGINE=InnoDB;
