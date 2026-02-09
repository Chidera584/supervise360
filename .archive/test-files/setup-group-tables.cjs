/**
 * Setup Group Formation Tables
 * 
 * This script creates the missing tables needed for group formation and supervisor assignments
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

class DatabaseSetup {
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

  async createGroupsTable() {
    console.log('\n📋 Creating groups table...');
    
    try {
      // Check if student_groups exists and has data
      const [existingGroups] = await this.connection.execute(`
        SELECT COUNT(*) as count FROM student_groups
      `);

      console.log(`Found ${existingGroups[0].count} existing groups in student_groups table`);

      // Create the groups table
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS groups (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          status ENUM('planning', 'active', 'completed', 'archived') DEFAULT 'planning',
          project VARCHAR(500),
          avg_gpa DECIMAL(3,2),
          formation_method ENUM('manual', 'asp') DEFAULT 'manual',
          formation_date TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_groups_status (status),
          INDEX idx_groups_formation_method (formation_method)
        )
      `);

      // Migrate data from student_groups to groups if needed
      if (existingGroups[0].count > 0) {
        console.log('Migrating data from student_groups to groups...');
        await this.connection.execute(`
          INSERT IGNORE INTO groups (name, status, created_at)
          SELECT 
            CONCAT('Group ', id) as name,
            'active' as status,
            created_at
          FROM student_groups
        `);
      }

      console.log('✅ Groups table created successfully');
    } catch (error) {
      console.error('❌ Error creating groups table:', error.message);
    }
  }

  async createGroupMembersTable() {
    console.log('\n👥 Creating group_members table...');
    
    try {
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS group_members (
          id INT PRIMARY KEY AUTO_INCREMENT,
          group_id INT NOT NULL,
          student_name VARCHAR(255) NOT NULL,
          student_gpa DECIMAL(3,2) NOT NULL,
          gpa_tier ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL,
          member_order INT DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
          INDEX idx_group_members_group_id (group_id),
          INDEX idx_group_members_tier (gpa_tier),
          INDEX idx_group_members_order (member_order)
        )
      `);

      console.log('✅ Group members table created successfully');
    } catch (error) {
      console.error('❌ Error creating group_members table:', error.message);
    }
  }

  async createSupervisorAssignmentsTable() {
    console.log('\n👨‍🏫 Creating supervisor_assignments table...');
    
    try {
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS supervisor_assignments (
          id INT PRIMARY KEY AUTO_INCREMENT,
          group_id INT NOT NULL,
          supervisor_id INT NOT NULL,
          assigned_by INT,
          assignment_method ENUM('manual', 'auto') DEFAULT 'manual',
          assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
          FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
          UNIQUE KEY unique_group_supervisor (group_id, supervisor_id),
          INDEX idx_supervisor_assignments_group (group_id),
          INDEX idx_supervisor_assignments_supervisor (supervisor_id)
        )
      `);

      console.log('✅ Supervisor assignments table created successfully');
    } catch (error) {
      console.error('❌ Error creating supervisor_assignments table:', error.message);
    }
  }

  async createSupervisorCapacityTable() {
    console.log('\n📊 Creating supervisor_capacity table...');
    
    try {
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS supervisor_capacity (
          id INT PRIMARY KEY AUTO_INCREMENT,
          supervisor_id INT NOT NULL,
          max_groups INT DEFAULT 3,
          current_groups INT DEFAULT 0,
          department VARCHAR(100),
          is_available BOOLEAN DEFAULT TRUE,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_supervisor_capacity (supervisor_id),
          INDEX idx_supervisor_capacity_dept (department),
          INDEX idx_supervisor_capacity_available (is_available)
        )
      `);

      // Insert default capacity for existing supervisors
      await this.connection.execute(`
        INSERT IGNORE INTO supervisor_capacity (supervisor_id, max_groups, department)
        SELECT u.id, 3, u.department 
        FROM users u
        WHERE u.role IN ('supervisor', 'external_supervisor')
      `);

      console.log('✅ Supervisor capacity table created successfully');
    } catch (error) {
      console.error('❌ Error creating supervisor_capacity table:', error.message);
    }
  }

  async createTriggers() {
    console.log('\n⚡ Creating triggers for supervisor capacity...');
    
    try {
      // Drop existing triggers if they exist
      await this.connection.execute('DROP TRIGGER IF EXISTS update_supervisor_capacity_on_assignment');
      await this.connection.execute('DROP TRIGGER IF EXISTS update_supervisor_capacity_on_unassignment');

      // Create trigger for assignment
      await this.connection.execute(`
        CREATE TRIGGER update_supervisor_capacity_on_assignment
        AFTER INSERT ON supervisor_assignments
        FOR EACH ROW
        BEGIN
          UPDATE supervisor_capacity 
          SET current_groups = current_groups + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE supervisor_id = NEW.supervisor_id;
        END
      `);

      // Create trigger for unassignment
      await this.connection.execute(`
        CREATE TRIGGER update_supervisor_capacity_on_unassignment
        AFTER DELETE ON supervisor_assignments
        FOR EACH ROW
        BEGIN
          UPDATE supervisor_capacity 
          SET current_groups = GREATEST(current_groups - 1, 0),
              updated_at = CURRENT_TIMESTAMP
          WHERE supervisor_id = OLD.supervisor_id;
        END
      `);

      console.log('✅ Triggers created successfully');
    } catch (error) {
      console.error('❌ Error creating triggers:', error.message);
    }
  }

  async createViews() {
    console.log('\n👁️ Creating helpful views...');
    
    try {
      // Group details view
      await this.connection.execute(`
        CREATE OR REPLACE VIEW group_details AS
        SELECT 
          g.id,
          g.name,
          g.status,
          g.project,
          g.avg_gpa,
          g.formation_method,
          g.formation_date,
          g.created_at,
          COUNT(gm.id) as member_count,
          GROUP_CONCAT(
            CONCAT(gm.student_name, ' (', gm.student_gpa, ', ', gm.gpa_tier, ')')
            ORDER BY gm.member_order ASC, gm.student_gpa DESC
            SEPARATOR '; '
          ) as members_list,
          SUM(CASE WHEN gm.gpa_tier = 'HIGH' THEN 1 ELSE 0 END) as high_tier_count,
          SUM(CASE WHEN gm.gpa_tier = 'MEDIUM' THEN 1 ELSE 0 END) as medium_tier_count,
          SUM(CASE WHEN gm.gpa_tier = 'LOW' THEN 1 ELSE 0 END) as low_tier_count,
          u.first_name as supervisor_first_name,
          u.last_name as supervisor_last_name,
          u.email as supervisor_email
        FROM groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id
        LEFT JOIN supervisor_assignments sa ON g.id = sa.group_id
        LEFT JOIN users u ON sa.supervisor_id = u.id
        GROUP BY g.id
      `);

      // Supervisor workload view
      await this.connection.execute(`
        CREATE OR REPLACE VIEW supervisor_workload AS
        SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          sc.max_groups,
          sc.current_groups,
          sc.department,
          sc.is_available,
          (sc.max_groups - sc.current_groups) as available_slots,
          ROUND((sc.current_groups / sc.max_groups) * 100, 2) as workload_percentage
        FROM users u
        JOIN supervisor_capacity sc ON u.id = sc.supervisor_id
        WHERE u.role IN ('supervisor', 'external_supervisor')
      `);

      console.log('✅ Views created successfully');
    } catch (error) {
      console.error('❌ Error creating views:', error.message);
    }
  }

  async insertSampleData() {
    console.log('\n📝 Inserting sample data...');
    
    try {
      // Create sample groups
      const [group1] = await this.connection.execute(`
        INSERT INTO groups (name, status, project, avg_gpa, formation_method) 
        VALUES ('Alpha Team', 'active', 'AI-Powered Student Management System', 3.75, 'manual')
      `);

      const [group2] = await this.connection.execute(`
        INSERT INTO groups (name, status, project, avg_gpa, formation_method) 
        VALUES ('Beta Squad', 'planning', 'Blockchain-based Academic Records', 3.50, 'manual')
      `);

      // Add sample group members
      const sampleMembers = [
        { groupId: group1.insertId, name: 'Alice Johnson', gpa: 4.0, tier: 'HIGH' },
        { groupId: group1.insertId, name: 'Bob Smith', gpa: 3.5, tier: 'MEDIUM' },
        { groupId: group1.insertId, name: 'Charlie Brown', gpa: 3.75, tier: 'HIGH' },
        { groupId: group2.insertId, name: 'Diana Prince', gpa: 3.2, tier: 'MEDIUM' },
        { groupId: group2.insertId, name: 'Edward Norton', gpa: 3.8, tier: 'HIGH' },
        { groupId: group2.insertId, name: 'Fiona Green', gpa: 3.0, tier: 'MEDIUM' }
      ];

      for (const member of sampleMembers) {
        await this.connection.execute(`
          INSERT INTO group_members (group_id, student_name, student_gpa, gpa_tier) 
          VALUES (?, ?, ?, ?)
        `, [member.groupId, member.name, member.gpa, member.tier]);
      }

      // Create sample supervisor if none exist
      const [supervisorCount] = await this.connection.execute(`
        SELECT COUNT(*) as count FROM users WHERE role IN ('supervisor', 'external_supervisor')
      `);

      if (supervisorCount[0].count === 0) {
        console.log('Creating sample supervisor...');
        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash('supervisor123', 12);
        
        const [supervisorResult] = await this.connection.execute(`
          INSERT INTO users (first_name, last_name, email, password_hash, role, department) 
          VALUES ('Dr. Sample', 'Supervisor', 'supervisor@university.edu', ?, 'supervisor', 'Computer Science')
        `, [passwordHash]);

        await this.connection.execute(`
          INSERT INTO supervisors (user_id, department, max_capacity) 
          VALUES (?, 'Computer Science', 5)
        `, [supervisorResult.insertId]);

        // Assign supervisor to first group
        await this.connection.execute(`
          INSERT INTO supervisor_assignments (group_id, supervisor_id, assignment_method) 
          VALUES (?, ?, 'manual')
        `, [group1.insertId, supervisorResult.insertId]);
      }

      console.log('✅ Sample data inserted successfully');
    } catch (error) {
      console.error('❌ Error inserting sample data:', error.message);
    }
  }

  async runSetup() {
    console.log('🚀 Setting up Group Formation Tables');
    console.log('=' .repeat(50));

    const connected = await this.connect();
    if (!connected) return;

    try {
      await this.createGroupsTable();
      await this.createGroupMembersTable();
      await this.createSupervisorAssignmentsTable();
      await this.createSupervisorCapacityTable();
      await this.createTriggers();
      await this.createViews();
      await this.insertSampleData();

      console.log('\n✅ Database setup completed successfully!');
      console.log('\nYou can now:');
      console.log('1. Run the behavior test: node quick-behavior-test.cjs');
      console.log('2. Start the backend: npm start');
      console.log('3. Test the group formation features');

    } catch (error) {
      console.error('❌ Setup failed:', error.message);
    } finally {
      await this.disconnect();
    }
  }
}

// Run setup
if (require.main === module) {
  const setup = new DatabaseSetup();
  setup.runSetup().catch(console.error);
}

module.exports = DatabaseSetup;