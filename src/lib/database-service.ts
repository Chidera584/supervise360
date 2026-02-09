import { pool, executeQuery, getOne, getMany, insertRecord, updateRecord } from './database';
import type { 
  User, Student, Supervisor, Project, Report,
  AuthResponse, LoginRequest, RegisterRequest,
  StudentComplete, SupervisorWorkload, GroupWithMembers
} from '../types/database';
import bcrypt from 'bcryptjs';

// ============================================
// AUTHENTICATION SERVICES
// ============================================

export class AuthService {
  static async login(credentials: LoginRequest): Promise<AuthResponse | null> {
    try {
      const user = await getOne(
        'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
        [credentials.email]
      ) as User;

      if (!user) {
        throw new Error('Invalid email or password');
      }

      const isValidPassword = await bcrypt.compare(credentials.password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Update last login
      await updateRecord('users', { last_login: new Date() }, 'id = ?', [user.id]);

      // Get role-specific data
      let student: Student | undefined;
      let supervisor: Supervisor | undefined;

      if (user.role === 'student') {
        student = await getOne('SELECT * FROM students WHERE user_id = ?', [user.id]) as Student;
      } else if (user.role === 'supervisor' || user.role === 'external_supervisor') {
        supervisor = await getOne('SELECT * FROM supervisors WHERE user_id = ?', [user.id]) as Supervisor;
      }

      return { user, student, supervisor };
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  }

  static async register(userData: RegisterRequest): Promise<AuthResponse | null> {
    try {
      // Check if email already exists
      const existingUser = await getOne('SELECT id FROM users WHERE email = ?', [userData.email]);
      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Hash password
      const password_hash = await bcrypt.hash(userData.password, 12);

      // Create user
      const userResult = await insertRecord('users', {
        first_name: userData.first_name,
        last_name: userData.last_name,
        email: userData.email,
        password_hash,
        role: userData.role,
        department: userData.department
      });

      if (!userResult.success) {
        throw new Error('Failed to create user');
      }

      const userId = userResult.insertId;

      // Create role-specific record
      if (userData.role === 'student' && userData.matric_number) {
        const studentData: any = {
          user_id: userId,
          matric_number: userData.matric_number
        };

        // Only add GPA if provided
        if (userData.gpa !== undefined) {
          studentData.gpa = userData.gpa;
        }

        await insertRecord('students', studentData);
      } else if (userData.role === 'supervisor' || userData.role === 'external_supervisor') {
        await insertRecord('supervisors', {
          user_id: userId,
          department: userData.department || 'General'
        });
      }

      // Return login response
      return await this.login({ email: userData.email, password: userData.password });
    } catch (error) {
      console.error('Registration error:', error);
      return null;
    }
  }

  static async getCurrentUser(userId: number): Promise<AuthResponse | null> {
    try {
      const user = await getOne('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [userId]) as User;
      if (!user) return null;

      let student: Student | undefined;
      let supervisor: Supervisor | undefined;

      if (user.role === 'student') {
        student = await getOne('SELECT * FROM students WHERE user_id = ?', [user.id]) as Student;
      } else if (user.role === 'supervisor' || user.role === 'external_supervisor') {
        supervisor = await getOne('SELECT * FROM supervisors WHERE user_id = ?', [user.id]) as Supervisor;
      }

      return { user, student, supervisor };
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }
}

// ============================================
// USER MANAGEMENT SERVICES
// ============================================

export class UserService {
  static async getAllUsers(): Promise<User[]> {
    return await getMany('SELECT * FROM users ORDER BY created_at DESC') as User[];
  }

  static async getUserById(id: number): Promise<User | null> {
    return await getOne('SELECT * FROM users WHERE id = ?', [id]) as User;
  }

  static async updateUser(id: number, data: Partial<User>): Promise<boolean> {
    const result = await updateRecord('users', data, 'id = ?', [id]);
    return result.success;
  }

  static async deactivateUser(id: number): Promise<boolean> {
    const result = await updateRecord('users', { is_active: false }, 'id = ?', [id]);
    return result.success;
  }
}

// ============================================
// STUDENT SERVICES
// ============================================

export class StudentService {
  static async getAllStudents(): Promise<StudentComplete[]> {
    return await getMany('SELECT * FROM v_students_complete ORDER BY last_name, first_name') as StudentComplete[];
  }

  static async getStudentById(id: number): Promise<StudentComplete | null> {
    return await getOne('SELECT * FROM v_students_complete WHERE id = ?', [id]) as StudentComplete;
  }

  static async getStudentByUserId(userId: number): Promise<Student | null> {
    return await getOne('SELECT * FROM students WHERE user_id = ?', [userId]) as Student;
  }

  static async getStudentsWithoutGroup(): Promise<StudentComplete[]> {
    return await getMany(
      'SELECT * FROM v_students_complete WHERE group_id IS NULL ORDER BY gpa DESC'
    ) as StudentComplete[];
  }

  static async updateStudent(id: number, data: Partial<Student>): Promise<boolean> {
    const result = await updateRecord('students', data, 'id = ?', [id]);
    return result.success;
  }

  static async assignToGroup(studentId: number, groupId: number): Promise<boolean> {
    const result = await updateRecord('students', { group_id: groupId }, 'id = ?', [studentId]);
    return result.success;
  }
}

// ============================================
// SUPERVISOR SERVICES
// ============================================

export class SupervisorService {
  static async getAllSupervisors(): Promise<SupervisorWorkload[]> {
    return await getMany('SELECT * FROM v_supervisor_workload ORDER BY last_name, first_name') as SupervisorWorkload[];
  }

  static async getAvailableSupervisors(): Promise<SupervisorWorkload[]> {
    return await getMany(
      'SELECT * FROM v_supervisor_workload WHERE is_available = TRUE AND available_slots > 0 ORDER BY workload_percentage ASC'
    ) as SupervisorWorkload[];
  }

  static async getSupervisorById(id: number): Promise<SupervisorWorkload | null> {
    return await getOne('SELECT * FROM v_supervisor_workload WHERE id = ?', [id]) as SupervisorWorkload;
  }

  static async updateSupervisor(id: number, data: Partial<Supervisor>): Promise<boolean> {
    const result = await updateRecord('supervisors', data, 'id = ?', [id]);
    return result.success;
  }
}

// ============================================
// GROUP SERVICES
// ============================================

export class GroupService {
  static async getAllGroups(): Promise<GroupWithMembers[]> {
    return await getMany('SELECT * FROM v_groups_with_members ORDER BY group_number') as GroupWithMembers[];
  }

  static async getGroupById(id: number): Promise<GroupWithMembers | null> {
    return await getOne('SELECT * FROM v_groups_with_members WHERE group_id = ?', [id]) as GroupWithMembers;
  }

  static async createGroup(data: { department: string; max_members?: number }): Promise<number | null> {
    try {
      // Get next group number
      const lastGroup = await getOne('SELECT MAX(group_number) as max_num FROM student_groups') as any;
      const groupNumber = (lastGroup?.max_num || 0) + 1;

      const result = await insertRecord('student_groups', {
        group_number: groupNumber,
        department: data.department,
        max_members: data.max_members || 3
      });

      return result.success ? result.insertId : null;
    } catch (error) {
      console.error('Create group error:', error);
      return null;
    }
  }

  static async assignSupervisor(groupId: number, supervisorId: number): Promise<boolean> {
    const result = await updateRecord('student_groups', { supervisor_id: supervisorId }, 'id = ?', [groupId]);
    return result.success;
  }

  static async getIncompleteGroups(): Promise<GroupWithMembers[]> {
    return await getMany(
      'SELECT * FROM v_groups_with_members WHERE is_complete = FALSE ORDER BY group_number'
    ) as GroupWithMembers[];
  }
}

// ============================================
// PROJECT SERVICES
// ============================================

export class ProjectService {
  static async getAllProjects(): Promise<Project[]> {
    return await getMany('SELECT * FROM v_projects_complete ORDER BY submitted_at DESC') as Project[];
  }

  static async getProjectById(id: number): Promise<Project | null> {
    return await getOne('SELECT * FROM v_projects_complete WHERE id = ?', [id]) as Project;
  }

  static async createProject(data: Omit<Project, 'id' | 'submitted_at' | 'updated_at'>): Promise<number | null> {
    const result = await insertRecord('projects', data);
    return result.success ? result.insertId : null;
  }

  static async updateProject(id: number, data: Partial<Project>): Promise<boolean> {
    const result = await updateRecord('projects', data, 'id = ?', [id]);
    return result.success;
  }

  static async approveProject(id: number): Promise<boolean> {
    const result = await updateRecord('projects', { 
      status: 'approved', 
      approved_at: new Date() 
    }, 'id = ?', [id]);
    return result.success;
  }

  static async rejectProject(id: number, reason: string): Promise<boolean> {
    const result = await updateRecord('projects', { 
      status: 'rejected', 
      rejection_reason: reason 
    }, 'id = ?', [id]);
    return result.success;
  }
}

// ============================================
// REPORT SERVICES
// ============================================

export class ReportService {
  static async getAllReports(): Promise<Report[]> {
    return await getMany('SELECT * FROM v_reports_complete ORDER BY submitted_at DESC') as Report[];
  }

  static async getReportsByGroup(groupId: number): Promise<Report[]> {
    return await getMany('SELECT * FROM v_reports_complete WHERE group_id = ?', [groupId]) as Report[];
  }

  static async submitReport(data: Omit<Report, 'id' | 'submitted_at' | 'reviewed' | 'reviewed_at'>): Promise<number | null> {
    const result = await insertRecord('reports', data);
    return result.success ? result.insertId : null;
  }

  static async reviewReport(id: number, reviewerId: number, comments?: string): Promise<boolean> {
    const result = await updateRecord('reports', {
      reviewed: true,
      reviewed_by: reviewerId,
      reviewed_at: new Date(),
      review_comments: comments
    }, 'id = ?', [id]);
    return result.success;
  }
}

// ============================================
// NOTIFICATION SERVICES
// ============================================

export class NotificationService {
  static async getUserNotifications(userId: number, limit: number = 50): Promise<Notification[]> {
    return await getMany(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    ) as Notification[];
  }

  static async getUnreadCount(userId: number): Promise<number> {
    const result = await getOne(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_status = FALSE',
      [userId]
    ) as any;
    return result?.count || 0;
  }

  static async markAsRead(id: number): Promise<boolean> {
    const result = await updateRecord('notifications', {
      read_status: true,
      read_at: new Date()
    }, 'id = ?', [id]);
    return result.success;
  }

  static async markAllAsRead(userId: number): Promise<boolean> {
    const result = await updateRecord('notifications', {
      read_status: true,
      read_at: new Date()
    }, 'user_id = ? AND read_status = FALSE', [userId]);
    return result.success;
  }

  static async createNotification(data: Omit<Notification, 'id' | 'created_at' | 'read_status' | 'read_at'>): Promise<boolean> {
    const result = await insertRecord('notifications', data);
    return result.success;
  }
}

// ============================================
// DASHBOARD SERVICES
// ============================================

export class DashboardService {
  static async getAdminStats() {
    return await getOne('SELECT * FROM v_admin_dashboard_stats');
  }

  static async getStudentDashboard(userId: number) {
    return await getOne('SELECT * FROM v_student_dashboard WHERE student_id = (SELECT id FROM students WHERE user_id = ?)', [userId]);
  }

  static async getSupervisorDashboard(userId: number) {
    return await getOne('SELECT * FROM v_supervisor_dashboard WHERE supervisor_id = (SELECT id FROM supervisors WHERE user_id = ?)', [userId]);
  }
}