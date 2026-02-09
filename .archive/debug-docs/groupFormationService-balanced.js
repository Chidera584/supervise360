// JavaScript version of the GroupFormationService with Academic Balance Priority
class GroupFormationService {
  constructor(db) {
    this.db = db;
  }

  // Classify GPA into tiers based on requirements
  classifyGpaTier(gpa) {
    if (gpa >= 3.80 && gpa <= 5.0) return 'HIGH';
    if (gpa >= 3.30 && gpa < 3.80) return 'MEDIUM';
    return 'LOW'; // < 3.30
  }

  // Process uploaded student data
  processStudentData(rawData) {
    return rawData.map((student, index) => {
      console.log(`🔍 Processing student ${index + 1}:`, student);
      console.log(`📋 Available keys:`, Object.keys(student));
      
      // Handle both raw CSV data and pre-processed frontend data
      let name, gpa, studentId, department;
      
      if (student.name && student.gpa !== undefined) {
        // Already processed by frontend
        name = student.name;
        gpa = typeof student.gpa === 'number' ? student.gpa : parseFloat(student.gpa);
        studentId = student.matricNumber || student.student_id || student.StudentId || student.ID;
        department = student.department;
      } else {
        // Raw CSV data - process it with more flexible column name matching
        // Try different possible column names for name (case insensitive)
        const nameKey = Object.keys(student).find(key => 
          key.toLowerCase().includes('name') || 
          key.toLowerCase() === 'student' ||
          key.toLowerCase() === 'full'
        );
        name = nameKey ? student[nameKey] : null;
        
        // Try different possible column names for GPA (case insensitive)
        const gpaKey = Object.keys(student).find(key => 
          key.toLowerCase().includes('gpa') || 
          key.toLowerCase().includes('cgpa') ||
          key.toLowerCase() === 'grade' ||
          key.toLowerCase() === 'score'
        );
        const gpaValue = gpaKey ? student[gpaKey] : null;
        gpa = gpaValue ? parseFloat(gpaValue.toString().trim()) : NaN;
        
        // Try different possible column names for student ID
        const idKey = Object.keys(student).find(key => 
          key.toLowerCase().includes('id') || 
          key.toLowerCase().includes('matric') ||
          key.toLowerCase().includes('student')
        );
        studentId = idKey ? student[idKey] : `STUDENT_${index + 1}`;
        
        department = student.department || student.Department || 'Software Engineering';
        
        console.log(`📝 Parsed: Name="${name}", GPA="${gpaValue}" → ${gpa}, ID="${studentId}"`);
      }
      
      // Validate required fields
      if (!name || name.toString().trim() === '') {
        console.error(`❌ Student ${index + 1} missing name:`, student);
        throw new Error(`Student at row ${index + 2} is missing a name`);
      }
      
      // Handle missing or invalid GPA
      if (isNaN(gpa) || gpa === null || gpa === undefined) {
        console.warn(`⚠️  Student "${name}" has invalid/missing GPA, using default 3.0`);
        gpa = 3.0; // Default GPA for students without valid GPA data
      }
      
      // Always re-classify tier on backend to ensure consistency
      const tier = this.classifyGpaTier(gpa);
      
      console.log(`✅ Backend processing: ${name} (GPA: ${gpa}) → ${tier}`);
      
      return {
        name: name.toString().trim(),
        gpa,
        tier,
        department,
        student_id: studentId
      };
    });
  }

