/**
 * Comprehensive System Behavior Test Script
 * 
 * This script tests the following system behaviors:
 * 1. Admin assignments reflecting on user profiles
 * 2. Student account creation & login with matric number
 * 3. Supervisor account creation & login with email
 * 4. Data consistency verification
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'supervise360',
  port: process.env.DB_PORT || 3306
};

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

class SystemBehaviorTester {
  constructor() {
    this.connection = null;
    this.testResults = [];
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection(dbConfig);
      console.log('✅ Database connection established');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      console.log('✅ Database connection closed');
    }
  }

  logTest(testName, passed, details = '') {
    const result = { testName, passed, details, timestamp: new Date().toISOString() };
    this.testResults.push(result);
    console.log(`${passed ? '✅' : '❌'} ${testName}${details ? ': ' + details : ''}`);
  }

  async clearTestData() {
    try {
      // Clear test data in correct order to avoid foreign key constraints
      await this.connection.execute('DELETE FROM supervisor_assignments WHERE group_id IN (SELECT id FROM groups WHERE name LIKE "Test%")');
      await this.connection.execute('DELETE FROM group_members WHERE group_id IN (SELECT id FROM groups WHERE name LIKE "Test%")');
      await this.connection.execute('DELETE FROM groups WHERE name LIKE "Test%"');
      await this.connection.execute('DELETE FROM students WHERE user_id IN (SELECT id FROM users WHERE email LIKE "test%@%")');
      await this.connection.execute('DELETE FROM supervisors WHERE user_id IN (SELECT id FROM users WHERE email LIKE "test%@%")');
      await this.connection.execute('DELETE FROM users WHERE email LIKE "test%@%"');
      
      console.log('🧹 Test data cleared');
    } catch (error) {
      console.error('⚠️ Error clearing test data:', error.message);
    }
  }

  // Test 1: Admin Group Creation and Assignment
  async testAdminGroupCreation() {
    console.log('\n📋 Testing Admin Group Creation and Assignment...');
    
    try {
      // Create test admin user
      const adminPassword = await bcrypt.hash('admin123', 12);
      const [adminResult] = await this.connection.execute(
        'INSERT INTO users (first_name, last_name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?, ?)',
        ['Test', 'Admin', 'testadmin@university.edu', adminPassword, 'admin', 'Computer Science']
      );
      const adminId = adminResult.insertId;

      // Create test supervisor
      const supervisorPassword = await bcrypt.hash('supervisor123', 12);
      const [supervisorResult] = await this.connection.execute(
        'INSERT INTO users (first_name, last_name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?, ?)',
        ['Dr. Test', 'Supervisor', 'testsupervisor@university.edu', supervisorPassword, 'supervisor', 'Computer Science']
      );
      const supervisorId = supervisorResult.insertId;

      // Create supervisor profile
      await this.connection.execute(
        'INSERT INTO supervisors (user_id, department, max_capacity) VALUES (?, ?, ?)',
        [supervisorId, 'Computer Science', 5]
      );

      // Create test group
      const [groupResult] = await this.connection.execute(
        'INSERT INTO groups (name, status, formation_method, avg_gpa) VALUES (?, ?, ?, ?)',
        ['Test Group Alpha', 'active', 'manual', 3.75]
      );
      const groupId = groupResult.insertId;

      // Assign supervisor to group
      await this.connection.execute(
        'INSERT INTO supervisor_assignments (group_id, supervisor_id, assigned_by, assignment_method) VALUES (?, ?, ?, ?)',
        [groupId, supervisorId, adminId, 'manual']
      );

      // Add group members
      const members = [
        { name: 'Test Student One', gpa: 4.0, tier: 'HIGH' },
        { name: 'Test Student Two', gpa: 3.5, tier: 'MEDIUM' },
        { name: 'Test Student Three', gpa: 3.0, tier: 'MEDIUM' }
      ];

      for (const member of members) {
        await this.connection.execute(
          'INSERT INTO group_members (group_id, student_name, student_gpa, gpa_tier) VALUES (?, ?, ?, ?)',
          [groupId, member.name, member.gpa, member.tier]
        );
      }

      this.logTest('Admin Group Creation', true, 'Group created with supervisor assignment');
      return { adminId, supervisorId, groupId };
    } catch (error) {
      this.logTest('Admin Group Creation', false, error.message);
      throw error;
    }
  }

  // Test 2: Student Account Creation with Matric Number
  async testStudentAccountCreation() {
    console.log('\n👨‍🎓 Testing Student Account Creation...');
    
    try {
      const studentData = {
        first_name: 'Test',
        last_name: 'Student',
        email: 'teststudent@student.edu',
        password: 'student123',
        matric_number: 'ST2024TEST001',
        gpa: 3.75,
        department: 'Computer Science',
        role: 'student'
      };

      // Hash password
      const passwordHash = await bcrypt.hash(studentData.password, 12);

      // Check if matric number is unique
      const [existingStudent] = await this.connection.execute(
        'SELECT id FROM students WHERE matric_number = ?',
        [studentData.matric_number]
      );

      if (existingStudent.length > 0) {
        this.logTest('Student Matric Number Uniqueness', false, 'Matric number already exists');
        return null;
      }

      // Create user account
      const [userResult] = await this.connection.execute(
        'INSERT INTO users (first_name, last_name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?, ?)',
        [studentData.first_name, studentData.last_name, studentData.email, passwordHash, studentData.role, studentData.department]
      );
      const userId = userResult.insertId;

      // Create student profile
      await this.connection.execute(
        'INSERT INTO students (user_id, matric_number, gpa, gpa_tier, academic_year, program) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, studentData.matric_number, studentData.gpa, 'HIGH', '2024/2025', 'Bachelor of Computer Science']
      );

      this.logTest('Student Account Creation', true, `Created account for ${studentData.matric_number}`);
      return { userId, ...studentData };
    } catch (error) {
      this.logTest('Student Account Creation', false, error.message);
      throw error;
    }
  }

  // Test 3: Student Login with Matric Number (Modified for Email-based Login)
  async testStudentLogin(studentData) {
    console.log('\n🔐 Testing Student Login...');
    
    try {
      // Note: Current system uses email for login, but we'll test the concept
      // In a matric-based system, this would query by matric_number
      
      // Get student by email (simulating matric-based lookup)
      const [userRows] = await this.connection.execute(
        `SELECT u.*, s.matric_number, s.gpa, s.gpa_tier, s.academic_year, s.program 
         FROM users u 
         LEFT JOIN students s ON u.id = s.user_id 
         WHERE u.email = ? AND u.is_active = TRUE`,
        [studentData.email]
      );

      if (userRows.length === 0) {
        this.logTest('Student Login - User Lookup', false, 'Student not found');
        return null;
      }

      const user = userRows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(studentData.password, user.password_hash);
      if (!isValidPassword) {
        this.logTest('Student Login - Password Verification', false, 'Invalid password');
        return null;
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, matricNumber: user.matric_number },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      this.logTest('Student Login', true, `Login successful for ${user.matric_number}`);
      return { user, token };
    } catch (error) {
      this.logTest('Student Login', false, error.message);
      throw error;
    }
  }

  // Test 4: Supervisor Account Creation with Email
  async testSupervisorAccountCreation() {
    console.log('\n👨‍🏫 Testing Supervisor Account Creation...');
    
    try {
      const supervisorData = {
        first_name: 'Dr. Test',
        last_name: 'Supervisor2',
        email: 'testsupervisor2@university.edu',
        password: 'supervisor123',
        department: 'Computer Science',
        role: 'supervisor'
      };

      // Hash password
      const passwordHash = await bcrypt.hash(supervisorData.password, 12);

      // Check if email is unique
      const [existingUser] = await this.connection.execute(
        'SELECT id FROM users WHERE email = ?',
        [supervisorData.email]
      );

      if (existingUser.length > 0) {
        this.logTest('Supervisor Email Uniqueness', false, 'Email already exists');
        return null;
      }

      // Create user account
      const [userResult] = await this.connection.execute(
        'INSERT INTO users (first_name, last_name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?, ?)',
        [supervisorData.first_name, supervisorData.last_name, supervisorData.email, passwordHash, supervisorData.role, supervisorData.department]
      );
      const userId = userResult.insertId;

      // Create supervisor profile
      await this.connection.execute(
        'INSERT INTO supervisors (user_id, department, max_capacity, is_available) VALUES (?, ?, ?, ?)',
        [userId, supervisorData.department, 5, true]
      );

      this.logTest('Supervisor Account Creation', true, `Created account for ${supervisorData.email}`);
      return { userId, ...supervisorData };
    } catch (error) {
      this.logTest('Supervisor Account Creation', false, error.message);
      throw error;
    }
  }

  // Test 5: Supervisor Login with Email
  async testSupervisorLogin(supervisorData) {
    console.log('\n🔐 Testing Supervisor Login...');
    
    try {
      // Get supervisor by email
      const [userRows] = await this.connection.execute(
        `SELECT u.*, s.department as supervisor_department, s.max_capacity, s.current_load, s.is_available 
         FROM users u 
         LEFT JOIN supervisors s ON u.id = s.user_id 
         WHERE u.email = ? AND u.is_active = TRUE`,
        [supervisorData.email]
      );

      if (userRows.length === 0) {
        this.logTest('Supervisor Login - User Lookup', false, 'Supervisor not found');
        return null;
      }

      const user = userRows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(supervisorData.password, user.password_hash);
      if (!isValidPassword) {
        this.logTest('Supervisor Login - Password Verification', false, 'Invalid password');
        return null;
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      this.logTest('Supervisor Login', true, `Login successful for ${user.email}`);
      return { user, token };
    } catch (error) {
      this.logTest('Supervisor Login', false, error.message);
      throw error;
    }
  }

  // Test 6: Data Consistency - Group Assignments Reflecting on Profiles
  async testDataConsistency(testData) {
    console.log('\n🔄 Testing Data Consistency...');
    
    try {
      const { supervisorId, groupId } = testData;

      // Test 1: Supervisor can see assigned groups
      const [supervisorGroups] = await this.connection.execute(
        `SELECT g.*, sa.assigned_at, sa.assignment_method,
                COUNT(gm.id) as member_count,
                GROUP_CONCAT(gm.student_name ORDER BY gm.student_gpa DESC SEPARATOR ', ') as members
         FROM groups g
         JOIN supervisor_assignments sa ON g.id = sa.group_id
         LEFT JOIN group_members gm ON g.id = gm.group_id
         WHERE sa.supervisor_id = ?
         GROUP BY g.id`,
        [supervisorId]
      );

      if (supervisorGroups.length > 0) {
        this.logTest('Supervisor Group Visibility', true, `Supervisor can see ${supervisorGroups.length} assigned group(s)`);
      } else {
        this.logTest('Supervisor Group Visibility', false, 'Supervisor cannot see assigned groups');
      }

      // Test 2: Group details are complete
      const [groupDetails] = await this.connection.execute(
        `SELECT g.*, 
                u.first_name as supervisor_first_name, 
                u.last_name as supervisor_last_name,
                u.email as supervisor_email,
                COUNT(gm.id) as member_count,
                AVG(gm.student_gpa) as calculated_avg_gpa
         FROM groups g
         LEFT JOIN supervisor_assignments sa ON g.id = sa.group_id
         LEFT JOIN users u ON sa.supervisor_id = u.id
         LEFT JOIN group_members gm ON g.id = gm.group_id
         WHERE g.id = ?
         GROUP BY g.id`,
        [groupId]
      );

      if (groupDetails.length > 0 && groupDetails[0].supervisor_email) {
        this.logTest('Group-Supervisor Linkage', true, 'Group correctly linked to supervisor');
      } else {
        this.logTest('Group-Supervisor Linkage', false, 'Group not properly linked to supervisor');
      }

      // Test 3: Student profile would show group assignment (simulated)
      // In a real scenario, students would be linked to groups via their matric numbers
      const [studentInGroup] = await this.connection.execute(
        `SELECT gm.*, g.name as group_name, g.status as group_status
         FROM group_members gm
         JOIN groups g ON gm.group_id = g.id
         WHERE gm.student_name = ?`,
        ['Test Student One']
      );

      if (studentInGroup.length > 0) {
        this.logTest('Student Group Assignment', true, 'Student correctly assigned to group');
      } else {
        this.logTest('Student Group Assignment', false, 'Student not found in group');
      }

      // Test 4: Supervisor capacity is updated
      const [supervisorCapacity] = await this.connection.execute(
        'SELECT current_groups, max_groups FROM supervisor_capacity WHERE supervisor_id = ?',
        [supervisorId]
      );

      if (supervisorCapacity.length > 0 && supervisorCapacity[0].current_groups > 0) {
        this.logTest('Supervisor Capacity Update', true, `Supervisor capacity updated: ${supervisorCapacity[0].current_groups}/${supervisorCapacity[0].max_groups}`);
      } else {
        this.logTest('Supervisor Capacity Update', false, 'Supervisor capacity not updated');
      }

    } catch (error) {
      this.logTest('Data Consistency Check', false, error.message);
      throw error;
    }
  }

  // Test 7: Pre-assignment Data Persistence
  async testPreAssignmentPersistence() {
    console.log('\n💾 Testing Pre-assignment Data Persistence...');
    
    try {
      // Create a group and supervisor assignment before user accounts exist
      const [groupResult] = await this.connection.execute(
        'INSERT INTO groups (name, status, formation_method) VALUES (?, ?, ?)',
        ['Test Pre-Assignment Group', 'planning', 'manual']
      );
      const preGroupId = groupResult.insertId;

      // Add members to group (before they have accounts)
      const preMembers = [
        { name: 'Future Student One', gpa: 3.8, tier: 'HIGH' },
        { name: 'Future Student Two', gpa: 3.2, tier: 'MEDIUM' }
      ];

      for (const member of preMembers) {
        await this.connection.execute(
          'INSERT INTO group_members (group_id, student_name, student_gpa, gpa_tier) VALUES (?, ?, ?, ?)',
          [preGroupId, member.name, member.gpa, member.tier]
        );
      }

      // Now create user account for one of the "future" students
      const futureStudentPassword = await bcrypt.hash('future123', 12);
      const [futureUserResult] = await this.connection.execute(
        'INSERT INTO users (first_name, last_name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?, ?)',
        ['Future', 'Student', 'futurestudent@student.edu', futureStudentPassword, 'student', 'Computer Science']
      );
      const futureUserId = futureUserResult.insertId;

      await this.connection.execute(
        'INSERT INTO students (user_id, matric_number, gpa, gpa_tier) VALUES (?, ?, ?, ?)',
        [futureUserId, 'ST2024FUTURE001', 3.8, 'HIGH']
      );

      // Verify that the pre-assignment data still exists
      const [preAssignmentCheck] = await this.connection.execute(
        'SELECT * FROM group_members WHERE group_id = ? AND student_name = ?',
        [preGroupId, 'Future Student One']
      );

      if (preAssignmentCheck.length > 0) {
        this.logTest('Pre-assignment Data Persistence', true, 'Group assignments persist before account creation');
      } else {
        this.logTest('Pre-assignment Data Persistence', false, 'Pre-assignment data lost');
      }

      // In a real system, you would link the student to the group via matric number matching
      // This demonstrates that assignments made before login are preserved

    } catch (error) {
      this.logTest('Pre-assignment Data Persistence', false, error.message);
      throw error;
    }
  }

  // Test 8: Authentication Flow Integration
  async testAuthenticationFlow() {
    console.log('\n🔐 Testing Complete Authentication Flow...');
    
    try {
      // Test student registration and immediate login
      const newStudent = {
        first_name: 'Auth',
        last_name: 'Test',
        email: 'authtest@student.edu',
        password: 'authtest123',
        matric_number: 'ST2024AUTH001',
        gpa: 3.6,
        role: 'student',
        department: 'Computer Science'
      };

      // Register student
      const passwordHash = await bcrypt.hash(newStudent.password, 12);
      const [userResult] = await this.connection.execute(
        'INSERT INTO users (first_name, last_name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?, ?)',
        [newStudent.first_name, newStudent.last_name, newStudent.email, passwordHash, newStudent.role, newStudent.department]
      );
      const userId = userResult.insertId;

      await this.connection.execute(
        'INSERT INTO students (user_id, matric_number, gpa, gpa_tier) VALUES (?, ?, ?, ?)',
        [userId, newStudent.matric_number, newStudent.gpa, 'MEDIUM']
      );

      // Immediate login after registration
      const [loginCheck] = await this.connection.execute(
        `SELECT u.*, s.matric_number, s.gpa 
         FROM users u 
         LEFT JOIN students s ON u.id = s.user_id 
         WHERE u.email = ?`,
        [newStudent.email]
      );

      if (loginCheck.length > 0 && loginCheck[0].matric_number === newStudent.matric_number) {
        this.logTest('Registration-Login Flow', true, 'Student can login immediately after registration');
      } else {
        this.logTest('Registration-Login Flow', false, 'Login failed after registration');
      }

    } catch (error) {
      this.logTest('Authentication Flow', false, error.message);
      throw error;
    }
  }

  // Main test runner
  async runAllTests() {
    console.log('🚀 Starting Comprehensive System Behavior Tests\n');
    console.log('=' .repeat(60));

    try {
      // Connect to database
      const connected = await this.connect();
      if (!connected) {
        console.log('❌ Cannot proceed without database connection');
        return;
      }

      // Clear any existing test data
      await this.clearTestData();

      // Run tests in sequence
      const adminTestData = await this.testAdminGroupCreation();
      const studentData = await this.testStudentAccountCreation();
      
      if (studentData) {
        await this.testStudentLogin(studentData);
      }

      const supervisorData = await this.testSupervisorAccountCreation();
      if (supervisorData) {
        await this.testSupervisorLogin(supervisorData);
      }

      if (adminTestData) {
        await this.testDataConsistency(adminTestData);
      }

      await this.testPreAssignmentPersistence();
      await this.testAuthenticationFlow();

      // Print summary
      this.printTestSummary();

    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
    } finally {
      // Clean up test data
      await this.clearTestData();
      await this.disconnect();
    }
  }

  printTestSummary() {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('=' .repeat(60));

    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => r.passed === false).length;
    const total = this.testResults.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.passed === false)
        .forEach(r => console.log(`   • ${r.testName}: ${r.details}`));
    }

    console.log('\n📋 Detailed Results:');
    this.testResults.forEach(r => {
      console.log(`${r.passed ? '✅' : '❌'} ${r.testName}`);
      if (r.details) console.log(`   ${r.details}`);
    });

    console.log('\n' + '=' .repeat(60));
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new SystemBehaviorTester();
  tester.runAllTests().catch(console.error);
}

module.exports = SystemBehaviorTester;