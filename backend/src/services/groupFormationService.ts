import { Pool } from 'mysql2/promise';
import { tryGroupFormationWithClingo } from './asp/aspEncodings';

export interface StudentData {
  name: string;
  gpa: number;
  tier: 'HIGH' | 'MEDIUM' | 'LOW';
  department?: string;
  student_id?: string;
  email?: string | null;
  phone?: string | null;
  /** Unique key for tracking used students (avoids losing students with duplicate names) */
  _key?: string;
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
  session_id?: number;
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
                  student.Matric_Number || student['Matric Number'] || student['matric_number'] ||
                  student.student_id || student.StudentId || student.ID || student.id;
      
      // Extract department from student data, fallback to function parameter, then default
      studentDepartment = student.department || student.Department || student.DEPARTMENT || departmentParam || 'Computer Science';
      
      // Classify tier using dynamic thresholds (fetched fresh from database)
      const tier = this.classifyGpaTier(gpa, thresholds);
      
      if (index < 3) { // Log first 3 students for debugging
        console.log(`📊 [PROCESS STUDENTS] Student ${index + 1}: ${name} (GPA: ${gpa}) → ${tier} (thresholds: H≥${thresholds.high}, M≥${thresholds.medium}, L≥${thresholds.low})`);
      }
      
      const emailRaw =
        student.email ||
        student.Email ||
        student.EMAIL ||
        student['E-mail'] ||
        student['Email Address'];
      const phoneRaw =
        student.phone ||
        student.Phone ||
        student.PHONE ||
        student['Phone Number'] ||
        student.telephone ||
        student.mobile;
      const email = emailRaw != null && String(emailRaw).trim() ? String(emailRaw).trim() : null;
      const phone = phoneRaw != null && String(phoneRaw).trim() ? String(phoneRaw).trim() : null;

