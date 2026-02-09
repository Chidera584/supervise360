# System Behavior Testing Guide

This guide helps you test and verify the key system behaviors for user profiles, group assignments, and login flows.

## Prerequisites

1. **Database Setup**: Ensure your MySQL database is running with the schema loaded
2. **Backend Server**: The Node.js backend should be running on port 5000
3. **Frontend**: The React frontend should be running on port 5173

## Quick Database Test

First, run the quick test script to check your current data:

```bash
cd backend
node ../quick-behavior-test.js
```

This will show you:
- Current groups and supervisor assignments
- Existing student and supervisor accounts
- Data consistency checks

## Test Scenarios

### 1. Admin Group Creation & Assignment Reflection

#### Test Steps:
1. **Login as Admin** (use dummy login or create admin account)
2. **Navigate to Groups page** (`/admin/groups`)
3. **Create a new group**:
   - Group Name: "Test Group Alpha"
   - Add 3-4 members with different GPA tiers
4. **Navigate to Supervisor Assignment** (`/admin/supervisor-assignment`)
5. **Assign a supervisor** to the created group
6. **Verify the assignment** appears in the database

#### Expected Results:
- Group appears in groups table
- Supervisor assignment recorded in supervisor_assignments table
- Supervisor capacity updated automatically

#### Verification Queries:
```sql
-- Check group creation
SELECT * FROM groups WHERE name = 'Test Group Alpha';

-- Check supervisor assignment
SELECT g.name, u.first_name, u.last_name, sa.assigned_at 
FROM groups g
JOIN supervisor_assignments sa ON g.id = sa.group_id
JOIN users u ON sa.supervisor_id = u.id
WHERE g.name = 'Test Group Alpha';

-- Check group members
SELECT gm.student_name, gm.student_gpa, gm.gpa_tier
FROM group_members gm
JOIN groups g ON gm.group_id = g.id
WHERE g.name = 'Test Group Alpha';
```

### 2. Student Account Creation & Login

#### Test Steps:
1. **Go to Login page** and click "Sign Up"
2. **Create Student Account**:
   - First Name: "Test"
   - Last Name: "Student"
   - Email: "test.student@university.edu"
   - Password: "student123"
   - Account Type: "Student"
   - Department: "Computer Science"
   - Matric Number: "ST2024001" (must be unique)
   - GPA: "3.75"
3. **Complete registration** - should auto-login
4. **Logout and login again** using email and password
5. **Navigate to Profile page** to verify data

#### Expected Results:
- Account created successfully
- Auto-login after registration works
- Manual login with email/password works
- Profile shows correct matric number and GPA
- Student dashboard accessible

#### Verification Queries:
```sql
-- Check student account creation
SELECT u.first_name, u.last_name, u.email, s.matric_number, s.gpa, s.gpa_tier
FROM users u
JOIN students s ON u.id = s.user_id
WHERE u.email = 'test.student@university.edu';
```

### 3. Supervisor Account Creation & Login

#### Test Steps:
1. **Create Supervisor Account**:
   - First Name: "Dr. Test"
   - Last Name: "Supervisor"
   - Email: "test.supervisor@university.edu"
   - Password: "supervisor123"
   - Account Type: "Supervisor"
   - Department: "Computer Science"
2. **Complete registration** and verify auto-login
3. **Logout and login again** using email and password
4. **Navigate to My Groups page** to see assigned groups

#### Expected Results:
- Supervisor account created successfully
- Login works with email/password
- Supervisor dashboard accessible
- Can see assigned groups (if any)

#### Verification Queries:
```sql
-- Check supervisor account creation
SELECT u.first_name, u.last_name, u.email, s.department, s.max_capacity
FROM users u
JOIN supervisors s ON u.id = s.user_id
WHERE u.email = 'test.supervisor@university.edu';

-- Check supervisor capacity record
SELECT * FROM supervisor_capacity 
WHERE supervisor_id = (SELECT id FROM users WHERE email = 'test.supervisor@university.edu');
```

### 4. Group Assignment Reflection on User Profiles

#### Test Steps:
1. **As Admin, assign the test supervisor** to the test group created earlier
2. **Login as the test supervisor**
3. **Navigate to "My Groups"** page
4. **Verify the assigned group appears** with correct details
5. **Create a student account** with a name matching a group member
6. **Login as that student**
7. **Navigate to "My Group"** page
8. **Verify group assignment** (if implemented with name matching)

#### Expected Results:
- Supervisor sees assigned groups immediately after assignment
- Group details include member information
- Student can see group assignment (if name matching is implemented)
- No reassignment needed after login

### 5. Data Consistency Before/After Account Creation

#### Test Steps:
1. **As Admin, create a group** with member names that don't have accounts yet
2. **Assign a supervisor** to this group
3. **Verify assignments exist** in database
4. **Create student accounts** for the group members
5. **Login as those students**
6. **Verify the pre-existing assignments** are still intact
7. **Check that no data was lost** during account creation

#### Expected Results:
- Group assignments persist before account creation
- Supervisor assignments remain intact
- No data loss when accounts are created later
- System maintains referential integrity

