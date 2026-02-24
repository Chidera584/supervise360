// Test script to debug group formation validation
// This simulates what the backend does

// Sample student data - adjust this to match your CSV
const sampleStudents = [
  { name: 'Student 1', gpa: 4.0 },
  { name: 'Student 2', gpa: 3.5 },
  { name: 'Student 3', gpa: 3.0 },
  { name: 'Student 4', gpa: 3.9 },
  { name: 'Student 5', gpa: 3.4 },
  { name: 'Student 6', gpa: 2.8 },
];

// Tier classification function
function classifyGpaTier(gpa) {
  if (gpa >= 3.80 && gpa <= 5.0) return 'HIGH';
  if (gpa >= 3.30 && gpa < 3.80) return 'MEDIUM';
  return 'LOW';
}

// Process students
const processedStudents = sampleStudents.map(student => ({
  ...student,
  tier: classifyGpaTier(student.gpa)
}));

console.log('📊 Processed Students:');
processedStudents.forEach(s => {
  console.log(`  ${s.name}: GPA ${s.gpa} → ${s.tier} tier`);
});

// Count by tier
const tierCounts = processedStudents.reduce((acc, s) => {
  acc[s.tier] = (acc[s.tier] || 0) + 1;
  return acc;
}, {});

console.log('\n📈 Tier Distribution:');
console.log(`  HIGH (≥3.80): ${tierCounts.HIGH || 0} students`);
console.log(`  MEDIUM (3.30-3.79): ${tierCounts.MEDIUM || 0} students`);
console.log(`  LOW (<3.30): ${tierCounts.LOW || 0} students`);

// Simulate group formation
const highTier = processedStudents.filter(s => s.tier === 'HIGH');
const mediumTier = processedStudents.filter(s => s.tier === 'MEDIUM');
const lowTier = processedStudents.filter(s => s.tier === 'LOW');

const idealGroups = Math.min(highTier.length, mediumTier.length, lowTier.length);
console.log(`\n🎯 Can form ${idealGroups} ideal groups (1 HIGH + 1 MEDIUM + 1 LOW)`);

const groups = [];
const usedStudents = new Set();

// Form ideal groups
for (let i = 0; i < idealGroups; i++) {
  const groupMembers = [highTier[i], mediumTier[i], lowTier[i]];
  groupMembers.forEach(s => usedStudents.add(s.name));
  
  groups.push({
    name: `Group ${String.fromCharCode(65 + i)}`,
    members: groupMembers,
    avg_gpa: parseFloat((groupMembers.reduce((sum, m) => sum + m.gpa, 0) / 3).toFixed(2))
  });
}

// Handle remaining students
const remainingStudents = processedStudents.filter(s => !usedStudents.has(s.name));
console.log(`\n🔄 Remaining students: ${remainingStudents.length}`);

if (remainingStudents.length >= 3) {
  remainingStudents.sort((a, b) => b.gpa - a.gpa);
  
  while (remainingStudents.length >= 3) {
    const groupMembers = remainingStudents.splice(0, 3);
    groups.push({
      name: `Group ${String.fromCharCode(65 + groups.length)}`,
      members: groupMembers,
      avg_gpa: parseFloat((groupMembers.reduce((sum, m) => sum + m.gpa, 0) / 3).toFixed(2))
    });
  }
}

console.log(`\n✅ Formed ${groups.length} groups\n`);

// Validate groups
console.log('🔍 Validating Groups:\n');
const violations = [];

groups.forEach(group => {
  console.log(`${group.name}:`);
  console.log(`  Members: ${group.members.length}`);
  console.log(`  Tiers: ${group.members.map(m => m.tier).join(', ')}`);
  console.log(`  Students: ${group.members.map(m => `${m.name} (${m.gpa})`).join(', ')}`);
  console.log(`  Avg GPA: ${group.avg_gpa}`);
  
  // Check validation
  if (group.members.length !== 3) {
    const violation = `${group.name}: Must have exactly 3 members`;
    violations.push(violation);
    console.log(`  ❌ ${violation}`);
  }
  
  const tiers = group.members.map(m => m.tier);
  const hasInvalidTiers = tiers.some(tier => !['HIGH', 'MEDIUM', 'LOW'].includes(tier));
  
  if (hasInvalidTiers) {
    const violation = `${group.name}: All members must have valid tier classification`;
    violations.push(violation);
    console.log(`  ❌ ${violation}`);
  }
  
  if (group.members.length === 3 && !hasInvalidTiers) {
    console.log(`  ✅ Valid`);
  }
  
  console.log('');
});

console.log('\n📋 Validation Summary:');
if (violations.length === 0) {
  console.log('✅ All groups passed validation!');
} else {
  console.log('❌ Validation failed with violations:');
  violations.forEach(v => console.log(`  - ${v}`));
}

console.log('\n💡 If validation fails, check:');
console.log('  1. Total students should be divisible by 3');
console.log('  2. All students have valid GPA values');
console.log('  3. Backend server is running with updated code');
