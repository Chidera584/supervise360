// Test the flexible algorithm directly from the JavaScript file
const { GroupFormationService } = require('./backend/groupFormationService.js');

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

console.log('🧪 Testing Updated Flexible ASP Algorithm\n');

// Test case that would previously fail
const testStudents = [
  { name: 'Alice High1', gpa: 4.5, tier: 'HIGH' },
  { name: 'Bob High2', gpa: 4.2, tier: 'HIGH' },
  { name: 'Charlie High3', gpa: 4.0, tier: 'HIGH' },
  { name: 'David High4', gpa: 3.9, tier: 'HIGH' },
  { name: 'Eve Medium1', gpa: 3.6, tier: 'MEDIUM' },
  { name: 'Frank Medium2', gpa: 3.4, tier: 'MEDIUM' }
  // No LOW tier students - this would previously fail with "insufficient students in one or more tiers"
];

console.log('📊 Test Case: Missing LOW tier completely');
console.log(`👥 Students: ${testStudents.length}`);
console.log('📈 Distribution: HIGH: 4, MEDIUM: 2, LOW: 0');
console.log('🎯 Expected: Should form 2 groups using flexible strategy\n');

try {
  const groups = service.formGroupsUsingASP(testStudents);
  
  console.log('✅ SUCCESS: Groups formed successfully!');
  console.log(`📊 Total groups: ${groups.length}`);
  
  groups.forEach((group) => {
    console.log(`\n   ${group.name}:`);
    group.members.forEach((member, index) => {
      const leader = index === 0 ? '👑' : '👥';
      console.log(`     ${leader} ${member.name} (${member.gpa}) - ${member.tier}`);
    });
    console.log(`     📈 Avg GPA: ${group.avg_gpa}`);
  });
  
  const totalPlaced = groups.reduce((sum, g) => sum + g.members.length, 0);
  console.log(`\n📊 Students placed: ${totalPlaced}/${testStudents.length}`);
  
  if (totalPlaced === testStudents.length) {
    console.log('🎉 Perfect! All students placed in groups.');
  }
  
} catch (error) {
  console.log('❌ FAILED:', error.message);
  console.log('🔍 This indicates the old algorithm is still being used.');
}

console.log('\n🏁 Test completed!');