## Testing with the Application

### Frontend Testing Flow:

1. **Start the application**:
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm start

   # Terminal 2 - Frontend  
   npm run dev
   ```

2. **Open browser** to `http://localhost:5173`

3. **Test the dummy login buttons** first:
   - Click "Test as Student" - should go to student dashboard
   - Click "Test as Supervisor" - should go to supervisor dashboard  
   - Click "Test as Administrator" - should go to admin dashboard

4. **Test real registration/login**:
   - Use the "Sign Up" flow to create accounts
   - Test login with created credentials
   - Verify profile information displays correctly

### Key Pages to Test:

- **Login/Registration**: `/` 
- **Student Dashboard**: `/student` (after student login)
- **Student Profile**: `/student/profile`
- **Student My Group**: `/student/my-group`
- **Supervisor Dashboard**: `/supervisor` (after supervisor login)
- **Supervisor My Groups**: `/supervisor/my-groups`
- **Admin Dashboard**: `/admin` (after admin login)
- **Admin Groups**: `/admin/groups`
- **Admin Supervisor Assignment**: `/admin/supervisor-assignment`

## Database Verification Queries

Run these queries to verify system behavior:

```sql
-- 1. Check all user accounts and their roles
SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.department, u.created_at
FROM users u
ORDER BY u.created_at DESC;

-- 2. Check student profiles with GPA tiers
SELECT u.first_name, u.last_name, s.matric_number, s.gpa, s.gpa_tier, s.academic_year
FROM users u
JOIN students s ON u.id = s.user_id
ORDER BY s.gpa DESC;

-- 3. Check supervisor profiles and capacity
SELECT u.first_name, u.last_name, u.email, s.department, s.max_capacity, s.current_load, s.is_available
FROM users u
JOIN supervisors s ON u.id = s.user_id;

-- 4. Check groups with supervisor assignments
SELECT g.id, g.name, g.status, g.avg_gpa, 
       u.first_name as supervisor_first, u.last_name as supervisor_last,
       COUNT(gm.id) as member_count
FROM groups g
LEFT JOIN supervisor_assignments sa ON g.id = sa.group_id
LEFT JOIN users u ON sa.supervisor_id = u.id
LEFT JOIN group_members gm ON g.id = gm.group_id
GROUP BY g.id;

-- 5. Check group members and their details
SELECT g.name as group_name, gm.student_name, gm.student_gpa, gm.gpa_tier, gm.member_order
FROM groups g
JOIN group_members gm ON g.id = gm.group_id
ORDER BY g.name, gm.member_order;

-- 6. Check supervisor workload
SELECT u.first_name, u.last_name, 
       sc.current_groups, sc.max_groups,
       (sc.max_groups - sc.current_groups) as available_slots
FROM users u
JOIN supervisor_capacity sc ON u.id = sc.supervisor_id
WHERE u.role IN ('supervisor', 'external_supervisor');
```

## Expected System Behaviors

### ✅ What Should Work:

1. **User Registration**: Students and supervisors can create accounts
2. **Login Authentication**: Email/password login for all user types
3. **Role-based Dashboards**: Different interfaces for students, supervisors, admins
4. **Group Creation**: Admins can create groups and assign supervisors
5. **Data Persistence**: Assignments persist before and after account creation
6. **Profile Display**: Users see their information correctly
7. **Group Visibility**: Supervisors see assigned groups, students see their group

### ⚠️ Current Limitations:

1. **Matric Number Login**: System currently uses email for login (not matric number)
2. **Automatic Group Linking**: Students aren't automatically linked to groups by matric number
3. **Real-time Updates**: Group assignments may require page refresh to appear
4. **Email Verification**: Not implemented (accounts are immediately active)

## Troubleshooting

### Common Issues:

1. **Database Connection Errors**:
   - Check `.env` file in backend folder
   - Verify MySQL server is running
   - Confirm database exists and schema is loaded

2. **Login Issues**:
   - Check password hashing (bcrypt)
   - Verify JWT_SECRET is set in environment
   - Check user is_active status

3. **Group Assignment Not Showing**:
   - Verify supervisor_assignments table has correct data
   - Check supervisor_capacity triggers are working
   - Refresh the page or re-login

4. **Registration Failures**:
   - Check for unique constraint violations (email, matric number)
   - Verify all required fields are provided
   - Check database foreign key constraints

### Debug Commands:

```bash
# Check backend logs
cd backend
npm start

# Test database connection
node ../quick-behavior-test.js

# Check specific user data
mysql -u root -p supervise360 -e "SELECT * FROM users WHERE email = 'your-email@domain.com';"
```

## Success Criteria

The system passes all tests if:

1. ✅ Admin can create groups and assign supervisors
2. ✅ Students can register with matric numbers and login
3. ✅ Supervisors can register with emails and login  
4. ✅ Group assignments appear on user profiles immediately
5. ✅ Data remains consistent before and after account creation
6. ✅ No reassignment needed after user login
7. ✅ All role-based dashboards function correctly

Run through all test scenarios and verify the expected results to confirm your system is working as intended.