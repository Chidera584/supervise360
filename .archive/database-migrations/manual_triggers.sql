-- ============================================
-- MANUAL TRIGGER CREATION - RUN ONE BY ONE
-- Copy and paste each trigger individually in MySQL
-- ============================================

-- STEP 1: Change delimiter
DELIMITER $$

-- STEP 2: Create GPA tier trigger for INSERT
CREATE TRIGGER before_student_insert
BEFORE INSERT ON students
FOR EACH ROW
BEGIN
    IF NEW.gpa >= 3.80 THEN
        SET NEW.gpa_tier = 'HIGH';
    ELSEIF NEW.gpa >= 3.30 THEN
        SET NEW.gpa_tier = 'MEDIUM';
    ELSE
        SET NEW.gpa_tier = 'LOW';
    END IF;
END$$

-- STEP 3: Reset delimiter and test
DELIMITER ;

-- Test the trigger
-- INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES ('Test', 'Student', 'test@test.com', 'hash', 'student');
-- INSERT INTO students (user_id, matric_number, gpa) VALUES (LAST_INSERT_ID(), 'TEST001', 3.85);
-- SELECT * FROM students WHERE matric_number = 'TEST001'; -- Should show gpa_tier = 'HIGH'

-- STEP 4: Change delimiter again
DELIMITER $$

-- STEP 5: Create GPA tier trigger for UPDATE
CREATE TRIGGER before_student_update
BEFORE UPDATE ON students
FOR EACH ROW
BEGIN
    IF NEW.gpa != OLD.gpa THEN
        IF NEW.gpa >= 3.80 THEN
            SET NEW.gpa_tier = 'HIGH';
        ELSEIF NEW.gpa >= 3.30 THEN
            SET NEW.gpa_tier = 'MEDIUM';
        ELSE
            SET NEW.gpa_tier = 'LOW';
        END IF;
    END IF;
END$$

-- STEP 6: Reset delimiter
DELIMITER ;

-- STEP 7: Change delimiter for evaluation triggers
DELIMITER $$

-- STEP 8: Create evaluation score trigger for INSERT
CREATE TRIGGER before_evaluation_insert
BEFORE INSERT ON evaluations
FOR EACH ROW
BEGIN
    SET NEW.total_score = COALESCE(NEW.documentation_score, 0) + 
                         COALESCE(NEW.implementation_score, 0) + 
                         COALESCE(NEW.presentation_score, 0) + 
                         COALESCE(NEW.innovation_score, 0);
END$$

-- STEP 9: Create evaluation score trigger for UPDATE
CREATE TRIGGER before_evaluation_update
BEFORE UPDATE ON evaluations
FOR EACH ROW
BEGIN
    SET NEW.total_score = COALESCE(NEW.documentation_score, 0) + 
                         COALESCE(NEW.implementation_score, 0) + 
                         COALESCE(NEW.presentation_score, 0) + 
                         COALESCE(NEW.innovation_score, 0);
END$$

-- STEP 10: Final delimiter reset
DELIMITER ;

-- Verify triggers were created
SHOW TRIGGERS;