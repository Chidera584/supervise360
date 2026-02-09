-- ============================================
-- BASIC TRIGGERS FOR SUPERVISE360 DATABASE
-- These are the essential triggers only
-- ============================================

DELIMITER $$

-- 1. Auto-calculate GPA tier when inserting students
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

-- 2. Auto-calculate GPA tier when updating students
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

-- 3. Auto-calculate evaluation total score on insert
CREATE TRIGGER before_evaluation_insert
BEFORE INSERT ON evaluations
FOR EACH ROW
BEGIN
    SET NEW.total_score = COALESCE(NEW.documentation_score, 0) + 
                         COALESCE(NEW.implementation_score, 0) + 
                         COALESCE(NEW.presentation_score, 0) + 
                         COALESCE(NEW.innovation_score, 0);
END$$

-- 4. Auto-calculate evaluation total score on update
CREATE TRIGGER before_evaluation_update
BEFORE UPDATE ON evaluations
FOR EACH ROW
BEGIN
    SET NEW.total_score = COALESCE(NEW.documentation_score, 0) + 
                         COALESCE(NEW.implementation_score, 0) + 
                         COALESCE(NEW.presentation_score, 0) + 
                         COALESCE(NEW.innovation_score, 0);
END$$

DELIMITER ;