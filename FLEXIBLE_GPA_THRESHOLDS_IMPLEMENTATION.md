# Flexible GPA Tier Thresholds Implementation

## Overview
This implementation adds flexible, configurable GPA tier thresholds that can be set globally (by Super Admin) or overridden per department (by Department Admin). This replaces the previous static thresholds (HIGH≥3.80, MEDIUM≥3.30, LOW<3.30) with a dynamic system.

## Features Implemented

### 1. Database Schema Changes
- **New Table: `department_settings`**
  - Stores department-specific threshold overrides
  - Fields: `department`, `use_custom_thresholds`, `gpa_tier_high_min`, `gpa_tier_medium_min`, `gpa_tier_low_min`
  - Includes validation constraints to ensure thresholds are within valid ranges (0.00-5.00)

- **Updated Table: `system_settings`**
  - Global default thresholds stored as settings
  - Keys: `gpa_tier_high_min`, `gpa_tier_medium_min`, `gpa_tier_low_min`
  - Descriptions updated to clarify they are "Global Defaults"

### 2. Backend API Endpoints

#### Settings Routes (`/api/settings`)
- **GET `/gpa-thresholds/global`**
  - Retrieves global GPA tier thresholds
  - Returns: `{ high, medium, low }`

- **PUT `/gpa-thresholds/global`**
  - Updates global GPA tier thresholds (Super Admin only)
  - Body: `{ high, medium, low }`
  - Validates: `0 ≤ low ≤ medium ≤ high ≤ 5.0`

- **GET `/gpa-thresholds/department/:department`**
  - Retrieves department-specific or global thresholds
  - Returns: `{ useCustomThresholds, thresholds, isGlobal }`

- **PUT `/gpa-thresholds/department/:department`**
  - Updates department-specific threshold settings
  - Body: `{ useCustomThresholds, high, medium, low }`
  - Creates or updates department settings

- **POST `/gpa-thresholds/preview`**
  - Previews tier distribution with given thresholds
  - Body: `{ high, medium, low, department? }`
  - Returns: `{ distribution: { HIGH, MEDIUM, LOW, total }, thresholds, department }`

### 3. Group Formation Service Updates

#### Dynamic Threshold Retrieval
```typescript
async getGpaTierThresholds(department?: string): Promise<{ high, medium, low }>
```
- Checks for department-specific settings first
- Falls back to global settings if no custom thresholds
- Returns default values (3.80, 3.30, 0.00) if database query fails

#### Updated Classification Method
```typescript
classifyGpaTier(gpa: number, thresholds: { high, medium, low }): 'HIGH' | 'MEDIUM' | 'LOW'
```
- Now accepts dynamic thresholds instead of using hardcoded values
- Classifies students based on provided threshold configuration

#### Updated Processing Methods
- `processStudentData()` - Now async, fetches thresholds for department
- `formGroupsUsingASP()` - Now async, uses dynamic thresholds for logging

### 4. Frontend Settings Page

#### Features
- **Global Settings Section** (Super Admin only)
  - Configure default thresholds for all departments
  - Input fields for HIGH, MEDIUM, and LOW tier minimums
  - Real-time validation
  - Save button with loading state

- **Department Settings Section** (Department Admin)
  - Toggle to use custom thresholds or inherit global
  - Department-specific threshold configuration
  - Shows current department name
  - Save button with loading state

- **Preview Distribution Section**
  - Shows current threshold values being used
  - Button to preview how students would be distributed
  - Displays count and percentage for each tier
  - Works with both global and department-specific thresholds

- **Validation**
  - Ensures: `0 ≤ LOW ≤ MEDIUM ≤ HIGH ≤ 5.0`
  - Displays error messages for invalid configurations
  - Disables save button when validation fails

- **User Feedback**
  - Success/error messages with auto-dismiss
  - Loading states during API calls
  - Clear visual indicators for active settings

### 5. Integration with Group Formation

#### Frontend (Groups.tsx)
- Passes department when uploading student CSV
- Department extracted from user context
- Included in API call to backend

#### API Layer (api.ts)
- `formGroups()` method updated to accept optional department parameter
- Passes department to backend for threshold lookup

#### Context (GroupsContext.tsx)
- Extracts department from student data
- Passes to API client when forming groups

#### Backend (groups.ts route)
- Receives department in request body
- Passes to `processStudentData()` and `formGroupsUsingASP()`
- Service uses department to fetch appropriate thresholds

## Usage Flow

