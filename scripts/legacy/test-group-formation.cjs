const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testGroupFormation() {
  console.log('🧪 Testing Group Formation with Tier-Based ASP Algorithm\n');
  
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
    
    // Test data with clear tier distribution
    const testStudents = [
      // HIGH tier (3.80-5.0)
      { name: 'Eze Vivian', gpa: 4.56, department: 'Software Engineering' },
      { name: 'Alice High', gpa: 4.20, department: 'Software Engineering' },
      { name: 'Bob High', gpa: 3.90, department: 'Software Engineering' },
      
      // MEDIUM tier (3.30-3.79)
      { name: 'Michael Ojo', gpa: 3.62, department: 'Software Engineering' },
      { name: 'Charlie Medium', gpa: 3.50, department: 'Software Engineering' },
      { name: 'Diana Medium', gpa: 3.40, department: 'Software Engineering' },
      
      // LOW tier (< 3.30)
      { name: 'Chuks Okafor', gpa: 3.20, department: 'Software Engineering' },
      { name: 'Eve Low', gpa: 3.10, department: 'Software Engineering' },
      { name: 'Frank Low', gpa: 2.90, department: 'Software Engineering' }
    ];
    
    console.log('📤 Input Students:');
    testStudents.forEach(student => {
      let tier = 'LOW';
      if (student.gpa >= 3.80) tier = 'HIGH';
      else if (student.gpa >= 3.30) tier = 'MEDIUM';
      console.log(`   ${student.name}: ${student.gpa} (${tier})`);
    });
    
    console.log('\n🔄 Making API request to form groups...');
    
    const response = await fetch('http://localhost:5000/api/groups/form', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        students: testStudents
      })
    });
    
    console.log('📥 API Response Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Group formation successful!');
      console.log('📊 Response:', JSON.stringify(data, null, 2));
      
      if (data.success && data.data.groups) {
        console.log(`\n🎯 Formed ${data.data.groups.length} groups:`);
        
        data.data.groups.forEach((group, index) => {
          console.log(`\n${group.name}:`);
          group.members.forEach((member, memberIndex) => {
            const isLeader = memberIndex === 0;
            const crown = isLeader ? '👑 ' : '   ';
            console.log(`  ${crown}${member.name} (GPA: ${member.gpa}, Tier: ${member.tier})`);
          });
          console.log(`  📊 Average GPA: ${group.avg_gpa}`);
        });
        
        // Validate tier distribution
        console.log('\n🔍 Validation:');
        data.data.groups.forEach(group => {
          const tiers = group.members.map(m => m.tier);
          const hasAllTiers = tiers.includes('HIGH') && tiers.includes('MEDIUM') && tiers.includes('LOW');
          const isCorrectOrder = tiers[0] === 'HIGH' && tiers[1] === 'MEDIUM' && tiers[2] === 'LOW';
          
          console.log(`${group.name}: ${hasAllTiers ? '✅' : '❌'} All tiers, ${isCorrectOrder ? '✅' : '❌'} Correct order`);
        });
      }
      
    } else {
      const errorText = await response.text();
      console.log('❌ API Error:', response.status);
      console.log('📄 Error details:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testGroupFormation();