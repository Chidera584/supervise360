-- ============================================
-- SIMPLIFIED TRIGGERS FOR SUPERVISE360 DATABASE
-- Run this file if the main triggers.sql has issues
-- ============================================

-- Change delimiter for trigger creation
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

-- 3. Update supervisor workload when group is assigned
CREATE TRIGGER after_group_supervisor_assigned
    AFTER UPDATE ON student_groups
    FOR EACH ROW
BEGIN
    IF NEW.supervisor_id IS NOT NULL AND (OLD.supervisor_id IS NULL OR OLD.supervisor_id != NEW.supervisor_id) THEN
        -- Increment new supervisor's load
        UPDATE supervisors 
        SET current_load = current_load + 1
        WHERE id = NEW.supervisor_id;
        
        -- Decrement old supervisor's load if exists
        IF OLD.supervisor_id IS NOT NULL THEN
            UPDATE supervisors 
            SET current_load = current_load - 1
            WHERE id = OLD.supervisor_id;
        END IF;
    END IF;
END$$

-- 4. Auto-calculate evaluation total score
CREATE TRIGGER before_evaluation_insert
    BEFORE INSERT ON evaluations
    FOR EACH ROW
BEGIN
    SET NEW.total_score = COALESCE(NEW.documentation_score, 0) + 
                         COALESCE(NEW.implementation_score, 0) + 
                         COALESCE(NEW.presentation_score, 0) + 
                         COALESCE(NEW.innovation_score, 0);
END$$

CREATE TRIGGER before_evaluation_update
    BEFORE UPDATE ON evaluations
    FOR EACH ROW
BEGIN
    SET NEW.total_score = COALESCE(NEW.documentation_score, 0) + 
                         COALESCE(NEW.implementation_score, 0) + 
                         COALESCE(NEW.presentation_score, 0) + 
                         COALESCE(NEW.innovation_score, 0);
END$$

-- Reset delimiter back to semicolon
DELIMITER ;