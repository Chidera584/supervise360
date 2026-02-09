// Test the supervisors API endpoint to see the actual count
const fetch = require('node-fetch');

async function testSupervisorsAPI() {
  console.log('🔍 Testing supervisors API endpoint...\n');
  
  try {
    // Test the supervisors endpoint
    const response = await fetch('http://localhost:5000/api/users/supervisors', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📡 Response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response received');
      console.log(`📊 Total supervisors: ${data.length || 'Unknown'}`);
      
      if (Array.isArray(data)) {
        console.log('\n📋 Supervisor details:');
        data.forEach((supervisor, index) => {
          console.log(`${index + 1}. ${supervisor.first_name || 'N/A'} ${supervisor.last_name || 'N/A'}`);
          console.log(`   Email: ${supervisor.email || 'N/A'}`);
          console.log(`   Department: ${supervisor.department || 'N/A'}`);
          console.log(`   Groups: ${supervisor.group_count || 0}`);
          console.log('');
        });
        
        // Analysis
        console.log('🔍 Analysis:');
        console.log(`   Total count: ${data.length}`);
        console.log(`   With groups: ${data.filter(s => s.group_count > 0).length}`);
        console.log(`   Available: ${data.filter(s => s.group_count === 0).length}`);
        
        // Check for test data patterns
        const testData = data.filter(s => {
          const fullText = `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase();
          return ['test', 'dummy', 'sample', 'example', 'demo', 'fake'].some(pattern => 
            fullText.includes(pattern)
          );
        });
        
        if (testData.length > 0) {
          console.log(`\n🧪 Potential test/dummy data: ${testData.length} entries`);
          testData.forEach(s => {
            console.log(`   - ${s.first_name} ${s.last_name} (${s.email})`);
          });
        }
        
      } else {
        console.log('📄 Response data:', data);
      }
    } else {
      console.log(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testSupervisorsAPI();