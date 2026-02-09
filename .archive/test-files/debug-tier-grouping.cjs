const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data with clear tier distribution
const testStudents = [
  // HIGH tier (3.80-5.0)
  { name: 'Eze Vivian', gpa: 4.56, department: 'Software Engineering' },
  { name: 'Alice High', gpa: 4.20, department: 'Software Engineering' },
  { name: 'Bob High', gpa: 3.90, department: 'Software Engineering' },
  
  // MEDIUM tier (3.30-3.79)
  { name: 'Michael Ojo', gpa: 3.62, department: 'Software Engineering' },
  { name: 'Charlie Medium', gpa: 3.50, department: 'Software Engineering' },
  { name: 'Diana Medium', gpa: 3.40, department: 'Software Engineering' },
  
  // LOW tier (< 3.30)
  { name: 'Chuks Okafor', gpa: 3.20, department: 'Software Engineering' },
  { name: 'Eve Low', gpa: 3.10, department: 'Software Engineering' },
  { name: 'Frank Low', gpa: 2.90, department: 'Software Engineering' }
];

async function testGroupFormation() {
  console.log('🧪 Testing Tier-Based Group Formation\n');
  
  try {
    console.log('📤 Input Students:');
    testStudents.forEach(student => {
      let tier = 'LOW';
      if (student.gpa >= 3.80) tier = 'HIGH';
      else if (student.gpa >= 3.30) tier = 'MEDIUM';
      console.log(`   ${student.name}: ${student.gpa} (${tier})`);
    });
    
    console.log('\n🔄 Making API request...');
    const response = await axios.post(`${BASE_URL}/groups/form`, {
      students: testStudents
    });

    console.log('✅ Response:', response.status);
    
    if (response.data.success && response.data.data.groups) {
      console.log(`\n🎯 Formed ${response.data.data.groups.length} groups:`);
      
      response.data.data.groups.forEach((group, index) => {
        console.log(`\n${group.name}:`);
        group.members.forEach((member, memberIndex) => {
          const isLeader = memberIndex === 0;
          const crown = isLeader ? '👑 ' : '   ';
          console.log(`  ${crown}${member.name} (GPA: ${member.gpa}, Tier: ${member.tier})`);
        });
        console.log(`  📊 Average GPA: ${group.avgGpa}`);
      });
      
      // Validate tier distribution
      console.log('\n🔍 Validation:');
      response.data.data.groups.forEach(group => {
        const tiers = group.members.map(m => m.tier);
        const hasAllTiers = tiers.includes('HIGH') && tiers.includes('MEDIUM') && tiers.includes('LOW');
        const isCorrectOrder = tiers[0] === 'HIGH' && tiers[1] === 'MEDIUM' && tiers[2] === 'LOW';
        
        console.log(`${group.name}: ${hasAllTiers ? '✅' : '❌'} All tiers, ${isCorrectOrder ? '✅' : '❌'} Correct order`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.data || error.message);
  }
}

testGroupFormation();