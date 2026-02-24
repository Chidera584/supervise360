/**
 * Setup Group Formation Tables
 * 
 * This script creates the missing tables needed for group formation and supervisor assignments
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

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
      await this.con