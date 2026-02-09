-- Fix RLS Policies - Remove overly restrictive policies and add proper ones
-- The problem: Users cannot read their own profiles due to restrictive policies

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Administrators can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Administrators can manage all profiles" ON profiles;

-- Create simple, working policies for profiles table
-- Allow authenticated users to read their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow authenticated users to update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow authenticated users to insert their own profile (for migrations/triggers)
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow administrators to view all profiles
CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    (auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator'))
  );

-- Allow administrators to update any profile
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator'))
  )
  WITH CHECK (
    (auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator'))
  );

-- Allow administrators to delete profiles
CREATE POLICY "profiles_delete_admin"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    (auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator'))
  );

-- Fix groups policies
DROP POLICY IF EXISTS "Students can view own group" ON groups;
DROP POLICY IF EXISTS "Supervisors can view assigned groups" ON groups;
DROP POLICY IF EXISTS "Administrators can manage all groups" ON groups;

CREATE POLICY "groups_select_student"
  ON groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.student_id = auth.uid()
    )
  );

CREATE POLICY "groups_select_supervisor"
  ON groups FOR SELECT
  TO authenticated
  USING (supervisor_id = auth.uid());

CREATE POLICY "groups_select_admin"
  ON groups FOR SELECT
  TO authenticated
  USING (
    (auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator'))
  );

CREATE POLICY "groups_manage_admin"
  ON groups FOR ALL
  TO authenticated
  USING (
    (auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator'))
  );

-- Fix group_members policies
DROP POLICY IF EXISTS "Students can view own group membership" ON group_members;
DROP POLICY IF EXISTS "Supervisors can view assigned group members" ON group_members;
DROP POLICY IF EXISTS "Administrators can manage group members" ON group_members;

CREATE POLICY "group_members_select_own"
  ON group_members FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "group_members_select_supervisor"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_members.group_id
      AND groups.supervisor_id = auth.uid()
    )
  );

CREATE POLICY "group_members_manage_admin"
  ON group_members FOR ALL
  TO authenticated
  USING (
    (auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator'))
  );

-- Fix projects policies
DROP POLICY IF EXISTS "Group members can view own project" ON projects;
DROP POLICY IF EXISTS "Group members can update own project" ON projects;
DROP POLICY IF EXISTS "Supervisors can view assigned projects" ON projects;
DROP POLICY IF EXISTS "Administrators can manage all projects" ON projects;

CREATE POLICY "projects_select_member"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = projects.group_id
      AND group_members.student_id = auth.uid()
    )
  );

CREATE POLICY "projects_update_member"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = projects.group_id
      AND group_members.student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = projects.group_id
      AND group_members.student_id = auth.uid()
    )
  );

CREATE POLICY "projects_select_supervisor"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = projects.group_id
      AND groups.supervisor_id = auth.uid()
    )
  );

CREATE POLICY "projects_manage_admin"
  ON projects FOR ALL
  TO authenticated
  USING (
    (auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator'))
  );

-- Fix reports policies
DROP POLICY IF EXISTS "Group members can view own reports" ON reports;
DROP POLICY IF EXISTS "Group members can submit reports" ON reports;
DROP POLICY IF EXISTS "Supervisors can view assigned group reports" ON reports;
DROP POLICY IF EXISTS "Administrators can view all reports" ON reports;

CREATE POLICY "reports_select_member"
  ON reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = reports.group_id
      AND group_members.student_id = auth.uid()
    )
  );

CREATE POLICY "reports_insert_member"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_id
      AND group_members.student_id = auth.uid()
    )
  );

CREATE POLICY "reports_select_supervisor"
  ON reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = reports.group_id
      AND groups.supervisor_id = auth.uid()
    )
  );

CREATE POLICY "reports_select_admin"
  ON reports FOR SELECT
  TO authenticated
  USING (
    (auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator'))
  );

-- Fix evaluations policies
DROP POLICY IF EXISTS "Group members can view own evaluations" ON evaluations;
DROP POLICY IF EXISTS "Supervisors can create evaluations" ON evaluations;
DROP POLICY IF EXISTS "Supervisors can view own evaluations" ON evaluations;
DROP POLICY IF EXISTS "Administrators can view all evaluations" ON evaluations;

CREATE POLICY "evaluations_select_student"
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

CREATE POLICY "evaluations_insert_supervisor"
  ON evaluations FOR INSERT
  TO authenticated
  WITH CHECK (supervisor_id = auth.uid());

CREATE POLICY "evaluations_select_supervisor"
  ON evaluations FOR SELECT
  TO authenticated
  USING (supervisor_id = auth.uid());

CREATE POLICY "evaluations_select_admin"
  ON evaluations FOR SELECT
  TO authenticated
  USING (
    (auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator'))
  );

-- Fix external_evaluations policies
DROP POLICY IF EXISTS "Group members can view own external evaluations" ON external_evaluations;
DROP POLICY IF EXISTS "External supervisors can create evaluations" ON external_evaluations;
DROP POLICY IF EXISTS "External supervisors can view own evaluations" ON external_evaluations;
DROP POLICY IF EXISTS "Administrators can view all external evaluations" ON external_evaluations;

CREATE POLICY "external_evaluations_select_student"
  ON external_evaluations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = external_evaluations.group_id
      AND group_members.student_id = auth.uid()
    )
  );

CREATE POLICY "external_evaluations_insert_supervisor"
  ON external_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (external_supervisor_id = auth.uid());

CREATE POLICY "external_evaluations_select_supervisor"
  ON external_evaluations FOR SELECT
  TO authenticated
  USING (external_supervisor_id = auth.uid());

CREATE POLICY "external_evaluations_select_admin"
  ON external_evaluations FOR SELECT
  TO authenticated
  USING (
    (auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator'))
  );

-- Fix messages policies
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can mark messages as read" ON messages;

CREATE POLICY "messages_select"
  ON messages FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "messages_insert"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "messages_update"
  ON messages FOR UPDATE
  TO authenticated
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());

-- Fix notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

CREATE POLICY "notifications_select"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_insert"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Fix system_settings policies
DROP POLICY IF EXISTS "Anyone can view system settings" ON system_settings;
DROP POLICY IF EXISTS "Administrators can manage system settings" ON system_settings;

CREATE POLICY "system_settings_select"
  ON system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "system_settings_manage_admin"
  ON system_settings FOR ALL
  TO authenticated
  USING (
    (auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator'))
  );