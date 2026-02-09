# Supervise360 Backend API

Node.js + Express + MySQL backend for the Supervise360 student supervision system.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your MySQL credentials
# Make sure to set your MySQL password!
```

### 3. Set Up Database
Make sure your MySQL server is running and the `supervise360` database exists with all tables created.

### 4. Start Development Server
```bash
npm run dev
```

The server will start on `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts          # Database connection & utilities
│   ├── middleware/
│   │   ├── auth.ts              # JWT authentication middleware
│   │   └── validation.ts        # Request validation schemas
│   ├── routes/
│   │   ├── auth.ts              # Authentication endpoints
│   │   └── users.ts             # User management endpoints
│   ├── services/
│   │   └── authService.ts       # Authentication business logic
│   ├── types/
│   │   └── index.ts             # TypeScript type definitions
│   └── server.ts                # Express server setup
├── uploads/                     # File upload directory
├── .env                         # Environment variables
├── .env.example                 # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/students` - Get all students
- `GET /api/users/supervisors` - Get all supervisors
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `PUT /api/users/:id/status` - Update user status (Admin only)

### Health Check
- `GET /health` - Server health check

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication:

1. **Login/Register** returns a JWT token
2. **Include token** in requests: `Authorization: Bearer <token>`
3. **Token expires** in 7 days (configurable)

## 🛡️ Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate limiting** - Prevent abuse
- **Input validation** - Joi schemas
- **Password hashing** - bcrypt
- **JWT tokens** - Secure authentication

## 📊 Database Integration

- **Connection pooling** for performance
- **Prepared statements** to prevent SQL injection
- **Transaction support** for data integrity
- **Database views** for complex queries
- **Triggers** for automated business logic

## 🔧 Development

### Available Scripts
```bash
npm run dev        # Start development server with hot reload
npm run build      # Build for production
npm start          # Start production server
npm run lint       # Run ESLint
npm test           # Run tests
```

### Environment Variables
```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=supervise360
DB_PORT=3306

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d

# CORS
FRONTEND_URL=http://localhost:5173
```

## 🚀 Production Deployment

### 1. Build the Application
```bash
npm run build
```

### 2. Set Production Environment
```bash
export NODE_ENV=production
```

### 3. Start the Server
```bash
npm start
```

### 4. Use Process Manager (Recommended)
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/server.js --name supervise360-api

# Save PM2 configuration
pm2 save
pm2 startup
```

## 🔍 Troubleshooting

### Database Connection Issues
1. Check MySQL server is running
2. Verify credentials in `.env`
3. Ensure database `supervise360` exists
4. Check if tables are created

### CORS Issues
1. Verify `FRONTEND_URL` in `.env`
2. Check frontend is running on correct port
3. Ensure CORS headers are properly set

### JWT Token Issues
1. Check `JWT_SECRET` is set
2. Verify token format: `Bearer <token>`
3. Check token expiration

## 📝 API Response Format

All API responses follow this format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data here
  }
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## 🧪 Testing

Test the API endpoints:

```bash
# Health check
curl http://localhost:5000/health

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"first_name":"John","last_name":"Doe","email":"john@test.com","password":"password123","role":"student","matric_number":"ST001","gpa":3.5}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@test.com","password":"password123"}'
```