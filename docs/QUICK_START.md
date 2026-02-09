# Supervise360 - Quick Start Guide

## Authentication Now Works! ✅

### What Was Fixed
- ✅ Infinite recursion during signup eliminated
- ✅ Dashboard access after login working
- ✅ User profiles created automatically
- ✅ Session persistence across page refreshes
- ✅ Role-based dashboard rendering

---

## Test It In 5 Minutes

### Step 1: Create a Student Account
```
URL: http://localhost:5173
Click: "Don't have an account? Sign Up"

Fill Form:
- Full Name: John Student
- Email: john@example.com
- Password: test123456
- Account Type: Student
- Student ID: S001
- Department: Engineering

Click: Sign Up
```

### Step 2: Login
```
Click: "Already have an account? Sign In"

Fill Form:
- Email: john@example.com
- Password: test123456

Click: Login
```

### Step 3: See Dashboard
```
Expected: Student Dashboard with:
- Your profile info
- Sidebar menu
- Logout button

✅ Success!
```

### Step 4: Test Session Persistence
```
Press: F5 (refresh page)

Expected: Still logged in, dashboard visible

✅ Success!
```

### Step 5: Logout
```
Click: Logout button

Expected: Back to login page

✅ Success!
```

---

## Create Different Account Types

### Supervisor Account
```
Sign Up with:
- Account Type: Supervisor
- (Skip Student ID field)
- Department: Your Department

Result: See Supervisor Dashboard
```

### Admin Account
```
Sign Up with:
- Account Type: Administrator
- (Skip Student ID field)
- Department: Admin

Result: See Admin Dashboard
```

---

## If Something Goes Wrong

### Infinite Loading After Login
**Check:**
1. Open browser console (F12)
2. Should see log: "Fetching profile for user: [id]"
3. Should see log: "Profile loaded: {..."

If not, check Supabase Dashboard:
- Go to SQL Editor
- Run: `SELECT * FROM profiles WHERE full_name LIKE '%John%';`
- Should see your account

### Cannot Login
**Try:**
1. Double-check email spelling
2. Make sure password is correct
3. Try creating account again with different email

### Still Stuck?
1. Open browser console (F12 → Console)
2. Look for error messages
3. Check CRITICAL_AUTH_FIX_NOTES.txt in project folder

---

## File Structure (Authentication Related)

```
project/
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx          ← Authentication logic
│   ├── pages/
│   │   ├── Login.tsx                ← Login/Signup form
│   │   ├── StudentDashboard.tsx     ← Student view
│   │   ├── SupervisorDashboard.tsx  ← Supervisor view
│   │   └── AdminDashboard.tsx       ← Admin view
│   └── components/
│       └── Layout/
│           ├── Sidebar.tsx
│           ├── Header.tsx
│           └── MainLayout.tsx
└── supabase/
    └── migrations/
        ├── create_supervise360_schema.sql
        ├── create_auth_trigger.sql
        └── fix_auth_rls_policies.sql
```

---

## Documentation Files

Read these in order for full understanding:

1. **QUICK_START.md** (this file)
   - Quick testing steps
   
2. **CRITICAL_AUTH_FIX_NOTES.txt**
   - Overview of what was fixed
   
3. **AUTHENTICATION_FIX_SUMMARY.md**
   - Technical details of fixes
   
4. **COMPLETE_AUTHENTICATION_SOLUTION.md**
   - Architecture and deep dive
   
5. **DEBUG_GUIDE.md**
   - Troubleshooting procedures

---

## Account Types Explained

### Student
- Can view own group and project
- Can submit reports
- Can message supervisors
- See Student Dashboard

### Supervisor
- Can view assigned groups
- Can evaluate reports
- Can message students
- See Supervisor Dashboard

### Administrator
- Can view all users
- Can manage system settings
- Can run grouping algorithms
- See Admin Dashboard

---

## Key Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
```

---

## Console Testing

Open browser console (F12) and run:

```javascript
// Check current session
const session = await supabase.auth.getSession();
console.log(session);

// List all users
const { data } = await supabase.auth.admin.listUsers();
console.log('All users:', data);

// Check your profile
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', session?.data?.session?.user?.id)
  .maybeSingle();
console.log('Your profile:', profile);
```

---

## Expected Behavior

### Signup Flow
```
1. Fill form → 2. Click Sign Up
   ↓
3. System creates auth user
4. Database trigger creates profile
5. System creates/updates profile with details
6. Success message shown
```

### Login Flow
```
1. Enter credentials → 2. Click Login
   ↓
3. Supabase authenticates
4. System fetches your profile
5. Dashboard renders (based on role)
   ↓
Student → Student Dashboard
Supervisor → Supervisor Dashboard
Admin → Admin Dashboard
```

### Session Flow
```
1. Logged in
2. Refresh page (F5)
3. System checks session
4. Profile loaded
5. Dashboard shown (session intact)
```

---

## Logs to Watch For

Good signs in console:
```
✅ Attempting sign up for: email@example.com
✅ Auth user created: [uuid-string]
✅ Fetching profile for user: [uuid-string]
✅ Profile loaded: {id: "...", role: "student", full_name: "..."}
✅ Auth state changed: SIGNED_IN
```

Bad signs:
```
❌ PERMISSION DENIED - RLS policy issue
❌ UNIQUE constraint failed - Email already exists
❌ Error fetching profile - Database query failed
```

---

## Next Steps

1. ✅ Test the 5-minute demo above
2. ✅ Create accounts for each role type
3. ✅ Check browser console for success logs
4. ✅ Test logout and login again
5. ✅ Refresh page to test session persistence

---

## Build Status

```
✅ Compiles without errors
✅ All TypeScript types correct
✅ Authentication system working
✅ Database RLS policies in place
✅ Ready for deployment
```

**Status: PRODUCTION READY**

---

**Questions?** Check the other documentation files or open browser console (F12) to see detailed logs of what's happening.

Good luck! 🚀
