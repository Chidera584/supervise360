# 📋 Quick Reference Guide

## Getting Started (Copy & Paste)

### 1️⃣ Database Setup
```bash
# Create database
mysql -u root -p
CREATE DATABASE supervise360 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Run schemas
mysql -u root -p supervise360 < database/improved_schema.sql
mysql -u root -p supervise360 < database/triggers.sql
mysql -u root -p supervise360 < database/views.sql
```

### 2️⃣ Configuration
```bash
# Create .env file (copy from .env.example if exists)
cp .env.example .env

# Edit with your MySQL credentials
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=supervise360
PORT=5000
JWT_SECRET=your_secret_key
```

### 3️⃣ Install & Run
```bash
# Install dependencies
npm install
cd backend && npm install && cd ..

# Terminal 1: Start Backend
cd backend
npm run dev

# Terminal 2: Start Frontend (new terminal)
npm run dev

# Access at http://localhost:5173
```

### 4️⃣ Create Test Account
```
Email: john@example.com
Password: test123456
Account Type: Student
Full Name: John Student
Student ID: S001
Department: Engineering
```

---

## 🗂️ Important Files

| File | Purpose |
|------|---------|
| `README.md` | 📖 Project overview & guide |
| `QUICK_START.md` | ⚡ 5-minute test |
| `SETUP_GUIDE.md` | 🔧 Full installation |
| `DATABASE_SETUP_GUIDE.md` | 🗄️ MySQL configuration |
| `CODEBASE_CLEANUP.md` | 🧹 What was cleaned |
| `RECOMMENDATIONS.md` | 💡 Next steps |
| `src/App.tsx` | 🎯 Frontend main app |
| `backend/src/server.ts` | 🖥️ Backend server |
| `database/improved_schema.sql` | 📊 Database schema |

---

## 🔗 API Endpoints

### Authentication
```
POST   /api/auth/login     - Login user
POST   /api/auth/register  - Create account
GET    /api/auth/me        - Get current user
```

### Users
```
GET    /api/users          - List all users
POST   /api/users          - Create user
GET    /api/users/:id      - Get user
PUT    /api/users/:id      - Update user
DELETE /api/users/:id      - Delete user
```

### Groups
```
GET    /api/groups         - List groups
POST   /api/groups         - Create group
GET    /api/groups/:id     - Get group details
PUT    /api/groups/:id     - Update group
DELETE /api/groups/:id     - Delete group
```

### Supervisors
```
GET    /api/supervisors    - List supervisors
POST   /api/supervisors    - Assign supervisor
```

---

## 📝 Useful Commands

### Frontend
```bash
npm run dev              # Start dev server (localhost:5173)
npm run build            # Build for production
npm run lint             # Check code style
npm run typecheck        # Verify TypeScript
```

### Backend
```bash
cd backend
npm run dev              # Start with auto-reload
npm run build            # Compile TypeScript
npm run start            # Run compiled code
npm run test             # Run tests
npm run lint             # Check code style
```

### Database
```bash
npm run test-db          # Test database connection

# Or manually:
mysql -u root -p supervise360
SHOW TABLES;
SELECT * FROM users;
```

---

## 🐛 Troubleshooting

### "Cannot connect to database"
```bash
# 1. Check MySQL is running
mysql -u root -p

# 2. Verify credentials in .env
cat .env | grep DB_

# 3. Check database exists
mysql -u root -p -e "SHOW DATABASES;"

# 4. Verify schema
mysql -u root -p supervise360 -e "SHOW TABLES;"
```

### "Port 5173 already in use"
```bash
# Kill frontend (port 5173)
npx kill-port 5173

# Or kill backend (port 5000)
npx kill-port 5000
```

### "Authentication failed"
```bash
# Clear browser storage
localStorage.clear()

# Check backend logs
# Terminal should show login attempts

# Verify JWT_SECRET in .env
```

---

## 📂 File Organization

```
supervise360/              Main project
├── src/                   Frontend React app
│   ├── pages/            Page components
│   ├── components/       Reusable components
│   ├── contexts/         Global state
│   └── lib/              Utilities
│
├── backend/              Backend Express API
│   └── src/
│       ├── routes/       API endpoints
│       ├── services/     Business logic
│       └── middleware/   Auth & validation
│
├── database/             Database schemas
│   ├── improved_schema.sql  ✅ Main schema (USE THIS)
│   ├── triggers.sql         ✅ Triggers
│   └── views.sql            ✅ Views
│
└── .archive/             Old files (not used)
    ├── test-files/
    ├── debug-docs/
    └── database-migrations/
```

---

## 🎯 Features by Role

### 👨‍🎓 Student
- [ ] Create account & login
- [ ] View group members
- [ ] Submit projects
- [ ] View evaluations
- [ ] Message supervisors

### 👨‍🏫 Supervisor
- [ ] Manage assigned groups
- [ ] Evaluate students
- [ ] Schedule defenses
- [ ] View workload
- [ ] Message students

### 👨‍💼 Admin
- [ ] Manage all users
- [ ] Create & manage groups
- [ ] Assign supervisors
- [ ] Import CSV data
- [ ] View analytics

---

## 🔐 Default Credentials (Testing)

**Note:** Create these accounts via signup form

| Role | Email | Password |
|------|-------|----------|
| Student | student@example.com | test123456 |
| Supervisor | supervisor@example.com | test123456 |
| Admin | admin@example.com | test123456 |

---

## 📚 Key Files to Know

### Core Logic
- `src/lib/asp-group-formation.ts` - Group formation algorithm
- `src/contexts/AuthContext.tsx` - Authentication state
- `backend/src/services/authService.ts` - Auth logic

### Components
- `src/pages/StudentDashboard.tsx` - Student main page
- `src/pages/SupervisorDashboard.tsx` - Supervisor main page
- `src/pages/AdminDashboard.tsx` - Admin main page

### Database
- `database/improved_schema.sql` - All tables
- `database/triggers.sql` - Auto-update logic
- `database/views.sql` - Query helpers

---

## 🚀 Next Steps

1. **Read**: [README.md](README.md) for complete overview
2. **Setup**: [SETUP_GUIDE.md](SETUP_GUIDE.md) for installation
3. **Test**: [QUICK_START.md](QUICK_START.md) for 5-minute demo
4. **Improve**: [RECOMMENDATIONS.md](RECOMMENDATIONS.md) for best practices

---

## 💡 Pro Tips

- **Use `.archive/` for reference**: Old test files available if needed
- **Git-safe**: Archive is ignored, won't affect commits
- **Portable**: No local configuration needed beyond `.env`
- **Type-safe**: Full TypeScript for frontend and backend
- **Well-documented**: Every page has inline comments

---

## 📞 Support Resources

| Question | Document |
|----------|----------|
| How do I start? | [QUICK_START.md](QUICK_START.md) |
| Full installation? | [SETUP_GUIDE.md](SETUP_GUIDE.md) |
| MySQL setup? | [DATABASE_SETUP_GUIDE.md](DATABASE_SETUP_GUIDE.md) |
| Project overview? | [README.md](README.md) |
| What was cleaned? | [CODEBASE_CLEANUP.md](CODEBASE_CLEANUP.md) |
| Best practices? | [RECOMMENDATIONS.md](RECOMMENDATIONS.md) |
| This quick ref? | [QUICK_REFERENCE.md](QUICK_REFERENCE.md) |

---

**Last Updated:** February 5, 2026  
**Status:** ✅ Ready for development
