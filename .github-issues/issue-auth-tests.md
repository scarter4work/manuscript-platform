# 🧪 Test Coverage: Authentication Handlers (0% → 80%+)

## Priority: CRITICAL (Recently Changed Code)
**Impact**: Recent bcrypt migration (Nov 5) deployed without tests
**Effort**: 12-16 hours
**Risk**: Password vulnerabilities, session hijacking, rate limit bypass

## Problem

Authentication handlers have **ZERO test coverage** despite being:
1. Recently migrated from PBKDF2 to bcrypt (commit d2b233a, Nov 5)
2. Recently fixed for PostgreSQL boolean checks (commit a4025ca, Nov 6)
3. Critical security surface (passwords, sessions, verification)
4. 862 lines of complex logic with 9 public endpoints

**Untested Critical Paths**:
- Password hashing (bcrypt migration)
- Email verification flow
- Password reset flow
- Rate limiting (5 attempts per 5 minutes)
- Session creation/destruction
- Token validation (verification, password reset)

## Current State

**File**: `src/handlers/auth-handlers.js` (862 lines)
**Handlers**: 9 functions
**Coverage**: 0%
**Recent Changes**: 2 migrations in 2 days with NO tests

## Required Tests (50+ test cases)

### 1. Registration Tests (10 tests)

```javascript
// tests/integration/handlers/auth-handlers.test.js
describe('POST /auth/register', () => {
  it('should register a new user with valid credentials', async () => {
    const response = await apiClient.post('/auth/register').send({
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      role: 'author'
    });

    expect(response.status).toBe(201);
    expect(response.body.userId).toBeDefined();
    expect(response.body.verificationToken).toBeDefined();

    // Verify user in database
    const user = await testDb.query('SELECT * FROM users WHERE email = $1', ['newuser@example.com']);
    expect(user.rows[0].email_verified).toBe(false);
    expect(user.rows[0].role).toBe('author');
  });

  it('should reject registration with weak password', async () => {
    const response = await apiClient.post('/auth/register').send({
      email: 'test@example.com',
      password: 'weak'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/password must be/i);
  });

  it('should reject registration with invalid email', async () => {
    const response = await apiClient.post('/auth/register').send({
      email: 'invalid-email',
      password: 'SecurePass123!'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/invalid email/i);
  });

  it('should reject registration with duplicate email', async () => {
    const email = 'duplicate@example.com';

    // Register first user
    await apiClient.post('/auth/register').send({
      email,
      password: 'SecurePass123!'
    });

    // Try to register again
    const response = await apiClient.post('/auth/register').send({
      email,
      password: 'DifferentPass456!'
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/email already registered/i);
  });

  it('should hash password with bcrypt', async () => {
    const response = await apiClient.post('/auth/register').send({
      email: 'bcrypt-test@example.com',
      password: 'TestPass123!'
    });

    const user = await testDb.query('SELECT password_hash FROM users WHERE email = $1', ['bcrypt-test@example.com']);
    const hash = user.rows[0].password_hash;

    // bcrypt hashes start with $2a$10$ or $2b$10$
    expect(hash).toMatch(/^\$2[ab]\$10\$/);
    expect(hash.length).toBe(60); // bcrypt hash length
  });

  it('should normalize email to lowercase', async () => {
    await apiClient.post('/auth/register').send({
      email: 'CaseSensitive@Example.COM',
      password: 'TestPass123!'
    });

    const user = await testDb.query('SELECT email FROM users WHERE email = $1', ['casesensitive@example.com']);
    expect(user.rows.length).toBe(1);
  });

  it('should create verification token', async () => {
    const response = await apiClient.post('/auth/register').send({
      email: 'verify-test@example.com',
      password: 'TestPass123!'
    });

    const token = response.body.verificationToken;
    expect(token).toBeTruthy();
    expect(token.length).toBe(64); // 32 bytes hex = 64 chars

    // Verify token in database
    const result = await testDb.query('SELECT * FROM verification_tokens WHERE token = $1', [token]);
    expect(result.rows[0].token_type).toBe('email_verification');
    expect(result.rows[0].used).toBe(false);
  });

  it('should create free subscription', async () => {
    const response = await apiClient.post('/auth/register').send({
      email: 'subscription-test@example.com',
      password: 'TestPass123!'
    });

    const userId = response.body.userId;
    const subscription = await testDb.query('SELECT * FROM subscriptions WHERE user_id = $1', [userId]);

    expect(subscription.rows[0].plan).toBe('free');
    expect(subscription.rows[0].status).toBe('active');
  });

  it('should send verification email', async () => {
    const mockEmailService = vi.spyOn(emailService, 'sendEmailVerification');

    await apiClient.post('/auth/register').send({
      email: 'email-test@example.com',
      password: 'TestPass123!'
    });

    expect(mockEmailService).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: 'email-test@example.com',
        verificationToken: expect.any(String)
      }),
      expect.any(Object)
    );
  });

  it('should log registration event', async () => {
    await apiClient.post('/auth/register').send({
      email: 'audit-test@example.com',
      password: 'TestPass123!'
    });

    const audit = await testDb.query('SELECT * FROM audit_log WHERE event_type = $1', ['register']);
    expect(audit.rows.length).toBeGreaterThan(0);
    expect(audit.rows[0].details).toContain('audit-test@example.com');
  });
});
```

### 2. Login Tests (12 tests)

```javascript
describe('POST /auth/login', () => {
  beforeEach(async () => {
    // Create verified test user
    await createTestUser({
      email: 'login-test@example.com',
      password_hash: await bcrypt.hash('TestPass123!', 10),
      email_verified: true
    });
  });

  it('should login with valid credentials', async () => {
    const response = await apiClient.post('/auth/login').send({
      email: 'login-test@example.com',
      password: 'TestPass123!'
    });

    expect(response.status).toBe(200);
    expect(response.body.userId).toBeDefined();
    expect(response.body.email).toBe('login-test@example.com');
    expect(response.headers['set-cookie']).toBeDefined();

    // Verify session cookie
    const cookie = response.headers['set-cookie'][0];
    expect(cookie).toContain('session_id=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
  });

  it('should reject login with wrong password', async () => {
    const response = await apiClient.post('/auth/login').send({
      email: 'login-test@example.com',
      password: 'WrongPassword'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/invalid credentials/i);
  });

  it('should reject login with non-existent email', async () => {
    const response = await apiClient.post('/auth/login').send({
      email: 'nonexistent@example.com',
      password: 'TestPass123!'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/invalid credentials/i);
  });

  it('should reject login with unverified email', async () => {
    // Create unverified user
    await createTestUser({
      email: 'unverified@example.com',
      password_hash: await bcrypt.hash('TestPass123!', 10),
      email_verified: false
    });

    const response = await apiClient.post('/auth/login').send({
      email: 'unverified@example.com',
      password: 'TestPass123!'
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/email not verified/i);
  });

  it('should rate limit after 5 failed attempts', async () => {
    // Make 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await apiClient.post('/auth/login').send({
        email: 'login-test@example.com',
        password: 'WrongPassword'
      });
    }

    // 6th attempt should be rate limited
    const response = await apiClient.post('/auth/login').send({
      email: 'login-test@example.com',
      password: 'WrongPassword'
    });

    expect(response.status).toBe(429);
    expect(response.body.error).toMatch(/too many login attempts/i);
  });

  it('should clear rate limit after successful login', async () => {
    // Make 3 failed attempts
    for (let i = 0; i < 3; i++) {
      await apiClient.post('/auth/login').send({
        email: 'login-test@example.com',
        password: 'WrongPassword'
      });
    }

    // Successful login should clear rate limit
    await apiClient.post('/auth/login').send({
      email: 'login-test@example.com',
      password: 'TestPass123!'
    });

    // Should be able to make more attempts
    const response = await apiClient.post('/auth/login').send({
      email: 'login-test@example.com',
      password: 'WrongPassword'
    });

    expect(response.status).toBe(400); // Not 429
  });

  it('should update last_login timestamp', async () => {
    const before = Date.now() / 1000;

    await apiClient.post('/auth/login').send({
      email: 'login-test@example.com',
      password: 'TestPass123!'
    });

    const user = await testDb.query('SELECT last_login FROM users WHERE email = $1', ['login-test@example.com']);
    const lastLogin = user.rows[0].last_login;

    expect(lastLogin).toBeGreaterThanOrEqual(before);
  });

  it('should create session in Redis', async () => {
    const response = await apiClient.post('/auth/login').send({
      email: 'login-test@example.com',
      password: 'TestPass123!'
    });

    const cookie = response.headers['set-cookie'][0];
    const sessionId = cookie.match(/session_id=([^;]+)/)[1];

    // Verify session exists in Redis
    const sessionData = await testRedis.get(`session:${sessionId}`);
    expect(sessionData).toBeTruthy();

    const session = JSON.parse(sessionData);
    expect(session.userId).toBeDefined();
    expect(session.email).toBe('login-test@example.com');
  });

  it('should set rememberMe cookie for 30 days', async () => {
    const response = await apiClient.post('/auth/login').send({
      email: 'login-test@example.com',
      password: 'TestPass123!',
      rememberMe: true
    });

    const cookie = response.headers['set-cookie'][0];
    expect(cookie).toContain('Max-Age=2592000'); // 30 days
  });

  it('should set session cookie for browser session', async () => {
    const response = await apiClient.post('/auth/login').send({
      email: 'login-test@example.com',
      password: 'TestPass123!',
      rememberMe: false
    });

    const cookie = response.headers['set-cookie'][0];
    expect(cookie).not.toContain('Max-Age');
  });

  it('should log successful login', async () => {
    await apiClient.post('/auth/login').send({
      email: 'login-test@example.com',
      password: 'TestPass123!'
    });

    const audit = await testDb.query('SELECT * FROM audit_log WHERE event_type = $1 ORDER BY created_at DESC LIMIT 1', ['login']);
    expect(audit.rows[0].user_id).toBeDefined();
    expect(audit.rows[0].details).toContain('login');
  });

  it('should log failed login attempts', async () => {
    await apiClient.post('/auth/login').send({
      email: 'login-test@example.com',
      password: 'WrongPassword'
    });

    const audit = await testDb.query('SELECT * FROM audit_log WHERE event_type = $1 ORDER BY created_at DESC LIMIT 1', ['login_failed']);
    expect(audit.rows[0].details).toContain('invalid_credentials');
  });
});
```

