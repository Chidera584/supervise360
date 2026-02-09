const mysql = require('mysql2/promise');
const fs = require('fs');

const db = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: 'Chidera_2468',
  database: 'supervise360',
  port: 3307
});

// Sample student data
const sampleStudents = [
  { name: 'Student A', gpa: 4.5, department: 'Software Engineering' },
  { name: 'Student B', gpa: 3.6, department: 'Software Engineering' },
  { name: 'Student C', gpa: 3.0, department: 'Software Engineering' },
  { name: 'Student D', gpa: 4.2, department: 'Software Engineering' },
  { name: 'Student E', gpa: 3.5, department: 'Software Engineering' },
  { name: 'Student F', gpa: 2.8, department: 'Software Engineering' },
];

// Sample supervisors
const sampleSupervisors = [
  { name: 'Dr. Smith', department: 'Software Engineering', maxGroups: 3 },
  { name: 'Dr. Johnson', department: 'Software Engineering', maxGroups: 3 },
];

async function testCompleteFlow() {
  console.log('🧪 Testing Complete Assignment Flow\n');
  console.log('='.repeat(70));
  
  try {
    // Step 1: Upload supervisors
    console.log('\n📤 STEP 1: Uploading Supervisors');
    console.log('-'.repeat(70));
    
    const connection = await db.getConnection();
    await connection.beginTransaction();
    
    try {
      // Clear existing supervisors
      await connection.execute('DELETE FROM supervisor_workload');
      console.log('✅ Cleared existing supervisors');
      
      // Insert supervisors
      for (const sup of sampleSupervisors) {
        await connection.execute(
          `INSERT INTO supervisor_workload (supervisor_name, department, max_groups, current_groups, is_available) 
           VALUES (?, ?, ?, 0, TRUE)`,
          [sup.name, sup.department, sup.maxGroups]
        );
        console.log(`✅ Uploaded: ${sup.name} (${sup.department}, max: ${sup.maxGroups})`);
      }
      
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
    // Step 2: Form groups from students
    console.log('\n📤 STEP 2: Forming Groups from Students');
    console.log('-'.repeat(70));
    
    // Classify students by tier
    const processedStudents = sampleStudents.map(s => ({
      ...s,
      tier: s.gpa >= 3.8 ? 'HIGH' : s.gpa >= 3.3 ? 'MEDIUM' : 'LOW'
    }));
    
    console.log('Student tiers:');
    processedStudents.forEach(s => {
      console.log(`  ${s.name}: GPA ${s.gpa} → ${s.tier}`);
    });
    
    // Form groups (3 students per group)
    const groups = [];
    const highTier = processedStudents.filter(s => s.tier === 'HIGH');
    const mediumTier = processedStudents.filter(s => s.tier === 'MEDIUM');
    const lowTier = processedStudents.filter(s => s.tier === 'LOW');
    
    const numGroups = Math.min(highTier.length, mediumTier.length, lowTier.length);
    
    for (let i = 0; i < numGroups; i++) {
      groups.push({
        name: `Group ${i + 1}`,
        members: [highTier[i], mediumTier[i], lowTier[i]],
        department: 'Software Engineering'
      });
    }
    
    console.log(`\n✅ Formed ${groups.length} groups`);
    
    // Save groups to database
    const conn2 = await db.getConnection();
    await conn2.beginTransaction();
    
    try {
      for (const group of groups) {
        const avgGpa = group.members.reduce((sum, m) => sum + m.gpa, 0) / 3;
        
        const [result] = await conn2.execute(
          `INSERT INTO project_groups (name, avg_gpa, status, department, formation_method, formation_date, created_at) 
           VALUES (?, ?, 'formed', ?, 'asp', NOW(), NOW())`,
          [group.name, avgGpa.toFixed(2), group.department]
        );
        
        const groupId = result.insertId;
        
        // Insert members
        for (let i = 0; i < group.members.length; i++) {
          const member = group.members[i];
          await conn2.execute(
            `INSERT INTO group_members (group_id, student_name, student_gpa, gpa_tier, member_order) 
             VALUES (?, ?, ?, ?, ?)`,
            [groupId, member.name, member.gpa, member.tier, i + 1]
          );
        }
        
        console.log(`✅ Saved ${group.name} with ${group.members.length} members`);
      }
      
      await conn2.commit();
    } catch (error) {
      await conn2.rollback();
      throw error;
    } finally {
      conn2.release();
    }
    
    // Step 3: Auto-assign supervisors
    console.log('\n📤 STEP 3: Auto-Assigning Supervisors');
    console.log('-'.repeat(70));
    
    const conn3 = await db.getConnection();
    await conn3.beginTransaction();
    
    try {
      // Get unassigned groups
      const [unassignedGroups] = await conn3.execute(`
        SELECT id, name, department 
        FROM project_groups 
        WHERE supervisor_name IS NULL OR supervisor_name = ''
        ORDER BY id ASC
      `);
      
      console.log(`Found ${unassignedGroups.length} unassigned groups`);
      
      // Get available supervisors
      const [availableSupervisors] = await conn3.execute(`
        SELECT supervisor_name, department, max_groups, current_groups
        FROM supervisor_workload 
        WHERE is_available = TRUE AND current_groups < max_groups
        ORDER BY current_groups ASC, supervisor_name ASC
      `);
      
      console.log(`Found ${availableSupervisors.length} available supervisors`);
      
      let assignmentCount = 0;
      
      for (const group of unassignedGroups) {
        // Find available supervisor in same department
        const availableSupervisor = availableSupervisors.find(sup => 
          sup.department === group.department && sup.current_groups < sup.max_groups
        );
        
        if (availableSupervisor) {
          console.log(`✅ Assigning ${availableSupervisor.supervisor_name} to ${group.name}`);
          
          // Assign supervisor to group
          await conn3.execute(
            'UPDATE project_groups SET supervisor_name = ?, updated_at = NOW() WHERE id = ?',
            [availableSupervisor.supervisor_name, group.id]
          );
          
          // Update supervisor workload
          await conn3.execute(
            'UPDATE supervisor_workload SET current_groups = current_groups + 1, updated_at = NOW() WHERE supervisor_name = ?',
            [availableSupervisor.supervisor_name]
          );
          
          // Update local data
          availableSupervisor.current_groups++;
          assignmentCount++;
        } else {
          console.log(`❌ No available supervisor for ${group.name}`);
        }
      }
      
      await conn3.commit();
      console.log(`\n✅ Assigned ${assignmentCount} groups to supervisors`);
      
    } catch (error) {
      await conn3.rollback();
      throw error;
    } finally {
      conn3.release();
    }
    
    // Step 4: Verify assignments
    console.log('\n📊 STEP 4: Verifying Assignments');
    console.log('-'.repeat(70));
    
    const [finalGroups] = await db.execute(`
      SELECT id, name, supervisor_name, department
      FROM project_groups
      ORDER BY id
    `);
    
    const [finalSupervisors] = await db.execute(`
      SELECT supervisor_name, current_groups, max_groups
      FROM supervisor_workload
      ORDER BY supervisor_name
    `);
    
    console.log('\nGroups:');
    finalGroups.forEach(g => {
      const status = g.supervisor_name ? '✅' : '❌';
      console.log(`  ${status} ${g.name}: ${g.supervisor_name || 'UNASSIGNED'}`);
    });
    
    console.log('\nSupervisors:');
    finalSupervisors.forEach(s => {
      console.log(`  ${s.supervisor_name}: ${s.current_groups}/${s.max_groups} groups`);
    });
    
    // Final summary
    const assignedCount = finalGroups.filter(g => g.supervisor_name).length;
    const unassignedCount = finalGroups.filter(g => !g.supervisor_name).length;
    
    console.log('\n' + '='.repeat(70));
    console.log('📋 FINAL SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Groups: ${finalGroups.length}`);
    console.log(`Assigned: ${assignedCount} ✅`);
    console.log(`Unassigned: ${unassignedCount} ${unassignedCount > 0 ? '❌' : '✅'}`);
    
    if (assignedCount === finalGroups.length && finalGroups.length > 0) {
      console.log('\n🎉 SUCCESS! All groups have supervisors assigned!');
      console.log('   The assignment process is working correctly.');
    } else {
      console.log('\n⚠️  Some groups are not assigned.');
      console.log('   There may be an issue with the assignment logic.');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await db.end();
  }
}

testCompleteFlow();
