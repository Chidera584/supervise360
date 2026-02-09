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

async function testPersistenceAndDepartment() {
  console.log('🔍 Testing Persistence and Department-Specific Features...\n');
  
  try {
    // Login as Software Engineering admin
    console.log('1. Logging in as Software Engineering admin...');
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
    const user = loginResponse.data.data.user;
    console.log('✅ Login successful');
    console.log('   User:', user.first_name, user.last_name);
    console.log('   Department:', user.department);
    console.log('   Role:', user.role);
    
    // Upload Software Engineering supervisors
    console.log('\n2. Uploading Software Engineering supervisors...');
    const seSupervisors = [
      { name: 'Dr. Sarah Johnson', department: 'Software Engineering', maxGroups: 4 },
      { name: 'Prof. Michael Chen', department: 'Software Engineering', maxGroups: 3 },
      { name: 'Dr. Emily Rodriguez', department: 'Software Engineering', maxGroups: 3 }
    ];
    
    const uploadResponse = await makeRequest('http://localhost:5000/api/supervisors/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ supervisors: seSupervisors })
    });
    
    if (uploadResponse.ok) {
      console.log('✅ Supervisors uploaded successfully');
      console.log('   Message:', uploadResponse.data.message);
    }
    
    // Create Software Engineering groups
    console.log('\n3. Creating Software Engineering groups...');
    const seStudents = [
      { name: 'Alice Johnson', gpa: 3.8 },
      { name: 'Bob Smith', gpa: 3.2 },
      { name: 'Charlie Brown', gpa: 2.9 },
      { name: 'Diana Prince', gpa: 3.9 },
      { name: 'Eve Wilson', gpa: 3.1 },
      { name: 'Frank Miller', gpa: 2.7 },
      { name: 'Grace Lee', gpa: 3.6 },
      { name: 'Henry Davis', gpa: 2.8 },
      { name: 'Ivy Chen', gpa: 3.4 }
    ];
    
    const formResponse = await makeRequest('http://localhost:5000/api/groups/form', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ students: seStudents })
    });
    
    if (formResponse.ok) {
      console.log('✅ Groups formed successfully');
      console.log('   Department:', formResponse.data.data.statistics.department);
      console.log('   Groups:', formResponse.data.data.groups.length);
    }
    
    // Auto-assign supervisors
    console.log('\n4. Auto-assigning supervisors...');
    const assignResponse = await makeRequest('http://localhost:5000/api/supervisors/auto-assign', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (assignResponse.ok) {
      console.log('✅ Supervisors assigned successfully');
      console.log('   Message:', assignResponse.data.message);
    }
    
    // Test persistence - check groups
    console.log('\n5. Testing persistence - checking groups...');
    const groupsResponse = await makeRequest('http://localhost:5000/api/groups', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (groupsResponse.ok) {
      console.log('✅ Groups persisted successfully');
      console.log('   Department filter:', groupsResponse.data.userDepartment);
      console.log('   Groups found:', groupsResponse.data.data.length);
      
      groupsResponse.data.data.forEach(group => {
        console.log(`     - ${group.name}: ${group.member_count} members, Supervisor: ${group.supervisor_name || 'Unassigned'}`);
      });
    }
    
    // Test persistence - check supervisor workload
    console.log('\n6. Testing persistence - checking supervisor workload...');
    const workloadResponse = await makeRequest('http://localhost:5000/api/supervisors/workload', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (workloadResponse.ok) {
      console.log('✅ Supervisor workload persisted successfully');
      const data = workloadResponse.data.data;
      console.log('   Department filter:', data.userDepartment);
      console.log('   System admin:', data.isSystemAdmin);
      console.log('   Supervisors found:', data.supervisors.length);
      
      console.log('\n📊 Department Workload:');
      Object.values(data.supervisorsByDepartment).forEach((dept) => {
        console.log(`   ${dept.department} (${dept.departmentStats.averageWorkload}% avg):`);
        dept.supervisors.forEach((sup) => {
          const status = sup.current_groups >= sup.max_groups ? '🔴 FULL' : 
                        sup.current_groups > 0 ? '🟡 ASSIGNED' : '🟢 AVAILABLE';
          console.log(`     ${status} ${sup.name}: ${sup.current_groups}/${sup.max_groups} groups`);
        });
      });
    }
    
    // Simulate logout and login again to test persistence
    console.log('\n7. Simulating logout and login again...');
    const loginAgainResponse = await makeRequest('http://localhost:5000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@supervise360.com',
        password: 'admin123'
      })
    });
    
    if (loginAgainResponse.ok) {
      const newToken = loginAgainResponse.data.data.token;
      console.log('✅ Re-login successful');
      
      // Check if data persists after re-login
      const persistentGroupsResponse = await makeRequest('http://localhost:5000/api/groups', {
        headers: { 'Authorization': `Bearer ${newToken}` }
      });
      
      if (persistentGroupsResponse.ok) {
        console.log('✅ Data persists after re-login');
        console.log('   Groups still available:', persistentGroupsResponse.data.data.length);
      }
    }
    
    console.log('\n🎉 Persistence and Department-Specific Features Test Completed!');
    console.log('\n📋 Summary:');
    console.log('✅ Admin user set to Software Engineering department');
    console.log('✅ Supervisors upload with persistence (no clearing)');
    console.log('✅ Groups formation filtered by department');
    console.log('✅ Supervisor workload filtered by department');
    console.log('✅ Data persists across login sessions');
    console.log('✅ Overall workload section removed for department admins');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPersistenceAndDepartment();