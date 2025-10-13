/**
 * Authentication Endpoint Handlers
 *
 * Handles all authentication-related HTTP endpoints:
 * - POST /auth/register - User registration with email verification
 * - POST /auth/login - User login with rate limiting
 * - POST /auth/logout - User logout (session destruction)
 * - GET /auth/me - Get current user info
 * - GET /auth/verify-email - Email verification
 * - POST /auth/password-reset-request - Request password reset
 * - POST /auth/password-reset - Reset password with token
 *
 * All handlers maintain audit logs and implement security best practices
 */

import {
  hashPassword,
  verifyPassword,
  validatePassword,
  validateEmail,
  createSession,
  destroySession,
  getUserFromRequest,
  createSessionCookie,
  clearSessionCookie,
  logAuthEvent,
  isRateLimited,
  recordLoginAttempt,
  clearRateLimit,
  generateVerificationToken,
  validateVerificationToken
} from './auth-utils.js';

// ============================================================================
// CORS HEADERS
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a JSON response with CORS headers
 *
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code
 * @param {Object} additionalHeaders - Additional headers (e.g., Set-Cookie)
 * @returns {Response}
 */
function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, ...additionalHeaders }
  });
}

/**
 * Create an error response
 *
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Response}
 */
function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

/**
 * POST /auth/register
 *
 * Register a new user account with email verification
 *
 * Request body:
 * - email: string (required)
 * - password: string (required)
 * - role: string (optional, default: 'author', options: 'author', 'publisher')
 *
 * Response:
 * - 201: { userId, message: 'Registration successful. Please verify your email.' }
 * - 400: { error: 'Validation error message' }
 * - 409: { error: 'Email already registered' }
 * - 500: { error: 'Internal server error' }
 */
