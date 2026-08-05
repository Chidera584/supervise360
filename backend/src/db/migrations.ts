import type { Migration } from './migrationRunner';
import {
  ensureProjectGroupsSchema,
  ensureReportsApprovedColumn,
  ensureDepartmentsTables,
  ensureFeatureExpansionSchema,
  ensureSupervisionMeetingsColumns,
} from '../services/schemaFixService';
import { addIdLinkingColumns } from './migrations/006_id_linking_columns';

/**
 * Ordered, versioned migrations - each runs exactly once (tracked in `schema_migrations`) and a
 * failure aborts the batch (see migrationRunner.ts). IDs are permanent once shipped: never
 * rename or reorder an existing entry, only append new ones.
 *
 * Migrations 001-005 wrap logic that predates this runner (previously called ad hoc on every
 * server boot via schemaFixService, with failures logged as "non-fatal" and silently ignored -
 * that's what let a database miss columns a route depended on and 500 in production). The
 * underlying functions are unchanged and still idempotent; they're now tracked and their
 * failures now abort startup instead of being swallowed.
 */
export const migrations: Migration[] = [
  {
    id: '001_project_groups_schema',
    description: 'Point projects/reports group_id FKs at project_groups instead of the unused student_groups table',
    up: ensureProjectGroupsSchema,
  },
  {
    id: '002_reports_approved_column',
    description: 'Add reports.approved column used by report review',
    up: ensureReportsApprovedColumn,
  },
  {
    id: '003_departments_tables',
    description: 'Create departments and admin_departments tables',
    up: ensureDepartmentsTables,
  },
  {
    id: '004_feature_expansion_schema',
    description:
      'Academic sessions, session scoping, group_members/supervisor_workload contact fields, ' +
      'workload caps, supervision_meetings, meeting_attendance, student_assessment_entries',
    up: ensureFeatureExpansionSchema,
  },
  {
    id: '005_supervision_meetings_columns',
    description: 'Ensure supervision_meetings.bulk_series_id and attendance_locked columns exist',
    up: ensureSupervisionMeetingsColumns,
  },
  {
    id: '006_id_linking_columns',
    description:
      'Add group_members.student_user_id and project_groups.supervisor_user_id so membership ' +
      'and supervisor assignment can be resolved by id instead of free-text name matching',
    up: addIdLinkingColumns,
  },
];
