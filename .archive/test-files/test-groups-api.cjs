const fetch = require('node-fetch');

async function testGroupsAPI() {
  try {
    console.log('Testing groups API...');
    
    // First, let's test without authentication to see the error
    const response = await fetch('http://localhost:5000/api/groups');
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testGroupsAPI();