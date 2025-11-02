# Authentication & Authorization System (MAN-6)

## Overview

The platform uses cookie-based session authentication with bcrypt password hashing and role-based access control (RBAC). All authentication flows include email verification and secure password reset mechanisms.

---

## Authentication Flows

### 1. Registration Flow

```
User → POST /auth/register
       ↓
   Validate Input
   (email format, password strength)
       ↓
   Check Email Exists?
   (D1 query: users table)
       ↓
   Hash Password
   (bcrypt, cost 12)
       ↓
   Create User Record
   (D1 insert: users table)
       ↓
   Generate Verification Token
   (crypto.randomUUID())
       ↓
   Store Token
   (D1 insert: verification_tokens)
       ↓
   Send Verification Email
   (MailChannels)
       ↓
   Return Success
   {success: true, userId}
```

**API Endpoint:**
```javascript
POST /auth/register
Content-Type: application/json

{
  "email": "author@example.com",
  "password": "SecurePassword123!",
  "fullName": "Author Name"
}

Response (201 Created):
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "userId": "uuid-here"
}
```

**Security Measures:**
- Email uniqueness enforced (DB constraint)
- Password minimum length: 8 characters
- Password hashed with bcrypt (cost 12)
- Account starts unverified (`email_verified = 0`)
- Verification token expires in 24 hours

**Files:**
- Handler: `auth-handlers.js:handleRegister()`
- Frontend: `frontend/register.html`

---

### 2. Email Verification Flow

```
User Clicks Email Link
       ↓
GET /auth/verify-email?token=xxx
       ↓
   Lookup Token
   (D1: verification_tokens)
       ↓
   Check Token Valid?
   ├─ Expired? → Error
   ├─ Used? → Error
   └─ Valid → Continue
       ↓
   Update User Record
   (SET email_verified = 1)
       ↓
   Mark Token as Used
   (UPDATE verification_tokens)
       ↓
   Redirect to Login
   (with success message)
```

**API Endpoint:**
```javascript
GET /auth/verify-email?token=verification-token-uuid

Response (Redirect):
Location: /login.html?verified=true
```

**Token Properties:**
- Random UUID (crypto-secure)
- Stored hashed in database
- Expires after 24 hours
- Single-use (marked as used after verification)

**Files:**
- Handler: `auth-handlers.js:handleVerifyEmail()`
- Frontend: `frontend/verify-email.html`

---

### 3. Login Flow

```
User → POST /auth/login
       ↓
   Rate Limit Check
   (KV: login attempts)
       ↓
   Lookup User by Email
   (D1: users table)
       ↓
   User Found?
   └─ No → Generic Error (security)
       ↓
   Compare Password
   (bcrypt.compare)
       ↓
   Password Correct?
   └─ No → Increment Failed Attempts
          → Return Error after 5 attempts
       ↓
   Check Email Verified?
   └─ No → Return "Verify email first"
       ↓
   Create Session
   (Generate session ID)
       ↓
   Store Session
   (D1: sessions table)
       ↓
   Cache Session
   (KV: 30 min TTL)
       ↓
   Set Cookie
   (HttpOnly, Secure, SameSite)
       ↓
   Update Last Login
   (D1: UPDATE users)
       ↓
   Return Success
   {success: true, user}
```

**API Endpoint:**
```javascript
POST /auth/login
Content-Type: application/json

{
  "email": "author@example.com",
  "password": "SecurePassword123!"
}

Response (200 OK):
Set-Cookie: session=uuid; HttpOnly; Secure; SameSite=Strict; Max-Age=1800

{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "author@example.com",
    "fullName": "Author Name",
    "role": "author",
    "subscriptionTier": "FREE"
  }
}
```

