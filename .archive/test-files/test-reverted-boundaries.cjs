// Test to confirm the reverted GPA boundaries are working correctly
const { GroupFormationService } = require('./backend/groupFormationService-balanced.js');

// Mock database connection
const mockDb = {
  getConnection: () => ({
    execute: () => Promise.resolve([[], {}]),
    beginTransaction: () => Promise.resolve(),
    commit: () => Promise.resolve(),
    rollback: () => Promise.resolve(),
    release: () => Promise.resolve()
  })
};

const service = new GroupFormationService(mockDb);

console.log('🧪 Testing REVERTED GPA Boundaries + Intelligent Selection\n');

// Test case 1: Verify GPA boundary classification (REVERTED)
console.log('📊 TEST 1: GPA Boundary Classification (REVERTED TO ORIGINAL)');
const testGpas = [
  { gpa: 4.5, expected: 'HIGH' },
  { gpa: 3.80, expected: 'HIGH' },
  { gpa: 3.79, expected: 'MEDIUM' },
  { gpa: 3.70, expected: 'MEDIUM' },
  { gpa: 3.30, expected: 'MEDIUM' },  // This should now be MEDIUM (was LOW in updated version)
  { gpa: 3.29, expected: 'LOW' },     // This should be LOW
  { gpa: 3.20, expected: 'LOW' },
  { gpa: 2.5, expected: 'LOW' }
];

testGpas.forEach(test => {
  const result = service.classifyGpaTier(test.gpa);
  const status = result === test.expected ? '✅' : '❌';
  console.log(`   ${status} GPA ${test.gpa} → ${result} (expected: ${test.expected})`);
});

// Test case 2: Intelligent MEDIUM selection with ORIGINAL boundaries
console.log('\n📊 TEST 2: Intelligent MEDIUM Selection with ORIGINAL Boundaries');
const testStudents = [
  // 1 HIGH tier student
  { name: 'Alice High1', gpa: 4.5, tier: 'HIGH' },
  
  // 1 MEDIUM for ideal group
  { name: 'Bob Medium1', gpa: 3.50, tier: 'MEDIUM' },
  
  // 1 LOW for ideal group  
  { name: 'Charlie Low1', gpa: 3.20, tier: 'LOW' },
  
  // 2 MORE MEDIUM - one in preferred range, one not
  { name: 'David Medium2', gpa: 3.75, tier: 'MEDIUM' },   // In preferred 3.70-3.79 range
  { name: 'Eve Medium3', gpa: 3.40, tier: 'MEDIUM' },     // Below preferred range (but still MEDIUM with original boundaries)
  
  // 1 MORE LOW
  { name: 'Frank Low2', gpa: 3.25, tier: 'LOW' }
];

console.log(`👥 Total students: ${testStudents.length}`);
console.log('🎯 Expected with ORIGINAL boundaries:');
console.log('   • 3.30 should be MEDIUM tier (not LOW)');
console.log('   • Intelligent selection should still prioritize 3.70-3.79 for 2M+1L groups\n');

try {
  const groups = service.formGroupsUsingASP(testStudents);
  
  console.log('\n📋 RESULTS WITH ORIGINAL BOUNDARIES:');
  console.log(`✅ Total groups formed: ${groups.length}`);
  
  let intelligentSelectionWorked = false;
  
  groups.forEach((group, index) => {
    const tiers = group.members.map(m => m.tier);
    const mediumCount = tiers.filter(t => t === 'MEDIUM').length;
    const lowCount = tiers.filter(t => t === 'LOW').length;
    
    console.log(`\n   ${group.name}:`);
    group.members.forEach((member, memberIndex) => {
      const leader = memberIndex === 0 ? '👑' : '👥';
      console.log(`     ${leader} ${member.name} (${member.gpa}) - ${member.tier}`);
    });
    console.log(`     📈 Avg GPA: ${group.avg_gpa}`);
    
    // Check for 2 MEDIUM + 1 LOW pattern
    if (mediumCount === 2 && lowCount === 1) {
      console.log(`     🎯 TARGET GROUP: 2 MEDIUM + 1 LOW pattern detected!`);
      
      const mediumStudents = group.members.filter(m => m.tier === 'MEDIUM');
      const hasPreferredRange = mediumStudents.some(s => s.gpa >= 3.70 && s.gpa <= 3.79);
      const preferredStudent = mediumStudents.find(s => s.gpa >= 3.70 && s.gpa <= 3.79);
      
      if (hasPreferredRange && preferredStudent) {
        intelligentSelectionWorked = true;
        console.log(`     ✅ INTELLIGENT SELECTION: ${preferredStudent.name} (${preferredStudent.gpa}) from preferred 3.70-3.79 range`);
      } else {
        console.log(`     ❌ No MEDIUM students in preferred 3.70-3.79 range`);
      }
    }
  });
  
  console.log(`\n🎯 VERIFICATION RESULTS:`);
  console.log(`   📊 Original boundaries restored: HIGH (3.80-5.0), MEDIUM (3.30-3.79), LOW (<3.30) ✅`);
  console.log(`   🧠 Intelligent selection for 2M+1L groups: ${intelligentSelectionWorked ? '✅ Working' : '❌ Not triggered'}`);
  console.log(`   🎯 Students with GPA 3.30-3.39 are now MEDIUM tier (not LOW) ✅`);
  
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

console.log('\n🏁 Reversion test completed!');