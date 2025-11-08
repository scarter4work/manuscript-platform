/**
 * API Client Test Helpers
 *
 * Provides utilities for making HTTP requests to the API in tests:
 * - Supertest-based API client
 * - Authenticated request helpers
 * - User registration and login
 * - Cookie management
 */

import request from 'supertest';
import app from '../../server.js';
import { queryTestDb } from './database.js';

/**
 * Supertest API client for the Express app
 */
export const apiClient = request(app);

/**
 * Make an authenticated request using a session cookie
 *
 * @param {string} method - HTTP method (get, post, put, patch, delete)
 * @param {string} path - API path
 * @param {string} sessionCookie - Session cookie from login
 * @returns {request.Test} Supertest request
 */
export function authenticatedRequest(method, path, sessionCookie) {
  return apiClient[method](path)
    .set('Cookie', sessionCookie)
    .set('Content-Type', 'application/json');
}

/**
 * Register and login a test user, returning session cookie
 *
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {object} options - Additional user options (role, etc.)
 * @returns {Promise<{userId: string, email: string, sessionCookie: string, verificationToken: string}>}
 */
export async function createAuthenticatedUser(email, password, options = {}) {
  const { role = 'author' } = options;

  // Step 1: Register
  const registerResponse = await apiClient
    .post('/auth/register')
    .send({ email, password, role });

  if (registerResponse.status !== 201) {
    throw new Error(`Registration failed: ${registerResponse.body.error || registerResponse.status}`);
  }

  const { userId, verificationToken } = registerResponse.body;

  // Step 2: Verify email
  const verifyResponse = await apiClient
    .get(`/auth/verify-email?token=${verificationToken}`);

  if (verifyResponse.status !== 200) {
    throw new Error(`Email verification failed: ${verifyResponse.body.error || verifyResponse.status}`);
  }

  // Step 3: Login
  const loginResponse = await apiClient
    .post('/auth/login')
    .send({ email, password });

  if (loginResponse.status !== 200) {
    throw new Error(`Login failed: ${loginResponse.body.error || loginResponse.status}`);
  }

  const sessionCookie = loginResponse.headers['set-cookie']?.[0];

  if (!sessionCookie) {
    throw new Error('No session cookie returned from login');
  }

  return {
    userId,
    email,
    sessionCookie,
    verificationToken
  };
}

/**
 * Register a user without logging in
 *
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {object} options - Additional user options (role, etc.)
 * @returns {Promise<{userId: string, email: string, verificationToken: string}>}
 */
export async function registerTestUser(email, password, options = {}) {
  const { role = 'author' } = options;

  const response = await apiClient
    .post('/auth/register')
    .send({ email, password, role });

  if (response.status !== 201) {
    throw new Error(`Registration failed: ${response.body.error || response.status}`);
  }

  return response.body;
}

/**
 * Login an existing user
 *
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{userId: string, email: string, sessionCookie: string}>}
 */
export async function loginTestUser(email, password) {
  const response = await apiClient
    .post('/auth/login')
    .send({ email, password });

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.body.error || response.status}`);
  }

  const sessionCookie = response.headers['set-cookie']?.[0];

  if (!sessionCookie) {
    throw new Error('No session cookie returned from login');
  }

  return {
    userId: response.body.userId,
    email: response.body.email,
    sessionCookie
  };
}

/**
 * Get verification token for an email from the database
 *
 * @param {string} email - User email
 * @returns {Promise<string>} Verification token
 */
export async function getVerificationToken(email) {
  const result = await queryTestDb(`
    SELECT vt.token
    FROM verification_tokens vt
    JOIN users u ON vt.user_id = u.id
    WHERE u.email = $1 AND vt.token_type = 'email_verification' AND vt.used = false
    ORDER BY vt.created_at DESC
    LIMIT 1
  `, [email]);

  if (result.rows.length === 0) {
    throw new Error(`No verification token found for email: ${email}`);
  }

  return result.rows[0].token;
}

/**
 * Get password reset token for an email from the database
 *
 * @param {string} email - User email
 * @returns {Promise<string>} Password reset token
 */
export async function getPasswordResetToken(email) {
  const result = await queryTestDb(`
    SELECT vt.token
    FROM verification_tokens vt
    JOIN users u ON vt.user_id = u.id
    WHERE u.email = $1 AND vt.token_type = 'password_reset' AND vt.used = false
    ORDER BY vt.created_at DESC
    LIMIT 1
  `, [email]);

  if (result.rows.length === 0) {
    throw new Error(`No password reset token found for email: ${email}`);
  }

  return result.rows[0].token;
}

/**
 * Extract session ID from session cookie
 *
 * @param {string} sessionCookie - Session cookie string
 * @returns {string} Session ID
 */
export function extractSessionId(sessionCookie) {
  const match = sessionCookie.match(/session_id=([^;]+)/);
  if (!match) {
    throw new Error('No session_id found in cookie');
  }
  return match[1];
}

/**
 * Upload a test file (manuscript or asset)
 *
 * @param {string} endpoint - Upload endpoint (/upload/manuscript, /upload/marketing)
 * @param {string} sessionCookie - Session cookie
 * @param {Buffer} fileBuffer - File content
 * @param {string} filename - File name
 * @param {object} fields - Additional form fields
 * @returns {Promise<object>} Upload response
 */
export async function uploadTestFile(endpoint, sessionCookie, fileBuffer, filename, fields = {}) {
  let req = apiClient
    .post(endpoint)
    .set('Cookie', sessionCookie)
    .attach('file', fileBuffer, filename);

  // Add additional fields
  for (const [key, value] of Object.entries(fields)) {
    req = req.field(key, value);
  }

  const response = await req;

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`File upload failed: ${response.body.error || response.status}`);
  }

  return response.body;
}

/**
 * Create a test manuscript for a user
 *
 * @param {string} sessionCookie - Session cookie
 * @param {object} manuscriptData - Manuscript metadata
 * @returns {Promise<object>} Created manuscript
 */
export async function createTestManuscript(sessionCookie, manuscriptData = {}) {
  const defaultData = {
    title: `Test Manuscript ${Date.now()}`,
    genre: 'fiction',
    word_count: 85000,
    ...manuscriptData
  };

  // Upload a simple text file as the manuscript
  const content = 'This is a test manuscript. '.repeat(100);
  const buffer = Buffer.from(content, 'utf-8');

  return uploadTestFile(
    '/upload/manuscript',
    sessionCookie,
    buffer,
    'test-manuscript.txt',
    defaultData
  );
}

/**
 * Make a request and expect it to fail with a specific status code
 *
 * @param {Function} requestFn - Function that makes the request
 * @param {number} expectedStatus - Expected HTTP status code
 * @returns {Promise<object>} Response body
 */
export async function expectError(requestFn, expectedStatus) {
  const response = await requestFn();

  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}. ` +
      `Body: ${JSON.stringify(response.body)}`
    );
  }

  return response.body;
}

/**
 * Make a request and expect it to succeed
 *
 * @param {Function} requestFn - Function that makes the request
 * @returns {Promise<object>} Response body
 */
export async function expectSuccess(requestFn) {
  const response = await requestFn();

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Expected success (2xx), got ${response.status}. ` +
      `Body: ${JSON.stringify(response.body)}`
    );
  }

  return response.body;
}
