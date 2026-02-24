# Supervise360

Student supervision management system for universities. Handles group formation, supervisor assignment, reports, and defense scheduling.

## Quick Start

```bash
# Install dependencies
npm install
cd backend && npm install

# Configure
cp backend/.env.example backend/.env
# Edit backend/.env with MySQL credentials

# Run
npm run dev          # Frontend (port 5173)
cd backend && npm run dev   # Backend (port 5000)
```

**Full setup:** See [docs/QUICK_START.md](docs/QUICK_START.md) and [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md).

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, MySQL
- **Database:** MySQL (see [docs/DATABASE_SETUP_GUIDE.md](docs/DATABASE_SETUP_GUIDE.md))

## Project Structure

```
supervise360/
├── src/           # Frontend React app
├── backend/       # Express API
├── database/      # SQL schemas (improved_schema.sql, triggers.sql, views.sql)
├── docs/          # Documentation (see docs/INDEX.md)
└── scripts/       # Utilities (test-database.js, legacy/)
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/INDEX.md](docs/INDEX.md) | Documentation navigator |
| [docs/QUICK_START.md](docs/QUICK_START.md) | 5-minute setup |
| [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) | Full installation |
| [docs/DATABASE_SETUP_GUIDE.md](docs/DATABASE_SETUP_GUIDE.md) | MySQL setup |
| [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md) | Email/SMTP configuration |
| [backend/README.md](backend/README.md) | Backend API details |

## Key Features

- **Authentication:** Student, Supervisor, Admin roles
- **Group Formation:** ASP-based GPA-balanced grouping
- **Supervisor Assignment:** Auto-assign with even workload
- **Reports:** Upload, review, feedback
- **Defense Scheduling:** Panel allocation and scheduling
