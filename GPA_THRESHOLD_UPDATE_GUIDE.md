# 🎯 GPA Threshold Update Guide

## Problem Identified

When you change GPA thresholds in the Settings page, **existing groups don't automatically update** because:

1. Groups are **stored in the database** with their tier classifications
2. The tier (HIGH/MEDIUM/LOW) is calculated **at the time of group formation**
3. Changing thresholds doesn't retroactively reclassify existing groups

### Current Situation

**Database Thresholds (Updated):**
- HIGH: ≥4.0
- MEDIUM: ≥3.3  
- LOW: ≥1.5

**Existing Groups (Formed with OLD thresholds):**
- Students with GPA 3.72-3.79 are classified as HIGH
- But with new thresholds, they should be MEDIUM
- **Result: 10/10 sampled members have mismatched tiers!**

## Solution

### Option 1: Clear and Regenerate Groups (Recommended)

This is the cleanest approach:

1. **Go to Groups page**
2. **Click "Clear All Groups"** button
3. **Re-upload your student CSV** or use existing students
4. **Click "Generate Groups"**
5. New groups will be formed using the updated thresholds

### Option 2: Automatic Regeneration Script

Run this script to automatically clear and regenerate:

\`\`\`bash
node clear-all-groups.cjs
# Then regenerate groups through the UI
\`\`\`

### Option 3: Add "Regenerate with New Thresholds" Button

We can add a feature to the Groups page that:
- Detects threshold changes
- Shows a warning banner
- Offers a "Regenerate Groups" button
- Automatically re-forms groups with new thresholds

## How It Works

### When You Form Groups:

1. **Frontend** uploads students → `/api/groups/form`
2. **Backend** calls `processStudentData(students, department)`
3. `processStudentData` calls `getGpaTierThresholds(department)`
4. **Thresholds are fetched from database** (system_settings table)
5. Each student is classified: `classifyGpaTier(gpa, thresholds)`
6. Groups are formed with these tier classifications
7. **Groups are saved to database** with tier info

### The Key Point:

✅ **New groups** will use the updated thresholds  
❌ **Existing groups** keep their old tier classifications

## Verification

### Check if Groups Need Regeneration:

\`\`\`bash
node check-existing-groups-tiers.cjs
\`\`\`

This will show:
- Current thresholds in database
- Sample group members
- Which tiers are mismatched
- How many groups need regeneration

### Check Current Thresholds:

\`\`\`bash
node check-current-thresholds.cjs
\`\`\`

## Implementation Details

### Backend Flow:

\`\`\`typescript
// backend/src/services/groupFormationService.ts

async getGpaTierThresholds(department?: string) {
  // 1. Try department-specific thresholds first
  if (department) {
    const deptSettings = await db.execute(
      'SELECT * FROM department_settings WHERE department = ?',
      [department]
    );
    if (deptSettings.use_custom_thresholds) {
      return {
        high: deptSettings.gpa_tier_high_min,
        medium: deptSettings.gpa_tier_medium_min,
        low: deptSettings.gpa_tier_low_min
      };
    }
  }
  
  // 2. Fall back to global thresholds
  const globalSettings = await db.execute(
    'SELECT * FROM system_settings WHERE setting_key LIKE "gpa_tier%"'
  );
  return parseThresholds(globalSettings);
}

classifyGpaTier(gpa: number, thresholds) {
  if (gpa >= thresholds.high) return 'HIGH';
  if (gpa >= thresholds.medium) return 'MEDIUM';
  return 'LOW';
}
\`\`\`

### Database Tables:

**system_settings:**
\`\`\`sql
setting_key              | setting_value
-------------------------|-------------
gpa_tier_high_min        | 4.0
gpa_tier_medium_min      | 3.3
gpa_tier_low_min         | 1.5
\`\`\`

**group_members:**
\`\`\`sql
id | group_id | student_name | student_gpa | gpa_tier
---|----------|--------------|-------------|----------
1  | 1        | John Doe     | 3.75        | HIGH     ← OLD classification
2  | 1        | Jane Smith   | 3.40        | MEDIUM   ← Still correct
\`\`\`

## Future Enhancement Ideas

### 1. Threshold Change Detection

Add to Settings page:

\`\`\`typescript
// After saving thresholds
if (existingGroupsCount > 0) {
  showWarning(
    'Threshold changed! Existing groups use old thresholds. ' +
    'Click "Regenerate Groups" to apply new thresholds.'
  );
}
\`\`\`

### 2. Smart Regeneration

Add button to Groups page:

\`\`\`typescript
async function regenerateWithNewThresholds() {
  // 1. Fetch all students from existing groups
  const students = await extractStudentsFromGroups();
  
  // 2. Clear groups
  await clearAllGroups();
  
  // 3. Re-form with new thresholds
  await formGroups(students);
}
\`\`\`

### 3. Threshold History

Track threshold changes:

\`\`\`sql
CREATE TABLE threshold_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  high_min DECIMAL(3,2),
  medium_min DECIMAL(3,2),
  low_min DECIMAL(3,2),
  changed_at TIMESTAMP,
  changed_by VARCHAR(255)
);
\`\`\`

## Quick Reference

### Current Thresholds:
- HIGH: ≥4.0
- MEDIUM: ≥3.3
- LOW: ≥1.5

### To Apply New Thresholds:
1. Clear existing groups
2. Regenerate groups
3. New groups will use updated thresholds

### Test Scripts:
- `check-current-thresholds.cjs` - View current thresholds
- `check-existing-groups-tiers.cjs` - Check for mismatches
- `clear-all-groups.cjs` - Clear all groups
- `verify-threshold-fix.cjs` - Verify API is working

---

**Status:** ✅ Thresholds are updating correctly in database  
**Action Required:** Clear and regenerate groups to apply new thresholds  
**Date:** February 7, 2026
