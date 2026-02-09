const mysql = require('mysql2/promise');

// Test group formation validation
async function debugGroupFormation() {
  console.log('🔍 Starting group formation debug...');
  
  // Create a mock database connection
  const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'supervise360',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    // Test with sample student data
    const sampleStudents = [
      { name: 'Alice Johnson', gpa: 4.0, tier: 'HIGH' },
      { name: 'Bob Smith', gpa: 3.5, tier: 'MEDIUM' },
      { name: 'Charlie Brown', gpa: 3.0, tier: 'LOW' },
      { name: 'Diana Prince', gpa: 3.9, tier: 'HIGH' },
      { name: 'Eve Wilson', gpa: 3.4, tier: 'MEDIUM' },
      { name: 'Frank Miller', gpa: 2.8, tier: 'LOW' }
    ];

    console.log('📊 Sample students:', sampleStudents);

    // Simulate the group formation service logic
    const { GroupFormationService } = require('./backend/src/services/groupFormationService.ts');
    const groupService = new GroupFormationService(db);

    // Process student data
    console.log('🔄 Processing student data...');
    const processedStudents = groupService.processStudentData(sampleStudents);
    console.log('✅ Processed students:', processedStudents);

    // Form groups
    console.log('🔄 Forming groups...');
    const groups = groupService.formGroupsUsingASP(processedStudents);
    console.log('✅ Formed groups:', groups);

    // Validate formation
    console.log('🔄 Validating group formation...');
    const validation = groupService.validateGroupFormation(groups);
    console.log('📋 Validation result:', validation);

    if (!validation.isValid) {
      console.error('❌ Validation failed with violations:');
      validation.violations.forEach(violation => {
        console.error('  -', violation);
      });
    } else {
      console.log('✅ Validation passed!');
    }

  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await db.end();
  }
}

debugGroupFormation();