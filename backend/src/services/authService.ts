import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getOne, insertRecord, updateRecord } from '../config/database';
import { pool } from '../config/database';
import { User, Student, Supervisor, LoginRequest, RegisterRequest, AuthResponse } from '../types';
import { sendPasswordResetEmailOnly, sendWelcomeEmailOnly } from './notificationEmailService';

export class AuthService {
  static async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      // Get user by email
      const user = await getOne(
        'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
        [credentials.email]
      ) as User;

      if (!user) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(credentials.password, user.password_hash);
      if (!isValidPassword) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
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

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        },
        process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
      );

      // Remove password from response
      const { password_hash, ...userWithoutPassword } = user;

      return {
        success: true,
        message: 'Login successful',
        data: {
          user: userWithoutPassword,
          student,
          supervisor,
          token
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed. Please try again.'
      };
    }
  }

  static async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      // Check if email already exists
      const existingUser = await getOne('SELECT id FROM users WHERE email = ?', [userData.email]);
      if (existingUser) {
        return {
          success: false,
          message: 'Email already registered'
        };
      }

      // Check if matric number already exists (for students)
      if (userData.role === 'student' && userData.matric_number) {
        const existingStudent = await getOne('SELECT id FROM students WHERE matric_number = ?', [userData.matric_number]);
        if (existingStudent) {
          return {
            success: false,
            message: 'Matric number already registered'
          };
        }
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
        department: userData.department,
        email_verified: false // Will be true after email verification
      });

      if (!userResult.success) {
        return {
          success: false,
          message: 'Failed to create user account'
        };
      }

      const userId = userResult.insertId!;

      // Create role-specific record
      if (userData.role === 'student' && userData.matric_number) {
        const gpa = userData.gpa !== undefined && userData.gpa !== null ? Number(userData.gpa) : 0;
        const studentData: any = {
          user_id: userId,
          matric_number: userData.matric_number,
          gpa: Math.min(5, Math.max(0, gpa)),
          gpa_tier: gpa >= 3.8 ? 'HIGH' : gpa >= 3.3 ? 'MEDIUM' : 'LOW'
        };

        const studentResult = await insertRecord('students', studentData);

        if (!studentResult.success) {
          // Rollback user creation
          await updateRecord('users', { is_active: false }, 'id = ?', [userId]);
          return {
            success: false,
            message: 'Failed to create student profile'
          };
        }
      } else if (userData.role === 'supervisor' || userData.role === 'external_supervisor') {
        const supervisorResult = await insertRecord('supervisors', {
          user_id: userId,
          department: userData.department || 'General'
        });

        if (!supervisorResult.success) {
          // Rollback user creation
          await updateRecord('users', { is_active: false }, 'id = ?', [userId]);
          return {
            success: false,
            message: 'Failed to create supervisor profile'
          };
        }
      }

      // Send welcome email (fire-and-forget)
      sendWelcomeEmailOnly(
        userData.email,
        userData.first_name,
        userData.role,
        undefined
      ).catch(() => {});

      // Auto-login after successful registration
      return await this.login({ email: userData.email, password: userData.password });
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: 'Registration failed. Please try again.'
      };
    }
  }

  static async getCurrentUser(userId: number): Promise<AuthResponse> {
    try {
      const user = await getOne('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [userId]) as User;
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      let student: Student | undefined;
      let supervisor: Supervisor | undefined;

      if (user.role === 'student') {
        student = await getOne('SELECT * FROM students WHERE user_id = ?', [user.id]) as Student;
      } else if (user.role === 'supervisor' || user.role === 'external_supervisor') {
        supervisor = await getOne('SELECT * FROM supervisors WHERE user_id = ?', [user.id]) as Supervisor;
      }

      // Generate new token
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        },
        process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
      );

      // Remove password from response
      const { password_hash, ...userWithoutPassword } = user;

      return {
        success: true,
        message: 'User data retrieved successfully',
        data: {
          user: userWithoutPassword,
          student,
          supervisor,
          token
        }
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return {
        success: false,
        message: 'Failed to retrieve user data'
      };
    }
  }

  static async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await getOne('SELECT id, first_name, email FROM users WHERE email = ? AND is_active = TRUE', [email]) as any;
      if (!user) {
        return { success: true, message: 'If an account exists with that email, a reset link has been sent.' };
      }
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.execute(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, token, expiresAt]
      );
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
      if (user?.email) {
        sendPasswordResetEmailOnly(user.email, user.first_name || 'User', resetLink, 60).catch(() => {});
      }
      return { success: true, message: 'If an account exists with that email, a reset link has been sent.' };
    } catch (error) {
      console.error('Password reset request error:', error);
      return { success: false, message: 'Failed to process password reset request' };
    }
  }

  static async resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const row = await getOne(
        'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ?',
        [token]
      ) as any;
      if (!row) return { success: false, message: 'Invalid or expired reset link' };
      if (row.used_at) return { success: false, message: 'This reset link has already been used' };
      if (new Date() > new Date(row.expires_at)) return { success: false, message: 'This reset link has expired' };
      const password_hash = await bcrypt.hash(newPassword, 12);
      await updateRecord('users', { password_hash }, 'id = ?', [row.user_id]);
      await pool.execute('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [row.id]);
      return { success: true, message: 'Password has been reset successfully' };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, message: 'Failed to reset password' };
    }
  }

  static async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await getOne('SELECT password_hash FROM users WHERE id = ?', [userId]) as User;
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        return { success: false, message: 'Current password is incorrect' };
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 12);
      const result = await updateRecord('users', { password_hash: newPasswordHash }, 'id = ?', [userId]);

      if (result.success) {
        return { success: true, message: 'Password changed successfully' };
      } else {
        return { success: false, message: 'Failed to change password' };
      }
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, message: 'Failed to change password' };
    }
  }
}