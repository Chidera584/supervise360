const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testAPIEndpoint() {
  console.log('🔍 Testing the actual API endpoint that frontend calls...\n');
  
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
    
    console.log('1. Generated test JWT token for admin user');
    
    // Test the groups endpoint
    const response = await fetch('http://localhost:5000/api/groups', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('2. API Response Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('3. API Response Data:');
      console.log('   Success:', data.success);
      console.log('   User Department:', data.userDepartment);
      console.log('   Is System Admin:', data.isSystemAdmin);
      console.log('   Groups Count:', data.data?.length || 0);
      
      if (data.data && data.data.length > 0) {
        console.log('\n4. Groups Data:');
        data.data.forEach((group, index) => {
          console.log(`   ${index + 1}. ${group.name} (ID: ${group.id})`);
          console.log(`      Department: ${group.department}`);
          console.log(`      Members: ${group.members}`);
          console.log(`      Supervisor: ${group.supervisor_name}`);
          console.log('');
        });
      }
      
      console.log('✅ API is working correctly and returning real data!');
      console.log('📤 This is exactly what the frontend should receive.');
      
    } else {
      const errorText = await response.text();
      console.log('❌ API Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPIEndpoint();