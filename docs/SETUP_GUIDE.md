# 🚀 Complete Setup Guide for Supervise360

## Overview
Your project now has a complete **3-tier architecture**:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript  
- **Database**: MySQL with complete schema

## 📋 Prerequisites
- Node.js 18+ installed
- MySQL 8.0+ installed and running
- Git (optional)

## 🗄️ Step 1: Database Setup

### 1.1 Create Database
```sql
-- Connect to MySQL
mysql -u root -p

-- Create database
CREATE DATABASE supervise360 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE supervise360;
```

### 1.2 Run Schema Files
```bash
# From your project root directory
mysql -u root -p supervise360 < database/improved_schema.sql
mysql -u root -p supervise360 < database/basic_triggers.sql
mysql -u root -p supervise360 < database/views.sql
```

### 1.3 Verify Database
```sql
-- Check tables
SHOW TABLES;

-- Check triggers  
SHOW TRIGGERS;

-- Check views
SHOW FULL TABLES WHERE Table_type = 'VIEW';
```

## 🔧 Step 2: Backend Setup

### 2.1 Install Dependencies
```bash
cd backend
npm install
```

### 2.2 Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your MySQL password
# Update DB_PASSWORD=your_mysql_password
```

### 2.3 Start Backend Server
```bash
npm run dev
```

You should see:
```
✅ Database connected successfully
🚀 Server running on port 5000
```

## 🎨 Step 3: Frontend Setup

### 3.1 Install Dependencies (if not done)
```bash
# From project root
npm install
```

### 3.2 Configure Environment
Update your `.env` file:
```env
VITE_USE_MYSQL=true
VITE_API_URL=http://localhost:5000/api
```

### 3.3 Start Frontend
```bash
npm run dev
```

## 🧪 Step 4: Test the System

### 4.1 Open Frontend
Visit: `http://localhost:5173`

### 4.2 Test Database Connection
The app will automatically test the backend connection on startup.

### 4.3 Test Authentication
1. Click "Test as Student" for dummy login
2. Or create a real account using "Sign Up"

### 4.4 Test API Endpoints
```bash
# Health check
curl http://localhost:5000/health

# Register a test user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe", 
    "email": "john@test.com",
    "password": "password123",
    "role": "student",
    "department": "Computer Science",
    "matric_number": "ST001",
    "gpa": 3.75
  }'
```

## 🔄 Development Workflow

### Running Both Servers
You need **2 terminal windows**:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### Making Changes
- **Frontend changes**: Auto-reload in browser
- **Backend changes**: Auto-restart with nodemon
- **Database changes**: Restart backend after schema updates

## 📁 Project Structure
```
supervise360/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, validation
│   │   └── config/         # Database config
│   ├── .env               # Backend environment
│   └── package.json
├── database/              # MySQL schema files
│   ├── improved_schema.sql
│   ├── basic_triggers.sql
│   └── views.sql
├── src/                   # React frontend
│   ├── contexts/          # Auth context
│   ├── lib/              # API client
│   ├── pages/            # React pages
│   └── types/            # TypeScript types
├── .env                  # Frontend environment
└── package.json
```

## 🛠️ Troubleshooting

### Database Issues
```bash
# Check MySQL is running
sudo systemctl status mysql  # Linux
brew services list | grep mysql  # macOS

# Test connection
mysql -u root -p -e "SELECT 1"

# Check database exists
mysql -u root -p -e "SHOW DATABASES LIKE 'supervise360'"
```

### Backend Issues
```bash
# Check if port 5000 is free
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Check environment variables
cd backend && cat .env

# View logs
cd backend && npm run dev
```

### Frontend Issues
```bash
# Check if port 5173 is free
lsof -i :5173  # macOS/Linux

# Clear cache and restart
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### CORS Issues
Make sure backend `.env` has:
```env
FRONTEND_URL=http://localhost:5173
```

## 🎯 Next Steps

Once everything is running:

1. **Test all features** using dummy accounts
2. **Create real user accounts** via registration
3. **Explore the database** to see data being created
4. **Add more API endpoints** as needed
5. **Deploy to production** when ready

## 🚀 Production Deployment

### Backend Deployment
- Use PM2 for process management
- Set `NODE_ENV=production`
- Use environment variables for secrets
- Set up SSL/HTTPS
- Use a reverse proxy (nginx)

### Frontend Deployment
```bash
npm run build
# Deploy dist/ folder to your hosting service
```

### Database Deployment
- Use managed MySQL service (AWS RDS, etc.)
- Set up backups
- Configure SSL connections
- Monitor performance

## 📞 Support

If you encounter issues:
1. Check the console logs (browser & terminal)
2. Verify all environment variables are set
3. Ensure MySQL server is running
4. Check that all dependencies are installed
5. Verify ports 5000 and 5173 are available

Your complete full-stack application is now ready! 🎉