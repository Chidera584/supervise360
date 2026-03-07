-- ============================================
-- Multi-Department Admin Support
-- Creates departments table and admin_departments junction
-- ============================================

USE supervise360;

-- 1. Departments table (canonical list with codes)
CREATE TABLE IF NOT EXISTS departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_code (code)
) ENGINE=InnoDB;

-- Seed departments (match existing data + user's proposed codes)
INSERT IGNORE INTO departments (name, code) VALUES
  ('Computer Science', 'computer_sci'),
  ('Software Engineering', 'software_eng'),
  ('Computer Technology', 'computer_tech'),
  ('Information Technology', 'info_tech'),
  ('Computer Information Systems', 'computer_info_sys');

-- 2. Admin-Departments junction (admin manages specific departments; empty = manages all)
CREATE TABLE IF NOT EXISTS admin_departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  department_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_admin_dept (user_id, department_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_department (department_id)
) ENGINE=InnoDB;
