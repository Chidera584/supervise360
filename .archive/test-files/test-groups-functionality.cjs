const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testGroupsEndpoint() {
  console.log('🧪 Testing Groups API Endpoint...\n');

  try {
    // Test getting groups
    console.log('📥 Testing GET /groups...');
    const response = await axios.get(`${BASE_URL}/groups`);
    
    console.log('✅ Response Status:', response.status);
    console.log('📊 Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`✅ Found ${response.data.data.length} groups in database`);
      
      if (response.data.data.length > 0) {
        const sampleGroup = response.data.data[0];
        console.log('\n📋 Sample Group Structure:');
        console.log('  - ID:', sampleGroup.id);
        console.log('  - Name:', sampleGroup.name);
        console.log('  - Members:', sampleGroup.members?.length || 0);
        console.log('  - Avg GPA:', sampleGroup.avg_gpa);
        
        if (sampleGroup.members && sampleGroup.members.length > 0) {
          console.log('\n👥 Sample Members:');
          sampleGroup.members.forEach((member, index) => {
            console.log(`  ${index + 1}. ${member.name} (GPA: ${member.gpa}, Tier: ${member.tier})`);
          });
        }
      }
    } else {
      console.log('⚠️ API returned success: false');
    }

  } catch (error) {
    console.error('❌ Error testing groups endpoint:', error.message);
    if (error.response) {
      console.error('📄 Response Status:', error.response.status);
      console.error('📄 Response Data:', error.response.data);
    }
  }
}

async function testGroupFormation() {
  console.log('\n🧪 Testing Group Formation...\n');

  const testStudents = [
    { name: 'Alice High', gpa: 4.2, department: 'Software Engineering' },
    { name: 'Bob Medium', gpa: 3.5, department: 'Software Engineering' },
    { name: 'Charlie Low', gpa: 3.1, department: 'Software Engineering' },
    { name: 'Diana High', gpa: 4.0, department: 'Software Engineering' },
    { name: 'Eve Medium', gpa: 3.4, department: 'Software Engineering' },
    { name: 'Frank Low', gpa: 2.9, department: 'Software Engineering' }
  ];

  try {
    console.log('📤 Sending test students for group formation...');
    console.log('👥 Test Students:', testStudents.map(s => `${s.name} (${s.gpa})`).join(', '));

    const response = await axios.post(`${BASE_URL}/groups/form`, {
      students: testStudents
    });

    console.log('✅ Formation Response Status:', response.status);
    console.log('📊 Formation Response:', JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.data.groups) {
      console.log(`✅ Successfully formed ${response.data.data.groups.length} groups`);
      
      response.data.data.groups.forEach((group, index) => {
        console.log(`\n🏗️ ${group.name}:`);
        group.members.forEach((member, memberIndex) => {
          const isLeader = memberIndex === 0;
          const crown = isLeader ? '👑 ' : '   ';
          console.log(`  ${crown}${member.name} (GPA: ${member.gpa}, Tier: ${member.tier})`);
        });
        console.log(`  📊 Average GPA: ${group.avgGpa}`);
      });
    }

  } catch (error) {
    console.error('❌ Error testing group formation:', error.message);
    if (error.response) {
      console.error('📄 Response Status:', error.response.status);
      console.error('📄 Response Data:', error.response.data);
    }
  }
}

async function runTests() {
  console.log('🚀 Starting Groups Functionality Tests\n');
  console.log('=' .repeat(50));
  
  await testGroupsEndpoint();
  await testGroupFormation();
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Groups functionality tests completed!');
  console.log('\n📝 Next Steps:');
  console.log('1. Navigate to http://localhost:5173 in your browser');
  console.log('2. Login as admin (admin@supervise360.com)');
  console.log('3. Go to Groups page');
  console.log('4. Test file upload with CSV data');
  console.log('5. Verify groups display with proper tier ordering');
}

runTests().catch(console.error);