**Security Measures:**
- Rate limiting: 5 failed attempts = 15 min lockout
- Generic error messages (don't reveal if email exists)
- Passwords compared using bcrypt (timing-safe)
- Sessions have 30-minute inactivity timeout
- Secure cookie flags prevent XSS/CSRF

**Files:**
- Handler: `auth-handlers.js:handleLogin()`
- Frontend: `frontend/login.html`

---

### 4. Password Reset Flow

#### Step 1: Request Reset

```
User → POST /auth/password-reset-request
       ↓
   Lookup User by Email
   (D1: users table)
       ↓
   User Found?
   ├─ No → Return Success (don't reveal)
   └─ Yes → Continue
       ↓
   Generate Reset Token
   (crypto.randomUUID())
       ↓
   Store Token
   (D1: password_reset_tokens)
   (expires in 1 hour)
       ↓
   Send Reset Email
   (MailChannels with link)
       ↓
   Return Success
   (even if email not found - security)
```

**API Endpoint:**
```javascript
POST /auth/password-reset-request
Content-Type: application/json

{
  "email": "author@example.com"
}

Response (200 OK):
{
  "success": true,
  "message": "If an account exists with that email, a password reset link has been sent."
}
```

#### Step 2: Reset Password

```
User Clicks Email Link
       ↓
GET /auth/verify-reset-token?token=xxx
       ↓
   Validate Token
   (D1: password_reset_tokens)
   ├─ Expired? → Error
   ├─ Used? → Error
   └─ Valid → Show Form
       ↓
User → POST /auth/password-reset
       ↓
   Validate Token Again
       ↓
   Hash New Password
   (bcrypt, cost 12)
       ↓
   Update User Password
   (D1: UPDATE users)
       ↓
   Mark Token as Used
       ↓
   Invalidate All Sessions
   (security: force re-login)
       ↓
   Send Confirmation Email
       ↓
   Redirect to Login
```

**API Endpoints:**
```javascript
// Step 1: Verify token is valid
GET /auth/verify-reset-token?token=reset-token-uuid

Response (200 OK):
{
  "valid": true
}

// Step 2: Reset password
POST /auth/password-reset
Content-Type: application/json

{
  "token": "reset-token-uuid",
  "newPassword": "NewSecurePassword123!"
}

Response (200 OK):
{
  "success": true,
  "message": "Password has been reset successfully."
}
```

**Security Measures:**
- Token expires in 1 hour
- Single-use tokens
- All sessions invalidated after password change
- Confirmation email sent
- Generic success messages (don't reveal if email exists)

**Files:**
- Handler: `auth-handlers.js:handlePasswordResetRequest()`, `handlePasswordReset()`
- Frontend: `frontend/forgot-password.html`, `frontend/password-reset.html`

---

### 5. Logout Flow

```
User → POST /auth/logout
       ↓
   Get Session from Cookie
       ↓
   Delete Session from D1
   (D1: DELETE FROM sessions)
       ↓
   Delete Session from KV Cache
   (KV: delete)
       ↓
   Clear Cookie
   (Set-Cookie with Max-Age=0)
       ↓
   Return Success
```

**API Endpoint:**
```javascript
POST /auth/logout

Response (200 OK):
Set-Cookie: session=; Max-Age=0; HttpOnly; Secure

{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Session Management

### Session Creation

```javascript
// Generate session ID
const sessionId = crypto.randomUUID();

// Store in D1 (persistent)
await env.DB.prepare(`
  INSERT INTO sessions (session_id, user_id, created_at, expires_at)
  VALUES (?, ?, ?, ?)
`).bind(sessionId, userId, now, expiresAt).run();

// Cache in KV (fast lookup)
await env.SESSIONS.put(
  `session:${sessionId}`,
  JSON.stringify({ userId, role, email }),
  { expirationTtl: 1800 } // 30 minutes
);

// Set cookie
const cookie = `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=1800; Path=/`;
```

### Session Validation

```javascript
// Middleware checks every request
async function authenticateRequest(request, env) {
  // 1. Extract session ID from cookie
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sessionId = cookies.session;

  if (!sessionId) {
    return null; // Not authenticated
  }

  // 2. Check KV cache first (fast)
  const cached = await env.SESSIONS.get(`session:${sessionId}`, 'json');
  if (cached) {
    return cached; // Cache hit
  }

  // 3. Check D1 database (cache miss)
  const session = await env.DB.prepare(`
    SELECT user_id, role FROM sessions
    WHERE session_id = ? AND expires_at > ?
  `).bind(sessionId, Date.now()).first();

  if (!session) {
    return null; // Session expired or doesn't exist
  }

  // 4. Refresh KV cache
  await env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: 1800 }
  );

  return session;
}
```

### Session Expiration

**Timeout Configuration:**
- **Inactivity Timeout**: 30 minutes (no requests)
- **Absolute Timeout**: None (session valid until logout or expiry)
- **Extension**: Each request extends the session

**Cleanup:**
- Expired sessions cleaned up periodically
- KV auto-expires sessions after TTL
- D1 sessions cleaned manually (scheduled job needed)

---

## Authorization (RBAC)

### Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **author** | Regular user | Own manuscripts, subscriptions |
| **publisher** | Publishing house | Same as author (future: team features) |
| **admin** | Platform administrator | Full access to all resources |

### Permission Checks

```javascript
// Check if user is admin
function assertAdmin(userId, role) {
  if (role !== 'admin') {
    throw new AuthorizationError('Admin access required');
  }
}

