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
        'Origin': 'http://localhost:5173',
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
            data: jsonData,
            headers: res.headers
          });
        } catch (e) {
          resolve({ 
            ok: false, 
            status: res.statusCode, 
            data: data,
            headers: res.headers
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

async function testFrontendAPI() {
  console.log('🔍 Testing Frontend API Connection...\n');
  
  const apiURL = 'http://localhost:5000/api';
  
  try {
    // Test health endpoint first
    console.log('1. Testing health endpoint...');
    const healthResponse = await makeRequest('http://localhost:5000/health');
    console.log(`   Status: ${healthResponse.status}`);
    console.log(`   CORS Headers: ${JSON.stringify({
      'access-control-allow-origin': healthResponse.headers['access-control-allow-origin'],
      'access-control-allow-methods': healthResponse.headers['access-control-allow-methods'],
      'access-control-allow-headers': healthResponse.headers['access-control-allow-headers']
    }, null, 2)}`);
    
    // Test admin login with CORS headers
    console.log('\n2. Testing admin login with CORS...');
    const loginResponse = await makeRequest(`${apiURL}/auth/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({
        email: 'admin@supervise360.com',
        password: 'admin123'
      })
    });
    
    console.log(`   Status: ${loginResponse.status}`);
    console.log(`   CORS Headers: ${JSON.stringify({
      'access-control-allow-origin': loginResponse.headers['access-control-allow-origin'],
      'access-control-allow-credentials': loginResponse.headers['access-control-allow-credentials']
    }, null, 2)}`);
    
    if (loginResponse.ok && loginResponse.data.success) {
      console.log('   ✅ Login successful from frontend perspective');
      console.log(`   User: ${loginResponse.data.data.user.first_name} ${loginResponse.data.data.user.last_name}`);
      console.log(`   Role: ${loginResponse.data.data.user.role}`);
    } else {
      console.log('   ❌ Login failed');
      console.log(`   Error: ${loginResponse.data.message || 'Unknown error'}`);
      console.log(`   Full response:`, loginResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFrontendAPI();