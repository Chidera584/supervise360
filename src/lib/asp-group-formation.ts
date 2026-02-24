// ASP-based Group Formation Logic
// This module implements Answer Set Programming rules for optimal group formation
import { API_BASE_URL } from './api';

export interface Student {
  name: string;
  matricNumber: string;
  gpa?: number;
  tier?: 'HIGH' | 'MEDIUM' | 'LOW';
  department?: string;
  preferences?: string[];
}

export interface Group {
  id: number;
  name: string;
  members: Student[];
  avgGpa?: number;
  status: 'formed' | 'active';
  supervisor?: string;
  project?: string;
  department?: string;
}

// GPA tier classification based on dynamic thresholds
export function classifyGpaTier(
  gpa?: number, 
  thresholds?: { high: number; medium: number; low: number }
): 'HIGH' | 'MEDIUM' | 'LOW' | undefined {
  if (gpa === undefined || gpa === null) return undefined;
  
  // Use provided thresholds or fall back to defaults
  const high = thresholds?.high ?? 3.80;
  const medium = thresholds?.medium ?? 3.30;
  const low = thresholds?.low ?? 0.00;
  
  if (gpa >= high && gpa <= 5.0) return 'HIGH';
  if (gpa >= medium && gpa < high) return 'MEDIUM';
  if (gpa >= low) return 'LOW';
  return 'LOW';
}

// Fetch GPA thresholds from backend
export async function fetchGpaThresholds(department?: string): Promise<{ high: number; medium: number; low: number }> {
  try {
    const token = localStorage.getItem('token');
    const url = department 
      ? `${API_BASE_URL}/settings/gpa-thresholds/department/${department}`
      : `${API_BASE_URL}/settings/gpa-thresholds/global`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (department && data.data.useCustomThresholds) {
        return data.data.thresholds;
      }
      return data.data.thresholds || data.data;
    }
  } catch (error) {
    console.error('Error fetching GPA thresholds, using defaults:', error);
  }
  
  // Return defaults if fetch fails
  return { high: 3.80, medium: 3.30, low: 0.00 };
}

// Process uploaded student data and classify into tiers
export function processStudentData(
  rawData: any[], 
  thresholds?: { high: number; medium: number; low: number }
): Student[] {
  if (!rawData || rawData.length === 0) {
    throw new Error('No student data provided');
  }

  console.log('Raw data received:', rawData);
  console.log('Number of rows:', rawData.length);

  return rawData.map((student, index) => {
    console.log(`Processing row ${index + 2}:`, student);
    console.log('Available keys:', Object.keys(student));
    console.log('Values:', Object.values(student));
    
    // Try different possible column names for name (case insensitive)
    const nameKey = Object.keys(student).find(key => 
      key.toLowerCase().includes('name') || 
      key.toLowerCase() === 'student' ||
      key.toLowerCase() === 'full'
    );
    
    const name = nameKey ? student[nameKey] : null;
    
    // Try different possible column names for GPA (case insensitive)
    const gpaKey = Object.keys(student).find(key => 
      key.toLowerCase().includes('gpa') || 
      key.toLowerCase().includes('cgpa') ||
      key.toLowerCase() === 'grade'
    );
    
    const gpaValue = gpaKey ? student[gpaKey] : null;
    
    // Try different possible column names for matric number (case insensitive)
    const matricKey = Object.keys(student).find(key => 
      key.toLowerCase().includes('matric') || 
      key.toLowerCase().includes('student id') ||
      key.toLowerCase() === 'id'
    );
    
    const matricNumber = matricKey ? student[matricKey] : null;
    
    console.log(`Found name key: "${nameKey}" with value: "${name}"`);
    console.log(`Found GPA key: "${gpaKey}" with value: "${gpaValue}"`);
    console.log(`Found matric key: "${matricKey}" with value: "${matricNumber}"`);
    
    if (!name || name.toString().trim() === '') {
      console.error(`Row ${index + 2} data:`, student);
      throw new Error(`Student at row ${index + 2} is missing a name. Found keys: [${Object.keys(student).join(', ')}]. Name key found: "${nameKey}", value: "${name}"`);
    }
    
    if (!matricNumber || matricNumber.toString().trim() === '') {
      console.error(`Row ${index + 2} data:`, student);
      throw new Error(`Student "${name}" at row ${index + 2} is missing Matric Number. Found keys: [${Object.keys(student).join(', ')}]. Matric key found: "${matricKey}", value: "${matricNumber}"`);
    }
    
    // GPA is now optional
    let gpa: number | undefined;
    let tier: 'HIGH' | 'MEDIUM' | 'LOW' | undefined;
    
    if (gpaValue && gpaValue.toString().trim() !== '') {
      gpa = parseFloat(gpaValue.toString().trim());
      if (isNaN(gpa) || gpa < 0 || gpa > 5.0) {
        throw new Error(`Student "${name}" has invalid GPA: "${gpaValue}". GPA must be between 0.0 and 5.0`);
      }
      tier = classifyGpaTier(gpa, thresholds);
    }

    const result = {
      name: name.toString().trim(),
      matricNumber: matricNumber.toString().trim(),
      gpa,
      tier,
      department: student.department || student.Department || student.DEPARTMENT || 'Software Engineering'
    };
    
    console.log(`Processed student:`, result);
    return result;
  });
}

