const https = require('https');
const http = require('http');

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ 
            ok: res.statusCode >= 200 && res.statusCode < 300, 
            status: res.statusCode, 
            data: jsonData
          });
        } catch (e) {
          resolve({ 
            ok: false, 
            status: res.statusCode, 
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testGroupsEndpoint() {
  console.log('🔍 Testing Groups Endpoints...\n');
  
  try {
    // First, login to get token
    console.log('1. Getting admin token...');
    const loginResponse = await makeRequest('http://localhost:5000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@supervise360.com',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok || !loginResponse.data.success) {
      console.log('❌ Login failed');
      return;
    }
    
    const token = loginResponse.data.data.token;
    console.log('✅ Admin token obtained');
    
    // Test get groups
    console.log('\n2. Testing GET /api/groups...');
    const getGroupsResponse = await makeRequest('http://localhost:5000/api/groups', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`   Status: ${getGroupsResponse.status}`);
    if (getGroupsResponse.ok) {
      console.log('   ✅ Groups endpoint working');
      console.log(`   Found ${getGroupsResponse.data.data?.length || 0} groups`);
    } else {
      console.log('   ❌ Groups endpoint failed');
      console.log('   Error:', getGroupsResponse.data);
    }
    
    // Test form groups with sample data
    console.log('\n3. Testing POST /api/groups/form...');
    const sampleStudents = [
      { name: 'Alice Johnson', gpa: 3.8 },
      { name: 'Bob Smith', gpa: 3.2 },
      { name: 'Charlie Brown', gpa: 2.9 },
      { name: 'Diana Prince', gpa: 3.9 },
      { name: 'Eve Wilson', gpa: 3.1 },
      { name: 'Frank Miller', gpa: 2.7 }
    ];
    
    const formGroupsResponse = await makeRequest('http://localhost:5000/api/groups/form', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ students: sampleStudents })
    });
    
    console.log(`   Status: ${formGroupsResponse.status}`);
    if (formGroupsResponse.ok) {
      console.log('   ✅ Group formation working');
      console.log(`   Formed ${formGroupsResponse.data.data?.groups?.length || 0} groups`);
      console.log('   Groups:', formGroupsResponse.data.data?.groups?.map(g => g.name).join(', '));
    } else {
      console.log('   ❌ Group formation failed');
      console.log('   Error:', formGroupsResponse.data);
    }
    
    console.log('\n🎉 Groups endpoint test completed!');
    console.log('\n📋 The auto form groups feature should now work in the admin panel!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testGroupsEndpoint();