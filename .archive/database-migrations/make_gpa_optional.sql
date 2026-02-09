-- Migration to make GPA optional for students
-- This allows students to register without providing GPA initially

-- Make GPA field nullable in students table
ALTER TABLE students 
MODIFY COLUMN gpa DECIMAL(3, 2) NULL,
MODIFY COLUMN gpa_tier ENUM('HIGH', 'MEDIUM', 'LOW') NULL;

-- Update the constraint to allow NULL values
ALTER TABLE students 
DROP CONSTRAINT IF EXISTS chk_gpa_range;

ALTER TABLE students 
ADD CONSTRAINT chk_gpa_range 
CHECK (gpa IS NULL OR (gpa >= 0.00 AND gpa <= 5.00));

-- Add a trigger to automatically calculate GPA tier when GPA is updated
DELIMITER //

CREATE TRIGGER IF NOT EXISTS calculate_gpa_tier_on_insert
BEFORE INSERT ON students
FOR EACH ROW
BEGIN
    IF NEW.gpa IS NOT NULL THEN
        IF NEW.gpa >= 3.50 THEN
            SET NEW.gpa_tier = 'HIGH';
        ELSEIF NEW.gpa >= 2.50 THEN
            SET NEW.gpa_tier = 'MEDIUM';
        ELSE
            SET NEW.gpa_tier = 'LOW';
        END IF;
    ELSE
        SET NEW.gpa_tier = NULL;
    END IF;
END//

CREATE TRIGGER IF NOT EXISTS calculate_gpa_tier_on_update
BEFORE UPDATE ON students
FOR EACH ROW
BEGIN
    IF NEW.gpa IS NOT NULL THEN
        IF NEW.gpa >= 3.50 THEN
            SET NEW.gpa_tier = 'HIGH';
        ELSEIF NEW.gpa >= 2.50 THEN
            SET NEW.gpa_tier = 'MEDIUM';
        ELSE
            SET NEW.gpa_tier = 'LOW';
        END IF;
    ELSE
        SET NEW.gpa_tier = NULL;
    END IF;
END//

DELIMITER ;