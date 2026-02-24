import { Pool } from 'mysql2/promise';

export interface StudentData {
  name: string;
  gpa: number;
  tier: 'HIGH' | 'MEDIUM' | 'LOW';
  department?: string;
  student_id?: string;
}

export interface GroupData {
  id?: number;
  name: string;
  members: StudentData[];
  avg_gpa: number;
  status: 'formed' | 'active';
  supervisor_id?: number;
  supervisor?: string | null;
  department?: string;
  project_id?: number;
}

export class GroupFormationService {
  constructor(private db: Pool) {}

  // Get GPA tier thresholds for a department (or global defaults)
  // IMPORTANT: This method ALWAYS fetches fresh data from the database
  // to ensure it uses the latest threshold settings
  async getGpaTierThresholds(department?: string): Promise<{ high: number; medium: number; low: number }> {
    try {
      console.log(`🔍 [FRESH FETCH] Fetching GPA thresholds for department: ${department || 'global'}`);
      
      // Try to get department-specific settings first
      if (department) {
        const [deptRows] = await this.db.execute(
          `SELECT use_custom_thresholds, gpa_tier_high_min, gpa_tier_medium_min, gpa_tier_low_min 
           FROM department_settings 
           WHERE department = ?`,
          [department]
        );

        if ((deptRows as any[]).length > 0) {
          const settings = (deptRows as any[])[0];
          // Check if department uses custom thresholds
          const useCustom = settings.use_custom_thresholds === 1 || settings.use_custom_thresholds === true;
          
          if (useCustom && settings.gpa_tier_high_min !== null && settings.gpa_tier_high_min !== undefined) {
            // Parse values - use nullish coalescing only for null/undefined, NOT for 0
            const high = settings.gpa_tier_high_min !== null ? parseFloat(settings.gpa_tier_high_min) : null;
            const medium = settings.gpa_tier_medium_min !== null ? parseFloat(settings.gpa_tier_medium_min) : null;
            const low = settings.gpa_tier_low_min !== null ? parseFloat(settings.gpa_tier_low_min) : null;
            
            // Only proceed if all values are valid numbers
            if (high !== null && !isNaN(high) && medium !== null && !isNaN(medium) && low !== null && !isNaN(low)) {
              const thresholds = { high, medium, low };
              console.log(`✅ [DEPARTMENT] Using department-specific thresholds for ${department}:`, thresholds);
              return thresholds;
            } else {
              console.log(`⚠️  Department ${department} has invalid threshold values, falling back to global`);
            }
          } else {
            console.log(`ℹ️  Department ${department} exists but doesn't use custom thresholds, falling back to global`);
          }
        } else {
          console.log(`ℹ️  No department settings found for ${department}, using global thresholds`);
        }
      }

      // Fall back to global settings - ALWAYS fetch fresh from database
      console.log('📊 [FRESH FETCH] Fetching global thresholds from system_settings...');
      const [globalRows] = await this.db.execute(
        `SELECT setting_key, setting_value 
         FROM system_settings 
         WHERE setting_key IN ('gpa_tier_high_min', 'gpa_tier_medium_min', 'gpa_tier_low_min')`
      );

      // Build thresholds object from database results
      const thresholds: { high?: number; medium?: number; low?: number } = {};
      
      (globalRows as any[]).forEach((row) => {
        const key = row.setting_key.replace('gpa_tier_', '').replace('_min', '');
        const value = parseFloat(row.setting_value);
        if (!isNaN(value)) {
          thresholds[key as 'high' | 'medium' | 'low'] = value;
        }
      });

      // Validate that we have all three thresholds from database
      if (thresholds.high !== undefined && thresholds.medium !== undefined && thresholds.low !== undefined) {
        console.log(`✅ [GLOBAL] Using global thresholds from database:`, thresholds);
        return thresholds as { high: number; medium: number; low: number };
      } else {
        console.error(`❌ [ERROR] Missing threshold values in database. Found:`, thresholds);
        console.error(`   This should not happen if database is properly initialized.`);
        // Only use defaults if database query failed or returned incomplete data
        const defaults = { high: 3.80, medium: 3.30, low: 0.00 };
        console.warn(`⚠️  Using fallback defaults:`, defaults);
        return defaults;
      }
    } catch (error) {
      console.error('❌ [ERROR] Exception fetching GPA thresholds:', error);
      // Only use defaults on actual error
      const defaults = { high: 3.80, medium: 3.30, low: 0.00 };
      console.warn(`⚠️  Using fallback defaults due to error:`, defaults);
      return defaults;
    }
  }

  // Classify GPA into tiers based on dynamic thresholds
  classifyGpaTier(gpa: number, thresholds: { high: number; medium: number; low: number }): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (gpa >= thresholds.high && gpa <= 5.0) return 'HIGH';
    if (gpa >= thresholds.medium && gpa < thresholds.high) return 'MEDIUM';
    return 'LOW';
  }

  // Process uploaded student data
  async processStudentData(rawData: any[], departmentParam?: string): Promise<StudentData[]> {
    console.log('🔍 [PROCESS STUDENTS] Processing student data. Sample student object:', rawData[0]);
    console.log('🔍 [PROCESS STUDENTS] Available keys in first student:', Object.keys(rawData[0] || {}));
    console.log('🔍 [PROCESS STUDENTS] Department parameter:', departmentParam || 'not provided');
    
    // Get thresholds for this department - use the parameter passed to function
    const thresholds = await this.getGpaTierThresholds(departmentParam);
    console.log(`📊 [PROCESS STUDENTS] Using GPA thresholds for ${departmentParam || 'global'}:`, thresholds);
    
    return rawData.map((student, index) => {
      // Handle both raw CSV data and pre-processed frontend data
      let name, gpa, studentId, studentDepartment;
      
      // Extract name - try multiple variations
      name = student.name || student.Name || student.NAME || 
             student.student_name || student.StudentName || student['Student Name'];
      
      // Extract GPA - try multiple variations and log what we find
      const gpaValue = student.gpa || student.GPA || student.Gpa || 
                       student.cgpa || student.CGPA || student.Cgpa ||
                       student.grade || student.Grade || student.GRADE ||
                       student['GPA'] || student['CGPA'] || student['Grade'];
      
      if (index === 0) {
        console.log('🔍 First student GPA extraction:');
        console.log('   - student.gpa:', student.gpa);
        console.log('   - student.GPA:', student.GPA);
        console.log('   - student.cgpa:', student.cgpa);
        console.log('   - student.CGPA:', student.CGPA);
        console.log('   - Extracted gpaValue:', gpaValue);
      }
      
      // Parse GPA
      gpa = parseFloat(gpaValue);
      
      // If GPA is still NaN, try to find any numeric value in the object
      if (isNaN(gpa)) {
        console.warn(`⚠️  Could not parse GPA for ${name}. Student object:`, student);
        // Try to find any numeric field
        for (const key of Object.keys(student)) {
          const value = parseFloat(student[key]);
          if (!isNaN(value) && value >= 0 && value <= 5.0) {
            console.log(`   Found potential GPA in field "${key}": ${value}`);
            gpa = value;
            break;
          }
        }
      }
      
      // If still NaN, default to 0
      if (isNaN(gpa)) {
        console.error(`❌ No valid GPA found for ${name}, defaulting to 0`);
        gpa = 0;
      }
      
      // Extract student ID (matric number) - support various CSV column names
      studentId = student.matricNumber || student.matric_number || student.MatricNumber ||
                  student.Matric_Number || student.student_id || student.StudentId ||
                  student.ID || student.id;
      
      // Extract department from student data, fallback to function parameter, then default
      studentDepartment = student.department || student.Department || student.DEPARTMENT || departmentParam || 'Computer Science';
      
      // Classify tier using dynamic thresholds (fetched fresh from database)
      const tier = this.classifyGpaTier(gpa, thresholds);
      
      if (index < 3) { // Log first 3 students for debugging
        console.log(`📊 [PROCESS STUDENTS] Student ${index + 1}: ${name} (GPA: ${gpa}) → ${tier} (thresholds: H≥${thresholds.high}, M≥${thresholds.medium}, L≥${thresholds.low})`);
      }
      
      return {
        name,
        gpa,
        tier,
        department: studentDepartment,
        student_id: studentId
      };
    });
  }

  // ASP-based group formation algorithm with flexible fallback strategies
  // CRITICAL: No student is ever excluded. Leftover 2 → H+M or H+L only. Leftover 1 → HIGH tier only (rebalance if needed).
  async formGroupsUsingASP(students: StudentData[], department?: string): Promise<GroupData[]> {
    console.log('🔍 ASP Group Formation - Input students:', students.length);
    
    // Get thresholds for logging purposes - ALWAYS fetch fresh
    const thresholds = await this.getGpaTierThresholds(department);
    console.log(`📊 [ASP GROUP FORMATION] Using GPA thresholds: HIGH≥${thresholds.high}, MEDIUM≥${thresholds.medium}, LOW≥${thresholds.low}`);
    console.log(`📊 [ASP GROUP FORMATION] Department: ${department || 'global'}`);
    
    if (students.length < 1) {
      throw new Error('Cannot form groups: Need at least 1 student.');
    }
    
    // Separate students by tier (already classified by processStudentData using current thresholds)
    const highTier = students.filter(s => s.tier === 'HIGH');
    const mediumTier = students.filter(s => s.tier === 'MEDIUM');
    const lowTier = students.filter(s => s.tier === 'LOW');

    console.log('📊 [ASP GROUP FORMATION] Tier distribution:');
    console.log(`   HIGH (≥${thresholds.high}): ${highTier.length} students`);
    console.log(`   MEDIUM (≥${thresholds.medium}): ${mediumTier.length} students`);
    console.log(`   LOW (≥${thresholds.low}): ${lowTier.length} students`);
    
    // Log students in each tier
    console.log('👥 HIGH tier students:', highTier.map(s => `${s.name} (${s.gpa})`));
    console.log('👥 MEDIUM tier students:', mediumTier.map(s => `${s.name} (${s.gpa})`));
    console.log('👥 LOW tier students:', lowTier.map(s => `${s.name} (${s.gpa})`));

    const groups: GroupData[] = [];
    let groupCounter = 1; // Changed from 0 to 1 for numbering

    // Sort students by GPA within each tier for optimal distribution
    highTier.sort((a, b) => b.gpa - a.gpa);
    mediumTier.sort((a, b) => b.gpa - a.gpa);
    lowTier.sort((a, b) => b.gpa - a.gpa);

    // Create a pool of all students for flexible assignment
    const usedStudents = new Set<string>();

    // STRATEGY 1: Form ideal groups (1 HIGH + 1 MEDIUM + 1 LOW) when possible
    const idealGroups = Math.min(highTier.length, mediumTier.length, lowTier.length);
    
    console.log(`🎯 Strategy 1: Can form ${idealGroups} ideal groups (1 HIGH + 1 MEDIUM + 1 LOW each)`);
    
    for (let i = 0; i < idealGroups; i++) {
      const groupMembers = [highTier[i], mediumTier[i], lowTier[i]];
      
      // Mark students as used
      groupMembers.forEach(student => usedStudents.add(student.name));
      
      console.log(`🏗️  Forming Group ${groupCounter}:`);
      console.log(`   👑 LEADER (HIGH): ${groupMembers[0].name} (${groupMembers[0].gpa})`);
      console.log(`   👥 MEMBER (MEDIUM): ${groupMembers[1].name} (${groupMembers[1].gpa})`);
      console.log(`   👥 MEMBER (LOW): ${groupMembers[2].name} (${groupMembers[2].gpa})`);

      const avgGpa = parseFloat(
        (groupMembers.reduce((sum, member) => sum + member.gpa, 0) / 3).toFixed(2)
      );

      groups.push({
        name: `Group ${groupCounter}`, // Changed from letter to number
        members: groupMembers, // Keep tier order: HIGH, MEDIUM, LOW
        avg_gpa: avgGpa,
        status: 'formed'
      });
      
      groupCounter++;
    }

    // STRATEGY 2: Handle remaining students with BALANCED tier distribution
    const remainingHigh = highTier.filter(s => !usedStudents.has(s.name));
    const remainingMedium = mediumTier.filter(s => !usedStudents.has(s.name));
    const remainingLow = lowTier.filter(s => !usedStudents.has(s.name));
    
    console.log(`🔄 Strategy 2: Remaining students - HIGH: ${remainingHigh.length}, MEDIUM: ${remainingMedium.length}, LOW: ${remainingLow.length}`);

    // Form one H+H+x group early when possible - ensures we have a donor for rebalancing 2-remainder (M+L) or 1-remainder (M/L)
    const totalRemaining = remainingHigh.length + remainingMedium.length + remainingLow.length;
    if (totalRemaining >= 4 && totalRemaining % 3 !== 0 && remainingHigh.length >= 2) {
      if (remainingMedium.length >= 1) {
        const groupMembers = [remainingHigh.shift()!, remainingHigh.shift()!, remainingMedium.shift()!];
        groupMembers.forEach(s => usedStudents.add(s.name));
        groupMembers.sort((a, b) => b.gpa - a.gpa);
        const avgGpa = parseFloat((groupMembers.reduce((s, m) => s + m.gpa, 0) / 3).toFixed(2));
        groups.push({ name: `Group ${groupCounter}`, members: groupMembers, avg_gpa: avgGpa, status: 'formed' });
        console.log(`   📋 Pre-formed H+H+M (donor for possible solo remainder)`);
        groupCounter++;
      } else if (remainingLow.length >= 1) {
        const groupMembers = [remainingHigh.shift()!, remainingHigh.shift()!, remainingLow.shift()!];
        groupMembers.forEach(s => usedStudents.add(s.name));
        groupMembers.sort((a, b) => b.gpa - a.gpa);
        const avgGpa = parseFloat((groupMembers.reduce((s, m) => s + m.gpa, 0) / 3).toFixed(2));
        groups.push({ name: `Group ${groupCounter}`, members: groupMembers, avg_gpa: avgGpa, status: 'formed' });
        console.log(`   📋 Pre-formed H+H+L (donor for possible solo remainder)`);
        groupCounter++;
      }
    }

    // Try to form balanced groups from remaining students
    while (remainingHigh.length + remainingMedium.length + remainingLow.length >= 3) {
      const groupMembers: StudentData[] = [];
      
      // Priority 1: Try to get one from each tier (H,M,L)
      if (remainingHigh.length > 0 && remainingMedium.length > 0 && remainingLow.length > 0) {
        groupMembers.push(remainingHigh.shift()!);
        groupMembers.push(remainingMedium.shift()!);
        groupMembers.push(remainingLow.shift()!);
        console.log(`   📋 Balanced group (H,M,L)`);
      }
      // Priority 2: Two from one tier, one from another (prefer H,M,M or H,H,M over same tier)
      else if (remainingHigh.length >= 1 && remainingMedium.length >= 2) {
        groupMembers.push(remainingHigh.shift()!);
        groupMembers.push(remainingMedium.shift()!);
        groupMembers.push(remainingMedium.shift()!);
        console.log(`   📋 Mixed group (H,M,M)`);
      }
      else if (remainingHigh.length >= 2 && remainingMedium.length >= 1) {
        groupMembers.push(remainingHigh.shift()!);
        groupMembers.push(remainingHigh.shift()!);
        groupMembers.push(remainingMedium.shift()!);
        console.log(`   📋 Mixed group (H,H,M)`);
      }
      else if (remainingMedium.length >= 1 && remainingLow.length >= 2) {
        groupMembers.push(remainingMedium.shift()!);
        groupMembers.push(remainingLow.shift()!);
        groupMembers.push(remainingLow.shift()!);
        console.log(`   📋 Mixed group (M,L,L)`);
      }
      else if (remainingMedium.length >= 2 && remainingLow.length >= 1) {
        groupMembers.push(remainingMedium.shift()!);
        groupMembers.push(remainingMedium.shift()!);
        groupMembers.push(remainingLow.shift()!);
        console.log(`   📋 Mixed group (M,M,L)`);
      }
      else if (remainingHigh.length >= 1 && remainingLow.length >= 2) {
        groupMembers.push(remainingHigh.shift()!);
        groupMembers.push(remainingLow.shift()!);
        groupMembers.push(remainingLow.shift()!);
        console.log(`   📋 Mixed group (H,L,L)`);
      }
      else if (remainingHigh.length >= 2 && remainingLow.length >= 1) {
        groupMembers.push(remainingHigh.shift()!);
        groupMembers.push(remainingHigh.shift()!);
        groupMembers.push(remainingLow.shift()!);
        console.log(`   📋 Mixed group (H,H,L)`);
      }
      // Last resort: Same tier groups (only if no other option)
      else if (remainingHigh.length >= 3) {
        groupMembers.push(remainingHigh.shift()!);
        groupMembers.push(remainingHigh.shift()!);
        groupMembers.push(remainingHigh.shift()!);
        console.log(`   ⚠️  Same tier group (H,H,H) - not ideal`);
      }
      else if (remainingMedium.length >= 3) {
        groupMembers.push(remainingMedium.shift()!);
        groupMembers.push(remainingMedium.shift()!);
        groupMembers.push(remainingMedium.shift()!);
        console.log(`   ⚠️  Same tier group (M,M,M) - not ideal`);
      }
      else if (remainingLow.length >= 3) {
        groupMembers.push(remainingLow.shift()!);
        groupMembers.push(remainingLow.shift()!);
        groupMembers.push(remainingLow.shift()!);
        console.log(`   ⚠️  Same tier group (L,L,L) - not ideal`);
      }
      else {
        // Can't form a complete group of 3 - will handle remainder below
        break;
      }
      
      if (groupMembers.length === 3) {
        // Sort by GPA (highest first) for consistent leader assignment
        groupMembers.sort((a, b) => b.gpa - a.gpa);
        
        console.log(`🏗️  Forming Group ${groupCounter}:`);
        console.log(`   👑 LEADER: ${groupMembers[0].name} (${groupMembers[0].gpa}) - ${groupMembers[0].tier}`);
        console.log(`   👥 MEMBER: ${groupMembers[1].name} (${groupMembers[1].gpa}) - ${groupMembers[1].tier}`);
        console.log(`   👥 MEMBER: ${groupMembers[2].name} (${groupMembers[2].gpa}) - ${groupMembers[2].tier}`);

        const avgGpa = parseFloat(
          (groupMembers.reduce((sum, member) => sum + member.gpa, 0) / 3).toFixed(2)
        );

        groups.push({
          name: `Group ${groupCounter}`,
          members: groupMembers,
          avg_gpa: avgGpa,
          status: 'formed'
        });
        
        groupCounter++;
      }
    }

    // REMAINDER HANDLING: No student left behind. All must be grouped.
    const remainder = [...remainingHigh, ...remainingMedium, ...remainingLow];

    if (remainder.length === 2) {
      // Allowed: H+M only. NOT H+L, M+L, or L+L.
      const [a, b] = remainder;
      const tiers = [a.tier, b.tier].sort().join('+');
      const validPairs = ['HIGH+MEDIUM'];
      if (validPairs.includes(tiers)) {
        const pair = remainder.sort((x, y) => (x.gpa >= y.gpa ? -1 : 1));
        const avgGpa = parseFloat(((pair[0].gpa + pair[1].gpa) / 2).toFixed(2));
        groups.push({ name: `Group ${groupCounter}`, members: pair, avg_gpa: avgGpa, status: 'formed' });
        console.log(`🏗️  Forming Group ${groupCounter} (2-member H+M): ${pair[0].name} (${pair[0].tier}) + ${pair[1].name} (${pair[1].tier})`);
        groupCounter++;
      } else {
        // H+L, M+L, or L+L: must rebalance. Only H+M allowed for 2-member.
        // H+L: borrow M from group with H+H+M, form H+M, add our L to donor -> H+H+L
        // M+L: borrow H from group with 2+ H, form H+M
        // L+L: borrow H from group with 2+ H, form H+L+L (3-member)
        const isHL = tiers === 'HIGH+LOW' || tiers === 'LOW+HIGH';
        const isLL = tiers === 'LOW+LOW';
        let donorGroup = groups.find(g => g.members.filter(m => m.tier === 'HIGH').length >= 2 && g.members.some(m => m.tier === 'MEDIUM'));
        if (isHL && donorGroup) {
          const donorMembers = [...donorGroup.members];
          const mIdx = donorMembers.findIndex(m => m.tier === 'MEDIUM');
          const borrowedM = donorMembers.splice(mIdx, 1)[0];
          const ourH = remainder.find(r => r.tier === 'HIGH')!;
          const ourL = remainder.find(r => r.tier === 'LOW')!;
          const pair = [ourH, borrowedM].sort((x, y) => (x.gpa >= y.gpa ? -1 : 1));
          const avgGpa = parseFloat((pair.reduce((s, m) => s + m.gpa, 0) / 2).toFixed(2));
          groups.push({ name: `Group ${groupCounter}`, members: pair, avg_gpa: avgGpa, status: 'formed' });
          groupCounter++;
          donorMembers.push(ourL);
          donorGroup.members = donorMembers.sort((x, y) => (y.gpa >= x.gpa ? 1 : -1));
          donorGroup.avg_gpa = parseFloat((donorMembers.reduce((s, m) => s + m.gpa, 0) / donorMembers.length).toFixed(2));
          console.log(`🏗️  Rebalanced H+L: formed H+M, added L to donor -> H+H+L`);
        } else {
          donorGroup = groups.find(g => g.members.filter(m => m.tier === 'HIGH').length >= 2);
          if (donorGroup) {
            const donorMembers = [...donorGroup.members];
            const hIdx = donorMembers.findIndex(m => m.tier === 'HIGH');
            const borrowedH = donorMembers.splice(hIdx, 1)[0];
            if (isLL) {
              const trio = [borrowedH, ...remainder].sort((x, y) => (y.gpa >= x.gpa ? 1 : -1));
              const avgGpa = parseFloat((trio.reduce((s, m) => s + m.gpa, 0) / 3).toFixed(2));
              groups.push({ name: `Group ${groupCounter}`, members: trio, avg_gpa: avgGpa, status: 'formed' });
              groupCounter++;
              console.log(`🏗️  Rebalanced L+L: borrowed H, formed H+L+L (3-member)`);
            } else {
              const pair = [borrowedH, ...remainder].sort((x, y) => (x.gpa >= y.gpa ? -1 : 1));
              const avgGpa = parseFloat((pair.reduce((s, m) => s + m.gpa, 0) / 2).toFixed(2));
              groups.push({ name: `Group ${groupCounter}`, members: pair, avg_gpa: avgGpa, status: 'formed' });
              groupCounter++;
              console.log(`🏗️  Rebalanced M+L: formed H+M, donor now has 2`);
            }
            donorGroup.members = donorMembers;
            donorGroup.avg_gpa = parseFloat((donorMembers.reduce((s, m) => s + m.gpa, 0) / donorMembers.length).toFixed(2));
          } else {
            throw new Error(`Cannot form valid 2-member group: remainder ${a.tier}+${b.tier}. Only H+M allowed. No suitable donor group to rebalance.`);
          }
        }
      }
    } else if (remainder.length === 1) {
      const solo = remainder[0];
      if (solo.tier === 'HIGH') {
        groups.push({
          name: `Group ${groupCounter}`,
          members: [solo],
          avg_gpa: solo.gpa,
          status: 'formed'
        });
        console.log(`🏗️  Forming Group ${groupCounter} (1-member HIGH): ${solo.name} (${solo.gpa})`);
        groupCounter++;
      } else {
        // M or L alone: NOT allowed. Rebalance - borrow H from a group with 2+ HIGH.
        const donorGroup = groups.find(g => g.members.filter(m => m.tier === 'HIGH').length >= 2);
        if (donorGroup) {
          const donorMembers = [...donorGroup.members];
          const hIdx = donorMembers.findIndex(m => m.tier === 'HIGH');
          const borrowedH = donorMembers.splice(hIdx, 1)[0];
          const pair = [borrowedH, solo].sort((x, y) => (x.gpa >= y.gpa ? -1 : 1));
          const avgGpa = parseFloat((pair.reduce((s, m) => s + m.gpa, 0) / 2).toFixed(2));
          groups.push({ name: `Group ${groupCounter}`, members: pair, avg_gpa: avgGpa, status: 'formed' });
          groupCounter++;
          donorGroup.members = donorMembers;
          donorGroup.avg_gpa = parseFloat((donorMembers.reduce((s, m) => s + m.gpa, 0) / donorMembers.length).toFixed(2));
          console.log(`🏗️  Rebalanced: solo ${solo.tier} paired with H from donor. Group ${groupCounter - 1} (2-member).`);
        } else {
          throw new Error(`Cannot form valid group: 1 remaining student (${solo.name}) is ${solo.tier} tier. Only HIGH tier may be in a 1-member group. No group with 2+ HIGH to rebalance.`);
        }
      }
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

  // Save groups to database
  async saveGroupsToDatabase(groups: GroupData[]): Promise<number[]> {
    const connection = await this.db.getConnection();
    const groupIds: number[] = [];

    try {
      await connection.beginTransaction();

      for (const group of groups) {
        // Get department from first member or default
        const department = group.members[0]?.department || 'Software Engineering';
        
        // Insert group into project_groups table (not 'groups' which is reserved)
        const [groupResult] = await connection.execute(
          `INSERT INTO project_groups (name, avg_gpa, status, department, formation_method, formation_date, created_at) 
           VALUES (?, ?, ?, ?, 'asp', NOW(), NOW())`,
          [group.name, group.avg_gpa, group.status, department]
        );

        const groupId = (groupResult as any).insertId;
        groupIds.push(groupId);

        // Insert group members in TIER ORDER (HIGH, MEDIUM, LOW) - NOT by GPA
        // This ensures the HIGH tier student is always first (leader)
        // Use matric number (student_id) as primary identifier for uniqueness
        for (let i = 0; i < group.members.length; i++) {
          const member = group.members[i]; // Already in tier order
          const matricNumber = member.student_id || null;
          await connection.execute(
            `INSERT INTO group_members (group_id, student_name, student_gpa, gpa_tier, member_order, matric_number) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [groupId, member.name, member.gpa, member.tier, i + 1, matricNumber]
          );
        }
      }

      await connection.commit();
      console.log(`✅ Saved ${groups.length} groups to database with departments`);
      return groupIds;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get a student's group by their matric number (primary identifier)
  async getGroupByMatricNumber(matricNumber: string): Promise<GroupData | null> {
    if (!matricNumber || matricNumber.trim() === '') {
      return null;
    }

    const connection = await this.db.getConnection();
    try {
      const trimmed = matricNumber.trim();
      const [rows] = await connection.execute(
        `SELECT gm.group_id FROM group_members gm 
         WHERE gm.matric_number = ? OR TRIM(COALESCE(gm.matric_number,'')) = ?
         LIMIT 1`,
        [trimmed, trimmed]
      );

      const memberRows = rows as any[];
      if (memberRows.length === 0) {
        return null;
      }

      const groupId = memberRows[0].group_id;
      const allGroups = await this.getAllGroups();
      return allGroups.find(g => g.id === groupId) || null;
    } catch (error) {
      console.error('Error fetching group by matric:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get all groups with members
  async getAllGroups(): Promise<GroupData[]> {
    const connection = await this.db.getConnection();

    try {
      console.log('🔍 Getting database connection for getAllGroups');
      
      const [groupRows] = await connection.execute(`
        SELECT g.*, 
               COUNT(gm.id) as member_count
        FROM project_groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id
        GROUP BY g.id
        ORDER BY g.created_at DESC
      `);

      console.log('✅ Groups query executed, found:', (groupRows as any[]).length, 'groups');

      const groups: GroupData[] = [];

      for (const group of groupRows as any[]) {
        console.log('🔍 Processing group:', group.id, group.name);
        
        // Get group members ordered by TIER ORDER (member_order) - HIGH, MEDIUM, LOW
        const [memberRows] = await connection.execute(
          `SELECT * FROM group_members WHERE group_id = ? ORDER BY member_order ASC`,
          [group.id]
        );

        console.log('✅ Found', (memberRows as any[]).length, 'members for group', group.id);

        const members = (memberRows as any[]).map(member => ({
          id: member.id,
          name: member.student_name,
          gpa: member.student_gpa,
          tier: member.gpa_tier as 'HIGH' | 'MEDIUM' | 'LOW',
          matricNumber: member.matric_number || member.student_id || null
        }));

        groups.push({
          id: group.id,
          name: group.name,
          members,
          avg_gpa: group.avg_gpa,
          status: group.status,
          supervisor_id: group.supervisor_id,
          supervisor: group.supervisor_name || null, // supervisor_name from project_groups table
          department: group.department
        });
        
        // Log first group to verify supervisor is included
        if (groups.length === 1) {
          console.log('📋 First group data:', {
            id: group.id,
            name: group.name,
            supervisor_name: group.supervisor_name,
            supervisor_id: group.supervisor_id,
            department: group.department
          });
        }
      }

      console.log('✅ getAllGroups completed, returning', groups.length, 'groups');
      return groups;
    } catch (error) {
      console.error('❌ Error in getAllGroups:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Validate group formation constraints
  validateGroupFormation(groups: GroupData[]): {
    isValid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    groups.forEach((group) => {
      const n = group.members.length;
      if (n < 1 || n > 3) {
        violations.push(`Group ${group.name}: Must have 1, 2, or 3 members`);
      }

      const tiers = group.members.map(m => m.tier);
      const hasInvalidTiers = tiers.some(tier => !['HIGH', 'MEDIUM', 'LOW'].includes(tier));
      if (hasInvalidTiers) {
        violations.push(`Group ${group.name}: All members must have valid tier classification (HIGH, MEDIUM, or LOW)`);
      }

      // 2-member groups: only H+M allowed (not H+L, M+L, or L+L)
      if (n === 2) {
        const combo = [...tiers].sort().join('+');
        if (combo !== 'HIGH+MEDIUM') {
          violations.push(`Group ${group.name}: 2-member groups must be H+M only (got ${combo})`);
        }
      }

      // 1-member groups: only HIGH tier allowed
      if (n === 1 && tiers[0] !== 'HIGH') {
        violations.push(`Group ${group.name}: 1-member groups must have HIGH tier student only`);
      }
    });

    return {
      isValid: violations.length === 0,
      violations
    };
  }

  // Calculate statistics for formed groups
  calculateGroupStatistics(groups: GroupData[]): {
    totalGroups: number;
    averageGroupGpa: number;
    gpaVariance: number;
    tierDistribution: Record<string, number>;
  } {
    const totalGroups = groups.length;
    const totalGpa = groups.reduce((sum, group) => sum + group.avg_gpa, 0);
    const averageGroupGpa = totalGroups > 0 ? parseFloat((totalGpa / totalGroups).toFixed(2)) : 0;

    // Calculate variance
    const variance = totalGroups > 0 
      ? groups.reduce((sum, group) => sum + Math.pow(group.avg_gpa - averageGroupGpa, 2), 0) / totalGroups
      : 0;

    // Count students by tier across all groups
    const tierDistribution = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    groups.forEach(group => {
      group.members.forEach(member => {
        tierDistribution[member.tier]++;
      });
    });

    return {
      totalGroups,
      averageGroupGpa,
      gpaVariance: parseFloat(variance.toFixed(4)),
      tierDistribution
    };
  }
}
