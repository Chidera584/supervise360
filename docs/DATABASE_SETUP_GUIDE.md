c# MySQL Database Setup Guide for Supervise360

## Prerequisites

1. **MySQL Server** - Install MySQL 8.0 or higher
2. **MySQL Workbench** (optional but recommended for GUI management)

## Step 1: Create the Database

### Option A: Using MySQL Command Line
```bash
# Connect to MySQL
mysql -u root -p

# Run the schema
source database/improved_schema.sql
source database/triggers.sql
source database/views.sql
```

### Option B: Using MySQL Workbench
1. Open MySQL Workbench
2. Connect to your MySQL server
3. Open and execute `database/improved_schema.sql`
4. Open and execute `database/triggers.sql`
5. Open and execute `database/views.sql`

## Step 2: Configure Environment Variables

Update your `.env` file with your MySQL credentials:

```env
# MySQL Database Configuration
VITE_DB_HOST=localhost
VITE_DB_USER=root
VITE_DB_PASSWORD=your_mysql_password
VITE_DB_NAME=supervise360
VITE_DB_PORT=3306
```

## Step 3: Test Database Connection

Run the connection test:

```bash
npm run test-db
```

Or create a simple test file:

```typescript
import { testConnection } from './src/lib/database';

testConnection().then(success => {
  console.log(success ? '✅ Connected!' : '❌ Failed!');
});
```

## Database Schema Overview

### Core Tables
- **users** - Base user information for all roles
- **students** - Student-specific data (GPA, matric number)
- **supervisors** - Supervisor-specific data (capacity, specialization)
- **groups** - Student groups with member tracking
- **projects** - Group projects with status tracking
- **reports** - File submissions with review status
- **evaluations** - Project scoring and feedback
- **defense_panels** - Defense scheduling and results
- **messages** - Internal messaging system
- **notifications** - System notifications
- **audit_logs** - Change tracking for security

### Key Features
- **Automatic GPA tier calculation** (HIGH/MEDIUM/LOW)
- **Supervisor workload management** with capacity tracking
- **Group formation** with automatic member counting
- **Project workflow** (pending → approved → in_progress → completed)
- **Comprehensive evaluation system** with scoring rubrics
- **Defense panel scheduling** with internal/external supervisors
- **Audit logging** for all critical changes
- **Notification system** with automatic triggers

### Views for Easy Querying
- `v_students_complete` - Students with group and supervisor info
- `v_supervisor_workload` - Supervisor capacity and availability
- `v_groups_with_members` - Groups with member details
- `v_projects_complete` - Projects with all related information
- `v_admin_dashboard_stats` - Admin dashboard statistics
- `v_student_dashboard` - Student-specific dashboard data
- `v_supervisor_dashboard` - Supervisor-specific dashboard data

## Sample Data (Optional)

To populate with test data, you can run:

```sql
-- Create admin user
INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES 
('Admin', 'User', 'admin@supervise360.com', '$2a$12$hash_here', 'admin');

-- Create sample supervisor
INSERT INTO users (first_name, last_name, email, password_hash, role, department) VALUES 
('Dr. John', 'Smith', 'john.smith@university.edu', '$2a$12$hash_here', 'supervisor', 'Computer Science');

INSERT INTO supervisors (user_id, department, specialization) VALUES 
(2, 'Computer Science', 'Machine Learning, Data Science');

-- Create sample students
INSERT INTO users (first_name, last_name, email, password_hash, role, department) VALUES 
('Alice', 'Johnson', 'alice@student.edu', '$2a$12$hash_here', 'student', 'Computer Science'),
('Bob', 'Wilson', 'bob@student.edu', '$2a$12$hash_here', 'student', 'Computer Science'),
('Carol', 'Davis', 'carol@student.edu', '$2a$12$hash_here', 'student', 'Computer Science');

INSERT INTO students (user_id, matric_number, gpa) VALUES 
(3, 'CS2021001', 3.85),
(4, 'CS2021002', 3.45),
(5, 'CS2021003', 3.92);
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure MySQL server is running
   - Check host and port in `.env`
   - Verify firewall settings

2. **Access Denied**
   - Check username and password
   - Ensure user has proper privileges
   - Try: `GRANT ALL PRIVILEGES ON supervise360.* TO 'your_user'@'localhost';`

3. **Database Not Found**
   - Run the schema creation script first
   - Check database name in `.env`

4. **Trigger/View Errors**
   - Ensure you have CREATE privilege
   - Run scripts in order: schema → triggers → views

### Performance Tips

1. **Indexing** - All important columns are already indexed
2. **Connection Pooling** - Already configured in `database.ts`
3. **Query Optimization** - Use the provided views for complex queries
4. **Regular Maintenance** - Set up automated backups

## Migration from Supabase

If migrating from Supabase:

1. Export your existing data
2. Transform data to match new schema
3. Import using the service layer functions
4. Update frontend to use new database service
5. Test thoroughly before removing Supabase dependencies

## Security Considerations

- Use strong passwords for database users
- Enable SSL connections in production
- Regularly update MySQL server
- Monitor audit logs for suspicious activity
- Implement proper backup and recovery procedures