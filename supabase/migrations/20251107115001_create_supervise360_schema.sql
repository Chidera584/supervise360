-- Supervise360 Platform - Complete Database Schema
--
-- Overview:
-- This migration creates the complete database schema for the Supervise360 academic supervision platform
--
-- Tables Created:
-- 1. profiles - User profile information with role-based fields
-- 2. groups - Student groups formed by grouping algorithm
-- 3. group_members - Junction table for students in groups
-- 4. projects - Project information for each group
-- 5. reports - Student report submissions
-- 6. evaluations - Supervisor evaluations of reports
-- 7. external_evaluations - External supervisor final evaluations
-- 8. messages - Communication between students and supervisors
-- 9. notifications - System notifications
-- 10. system_settings - Administrator-configurable settings

-- Create enum for user roles
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'supervisor', 'administrator', 'external_supervisor');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  student_id text,
  full_name text NOT NULL,
  department text,
  program text,
  gpa numeric(3, 2),
  max_groups integer DEFAULT 7,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Groups table
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  average_gpa numeric(3, 2) DEFAULT 0,
  gpa_tier text DEFAULT 'Medium',
  supervisor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Group members junction table
CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, student_id)
);

-- 4. Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  status text DEFAULT 'Planning',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(group_id)
);

-- 5. Reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  report_type text NOT NULL,
  file_url text NOT NULL,
  status text DEFAULT 'Pending',
  submitted_at timestamptz DEFAULT now()
);

-- 6. Evaluations table
CREATE TABLE IF NOT EXISTS evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  supervisor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score numeric(5, 2) NOT NULL,
  feedback text DEFAULT '',
  evaluated_at timestamptz DEFAULT now()
);

-- 7. External evaluations table
CREATE TABLE IF NOT EXISTS external_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  external_supervisor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  grade numeric(5, 2) NOT NULL,
  documentation text DEFAULT '',
  submitted_at timestamptz DEFAULT now()
);

-- 8. Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  sent_at timestamptz DEFAULT now()
);

-- 9. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 10. System settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Administrators can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'administrator'
    )
  );

CREATE POLICY "Administrators can manage all profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'administrator'
    )
  );

-- Groups policies
CREATE POLICY "Students can view own group"
  ON groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = groups.id
      AND gm.student_id = auth.uid()
    )
  );

CREATE POLICY "Supervisors can view assigned groups"
  ON groups FOR SELECT
  TO authenticated
  USING (supervisor_id = auth.uid());

CREATE POLICY "Administrators can manage all groups"
  ON groups FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'administrator'
    )
  );

-- Group members policies
CREATE POLICY "Students can view own group membership"
  ON group_members FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Supervisors can view assigned group members"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
      AND g.supervisor_id = auth.uid()
    )
  );

CREATE POLICY "Administrators can manage group members"
  ON group_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'administrator'
    )
  );

-- Projects policies
CREATE POLICY "Group members can view own project"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = projects.group_id
      AND gm.student_id = auth.uid()
    )
  );

CREATE POLICY "Group members can update own project"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = projects.group_id
      AND gm.student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = projects.group_id
      AND gm.student_id = auth.uid()
    )
  );

CREATE POLICY "Supervisors can view assigned projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = projects.group_id
      AND g.supervisor_id = auth.uid()
    )
  );

CREATE POLICY "Administrators can manage all projects"
  ON projects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'administrator'
    )
  );

-- Reports policies
CREATE POLICY "Group members can view own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = reports.group_id
      AND gm.student_id = auth.uid()
    )
  );

CREATE POLICY "Group members can submit reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_id
      AND gm.student_id = auth.uid()
    )
  );

CREATE POLICY "Supervisors can view assigned group reports"
  ON reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = reports.group_id
      AND g.supervisor_id = auth.uid()
    )
  );

CREATE POLICY "Administrators can view all reports"
  ON reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'administrator'
    )
  );

-- Evaluations policies
CREATE POLICY "Group members can view own evaluations"
  ON evaluations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reports r
      JOIN group_members gm ON gm.group_id = r.group_id
      WHERE r.id = evaluations.report_id
      AND gm.student_id = auth.uid()
    )
  );

CREATE POLICY "Supervisors can create evaluations"
  ON evaluations FOR INSERT
  TO authenticated
  WITH CHECK (supervisor_id = auth.uid());

CREATE POLICY "Supervisors can view own evaluations"
  ON evaluations FOR SELECT
  TO authenticated
  USING (supervisor_id = auth.uid());

CREATE POLICY "Administrators can view all evaluations"
  ON evaluations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'administrator'
    )
  );

-- External evaluations policies
CREATE POLICY "Group members can view own external evaluations"
  ON external_evaluations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = external_evaluations.group_id
      AND gm.student_id = auth.uid()
    )
  );

CREATE POLICY "External supervisors can create evaluations"
  ON external_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (external_supervisor_id = auth.uid());

CREATE POLICY "External supervisors can view own evaluations"
  ON external_evaluations FOR SELECT
  TO authenticated
  USING (external_supervisor_id = auth.uid());

CREATE POLICY "Administrators can view all external evaluations"
  ON external_evaluations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'administrator'
    )
  );

-- Messages policies
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can mark messages as read"
  ON messages FOR UPDATE
  TO authenticated
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- System settings policies
CREATE POLICY "Anyone can view system settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Administrators can manage system settings"
  ON system_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'administrator'
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_groups_supervisor ON groups(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_student ON group_members(student_id);
CREATE INDEX IF NOT EXISTS idx_projects_group ON projects(group_id);
CREATE INDEX IF NOT EXISTS idx_reports_group ON reports(group_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_evaluations_report ON evaluations(report_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value)
VALUES 
  ('gpa_high_threshold', '3.5'),
  ('gpa_medium_threshold', '2.5'),
  ('max_group_size', '3'),
  ('max_supervisor_groups', '7')
ON CONFLICT (setting_key) DO NOTHING;