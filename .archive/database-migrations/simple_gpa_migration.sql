-- Simple migration to make GPA optional for students

-- Make GPA field nullable in students table
ALTER TABLE students MODIFY COLUMN gpa DECIMAL(3, 2) NULL;
ALTER TABLE students MODIFY COLUMN gpa_tier ENUM('HIGH', 'MEDIUM', 'LOW') NULL;