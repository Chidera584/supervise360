-- ============================================
-- VIEWS FOR SUPERVISE360 DATABASE
-- ============================================

-- ============================================
-- 1. USER MANAGEMENT VIEWS
-- ============================================

-- Complete student information with group and supervisor details
CREATE VIEW v_students_complete AS
SELECT 
    s.id,
    s.matric_number,
    u.first_name,
    u.last_name,
    u.email,
    u.department,
    s.gpa,
    s.gpa_tier,
    s.academic_year,
    s.program,
    g.group_number,
    g.id as group_id,
    sup.id as supervisor_id,
    CONCAT(su.first_name, ' ', su.last_name) as supervisor_name,
    su.email as supervisor_email,
    p.title as project_title,
    p.status as project_status,
    u.is_active,
    s.created_at
FROM students s
INNER JOIN users u ON s.user_id = u.id
LEFT JOIN student_groups g ON s.group_id = g.id
LEFT JOIN supervisors sup ON g.supervisor_id = sup.id
LEFT JOIN users su ON sup.user_id = su.id
LEFT JOIN projects p ON g.id = p.group_id;

-- Supervisor workload and availability
CREATE VIEW v_supervisor_workload AS
SELECT 
    sup.id,
    u.first_name,
    u.last_name,
    u.email,
    sup.department,
    sup.specialization,
    sup.office_location,
    sup.phone,
    sup.current_load,
    sup.max_capacity,
    (sup.max_capacity - sup.current_load) as available_slots,
    ROUND((sup.current_load / sup.max_capacity) * 100, 2) as workload_percentage,
    sup.is_available,
    u.is_active,
    u.last_login
FROM supervisors sup
INNER JOIN users u ON sup.user_id = u.id;

-- ============================================
-- 2. GROUP MANAGEMENT VIEWS
-- ============================================

-- Groups with complete member information
CREATE VIEW v_groups_with_members AS
SELECT 
    g.id as group_id,
    g.group_number,
    g.department,
    g.current_members,
    g.max_members,
    g.is_complete,
    GROUP_CONCAT(
        CONCAT(u.first_name, ' ', u.last_name, ' (', s.matric_number, ')')
        ORDER BY u.last_name
        SEPARATOR ', '
    ) as members,
    GROUP_CONCAT(s.matric_number ORDER BY s.matric_number SEPARATOR ', ') as matric_numbers,
    ROUND(AVG(s.gpa), 2) as average_gpa,
    sup_user.first_name as supervisor_first_name,
    sup_user.last_name as supervisor_last_name,
    sup_user.email as supervisor_email,
    p.title as project_title,
    p.status as project_status,
    g.created_at
FROM student_groups g
LEFT JOIN students s ON g.id = s.group_id
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN supervisors sup ON g.supervisor_id = sup.id
LEFT JOIN users sup_user ON sup.user_id = sup_user.id
LEFT JOIN projects p ON g.id = p.group_id
GROUP BY g.id, g.group_number, g.department, g.current_members, g.max_members, 
         g.is_complete, sup_user.first_name, sup_user.last_name, sup_user.email,
         p.title, p.status, g.created_at;

-- Available groups (not full and no supervisor assigned)
CREATE VIEW v_available_groups AS
SELECT 
    g.*,
    (g.max_members - g.current_members) as available_slots
FROM student_groups g
WHERE g.is_complete = FALSE 
AND g.supervisor_id IS NULL
AND g.current_members > 0;

-- ============================================
-- 3. PROJECT MANAGEMENT VIEWS
-- ============================================

-- Projects with group and supervisor information
CREATE VIEW v_projects_complete AS
SELECT 
    p.id,
    p.title,
    p.description,
    p.objectives,
    p.methodology,
    p.expected_outcomes,
    p.status,
    p.progress_percentage,
    p.rejection_reason,
    g.group_number,
    g.department,
    g.current_members,
    GROUP_CONCAT(
        CONCAT(u.first_name, ' ', u.last_name)
        ORDER BY u.last_name
        SEPARATOR ', '
    ) as group_members,
    CONCAT(sup_user.first_name, ' ', sup_user.last_name) as supervisor_name,
    sup_user.email as supervisor_email,
    p.submitted_at,
    p.approved_at,
    p.completed_at,
    p.updated_at
