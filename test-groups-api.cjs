const fetch = require('node-fetch');

async function testGroupsAPI() {
  try {
    console.log('🔍 Testing /api/groups endpoint...\n');
    
    // You'll need a valid token - get it from localStorage in browser
    // For now, let's test without auth to see the error
    const response = await fetch('http://localhost:5000/api/groups', {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data) {
      console.log('\n📊 Groups returned:', data.data.length);
      
      if (data.data.length > 0) {
        console.log('\n📋 First group sample:');
        const firstGroup = data.data[0];
        console.log('  ID:', firstGroup.id);
        console.log('  Name:', firstGroup.name);
        console.log('  Supervisor:', firstGroup.supervisor || 'NOT IN RESPONSE');
        console.log('  Supervisor ID:', firstGroup.supervisor_id);
        console.log('  Department:', firstGroup.department);
        console.log('  Members:', firstGroup.members?.length || 0);
        
        console.log('\n📋 All fields in response:');
        console.log('  ', Object.keys(firstGroup).join(', '));
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testGroupsAPI();
