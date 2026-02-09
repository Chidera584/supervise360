// Test the academic balance priority algorithm
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

console.log('🧪 Testing Academic Balance Priority Algorithm\n');

// Test case: Uneven distribution that would create homogeneous groups with old algorithm
const testStudents = [
  // 6 HIGH tier students
  { name: 'Alice High1', gpa: 4.8, tier: 'HIGH' },
  { name: 'Bob High2', gpa: 4.6, tier: 'HIGH' },
  { name: 'Charlie High3', gpa: 4.4, tier: 'HIGH' },
  { name: 'David High4', gpa: 4.2, tier: 'HIGH' },
  { name: 'Eve High5', gpa: 4.0, tier: 'HIGH' },
  { name: 'Frank High6', gpa: 3.9, tier: 'HIGH' },
  
  // 3 MEDIUM tier students
  { name: 'Grace Medium1', gpa: 3.7, tier: 'MEDIUM' },
  { name: 'Henry Medium2', gpa: 3.5, tier: 'MEDIUM' },
  { name: 'Ivy Medium3', gpa: 3.3, tier: 'MEDIUM' },
  
  // 3 LOW tier students
  { name: 'Jack Low1', gpa: 3.2, tier: 'LOW' },
  { name: 'Kate Low2', gpa: 3.0, tier: 'LOW' },
  { name: 'Liam Low3', gpa: 2.8, tier: 'LOW' }
];

console.log('📊 Test Case: Uneven distribution (6 HIGH, 3 MEDIUM, 3 LOW)');
console.log(`👥 Total students: ${testStudents.length}`);
console.log('🎯 Expected: Should prioritize mixed-ability groups over homogeneous ones\n');

try {
  const groups = service.formGroupsUsingASP(testStudents);
  
  console.log('\n📋 RESULTS ANALYSIS:');
  console.log(`✅ Total groups formed: ${groups.length}`);
  
  // Analyze academic balance
  let mixedGroups = 0;
  let homogeneousGroups = 0;
  
  groups.forEach((group, index) => {
    const tiers = group.members.map(m => m.tier);
    const uniqueTiers = new Set(tiers);
    const isHomogeneous = uniqueTiers.size === 1;
    
    if (isHomogeneous) {
      homogeneousGroups++;
    } else {
      mixedGroups++;
    }
    
    console.log(`\n   ${group.name}:`);
    group.members.forEach((member, memberIndex) => {
      const leader = memberIndex === 0 ? '👑' : '👥';
      console.log(`     ${leader} ${member.name} (${member.gpa}) - ${member.tier}`);
    });
    console.log(`     📈 Avg GPA: ${group.avg_gpa}`);
    console.log(`     ${isHomogeneous ? '⚠️  Homogeneous' : '✅ Mixed-ability'} (${Array.from(uniqueTiers).join(', ')})`);
  });
  
  console.log(`\n🎯 ACADEMIC BALANCE SUMMARY:`);
  console.log(`   ✅ Mixed-ability groups: ${mixedGroups} (${Math.round((mixedGroups/groups.length)*100)}%)`);
  console.log(`   ⚠️  Homogeneous groups: ${homogeneousGroups} (${Math.round((homogeneousGroups/groups.length)*100)}%)`);
  
  if (mixedGroups > homogeneousGroups) {
    console.log(`   🎉 SUCCESS: Algorithm prioritized academic balance!`);
  } else {
    console.log(`   ⚠️  CONCERN: Too many homogeneous groups - may need further optimization`);
  }
  
  console.log(`\n📚 EDUCATIONAL BENEFITS:`);
  console.log(`   • HIGH tier students can mentor MEDIUM/LOW tier students`);
  console.log(`   • MEDIUM tier students get support from HIGH and can help LOW`);
  console.log(`   • LOW tier students receive academic assistance from peers`);
  console.log(`   • All students develop collaboration and leadership skills`);
  
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

console.log('\n🏁 Test completed!');