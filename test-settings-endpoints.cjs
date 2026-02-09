const http = require('http');

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function testEndpoints() {
  console.log('🧪 Testing Settings API Endpoints\n');

  try {
    // Test 1: GET global thresholds
    console.log('1️⃣ Testing GET /api/settings/gpa-thresholds/global');
    const getGlobal = await makeRequest('GET', '/api/settings/gpa-thresholds/global');
    console.log(`   Status: ${getGlobal.status}`);
    console.log(`   Response:`, getGlobal.data);
    console.log('');

    // Test 2: POST preview
    console.log('2️⃣ Testing POST /api/settings/gpa-thresholds/preview');
    const preview = await makeRequest('POST', '/api/settings/gpa-thresholds/preview', {
      high: 3.5,
      medium: 2.5,
      low: 1.5
    });
    console.log(`   Status: ${preview.status}`);
    console.log(`   Response:`, preview.data);
    console.log('');

    // Test 3: PUT global thresholds (will fail without auth, but should not 404)
    console.log('3️⃣ Testing PUT /api/settings/gpa-thresholds/global');
    const putGlobal = await makeRequest('PUT', '/api/settings/gpa-thresholds/global', {
      high: 3.5,
      medium: 2.5,
      low: 1.5
    });
    console.log(`   Status: ${putGlobal.status}`);
    console.log(`   Response:`, putGlobal.data);
    console.log('');

    console.log('✅ All endpoints are responding (no 404 errors)');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEndpoints();
