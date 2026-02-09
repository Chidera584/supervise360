const http = require('http');
const { spawn } = require('child_process');

let backendProcess = null;
let isRestarting = false;

function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

async function startBackend() {
  if (isRestarting) return;
  
  console.log('🚀 Starting backend...');
  isRestarting = true;
  
  // Kill any existing node processes
  try {
    spawn('taskkill', ['/F', '/IM', 'node.exe', '/T'], { stdio: 'ignore' });
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (e) {
    // Ignore errors
  }
  
  backendProcess = spawn('npm', ['run', 'dev'], {
    cwd: './backend',
    stdio: 'inherit',
    shell: true
  });
  
  backendProcess.on('exit', (code) => {
    console.log(`❌ Backend exited with code ${code}`);
    backendProcess = null;
    isRestarting = false;
  });
  
  // Wait for backend to start
  await new Promise(resolve => setTimeout(resolve, 5000));
  isRestarting = false;
}

async function monitorBackend() {
  console.log('🔍 Checking backend health...');
  
  const isHealthy = await checkBackendHealth();
  
  if (!isHealthy) {
    console.log('❌ Backend is not responding, restarting...');
    await startBackend();
  } else {
    console.log('✅ Backend is healthy');
  }
}

// Start monitoring
console.log('🏥 Backend Health Monitor Started');
console.log('📊 Checking every 30 seconds...\n');

// Initial check
monitorBackend();

// Check every 30 seconds
setInterval(monitorBackend, 30000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping health monitor...');
  if (backendProcess) {
    backendProcess.kill();
  }
  process.exit(0);
});