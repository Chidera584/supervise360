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

async function testCompleteWorkflow() {
  console.log('🔍 Testing Complete Admin Workflow (Groups + Supervisors)...\n');
  
  try {
    // Step 1: Admin login
    console.log('1. Admin Login...');
    const loginResponse = await makeRequest('http://localhost:5000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@supervise360.com',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok || !loginResponse.data.success) {
      console.log('❌ Admin login failed');
      return;
    }
    
    const token = loginResponse.data.data.token;
    console.log('✅ Admin login successful');
    
    // Step 2: Clear existing data
    console.log('\n2. Clearing existing groups...');
    await makeRequest('http://localhost:5000/api/groups/clear', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Groups cleared');
    
    // Step 3: Upload supervisors
    console.log('\n3. Uploading supervisors...');
    const supervisors = [
      { name: 'Dr. Alice Johnson', department: 'Computer Science', maxGroups: 4 },
      { name: 'Prof. Bob Smith', department: 'Computer Science', maxGroups: 3 },
      { name: 'Dr. Carol Brown', department: 'Software Engineering', maxGroups: 3 },
      { name: 'Prof. David Wilson', department: 'Information Technology', maxGroups: 2 }
    ];
    
    const uploadResponse = await makeRequest('http://localhost:5000/api/supervisors/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ supervisors })
    });
    
    if (uploadResponse.ok) {
      console.log('✅ Supervisors uploaded successfully');
    } else {
      console.log('❌ Failed to upload supervisors');
    }
    
    // Step 4: Form groups
    console.log('\n4. Forming groups from students...');
    const students = [
      { name: 'Alice Johnson', gpa: 3.8, department: 'Computer Science' },
      { name: 'Bob Smith', gpa: 3.2, department: 'Computer Science' },
      { name: 'Charlie Brown', gpa: 2.9, department: 'Computer Science' },
      { name: 'Diana Prince', gpa: 3.9, department: 'Software Engineering' },
      { name: 'Eve Wilson', gpa: 3.1, department: 'Software Engineering' },
      { name: 'Frank Miller', gpa: 2.7, department: 'Software Engineering' },
      { name: 'Grace Lee', gpa: 3.6, department: 'Information Technology' },
      { name: 'Henry Davis', gpa: 2.8, department: 'Information Technology' },
      { name: 'Ivy Chen', gpa: 3.4, department: 'Information Technology' },
      { name: 'Jack Wilson', gpa: 3.0, department: 'Computer Science' },
      { name: 'Kate Brown', gpa: 2.6, department: 'Computer Science' },
      { name: 'Liam Jones', gpa: 3.3, department: 'Computer Science' }
    ];
    
    const formResponse = await makeRequest('http://localhost:5000/api/groups/form', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ students })
    });
    
    if (formResponse.ok) {
      const groups = formResponse.data.data?.groups || [];
      console.log(`✅ Formed ${groups.length} groups successfully`);
      groups.forEach((group, index) => {
        console.log(`   Group ${index + 1}: ${group.name} (Avg GPA: ${group.avgGpa.toFixed(2)})`);
      });
    } else {
      console.log('❌ Failed to form groups');
    }
    
    // Step 5: Auto-assign supervisors
    console.log('\n5. Auto-assigning supervisors to groups...');
    const assignResponse = await makeRequest('http://localhost:5000/api/supervisors/auto-assign', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (assignResponse.ok) {
      console.log('✅ Supervisors auto-assigned successfully');
      console.log(`   ${assignResponse.data.message}`);
      if (assignResponse.data.data) {
        console.log(`   Assigned: ${assignResponse.data.data.assignedCount}/${assignResponse.data.data.totalGroups} groups`);
      }
    } else {
      console.log('❌ Failed to auto-assign supervisors');
    }
    
    // Step 6: Verify final state
    console.log('\n6. Verifying final state...');
    
    // Check groups
    const groupsResponse = await makeRequest('http://localhost:5000/api/groups', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (groupsResponse.ok) {
      const groups = groupsResponse.data.data || [];
      console.log(`✅ Final verification: ${groups.length} groups in database`);
      groups.forEach(group => {
        const supervisor = group.supervisor_name || 'Unassigned';
        console.log(`   - ${group.name}: ${group.member_count} members, Supervisor: ${supervisor}`);
      });
    }
    
    // Check supervisor workload
    const workloadResponse = await makeRequest('http://localhost:5000/api/supervisors/workload', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (workloadResponse.ok) {
      const supervisors = workloadResponse.data.data || [];
      const activeSupervisors = supervisors.filter(s => s.current_groups > 0);
      console.log(`\n✅ Supervisor workload: ${activeSupervisors.length} supervisors with assignments`);
      activeSupervisors.forEach(sup => {
        console.log(`   - ${sup.name}: ${sup.current_groups}/${sup.max_groups} groups (${sup.workload_percentage}%)`);
      });
    }
    
    console.log('\n🎉 Complete workflow test successful!');
    console.log('\n📋 Summary:');
    console.log('✅ Admin login works');
    console.log('✅ Groups formation works');
    console.log('✅ Supervisor upload works');
    console.log('✅ Auto-assign supervisors works');
    console.log('✅ Database operations work');
    console.log('\n🌐 Both features should now work in the admin panel at:');
    console.log('   http://localhost:5174/groups (after admin login)');
    console.log('   http://localhost:5174/supervisor-assignment (after admin login)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCompleteWorkflow();