-- Ensure projects table works with project_groups
-- Run this if project submission fails with 500 (foreign key or table missing)

USE supervise360;

-- Step 1: Create projects table if it doesn't exist (no FK initially)
CREATE TABLE IF NOT EXISTS projects (
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
    INDEX idx_status (status),
    INDEX idx_group (group_id)
) ENGINE=InnoDB;
