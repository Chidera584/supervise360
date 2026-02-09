// Re-export types from frontend for consistency
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
  email_verified: boolean;
  last_login?: string;
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
  academic_year?: string;
  program?: string;
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
  specialization?: string;
  office_location?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: number;
  group_number: number;
  supervisor_id?: number;
  department: string;
  max_members: number;
  current_members: number;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  group_id: number;
  title: string;
  description?: string;
  objectives?: string;
  methodology?: string;
  expected_outcomes?: string;
  status: ProjectStatus;
  rejection_reason?: string;
  progress_percentage: number;
  submitted_at: string;
  approved_at?: string;
  completed_at?: string;
  updated_at: string;
}

export interface Report {
  id: number;
  project_id: number;
  group_id: number;
  report_type: ReportType;
  title: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  submitted_by: number;
  submitted_at: string;
  reviewed: boolean;
  reviewed_by?: number;
  reviewed_at?: string;
  review_comments?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: NotificationType;
  priority: 'low' | 'normal' | 'high';
  read_status: boolean;
  related_id?: number;
  action_url?: string;
  expires_at?: string;
  created_at: string;
  read_at?: string;
}

// API Request/Response types
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
  matric_number?: string;
  gpa?: number;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: Omit<User, 'password_hash'>;
    student?: Student;
    supervisor?: Supervisor;
    token: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// JWT Payload
export interface JWTPayload {
  userId: number;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

import { Request, Response, NextFunction } from 'express';

// Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: UserRole;
  };
}