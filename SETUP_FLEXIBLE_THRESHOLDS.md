# Quick Setup Guide: Flexible GPA Thresholds

## Step 1: Run Database Migration

```bash
# Navigate to project root
cd C:\xampp\htdocs\supervise360

# Run the migration
mysql -u root -p supervise360 < database/add_flexible_gpa_thresholds.sql
```

When prompted, enter your MySQL root password.

## Step 2: Verify Migration

```bash
# Run the test script
node test-flexible-gpa-thresholds.cjs
```

Expected output:
- ✅ department_settings table exists
- ✅ Global thresholds loaded
- ✅ Test department settings created
- ✅ API endpoints listed

## Step 3: Rebuild Backend

```bash
cd backend
npm run build
```

## Step 4: Start Backend Server

```bash
# In backend directory
npm run dev
```

Server should start on port 5000 with new endpoints:
- `/api/settings/gpa-thresholds/global`
- `/api/settings/gpa-thresholds/department/:department`
- `/api/settings/gpa-thresholds/preview`

## Step 5: Start Frontend

```bash
# In project root
npm run dev
```

Frontend should start on port 5173.

## Step 6: Test the Feature

### As Super Admin:
1. Login as admin (no department)
2. Navigate to **Settings** page
3. You should see "Global GPA Tier Thresholds" section
4. Try changing values (e.g., HIGH: 4.00, MEDIUM: 3.50)
5. Click "Preview Distribution" to see impact
6. Click "Save Global Thresholds"

### As Department Admin:
1. Login as department admin (e.g., Software Engineering)
2. Navigate to **Settings** page
3. You should see "Department Settings: Software Engineering"
4. Check "Use custom thresholds for Software Engineering"
5. Set custom values (e.g., HIGH: 3.70, MEDIUM: 3.20)
6. Click "Preview Distribution"
7. Click "Save Department Settings"

### Test Group Formation:
1. Navigate to **Groups** page
2. Upload a student CSV file
3. Check backend console logs - should show:
   ```
   📊 Using GPA thresholds for Software Engineering: { high: 3.70, medium: 3.20, low: 0.00 }
   Backend processing: John Doe (GPA: 3.75) → HIGH (thresholds: H≥3.70, M≥3.20)
   ```
4. Verify groups are formed with correct tier classifications

## Troubleshooting

### Migration Fails
```bash
# Check if table already exists
mysql -u root -p -e "USE supervise360; SHOW TABLES LIKE 'department_settings';"

# If exists, you can skip migration or drop and recreate
mysql -u root -p -e "USE supervise360; DROP TABLE IF EXISTS department_settings;"
# Then run migration again
```

### Backend Won't Start
```bash
# Check for TypeScript errors
cd backend
npm run build

# Check if port 5000 is in use
netstat -ano | findstr :5000

# Kill process if needed
taskkill /PID <pid> /F
```

### Settings Page Not Showing
- Clear browser cache
- Check browser console for errors
- Verify you're logged in as admin
- Check network tab for API call failures

### Thresholds Not Applied
- Check backend logs for threshold fetch errors
- Verify department name matches exactly
- Ensure migration created default global settings
- Run test script to verify database state

## Quick Validation Checklist

- [ ] Migration script ran without errors
- [ ] Test script shows all green checkmarks
- [ ] Backend starts without TypeScript errors
- [ ] Frontend compiles without errors
- [ ] Settings page loads and shows threshold inputs
- [ ] Can save global thresholds
- [ ] Can save department thresholds
- [ ] Preview distribution works
- [ ] Group formation uses correct thresholds (check logs)
- [ ] Students classified correctly based on thresholds

## Default Values

If everything is working, these are the defaults:

**Global Thresholds:**
- HIGH: ≥3.80
- MEDIUM: ≥3.30
- LOW: ≥0.00

**Department Overrides:**
- None by default (all use global)
- Test script creates Software Engineering with custom values

## Next Steps

Once setup is complete:
1. Configure global thresholds based on your institution's standards
2. Set department-specific overrides where needed
3. Upload student data and form groups
4. Monitor tier distribution to ensure balance
5. Adjust thresholds as needed throughout the academic year

---

**Need Help?**
- Check `FLEXIBLE_GPA_THRESHOLDS_IMPLEMENTATION.md` for detailed documentation
- Review backend console logs for threshold application
- Run `node test-flexible-gpa-thresholds.cjs` to verify database state