  // ASP-based group formation algorithm with ACADEMIC BALANCE PRIORITY
  formGroupsUsingASP(students) {
    console.log('🔍 ASP Group Formation with Academic Balance Priority - Input students:', students.length);
    
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
    
    // Log students in each tier
    console.log('👥 HIGH tier students:', highTier.map(s => `${s.name} (${s.gpa})`));
    console.log('👥 MEDIUM tier students:', mediumTier.map(s => `${s.name} (${s.gpa})`));
    console.log('👥 LOW tier students:', lowTier.map(s => `${s.name} (${s.gpa})`));

    const groups = [];
    let groupCounter = 0;

    // Sort students by GPA within each tier for optimal distribution
    highTier.sort((a, b) => b.gpa - a.gpa);
    mediumTier.sort((a, b) => b.gpa - a.gpa);
    lowTier.sort((a, b) => b.gpa - a.gpa);

    // Create pools for distribution
    const usedStudents = new Set();

    // STRATEGY 1: Form ideal groups (1 HIGH + 1 MEDIUM + 1 LOW) - PRIORITY
    const idealGroups = Math.min(highTier.length, mediumTier.length, lowTier.length);
    
    console.log(`🎯 Strategy 1: Forming ${idealGroups} ideal groups (1 HIGH + 1 MEDIUM + 1 LOW each)`);
    
    for (let i = 0; i < idealGroups; i++) {
      const groupMembers = [highTier[i], mediumTier[i], lowTier[i]];
      
      // Mark students as used
      groupMembers.forEach(student => usedStudents.add(student.name));
      
      console.log(`🏗️  Forming Group ${groupCounter + 1}:`);
      console.log(`   👑 LEADER (HIGH): ${groupMembers[0].name} (${groupMembers[0].gpa})`);
      console.log(`   👥 MEMBER (MEDIUM): ${groupMembers[1].name} (${groupMembers[1].gpa})`);
      console.log(`   👥 MEMBER (LOW): ${groupMembers[2].name} (${groupMembers[2].gpa})`);

      const avgGpa = parseFloat(
        (groupMembers.reduce((sum, member) => sum + member.gpa, 0) / 3).toFixed(2)
      );

      groups.push({
        name: `Group ${groupCounter + 1}`,
        members: groupMembers, // Keep tier order: HIGH, MEDIUM, LOW
        avg_gpa: avgGpa,
        status: 'formed'
      });
      
      groupCounter++;
    }

    // STRATEGY 2: Distribute remaining students with ACADEMIC BALANCE priority
    const remainingStudents = students.filter(student => !usedStudents.has(student.name));
    console.log(`🔄 Strategy 2: ${remainingStudents.length} students remaining - prioritizing academic balance`);

    if (remainingStudents.length >= 3) {
      // Separate remaining students by tier
      let remainingHigh = remainingStudents.filter(s => s.tier === 'HIGH');
      let remainingMedium = remainingStudents.filter(s => s.tier === 'MEDIUM');
      let remainingLow = remainingStudents.filter(s => s.tier === 'LOW');
      
      console.log(`   Remaining - HIGH: ${remainingHigh.length}, MEDIUM: ${remainingMedium.length}, LOW: ${remainingLow.length}`);
      
      // ACADEMIC BALANCE ALGORITHM: Ensure every group has mixed abilities
      while (remainingHigh.length + remainingMedium.length + remainingLow.length >= 3) {
        const groupMembers = [];
        
        // Priority 1: Try to form balanced groups (different tiers)
        if (remainingHigh.length > 0 && remainingMedium.length > 0) {
          // HIGH + MEDIUM + (LOW or another MEDIUM/HIGH)
          groupMembers.push(remainingHigh.shift());
          groupMembers.push(remainingMedium.shift());
          
          if (remainingLow.length > 0) {
            groupMembers.push(remainingLow.shift());
            console.log(`   📋 Balanced group: HIGH + MEDIUM + LOW`);
          } else if (remainingMedium.length > 0) {
            groupMembers.push(remainingMedium.shift());
            console.log(`   📋 Balanced group: HIGH + MEDIUM + MEDIUM`);
          } else if (remainingHigh.length > 0) {
            groupMembers.push(remainingHigh.shift());
            console.log(`   📋 Balanced group: HIGH + MEDIUM + HIGH`);
          }
        }
        // Priority 2: HIGH + LOW combination (skip similar abilities)
        else if (remainingHigh.length > 0 && remainingLow.length > 0) {
          groupMembers.push(remainingHigh.shift());
          groupMembers.push(remainingLow.shift());
          
          if (remainingMedium.length > 0) {
            groupMembers.push(remainingMedium.shift());
            console.log(`   📋 Balanced group: HIGH + LOW + MEDIUM`);
          } else if (remainingHigh.length > 0) {
            groupMembers.push(remainingHigh.shift());
            console.log(`   📋 Mixed group: HIGH + LOW + HIGH`);
          } else if (remainingLow.length > 0) {
            groupMembers.push(remainingLow.shift());
            console.log(`   📋 Mixed group: HIGH + LOW + LOW`);
          }
        }
        // Priority 3: MEDIUM + LOW combination
        else if (remainingMedium.length > 0 && remainingLow.length > 0) {
          groupMembers.push(remainingMedium.shift());
          groupMembers.push(remainingLow.shift());
          
          if (remainingMedium.length > 0) {
            groupMembers.push(remainingMedium.shift());
            console.log(`   📋 Mixed group: MEDIUM + LOW + MEDIUM`);
          } else if (remainingHigh.length > 0) {
            groupMembers.push(remainingHigh.shift());
            console.log(`   📋 Balanced group: MEDIUM + LOW + HIGH`);
          } else if (remainingLow.length > 0) {
            groupMembers.push(remainingLow.shift());
            console.log(`   📋 Mixed group: MEDIUM + LOW + LOW`);
          }
        }
        // Last resort: Same tier groups (only when no mixing possible)
        else if (remainingHigh.length >= 3) {
          groupMembers.push(remainingHigh.shift(), remainingHigh.shift(), remainingHigh.shift());
          console.log(`   ⚠️  Homogeneous group (last resort): HIGH + HIGH + HIGH`);
        }
        else if (remainingMedium.length >= 3) {
          groupMembers.push(remainingMedium.shift(), remainingMedium.shift(), remainingMedium.shift());
          console.log(`   ⚠️  Homogeneous group (last resort): MEDIUM + MEDIUM + MEDIUM`);
        }
        else if (remainingLow.length >= 3) {
          groupMembers.push(remainingLow.shift(), remainingLow.shift(), remainingLow.shift());
          console.log(`   ⚠️  Homogeneous group (last resort): LOW + LOW + LOW`);
        }
        else {
          // Not enough students for another group
          break;
        }
        
        if (groupMembers.length === 3) {
          // Sort by GPA (highest first) for consistent leader assignment
          groupMembers.sort((a, b) => b.gpa - a.gpa);
          
          console.log(`🏗️  Forming Group ${groupCounter + 1} (Academic Balance):`);
          console.log(`   👑 LEADER: ${groupMembers[0].name} (${groupMembers[0].gpa}) - ${groupMembers[0].tier}`);
          console.log(`   👥 MEMBER: ${groupMembers[1].name} (${groupMembers[1].gpa}) - ${groupMembers[1].tier}`);
          console.log(`   👥 MEMBER: ${groupMembers[2].name} (${groupMembers[2].gpa}) - ${groupMembers[2].tier}`);

          const avgGpa = parseFloat(
            (groupMembers.reduce((sum, member) => sum + member.gpa, 0) / 3).toFixed(2)
          );

          groups.push({
            name: `Group ${groupCounter + 1}`,
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

    // STRATEGY 3: Handle edge case with exactly 1-2 remaining students
    const finalRemaining = students.filter(student => !groups.some(g => g.members.some(m => m.name === student.name)));
    if (finalRemaining.length > 0 && finalRemaining.length < 3 && groups.length > 0) {
      console.log(`🔄 Strategy 3: Adding ${finalRemaining.length} remaining students to existing groups`);
      
      // Add remaining students to groups that need academic balance
      // Prioritize adding to groups that are too homogeneous
      const sortedGroups = groups.sort((a, b) => {
        // Calculate tier diversity score (lower = more homogeneous)
        const aTiers = new Set(a.members.map(m => m.tier)).size;
        const bTiers = new Set(b.members.map(m => m.tier)).size;
        return aTiers - bTiers; // Sort by diversity (least diverse first)
      });
      
      finalRemaining.forEach((student, index) => {
        if (index < sortedGroups.length) {
          sortedGroups[index].members.push(student);
          // Recalculate average GPA
          const newAvgGpa = parseFloat(
            (sortedGroups[index].members.reduce((sum, member) => sum + member.gpa, 0) / sortedGroups[index].members.length).toFixed(2)
          );
          sortedGroups[index].avg_gpa = newAvgGpa;
          
          console.log(`   ➕ Added ${student.name} (${student.gpa} - ${student.tier}) to ${sortedGroups[index].name} for better balance`);
        }
      });
    }

    console.log(`✅ Group formation completed with academic balance priority:`);
    console.log(`   📊 Total groups formed: ${groups.length}`);
    console.log(`   👥 Students placed: ${groups.reduce((sum, g) => sum + g.members.length, 0)} / ${students.length}`);
    console.log(`   🎯 Ideal groups (1:1:1 ratio): ${idealGroups}`);
    console.log(`   🔄 Balanced mixed groups: ${groups.length - idealGroups}`);
    
    // Report on academic balance
    const homogeneousGroups = groups.filter(g => new Set(g.members.map(m => m.tier)).size === 1);
    const mixedGroups = groups.filter(g => new Set(g.members.map(m => m.tier)).size > 1);
    console.log(`   ✅ Mixed-ability groups: ${mixedGroups.length}`);
    console.log(`   ⚠️  Homogeneous groups: ${homogeneousGroups.length}`);

    if (groups.length === 0) {
      throw new Error('Cannot form any groups: Need at least 3 students total.');
    }

    return groups;
  }

  // Save groups to database
  async saveGroupsToDatabase(groups, department = 'Software Engineering') {
    const connection = await this.db.getConnection();
    const groupIds = [];

    try {
      await connection.beginTransaction();

      for (const group of groups) {
        // Insert group into project_groups table with department
        const [groupResult] = await connection.execute(
          `INSERT INTO project_groups (name, avg_gpa, status, formation_method, formation_date, department, created_at) 
           VALUES (?, ?, ?, 'asp', NOW(), ?, NOW())`,
          [group.name, group.avg_gpa, group.status, department]
        );

        const groupId = groupResult.insertId;
        groupIds.push(groupId);
        
        console.log(`💾 Saved group "${group.name}" with ID ${groupId} for department "${department}"`);

        // Insert group members in TIER ORDER (HIGH, MEDIUM, LOW) - NOT by GPA
        for (let i = 0; i < group.members.length; i++) {
          const member = group.members[i];
          await connection.execute(
            `INSERT INTO group_members (group_id, student_name, student_gpa, gpa_tier, member_order) 
             VALUES (?, ?, ?, ?, ?)`,
            [groupId, member.name, member.gpa, member.tier, i + 1]
          );
        }
      }

      await connection.commit();
      console.log(`✅ Successfully saved ${groups.length} groups to database for department "${department}"`);
      return groupIds;
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error saving groups to database:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get all groups with members
  async getAllGroups() {
    const connection = await this.db.getConnection();

    try {
      console.log('🔍 Getting database connection for getAllGroups');
      
      const [groupRows] = await connection.execute(`
        SELECT g.*, 
               COUNT(gm.id) as member_count,
               u.first_name as supervisor_first_name,
               u.last_name as supervisor_last_name
        FROM project_groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id
        LEFT JOIN supervisors s ON g.supervisor_id = s.id
        LEFT JOIN users u ON s.user_id = u.id
        GROUP BY g.id
        ORDER BY 
          CASE 
            WHEN g.name REGEXP '^Group [0-9]+$' THEN 
              CAST(SUBSTRING(g.name, 7) AS UNSIGNED)
            ELSE 999999 
          END ASC,
          g.name ASC
      `);

      console.log('✅ Groups query executed, found:', groupRows.length, 'groups');

      const groups = [];

      for (const group of groupRows) {
        console.log('🔍 Processing group:', group.id, group.name);
        
        // Get group members ordered by TIER ORDER (member_order)
        const [memberRows] = await connection.execute(
          `SELECT * FROM group_members WHERE group_id = ? ORDER BY member_order ASC`,
          [group.id]
        );

        console.log('✅ Found', memberRows.length, 'members for group', group.id);

        const members = memberRows.map(member => ({
          name: member.student_name,
          gpa: member.student_gpa,
          tier: member.gpa_tier
        }));

        groups.push({
          id: group.id,
          name: group.name,
          members,
          avg_gpa: group.avg_gpa,
          status: group.status,
          supervisor_id: group.supervisor_id
        });
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

  // Validate group formation constraints (updated for flexible algorithm)
  validateGroupFormation(groups) {
    const violations = [];

    groups.forEach((group) => {
      // Check if group has at least 3 members
      if (group.members.length < 3) {
        violations.push(`Group ${group.name}: Must have at least 3 members`);
      }

      // Check if all members have valid data
      group.members.forEach((member, index) => {
        if (!member.name || member.name.trim() === '') {
          violations.push(`Group ${group.name}: Member ${index + 1} is missing a name`);
        }
        
        if (typeof member.gpa !== 'number' || isNaN(member.gpa)) {
          violations.push(`Group ${group.name}: Member "${member.name}" has invalid GPA: ${member.gpa}`);
        }
        
        if (!member.tier || !['HIGH', 'MEDIUM', 'LOW'].includes(member.tier)) {
          violations.push(`Group ${group.name}: Member "${member.name}" has invalid tier: ${member.tier}`);
        }
      });

      // Check academic balance (warn about homogeneous groups)
      if (group.members.length >= 3) {
        const tiers = group.members.map(m => m.tier);
        const uniqueTiers = new Set(tiers);
        
        if (uniqueTiers.size === 1) {
          console.log(`⚠️  Group ${group.name}: Homogeneous group (all ${tiers[0]} tier) - consider rebalancing for better academic support`);
        } else {
          console.log(`✅ Group ${group.name}: Mixed-ability group (${Array.from(uniqueTiers).join(', ')}) - good for peer learning`);
        }
      }
    });

    return {
      isValid: violations.length === 0,
      violations
    };
  }

  // Calculate statistics for formed groups
  calculateGroupStatistics(groups) {
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

    // Calculate academic balance metrics
    const homogeneousGroups = groups.filter(g => new Set(g.members.map(m => m.tier)).size === 1);
    const mixedGroups = groups.filter(g => new Set(g.members.map(m => m.tier)).size > 1);

    return {
      totalGroups,
      averageGroupGpa,
      gpaVariance: parseFloat(variance.toFixed(4)),
      tierDistribution,
      academicBalance: {
        mixedAbilityGroups: mixedGroups.length,
        homogeneousGroups: homogeneousGroups.length,
        balancePercentage: totalGroups > 0 ? Math.round((mixedGroups.length / totalGroups) * 100) : 0
      }
    };
  }
}

module.exports = { GroupFormationService };