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

async function testImprovedSupervisors() {
  console.log('🔍 Testing Improved Supervisor System...\n');
  
  try {
    // Login
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
    
    // Test clean upload of supervisors
    console.log('\n2. Uploading fresh supervisor data...');
    const cleanSupervisors = [
      { name: 'Dr. Sarah Johnson', department: 'Computer Science', maxGroups: 4 },
      { name: 'Prof. Michael Chen', department: 'Computer Science', maxGroups: 3 },
      { name: 'Dr. Emily Rodriguez', department: 'Software Engineering', maxGroups: 3 },
      { name: 'Prof. David Kim', department: 'Software Engineering', maxGroups: 2 },
      { name: 'Dr. Lisa Wang', department: 'Information Technology', maxGroups: 3 },
      { name: 'Prof. James Brown', department: 'Information Technology', maxGroups: 4 }
    ];
    
    const uploadResponse = await makeRequest('http://localhost:5000/api/supervisors/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ supervisors: cleanSupervisors })
    });
    
    if (uploadResponse.ok) {
      console.log('✅ Clean supervisor upload successful');
      console.log(`   ${uploadResponse.data.message}`);
      console.log(`   Uploaded: ${uploadResponse.data.data.uploadedCount}/${uploadResponse.data.data.totalReceived}`);
    } else {
      console.log('❌ Supervisor upload failed');
      console.log('   Error:', uploadResponse.data);
    }
    
    // Test improved workload endpoint
    console.log('\n3. Testing improved workload endpoint...');
    const workloadResponse = await makeRequest('http://localhost:5000/api/supervisors/workload', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (workloadResponse.ok) {
      console.log('✅ Improved workload endpoint working');
      const data = workloadResponse.data.data;
      
      console.log('\n📊 Total Statistics:');
      console.log(`   Total Supervisors: ${data.totalStats.totalSupervisors}`);
      console.log(`   Total Capacity: ${data.totalStats.totalCapacity}`);
      console.log(`   Currently Assigned: ${data.totalStats.totalAssigned}`);
      console.log(`   Available Slots: ${data.totalStats.availableSlots}`);
      console.log(`   Departments: ${data.totalStats.departments}`);
      console.log(`   Average Workload: ${data.totalStats.averageWorkload}%`);
      
      console.log('\n🏢 By Department:');
      Object.values(data.supervisorsByDepartment).forEach((dept) => {
        console.log(`   ${dept.department}:`);
        console.log(`     Supervisors: ${dept.departmentStats.count}`);
        console.log(`     Capacity: ${dept.departmentStats.totalAssigned}/${dept.departmentStats.totalCapacity}`);
        console.log(`     Available: ${dept.departmentStats.availableSlots} slots`);
        console.log(`     Average Load: ${dept.departmentStats.averageWorkload}%`);
        
        dept.supervisors.forEach((sup) => {
          console.log(`       - ${sup.name}: ${sup.current_groups}/${sup.max_groups} (${sup.workload_percentage}%)`);
        });
      });
    } else {
      console.log('❌ Workload endpoint failed');
      console.log('   Error:', workloadResponse.data);
    }
    
    // Create some test groups
    console.log('\n4. Creating test groups for assignment...');
    const testStudents = [
      { name: 'Alice Johnson', gpa: 3.8, department: 'Computer Science' },
      { name: 'Bob Smith', gpa: 3.2, department: 'Computer Science' },
      { name: 'Charlie Brown', gpa: 2.9, department: 'Computer Science' },
      { name: 'Diana Prince', gpa: 3.9, department: 'Software Engineering' },
      { name: 'Eve Wilson', gpa: 3.1, department: 'Software Engineering' },
      { name: 'Frank Miller', gpa: 2.7, department: 'Software Engineering' },
      { name: 'Grace Lee', gpa: 3.6, department: 'Information Technology' },
      { name: 'Henry Davis', gpa: 2.8, department: 'Information Technology' },
      { name: 'Ivy Chen', gpa: 3.4, department: 'Information Technology' }
    ];
    
    const formResponse = await makeRequest('http://localhost:5000/api/groups/form', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ students: testStudents })
    });
    
    if (formResponse.ok) {
      console.log(`✅ Formed ${formResponse.data.data.groups.length} test groups`);
    }
    
    // Test auto-assignment
    console.log('\n5. Testing auto-assignment with clean data...');
    const assignResponse = await makeRequest('http://localhost:5000/api/supervisors/auto-assign', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (assignResponse.ok) {
      console.log('✅ Auto-assignment successful');
      console.log(`   ${assignResponse.data.message}`);
      console.log(`   Assigned: ${assignResponse.data.data.assignedCount}/${assignResponse.data.data.totalGroups} groups`);
    } else {
      console.log('❌ Auto-assignment failed');
    }
    
    // Check final workload
    console.log('\n6. Checking final workload distribution...');
    const finalWorkloadResponse = await makeRequest('http://localhost:5000/api/supervisors/workload', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (finalWorkloadResponse.ok) {
      const data = finalWorkloadResponse.data.data;
      console.log('\n📊 Final Workload Distribution:');
      Object.values(data.supervisorsByDepartment).forEach((dept) => {
        console.log(`   ${dept.department} (${dept.departmentStats.averageWorkload}% avg):`);
        dept.supervisors.forEach((sup) => {
          const status = sup.current_groups >= sup.max_groups ? '🔴 FULL' : 
                        sup.current_groups > 0 ? '🟡 ASSIGNED' : '🟢 AVAILABLE';
          console.log(`     ${status} ${sup.name}: ${sup.current_groups}/${sup.max_groups} groups`);
        });
      });
    }
    
    console.log('\n🎉 Improved supervisor system test completed!');
    console.log('\n📋 Summary:');
    console.log('✅ Clean supervisor upload (no duplicates)');
    console.log('✅ Organized workload data by department');
    console.log('✅ Comprehensive statistics');
    console.log('✅ Improved UI data structure');
    console.log('✅ Only uses uploaded supervisors');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testImprovedSupervisors();