/**
 * Quick System Behavior Verification Script
 * 
 * This script provides a simple way to test the key behaviors:
 * 1. User registration and login flows
 * 2. Group assignment visibility
 * 3. Data consistency checks
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'supervise360',
  port: process.env.DB_PORT || 3306
};

class QuickTester {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection(dbConfig);
      console.log('✅ Connected to database');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
    }
  }

  // Test 1: Check if groups and supervisor assignments are properly linked
  async checkGroupSupervisorLinkage() {
    console.log('\n📋 Checking Group-Supervisor Linkage...');
    
    try {
      const [results] = await this.connection.execute(`
        SELECT 
          g.id as group_id,
          g.name as group_name,
          g.status,
          u.first_name,
          u.last_name,
          u.email as supervisor_email,
          sa.assigned_at,
          COUNT(gm.id) as member_count
        FROM groups g
        LEFT JOIN supervisor_assignments sa ON g.id = sa.group_id
        LEFT JOIN users u ON sa.supervisor_id = u.id
        LEFT JOIN group_members gm ON g.id = gm.group_id
        GROUP BY g.id
        ORDER BY g.created_at DESC
        LIMIT 10
      `);

      console.log(`Found ${results.length} groups:`);
      results.forEach(group => {
        const supervisor = group.supervisor_email ? 
          `${group.first_name} ${group.last_name} (${group.supervisor_email})` : 
          'No supervisor assigned';
        console.log(`  • ${group.group_name}: ${supervisor} - ${group.member_count} members`);
      });

      return results;
    } catch (error) {
      console.error('❌ Error checking group-supervisor linkage:', error.message);
      return [];
    }
  }

  // Test 2: Check student accounts and their potential group assignments
  async checkStudentAccounts() {
    console.log('\n👨‍🎓 Checking Student Accounts...');
    
    try {
      const [students] = await this.connection.execute(`
        SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          s.matric_number,
          s.gpa,
          s.gpa_tier,
          u.created_at
        FROM users u
        JOIN students s ON u.id = s.user_id
        WHERE u.role = 'student'
        ORDER BY u.created_at DESC
        LIMIT 10
      `);

      console.log(`Found ${students.length} student accounts:`);
      students.forEach(student => {
        console.log(`  • ${student.first_name} ${student.last_name} (${student.matric_number})`);
        console.log(`    Email: ${student.email}, GPA: ${student.gpa} (${student.gpa_tier})`);
      });

      // Check if any students are in groups (by name matching)
      if (students.length > 0) {
        const studentNames = students.map(s => `${s.first_name} ${s.last_name}`);
        const placeholders = studentNames.map(() => '?').join(',');
        const [groupAssignments] = await this.connection.execute(`
          SELECT 
            gm.student_name,
            g.name as group_name,
            g.status
          FROM group_members gm
          JOIN groups g ON gm.group_id = g.id
          WHERE gm.student_name IN (${placeholders})
        `, studentNames);

        if (groupAssignments.length > 0) {
          console.log('\n  Group Assignments:');
          groupAssignments.forEach(assignment => {
            console.log(`    • ${assignment.student_name} → ${assignment.group_name} (${assignment.status})`);
          });
        } else {
          console.log('  ⚠️ No students found in groups (name matching)');
        }
      }

      return students;
    } catch (error) {
      console.error('❌ Error checking student accounts:', error.message);
      return [];
    }
  }

  // Test 3: Check supervisor accounts and their assignments
  async checkSupervisorAccounts() {
    console.log('\n👨‍🏫 Checking Supervisor Accounts...');
    
    try {
      const [supervisors] = await this.connection.execute(`
        SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          s.department,
          s.max_capacity,
          s.current_load,
          s.is_available,
          COUNT(sa.group_id) as assigned_groups
        FROM users u
        JOIN supervisors s ON u.id = s.user_id
        LEFT JOIN supervisor_assignments sa ON u.id = sa.supervisor_id
        WHERE u.role IN ('supervisor', 'external_supervisor')
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `);

      console.log(`Found ${supervisors.length} supervisor accounts:`);
      supervisors.forEach(supervisor => {
        console.log(`  • ${supervisor.first_name} ${supervisor.last_name} (${supervisor.email})`);
        console.log(`    Department: ${supervisor.department}`);
        console.log(`    Capacity: ${supervisor.assigned_groups}/${supervisor.max_capacity} groups`);
        console.log(`    Available: ${supervisor.is_available ? 'Yes' : 'No'}`);
      });

      return supervisors;
    } catch (error) {
      console.error('❌ Error checking supervisor accounts:', error.message);
      return [];
    }
  }

  // Test 4: Simulate login scenarios
  async simulateLoginScenarios() {
    console.log('\n🔐 Simulating Login Scenarios...');
    
    try {
      // Check if we can retrieve user data as the login system would
      const [studentLogin] = await this.connection.execute(`
        SELECT 
          u.*,
          s.matric_number,
          s.gpa,
          s.gpa_tier,
          s.academic_year,
          s.program
        FROM users u
        LEFT JOIN students s ON u.id = s.user_id
        WHERE u.role = 'student' AND u.is_active = TRUE
        LIMIT 1
      `);

      if (studentLogin.length > 0) {
        const student = studentLogin[0];
        console.log('✅ Student login simulation successful:');
        console.log(`  • User: ${student.first_name} ${student.last_name}`);
        console.log(`  • Matric: ${student.matric_number}`);
        console.log(`  • Email: ${student.email}`);
        console.log(`  • GPA: ${student.gpa} (${student.gpa_tier})`);
      }

      const [supervisorLogin] = await this.connection.execute(`
        SELECT 
          u.*,
          s.department as supervisor_department,
          s.max_capacity,
          s.current_load,
          s.is_available
        FROM users u
        LEFT JOIN supervisors s ON u.id = s.user_id
        WHERE u.role IN ('supervisor', 'external_supervisor') AND u.is_active = TRUE
        LIMIT 1
      `);

      if (supervisorLogin.length > 0) {
        const supervisor = supervisorLogin[0];
        console.log('✅ Supervisor login simulation successful:');
        console.log(`  • User: ${supervisor.first_name} ${supervisor.last_name}`);
        console.log(`  • Email: ${supervisor.email}`);
        console.log(`  • Department: ${supervisor.supervisor_department}`);
        console.log(`  • Capacity: ${supervisor.current_load}/${supervisor.max_capacity}`);
      }

    } catch (error) {
      console.error('❌ Error simulating login scenarios:', error.message);
    }
  }

  // Test 5: Check data consistency
  async checkDataConsistency() {
    console.log('\n🔄 Checking Data Consistency...');
    
    try {
      // Check if supervisor capacity matches actual assignments
      const [capacityCheck] = await this.connection.execute(`
        SELECT 
          sc.supervisor_id,
          sc.current_groups as recorded_count,
          COUNT(sa.group_id) as actual_count,
          u.first_name,
          u.last_name
        FROM supervisor_capacity sc
        LEFT JOIN supervisor_assignments sa ON sc.supervisor_id = sa.supervisor_id
        LEFT JOIN users u ON sc.supervisor_id = u.id
        GROUP BY sc.supervisor_id
        HAVING recorded_count != actual_count
      `);

      if (capacityCheck.length === 0) {
        console.log('✅ Supervisor capacity counts are consistent');
      } else {
        console.log('⚠️ Supervisor capacity inconsistencies found:');
        capacityCheck.forEach(issue => {
          console.log(`  • ${issue.first_name} ${issue.last_name}: Recorded ${issue.recorded_count}, Actual ${issue.actual_count}`);
        });
      }

      // Check if group average GPA matches member GPAs
      const [gpaCheck] = await this.connection.execute(`
        SELECT 
          g.id,
          g.name,
          g.avg_gpa as recorded_gpa,
          ROUND(AVG(gm.student_gpa), 2) as calculated_gpa
        FROM groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id
        WHERE g.avg_gpa IS NOT NULL
        GROUP BY g.id
        HAVING ABS(recorded_gpa - calculated_gpa) > 0.1
      `);

      if (gpaCheck.length === 0) {
        console.log('✅ Group GPA calculations are consistent');
      } else {
        console.log('⚠️ Group GPA inconsistencies found:');
        gpaCheck.forEach(issue => {
          console.log(`  • ${issue.name}: Recorded ${issue.recorded_gpa}, Calculated ${issue.calculated_gpa}`);
        });
      }

    } catch (error) {
      console.error('❌ Error checking data consistency:', error.message);
    }
  }

  // Main test runner
  async runQuickTests() {
    console.log('🚀 Running Quick System Behavior Tests');
    console.log('=' .repeat(50));

    const connected = await this.connect();
    if (!connected) return;

    try {
      await this.checkGroupSupervisorLinkage();
      await this.checkStudentAccounts();
      await this.checkSupervisorAccounts();
      await this.simulateLoginScenarios();
      await this.checkDataConsistency();

      console.log('\n✅ Quick tests completed!');
      console.log('\nNext Steps:');
      console.log('1. Start the backend server: cd backend && npm start');
      console.log('2. Start the frontend: npm run dev');
      console.log('3. Test login flows in the browser');
      console.log('4. Create test accounts and verify group assignments');

    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
    } finally {
      await this.disconnect();
    }
  }
}

// Run tests
if (require.main === module) {
  const tester = new QuickTester();
  tester.runQuickTests().catch(console.error);
}

module.exports = QuickTester;