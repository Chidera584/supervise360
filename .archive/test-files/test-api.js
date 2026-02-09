const https = require('https');
const http = require('http');

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + uCSV must contain a name column. Found columns: PKrlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ ok: false, status: res.statusCode, data: data });
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

async function testAPI() {
  console.log('🔍 Testing API Endpoints...\n');
  
  const baseURL = 'http://localhost:5000';
  
  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await makeRequest(`${baseURL}/health`);
    
    if (healthResponse.ok) {
      console.log('✅ Health check passed');
      console.log(`   Message: ${healthResponse.data.message}`);
      console.log(`   Environment: ${healthResponse.data.environment}\n`);
    } else {
      console.log('❌ Health check failed');
      console.log(`   Status: ${healthResponse.status}`);
      return;
    }
    
    // Test registration
    console.log('2. Testing user registration...');
    const registerData = {
      first_name: 'Test',
      last_name: 'Student',
      email: 'test@student.com',
      password: 'password123',
      role: 'student',
      department: 'Computer Science',
      matric_number: 'TEST001',
      gpa: 3.75
    };
    
    const registerResponse = await makeRequest(`${baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerData)
    });
    
    if (registerResponse.ok && registerResponse.data.success) {
      console.log('✅ Registration successful');
      console.log(`   User: ${registerResponse.data.data.user.first_name} ${registerResponse.data.data.user.last_name}`);
      console.log(`   Role: ${registerResponse.data.data.user.role}`);
      console.log(`   Token: ${registerResponse.data.data.token ? 'Generated' : 'Missing'}\n`);
      
      // Test login with the same credentials
      console.log('3. Testing user login...');
      const loginResponse = await makeRequest(`${baseURL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerData.email,
          password: registerData.password
        })
      });
      
      if (loginResponse.ok && loginResponse.data.success) {
        console.log('✅ Login successful');
        console.log(`   Welcome: ${loginResponse.data.data.user.first_name} ${loginResponse.data.data.user.last_name}`);
        
        // Test authenticated endpoint
        console.log('4. Testing authenticated endpoint...');
        const meResponse = await makeRequest(`${baseURL}/api/auth/me`, {
          headers: { 
            'Authorization': `Bearer ${loginResponse.data.data.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (meResponse.ok && meResponse.data.success) {
          console.log('✅ Authenticated request successful');
          console.log(`   User ID: ${meResponse.data.data.user.id}`);
          console.log(`   Email: ${meResponse.data.data.user.email}\n`);
        } else {
          console.log('❌ Authenticated request failed');
          console.log(`   Error: ${meResponse.data.message}\n`);
        }
        
      } else {
        console.log('❌ Login failed');
        console.log(`   Error: ${loginResponse.data.message}\n`);
      }
      
    } else {
      console.log('❌ Registration failed');
      console.log(`   Error: ${registerResponse.data.message}\n`);
    }
    
    console.log('🎉 API test completed!\n');
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

testAPI();