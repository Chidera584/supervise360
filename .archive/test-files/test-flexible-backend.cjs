const axios = require('axios');

// Test the flexible grouping with the running backend server
async function testFlexibleGrouping() {
  console.log('🧪 Testing Flexible ASP Algorithm with Backend Server\n');

  // Test case: Uneven distribution (more HIGH tier students)
  const testStudents = [
    { name: 'Alice High1', gpa: 4.5, department: 'Software Engineering' },
    { name: 'Bob High2', gpa: 4.2, department: 'Software Engineering' },
    { name: 'Charlie High3', gpa: 4.0, department: 'Software Engineering' },
    { name: 'David High4', gpa: 3.9, department: 'Software Engineering' },
    { name: 'Eve Medium1', gpa: 3.6, department: 'Software Engineering' },
    { name: 'Frank Medium2', gpa: 3.4, department: 'Software Engineering' }
    // Note: No LOW tier students - this would previously fail
  ];

  try {
    console.log('📊 Test Case: Missing LOW tier completely');
    console.log(`👥 Students: ${testStudents.length}`);
    console.log('📈 Distribution: HIGH: 4, MEDIUM: 2, LOW: 0');
    
    // First, clear any existing groups
    console.log('\n🧹 Clearing existing groups...');
    await axios.delete('http://localhost:5000/api/groups/clear', {
      headers: {
        'Authorization': 'Bearer test-token' // Mock token for testing
      }
    });
    
    // Test the group formation
    console.log('🚀 Testing group formation...');
    const response = await axios.post('http://localhost:5000/api/groups/form', {
      students: testStudents
    }, {
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      console.log('✅ SUCCESS: Groups formed successfully!');
      console.log(`📊 Groups created: ${response.data.data.groups.length}`);
      
      response.data.data.groups.forEach((group, index) => {
        console.log(`\n   Group ${group.name}:`);
        group.members.forEach((member, memberIndex) => {
          const leader = memberIndex === 0 ? '👑' : '👥';
          console.log(`     ${leader} ${member.name} (${member.gpa}) - ${member.tier}`);
        });
        console.log(`     📈 Avg GPA: ${group.avgGpa || group.avg_gpa}`);
      });
      
      console.log(`\n📈 Statistics:`, response.data.data.statistics);
    } else {
      console.log('❌ FAILED:', response.data.error || response.data.message);
    }

  } catch (error) {
    if (error.response) {
      console.log('❌ HTTP Error:', error.response.status);
      console.log('📝 Error details:', error.response.data);
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }
}

// Run the test
testFlexibleGrouping().then(() => {
  console.log('\n🏁 Test completed!');
}).catch(console.error);