/**
 * Authentication Handlers Integration Tests
 *
 * Comprehensive test coverage for auth-handlers.js (862 lines, 9 endpoints)
 * Tests cover:
 * - Registration (bcrypt password hashing)
 * - Login (rate limiting, session creation)
 * - Email verification
 * - Password reset flow
 * - Logout
 * - Token validation
 *
 * Target: 80%+ branch coverage
 * Test count: 50+ test cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { getTestDb, getTestDbAdapter, insertTestRecord, findTestRecord, countTestRecords } from '../../test-helpers/database.js';
import { createTestUser, createVerificationToken } from '../../test-helpers/factories.js';
import { mockRedis as createMockRedis } from '../../test-helpers/mocks.js';
import * as authHandlers from '../../../src/handlers/auth-handlers.js';

// Create shared mock Redis instance
const mockRedisInstance = createMockRedis();

// Mock Redis for session/rate limiting
vi.mock('../../../src/adapters/redis-adapter.js', () => ({
  default: mockRedisInstance
}));

// Mock email service
const mockEmailService = {
  sendEmailVerification: vi.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true }),
};

vi.mock('../../../src/services/user-notifier.js', () => ({
  sendEmailVerification: mockEmailService.sendEmailVerification,
  sendPasswordResetEmail: mockEmailService.sendPasswordResetEmail,
}));

describe('POST /auth/register', () => {
  let testDb;
  let testDbAdapter;

  beforeEach(async () => {
    testDb = getTestDb();
    testDbAdapter = getTestDbAdapter();
    mockRedisInstance.clear();
    vi.clearAllMocks();
  });

  it('should register a new user with valid credentials', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        role: 'author'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleRegister(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.userId).toBeDefined();
    expect(result.verificationToken).toBeDefined();
    expect(result.message).toMatch(/registration successful/i);

    // Verify user in database
    const user = await findTestRecord('users', { email: 'newuser@example.com' });
    expect(user).toBeTruthy();
    expect(user.email_verified).toBe(false);
    expect(user.role).toBe('author');
  });

  it('should reject registration with weak password', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'test@example.com',
        password: 'weak'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleRegister(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/password must be/i);
  });

  it('should reject registration with invalid email', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'invalid-email',
        password: 'SecurePass123!'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleRegister(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/invalid email/i);
  });

  it('should reject registration with duplicate email', async () => {
    const email = 'duplicate@example.com';

    // Create first user
    await createTestUser(testDb, {
      email,
      password_hash: await bcrypt.hash('TestPass123!', 10),
    });

    // Try to register again
    const mockRequest = {
      json: async () => ({
        email,
        password: 'DifferentPass456!'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleRegister(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(409);
    expect(result.error).toMatch(/email already registered/i);
  });

  it('should hash password with bcrypt', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'bcrypt-test@example.com',
        password: 'TestPass123!'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleRegister(mockRequest, mockEnv);

    const user = await findTestRecord('users', { email: 'bcrypt-test@example.com' });
    const hash = user.password_hash;

    // bcrypt hashes start with $2a$10$ or $2b$10$
    expect(hash).toMatch(/^\$2[ab]\$10\$/);
    expect(hash.length).toBe(60); // bcrypt hash length

    // Verify password can be checked
    const isValid = await bcrypt.compare('TestPass123!', hash);
    expect(isValid).toBe(true);
  });

  it('should normalize email to lowercase', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'CaseSensitive@Example.COM',
        password: 'TestPass123!'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleRegister(mockRequest, mockEnv);

    const user = await findTestRecord('users', { email: 'casesensitive@example.com' });
    expect(user).toBeTruthy();
  });

  it('should create verification token', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'verify-test@example.com',
        password: 'TestPass123!'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleRegister(mockRequest, mockEnv);
    const result = await response.json();

    const token = result.verificationToken;
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(20); // Secure token length

    // Verify token in database
    const tokenRecord = await testDb.query(
      'SELECT * FROM verification_tokens WHERE token = $1',
      [token]
    );
    expect(tokenRecord.rows.length).toBe(1);
    expect(tokenRecord.rows[0].token_type).toBe('email_verification');
    expect(tokenRecord.rows[0].used).toBeFalsy(); // PostgreSQL returns 0 for false
  });

  it('should send verification email', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'email-test@example.com',
        password: 'TestPass123!'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleRegister(mockRequest, mockEnv);

    expect(mockEmailService.sendEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: 'email-test@example.com',
        verificationToken: expect.any(String)
      }),
      expect.any(Object)
    );
  });

  it('should log registration event in audit log', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'audit-test@example.com',
        password: 'TestPass123!'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleRegister(mockRequest, mockEnv);

    const auditCount = await countTestRecords('audit_log', { event_type: 'register' });
    expect(auditCount).toBeGreaterThan(0);
  });

  it('should set default role to author if not specified', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'default-role@example.com',
        password: 'TestPass123!'
        // No role specified
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleRegister(mockRequest, mockEnv);

    const user = await findTestRecord('users', { email: 'default-role@example.com' });
    expect(user.role).toBe('author');
  });
});

describe('POST /auth/login', () => {
  let testDb;
  let testDbAdapter;
  let testUser;

  beforeEach(async () => {
    testDb = getTestDb();
    testDbAdapter = getTestDbAdapter();
    mockRedisInstance.clear();
    vi.clearAllMocks();

    // Create verified test user
    testUser = await createTestUser(testDb, {
      email: 'login-test@example.com',
      password_hash: await bcrypt.hash('TestPass123!', 10),
      email_verified: true
    });
  });

  it('should login with valid credentials', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'login-test@example.com',
        password: 'TestPass123!'
      }),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleLogin(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.userId).toBeDefined();
    expect(result.email).toBe('login-test@example.com');

    // Verify session cookie was set
    const headers = response.headers;
    expect(headers.get('Set-Cookie')).toBeTruthy();
    expect(headers.get('Set-Cookie')).toContain('session_id=');
    expect(headers.get('Set-Cookie')).toContain('HttpOnly');
    expect(headers.get('Set-Cookie')).toContain('Secure');
  });

  it('should reject login with wrong password', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'login-test@example.com',
        password: 'WrongPassword'
      }),
      headers: new Map([['x-forwarded-for', '127.0.0.1']])
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleLogin(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/invalid credentials/i);
  });

  it('should reject login with non-existent email', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'nonexistent@example.com',
        password: 'TestPass123!'
      }),
      headers: new Map([['x-forwarded-for', '127.0.0.1']])
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleLogin(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/invalid credentials/i);
  });

  it('should reject login with unverified email', async () => {
    // Create unverified user
    await createTestUser(testDb, {
      email: 'unverified@example.com',
      password_hash: await bcrypt.hash('TestPass123!', 10),
      email_verified: false
    });

    const mockRequest = {
      json: async () => ({
        email: 'unverified@example.com',
        password: 'TestPass123!'
      }),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleLogin(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(403);
    expect(result.error).toMatch(/email not verified/i);
  });

  it('should rate limit after 5 failed attempts', async () => {
    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    // Make 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      const mockRequest = {
        json: async () => ({
          email: 'login-test@example.com',
          password: 'WrongPassword'
        }),
        headers: new Map([['x-forwarded-for', '127.0.0.1']])
      };

      await authHandlers.handleLogin(mockRequest, mockEnv);
    }

    // 6th attempt should be rate limited
    const mockRequest = {
      json: async () => ({
        email: 'login-test@example.com',
        password: 'WrongPassword'
      }),
      headers: new Map([['x-forwarded-for', '127.0.0.1']])
    };

    const response = await authHandlers.handleLogin(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(429);
    expect(result.error).toMatch(/too many.*attempts/i);
  });

  it('should update last_login timestamp', async () => {
    const beforeLogin = new Date();

    const mockRequest = {
      json: async () => ({
        email: 'login-test@example.com',
        password: 'TestPass123!'
      }),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleLogin(mockRequest, mockEnv);

    const user = await findTestRecord('users', { email: 'login-test@example.com' });
    const lastLogin = new Date(user.last_login);

    expect(lastLogin >= beforeLogin).toBe(true);
  });

  it('should create session in Redis', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'login-test@example.com',
        password: 'TestPass123!'
      }),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleLogin(mockRequest, mockEnv);

    // Extract session ID from Set-Cookie header
    const setCookie = response.headers.get('Set-Cookie');
    const sessionIdMatch = setCookie.match(/session_id=([^;]+)/);
    expect(sessionIdMatch).toBeTruthy();

    const sessionId = sessionIdMatch[1];

    // Verify session exists in Redis
    const sessionData = await mockRedisInstance.get(`session:${sessionId}`);
    expect(sessionData).toBeTruthy();

    const session = JSON.parse(sessionData);
    expect(session.userId).toBe(testUser.id);
    expect(session.email).toBe('login-test@example.com');
  });

  it('should log successful login', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'login-test@example.com',
        password: 'TestPass123!'
      }),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleLogin(mockRequest, mockEnv);

    const auditCount = await countTestRecords('audit_log', { event_type: 'login' });
    expect(auditCount).toBeGreaterThan(0);
  });

  it('should log failed login attempts', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'login-test@example.com',
        password: 'WrongPassword'
      }),
      headers: new Map([['x-forwarded-for', '127.0.0.1']])
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleLogin(mockRequest, mockEnv);

    const auditCount = await countTestRecords('audit_log', { event_type: 'login_failed' });
    expect(auditCount).toBeGreaterThan(0);
  });
});

describe('POST /auth/verify-email', () => {
  let testDb;
  let testDbAdapter;
  let testUser;
  let verificationToken;

  beforeEach(async () => {
    testDb = getTestDb();
    testDbAdapter = getTestDbAdapter();
    mockRedisInstance.clear();
    vi.clearAllMocks();

    // Create unverified user with verification token
    testUser = await createTestUser(testDb, {
      email: 'verify@example.com',
      password_hash: await bcrypt.hash('TestPass123!', 10),
      email_verified: false
    });

    verificationToken = createVerificationToken(testUser.id, {
      token_type: 'email_verification'
    });
    await insertTestRecord('verification_tokens', verificationToken);
  });

  it('should verify email with valid token', async () => {
    const mockRequest = {
      json: async () => ({
        token: verificationToken.token
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleVerifyEmail(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.message).toMatch(/email verified/i);

    // Verify user's email_verified flag is true
    const user = await findTestRecord('users', { id: testUser.id });
    expect(user.email_verified).toBe(true);

    // Verify token is marked as used
    const token = await findTestRecord('verification_tokens', { token: verificationToken.token });
    expect(token.used).toBe(true);
  });

  it('should reject invalid token', async () => {
    const mockRequest = {
      json: async () => ({
        token: 'invalid-token-12345'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleVerifyEmail(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/invalid.*token/i);
  });

  it('should reject expired token', async () => {
    // Create expired token (expires_at in the past)
    const expiredToken = createVerificationToken(testUser.id, {
      token_type: 'email_verification',
      expires_at: Math.floor(Date.now() / 1000) - 86400 // 1 day ago (unix timestamp)
    });
    await insertTestRecord('verification_tokens', expiredToken);

    const mockRequest = {
      json: async () => ({
        token: expiredToken.token
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleVerifyEmail(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/expired/i);
  });

  it('should reject already used token', async () => {
    // Mark token as used
    await testDb.query(
      'UPDATE verification_tokens SET used = 1 WHERE token = $1',
      [verificationToken.token]
    );

    const mockRequest = {
      json: async () => ({
        token: verificationToken.token
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleVerifyEmail(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/already.*used|invalid/i);
  });

  it('should handle missing token', async () => {
    const mockRequest = {
      json: async () => ({})
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleVerifyEmail(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/token.*required/i);
  });

  it('should log email verification event', async () => {
    const mockRequest = {
      json: async () => ({
        token: verificationToken.token
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleVerifyEmail(mockRequest, mockEnv);

    const auditCount = await countTestRecords('audit_log', { event_type: 'email_verified' });
    expect(auditCount).toBeGreaterThan(0);
  });
});

describe('POST /auth/request-password-reset', () => {
  let testDb;
  let testDbAdapter;
  let testUser;

  beforeEach(async () => {
    testDb = getTestDb();
    testDbAdapter = getTestDbAdapter();
    mockRedisInstance.clear();
    vi.clearAllMocks();

    testUser = await createTestUser(testDb, {
      email: 'reset@example.com',
      password_hash: await bcrypt.hash('OldPass123!', 10),
      email_verified: true
    });
  });

  it('should create password reset token for valid email', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'reset@example.com'
      }),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleRequestPasswordReset(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.message).toMatch(/reset.*sent/i);

    // Verify token was created
    const tokenCount = await countTestRecords('verification_tokens', {
      user_id: testUser.id,
      token_type: 'password_reset'
    });
    expect(tokenCount).toBeGreaterThan(0);
  });

  it('should send password reset email', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'reset@example.com'
      }),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleRequestPasswordReset(mockRequest, mockEnv);

    expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: 'reset@example.com',
        resetToken: expect.any(String)
      }),
      expect.any(Object)
    );
  });

  it('should not reveal if email does not exist (security)', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'nonexistent@example.com'
      }),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleRequestPasswordReset(mockRequest, mockEnv);
    const result = await response.json();

    // Should return success to avoid email enumeration
    expect(response.status).toBe(200);
    expect(result.message).toMatch(/reset.*sent/i);
  });

  it('should rate limit password reset requests', async () => {
    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    // Make 3 password reset requests (limit is 3 per hour)
    for (let i = 0; i < 3; i++) {
      const mockRequest = {
        json: async () => ({
          email: 'reset@example.com'
        }),
        headers: new Map([['x-forwarded-for', '127.0.0.1']])
      };

      await authHandlers.handleRequestPasswordReset(mockRequest, mockEnv);
    }

    // 4th request should be rate limited
    const mockRequest = {
      json: async () => ({
        email: 'reset@example.com'
      }),
      headers: new Map([['x-forwarded-for', '127.0.0.1']])
    };

    const response = await authHandlers.handleRequestPasswordReset(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(429);
    expect(result.error).toMatch(/too many.*requests/i);
  });

  it('should normalize email to lowercase', async () => {
    await createTestUser(testDb, {
      email: 'casesensitive@example.com',
      password_hash: await bcrypt.hash('TestPass123!', 10),
      email_verified: true
    });

    const mockRequest = {
      json: async () => ({
        email: 'CaseSensitive@Example.COM'
      }),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleRequestPasswordReset(mockRequest, mockEnv);

    expect(response.status).toBe(200);
  });

  it('should reject invalid email format', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'invalid-email'
      }),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleRequestPasswordReset(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/invalid email/i);
  });

  it('should handle missing email', async () => {
    const mockRequest = {
      json: async () => ({}),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleRequestPasswordReset(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/invalid email/i);
  });

  it('should log password reset request', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'reset@example.com'
      }),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleRequestPasswordReset(mockRequest, mockEnv);

    const auditCount = await countTestRecords('audit_log', { event_type: 'password_reset_requested' });
    expect(auditCount).toBeGreaterThan(0);
  });
});

describe('POST /auth/reset-password', () => {
  let testDb;
  let testDbAdapter;
  let testUser;
  let resetToken;

  beforeEach(async () => {
    testDb = getTestDb();
    testDbAdapter = getTestDbAdapter();
    mockRedisInstance.clear();
    vi.clearAllMocks();

    testUser = await createTestUser(testDb, {
      email: 'reset@example.com',
      password_hash: await bcrypt.hash('OldPass123!', 10),
      email_verified: true
    });

    resetToken = createVerificationToken(testUser.id, {
      token_type: 'password_reset'
    });
    await insertTestRecord('verification_tokens', resetToken);
  });

  it('should reset password with valid token', async () => {
    const mockRequest = {
      json: async () => ({
        token: resetToken.token,
        newPassword: 'NewSecurePass456!'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleResetPassword(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.message).toMatch(/password.*reset/i);

    // Verify password was changed
    const user = await findTestRecord('users', { id: testUser.id });
    const isNewPassword = await bcrypt.compare('NewSecurePass456!', user.password_hash);
    expect(isNewPassword).toBe(true);

    // Verify old password no longer works
    const isOldPassword = await bcrypt.compare('OldPass123!', user.password_hash);
    expect(isOldPassword).toBe(false);
  });

  it('should mark reset token as used', async () => {
    const mockRequest = {
      json: async () => ({
        token: resetToken.token,
        newPassword: 'NewSecurePass456!'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleResetPassword(mockRequest, mockEnv);

    const token = await findTestRecord('verification_tokens', { token: resetToken.token });
    expect(token.used).toBe(true);
  });

  it('should reject weak new password', async () => {
    const mockRequest = {
      json: async () => ({
        token: resetToken.token,
        newPassword: 'weak'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleResetPassword(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/password must be/i);
  });

  it('should reject invalid token', async () => {
    const mockRequest = {
      json: async () => ({
        token: 'invalid-token-12345',
        newPassword: 'NewSecurePass456!'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleResetPassword(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/invalid.*token/i);
  });

  it('should reject expired token', async () => {
    const expiredToken = createVerificationToken(testUser.id, {
      token_type: 'password_reset',
      expires_at: Math.floor(Date.now() / 1000) - 86400 // 1 day ago (unix timestamp)
    });
    await insertTestRecord('verification_tokens', expiredToken);

    const mockRequest = {
      json: async () => ({
        token: expiredToken.token,
        newPassword: 'NewSecurePass456!'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleResetPassword(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/expired/i);
  });

  it('should reject already used token', async () => {
    await testDb.query(
      'UPDATE verification_tokens SET used = 1 WHERE token = $1',
      [resetToken.token]
    );

    const mockRequest = {
      json: async () => ({
        token: resetToken.token,
        newPassword: 'NewSecurePass456!'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleResetPassword(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toMatch(/already.*used|invalid/i);
  });

  it('should hash new password with bcrypt', async () => {
    const mockRequest = {
      json: async () => ({
        token: resetToken.token,
        newPassword: 'NewSecurePass456!'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleResetPassword(mockRequest, mockEnv);

    const user = await findTestRecord('users', { id: testUser.id });
    const hash = user.password_hash;

    // Verify bcrypt hash format
    expect(hash).toMatch(/^\$2[ab]\$10\$/);
    expect(hash.length).toBe(60);
  });

  it('should log password reset event', async () => {
    const mockRequest = {
      json: async () => ({
        token: resetToken.token,
        newPassword: 'NewSecurePass456!'
      })
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleResetPassword(mockRequest, mockEnv);

    const auditCount = await countTestRecords('audit_log', { event_type: 'password_reset' });
    expect(auditCount).toBeGreaterThan(0);
  });
});

describe('POST /auth/logout', () => {
  let testDb;
  let testDbAdapter;
  let testUser;
  let sessionId;

  beforeEach(async () => {
    testDb = getTestDb();
    testDbAdapter = getTestDbAdapter();
    mockRedisInstance.clear();
    vi.clearAllMocks();

    testUser = await createTestUser(testDb, {
      email: 'logout@example.com',
      password_hash: await bcrypt.hash('TestPass123!', 10),
      email_verified: true
    });

    // Create session (match format from createSession in auth-utils.js)
    sessionId = 'test-session-id-12345';
    const now = Date.now();
    await mockRedisInstance.setEx(
      `session:${sessionId}`,
      3600,
      JSON.stringify({
        userId: testUser.id,
        createdAt: now,
        expiresAt: now + (3600 * 1000),
        rememberMe: false
      })
    );
  });

  it('should logout and destroy session', async () => {
    const mockRequest = {
      headers: new Map([['Cookie', `session_id=${sessionId}`]])
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleLogout(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.message).toMatch(/logout successful/i);

    // Verify session was deleted from Redis
    const sessionData = await mockRedisInstance.get(`session:${sessionId}`);
    expect(sessionData).toBeNull();
  });

  it('should clear session cookie', async () => {
    const mockRequest = {
      headers: new Map([['Cookie', `session_id=${sessionId}`]])
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleLogout(mockRequest, mockEnv);

    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toContain('session_id=');
    expect(setCookie).toContain('Max-Age=0'); // Cookie expired
  });

  it('should log logout event', async () => {
    const mockRequest = {
      headers: new Map([['Cookie', `session_id=${sessionId}`]])
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    await authHandlers.handleLogout(mockRequest, mockEnv);

    const auditCount = await countTestRecords('audit_log', { event_type: 'logout' });
    expect(auditCount).toBeGreaterThan(0);
  });
});

describe('GET /auth/me', () => {
  let testDb;
  let testDbAdapter;
  let testUser;
  let sessionId;

  beforeEach(async () => {
    testDb = getTestDb();
    testDbAdapter = getTestDbAdapter();
    mockRedisInstance.clear();
    vi.clearAllMocks();

    testUser = await createTestUser(testDb, {
      email: 'me@example.com',
      password_hash: await bcrypt.hash('TestPass123!', 10),
      email_verified: true,
      role: 'author',
      subscription_tier: 'pro'
    });

    // Create session (match format from createSession in auth-utils.js)
    sessionId = 'test-session-id-12345';
    const now = Date.now();
    await mockRedisInstance.setEx(
      `session:${sessionId}`,
      3600,
      JSON.stringify({
        userId: testUser.id,
        createdAt: now,
        expiresAt: now + (3600 * 1000),
        rememberMe: false
      })
    );
  });

  it('should return current user with valid session', async () => {
    const mockRequest = {
      headers: new Map([['Cookie', `session_id=${sessionId}`]])
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleGetCurrentUser(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.userId).toBe(testUser.id);
    expect(result.email).toBe('me@example.com');
    expect(result.role).toBe('author');
    // Note: subscriptionTier not included in GET /auth/me response
  });

  it('should not return password hash', async () => {
    const mockRequest = {
      headers: new Map([['Cookie', `session_id=${sessionId}`]])
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleGetCurrentUser(mockRequest, mockEnv);
    const result = await response.json();

    expect(result.password_hash).toBeUndefined();
    expect(result.passwordHash).toBeUndefined();
  });

  it('should reject request without session', async () => {
    const mockRequest = {
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleGetCurrentUser(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(401);
    expect(result.error).toMatch(/not authenticated/i);
  });

  it('should reject request with invalid session', async () => {
    const mockRequest = {
      headers: new Map([['Cookie', 'session_id=invalid-session-id']])
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleGetCurrentUser(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(401);
    expect(result.error).toMatch(/not authenticated|invalid session/i);
  });

  it('should return email verification status', async () => {
    const mockRequest = {
      headers: new Map([['Cookie', `session_id=${sessionId}`]])
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleGetCurrentUser(mockRequest, mockEnv);
    const result = await response.json();

    expect(result.emailVerified).toBeDefined();
    expect(typeof result.emailVerified).toBe('boolean');
  });
});

describe('POST /auth/resend-verification', () => {
  let testDb;
  let testDbAdapter;
  let testUser;

  beforeEach(async () => {
    testDb = getTestDb();
    testDbAdapter = getTestDbAdapter();
    mockRedisInstance.clear();
    vi.clearAllMocks();

    testUser = await createTestUser(testDb, {
      email: 'resend@example.com',
      password_hash: await bcrypt.hash('TestPass123!', 10),
      email_verified: false
    });
  });

  it('should resend verification email for unverified user', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'resend@example.com'
      }),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleResendVerification(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.message).toMatch(/verification.*sent/i);

    expect(mockEmailService.sendEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: 'resend@example.com',
        verificationToken: expect.any(String)
      }),
      expect.any(Object)
    );
  });

  it('should reject resend for already verified user', async () => {
    await testDb.query(
      'UPDATE users SET email_verified = 1 WHERE id = $1',
      [testUser.id]
    );

    const mockRequest = {
      json: async () => ({
        email: 'resend@example.com'
      }),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleResendVerification(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(409); // 409 Conflict is more semantically correct
    expect(result.error).toMatch(/already verified/i);
  });

  it('should rate limit resend requests', async () => {
    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    // Make 3 resend requests (limit is 3 per hour)
    for (let i = 0; i < 3; i++) {
      const mockRequest = {
        json: async () => ({
          email: 'resend@example.com'
        }),
        headers: new Map([['x-forwarded-for', '127.0.0.1']])
      };

      await authHandlers.handleResendVerification(mockRequest, mockEnv);
    }

    // 4th request should be rate limited
    const mockRequest = {
      json: async () => ({
        email: 'resend@example.com'
      }),
      headers: new Map([['x-forwarded-for', '127.0.0.1']])
    };

    const response = await authHandlers.handleResendVerification(mockRequest, mockEnv);
    const result = await response.json();

    expect(response.status).toBe(429);
    expect(result.error).toMatch(/too many.*requests/i);
  });

  it('should not reveal if email does not exist (security)', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'nonexistent@example.com'
      }),
      headers: new Map()
    };

    const mockEnv = { DB: testDbAdapter, REDIS: mockRedisInstance };

    const response = await authHandlers.handleResendVerification(mockRequest, mockEnv);

    // Should return success to avoid email enumeration
    expect(response.status).toBe(200);
  });
});

export { testDb };
