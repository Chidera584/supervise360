// Database type definitions matching your MySQL schema

export type UserRole = 'admin' | 'supervisor' | 'student' | 'external_supervisor';
export type GPATier = 'HIGH' | 'MEDIUM' | 'LOW';
export type ProjectStatus = 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed';
export type ReportType = 'proposal' | 'progress' | 'final' | 'other';
export type EvaluationType = 'internal' | 'external';
export type DefenseStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
export type NotificationType = 
  | 'group_formed' 
  | 'supervisor_assigned' 
  | 'project_submitted' 
  | 'project_approved' 
  | 'project_rejected' 
  | 'report_submitted' 
  | 'evaluation_completed' 
  | 'message_received' 
  | 'defense_scheduled' 
  | 'defense_reminder' 
  | 'system_update';

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  department?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: number;
  user_id: number;
  matric_number: string;
  gpa?: number;
  gpa_tier?: GPATier;
  group_id?: number;
  created_at: string;
  updated_at: string;
}

export interface Supervisor {
  id: number;
  user_id: number;
  department: string;
  max_capacity: number;
  current_load: number;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: number;
  group_number: number;
  supervisor_id?: number;
  department: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  group_id: number;
  title: string;
  description?: string;
  objectives?: string;
  status: ProjectStatus;
  rejection_reason?: string;
  submitted_at: string;
  approved_at?: string;
  updated_at: string;
}

export interface Report {
  id: number;
  project_id: number;
  group_id: number;
  report_type: ReportType;
  file_name: string;
  file_path: string;
  file_size?: number;
  submitted_by: number;
  submitted_at: string;
  reviewed: boolean;
  reviewed_at?: string;
}

export interface Evaluation {
  id: number;
  project_id: number;
  supervisor_id: number;
  evaluation_type: EvaluationType;
  documentation_score?: number;
  implementation_score?: number;
  presentation_score?: number;
  innovation_score?: number;
  total_score?: number;
  feedback?: string;
  evaluated_at: string;
  updated_at: string;
}

export interface DefensePanel {
  id: number;
  group_number: number;
  project_id: number;
  internal_supervisor_id: number;
  external_supervisor_id?: number;
  defense_date: string;
  location: string;
  status: DefenseStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  sender_id: number;
  recipient_id: number;
  subject: string;
  content: string;
  read_status: boolean;
  sent_at: string;
  read_at?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  message: string;
  type: NotificationType;
  read_status: boolean;
  related_id?: number;
  created_at: string;
  read_at?: string;
}

export interface SystemSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  description?: string;
  updated_by?: number;
  updated_at: string;
}

// View types for complex queries
export interface StudentComplete {
  id: number;
  matric_number: string;
  first_name: string;
  last_name: string;
  email: string;
  gpa?: number;
  gpa_tier?: GPATier;
  group_number?: number;
  department?: string;
  supervisor_user_id?: number;
  supervisor_name?: string;
}

export interface SupervisorWorkload {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  current_load: number;
  max_capacity: number;
  available_slots: number;
  workload_percentage: number;
}

export interface GroupWithMembers {
  group_id: number;
  group_number: number;
  department: string;
  member_count: number;
  members?: string;
  supervisor_first_name?: string;
  supervisor_last_name?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: UserRole;
  department?: string;
  matric_number?: string; // For students
  gpa?: number; // For students
}

export interface AuthResponse extends ApiResponse {
  data?: {
    user: User;
    student?: Student;
    supervisor?: Supervisor;
    token?: string;
  };
}