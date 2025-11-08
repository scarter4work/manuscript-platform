/**
 * Authentication Handlers Integration Tests
 *
 * Tests all authentication endpoints with database integration:
 * - POST /auth/register
 * - POST /auth/login
 * - POST /auth/logout
 * - GET /auth/me
 * - GET /auth/verify-email
 * - POST /auth/password-reset-request
 * - POST /auth/password-reset
 * - GET /auth/verify-reset-token
 * - POST /auth/resend-verification
 *
 * Coverage target: 80%+ branch coverage on auth-handlers.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  apiClient,
  registerTestUser,
  loginTestUser,
  getVerificationToken,
  getPasswordResetToken,
  extractSessionId
} from '../../test-helpers/api-client.js';
import {
  insertTestRecord,
  findTestRecord,
  countTestRecords,
  queryTestDb
} from '../../test-helpers/database.js';
import {
  createTestUser,
  createTestUserWithPassword,
  generateTestEmail
} from '../../test-helpers/factories.js';
import bcrypt from 'bcryptjs';

describe('Authentication Handlers', () => {
  // ============================================================================
  // POST /auth/register
  // ============================================================================
  describe('POST /auth/register', () => {
    it('should register a new user with valid credentials', async () => {
      const email = generateTestEmail('register');
      const password = 'SecurePass123!';

      const response = await apiClient.post('/auth/register').send({
        email,
        password,
        role: 'author'
      });

      expect(response.status).toBe(201);
      expect(response.body.userId).toBeDefined();
      expect(response.body.verificationToken).toBeDefined();
      expect(response.body.message).toContain('Registration successful');

      // Verify user in database
      const user = await findTestRecord('users', { email });
      expect(user).toBeTruthy();
      expect(user.email).toBe(email);
      expect(user.email_verified).toBe(false);
      expect(user.role).toBe('author');

      // Verify password hash uses bcrypt
      expect(user.password_hash).toMatch(/^\$2[ab]\$10\$/);
      expect(user.password_hash.length).toBe(60);

      // Verify subscription was created
      const subscription = await findTestRecord('subscriptions', {
        user_id: user.id
      });
      expect(subscription).toBeTruthy();
      expect(subscription.plan).toBe('free');
      expect(subscription.status).toBe('active');
    });

    it('should reject registration with weak password', async () => {
      const response = await apiClient.post('/auth/register').send({
        email: generateTestEmail(),
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
      const email = generateTestEmail('duplicate');

      // Register first user
      await apiClient.post('/auth/register').send({
        email,
        password: 'SecurePass123!'
      });

      // Try to register again with same email
      const response = await apiClient.post('/auth/register').send({
        email,
        password: 'DifferentPass456!'
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/email already registered/i);
    });

    it('should hash password with bcrypt', async () => {
      const email = generateTestEmail('bcrypt-test');
      const password = 'TestPass123!';

      await apiClient.post('/auth/register').send({
        email,
        password
      });

      const user = await findTestRecord('users', { email });
      const hash = user.password_hash;

      // Verify bcrypt hash format
      expect(hash).toMatch(/^\$2[ab]\$10\$/);
      expect(hash.length).toBe(60);

      // Verify password can be verified
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should normalize email to lowercase', async () => {
      const response = await apiClient.post('/auth/register').send({
        email: 'CaseSensitive@Example.COM',
        password: 'TestPass123!'
      });

      expect(response.status).toBe(201);

      const user = await findTestRecord('users', {
        email: 'casesensitive@example.com'
      });
      expect(user).toBeTruthy();
    });

    it('should create verification token', async () => {
      const email = generateTestEmail('verify-token');

      const response = await apiClient.post('/auth/register').send({
        email,
        password: 'TestPass123!'
      });

      const token = response.body.verificationToken;
      expect(token).toBeTruthy();
      expect(token.length).toBe(64); // 32 bytes hex = 64 chars

      // Verify token in database
      const tokenRecord = await queryTestDb(
        'SELECT * FROM verification_tokens WHERE token = $1',
        [token]
      );
      expect(tokenRecord.rows.length).toBe(1);
      expect(tokenRecord.rows[0].token_type).toBe('email_verification');
      expect(tokenRecord.rows[0].used).toBe(false);
    });

    it('should create free subscription on registration', async () => {
      const email = generateTestEmail('subscription');

      const response = await apiClient.post('/auth/register').send({
        email,
        password: 'TestPass123!'
      });

      const userId = response.body.userId;
      const subscription = await findTestRecord('subscriptions', {
        user_id: userId
      });

      expect(subscription).toBeTruthy();
      expect(subscription.plan).toBe('free');
      expect(subscription.status).toBe('active');
    });

    it('should log registration event in audit log', async () => {
      const email = generateTestEmail('audit');

      await apiClient.post('/auth/register').send({
        email,
        password: 'TestPass123!'
      });

      const auditLog = await queryTestDb(
        'SELECT * FROM audit_log WHERE event_type = $1 ORDER BY created_at DESC LIMIT 1',
        ['register']
      );

      expect(auditLog.rows.length).toBeGreaterThan(0);
      const logEntry = auditLog.rows[0];
      expect(logEntry.event_details).toContain(email);
    });

    it('should handle missing required fields', async () => {
      const response = await apiClient.post('/auth/register').send({
        email: generateTestEmail()
        // Missing password
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  // ============================================================================
  // POST /auth/login
  // ============================================================================
  describe('POST /auth/login', () => {
    let testUser;
    const password = 'TestPass123!';

    beforeEach(async () => {
      // Create verified test user
      const email = generateTestEmail('login');
      const user = await createTestUserWithPassword({
        email,
        password,
        email_verified: true
      });
      await insertTestRecord('users', user);
      testUser = user;

      // Create subscription
      await insertTestRecord('subscriptions', {
        id: user.id + '-sub',
        user_id: user.id,
        plan: 'free',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      });
    });

    it('should login with valid credentials', async () => {
      const response = await apiClient.post('/auth/login').send({
        email: testUser.email,
        password
      });

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.email).toBe(testUser.email);
      expect(response.body.role).toBe(testUser.role);

      // Verify session cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.length).toBeGreaterThan(0);

      const sessionCookie = cookies[0];
      expect(sessionCookie).toContain('session_id=');
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=');
    });

    it('should reject login with wrong password', async () => {
      const response = await apiClient.post('/auth/login').send({
        email: testUser.email,
        password: 'WrongPassword123!'
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
      const email = generateTestEmail('unverified');
      const unverifiedUser = await createTestUserWithPassword({
        email,
        password,
        email_verified: false
      });
      await insertTestRecord('users', unverifiedUser);

      const response = await apiClient.post('/auth/login').send({
        email,
        password
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/email not verified/i);
    });

    it('should update last_login timestamp', async () => {
      const before = Math.floor(Date.now() / 1000);

      await apiClient.post('/auth/login').send({
        email: testUser.email,
        password
      });

      const user = await findTestRecord('users', { email: testUser.email });
      expect(user.last_login).toBeGreaterThanOrEqual(before);
    });

    it('should create session in database/Redis', async () => {
      const response = await apiClient.post('/auth/login').send({
        email: testUser.email,
        password
      });

      const cookie = response.headers['set-cookie'][0];
      const sessionId = extractSessionId(cookie);

      expect(sessionId).toBeTruthy();
      // Session is stored in Redis, not database
    });

    it('should log successful login', async () => {
      await apiClient.post('/auth/login').send({
        email: testUser.email,
        password
      });

      const auditLog = await queryTestDb(
        'SELECT * FROM audit_log WHERE event_type = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
        ['login', testUser.id]
      );

      expect(auditLog.rows.length).toBeGreaterThan(0);
    });

    it('should log failed login attempts', async () => {
      await apiClient.post('/auth/login').send({
        email: testUser.email,
        password: 'WrongPassword'
      });

      const auditLog = await queryTestDb(
        'SELECT * FROM audit_log WHERE event_type = $1 ORDER BY created_at DESC LIMIT 1',
        ['login_failed']
      );

      expect(auditLog.rows.length).toBeGreaterThan(0);
      expect(auditLog.rows[0].event_details).toContain('invalid_credentials');
    });

    it('should return user role and plan in response', async () => {
      const response = await apiClient.post('/auth/login').send({
        email: testUser.email,
        password
      });

      expect(response.status).toBe(200);
      expect(response.body.role).toBe(testUser.role);
      expect(response.body.plan).toBe('free');
    });

    it('should handle missing email field', async () => {
      const response = await apiClient.post('/auth/login').send({
        password
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should handle missing password field', async () => {
      const response = await apiClient.post('/auth/login').send({
        email: testUser.email
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should be case-insensitive for email', async () => {
      const response = await apiClient.post('/auth/login').send({
        email: testUser.email.toUpperCase(),
        password
      });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe(testUser.email);
    });
  });

  // ============================================================================
  // GET /auth/verify-email
  // ============================================================================
  describe('GET /auth/verify-email', () => {
    let testUser;
    let verificationToken;

    beforeEach(async () => {
      const email = generateTestEmail('verify');
      testUser = await createTestUserWithPassword({
        email,
        password: 'TestPass123!',
        email_verified: false
      });
      await insertTestRecord('users', testUser);

      // Create verification token
      verificationToken = 'a'.repeat(64); // 64-char hex string
      await insertTestRecord('verification_tokens', {
        id: testUser.id + '-token',
        user_id: testUser.id,
        token: verificationToken,
        token_type: 'email_verification',
        used: false,
        expires_at: Math.floor(Date.now() / 1000) + 86400, // +24 hours
        created_at: Math.floor(Date.now() / 1000)
      });
    });

    it('should verify email with valid token', async () => {
      const response = await apiClient.get(
        `/auth/verify-email?token=${verificationToken}`
      );

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('verified');

      // Verify user is now verified
      const user = await findTestRecord('users', { id: testUser.id });
      expect(user.email_verified).toBe(true);

      // Verify token is marked as used
      const token = await findTestRecord('verification_tokens', {
        token: verificationToken
      });
      expect(token.used).toBe(true);
    });

    it('should reject invalid token', async () => {
      const response = await apiClient.get(
        '/auth/verify-email?token=invalid-token'
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/invalid.*token/i);
    });

    it('should reject already used token', async () => {
      // Mark token as used
      await queryTestDb(
        'UPDATE verification_tokens SET used = true WHERE token = $1',
        [verificationToken]
      );

      const response = await apiClient.get(
        `/auth/verify-email?token=${verificationToken}`
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/invalid.*token/i);
    });

    it('should reject expired token', async () => {
      // Set token expiration to past
      await queryTestDb(
        'UPDATE verification_tokens SET expires_at = $1 WHERE token = $2',
        [Math.floor(Date.now() / 1000) - 3600, verificationToken]
      );

      const response = await apiClient.get(
        `/auth/verify-email?token=${verificationToken}`
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/expired/i);
    });

    it('should handle missing token parameter', async () => {
      const response = await apiClient.get('/auth/verify-email');

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  // ============================================================================
  // POST /auth/logout
  // ============================================================================
  describe('POST /auth/logout', () => {
    let testUser;
    let sessionCookie;

    beforeEach(async () => {
      const email = generateTestEmail('logout');
      testUser = await createTestUserWithPassword({
        email,
        password: 'TestPass123!',
        email_verified: true
      });
      await insertTestRecord('users', testUser);

      // Create subscription
      await insertTestRecord('subscriptions', {
        id: testUser.id + '-sub',
        user_id: testUser.id,
        plan: 'free',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      });

      // Login to get session cookie
      const loginResponse = await apiClient.post('/auth/login').send({
        email: testUser.email,
        password: 'TestPass123!'
      });
      sessionCookie = loginResponse.headers['set-cookie'][0];
    });

    it('should logout successfully', async () => {
      const response = await apiClient
        .post('/auth/logout')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('logged out');

      // Verify session cookie is cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const clearedCookie = cookies.find((c) => c.includes('session_id='));
      expect(clearedCookie).toContain('Max-Age=0');
    });

    it('should require authentication', async () => {
      const response = await apiClient.post('/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/unauthorized/i);
    });

    it('should log logout event', async () => {
      await apiClient.post('/auth/logout').set('Cookie', sessionCookie);

      const auditLog = await queryTestDb(
        'SELECT * FROM audit_log WHERE event_type = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
        ['logout', testUser.id]
      );

      expect(auditLog.rows.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // GET /auth/me
  // ============================================================================
  describe('GET /auth/me', () => {
    let testUser;
    let sessionCookie;

    beforeEach(async () => {
      const email = generateTestEmail('me');
      testUser = await createTestUserWithPassword({
        email,
        password: 'TestPass123!',
        email_verified: true
      });
      await insertTestRecord('users', testUser);

      // Create subscription
      await insertTestRecord('subscriptions', {
        id: testUser.id + '-sub',
        user_id: testUser.id,
        plan: 'freelancer',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      });

      // Login
      const loginResponse = await apiClient.post('/auth/login').send({
        email: testUser.email,
        password: 'TestPass123!'
      });
      sessionCookie = loginResponse.headers['set-cookie'][0];
    });

    it('should return current user info', async () => {
      const response = await apiClient.get('/auth/me').set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.email).toBe(testUser.email);
      expect(response.body.role).toBe(testUser.role);
      expect(response.body.plan).toBe('freelancer');
      expect(response.body.emailVerified).toBe(true);
    });

    it('should not include password hash', async () => {
      const response = await apiClient.get('/auth/me').set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.password_hash).toBeUndefined();
      expect(response.body.passwordHash).toBeUndefined();
    });

    it('should require authentication', async () => {
      const response = await apiClient.get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/unauthorized/i);
    });

    it('should handle invalid session', async () => {
      const response = await apiClient
        .get('/auth/me')
        .set('Cookie', 'session_id=invalid-session-id');

      expect(response.status).toBe(401);
    });

    it('should return subscription plan', async () => {
      const response = await apiClient.get('/auth/me').set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.plan).toBe('freelancer');
    });
  });

  // ============================================================================
  // POST /auth/password-reset-request
  // ============================================================================
  describe('POST /auth/password-reset-request', () => {
    let testUser;

    beforeEach(async () => {
      const email = generateTestEmail('reset-request');
      testUser = await createTestUserWithPassword({
        email,
        password: 'TestPass123!',
        email_verified: true
      });
      await insertTestRecord('users', testUser);
    });

    it('should create password reset token', async () => {
      const response = await apiClient
        .post('/auth/password-reset-request')
        .send({ email: testUser.email });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('sent');

      // Verify token created in database
      const token = await queryTestDb(
        'SELECT * FROM verification_tokens WHERE user_id = $1 AND token_type = $2 ORDER BY created_at DESC LIMIT 1',
        [testUser.id, 'password_reset']
      );

      expect(token.rows.length).toBe(1);
      expect(token.rows[0].used).toBe(false);
    });

    it('should handle non-existent email gracefully', async () => {
      const response = await apiClient
        .post('/auth/password-reset-request')
        .send({ email: 'nonexistent@example.com' });

      // Should return success to prevent email enumeration
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('sent');
    });

    it('should handle invalid email format', async () => {
      const response = await apiClient
        .post('/auth/password-reset-request')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/invalid email/i);
    });

    it('should handle missing email field', async () => {
      const response = await apiClient
        .post('/auth/password-reset-request')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // POST /auth/password-reset
  // ============================================================================
  describe('POST /auth/password-reset', () => {
    let testUser;
    let resetToken;

    beforeEach(async () => {
      const email = generateTestEmail('reset');
      testUser = await createTestUserWithPassword({
        email,
        password: 'OldPassword123!',
        email_verified: true
      });
      await insertTestRecord('users', testUser);

      // Create password reset token
      resetToken = 'b'.repeat(64);
      await insertTestRecord('verification_tokens', {
        id: testUser.id + '-reset',
        user_id: testUser.id,
        token: resetToken,
        token_type: 'password_reset',
        used: false,
        expires_at: Math.floor(Date.now() / 1000) + 3600, // +1 hour
        created_at: Math.floor(Date.now() / 1000)
      });
    });

    it('should reset password with valid token', async () => {
      const newPassword = 'NewPassword456!';

      const response = await apiClient.post('/auth/password-reset').send({
        token: resetToken,
        newPassword
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('reset');

      // Verify password was changed
      const user = await findTestRecord('users', { id: testUser.id });
      const isValid = await bcrypt.compare(newPassword, user.password_hash);
      expect(isValid).toBe(true);

      // Verify old password no longer works
      const isOldValid = await bcrypt.compare('OldPassword123!', user.password_hash);
      expect(isOldValid).toBe(false);

      // Verify token is marked as used
      const token = await findTestRecord('verification_tokens', {
        token: resetToken
      });
      expect(token.used).toBe(true);
    });

    it('should reject weak new password', async () => {
      const response = await apiClient.post('/auth/password-reset').send({
        token: resetToken,
        newPassword: 'weak'
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/password must be/i);
    });

    it('should reject invalid token', async () => {
      const response = await apiClient.post('/auth/password-reset').send({
        token: 'invalid-token',
        newPassword: 'NewPassword456!'
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/invalid.*token/i);
    });

    it('should reject expired token', async () => {
      // Set token expiration to past
      await queryTestDb(
        'UPDATE verification_tokens SET expires_at = $1 WHERE token = $2',
        [Math.floor(Date.now() / 1000) - 3600, resetToken]
      );

      const response = await apiClient.post('/auth/password-reset').send({
        token: resetToken,
        newPassword: 'NewPassword456!'
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/expired/i);
    });

    it('should reject already used token', async () => {
      // Mark token as used
      await queryTestDb(
        'UPDATE verification_tokens SET used = true WHERE token = $1',
        [resetToken]
      );

      const response = await apiClient.post('/auth/password-reset').send({
        token: resetToken,
        newPassword: 'NewPassword456!'
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/invalid.*token/i);
    });

    it('should handle missing newPassword field', async () => {
      const response = await apiClient.post('/auth/password-reset').send({
        token: resetToken
      });

      expect(response.status).toBe(400);
    });

    it('should handle missing token field', async () => {
      const response = await apiClient.post('/auth/password-reset').send({
        newPassword: 'NewPassword456!'
      });

      expect(response.status).toBe(400);
    });

    it('should log password reset event', async () => {
      await apiClient.post('/auth/password-reset').send({
        token: resetToken,
        newPassword: 'NewPassword456!'
      });

      const auditLog = await queryTestDb(
        'SELECT * FROM audit_log WHERE event_type = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
        ['password_reset', testUser.id]
      );

      expect(auditLog.rows.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // POST /auth/resend-verification
  // ============================================================================
  describe('POST /auth/resend-verification', () => {
    let testUser;

    beforeEach(async () => {
      const email = generateTestEmail('resend');
      testUser = await createTestUserWithPassword({
        email,
        password: 'TestPass123!',
        email_verified: false
      });
      await insertTestRecord('users', testUser);
    });

    it('should create new verification token', async () => {
      const response = await apiClient
        .post('/auth/resend-verification')
        .send({ email: testUser.email });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('sent');

      // Verify new token created
      const token = await queryTestDb(
        'SELECT * FROM verification_tokens WHERE user_id = $1 AND token_type = $2 ORDER BY created_at DESC LIMIT 1',
        [testUser.id, 'email_verification']
      );

      expect(token.rows.length).toBe(1);
      expect(token.rows[0].used).toBe(false);
    });

    it('should reject for already verified email', async () => {
      // Mark user as verified
      await queryTestDb('UPDATE users SET email_verified = true WHERE id = $1', [
        testUser.id
      ]);

      const response = await apiClient
        .post('/auth/resend-verification')
        .send({ email: testUser.email });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/already verified/i);
    });

    it('should handle non-existent email gracefully', async () => {
      const response = await apiClient
        .post('/auth/resend-verification')
        .send({ email: 'nonexistent@example.com' });

      // Should return success to prevent email enumeration
      expect(response.status).toBe(200);
    });

    it('should handle invalid email format', async () => {
      const response = await apiClient
        .post('/auth/resend-verification')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/invalid email/i);
    });
  });
});
