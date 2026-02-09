// Test the flexible grouping algorithm directly
console.log('🧪 Testing Flexible ASP Group Formation Algorithm\n');

// Simulate the flexible algorithm logic
function formGroupsUsingASP(students) {
  console.log('🔍 ASP Group Formation - Input students:', students.length);
  
  if (students.length < 3) {
    throw new Error('Cannot form groups: Need at least 3 students to form groups.');
  }
  
  // Separate students by tier
  const highTier = students.filter(s => s.tier === 'HIGH');
  const mediumTier = students.filter(s => s.tier === 'MEDIUM');
  const lowTier = students.filter(s => s.tier === 'LOW');

  console.log('📊 Tier distribution:');
  console.log(`   HIGH (3.80-5.0): ${highTier.length} students`);
  console.log(`   MEDIUM (3.30-3.79): ${mediumTier.length} students`);
  console.log(`   LOW (< 3.30): ${lowTier.length} students`);

  const groups = [];
  let groupCounter = 0;

  // Sort students by GPA within each tier for optimal distribution
  highTier.sort((a, b) => b.gpa - a.gpa);
  mediumTier.sort((a, b) => b.gpa - a.gpa);
  lowTier.sort((a, b) => b.gpa - a.gpa);

  // Create a pool of all students for flexible assignment
  const allStudents = [...students];
  const usedStudents = new Set();

  // STRATEGY 1: Form ideal groups (1 HIGH + 1 MEDIUM + 1 LOW) when possible
  const idealGroups = Math.min(highTier.length, mediumTier.length, lowTier.length);
  
  console.log(`🎯 Strategy 1: Can form ${idealGroups} ideal groups (1 HIGH + 1 MEDIUM + 1 LOW each)`);
  
  for (let i = 0; i < idealGroups; i++) {
    const groupMembers = [highTier[i], mediumTier[i], lowTier[i]];
    
    // Mark students as used
    groupMembers.forEach(student => usedStudents.add(student.name));
    
    console.log(`🏗️  Forming Group ${String.fromCharCode(65 + groupCounter)}:`);
    console.log(`   👑 LEADER (HIGH): ${groupMembers[0].name} (${groupMembers[0].gpa})`);
    console.log(`   👥 MEMBER (MEDIUM): ${groupMembers[1].name} (${groupMembers[1].gpa})`);
    console.log(`   👥 MEMBER (LOW): ${groupMembers[2].name} (${groupMembers[2].gpa})`);

    const avgGpa = parseFloat(
      (groupMembers.reduce((sum, member) => sum + member.gpa, 0) / 3).toFixed(2)
    );

    groups.push({
      name: `Group ${String.fromCharCode(65 + groupCounter)}`,
      members: groupMembers,
      avg_gpa: avgGpa,
      status: 'formed'
    });
    
    groupCounter++;
  }

  // STRATEGY 2: Handle remaining students with flexible tier distribution
  const remainingStudents = allStudents.filter(student => !usedStudents.has(student.name));
  console.log(`🔄 Strategy 2: ${remainingStudents.length} students remaining for flexible grouping`);

  if (remainingStudents.length >= 3) {
    // Sort remaining students by GPA for balanced distribution
    remainingStudents.sort((a, b) => b.gpa - a.gpa);
    
    // Group remaining students in sets of 3, trying to balance tiers when possible
    while (remainingStudents.length >= 3) {
      const groupMembers = [];
      
      // Try to get diverse tiers if available
      const remainingHigh = remainingStudents.filter(s => s.tier === 'HIGH');
      const remainingMedium = remainingStudents.filter(s => s.tier === 'MEDIUM');
      const remainingLow = remainingStudents.filter(s => s.tier === 'LOW');
      
      console.log(`   Remaining tiers - HIGH: ${remainingHigh.length}, MEDIUM: ${remainingMedium.length}, LOW: ${remainingLow.length}`);
      
      // Strategy 2a: Try to get one from each tier if possible
      if (remainingHigh.length > 0 && remainingMedium.length > 0 && remainingLow.length > 0) {
        groupMembers.push(remainingHigh[0], remainingMedium[0], remainingLow[0]);
        // Remove from remaining students
        [remainingHigh[0], remainingMedium[0], remainingLow[0]].forEach(student => {
          const index = remainingStudents.indexOf(student);
          if (index > -1) remainingStudents.splice(index, 1);
        });
        console.log(`   📋 Balanced group: HIGH + MEDIUM + LOW`);
      }
      // Strategy 2b: Two from one tier, one from another
      else if (remainingStudents.length >= 3) {
        // Take the top 3 students by GPA for balanced performance
        const topThree = remainingStudents.splice(0, 3);
        groupMembers.push(...topThree);
        
        const tierCounts = topThree.reduce((acc, s) => {
          acc[s.tier] = (acc[s.tier] || 0) + 1;
          return acc;
        }, {});
        
        console.log(`   📋 Mixed group: ${Object.entries(tierCounts).map(([tier, count]) => `${count} ${tier}`).join(', ')}`);
      }
      
      if (groupMembers.length === 3) {
        // Sort by GPA (highest first) for consistent leader assignment
        groupMembers.sort((a, b) => b.gpa - a.gpa);
        
        console.log(`🏗️  Forming Group ${String.fromCharCode(65 + groupCounter)} (Flexible):`);
        console.log(`   👑 LEADER: ${groupMembers[0].name} (${groupMembers[0].gpa}) - ${groupMembers[0].tier}`);
        console.log(`   👥 MEMBER: ${groupMembers[1].name} (${groupMembers[1].gpa}) - ${groupMembers[1].tier}`);
        console.log(`   👥 MEMBER: ${groupMembers[2].name} (${groupMembers[2].gpa}) - ${groupMembers[2].tier}`);

        const avgGpa = parseFloat(
          (groupMembers.reduce((sum, member) => sum + member.gpa, 0) / 3).toFixed(2)
        );

        groups.push({
          name: `Group ${String.fromCharCode(65 + groupCounter)}`,
          members: groupMembers,
          avg_gpa: avgGpa,
          status: 'formed'
        });
        
        groupCounter++;
      } else {
        // Safety break to prevent infinite loop
        break;
      }
    }
  }

  // STRATEGY 3: Handle edge case with exactly 2 remaining students
  if (remainingStudents.length === 2 && groups.length > 0) {
    console.log(`🔄 Strategy 3: Adding 2 remaining students to existing groups`);
    
    // Add remaining students to the smallest groups
    const sortedGroups = groups.sort((a, b) => a.members.length - b.members.length);
    
    remainingStudents.forEach((student, index) => {
      if (index < sortedGroups.length) {
        sortedGroups[index].members.push(student);
        // Recalculate average GPA
        const newAvgGpa = parseFloat(
          (sortedGroups[index].members.reduce((sum, member) => sum + member.gpa, 0) / sortedGroups[index].members.length).toFixed(2)
        );
        sortedGroups[index].avg_gpa = newAvgGpa;
        
        console.log(`   ➕ Added ${student.name} (${student.gpa}) to ${sortedGroups[index].name}`);
      }
    });
  }

  console.log(`✅ Group formation completed:`);
  console.log(`   📊 Total groups formed: ${groups.length}`);
  console.log(`   👥 Students placed: ${groups.reduce((sum, g) => sum + g.members.length, 0)} / ${students.length}`);
  console.log(`   🎯 Ideal groups (1:1:1 ratio): ${idealGroups}`);
  console.log(`   🔄 Flexible groups: ${groups.length - idealGroups}`);

  if (groups.length === 0) {
    throw new Error('Cannot form any groups: Need at least 3 students total.');
  }

  return groups;
}

// Test cases
const testCases = [
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
  }
];

// Run tests
testCases.forEach(testCase => {
  console.log(`\n📋 Test Case: ${testCase.name}`);
  console.log(`👥 Students: ${testCase.students.length}`);
  
  try {
    const groups = formGroupsUsingASP(testCase.students);
    console.log(`✅ SUCCESS: Formed ${groups.length} groups`);
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
  }
});

console.log('\n🏁 Test completed!');