export async function handleRegister(request, env) {
  try {
    // Parse request body
    const { email, password, role = 'author' } = await request.json();

    // Validate email
    if (!email || !validateEmail(email)) {
      return errorResponse('Invalid email address');
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return errorResponse(passwordValidation.errors.join(', '));
    }

    // Validate role
    if (!['author', 'publisher'].includes(role)) {
      return errorResponse('Invalid role. Must be "author" or "publisher"');
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase();

    // Check if email already exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(normalizedEmail).first();

    if (existingUser) {
      return errorResponse('Email already registered', 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate user ID
    const userId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Insert user into database
    await env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, role, created_at, email_verified)
      VALUES (?, ?, ?, ?, ?, 0)
    `).bind(userId, normalizedEmail, passwordHash, role, now).run();

    // Generate email verification token
    const verificationToken = await generateVerificationToken(userId, 'email_verification', env);

    // Log registration event
    await logAuthEvent(env, userId, 'register', request, {
      role,
      email: normalizedEmail
    });

    // TODO: Send verification email
    // In production, integrate with Cloudflare Email Routing or SendGrid
    // For now, return the token in the response (development only)

    return jsonResponse({
      userId,
      message: 'Registration successful. Please verify your email.',
      // DEVELOPMENT ONLY: Include verification token in response
      // Remove this in production and send via email
      verificationToken: verificationToken
    }, 201);

  } catch (error) {
    console.error('Registration error:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * POST /auth/login
 *
 * Login with email and password
 * Implements rate limiting (5 attempts per 5 minutes per IP)
 *
 * Request body:
 * - email: string (required)
 * - password: string (required)
 * - rememberMe: boolean (optional, default: false)
 *
 * Response:
 * - 200: { userId, email, role, message: 'Login successful' }
 *        + Set-Cookie header with session_id
 * - 400: { error: 'Invalid credentials' }
 * - 403: { error: 'Email not verified' }
 * - 429: { error: 'Too many login attempts. Try again in 5 minutes.' }
 * - 500: { error: 'Internal server error' }
 */
export async function handleLogin(request, env) {
  try {
    // Get IP address for rate limiting
    const ipAddress = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Check rate limiting
    if (await isRateLimited(ipAddress, env)) {
      return errorResponse('Too many login attempts. Try again in 5 minutes.', 429);
    }

    // Parse request body
    const { email, password, rememberMe = false } = await request.json();

    // Validate input
    if (!email || !password) {
      return errorResponse('Email and password are required');
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase();

    // Fetch user from database
    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, role, email_verified FROM users WHERE email = ?'
    ).bind(normalizedEmail).first();

    // Verify user exists and password matches
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      // Record failed login attempt
      await recordLoginAttempt(ipAddress, env);

      // Log failed login
      await logAuthEvent(env, 'anonymous', 'login_failed', request, {
        email: normalizedEmail,
        reason: 'invalid_credentials'
      });

      return errorResponse('Invalid credentials', 400);
    }

    // Check if email is verified
    if (user.email_verified !== 1) {
      await logAuthEvent(env, user.id, 'login_failed', request, {
        reason: 'email_not_verified'
      });

      return errorResponse('Email not verified. Please check your email for verification link.', 403);
    }

    // Clear rate limit on successful login
    await clearRateLimit(ipAddress, env);

    // Create session
    const sessionId = await createSession(user.id, env, rememberMe);

    // Update last login timestamp
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'UPDATE users SET last_login = ? WHERE id = ?'
    ).bind(now, user.id).run();

    // Log successful login
    await logAuthEvent(env, user.id, 'login', request, {
      rememberMe
    });

    // Return success with Set-Cookie header
    return jsonResponse({
      userId: user.id,
      email: user.email,
      role: user.role,
      message: 'Login successful'
    }, 200, {
      'Set-Cookie': createSessionCookie(sessionId, rememberMe)
    });

  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * POST /auth/logout
 *
 * Logout current user (destroy session)
 *
 * Response:
 * - 200: { message: 'Logout successful' }
 *        + Set-Cookie header to clear session
 * - 401: { error: 'Not authenticated' }
 * - 500: { error: 'Internal server error' }
 */
export async function handleLogout(request, env) {
  try {
    // Get session ID from cookie
    const cookie = request.headers.get('Cookie');
    const sessionMatch = cookie?.match(/session_id=([^;]+)/);

    if (!sessionMatch) {
      return errorResponse('Not authenticated', 401);
    }

    const sessionId = sessionMatch[1];

    // Get user ID for audit log (before destroying session)
    const userId = await getUserFromRequest(request, env);

    // Destroy session
    await destroySession(sessionId, env);

    // Log logout
    if (userId) {
      await logAuthEvent(env, userId, 'logout', request, {});
    }

    // Return success with cookie clearing header
    return jsonResponse({
      message: 'Logout successful'
    }, 200, {
      'Set-Cookie': clearSessionCookie()
    });

  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * GET /auth/me
 *
 * Get current authenticated user info
 *
 * Response:
 * - 200: { userId, email, role, createdAt, lastLogin, emailVerified }
 * - 401: { error: 'Not authenticated' }
 * - 500: { error: 'Internal server error' }
 */
export async function handleGetMe(request, env) {
  try {
    // Get user ID from session
    const userId = await getUserFromRequest(request, env);

    if (!userId) {
      return errorResponse('Not authenticated', 401);
    }

    // Fetch user details from database
    const user = await env.DB.prepare(`
      SELECT id, email, role, created_at, last_login, email_verified
      FROM users
      WHERE id = ?
    `).bind(userId).first();

    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Return user info
    return jsonResponse({
      userId: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.created_at,
      lastLogin: user.last_login,
      emailVerified: user.email_verified === 1
    });

  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * GET /auth/verify-email
 *
 * Verify user email with token
 *
 * Query parameters:
 * - token: string (required)
 *
 * Response:
 * - 200: { message: 'Email verified successfully' }
 * - 400: { error: 'Invalid or expired verification token' }
 * - 500: { error: 'Internal server error' }
 */
export async function handleVerifyEmail(request, env) {
  try {
    // Get token from query parameters
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return errorResponse('Verification token is required');
    }

    // Validate token and get user ID
    const userId = await validateVerificationToken(token, 'email_verification', env);

    if (!userId) {
      return errorResponse('Invalid or expired verification token', 400);
    }

    // Update user's email_verified flag
    await env.DB.prepare(
      'UPDATE users SET email_verified = 1 WHERE id = ?'
    ).bind(userId).run();

    // Log verification event
    await logAuthEvent(env, userId, 'email_verified', request, {});

    return jsonResponse({
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * POST /auth/password-reset-request
 *
 * Request a password reset (generates token and sends email)
 *
 * Request body:
 * - email: string (required)
 *
 * Response:
 * - 200: { message: 'Password reset email sent' }
 * - 400: { error: 'Invalid email' }
 * - 404: { error: 'Email not found' }
 * - 500: { error: 'Internal server error' }
 */
export async function handlePasswordResetRequest(request, env) {
  try {
    // Parse request body
    const { email } = await request.json();

    // Validate email
    if (!email || !validateEmail(email)) {
      return errorResponse('Invalid email address');
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase();

    // Find user by email
    const user = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(normalizedEmail).first();

    if (!user) {
      // Don't reveal if email exists for security
      // Still return success to prevent email enumeration
      return jsonResponse({
        message: 'If the email exists, a password reset link has been sent'
      });
    }

    // Generate password reset token
    const resetToken = await generateVerificationToken(user.id, 'password_reset', env);

    // Log password reset request
    await logAuthEvent(env, user.id, 'password_reset_requested', request, {
      email: normalizedEmail
    });

    // TODO: Send password reset email
    // In production, integrate with Cloudflare Email Routing or SendGrid
    // For now, return the token in the response (development only)

    return jsonResponse({
      message: 'If the email exists, a password reset link has been sent',
      // DEVELOPMENT ONLY: Include reset token in response
      // Remove this in production and send via email
      resetToken: resetToken
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * POST /auth/password-reset
 *
 * Reset password with token
 *
 * Request body:
 * - token: string (required)
 * - newPassword: string (required)
 *
 * Response:
 * - 200: { message: 'Password reset successful' }
 * - 400: { error: 'Invalid or expired token' }
 * - 500: { error: 'Internal server error' }
 */
export async function handlePasswordReset(request, env) {
  try {
    // Parse request body
    const { token, newPassword } = await request.json();

    // Validate input
    if (!token) {
      return errorResponse('Reset token is required');
    }

    if (!newPassword) {
      return errorResponse('New password is required');
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return errorResponse(passwordValidation.errors.join(', '));
    }

    // Validate token and get user ID
    const userId = await validateVerificationToken(token, 'password_reset', env);

    if (!userId) {
      return errorResponse('Invalid or expired reset token', 400);
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update user's password
    await env.DB.prepare(
      'UPDATE users SET password_hash = ? WHERE id = ?'
    ).bind(newPasswordHash, userId).run();

    // Invalidate all existing sessions for this user (force re-login)
    // Note: KV doesn't support querying by value, so we can't easily delete all user sessions
    // This is a limitation of using KV for sessions. Consider using D1 sessions table in future.
    // For now, sessions will naturally expire.

    // Log password reset event
    await logAuthEvent(env, userId, 'password_reset', request, {});

    return jsonResponse({
      message: 'Password reset successful. Please login with your new password.'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const authHandlers = {
  register: handleRegister,
  login: handleLogin,
  logout: handleLogout,
  getMe: handleGetMe,
  verifyEmail: handleVerifyEmail,
  passwordResetRequest: handlePasswordResetRequest,
  passwordReset: handlePasswordReset
};