      return {
        name,
        gpa,
        tier,
        department: studentDepartment,
        student_id: studentId,
        email,
        phone,
        _key: (studentId && String(studentId).trim()) ? String(studentId).trim() : `_row_${index}`
      };
    });
  }

  // Group formation: try Potassco Clingo (ASP) first; else heuristic below.
  // CRITICAL (heuristic path): No student is ever excluded. 2-member groups → H+M only; 1-member → HIGH only (rebalance as needed).
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

    const namePrefix = department ? `${department} - ` : '';
    const clingoGroups = await tryGroupFormationWithClingo(students, namePrefix);
    if (clingoGroups) {
      const v = this.validateGroupFormation(clingoGroups);
      if (v.isValid) {
        console.log('✅ [ASP] Using Clingo answer set for group formation.');
        return clingoGroups;
      }
      console.warn('⚠️  [ASP] Clingo grouping failed validation; using heuristic.', v.violations);
    }

    const groups: GroupData[] = [];
    let groupCounter = 1;

    // Sort students by GPA within each tier for optimal distribution
    highTier.sort((a, b) => b.gpa - a.gpa);
    mediumTier.sort((a, b) => b.gpa - a.gpa);
    lowTier.sort((a, b) => b.gpa - a.gpa);

    // Create a pool of all students for flexible assignment
    // Use _key (matric/student_id or row index) to avoid losing students with duplicate names
    const usedStudents = new Set<string>();
    const studentKey = (s: StudentData) => s._key || s.student_id || s.name;

    // STRATEGY 1: Form ideal groups (1 HIGH + 1 MEDIUM + 1 LOW) when possible
    const idealGroups = Math.min(highTier.length, mediumTier.length, lowTier.length);
    
    console.log(`🎯 Strategy 1: Can form ${idealGroups} ideal groups (1 HIGH + 1 MEDIUM + 1 LOW each)`);
    
    for (let i = 0; i < idealGroups; i++) {
      const groupMembers = [highTier[i], mediumTier[i], lowTier[i]];
      
      // Mark students as used (use _key to avoid losing students with duplicate names)
      groupMembers.forEach(student => usedStudents.add(studentKey(student)));
      
      console.log(`🏗️  Forming Group ${groupCounter}:`);
      console.log(`   👑 LEADER (HIGH): ${groupMembers[0].name} (${groupMembers[0].gpa})`);
      console.log(`   👥 MEMBER (MEDIUM): ${groupMembers[1].name} (${groupMembers[1].gpa})`);
      console.log(`   👥 MEMBER (LOW): ${groupMembers[2].name} (${groupMembers[2].gpa})`);

      const avgGpa = parseFloat(
        (groupMembers.reduce((sum, member) => sum + member.gpa, 0) / 3).toFixed(2)
      );

      groups.push({
        name: `${namePrefix}Group ${groupCounter}`, // Changed from letter to number
        members: groupMembers, // Keep tier order: HIGH, MEDIUM, LOW
        avg_gpa: avgGpa,
        status: 'formed'
      });
      
      groupCounter++;
    }

    // STRATEGY 2: Handle remaining students with BALANCED tier distribution
    const remainingHigh = highTier.filter(s => !usedStudents.has(studentKey(s)));
    const remainingMedium = mediumTier.filter(s => !usedStudents.has(studentKey(s)));
    const remainingLow = lowTier.filter(s => !usedStudents.has(studentKey(s)));
    
    console.log(`🔄 Strategy 2: Remaining students - HIGH: ${remainingHigh.length}, MEDIUM: ${remainingMedium.length}, LOW: ${remainingLow.length}`);

    // Form one H+H+x group early when possible - ensures we have a donor for rebalancing 2-remainder (M+L) or 1-remainder (M/L)
    const totalRemaining = remainingHigh.length + remainingMedium.length + remainingLow.length;
    if (totalRemaining >= 4 && totalRemaining % 3 !== 0 && remainingHigh.length >= 2) {
      if (remainingMedium.length >= 1) {
        const groupMembers = [remainingHigh.shift()!, remainingHigh.shift()!, remainingMedium.shift()!];
        groupMembers.forEach(s => usedStudents.add(studentKey(s)));
        groupMembers.sort((a, b) => b.gpa - a.gpa);
        const avgGpa = parseFloat((groupMembers.reduce((s, m) => s + m.gpa, 0) / 3).toFixed(2));
        groups.push({ name: `${namePrefix}Group ${groupCounter}`, members: groupMembers, avg_gpa: avgGpa, status: 'formed' });
        console.log(`   📋 Pre-formed H+H+M (donor for possible solo remainder)`);
        groupCounter++;
      } else if (remainingLow.length >= 1) {
        const groupMembers = [remainingHigh.shift()!, remainingHigh.shift()!, remainingLow.shift()!];
        groupMembers.forEach(s => usedStudents.add(studentKey(s)));
        groupMembers.sort((a, b) => b.gpa - a.gpa);
        const avgGpa = parseFloat((groupMembers.reduce((s, m) => s + m.gpa, 0) / 3).toFixed(2));
        groups.push({ name: `${namePrefix}Group ${groupCounter}`, members: groupMembers, avg_gpa: avgGpa, status: 'formed' });
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
          name: `${namePrefix}Group ${groupCounter}`,
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
      const tiers = remainder.map((r) => r.tier).sort().join('+');
      const sortedRemainder = [...remainder].sort((x, y) => (x.gpa >= y.gpa ? -1 : 1));

      const recomputeAvg = (members: StudentData[]) =>
        parseFloat((members.reduce((s, m) => s + m.gpa, 0) / members.length).toFixed(2));

      const sortByGpaDesc = (members: StudentData[]) => [...members].sort((a, b) => b.gpa - a.gpa);

      const pickLowestByTier = (members: StudentData[], tier: 'HIGH' | 'MEDIUM' | 'LOW') => {
        const candidates = members.filter((m) => m.tier === tier).sort((a, b) => a.gpa - b.gpa);
        return candidates[0] || null;
      };

      if (tiers === 'HIGH+MEDIUM') {
        const avgGpa = recomputeAvg(sortedRemainder);
        groups.push({ name: `${namePrefix}Group ${groupCounter}`, members: sortedRemainder, avg_gpa: avgGpa, status: 'formed' });
        console.log(`🏗️  Forming Group ${groupCounter} (2-member H+M): ${sortedRemainder[0].name} (${sortedRemainder[0].tier}) + ${sortedRemainder[1].name} (${sortedRemainder[1].tier})`);
        groupCounter++;
      } else if (tiers === 'HIGH+LOW') {
        // Need: convert H+L → H+M by borrowing a MEDIUM from any existing 3-member group, and placing our LOW into that donor.
        const donorGroup = groups.find((g) => g.members.length === 3 && g.members.some((m) => m.tier === 'MEDIUM'));
        if (!donorGroup) {
          throw new Error('Cannot form valid 2-member group from HIGH+LOW remainder: no 3-member donor group with a MEDIUM exists.');
        }
        const borrowedM = pickLowestByTier(donorGroup.members, 'MEDIUM');
        const ourH = sortedRemainder.find((r) => r.tier === 'HIGH')!;
        const ourL = sortedRemainder.find((r) => r.tier === 'LOW')!;
        if (!borrowedM) {
          throw new Error('Internal error: selected donor group has no MEDIUM.');
        }

        donorGroup.members = sortByGpaDesc(donorGroup.members.filter((m) => m !== borrowedM).concat([ourL]));
        donorGroup.avg_gpa = recomputeAvg(donorGroup.members);

        const pair = sortByGpaDesc([ourH, borrowedM]);
        groups.push({ name: `${namePrefix}Group ${groupCounter}`, members: pair, avg_gpa: recomputeAvg(pair), status: 'formed' });
        console.log(`🏗️  Rebalanced HIGH+LOW remainder: formed H+M, moved LOW into donor group (${donorGroup.name})`);
        groupCounter++;
      } else if (tiers === 'LOW+MEDIUM') {
        // Need: convert M+L → H+M by borrowing a HIGH from any existing 3-member group, and placing our LOW into that donor.
        const donorGroup = groups.find((g) => g.members.length === 3 && g.members.some((m) => m.tier === 'HIGH'));
        if (!donorGroup) {
          throw new Error('Cannot form valid 2-member group from MEDIUM+LOW remainder: no 3-member donor group with a HIGH exists.');
        }
        const borrowedH = pickLowestByTier(donorGroup.members, 'HIGH');
        const ourM = sortedRemainder.find((r) => r.tier === 'MEDIUM')!;
        const ourL = sortedRemainder.find((r) => r.tier === 'LOW')!;
        if (!borrowedH) {
          throw new Error('Internal error: selected donor group has no HIGH.');
        }

        donorGroup.members = sortByGpaDesc(donorGroup.members.filter((m) => m !== borrowedH).concat([ourL]));
        donorGroup.avg_gpa = recomputeAvg(donorGroup.members);

        const pair = sortByGpaDesc([borrowedH, ourM]);
        groups.push({ name: `${namePrefix}Group ${groupCounter}`, members: pair, avg_gpa: recomputeAvg(pair), status: 'formed' });
        console.log(`🏗️  Rebalanced MEDIUM+LOW remainder: formed H+M, moved LOW into donor group (${donorGroup.name})`);
        groupCounter++;
      } else if (tiers === 'HIGH+HIGH') {
        // Need: convert H+H → H+M by borrowing a MEDIUM from any existing 3-member group, and placing our extra HIGH into that donor.
        const donorGroup = groups.find((g) => g.members.length === 3 && g.members.some((m) => m.tier === 'MEDIUM'));
        if (!donorGroup) {
          throw new Error('Cannot form valid 2-member group from HIGH+HIGH remainder: no 3-member donor group with a MEDIUM exists.');
        }
        const borrowedM = pickLowestByTier(donorGroup.members, 'MEDIUM');
        const [h1, h2] = sortedRemainder;
        if (!borrowedM || !h1 || !h2) {
          throw new Error('Internal error: failed to resolve HIGH+HIGH remainder or borrowed MEDIUM.');
        }

        // Replace the borrowed MEDIUM in the donor with the extra HIGH (keep donor at 3 members)
        donorGroup.members = sortByGpaDesc(donorGroup.members.filter((m) => m !== borrowedM).concat([h2]));
        donorGroup.avg_gpa = recomputeAvg(donorGroup.members);

        const pair = sortByGpaDesc([h1, borrowedM]);
        groups.push({ name: `${namePrefix}Group ${groupCounter}`, members: pair, avg_gpa: recomputeAvg(pair), status: 'formed' });
        console.log(`🏗️  Rebalanced HIGH+HIGH remainder: formed H+M, moved extra HIGH into donor group (${donorGroup.name})`);
        groupCounter++;
      } else if (tiers === 'MEDIUM+MEDIUM') {
        // Need: convert M+M → H+M by borrowing a HIGH from any existing 3-member group, and placing our extra MEDIUM into that donor.
        const donorGroup = groups.find((g) => g.members.length === 3 && g.members.some((m) => m.tier === 'HIGH'));
        if (!donorGroup) {
          throw new Error('Cannot form valid 2-member group from MEDIUM+MEDIUM remainder: no 3-member donor group with a HIGH exists.');
        }
        const borrowedH = pickLowestByTier(donorGroup.members, 'HIGH');
        const [m1, m2] = sortedRemainder;
        if (!borrowedH || !m1 || !m2) {
          throw new Error('Internal error: failed to resolve MEDIUM+MEDIUM remainder or borrowed HIGH.');
        }

        donorGroup.members = sortByGpaDesc(donorGroup.members.filter((m) => m !== borrowedH).concat([m2]));
        donorGroup.avg_gpa = recomputeAvg(donorGroup.members);

        const pair = sortByGpaDesc([borrowedH, m1]);
        groups.push({ name: `${namePrefix}Group ${groupCounter}`, members: pair, avg_gpa: recomputeAvg(pair), status: 'formed' });
        console.log(`🏗️  Rebalanced MEDIUM+MEDIUM remainder: formed H+M, moved extra MEDIUM into donor group (${donorGroup.name})`);
        groupCounter++;
      } else if (tiers === 'LOW+LOW') {
        // Convert L+L → H+L+L by borrowing a HIGH from a donor that will become a valid 2-member H+M after removal.
        const donorGroup = groups.find(
          (g) =>
            g.members.length === 3 &&
            g.members.filter((m) => m.tier === 'HIGH').length >= 2 &&
            g.members.some((m) => m.tier === 'MEDIUM')
        );
        if (!donorGroup) {
          throw new Error('Cannot form valid groups from LOW+LOW remainder: need a donor group with tiers H+H+M to safely borrow a HIGH.');
        }
        const borrowedH = pickLowestByTier(donorGroup.members, 'HIGH');
        if (!borrowedH) {
          throw new Error('Internal error: selected donor group has no HIGH.');
        }

        donorGroup.members = sortByGpaDesc(donorGroup.members.filter((m) => m !== borrowedH));
        donorGroup.avg_gpa = recomputeAvg(donorGroup.members);

        const trio = sortByGpaDesc([borrowedH, ...sortedRemainder]);
        groups.push({ name: `${namePrefix}Group ${groupCounter}`, members: trio, avg_gpa: recomputeAvg(trio), status: 'formed' });
        console.log(`🏗️  Rebalanced LOW+LOW remainder: borrowed HIGH from ${donorGroup.name}, formed H+L+L (3-member)`);
        groupCounter++;
      } else {
        throw new Error(`Unhandled 2-student remainder tier combination: ${tiers}`);
      }
    } else if (remainder.length === 1) {
      const solo = remainder[0];
      if (solo.tier === 'HIGH') {
        if (!solo.department && department) (solo as StudentData).department = department;
        groups.push({
          name: `${namePrefix}Group ${groupCounter}`,
          members: [solo],
          avg_gpa: solo.gpa,
          status: 'formed'
        });
        console.log(`🏗️  Forming Group ${groupCounter} (1-member HIGH): ${solo.name} (${solo.gpa})`);
        groupCounter++;
      } else {
        // M or L alone: NOT allowed. 1-member groups must be HIGH tier only.
        // Try 1: Borrow H from a group with 2+ HIGH → form H+solo pair
        let donorGroup = groups.find(g => g.members.filter(m => m.tier === 'HIGH').length >= 2);
        if (donorGroup) {
          const donorMembers = [...donorGroup.members];
          const hIdx = donorMembers.findIndex(m => m.tier === 'HIGH');
          const borrowedH = donorMembers.splice(hIdx, 1)[0];
          const pair = [borrowedH, solo].sort((x, y) => (x.gpa >= y.gpa ? -1 : 1));
          const avgGpa = parseFloat((pair.reduce((s, m) => s + m.gpa, 0) / 2).toFixed(2));
          groups.push({ name: `${namePrefix}Group ${groupCounter}`, members: pair, avg_gpa: avgGpa, status: 'formed' });
          groupCounter++;
          donorGroup.members = donorMembers;
          donorGroup.avg_gpa = parseFloat((donorMembers.reduce((s, m) => s + m.gpa, 0) / donorMembers.length).toFixed(2));
          console.log(`🏗️  Rebalanced: solo ${solo.tier} paired with H from donor. Group ${groupCounter - 1} (2-member).`);
        } else {
          // Try 2: Swap solo M/L with any H from any group → group keeps 3 members, we get solo H
          donorGroup = groups.find(g => g.members.some(m => m.tier === 'HIGH'));
          if (donorGroup) {
            const donorMembers = [...donorGroup.members];
            const hIdx = donorMembers.findIndex(m => m.tier === 'HIGH');
            const swappedH = donorMembers[hIdx];
            donorMembers[hIdx] = solo; // Put our solo into the group
            donorGroup.members = donorMembers.sort((a, b) => (b.gpa >= a.gpa ? 1 : -1));
            donorGroup.avg_gpa = parseFloat((donorMembers.reduce((s, m) => s + m.gpa, 0) / donorMembers.length).toFixed(2));
            const dept = department || swappedH.department || solo.department;
            if (swappedH && !swappedH.department && dept) (swappedH as StudentData).department = dept;
            groups.push({
              name: `${namePrefix}Group ${groupCounter}`,
              members: [swappedH],
              avg_gpa: swappedH.gpa,
              status: 'formed'
            });
            groupCounter++;
            console.log(`🏗️  Swapped solo ${solo.tier} with H from group → 1-member group now has HIGH tier`);
          } else {
            throw new Error(`Cannot form groups: 1 leftover student (${solo.name}) is ${solo.tier} tier but 1-member groups require HIGH tier only. Add or remove students so the leftover is HIGH tier, or ensure at least one HIGH tier student exists.`);
          }
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

  // Clear groups for a department before forming new ones (avoids duplicates, ensures clean formation)
  async clearGroupsForDepartment(department: string, sessionId?: number | null): Promise<void> {
    const connection = await this.db.getConnection();
    try {
      if (sessionId != null) {
        await connection.execute(
          `DELETE gm FROM group_members gm
           INNER JOIN project_groups pg ON gm.group_id = pg.id
           WHERE pg.department = ? AND pg.session_id = ?`,
          [department, sessionId]
        );
        await connection.execute(
          `DELETE p FROM projects p
           INNER JOIN project_groups pg ON p.group_id = pg.id
           WHERE pg.department = ? AND pg.session_id = ?`,
          [department, sessionId]
        );
        await connection.execute(
          'DELETE FROM project_groups WHERE department = ? AND session_id = ?',
          [department, sessionId]
        );
      } else {
        await connection.execute(
          'DELETE gm FROM group_members gm INNER JOIN project_groups pg ON gm.group_id = pg.id WHERE pg.department = ?',
          [department]
        );
        await connection.execute(
          'DELETE p FROM projects p INNER JOIN project_groups pg ON p.group_id = pg.id WHERE pg.department = ?',
          [department]
        );
        await connection.execute('DELETE FROM project_groups WHERE department = ?', [department]);
      }
    } finally {
      connection.release();
    }
  }

  // Save groups to database
  async saveGroupsToDatabase(groups: GroupData[], sessionId: number): Promise<number[]> {
    const connection = await this.db.getConnection();
    const groupIds: number[] = [];

    try {
      await connection.beginTransaction();

      for (const group of groups) {
        // Get department from first member or default
        const department = group.members[0]?.department || 'Software Engineering';
        
        // Insert group into project_groups table (not 'groups' which is reserved)
        const [groupResult] = await connection.execute(
          `INSERT INTO project_groups (name, avg_gpa, status, department, session_id, formation_method, formation_date, created_at) 
           VALUES (?, ?, ?, ?, ?, 'asp', NOW(), NOW())`,
          [group.name, group.avg_gpa, group.status, department, sessionId]
        );

        const groupId = (groupResult as any).insertId;
        groupIds.push(groupId);

        // Create a project record so students can submit reports without a project proposal
        try {
          await connection.execute(
            `INSERT INTO projects (group_id, title, description, status, submitted_at)
             VALUES (?, ?, ?, 'pending', NOW())`,
            [groupId, `Project for ${group.name}`, 'Auto-created for report submission.']
          );
        } catch (e) {
          console.warn('Could not create project for group', groupId, (e as Error).message);
        }

        // Insert group members in TIER ORDER (HIGH, MEDIUM, LOW) - NOT by GPA
        // This ensures the HIGH tier student is always first (leader)
        // Use matric number (student_id) as primary identifier for uniqueness
        for (let i = 0; i < group.members.length; i++) {
          const member = group.members[i]; // Already in tier order
          const matricNumber = member.student_id || null;
          await connection.execute(
            `INSERT INTO group_members (group_id, student_name, student_gpa, gpa_tier, member_order, matric_number, email, phone) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              groupId,
              member.name,
              member.gpa,
              member.tier,
              i + 1,
              matricNumber,
              member.email ?? null,
              member.phone ?? null,
            ]
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

  /**
   * Resolve group by matric; optional department and session scope concurrent cohorts.
   */
  async getGroupByMatricNumber(
    matricNumber: string,
    department?: string,
    sessionId?: number | null
  ): Promise<GroupData | null> {
    if (!matricNumber || matricNumber.trim() === '') {
      return null;
    }

    const connection = await this.db.getConnection();
    try {
      const trimmed = matricNumber.trim();
      const useDept = !!department && String(department).trim().length > 0;
      const useSession = sessionId != null && sessionId !== undefined;
      const [rows] = await connection.execute(
        `SELECT gm.group_id
         FROM group_members gm
         INNER JOIN project_groups pg ON pg.id = gm.group_id
         WHERE (gm.matric_number = ? OR TRIM(COALESCE(gm.matric_number,'')) = ?)
           AND (? = 0 OR TRIM(COALESCE(pg.department,'')) = TRIM(?))
           AND (? = 0 OR pg.session_id = ?)
         ORDER BY gm.group_id DESC
         LIMIT 1`,
        [trimmed, trimmed, useDept ? 1 : 0, department || '', useSession ? 1 : 0, sessionId ?? 0]
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

  /** Preferred for /groups/my-group: uses student's session_id when set. */
  async getGroupForStudentUser(userId: number): Promise<GroupData | null> {
    const [rows] = await this.db.execute(
      `SELECT s.matric_number, TRIM(COALESCE(u.department,'')) as department, s.session_id
       FROM students s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.user_id = ?`,
      [userId]
    );
    const st = (rows as any[])[0];
    if (!st?.matric_number) return null;
    const sid = st.session_id != null ? Number(st.session_id) : null;
    return this.getGroupByMatricNumber(
      String(st.matric_number).trim(),
      st.department || undefined,
      sid
    );
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
          matricNumber: member.matric_number || member.student_id || null,
          email: member.email ?? null,
          phone: member.phone ?? null,
        }));

        groups.push({
          id: group.id,
          name: group.name,
          members,
          avg_gpa: group.avg_gpa,
          status: group.status,
          supervisor_id: group.supervisor_id,
          supervisor: group.supervisor_name || null, // supervisor_name from project_groups table
          department: group.department,
          session_id: group.session_id != null ? Number(group.session_id) : undefined,
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

      // Sort groups: by department, then by group number (1, 2, 3... n) within each department
      const extractGroupNum = (name: string): number => {
        const m = name.match(/Group\s+(\d+)$/i) || name.match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 999999;
      };
      groups.sort((a, b) => {
        const deptA = a.department || '';
        const deptB = b.department || '';
        if (deptA !== deptB) return deptA.localeCompare(deptB);
        return extractGroupNum(a.name) - extractGroupNum(b.name);
      });

      console.log('✅ getAllGroups completed, returning', groups.length, 'groups (sorted 1,2,3...n)');
      return groups;
    } catch (error) {
      console.error('❌ Error in getAllGroups:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /** After member moves/swaps: tier order, member_order, and project_groups.avg_gpa. */
  async renormalizeGroupOrdersAndAvg(connection: any, groupId: number): Promise<void> {
    const [orderedRows] = await connection.execute(
      `SELECT id
       FROM group_members
       WHERE group_id = ?
       ORDER BY
         CASE
           WHEN gpa_tier = 'HIGH' THEN 1
           WHEN gpa_tier = 'MEDIUM' THEN 2
           WHEN gpa_tier = 'LOW' THEN 3
           ELSE 4
         END ASC,
         student_gpa DESC,
         id ASC`,
      [groupId]
    );
    const members = orderedRows as any[];
    for (let i = 0; i < members.length; i++) {
      await connection.execute('UPDATE group_members SET member_order = ? WHERE id = ?', [
        i + 1,
        members[i].id,
      ]);
    }
    const [avgRows] = await connection.execute(
      'SELECT AVG(student_gpa) AS avg_gpa FROM group_members WHERE group_id = ?',
      [groupId]
    );
    const avg = Number((avgRows as any[])[0]?.avg_gpa ?? 0);
    await connection.execute('UPDATE project_groups SET avg_gpa = ? WHERE id = ?', [avg, groupId]);
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

      // 1-member groups: only HIGH tier allowed (algorithm ensures this via swap when needed)
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
