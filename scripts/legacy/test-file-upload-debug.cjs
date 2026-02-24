const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testFileUpload() {
  console.log('🧪 Testing File Upload with Real CSV Data\n');
  
  try {
    // Create a test JWT token for the admin user
    const token = jwt.sign(
      { 
        userId: 2, // Admin user ID from database
        email: 'admin@supervise360.com', 
        role: 'admin' 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // Simulate CSV data that would come from frontend
    const csvData = [
      { name: 'John Doe', gpa: 4.2, department: 'Software Engineering' },
      { name: 'Jane Smith', gpa: 3.5, department: 'Software Engineering' },
      { name: 'Bob Johnson', gpa: 3.1, department: 'Software Engineering' },
      { name: 'Alice High', gpa: 4.0, department: 'Software Engineering' },
      { name: 'Charlie Medium', gpa: 3.4, department: 'Software Engineering' },
      { name: 'Eve Low', gpa: 2.9, department: 'Software Engineering' }
    ];
    
    console.log('📤 Uploading students:');
    csvData.forEach(student => {
      let tier = student.gpa >= 3.80 ? 'HIGH' : student.gpa >= 3.30 ? 'MEDIUM' : 'LOW';
      console.log(`   ${student.name}: ${student.gpa} (${tier})`);
    });
    
    console.log('\n🔄 Making API request...');
    
    const response = await fetch('http://localhost:5000/api/groups/form', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        students: csvData
      })
    });
    
    console.log('📥 Response Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Upload successful!');
      console.log('📊 Groups formed:', data.data.groups.length);
      
      data.data.groups.forEach(group => {
        console.log(`\n${group.name}:`);
        group.members.forEach((member, index) => {
          const crown = index === 0 ? '👑 ' : '   ';
          console.log(`  ${crown}${member.name} (${member.gpa}, ${member.tier})`);
        });
      });
      
    } else {
      const errorText = await response.text();
      console.log('❌ Upload failed!');
      console.log('📄 Status:', response.status);
      console.log('📄 Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFileUpload();