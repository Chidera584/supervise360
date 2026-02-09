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
  console.log('🧪 Testing Group Formation with Tier-Based ASP Algorithm\n');
  
  try {
    console.log('📤 Sending test students for group formation...');
    console.log('👥 Input Students:');
    testStudents.forEach(student => {
      let tier = 'LOW';
      if (student.gpa >= 3.80) tier = 'HIGH';
      else if (student.gpa >= 3.30) tier = 'MEDIUM';
      console.log(`   ${student.name}: ${student.gpa} (${tier} tier)`);
    });
    
    console.log('\n🔄 Making API request...');
    const response = await axios.post(`${BASE_URL}/groups/form`, {
      students: testStudents
    });

    console.log('✅ API Response Status:', response.status);
    console.log('📊 Response Data:', JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.d