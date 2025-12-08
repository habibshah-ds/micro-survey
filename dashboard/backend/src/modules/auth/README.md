-- ============================================
-- FILE: backend/src/modules/auth/README.md
-- Complete documentation with examples
-- ============================================
/*
# Authentication Module

Production-ready authentication system with JWT tokens, refresh token rotation, rate limiting, and password reset functionality.

## Features

✅ **Secure Registration & Login**
- Bcrypt password hashing (cost 12)
- Email validation
- Automatic organization creation

✅ **Token Management**
- Short-lived access tokens (15 min)
- Long-lived refresh tokens (30 days)
- Automatic token rotation (replay attack prevention)
- HttpOnly cookies for refresh tokens
- Token revocation on logout

✅ **Password Reset**
- Secure reset tokens (6-hour expiry)
- Email delivery (configurable)
- Single-use tokens
- All sessions revoked on password change

✅ **Security Features**
- Rate limiting (5 attempts per 15 min)
- IP tracking for audit
- CSRF protection ready
- Token hashing (SHA-256)
- No plaintext tokens stored

## API Endpoints

### 1. User Registration

**POST** `/api/auth/signup`

Register a new user account and create a default organization.

```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "fullName": "John Doe"
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "user"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Cookie Set:** `refreshToken` (HttpOnly, Secure, 30 days)

---

### 2. User Login

**POST** `/api/auth/login`

Authenticate with email and password.

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "user"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Rate Limiting:** 5 attempts per 15 minutes per IP

---

### 3. Refresh Access Token

**POST** `/api/auth/refresh`

Get a new access token using refresh token. **Old refresh token is automatically revoked** (rotation).

```bash
# Using cookie (preferred)
curl -X POST http://localhost:5000/api/auth/refresh \
  -b "refreshToken=your_refresh_token"

# Using body (fallback)
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "your_refresh_token"}'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "new_access_token_here"
  }
}
```

**Cookie Set:** New `refreshToken` (old one is revoked)

---

### 4. Logout

**POST** `/api/auth/logout`

Revoke refresh token and clear cookies.

```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -b "refreshToken=your_refresh_token"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### 5. Get Current User

**GET** `/api/auth/me`

Get authenticated user's profile.

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer your_access_token"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "user",
      "isEmailVerified": false,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "lastLoginAt": "2025-01-15T14:30:00.000Z"
    }
  }
}
```

---

### 6. Request Password Reset

**POST** `/api/auth/request-password-reset`

Request a password reset link via email.

```bash
curl -X POST http://localhost:5000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "If email exists, reset link will be sent"
}
```

**Rate Limiting:** 3 attempts per hour per IP

**Note:** For security, the same response is returned whether the email exists or not.

---

### 7. Reset Password

**POST** `/api/auth/reset-password`

Reset password using the token from email.

```bash
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset_token_from_email",
    "newPassword": "NewSecurePass123!"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

**Side Effects:**
- Password is updated
- All existing refresh tokens are revoked
- User must log in again

---

## Environment Variables

Add these to your `.env` file:

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-key-min-32-characters-long
ACCESS_TOKEN_EXPIRES_MIN=15
REFRESH_TOKEN_EXPIRES_DAYS=30

# Password Hashing
BCRYPT_COST=12

# Rate Limiting
LOGIN_RATE_LIMIT_MAX=5
LOGIN_RATE_LIMIT_WINDOW_MIN=15

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:5173

# Email Configuration (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

## Security Considerations

### 🔒 Token Security

1. **Access Tokens**
   - Short-lived (15 minutes)
   - Stored in memory on client
   - Sent via Authorization header
   - Cannot be revoked (design trade-off for performance)

2. **Refresh Tokens**
   - Long-lived (30 days)
   - Stored in HttpOnly cookies
   - Only SHA-256 hash stored in database
   - Can be revoked
   - Automatically rotated on each use

### 🛡️ Protection Measures

- **Rate Limiting:** Prevents brute-force attacks
- **Token Rotation:** Old refresh tokens cannot be reused
- **IP Tracking:** Audit trail for security investigations
- **Password Hashing:** Bcrypt with cost factor 12
- **Secure Cookies:** HttpOnly, Secure (in production), SameSite
- **CSRF Ready:** Cookie-based refresh tokens work with CSRF middleware

### ⚠️ Important Notes

1. **Never log tokens:** Tokens are sanitized from logs
2. **HTTPS in production:** Required for secure cookies
3. **Rotate JWT_SECRET:** Change on suspected compromise
4. **Monitor failed logins:** Implement alerting for repeated failures
5. **Token cleanup:** Run `SELECT cleanup_expired_tokens()` daily

## Testing

### Run All Tests

```bash
cd backend
npm test
```

### Run Specific Test Suites

```bash
# Unit tests only
npm test -- auth.unit.test.js

# Integration tests only
npm test -- auth.integration.test.js

# With coverage
npm run test:coverage
```

### Manual Testing Flow

```bash
# 1. Register
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234!","fullName":"Test User"}' \
  -c cookies.txt

# 2. Get current user
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234!"}' | jq -r '.data.accessToken')

curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 3. Refresh token
curl -X POST http://localhost:5000/api/auth/refresh \
  -b cookies.txt

# 4. Logout
curl -X POST http://localhost:5000/api/auth/logout \
  -b cookies.txt
```

## Deployment Checklist

### Before Deployment

- [ ] Generate strong `JWT_SECRET` (min 32 chars)
  ```bash
  openssl rand -base64 48
  ```
- [ ] Set `NODE_ENV=production`
- [ ] Configure email provider
- [ ] Set correct `FRONTEND_URL`
- [ ] Enable HTTPS
- [ ] Review rate limit thresholds
- [ ] Set up database backups

### After Deployment

- [ ] Run migration: `npm run migrate`
- [ ] Test signup/login flow
- [ ] Test password reset email
- [ ] Verify secure cookies set
- [ ] Monitor error logs
- [ ] Set up token cleanup cron job

### Cron Job for Token Cleanup

Add to crontab to run daily at 2 AM:

```bash
0 2 * * * psql $DATABASE_URL -c "SELECT cleanup_expired_tokens();"
```

## Troubleshooting

### Issue: "Invalid refresh token" on refresh

**Cause:** Token already used (rotation) or expired.

**Solution:** User must log in again.

---

### Issue: Rate limit exceeded

**Cause:** Too many failed login attempts.

**Solution:** Wait 15 minutes or implement IP whitelist for testing.

---

### Issue: Password reset email not sent

**Cause:** Email service not configured.

**Solution:** 
1. Check SMTP configuration in `.env`
2. Review logs for email service errors
3. For development, reset token is logged to console

---

### Issue: "Token expired" immediately after login

**Cause:** Server/client time mismatch.

**Solution:** Sync server time with NTP.

## Email Service Integration

The default implementation logs reset emails to console. For production, integrate with:

**SendGrid:**
```javascript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendPasswordResetEmail(email, name, resetUrl) {
  await sgMail.send({
    to: email,
    from: process.env.EMAIL_FROM,
    subject: 'Reset your password',
    html: `<p>Hi ${name},</p><p><a href="${resetUrl}">Reset password</a></p>`,
  });
}
```

**AWS SES:**
```javascript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: 'us-east-1' });

async function sendPasswordResetEmail(email, name, resetUrl) {
  await ses.send(new SendEmailCommand({
    Source: process.env.EMAIL_FROM,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: 'Reset your password' },
      Body: { Html: { Data: `<a href="${resetUrl}">Reset</a>` } },
    },
  }));
}
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs api`
2. Review test output: `npm test`
3. Check database: `psql $DATABASE_URL`
4. Contact team via Slack

## License

MIT