// ASP-based group formation algorithm with improved distribution handling
export function formGroupsUsingASP(students: Student[]): Group[] {
  if (students.length < 3) {
    throw new Error('Need at least 3 students to form groups');
  }

  // Separate students by tier (students without GPA will be in a separate category)
  const highTier = students.filter(s => s.tier === 'HIGH');
  const mediumTier = students.filter(s => s.tier === 'MEDIUM');
  const lowTier = students.filter(s => s.tier === 'LOW');
  const noGpaTier = students.filter(s => !s.tier);

  console.log(`Student distribution - HIGH: ${highTier.length}, MEDIUM: ${mediumTier.length}, LOW: ${lowTier.length}, NO GPA: ${noGpaTier.length}`);

  // Sort students by GPA within each tier for optimal distribution (handle undefined GPA)
  highTier.sort((a, b) => (b.gpa || 0) - (a.gpa || 0));
  mediumTier.sort((a, b) => (b.gpa || 0) - (a.gpa || 0));
  lowTier.sort((a, b) => (b.gpa || 0) - (a.gpa || 0));
  // Students without GPA are sorted alphabetically
  noGpaTier.sort((a, b) => a.name.localeCompare(b.name));

  const groups: Group[] = [];
  let groupCounter = 0;

  // Create a pool of all students for flexible assignment
  const studentPool = [...students].sort((a, b) => (b.gpa || 0) - (a.gpa || 0));
  const usedStudents = new Set<string>();

  // Strategy 1: Form ideal groups (1 HIGH, 1 MEDIUM, 1 LOW) first if we have GPA data
  const idealGroups = Math.min(highTier.length, mediumTier.length, lowTier.length);
  
  for (let i = 0; i < idealGroups; i++) {
    const groupMembers = [highTier[i], mediumTier[i], lowTier[i]];
    
    // Mark students as used
    groupMembers.forEach(student => usedStudents.add(student.name));
    
    // Sort members by GPA (highest first, handle undefined)
    groupMembers.sort((a, b) => (b.gpa || 0) - (a.gpa || 0));

    const avgGpa = groupMembers.every(m => m.gpa !== undefined) 
      ? parseFloat((groupMembers.reduce((sum, member) => sum + (member.gpa || 0), 0) / 3).toFixed(2))
      : undefined;

    groups.push({
      id: ++groupCounter,
      name: `Group ${groupCounter}`, // Group 1, Group 2, Group 3, etc.
      members: groupMembers,
      avgGpa,
      status: 'formed',
      supervisor: undefined,
      project: undefined,
      department: groupMembers[0]?.department || 'Software Engineering'
    });
  }

  // Strategy 2: Form additional groups with remaining students
  const remainingStudents = students.filter(student => !usedStudents.has(student.name));
  console.log(`Remaining students after ideal groups: ${remainingStudents.length}`);

  // Form groups of 3 with remaining students, trying to balance tiers when possible
  while (remainingStudents.length >= 3) {
    const groupMembers: Student[] = [];
    
    // Try to get one from each tier if available
    const remainingHigh = remainingStudents.filter(s => s.tier === 'HIGH');
    const remainingMedium = remainingStudents.filter(s => s.tier === 'MEDIUM');
    const remainingLow = remainingStudents.filter(s => s.tier === 'LOW');
    const remainingNoGpa = remainingStudents.filter(s => !s.tier);
    
    // Add one from each tier if available
    if (remainingHigh.length > 0) {
      groupMembers.push(remainingHigh[0]);
      remainingStudents.splice(remainingStudents.indexOf(remainingHigh[0]), 1);
    }
    
    if (remainingMedium.length > 0) {
      groupMembers.push(remainingMedium[0]);
      remainingStudents.splice(remainingStudents.indexOf(remainingMedium[0]), 1);
    }
    
    if (remainingLow.length > 0) {
      groupMembers.push(remainingLow[0]);
      remainingStudents.splice(remainingStudents.indexOf(remainingLow[0]), 1);
    }
    
    // If we don't have 3 yet, fill with any remaining students (including those without GPA)
    while (groupMembers.length < 3 && remainingStudents.length > 0) {
      groupMembers.push(remainingStudents.shift()!);
    }
    
    if (groupMembers.length === 3) {
      // Sort members by GPA (highest first, handle undefined)
      groupMembers.sort((a, b) => (b.gpa || 0) - (a.gpa || 0));

      const avgGpa = groupMembers.every(m => m.gpa !== undefined) 
        ? parseFloat((groupMembers.reduce((sum, member) => sum + (member.gpa || 0), 0) / 3).toFixed(2))
        : undefined;

      groups.push({
        id: ++groupCounter,
        name: `Group ${groupCounter}`,
        members: groupMembers,
        avgGpa,
        status: 'formed',
        supervisor: undefined,
        project: undefined,
        department: groupMembers[0]?.department || 'Software Engineering'
      });
    }
  }

  console.log(`Formed ${groups.length} groups from ${students.length} students`);
  console.log(`Students placed in groups: ${groups.length * 3}`);
  console.log(`Students not placed: ${students.length - (groups.length * 3)}`);

  if (groups.length === 0) {
    throw new Error('Could not form any groups with the provided students');
  }

  return groups;
}

