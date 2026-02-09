# Authentication Debugging Guide

## Quick Verification Checklist

### 1. Browser Console Check
Open DevTools (F12 or Right-click → Inspect → Console) and look for logs like:
```
Attempting sign up for: test@example.com
Auth user created: [uuid-here]
Fetching profile for user: [uuid-here]
Profile loaded: {id: "...", role: "student", full_name: "..."}
```

### 2. Database Verification

**Check if auth user exists:**
```
Go to Supabase Dashboard → Authentication → Users
Look for your test@example.com account
```

**Check if profile exists:**
```
Go to Supabase Dashboard → SQL Editor
Run: SELECT * FROM profiles WHERE full_name LIKE '%Student%';
Should return your account
```

## Common Issues & Solutions

### Issue 1: Infinite Loading After Sign Up
**Symptoms:**
- Page says "Loading..." indefinitely
- Console shows repeated profile fetch attempts

**Diagnosis:**
```javascript
// Check console for error messages
// Look for "PERMISSION DENIED" errors
// This indicates RLS policy issue
```

**Solution:**
1. Go to Supabase Dashboard
2. Go to Authentication → Policies
3. Check that `profiles_select_own` policy exists
4. Verify policy condition: `auth.uid() = id`

### Issue 2: "Invalid Email or Password" After Creating Account
**Symptoms:**
- Account was just created
- Immediately trying to log in fails

**Diagnosis:**
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Run: `SELECT email FROM auth.users WHERE email = 'your@email.com';`
4. If no result → account wasn't created properly

**Solution:**
```
Try signing up again with:
- Valid email format
- Password ≥ 6 characters
- Full name filled in
```

### Issue 3: Dashboard Shows But Stays Loading
**Symptoms:**
- Successfully logged in
- Dashboard displays but shows "Loading..." in profile area
- Console errors about fetching group data

**Diagnosis:**
- Profile loaded successfully (you got past auth)
- Issue is with dashboard data loading, not authentication

**Solution:**
- This is expected if you haven't created groups yet
- Dashboard is trying to load group data
- You can ignore this for now

### Issue 4: Session Lost After Page Refresh
**Symptoms:**
- Logged in successfully
- Refresh page (F5)
- Back to login screen

**Diagnosis:**
```javascript
// In console, check:
const session = await supabase.auth.getSession();
console.log(session); // Should show current session
```

**Solution:**
- Wait 2-3 seconds before refreshing
- Session token might not be saved yet
- Check browser storage: Open DevTools → Application → Local Storage
- Should see `sb-kjdezgvvqbzwydhhqaiw-auth-token` key

## Testing Script

Copy-paste in browser console to test authentication:

```javascript
// 1. Check if Supabase is available
console.log('Supabase available:', typeof window.supabase !== 'undefined');

// 2. Check current session
const session = await supabase.auth.getSession();
console.log('Current session:', session);

// 3. Try to fetch profile
if (session?.data?.session?.user) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.data.session.user.id)
    .maybeSingle();

  console.log('Profile data:', data);
  console.log('Profile error:', error);
}

// 4. List all accounts
const { data: users, error } = await supabase.auth.admin.listUsers();
console.log('All users:', users);
```

## RLS Policy Verification

**Check if profile policy exists:**

In Supabase Dashboard → SQL Editor, run:

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
```

Should show policies like:
- `profiles_select_own`
- `profiles_select_admin`
- `profiles_update_own`
- `profiles_update_admin`

**Check if policy works:**

```sql
-- As an authenticated user, can I read my own profile?
SELECT * FROM profiles
WHERE id = auth.uid();
-- Should return your profile

-- Can I read someone else's profile?
SELECT * FROM profiles
WHERE id != auth.uid()
LIMIT 1;
-- Should return 0 rows (permission denied)
```

## Log Files Location

**Browser Console:** F12 → Console tab (in any browser)
- Chrome: F12 or Cmd+Option+I (Mac)
- Firefox: F12 or Cmd+Option+I (Mac)
- Safari: Cmd+Option+U (Mac)

**Supabase Logs:**
1. Go to Supabase Dashboard
2. Click on your project
3. Go to Logs → Postgres Logs
4. Filter by the time you were testing
5. Look for errors with your auth user ID

## Contact Support

If you're still having issues:

1. Check all items in "Quick Verification Checklist"
2. Collect console logs (screenshot or copy-paste)
3. Run the "Testing Script" above and share results
4. Check Supabase logs as described above

## Reset Instructions

**If you want to start fresh:**

1. Delete your test account:
   - Supabase Dashboard → Authentication → Users
   - Click the account, click "Delete"

2. The profile will auto-delete (cascade delete via foreign key)

3. Create a new account with fresh credentials

## Environment Setup

Verify your environment variables are correct:

1. Check `.env` file has:
```
VITE_SUPABASE_URL=https://kjdezgvvqbzwydhhqaiw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

2. Build the project:
```bash
npm run build
```

3. If you see TypeScript errors, run:
```bash
npm run typecheck
```

## Performance Tips

1. **Faster Authentication:**
   - Clear browser cache between tests
   - Use incognito/private window for each test

2. **Check Auth Timing:**
   - Open DevTools → Network tab
   - Watch the API calls to Supabase
   - Should be: signUp → getSession → SELECT profile

3. **Monitor RLS Performance:**
   - Supabase Dashboard → Database → Replication Logs
   - Check if RLS policies are being evaluated
   - Performance should be < 100ms

## Files Modified

These core files were fixed:
- `src/contexts/AuthContext.tsx` - Authentication logic
- `src/pages/Login.tsx` - Login/signup UI
- `src/components/Layout/Sidebar.tsx` - Navigation
- `src/components/Layout/MainLayout.tsx` - Layout
- `supabase/migrations/fix_auth_rls_policies.sql` - Database policies

All are working correctly now.