### For Super Admin (Global Configuration)
1. Navigate to Settings page
2. See "Global GPA Tier Thresholds" section
3. Adjust HIGH, MEDIUM, LOW minimums as needed
4. Click "Preview Distribution" to see impact
5. Click "Save Global Thresholds" to apply

### For Department Admin (Department Override)
1. Navigate to Settings page
2. See "Department Settings: [Department Name]" section
3. Check "Use custom thresholds for [Department]"
4. Adjust threshold values
5. Click "Preview Distribution" to see impact on department students
6. Click "Save Department Settings" to apply

### For Group Formation
1. Admin uploads student CSV on Groups page
2. System automatically:
   - Detects user's department
   - Fetches appropriate thresholds (department-specific or global)
   - Classifies students using those thresholds
   - Forms groups with proper tier distribution
   - Logs threshold values used for transparency

## Database Migration

### To Apply Changes
```bash
# Run the migration script
mysql -u root -p supervise360 < database/add_flexible_gpa_thresholds.sql
```

### What the Migration Does
1. Creates `department_settings` table
2. Updates `system_settings` descriptions
3. Inserts default global thresholds (if not exist)
4. Adds necessary indexes and constraints

## Testing

### Test Script
```bash
node test-flexible-gpa-thresholds.cjs
```

### What It Tests
1. Verifies `department_settings` table exists
2. Checks global threshold settings
3. Creates test department configurations
4. Simulates tier classification with different thresholds
5. Shows current student distribution
6. Lists available API endpoints

## Files Modified/Created

### Database
- `database/improved_schema.sql` - Added department_settings table
- `database/add_flexible_gpa_thresholds.sql` - Migration script

### Backend
- `backend/src/routes/settings.ts` - NEW: Settings API endpoints
- `backend/src/services/groupFormationService.ts` - Updated for dynamic thresholds
- `backend/src/routes/groups.ts` - Pass department to service
- `backend/src/server.ts` - Register settings routes

### Frontend
- `src/pages/admin/Settings.tsx` - Complete rewrite with threshold configuration
- `src/lib/api.ts` - Updated formGroups to accept department
- `src/contexts/GroupsContext.tsx` - Pass department to API

### Testing
- `test-flexible-gpa-thresholds.cjs` - NEW: Comprehensive test script

### Documentation
- `FLEXIBLE_GPA_THRESHOLDS_IMPLEMENTATION.md` - This file

## Example Scenarios

### Scenario 1: Software Engineering with Lower Standards
```
Global: HIGH≥3.80, MEDIUM≥3.30, LOW≥0.00
SE Dept: HIGH≥3.70, MEDIUM≥3.20, LOW≥0.00 (Custom)

Student with GPA 3.75:
- Global classification: MEDIUM
- SE classification: HIGH ✓ (uses department settings)
```

### Scenario 2: Computer Science Using Global
```
Global: HIGH≥3.80, MEDIUM≥3.30, LOW≥0.00
CS Dept: Using global defaults

Student with GPA 3.75:
- Classification: MEDIUM (uses global settings)
```

### Scenario 3: Adjusting for Grade Inflation
```
Admin notices too many HIGH tier students
Adjusts global: HIGH≥4.00, MEDIUM≥3.50, LOW≥0.00
All departments using global now have stricter standards
```

## Benefits

1. **Flexibility**: Adapt to different department standards
2. **Fairness**: Account for varying grading scales across departments
3. **Control**: Admins can adjust without code changes
4. **Transparency**: Preview shows impact before applying
5. **Backward Compatible**: Defaults match original static values
6. **Scalable**: Easy to add more departments with custom settings

## Important Notes

- **Validation is Critical**: System enforces `LOW ≤ MEDIUM ≤ HIGH`
- **Department Detection**: Uses authenticated user's department context
- **Fallback Behavior**: Always falls back to global if department settings unavailable
- **Logging**: Extensive console logging for debugging threshold application
- **No Breaking Changes**: Existing functionality preserved, just made configurable

## Future Enhancements (Optional)

1. **Tier Ratio Targets**: Set desired HIGH:MEDIUM:LOW ratios
2. **Historical Tracking**: Log threshold changes over time
3. **Bulk Department Config**: Configure multiple departments at once
4. **Threshold Templates**: Save and reuse threshold configurations
5. **Academic Year Variations**: Different thresholds per academic year
6. **Notification System**: Alert admins when distribution is imbalanced

## Support

If you encounter issues:
1. Check backend logs for threshold fetch errors
2. Verify database migration ran successfully
3. Ensure user has proper department context
4. Run test script to validate configuration
5. Check browser console for frontend errors

---

**Implementation Date**: February 6, 2026
**Status**: ✅ Complete and Ready for Testing
