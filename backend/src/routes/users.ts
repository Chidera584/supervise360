import { Router } from 'express';
import { getMany, getOne, updateRecord } from '../config/database';
import { authenticateToken, requireAdmin, requireAny } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { sendProfileUpdateEmailOnly } from '../services/notificationEmailService';

const router = Router();

// GET /api/users - Get all users (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await getMany(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.department, 
             u.is_active, u.email_verified, u.last_login, u.created_at
      FROM users u 
      ORDER BY u.created_at DESC
    `);

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users'
    });
  }
});

// GET /api/users/students - Get all students with details (uses direct query - no view dependency)
router.get('/students', authenticateToken, requireAny, async (req, res) => {
  try {
    const students = await getMany(`
      SELECT s.id, s.user_id, s.matric_number, u.first_name, u.last_name, u.email, u.department, 
             s.gpa, s.gpa_tier, s.academic_year, s.program
      FROM students s
      INNER JOIN users u ON s.user_id = u.id
      ORDER BY u.last_name, u.first_name
    `);

    res.status(200).json({
      success: true,
      message: 'Students retrieved successfully',
      data: students
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve students'
    });
  }
});

// GET /api/users/supervisors - Get all supervisors with workload (uses direct query - no view dependency)
router.get('/supervisors', authenticateToken, requireAny, async (req, res) => {
  try {
    const supervisors = await getMany(`
      SELECT sup.id, u.first_name, u.last_name, u.email, sup.department, sup.specialization, 
             sup.office_location, sup.phone, sup.current_load,
             sup.is_available, u.is_active, u.last_login
      FROM supervisors sup
      INNER JOIN users u ON sup.user_id = u.id
      ORDER BY u.last_name, u.first_name
    `);

    res.status(200).json({
      success: true,
      message: 'Supervisors retrieved successfully',
      data: supervisors
    });
  } catch (error) {
    console.error('Get supervisors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve supervisors'
    });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Users can only view their own profile unless they're admin
    if (req.user?.role !== 'admin' && req.user?.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const user = await getOne(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.department, 
             u.is_active, u.email_verified, u.last_login, u.created_at
      FROM users u 
      WHERE u.id = ?
    `, [userId]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get role-specific data
    let roleData = null;
    if (user.role === 'student') {
      roleData = await getOne('SELECT * FROM students WHERE user_id = ?', [userId]);
    } else if (user.role === 'supervisor' || user.role === 'external_supervisor') {
      roleData = await getOne('SELECT * FROM supervisors WHERE user_id = ?', [userId]);
    }

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: {
        user,
        roleData
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user'
    });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Users can only update their own profile unless they're admin
    if (req.user?.role !== 'admin' && req.user?.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { first_name, last_name, department, phone, office_location, specialization } = req.body;

    // Update user table
    const userUpdateData: any = {};
    if (first_name) userUpdateData.first_name = first_name;
    if (last_name) userUpdateData.last_name = last_name;
    if (department) userUpdateData.department = department;

    if (Object.keys(userUpdateData).length > 0) {
      await updateRecord('users', userUpdateData, 'id = ?', [userId]);
    }

    // Update role-specific data
    const user = await getOne('SELECT role FROM users WHERE id = ?', [userId]);
    if (user?.role === 'supervisor' || user?.role === 'external_supervisor') {
      const supervisorUpdateData: any = {};
      if (phone) supervisorUpdateData.phone = phone;
      if (office_location) supervisorUpdateData.office_location = office_location;
      if (specialization) supervisorUpdateData.specialization = specialization;

    if (Object.keys(supervisorUpdateData).length > 0) {
      await updateRecord('supervisors', supervisorUpdateData, 'user_id = ?', [userId]);
    }
  }

  // Send profile update confirmation email
  const changes: string[] = [];
  if (first_name) changes.push('First name');
  if (last_name) changes.push('Last name');
  if (department) changes.push('Department');
  if (phone) changes.push('Phone');
  if (office_location) changes.push('Office location');
  if (specialization) changes.push('Specialization');
  if (changes.length > 0) {
    const user = await getOne('SELECT first_name, email FROM users WHERE id = ?', [userId]);
    if (user?.email) {
      sendProfileUpdateEmailOnly(
        user.email,
        user.first_name || 'User',
        changes,
        new Date().toLocaleString()
      ).catch(() => {});
    }
  }

  res.status(200).json({
    success: true,
    message: 'User updated successfully'
  });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
});

// PUT /api/users/:id/status - Update user status (Admin only)
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_active must be a boolean value'
      });
    }

    const result = await updateRecord('users', { is_active }, 'id = ?', [userId]);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: `User ${is_active ? 'activated' : 'deactivated'} successfully`
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to update user status'
      });
    }
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status'
    });
  }
});

export default router;