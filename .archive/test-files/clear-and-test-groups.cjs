const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function clearAndTestGroups() {
  console.log('🧹 Clearing existing groups and testing formation...\n');
  
  try {
    // Step 1: Clear existing groups
    console.log('1️⃣ Clearing existing groups...');
    const clearResponse = await axios.delete(`${BASE_URL}/groups/clear`);
    console.log('✅ Clear response:', clearResponse.data);
    
    // Step 2: Test with simple data
    const testStudents = [
      { name: 'High Student 1', gpa: 4.5, department: 'Software Engineering' },
      { name: 'High Student 2', gpa: 4.0, department: 'Software Engineering' },
      { name: 'Medium Student 1', gpa: 3.6, department: 'Software Engineering' },
      { name: 'Medium Student 2', gpa: 3.4, department: 'Software Engineering' },
      { name: 'Low Student 1', gpa: 3.2, department: 'Software Engineering' },
      { name: 'Low Student 2', gpa: 3.0, department: 'Software Engineering' }
    ];
    
    console.log('\n2️⃣ Testing group formation...');
    console.log('📤 Test students:');
    testStudents.forEach(s => {
      let tier = s.gpa >= 3.80 ? 'HIGH' : s.gpa >= 3.30 ? 'MEDIUM' : 'LOW';
      console.log(`   ${s.name}: ${s.gpa} (${tier})`);
    });
    
    const formResponse = await axios.post(`${BASE_URL}/groups/form`, {
      students: testStudents
    });
    
    console.log('\n✅ Formation successful!');
    console.log('📊 Groups formed:', formResponse.data.data.groups.length);
    
    formResponse.data.data.groups.forEach(group => {
      console.log(`\n${group.name}:`);
      group.members.forEach((member, index) => {
        const crown = index === 0 ? '👑 ' : '   ';
        console.log(`  ${crown}${member.name} (${member.gpa}, ${member.tier})`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error.response?.status);
    console.error('📄 Error details:', error.response?.data);
    console.error('🔍 Full error:', error.message);
  }
}

clearAndTestGroups();