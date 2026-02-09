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

async function testAdminLogin() {
  console.log('🔍 Testing Admin Login...\n');
  
  const baseURL = 'http://localhost:5000';
  
  try {
    // Test admin login
    console.log('Testing admin login with admin@supervise360.com...');
    const loginResponse = await makeRequest(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@supervise360.com',
        password: 'admin123'
      })
    });
    
    console.log(`Status: ${loginResponse.status}`);
    console.log('Response:', JSON.stringify(loginResponse.data, null, 2));
    
    if (loginResponse.ok && loginResponse.data.success) {
      console.log('\n✅ Admin login successful!');
      console.log(`   User: ${loginResponse.data.data.user.first_name} ${loginResponse.data.data.user.last_name}`);
      console.log(`   Role: ${loginResponse.data.data.user.role}`);
      console.log(`   Token: ${loginResponse.data.data.token ? 'Generated' : 'Missing'}`);
    } else {
      console.log('\n❌ Admin login failed');
      console.log(`   Error: ${loginResponse.data.message || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAdminLogin();