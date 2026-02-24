async function verifyFix() {
  console.log('🔍 Verifying Threshold Settings Fix\n');
  
  const tests = [];
  
  // Test 1: Preview endpoint exists and works
  console.log('1️⃣ Testing preview endpoint...');
  try {
    const res = await fetch('http://localhost:5000/api/settings/gpa-thresholds/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ high: 3.8, medium: 3.3, low: 0.0 })
    });
    
    if (res.status === 200) {
      const data = await res.json();
      if (data.success && data.data.distribution) {
        console.log('   ✅ Preview endpoint working');
        console.log('   📊 Distribution:', data.data.distribution);
        tests.push({ name: 'Preview endpoint', passed: true });
      } else {
        console.log('   ❌ Preview endpoint returned unexpected data');
        tests.push({ name: 'Preview endpoint', passed: false });
      }
    } else {
      console.log(`   ❌ Preview endpoint returned ${res.status}`);
      tests.push({ name: 'Preview endpoint', passed: false });
    }
  } catch (error) {
    console.log('   ❌ Preview endpoint failed:', error.message);
    tests.push({ name: 'Preview endpoint', passed: false });
  }
  
  // Test 2: GET global thresholds
  console.log('\n2️⃣ Testing GET global thresholds...');
  try {
    const res = await fetch('http://localhost:5000/api/settings/gpa-thresholds/global');
    if (res.status === 200) {
      const data = await res.json();
      console.log('   ✅ GET endpoint working');
      console.log('   📊 Current thresholds:', data.data);
      tests.push({ name: 'GET thresholds', passed: true });
    } else {
      console.log(`   ❌ GET endpoint returned ${res.status}`);
      tests.push({ name: 'GET thresholds', passed: false });
    }
  } catch (error) {
    console.log('   ❌ GET endpoint failed:', error.message);
    tests.push({ name: 'GET thresholds', passed: false });
  }
  
  // Test 3: Server health
  console.log('\n3️⃣ Testing server health...');
  try {
    const res = await fetch('http://localhost:5000/health');
    if (res.status === 200) {
      console.log('   ✅ Server healthy');
      tests.push({ name: 'Server health', passed: true });
    } else {
      console.log(`   ❌ Server returned ${res.status}`);
      tests.push({ name: 'Server health', passed: false });
    }
  } catch (error) {
    console.log('   ❌ Server not responding:', error.message);
    tests.push({ name: 'Server health', passed: false });
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 VERIFICATION SUMMARY');
  console.log('='.repeat(50));
  
  const passed = tests.filter(t => t.passed).length;
  const total = tests.length;
  
  tests.forEach(test => {
    console.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
  });
  
  console.log('\n' + '='.repeat(50));
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! Threshold settings are FIXED!');
    console.log('✅ You can now use the Settings page in the frontend.');
  } else {
    console.log(`⚠️  ${passed}/${total} tests passed. Some issues remain.`);
  }
  console.log('='.repeat(50));
}

verifyFix().catch(console.error);
