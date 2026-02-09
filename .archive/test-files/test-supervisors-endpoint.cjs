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

async function testSupervisorsEndpoint() {
  console.log('🔍 Testing Supervisors Endpoints...\n');
  
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
    
    // Test get supervisor workload
    console.log('\n2. Testing GET /api/supervisors/workload...');
    const workloadResponse = await makeRequest('http://localhost:5000/api/supervisors/workload', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`   Status: ${workloadResponse.status}`);
    if (workloadResponse.ok) {
      console.log('   ✅ Supervisor workload endpoint working');
      console.log(`   Found ${workloadResponse.data.data?.length || 0} supervisors`);
      if (workloadResponse.data.data?.length > 0) {
        workloadResponse.data.data.slice(0, 3).forEach(sup => {
          console.log(`     - ${sup.name}: ${sup.current_groups}/${sup.max_groups} groups (${sup.workload_percentage}%)`);
        });
      }
    } else {
      console.log('   ❌ Supervisor workload endpoint failed');
      console.log('   Error:', workloadResponse.data);
    }
    
    // Test upload supervisors
    console.log('\n3. Testing POST /api/supervisors/upload...');
    const sampleSupervisors = [
      { name: 'Dr. John Smith', department: 'Computer Science', maxGroups: 4 },
      { name: 'Prof. Sarah Johnson', department: 'Computer Science', maxGroups: 3 },
      { name: 'Dr. Michael Brown', department: 'Software Engineering', maxGroups: 3 }
    ];
    
    const uploadResponse = await makeRequest('http://localhost:5000/api/supervisors/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ supervisors: sampleSupervisors })
    });
    
    console.log(`   Status: ${uploadResponse.status}`);
    if (uploadResponse.ok) {
      console.log('   ✅ Supervisor upload working');
      console.log(`   Message: ${uploadResponse.data.message}`);
    } else {
      console.log('   ❌ Supervisor upload failed');
      console.log('   Error:', uploadResponse.data);
    }
    
    // Test auto-assign supervisors
    console.log('\n4. Testing POST /api/supervisors/auto-assign...');
    const autoAssignResponse = await makeRequest('http://localhost:5000/api/supervisors/auto-assign', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`   Status: ${autoAssignResponse.status}`);
    if (autoAssignResponse.ok) {
      console.log('   ✅ Auto-assign supervisors working');
      console.log(`   Message: ${autoAssignResponse.data.message}`);
      if (autoAssignResponse.data.data) {
        console.log(`   Assigned: ${autoAssignResponse.data.data.assignedCount}/${autoAssignResponse.data.data.totalGroups} groups`);
      }
    } else {
      console.log('   ❌ Auto-assign supervisors failed');
      console.log('   Error:', autoAssignResponse.data);
    }
    
    console.log('\n🎉 Supervisors endpoint test completed!');
    console.log('\n📋 The auto assign supervisors feature should now work in the admin panel!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSupervisorsEndpoint();