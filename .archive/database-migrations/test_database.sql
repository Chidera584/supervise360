-- ============================================
-- DATABASE TEST SCRIPT
-- Run this to verify your database is working
-- ============================================

-- Check if all tables exist
SELECT 'Checking tables...' as status;
SHOW TABLES;

-- Check if views exist
SELECT 'Checking views...' as status;
SHOW FULL TABLES WHERE Table_type = 'VIEW';

-- Check if triggers exist
SELECT 'Checking triggers...' as status;
SHOW TRIGGERS;

-- Test basic functionality
SELECT 'Testing basic inserts...' as status;

-- Insert a test admin user
INSERT INTO users (first_name, last_name, email, password_hash, role) 
VALUES ('Admin', 'User', 'admin@supervise360.com', '$2a$12$test_hash', 'admin');

-- Insert a test supervisor
INSERT INTO users (first_name, last_name, email, password_hash, role, department) 
VALUES ('Dr. John', 'Smith', 'john.smith@university.edu', '$2a$12$test_hash', 'supervisor', 'Computer Science');

INSERT INTO supervisors (user_id, department, specialization) 
VALUES (LAST_INSERT_ID(), 'Computer Science', 'Machine Learning');

-- Insert test students
INSERT INTO users (first_name, last_name, email, password_hash, role, department) 
VALUES 
('Alice', 'Johnson', 'alice@student.edu', '$2a$12$test_hash', 'student', 'Computer Science'),
('Bob', 'Wilson', 'bob@student.edu', '$2a$12$test_hash', 'student', 'Computer Science');

-- Get the user IDs for students
SET @alice_user_id = (SELECT id FROM users WHERE email = 'alice@student.edu');
SET @bob_user_id = (SELECT id FROM users WHERE email = 'bob@student.edu');

-- Insert students (this should trigger GPA tier calculation)
INSERT INTO students (user_id, matric_number, gpa) 
VALUES 
(@alice_user_id, 'CS2021001', 3.85),
(@bob_user_id, 'CS2021002', 3.45);

-- Create a test group
INSERT INTO student_groups (group_number, department) 
VALUES (1, 'Computer Science');

-- Check if everything was inserted correctly
SELECT 'Test Results:' as status;

SELECT 'Users:' as table_name;
SELECT id, first_name, last_name, email, role FROM users;

SELECT 'Students with GPA tiers:' as table_name;
SELECT s.matric_number, u.first_name, u.last_name, s.gpa, s.gpa_tier 
FROM students s 
JOIN users u ON s.user_id = u.id;

SELECT 'Supervisors:' as table_name;
SELECT sup.id, u.first_name, u.last_name, sup.department, sup.current_load, sup.max_capacity
FROM supervisors sup
JOIN users u ON sup.user_id = u.id;

SELECT 'Groups:' as table_name;
SELECT * FROM student_groups;

-- Test the views
SELECT 'Testing views:' as status;
SELECT * FROM v_students_complete;
SELECT * FROM v_supervisor_workload;

SELECT 'Database test completed successfully!' as status;