const http = require('http');

async function testSettingsAPI() {
  console.log('🧪 Testing Settings API Endpoints\n');

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/settings/gpa-thresholds/global',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${data}\n`);
        
        if (res.statusCode === 200) {
          console.log('✅ Settings API is working!');
          resolve(true);
        } else if (res.statusCode === 404) {
          console.log('❌ Route not found - Backend needs restart');
          console.log('💡 Run: cd backend && npm run dev');
          resolve(false);
        } else {
          console.log(`⚠️  Unexpected status: ${res.statusCode}`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ Cannot connect to backend');
      console.log('💡 Make sure backend is running: cd backend && npm run dev');
      console.error(error.message);
      resolve(false);
    });

    req.end();
  });
}

testSettingsAPI();
