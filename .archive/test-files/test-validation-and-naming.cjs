// Test the validation fix and numeric group naming
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

console.log('🧪 Testing Validation Fix and Numeric Group Naming\n');

// Test case with mixed tier distribution (should pass validation now)
const testStudents = [
  { name: 'Alice High1', gpa: 4.5, tier: 'HIGH' },
  { name: 'Bob High2', gpa: 4.2, tier: 'HIGH' },
  { name: 'Charlie High3', gpa: 4.0, tier: 'HIGH' },
  { name: 'David Medium1', gpa: 3.6, tier: 'MEDIUM' },
  { name: 'Eve Medium2', gpa: 3.4, tier: 'MEDIUM' },
  { name: 'Frank Low1', gpa: 3.1, tier: 'LOW' }
];

console.log('📊 Test Case: Mixed distribution with validation');
console.log(`👥 Students: ${testStudents.length}`);
console.log('📈 Distribution: HIGH: 3, MEDIUM: 2, LOW: 1');
console.log('🎯 Expected: Should form groups with numeric names and pass validation\n');

try {
  const groups = service.formGroupsUsingASP(testStudents);
  
  console.log('✅ Group formation successful!');
  console.log(`📊 Total groups: ${groups.length}`);
  
  // Test validation
  const validation = service.validateGroupFormation(groups);
  
  if (validation.isValid) {
    console.log('✅ Validation PASSED - No violations found');
  } else {
    console.log('❌ Validation FAILED:');
    validation.violations.forEach(violation => {
      console.log(`   - ${violation}`);
    });
  }
  
  // Check group names
  console.log('\n📋 Group Names Check:');
  groups.forEach((group) => {
    const isNumeric = /^Group \d+$/.test(group.name);
    console.log(`   ${isNumeric ? '✅' : '❌'} ${group.name} ${isNumeric ? '(Numeric ✓)' : '(Not numeric ✗)'}`);
  });
  
  // Show group details
  console.log('\n👥 Group Details:');
  groups.forEach((group) => {
    console.log(`\n   ${group.name}:`);
    group.members.forEach((member, index) => {
      const leader = index === 0 ? '👑' : '👥';
      console.log(`     ${leader} ${member.name} (${member.gpa}) - ${member.tier}`);
    });
    console.log(`     📈 Avg GPA: ${group.avg_gpa}`);
  });
  
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

console.log('\n🏁 Test completed!');