FROM projects p
INNER JOIN student_groups g ON p.group_id = g.id
LEFT JOIN students s ON g.id = s.group_id
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN supervisors sup ON g.supervisor_id = sup.id
LEFT JOIN users sup_user ON sup.user_id = sup_user.id
GROUP BY p.id, p.title, p.description, p.objectives, p.methodology, 
         p.expected_outcomes, p.status, p.progress_percentage, p.rejection_reason,
         g.group_number, g.department, g.current_members, supervisor_name,
         sup_user.email, p.submitted_at, p.approved_at, p.completed_at, p.updated_at;

-- ============================================
-- 4. EVALUATION VIEWS
-- ============================================

-- Complete evaluation information
CREATE VIEW v_evaluations_complete AS
SELECT 
    e.id,
    e.project_id,
    p.title as project_title,
    g.group_number,
    e.supervisor_id,
    CONCAT(sup_user.first_name, ' ', sup_user.last_name) as supervisor_name,
    e.evaluation_type,
    e.documentation_score,
    e.implementation_score,
    e.presentation_score,
    e.innovation_score,
    e.total_score,
    e.grade,
    e.feedback,
    e.strengths,
    e.weaknesses,
    e.recommendations,
    e.evaluated_at,
    e.updated_at
FROM evaluations e
INNER JOIN projects p ON e.project_id = p.id
INNER JOIN student_groups g ON p.group_id = g.id
INNER JOIN supervisors sup ON e.supervisor_id = sup.id
INNER JOIN users sup_user ON sup.user_id = sup_user.id;

-- Project evaluation summary
CREATE VIEW v_project_evaluation_summary AS
SELECT 
    p.id as project_id,
    p.title,
    g.group_number,
    COUNT(e.id) as total_evaluations,
    COUNT(CASE WHEN e.evaluation_type = 'internal' THEN 1 END) as internal_evaluations,
    COUNT(CASE WHEN e.evaluation_type = 'external' THEN 1 END) as external_evaluations,
    ROUND(AVG(e.total_score), 2) as average_score,
    MAX(e.total_score) as highest_score,
    MIN(e.total_score) as lowest_score,
    GROUP_CONCAT(DISTINCT e.grade ORDER BY e.grade SEPARATOR ', ') as grades
FROM projects p
INNER JOIN student_groups g ON p.group_id = g.id
LEFT JOIN evaluations e ON p.id = e.project_id
GROUP BY p.id, p.title, g.group_number;

-- ============================================
-- 5. REPORT MANAGEMENT VIEWS
-- ============================================

-- Reports with project and group information
CREATE VIEW v_reports_complete AS
SELECT 
    r.id,
    r.title,
    r.report_type,
    r.file_name,
    r.file_size,
    r.mime_type,
    p.title as project_title,
    g.group_number,
    CONCAT(submitted_user.first_name, ' ', submitted_user.last_name) as submitted_by_name,
    r.submitted_at,
    r.reviewed,
    CONCAT(reviewed_user.first_name, ' ', reviewed_user.last_name) as reviewed_by_name,
    r.reviewed_at,
    r.review_comments
FROM reports r
INNER JOIN projects p ON r.project_id = p.id
INNER JOIN student_groups g ON r.group_id = g.id
INNER JOIN users submitted_user ON r.submitted_by = submitted_user.id
LEFT JOIN users reviewed_user ON r.reviewed_by = reviewed_user.id;

-- ============================================
-- 6. DEFENSE PANEL VIEWS
-- ============================================

-- Defense panels with complete information
CREATE VIEW v_defense_panels_complete AS
SELECT 
    dp.id,
    dp.group_number,
    p.title as project_title,
    dp.defense_date,
    dp.location,
    dp.duration_minutes,
    dp.status,
    dp.final_grade,
    CONCAT(int_sup_user.first_name, ' ', int_sup_user.last_name) as internal_supervisor,
    int_sup_user.email as internal_supervisor_email,
    CONCAT(ext_sup_user.first_name, ' ', ext_sup_user.last_name) as external_supervisor,
    ext_sup_user.email as external_supervisor_email,
    GROUP_CONCAT(
        CONCAT(u.first_name, ' ', u.last_name)
        ORDER BY u.last_name
        SEPARATOR ', '
    ) as group_members,
    dp.notes,
    dp.created_at,
    dp.updated_at
FROM defense_panels dp
INNER JOIN projects p ON dp.project_id = p.id
INNER JOIN student_groups g ON p.group_id = g.id
INNER JOIN supervisors int_sup ON dp.internal_supervisor_id = int_sup.id
INNER JOIN users int_sup_user ON int_sup.user_id = int_sup_user.id
LEFT JOIN supervisors ext_sup ON dp.external_supervisor_id = ext_sup.id
LEFT JOIN users ext_sup_user ON ext_sup.user_id = ext_sup_user.id
LEFT JOIN students s ON g.id = s.group_id
LEFT JOIN users u ON s.user_id = u.id
GROUP BY dp.id, dp.group_number, p.title, dp.defense_date, dp.location,
         dp.duration_minutes, dp.status, dp.final_grade, internal_supervisor,
         int_sup_user.email, external_supervisor, ext_sup_user.email,
         dp.notes, dp.created_at, dp.updated_at;

-- ============================================
-- 7. DASHBOARD VIEWS
-- ============================================

-- Admin dashboard statistics
CREATE VIEW v_admin_dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as total_active_users,
    (SELECT COUNT(*) FROM students) as total_students,
    (SELECT COUNT(*) FROM supervisors WHERE is_available = TRUE) as available_supervisors,
    (SELECT COUNT(*) FROM student_groups WHERE is_complete = TRUE) as complete_groups,
    (SELECT COUNT(*) FROM student_groups WHERE is_complete = FALSE) as incomplete_groups,
    (SELECT COUNT(*) FROM projects WHERE status = 'pending') as pending_projects,
    (SELECT COUNT(*) FROM projects WHERE status = 'approved') as approved_projects,
    (SELECT COUNT(*) FROM projects WHERE status = 'completed') as completed_projects,
    (SELECT COUNT(*) FROM reports WHERE reviewed = FALSE) as unreviewed_reports,
    (SELECT COUNT(*) FROM defense_panels WHERE status = 'scheduled') as scheduled_defenses,
    (SELECT COUNT(*) FROM notifications WHERE read_status = FALSE) as unread_notifications;

-- Student dashboard view
CREATE VIEW v_student_dashboard AS
SELECT 
    s.id as student_id,
    s.matric_number,
    u.first_name,
    u.last_name,
    g.group_number,
    g.is_complete as group_complete,
    p.title as project_title,
    p.status as project_status,
    p.progress_percentage,
    CONCAT(sup_user.first_name, ' ', sup_user.last_name) as supervisor_name,
    (SELECT COUNT(*) FROM reports r WHERE r.group_id = g.id) as total_reports,
    (SELECT COUNT(*) FROM reports r WHERE r.group_id = g.id AND r.reviewed = FALSE) as pending_reports,
    (SELECT COUNT(*) FROM notifications n WHERE n.user_id = u.id AND n.read_status = FALSE) as unread_notifications,
    dp.defense_date,
    dp.location as defense_location,
    dp.status as defense_status
FROM students s
INNER JOIN users u ON s.user_id = u.id
LEFT JOIN student_groups g ON s.group_id = g.id
LEFT JOIN projects p ON g.id = p.group_id
LEFT JOIN supervisors sup ON g.supervisor_id = sup.id
LEFT JOIN users sup_user ON sup.user_id = sup_user.id
LEFT JOIN defense_panels dp ON g.group_number = dp.group_number;

-- Supervisor dashboard view
CREATE VIEW v_supervisor_dashboard AS
SELECT 
    sup.id as supervisor_id,
    u.first_name,
    u.last_name,
    sup.current_load,
    sup.max_capacity,
    (sup.max_capacity - sup.current_load) as available_slots,
    (SELECT COUNT(*) FROM student_groups g WHERE g.supervisor_id = sup.id) as supervised_groups,
    (SELECT COUNT(*) FROM projects p 
     INNER JOIN student_groups g ON p.group_id = g.id 
     WHERE g.supervisor_id = sup.id AND p.status = 'pending') as pending_projects,
    (SELECT COUNT(*) FROM reports r 
     INNER JOIN student_groups g ON r.group_id = g.id 
     WHERE g.supervisor_id = sup.id AND r.reviewed = FALSE) as unreviewed_reports,
    (SELECT COUNT(*) FROM evaluations e WHERE e.supervisor_id = sup.id) as completed_evaluations,
    (SELECT COUNT(*) FROM defense_panels dp 
     WHERE dp.internal_supervisor_id = sup.id OR dp.external_supervisor_id = sup.id) as defense_panels,
    (SELECT COUNT(*) FROM notifications n WHERE n.user_id = u.id AND n.read_status = FALSE) as unread_notifications
FROM supervisors sup
INNER JOIN users u ON sup.user_id = u.id;