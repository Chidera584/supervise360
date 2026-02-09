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
        'Origin': 'http://localhost:5174',
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

async function testCompleteFlow() {
  console.log('🔍 Testing Complete Admin Login Flow...\n');
  
  try {
    // Test 1: Health check
    console.log('1. Testing backend health...');
    const healthResponse = await makeRequest('http://localhost:5000/health');
    if (healthResponse.ok) {
      console.log('   ✅ Backend is healthy');
    } else {
      console.log('   ❌ Backend health check failed');
      return;
    }
    
    // Test 2: Admin login
    console.log('\n2. Testing admin login...');
    const loginResponse = await makeRequest('http://localhost:5000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@supervise360.com',
        password: 'admin123'
      })
    });
    
    if (loginResponse.ok && loginResponse.data.success) {
      console.log('   ✅ Admin login successful');
      console.log(`   User: ${loginResponse.data.data.user.first_name} ${loginResponse.data.data.user.last_name}`);
      console.log(`   Role: ${loginResponse.data.data.user.role}`);
      console.log(`   Token: ${loginResponse.data.data.token ? 'Generated' : 'Missing'}`);
      
      // Test 3: Verify token works
      console.log('\n3. Testing token validation...');
      const meResponse = await makeRequest('http://localhost:5000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${loginResponse.data.data.token}`
        }
      });
      
      if (meResponse.ok && meResponse.data.success) {
        console.log('   ✅ Token validation successful');
        console.log(`   Verified user: ${meResponse.data.data.user.first_name} ${meResponse.data.data.user.last_name}`);
      } else {
        console.log('   ❌ Token validation failed');
      }
      
    } else {
      console.log('   ❌ Admin login failed');
      console.log(`   Error: ${loginResponse.data.message || 'Unknown error'}`);
    }
    
    console.log('\n🎉 Test completed!');
    console.log('\n📋 Admin Login Instructions:');
    console.log('1. Open your browser to: http://localhost:5174/admin-login');
    console.log('2. Use these credentials:');
    console.log('   Email: admin@supervise360.com');
    console.log('   Password: admin123');
    console.log('3. Check browser console (F12) for any errors');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCompleteFlow();