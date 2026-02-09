-- ============================================
-- TRIGGERS FOR SUPERVISE360 DATABASE
-- ============================================

DELIMITER $$

-- ============================================
-- 1. GROUP MANAGEMENT TRIGGERS
-- ============================================

-- Update group member count when student joins/leaves
CREATE TRIGGER after_student_group_update
    AFTER UPDATE ON students
    FOR EACH ROW
BEGIN
    -- If student joined a group
    IF NEW.group_id IS NOT NULL AND (OLD.group_id IS NULL OR OLD.group_id != NEW.group_id) THEN
        UPDATE student_groups 
        SET current_members = current_members + 1,
            is_complete = (current_members + 1 >= max_members)
        WHERE id = NEW.group_id;
        
        -- Decrease old group count if exists
        IF OLD.group_id IS NOT NULL THEN
            UPDATE student_groups 
            SET current_members = current_members - 1,
                is_complete = FALSE
            WHERE id = OLD.group_id;
        END IF;
    END IF;
    
    -- If student left a group
    IF NEW.group_id IS NULL AND OLD.group_id IS NOT NULL THEN
        UPDATE student_groups 
        SET current_members = current_members - 1,
            is_complete = FALSE
        WHERE id = OLD.group_id;
    END IF;
END$$

-- Update supervisor workload when group is assigned
CREATE TRIGGER after_group_supervisor_assigned
    AFTER UPDATE ON student_groups
    FOR EACH ROW
BEGIN
    IF NEW.supervisor_id IS NOT NULL AND (OLD.supervisor_id IS NULL OR OLD.supervisor_id != NEW.supervisor_id) THEN
        -- Increment new supervisor's load
        UPDATE supervisors 
        SET current_load = current_load + 1,
            is_available = (current_load + 1 < max_capacity)
        WHERE id = NEW.supervisor_id;
        
        -- Decrement old supervisor's load if exists
        IF OLD.supervisor_id IS NOT NULL THEN
            UPDATE supervisors 
            SET current_load = current_load - 1,
                is_available = TRUE
            WHERE id = OLD.supervisor_id;
        END IF;
    END IF;
END$$

-- ============================================
-- 2. EVALUATION TRIGGERS
-- ============================================

-- Auto-calculate total score in evaluations
CREATE TRIGGER before_evaluation_insert
    BEFORE INSERT ON evaluations
    FOR EACH ROW
BEGIN
    SET NEW.total_score = COALESCE(NEW.documentation_score, 0) + 
                         COALESCE(NEW.implementation_score, 0) + 
                         COALESCE(NEW.presentation_score, 0) + 
                         COALESCE(NEW.innovation_score, 0);
    
    -- Auto-assign grade based on total score
    IF NEW.total_score IS NOT NULL THEN
        CASE 
            WHEN NEW.total_score >= 360 THEN SET NEW.grade = 'A+';
            WHEN NEW.total_score >= 320 THEN SET NEW.grade = 'A';
            WHEN NEW.total_score >= 300 THEN SET NEW.grade = 'B+';
            WHEN NEW.total_score >= 280 THEN SET NEW.grade = 'B';
            WHEN NEW.total_score >= 260 THEN SET NEW.grade = 'C+';
            WHEN NEW.total_score >= 240 THEN SET NEW.grade = 'C';
            WHEN NEW.total_score >= 200 THEN SET NEW.grade = 'D';
            ELSE SET NEW.grade = 'F';
        END CASE;
    END IF;
END$$

CREATE TRIGGER before_evaluation_update
    BEFORE UPDATE ON evaluations
    FOR EACH ROW
BEGIN
    SET NEW.total_score = COALESCE(NEW.documentation_score, 0) + 
                         COALESCE(NEW.implementation_score, 0) + 
                         COALESCE(NEW.presentation_score, 0) + 
                         COALESCE(NEW.innovation_score, 0);
    
    -- Auto-assign grade based on total score
    IF NEW.total_score IS NOT NULL THEN
        CASE 
            WHEN NEW.total_score >= 360 THEN SET NEW.grade = 'A+';
            WHEN NEW.total_score >= 320 THEN SET NEW.grade = 'A';
            WHEN NEW.total_score >= 300 THEN SET NEW.grade = 'B+';
            WHEN NEW.total_score >= 280 THEN SET NEW.grade = 'B';
            WHEN NEW.total_score >= 260 THEN SET NEW.grade = 'C+';
            WHEN NEW.total_score >= 240 THEN SET NEW.grade = 'C';
            WHEN NEW.total_score >= 200 THEN SET NEW.grade = 'D';
            ELSE SET NEW.grade = 'F';
        END CASE;
    END IF;
END$$

-- ============================================
-- 3. GPA TIER CALCULATION TRIGGER
-- ============================================

CREATE TRIGGER before_student_insert
    BEFORE INSERT ON students
    FOR EACH ROW
BEGIN
    -- Auto-calculate GPA tier
    IF NEW.gpa >= 3.80 THEN
        SET NEW.gpa_tier = 'HIGH';
    ELSEIF NEW.gpa >= 3.30 THEN
        SET NEW.gpa_tier = 'MEDIUM';
    ELSE
        SET NEW.gpa_tier = 'LOW';
    END IF;
END$$

CREATE TRIGGER before_student_update
    BEFORE UPDATE ON students
    FOR EACH ROW
BEGIN
    -- Auto-calculate GPA tier when GPA changes
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

-- ============================================
-- 4. NOTIFICATION TRIGGERS
-- ============================================

-- Create notification when project status changes
CREATE TRIGGER after_project_status_update
    AFTER UPDATE ON projects
    FOR EACH ROW
BEGIN
    DECLARE notification_message TEXT;
    DECLARE notification_type VARCHAR(50);
    
    IF NEW.status != OLD.status THEN
        CASE NEW.status
            WHEN 'approved' THEN 
                SET notification_message = CONCAT('Your project "', NEW.title, '" has been approved!');
                SET notification_type = 'project_approved';
            WHEN 'rejected' THEN 
                SET notification_message = CONCAT('Your project "', NEW.title, '" has been rejected. Reason: ', COALESCE(NEW.rejection_reason, 'No reason provided'));
                SET notification_type = 'project_rejected';
            WHEN 'completed' THEN 
                SET notification_message = CONCAT('Project "', NEW.title, '" has been marked as completed!');
                SET notification_type = 'system_update';
        END CASE;
        
        -- Insert notification for all group members
        IF notification_message IS NOT NULL THEN
            INSERT INTO notifications (user_id, title, message, type, related_id)
            SELECT u.id, 'Project Status Update', notification_message, notification_type, NEW.id
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.group_id = NEW.group_id;
        END IF;
    END IF;
END$$

-- Create notification when supervisor is assigned
CREATE TRIGGER after_supervisor_assigned
    AFTER UPDATE ON student_groups
    FOR EACH ROW
BEGIN
    IF NEW.supervisor_id IS NOT NULL AND OLD.supervisor_id IS NULL THEN
        -- Notify students in the group
        INSERT INTO notifications (user_id, title, message, type, related_id)
        SELECT u.id, 
               'Supervisor Assigned', 
               CONCAT('A supervisor has been assigned to your group #', NEW.group_number),
               'supervisor_assigned',
               NEW.id
        FROM students s
        JOIN users u ON s.user_id = u.id
        WHERE s.group_id = NEW.id;
        
        -- Notify the supervisor
        INSERT INTO notifications (user_id, title, message, type, related_id)
        SELECT u.id,
               'New Group Assigned',
               CONCAT('You have been assigned to supervise Group #', NEW.group_number),
               'supervisor_assigned',
               NEW.id
        FROM supervisors sup
        JOIN users u ON sup.user_id = u.id
        WHERE sup.id = NEW.supervisor_id;
    END IF;
END$$

-- ============================================
-- 5. AUDIT LOG TRIGGERS
-- ============================================

-- Audit trigger for users table
CREATE TRIGGER audit_users_insert 
    AFTER INSERT ON users 
    FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, table_name, record_id, action, new_values)
    VALUES (NEW.id, 'users', NEW.id, 'INSERT', JSON_OBJECT(
        'first_name', NEW.first_name,
        'last_name', NEW.last_name,
        'email', NEW.email,
        'role', NEW.role,
        'department', NEW.department
    ));
END$$

CREATE TRIGGER audit_users_update 
    AFTER UPDATE ON users 
    FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, table_name, record_id, action, old_values, new_values)
    VALUES (NEW.id, 'users', NEW.id, 'UPDATE', 
        JSON_OBJECT(
            'first_name', OLD.first_name,
            'last_name', OLD.last_name,
            'email', OLD.email,
            'role', OLD.role,
            'department', OLD.department
        ),
        JSON_OBJECT(
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'email', NEW.email,
            'role', NEW.role,
            'department', NEW.department
        )
    );
END$$

-- ============================================
-- 6. CLEANUP EVENT
-- ============================================

-- Clean up expired notifications
CREATE EVENT IF NOT EXISTS cleanup_expired_notifications
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    DELETE FROM notifications 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
END$$

DELIMITER ;