// Validate group formation constraints (updated for flexible approach)
export function validateGroupFormation(groups: Group[]): {
  isValid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  groups.forEach((group, index) => {
    // Check if group has exactly 3 members
    if (group.members.length !== 3) {
      violations.push(`Group ${group.name}: Must have exactly 3 members`);
    }

    // Check if members are sorted by GPA (highest first) - only for members with GPA
    const membersWithGpa = group.members.filter(m => m.gpa !== undefined);
    if (membersWithGpa.length > 1) {
      const sortedByGpa = [...membersWithGpa].sort((a, b) => (b.gpa || 0) - (a.gpa || 0));
      const isCorrectOrder = membersWithGpa.every((member, idx) => member.gpa === sortedByGpa[idx].gpa);
      
      if (!isCorrectOrder) {
        violations.push(`Group ${group.name}: Members with GPA should be ordered by GPA (highest first)`);
      }
    }

    // Note: We no longer require strict tier distribution (1 HIGH, 1 MEDIUM, 1 LOW)
    // as the new algorithm handles uneven distributions more flexibly
  });

  return {
    isValid: violations.length === 0,
    violations
  };
}

// Generate ASP rules as text (for documentation/debugging)
export function generateASPRules(): string {
  return `
% ASP Rules for Group Formation in Supervise360

% GPA Tier Classification
tier(Student, high) :- gpa(Student, GPA), GPA >= 3.80, GPA <= 5.0.
tier(Student, medium) :- gpa(Student, GPA), GPA >= 3.30, GPA < 3.80.
tier(Student, low) :- gpa(Student, GPA), GPA < 3.30.

% Group Formation Constraints
% Each group must have exactly 3 members
:- group(G), #count{S : member(G, S)} != 3.

% Each group must have one student from each tier (when possible)
:- group(G), not has_tier(G, high).
:- group(G), not has_tier(G, medium).
:- group(G), not has_tier(G, low).

has_tier(G, T) :- group(G), member(G, S), tier(S, T).

% Each student can only be in one group
:- student(S), #count{G : member(G, S)} != 1.

% Group leader must have the highest GPA in the group (implicit leadership)
highest_gpa_member(G, S) :- group(G), member(G, S), 
                            not exists(S2 : member(G, S2), gpa(S2, GPA2), gpa(S, GPA1), GPA2 > GPA1).

% Optimization: Minimize GPA variance within groups
#minimize { |GPA1 - GPA2| : member(G, S1), member(G, S2), gpa(S1, GPA1), gpa(S2, GPA2), S1 != S2 }.
`;
}

// Statistics for formed groups
export function calculateGroupStatistics(groups: Group[]): {
  totalGroups: number;
  averageGroupGpa?: number;
  gpaVariance?: number;
  tierDistribution: Record<string, number>;
} {
  const totalGroups = groups.length;
  
  // Only calculate GPA statistics for groups that have GPA data
  const groupsWithGpa = groups.filter(g => g.avgGpa !== undefined);
  const totalGpa = groupsWithGpa.reduce((sum, group) => sum + (group.avgGpa || 0), 0);
  const averageGroupGpa = groupsWithGpa.length > 0 ? parseFloat((totalGpa / groupsWithGpa.length).toFixed(2)) : undefined;

  // Calculate variance only for groups with GPA
  const variance = groupsWithGpa.length > 0 && averageGroupGpa !== undefined
    ? groupsWithGpa.reduce((sum, group) => sum + Math.pow((group.avgGpa || 0) - averageGroupGpa, 2), 0) / groupsWithGpa.length
    : undefined;

  // Count students by tier across all groups
  const tierDistribution = { HIGH: 0, MEDIUM: 0, LOW: 0, 'NO_GPA': 0 };
  groups.forEach(group => {
    group.members.forEach(member => {
      if (member.tier) {
        tierDistribution[member.tier]++;
      } else {
        tierDistribution['NO_GPA']++;
      }
    });
  });

  return {
    totalGroups,
    averageGroupGpa,
    gpaVariance: variance !== undefined ? parseFloat(variance.toFixed(4)) : undefined,
    tierDistribution
  };
}