// Check if user owns resource
async function assertOwnership(userId, manuscriptId, env) {
  const manuscript = await env.DB.prepare(
    'SELECT user_id FROM manuscripts WHERE id = ?'
  ).bind(manuscriptId).first();

  if (!manuscript || manuscript.user_id !== userId) {
    throw new AuthorizationError('Access denied');
  }
}

// Middleware for protected routes
async function requireAuth(c, next) {
  const userId = c.get('userId'); // Set by auth middleware

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return next();
}

// Middleware for admin routes
async function requireAdmin(c, next) {
  const role = c.get('role');

  if (role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  return next();
}
```

### Protected Routes

```javascript
// Public routes (no auth required)
app.post('/auth/register', handleRegister);
app.post('/auth/login', handleLogin);
app.get('/auth/verify-email', handleVerifyEmail);
app.post('/auth/password-reset-request', handlePasswordResetRequest);

// Protected routes (auth required)
app.get('/manuscripts', requireAuth, listManuscripts);
app.post('/manuscripts', requireAuth, uploadManuscript);
app.get('/manuscripts/:id', requireAuth, getManuscript);

// Admin routes (admin role required)
app.get('/admin/users', requireAdmin, listUsers);
app.put('/admin/users/:id/ban', requireAdmin, banUser);
app.get('/admin/analytics', requireAdmin, getAnalytics);
```

---

## Security Best Practices

### Password Security

**Hashing:**
```javascript
import bcrypt from 'bcryptjs';

// Hash password (cost 12 = ~250ms on modern CPU)
const hash = await bcrypt.hash(password, 12);

// Verify password (timing-safe comparison)
const valid = await bcrypt.compare(password, hash);
```

**Requirements:**
- Minimum 8 characters
- No maximum length (bcrypt handles truncation)
- Frontend validation + backend enforcement
- Never stored in plaintext
- Never logged

### Cookie Security

**Flags:**
```javascript
const cookie = [
  `session=${sessionId}`,
  'HttpOnly',           // Prevents JavaScript access (XSS protection)
  'Secure',             // HTTPS only
  'SameSite=Strict',    // CSRF protection
  'Max-Age=1800',       // 30 minutes
  'Path=/'              // Available site-wide
].join('; ');
```

### Rate Limiting

**Login Attempts:**
```javascript
// Check failed attempts
const attempts = await env.SESSIONS.get(`login:attempts:${email}`);

if (attempts >= 5) {
  throw new RateLimitError('Too many login attempts. Try again in 15 minutes.');
}

// Increment on failure
await env.SESSIONS.put(
  `login:attempts:${email}`,
  String(attempts + 1),
  { expirationTtl: 900 } // 15 minutes
);

// Clear on success
await env.SESSIONS.delete(`login:attempts:${email}`);
```

### Token Security

**Generation:**
```javascript
// Cryptographically secure random UUID
const token = crypto.randomUUID();

// Store hashed version (optional, depends on use case)
const hashedToken = await bcrypt.hash(token, 10);

// Send unhashed token to user
// Store hashed token in database
```

**Validation:**
```javascript
// Check expiration
if (token.expires_at < Date.now()) {
  throw new TokenExpiredError('Token has expired');
}

// Check if already used
if (token.used === 1) {
  throw new TokenUsedError('Token has already been used');
}

// Mark as used after validation
await env.DB.prepare(
  'UPDATE verification_tokens SET used = 1 WHERE token = ?'
).bind(token).run();
```

---

## Database Schema

### users Table

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                    -- UUID
  email TEXT UNIQUE NOT NULL,             -- Unique email
  password_hash TEXT NOT NULL,            -- bcrypt hash
  full_name TEXT,                         -- Display name
  role TEXT DEFAULT 'author',             -- author/publisher/admin
  subscription_tier TEXT DEFAULT 'FREE',  -- FREE/PRO/ENTERPRISE
  created_at INTEGER NOT NULL,            -- Unix timestamp
  last_login INTEGER,                     -- Unix timestamp
  email_verified INTEGER DEFAULT 0        -- 0 = not verified, 1 = verified
);

CREATE INDEX idx_users_email ON users(email);
```

### sessions Table

```sql
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,            -- UUID
  user_id TEXT NOT NULL,                  -- Foreign key
  created_at INTEGER NOT NULL,            -- Unix timestamp
  expires_at INTEGER NOT NULL,            -- Unix timestamp
  ip_address TEXT,                        -- Optional tracking
  user_agent TEXT,                        -- Optional tracking
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

### verification_tokens Table

```sql
CREATE TABLE verification_tokens (
  token TEXT PRIMARY KEY,                 -- UUID or random string
  user_id TEXT NOT NULL,                  -- Foreign key
  token_type TEXT NOT NULL,               -- email_verification/password_reset
  created_at INTEGER NOT NULL,            -- Unix timestamp
  expires_at INTEGER NOT NULL,            -- Unix timestamp
  used INTEGER DEFAULT 0,                 -- 0 = unused, 1 = used
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_tokens_expires ON verification_tokens(expires_at);
```

---

## API Reference

### Authentication Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/auth/register` | No | Create new account |
| POST | `/auth/login` | No | Authenticate user |
| POST | `/auth/logout` | Yes | End session |
| GET | `/auth/me` | Yes | Get current user info |
| GET | `/auth/verify-email` | No | Verify email address |
| POST | `/auth/password-reset-request` | No | Request password reset |
| GET | `/auth/verify-reset-token` | No | Validate reset token |
| POST | `/auth/password-reset` | No | Reset password with token |

### Error Responses

```javascript
// 400 Bad Request
{
  "error": "Invalid email format"
}

// 401 Unauthorized
{
  "error": "Invalid credentials"
}

// 403 Forbidden
{
  "error": "Admin access required"
}

// 429 Too Many Requests
{
  "error": "Too many login attempts. Try again in 15 minutes."
}
```

---

## Testing

### Test Scenarios

1. **Registration**
   - Valid registration
   - Duplicate email
   - Invalid email format
   - Weak password

2. **Login**
   - Valid credentials
   - Invalid credentials
   - Unverified email
   - Rate limiting (6+ attempts)

3. **Email Verification**
   - Valid token
   - Expired token
   - Used token
   - Invalid token

4. **Password Reset**
   - Valid email
   - Non-existent email
   - Expired token
   - Token reuse

5. **Session Management**
   - Session expiration
   - Session invalidation
   - Concurrent sessions
   - Session fixation attack

---

## Future Improvements

### Planned Enhancements

1. **Two-Factor Authentication (2FA)**
   - TOTP support
   - Backup codes
   - SMS verification (optional)

2. **OAuth Integration**
   - Google Sign-In
   - GitHub OAuth
   - Apple Sign-In

3. **Enhanced Security**
   - Device fingerprinting
   - Login notifications
   - Suspicious activity alerts
   - Session management UI

4. **Password Policies**
   - Complexity requirements
   - Password history
   - Expiration policies
   - Breach detection (Have I Been Pwned API)

---

## References

- **Files**: `auth-handlers.js`, `auth-utils.js`, `routes/auth.js`
- **Frontend**: `frontend/login.html`, `frontend/register.html`
- **Database**: `schema.sql`, `migrations/006-password-reset-tokens.sql`
- **Security**: [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

**Last Updated**: 2025-10-28
**Author**: System Documentation (MAN-6)
**Version**: 1.0
