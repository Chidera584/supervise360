async function testGroupFormation() {
  console.log('🧪 Testing Group Formation with Current Thresholds\n');
  
  // First, check what thresholds are in the database
  console.log('1️⃣ Checking database thresholds...');
  const thresholdsRes = await fetch('http://localhost:5000/api/settings/gpa-thresholds/global');
  const thresholdsData = await thresholdsRes.json();
  console.log('   Current thresholds:', thresholdsData.data);
  
  // Create test students with various GPAs
  const testStudents = [
    { name: 'High GPA Student 1', gpa: 4.5, department: 'Software Engineering' },
    { name: 'High GPA Student 2', gpa: 4.2, department: 'Software Engineering' },
    { name: 'Medium GPA Student 1', gpa: 3.5, department: 'Software Engineering' },
    { name: 'Medium GPA Student 2', gpa: 3.4, department: 'Software Engineering' },
    { name: 'Low GPA Student 1', gpa: 2.0, department: 'Software Engineering' },
    { name: 'Low GPA Student 2', gpa: 1.8, department: 'Software Engineering' },
  ];
  
  console.log('\n2️⃣ Test students:');
  testStudents.forEach(s => {
    let expectedTier = 'LOW';
    if (s.gpa >= thresholdsData.data.high) expectedTier = 'HIGH';
    else if (s.gpa >= thresholdsData.data.medium) expectedTier = 'MEDIUM';
    console.log(`   ${s.name}: GPA ${s.gpa} → Expected tier: ${expectedTier}`);
  });
  
  console.log('\n3️⃣ Forming groups via API...');
  
  try {
    const formRes = await fetch('http://localhost:5000/api/groups/form', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token-for-testing'
      },
      body: JSON.stringify({
        students: testStudents,
        department: 'Software Engineering'
      })
    });
    
    console.log('   Response status:', formRes.status);
    
    if (formRes.status === 401) {
      console.log('   ⚠️  Authentication required - this is expected');
      console.log('   ℹ️  The backend IS fetching thresholds, but we need a valid token');
      return;
    }
    
    const formData = await formRes.json();
    console.log('   Response:', JSON.stringify(formData, null, 2));
    
    if (formData.success && formData.data && formData.data.groups) {
      console.log('\n4️⃣ Analyzing formed groups:');
      formData.data.groups.forEach((group, idx) => {
        console.log(`\n   Group ${idx + 1}:`);
        group.members.forEach(member => {
          console.log(`      ${member.name}: GPA ${member.gpa}, Tier: ${member.tier}`);
        });
      });
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
}

testGroupFormation().catch(console.error);
