-- Supervise360 feature expansion (reference migration).
-- Runtime DDL is applied via backend/src/services/schemaFixService.ts ensureFeatureExpansionSchema().
-- Run manually if needed after improved_schema + create_project_groups_tables.

-- academic_sessions, project_groups.session_id, students.session_id,
-- group_members email/phone, supervisor_workload email/phone/max_groups,
-- supervision_meetings, meeting_attendance, student_assessment_entries