### 3. Email Verification Tests (5 tests)
### 4. Password Reset Tests (8 tests)
### 5. Logout Tests (3 tests)
### 6. Get Current User Tests (5 tests)
### 7. Resend Verification Tests (4 tests)

## Files to Create

1. `tests/integration/handlers/auth-handlers.test.js` (NEW, 800+ lines)
2. `tests/unit/utils/auth-utils.test.js` (UPDATE, add bcrypt tests)
3. `tests/fixtures/users.json` (NEW, test user data)

## Acceptance Criteria

- [ ] 50+ test cases for all 9 auth endpoints
- [ ] 80%+ branch coverage on auth-handlers.js
- [ ] All tests pass consistently
- [ ] Test bcrypt migration (verify hash format)
- [ ] Test PostgreSQL boolean checks (email_verified)
- [ ] Test rate limiting edge cases
- [ ] Test session creation/destruction
- [ ] Test token expiration
- [ ] Tests run in <10 seconds
- [ ] Tests documented with clear descriptions

## Priority Justification

This is **CRITICAL** because:
1. Recent bcrypt migration (Nov 5) has NO tests
2. Recent PostgreSQL boolean fix (Nov 6) has NO tests
3. Authentication is the #1 attack surface
4. Password vulnerabilities = complete system compromise
5. Rate limiting bypass = brute force attacks possible

## Related Issues

- Requires: #65 (Test Infrastructure Setup)
- Related: Recent commits d2b233a, a4025ca
- Part of: 100% branch coverage goal

## References

- Auth handlers: `src/handlers/auth-handlers.js`
- Auth utils: `src/utils/auth-utils.js`
- Recent migration: commit d2b233a (PBKDF2 → bcrypt)
- Recent fix: commit a4025ca (PostgreSQL boolean)