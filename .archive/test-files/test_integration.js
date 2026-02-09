// Test script to verify the supervisor assignment and group formation integration

const testStudents = [
  { name: 'Alice Johnson', gpa: 4.5, matricNumber: 'CS001' },
  { name: 'Bob Smith', gpa: 3.8, matricNumber: 'CS002' },
  { name: 'Charlie Brown', gpa: 3.2, matricNumber: 'CS003' },
  { name: 'Diana Prince', gpa: 4.2, matricNumber: 'CS004' },
  { name: 'Eve Wilson', gpa: 3.6, matricNumber: 'CS005' },
  { name: 'Frank Miller', gpa: 2.9, matricNumber: 'CS006' },
  { name: 'Grace Lee', gpa: 4.8, matricNumber: 'CS007' },
  { name: 'Henry Davis', gpa: 3.4, matricNumber: 'CS008' },
  { name: 'Ivy Chen', gpa: 3.1, matricNumber: 'CS009' }
];

const testSupervisors = [
  { name: 'Dr. Sarah Johnson', department: 'Computer Science', maxGroups: 3 },
  { name: 'Prof. Michael Brown', department: 'Computer Science', maxGroups: 4 },
  { name: 'Dr. Lisa Wang', department: 'Computer Science', maxGroups: 2 }
];

async function testIntegration() {
  const baseUrl = 'http://localhost:5000/api';
  
  console.log('🧪 Testing Supervisor Assignment and Group Formation Integration\n');
  
  try {
    // 1. Test health check
    console.log('1. Testing health check...');
    const healthResponse = await fetch('http://localhost:5000/health');
    const healthData = await healthResponse.json();
    console.log('   ✅ Health check:', healthData.message);
    
    // 2. Clear existing data
    console.log('\n2. Clearing existing groups...');
    const clearResponse = await fetch(`${baseUrl}/groups/clear`, { method: 'DELETE' });
    const clearData = await clearResponse.json();
    console.log('   ✅ Clear groups:', clearData.message);
    
    // 3. Upload supervisors
    console.log('\n3. Uploading supervisors...');
    const supervisorResponse = await fetch(`${baseUrl}/supervisors/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supervisors: testSupervisors })
    });
    const supervisorData = await supervisorResponse.json();
    console.log('   ✅ Upload supervisors:', supervisorData.message);
    
    // 4. Check supervisor workload
    console.log('\n4. Checking supervisor workload...');
    const workloadResponse = await fetch(`${baseUrl}/supervisors/workload`);
    const workloadData = await workloadResponse.json();
    console.log('   📊 Supervisor workload:');
    workloadData.data.forEach(sup => {
      console.log(`      ${sup.name} - ${sup.available_slots}/${sup.max_groups} available`);
    });
    
    // 5. Form groups from students
    console.log('\n5. Forming groups from students...');
    const groupResponse = await fetch(`${baseUrl}/groups/form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: testStudents })
    });
    const groupData = await groupResponse.json();
    console.log('   ✅ Groups formed:', groupData.data.statistics);
    console.log('   📊 Groups created:');
    groupData.data.groups.forEach(group => {
      console.log(`      ${group.name} - Avg GPA: ${group.avg_gpa} - Members: ${group.members.length}`);
    });
    
    // 6. Auto-assign supervisors
    console.log('\n6. Auto-assigning supervisors...');
    const assignResponse = await fetch(`${baseUrl}/supervisors/auto-assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const assignData = await assignResponse.json();
    console.log('   ✅ Supervisor assignment:', assignData.message);
    
    // 7. Check final groups with supervisors
    console.log('\n7. Checking final groups with supervisors...');
    const finalGroupsResponse = await fetch(`${baseUrl}/groups`);
    const finalGroupsData = await finalGroupsResponse.json();
    console.log('   📊 Final groups:');
    finalGroupsData.data.forEach(group => {
      console.log(`      ${group.name} - Supervisor: ${group.supervisor_name || 'Not assigned'} - Members: ${group.members.length}`);
      group.members.forEach(member => {
        console.log(`         ${member.name} (${member.matric_number}) - GPA: ${member.gpa} - Tier: ${member.tier}`);
      });
    });
    
    // 8. Check updated supervisor workload
    console.log('\n8. Checking updated supervisor workload...');
    const finalWorkloadResponse = await fetch(`${baseUrl}/supervisors/workload`);
    const finalWorkloadData = await finalWorkloadResponse.json();
    console.log('   📊 Updated supervisor workload:');
    finalWorkloadData.data.forEach(sup => {
      console.log(`      ${sup.name} - ${sup.current_groups}/${sup.max_groups} groups (${sup.workload_percentage}% load)`);
    });
    
    console.log('\n🎉 Integration test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Integration test failed:', error.message);
  }
}

// Run the test
testIntegration();