# Demo: Settings & Groups Integration

## Complete User Flow Demonstration

### Step 1: View Current Settings
1. Navigate to **Settings** page
2. See current GPA thresholds:
   - HIGH: ≥ 3.5
   - MEDIUM: ≥ 2.5
   - LOW: ≥ 0.0

### Step 2: Preview Current Distribution
1. Click **"Preview Distribution"** button
2. See current student distribution:
   ```
   HIGH:    15 students (30.0%)
   MEDIUM:  25 students (50.0%)
   LOW:     10 students (20.0%)
   TOTAL:   50 students
   ```

### Step 3: Adjust Thresholds
1. Change thresholds to:
   - HIGH: ≥ 3.7 (increased from 3.5)
   - MEDIUM: ≥ 3.0 (increased from 2.5)
   - LOW: ≥ 2.0 (increased from 0.0)

2. Click **"Preview Distribution"** again
3. See NEW distribution:
   ```
   HIGH:    10 students (20.0%)  ← Decreased (higher bar)
   MEDIUM:  20 students (40.0%)  ← Decreased
   LOW:     20 students (40.0%)  ← Increased (more students fall into LOW)
   TOTAL:   50 students
   ```

### Step 4: Save Changes
1. Click **"Save Global Thresholds"**
2. See success message: "Global thresholds updated! Existing groups will use new thresholds when regenerated."
3. System stores change flag in localStorage

### Step 5: Navigate to Groups Page
1. Click **"Groups"** in navigation
2. **See blue notification banner** at top:
   ```
   ⓘ GPA Thresholds Updated
   The GPA tier thresholds have been changed. To apply the new thresholds 
   to your groups, please upload students again or regenerate existing groups.
   [×] Dismiss
   ```

### Step 6: Apply New Thresholds
**Option A: Upload New Students**
1. Click **"Upload Students"** button
2. Select CSV file with student data
3. Students are automatically classified using NEW thresholds
4. Groups formed with new tier distribution

**Option B: Regenerate Existing Groups**
1. Click **"Clear All Groups"** (if needed)
2. Upload students again
3. New groups use updated thresholds

### Step 7: Verify Changes
1. View formed groups
2. Check student tier classifications
3. Confirm groups reflect new threshold settings

## Visual Indicators

### Settings Page:
```
┌─────────────────────────────────────────┐
│ GPA Tier Configuration                  │
├─────────────────────────────────────────┤
│ Global Thresholds                       │
│                                         │
│ HIGH:   [3.7] GPA                      │
│ MEDIUM: [3.0] GPA                      │
│ LOW:    [2.0] GPA                      │
│                                         │
│ [Preview Distribution]                  │
│                                         │
│ Current Student Distribution:           │
│ ┌──────┬──────┬──────┐                │
│ │ HIGH │ MED  │ LOW  │                │
│ │  10  │  20  │  20  │                │
│ │ 20%  │ 40%  │ 40%  │                │
│ └──────┴──────┴──────┘                │
│ Total: 50 students                      │
│                                         │
│ [Save Global Thresholds]                │
└─────────────────────────────────────────┘
```

### Groups Page (After Threshold Change):
```
┌─────────────────────────────────────────┐
│ ⓘ GPA Thresholds Updated            [×]│
│ The GPA tier thresholds have been       │
│ changed. Upload students to apply.      │
├─────────────────────────────────────────┤
│ Group Management                        │
│ Department: CS • 15 groups formed       │
│                                         │
│ [Upload Students] [Refresh]             │
└─────────────────────────────────────────┘
```

## Technical Flow

```
Settings Page                Groups Page
     │                           │
     ├─ Change thresholds        │
     ├─ Preview distribution     │
     ├─ Save to database         │
     ├─ Set localStorage flag ───┤
     │                           │
     │                           ├─ Detect flag
     │                           ├─ Show notification
     │                           │
     │                           ├─ Upload students
     │                           ├─ Fetch thresholds from DB
     │                           ├─ Classify students
     │                           └─ Form groups
```

## Key Benefits

1. **Seamless**: No manual steps to sync settings
2. **Visual**: Clear notification when thresholds change
3. **Accurate**: Percentages calculated correctly
4. **Flexible**: Works with global or department thresholds
5. **Safe**: Existing groups unchanged until regenerated
6. **Intuitive**: Clear user guidance throughout

## Testing Commands

```bash
# Test Settings API
node test-settings-endpoints.cjs

# Test Integration
node test-settings-integration.cjs

# Check Database Schema
node check-and-setup-settings.cjs
```

## Success Criteria ✅

- [x] Settings page shows current thresholds
- [x] Preview displays accurate percentages
- [x] Threshold changes persist to database
- [x] Groups page detects threshold changes
- [x] Notification banner appears when needed
- [x] Groups use new thresholds automatically
- [x] Existing functionality preserved
- [x] User experience is clear and intuitive

**Status: All criteria met! 🎉**
