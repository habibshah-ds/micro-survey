# Survey CAPTCHA Dashboard API

Backend API for the Survey CAPTCHA platform.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Database
```bash
docker-compose up -d postgres redis
```

### 4. Run Migrations
```bash
npm run migrate
```

### 5. Start Server
```bash
# Development
npm run dev

# Production
NODE_ENV=production npm start
```

## Testing
```bash
# Create test database
createdb dashboard_test

# Run migrations on test DB
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/dashboard_test npm run migrate

# Run tests
npm test
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Organizations
- `POST /api/organizations` - Create organization
- `GET /api/organizations` - List organizations
- `GET /api/organizations/:id` - Get organization
- `PUT /api/organizations/:id` - Update organization
- `DELETE /api/organizations/:id` - Delete organization

### Questions
- `POST /api/questions` - Create question
- `GET /api/questions` - List questions
- `GET /api/questions/:id` - Get question
- `PUT /api/questions/:id` - Update question
- `DELETE /api/questions/:id` - Delete question

## Environment Variables

See `.env.example` for all required variables.

**Critical**: 
- Change `JWT_SECRET` in production
- URL-encode special characters in `DATABASE_URL`

## Docker
```bash
# Start all services
docker-compose up

# Production build
docker build -t dashboard-api:latest .
```

## Security

- Secrets in httpOnly cookies
- CSRF protection enabled
- Rate limiting on all routes
- Input validation with Joi
- SQL injection protection (parameterized queries)
