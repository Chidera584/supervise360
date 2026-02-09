const { GroupFormationService } = require('./backend/dist/services/groupFormationService.js');

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

// Test cases for flexible grouping
const testCases = [
  {
    name: 'Uneven distribution - More HIGH tier students',
    students: [
      { name: 'Alice High1', gpa: 4.5, tier: 'HIGH' },
      { name: 'Bob High2', gpa: 4.2, tier: 'HIGH' },
      { name: 'Charlie High3', gpa: 4.0, tier: 'HIGH' },
      { name: 'David High4', gpa: 3.9, tier: 'HIGH' },
      { name: 'Eve Medium1', gpa: 3.6, tier: 'MEDIUM' },
      { name: 'Frank Medium2', gpa: 3.4, tier: 'MEDIUM' },
      { name: 'Grace Low1', gpa: 3.1, tier: 'LOW' },
      { name: 'Henry Low2', gpa: 2.8, tier: 'LOW' }
    ]
  },
  {
    name: 'Missing one tier completely',
    students: [
      { name: 'Alice High1', gpa: 4.5, tier: 'HIGH' },
      { name: 'Bob High2', gpa: 4.2, tier: 'HIGH' },
      { name: 'Charlie High3', gpa: 4.0, tier: 'HIGH' },
      { name: 'David Medium1', gpa: 3.6, tier: 'MEDIUM' },
      { name: 'Eve Medium2', gpa: 3.4, tier: 'MEDIUM' },
      { name: 'Frank Medium3', gpa: 3.3, tier: 'MEDIUM' }
      // No LOW tier students
    ]
  },
  {
    name: 'Only one tier available',
    students: [
      { name: 'Alice High1', gpa: 4.5, tier: 'HIGH' },
      { name: 'Bob High2', gpa: 4.2, tier: 'HIGH' },
      { name: 'Charlie High3', gpa: 4.0, tier: 'HIGH' },
      { name: 'David High4', gpa: 3.9, tier: 'HIGH' },
      { name: 'Eve High5', gpa: 3.8, tier: 'HIGH' },
      { name: 'Frank High6', gpa: 3.85, tier: 'HIGH' }
    ]
  },
  {
    name: 'Minimal case - exactly 3 students',
    students: [
      { name: 'Alice High1', gpa: 4.5, tier: 'HIGH' },
      { name: 'Bob Medium1', gpa: 3.6, tier: 'MEDIUM' },
      { name: 'Charlie Low1', gpa: 3.1, tier: 'LOW' }
    ]
  },
  {
    name: 'Edge case - 5 students (2 remaining)',
    students: [
      { name: 'Alice High1', gpa: 4.5, tier: 'HIGH' },
      { name: 'Bob High2', gpa: 4.2, tier: 'HIGH' },
      { name: 'Charlie Medium1', gpa: 3.6, tier: 'MEDIUM' },
      { name: 'David Low1', gpa: 3.1, tier: 'LOW' },
      { name: 'Eve Low2', gpa: 2.8, tier: 'LOW' }
    ]
  }
];

async function runTests() {
  console.log('🧪 Testing Flexible ASP Group Formation Algorithm\n');
  
  for (const testCase of testCases) {
    console.log(`\n📋 Test Case: ${testCase.name}`);
    console.log(`👥 Students: ${testCase.students.length}`);
    
    // Show tier distribution
    const tierCounts = testCase.students.reduce((acc, s) => {
      acc[s.tier] = (acc[s.tier] || 0) + 1;
      return acc;
    }, {});
    console.log(`📊 Distribution: ${Object.entries(tierCounts).map(([tier, count]) => `${tier}: ${count}`).join(', ')}`);
    
    try {
      const groups = service.formGroupsUsingASP(testCase.students);
      
      console.log(`✅ SUCCESS: Formed ${groups.length} groups`);
      
      groups.forEach((group, index) => {
        console.log(`   Group ${group.name}:`);
        group.members.forEach((member, memberIndex) => {
          const leader = memberIndex === 0 ? '👑' : '👥';
          console.log(`     ${leader} ${member.name} (${member.gpa}) - ${member.tier}`);
        });
        console.log(`     📈 Avg GPA: ${group.avg_gpa}`);
      });
      
      // Verify all students are placed
      const totalPlaced = groups.reduce((sum, g) => sum + g.members.length, 0);
      console.log(`   📊 Students placed: ${totalPlaced}/${testCase.students.length}`);
      
      if (totalPlaced !== testCase.students.length) {
        console.log(`   ⚠️  Warning: ${testCase.students.length - totalPlaced} students not placed`);
      }
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
    }
  }
  
  console.log('\n🏁 Test completed!');
}

runTests().catch(console.error);