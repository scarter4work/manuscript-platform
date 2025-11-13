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
 *
 * MAN-28/MAN-39: Now includes KV caching for user profile lookups
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
} from '../utils/auth-utils.js';
import { initCache } from '../utils/db-cache.js';
import { sendEmailVerification } from '../services/email-service.js';

// ============================================================================
// CORS HEADERS
// ============================================================================

const ALLOWED_ORIGINS = [
  'https://selfpubhub.co',
  'https://www.selfpubhub.co',
  'https://api.selfpubhub.co',
  'https://dashboard.selfpubhub.co',
  'https://dce046dd.manuscript-platform.pages.dev',
  'https://manuscript-platform.pages.dev',
  'http://localhost:8000',
  'http://localhost:3000',
];

function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a JSON response with CORS headers
 *
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code
 * @param {Object} additionalHeaders - Additional headers (e.g., Set-Cookie)
 * @param {string} origin - Request origin for CORS
 * @returns {Response}
 */
function jsonResponse(data, status = 200, additionalHeaders = {}, origin = null) {
  const corsHeaders = getCorsHeaders(origin);
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...additionalHeaders }
  });
}

/**
 * Create an error response
 *
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {string} origin - Request origin for CORS
 * @returns {Response}
 */
function errorResponse(message, status = 400, origin = null) {
  return jsonResponse({ error: message }, status, {}, origin);
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
      INSERT INTO users (id, email, password_hash, role, created_at, updated_at, email_verified)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).bind(userId, normalizedEmail, passwordHash, role, now, now).run();

    // Create free subscription for new user
    try {
      const { createFreeSubscription } = await import('./payment-handlers.js');
      await createFreeSubscription(env, userId);
    } catch (error) {
      console.error('Failed to create free subscription:', error);
      // Don't fail registration if subscription creation fails
    }

    // Generate email verification token
    const verificationToken = await generateVerificationToken(userId, 'email_verification', env);

    // Log registration event
    await logAuthEvent(env, userId, 'register', request, {
      role,
      email: normalizedEmail
    });

    // Send verification email
    try {
      await sendEmailVerification({
        userId,
        userEmail: normalizedEmail,
        userName: normalizedEmail.split('@')[0], // Use email prefix as name for now
        verificationToken
      }, env);
      console.log(`Verification email sent to: ${normalizedEmail}`);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails - user can request resend
    }

    return jsonResponse({
      userId,
      message: 'Registration successful. Please check your email to verify your account.',
      // DEVELOPMENT ONLY: Include verification token in response for testing
      // Remove this line in production once email delivery is confirmed
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
  // Get origin for CORS (declare outside try block so it's available in catch)
  const origin = request?.headers?.get('Origin');

  try {
    // Get IP address for rate limiting
    const ipAddress = request?.headers?.get('CF-Connecting-IP') || 'unknown';

    // Check rate limiting
    if (await isRateLimited(ipAddress, env)) {
      return errorResponse('Too many login attempts. Try again in 5 minutes.', 429, origin);
    }

    // Parse request body
    const { email, password, rememberMe = false } = await request.json();

    // Validate input
    if (!email || !password) {
      return errorResponse('Email and password are required', 400, origin);
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase();

    // Fetch user from database
    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, email_verified FROM users WHERE email = ?'
    ).bind(normalizedEmail).first();

    // Verify user exists and password matches
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      // Record failed login attempt
      await recordLoginAttempt(ipAddress, env);

      // Log failed login (use user.id if user exists, otherwise 'anonymous')
      await logAuthEvent(env, user?.id || 'anonymous', 'login_failed', request, {
        email: normalizedEmail,
        reason: 'invalid_credentials'
      });

      return errorResponse('Invalid credentials', 400, origin);
    }

    // Check if email is verified (handle both BOOLEAN and INTEGER types)
    if (!user.email_verified) {
      await logAuthEvent(env, user.id, 'login_failed', request, {
        reason: 'email_not_verified'
      });

      return errorResponse('Email not verified. Please check your email for verification link.', 403, origin);
    }

    // Clear rate limit on successful login
    await clearRateLimit(ipAddress, env);

    // Create session
    const sessionId = await createSession(user.id, env, rememberMe);

    // Update last login timestamp
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?'
    ).bind(now, now, user.id).run();

    // Log successful login
    await logAuthEvent(env, user.id, 'login', request, {
      rememberMe
    });

    // Return success with Set-Cookie header
    return jsonResponse({
      userId: user.id,
      email: user.email,
      message: 'Login successful'
    }, 200, {
      'Set-Cookie': createSessionCookie(sessionId, rememberMe)
    }, origin);

  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('Internal server error', 500, origin);
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
    const cookie = request?.headers?.get('Cookie');
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
 *
 * MAN-39: Now uses KV caching (1 hour TTL) for user profile
 */
export async function handleGetMe(request, env) {
  // Get origin for CORS (declare outside try block for catch access)
  const origin = request?.headers?.get('Origin') || process.env.FRONTEND_URL;

  try {
    // Get user ID from session
    const userId = await getUserFromRequest(request, env);

    if (!userId) {
      return errorResponse('Not authenticated', 401, origin);
    }

    // Initialize cache
    const cache = initCache(env);

    // Get user profile from cache or DB
    const user = await cache.user.getProfile(userId, env);

    if (!user) {
      return errorResponse('User not found', 404, origin);
    }

    // Return user info
    return jsonResponse({
      userId: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.created_at,
      lastLogin: user.last_login,
      emailVerified: !!user.email_verified
    }, 200, { 'X-Cache': 'HIT' }, origin);

  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse('Internal server error', 500, origin);
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
 *
 * MAN-39: Invalidates user cache after verification
 */
export async function handleVerifyEmail(request, env) {
  try {
    // Get token from request body (POST) or query parameters (GET)
    let token;
    if (request.json) {
      const body = await request.json();
      token = body.token;
    } else if (request.url) {
      const url = new URL(request.url);
      token = url.searchParams.get('token');
    }

    if (!token) {
      return errorResponse('Verification token is required');
    }

    // Validate token and get user ID
    const userId = await validateVerificationToken(token, 'email_verification', env);

    if (!userId) {
      return errorResponse('Invalid or expired verification token', 400);
    }

    // Update user's email_verified flag
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?'
    ).bind(now, userId).run();

    // Invalidate user cache
    const cache = initCache(env);
    await cache.user.invalidate(userId);
    console.log(`Cache INVALIDATED: user ${userId}`);

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
    // Get IP address for rate limiting
    const ipAddress = request?.headers?.get('x-forwarded-for') || request?.headers?.get('CF-Connecting-IP') || 'unknown';

    // Check rate limiting (3 requests per hour)
    if (env.REDIS) {
      const key = `rate_limit:password_reset:${ipAddress}`;
      const attempts = await env.REDIS.get(key);
      if (attempts && parseInt(attempts) >= 3) {
        return errorResponse('Too many password reset requests. Please try again later.', 429);
      }
    }

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

    // Use email username as fallback for display name (since full_name column doesn't exist yet)
    const displayName = normalizedEmail.split('@')[0] || 'User';

    // Send password reset email via MailChannels
    const resetUrl = `${env.FRONTEND_URL}/reset-password.html?token=${resetToken}`;
    try {
      await sendPasswordResetEmail(env, normalizedEmail, displayName, resetUrl);
      console.log('Password reset email sent to:', normalizedEmail);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Don't fail the request if email fails - still return success
    }

    // Increment rate limit counter
    if (env.REDIS) {
      const key = `rate_limit:password_reset:${ipAddress}`;
      const current = await env.REDIS.get(key);
      await env.REDIS.set(key, (parseInt(current) || 0) + 1, { EX: 3600 }); // 1 hour expiry
    }

    return jsonResponse({
      message: 'If the email exists, a password reset link has been sent'
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
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
    ).bind(newPasswordHash, now, userId).run();

    // Invalidate all existing sessions for this user (force re-login)
    // Note: KV doesn't support querying by value, so we can't easily delete all user sessions
    // This is a limitation of using KV for sessions. Consider using D1 sessions table in future.
    // For now, sessions will naturally expire.

    // Log password reset event
    await logAuthEvent(env, userId, 'password_reset', request, {});

    // Send confirmation email
    const user = await env.DB.prepare(
      'SELECT email FROM users WHERE id = ?'
    ).bind(userId).first();

    if (user) {
      try {
        await sendPasswordResetConfirmationEmail(env, user.email);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Don't fail if email fails
      }
    }

    return jsonResponse({
      message: 'Password reset successful. Please login with your new password.'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * GET /auth/verify-reset-token
 * Verify if reset token is valid (before showing reset form)
 *
 * Query param: token
 * Returns: { valid: boolean, error?: string }
 */
export async function handleVerifyResetToken(request, env) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return jsonResponse({ valid: false, error: 'Token is required' });
    }

    // Validate token (doesn't consume it, just checks if valid)
    const userId = await validateVerificationToken(token, 'password_reset', env);

    if (!userId) {
      return jsonResponse({ valid: false, error: 'Invalid or expired token' });
    }

    return jsonResponse({ valid: true });

  } catch (error) {
    console.error('Verify reset token error:', error);
    return jsonResponse({ valid: false, error: 'Failed to verify token' }, 500);
  }
}

/**
 * POST /auth/resend-verification
 * Resend email verification link
 *
 * Request body:
 * - email: string (required)
 *
 * Response:
 * - 200: { message: 'Verification email sent' }
 * - 400: { error: 'Invalid email' }
 * - 409: { error: 'Email already verified' }
 * - 500: { error: 'Internal server error' }
 */
export async function handleResendVerification(request, env) {
  try {
    // Get IP address for rate limiting
    const ipAddress = request?.headers?.get('x-forwarded-for') || request?.headers?.get('CF-Connecting-IP') || 'unknown';

    // Check rate limiting (3 requests per hour)
    if (env.REDIS) {
      const key = `rate_limit:resend_verification:${ipAddress}`;
      const attempts = await env.REDIS.get(key);
      if (attempts && parseInt(attempts) >= 3) {
        return errorResponse('Too many verification resend requests. Please try again later.', 429);
      }
    }

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
      'SELECT id, email_verified FROM users WHERE email = ?'
    ).bind(normalizedEmail).first();

    if (!user) {
      // Don't reveal if email exists for security
      return jsonResponse({
        message: 'If the email is registered and not verified, a verification link has been sent'
      });
    }

    // Check if already verified
    if (user.email_verified) {
      return errorResponse('Email is already verified. You can log in now.', 409);
    }

    // Generate new verification token
    const verificationToken = await generateVerificationToken(user.id, 'email_verification', env);

    // Send verification email
    try {
      await sendEmailVerification({
        userId: user.id,
        userEmail: normalizedEmail,
        userName: normalizedEmail.split('@')[0],
        verificationToken
      }, env);
      console.log(`Verification email resent to: ${normalizedEmail}`);
    } catch (emailError) {
      console.error('Failed to resend verification email:', emailError);
      return errorResponse('Failed to send verification email. Please try again later.', 500);
    }

    // Log resend event
    await logAuthEvent(env, user.id, 'verification_resent', request, {
      email: normalizedEmail
    });

    // Increment rate limit counter
    if (env.REDIS) {
      const key = `rate_limit:resend_verification:${ipAddress}`;
      const current = await env.REDIS.get(key);
      await env.REDIS.set(key, (parseInt(current) || 0) + 1, { EX: 3600 }); // 1 hour expiry
    }

    return jsonResponse({
      message: 'Verification email sent. Please check your inbox.',
      // DEVELOPMENT ONLY: Include token for testing
      verificationToken: verificationToken
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// ============================================================================
// EMAIL FUNCTIONS
// ============================================================================

/**
 * Send password reset email via MailChannels
 */
async function sendPasswordResetEmail(env, toEmail, fullName, resetUrl) {
  const emailContent = {
    personalizations: [{
      to: [{ email: toEmail, name: fullName || toEmail }],
    }],
    from: {
      email: env.EMAIL_FROM_ADDRESS,
      name: env.EMAIL_FROM_NAME
    },
    subject: 'Reset Your Password - ManuscriptHub',
    content: [{
      type: 'text/html',
      value: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h2 style="color: #007bff; margin-top: 0;">Password Reset Request</h2>
            <p>Hi${fullName ? ' ' + fullName : ''},</p>
            <p>We received a request to reset your password for your ManuscriptHub account. If you didn't make this request, you can safely ignore this email.</p>
            <p>To reset your password, click the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #007bff; font-size: 14px;">${resetUrl}</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="color: #666; font-size: 12px; margin: 5px 0;">
                <strong>Security Notice:</strong> This link will expire in 1 hour.
              </p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">
                If you didn't request a password reset, please contact support at ${env.EMAIL_ADMIN_ADDRESS}.
              </p>
            </div>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
              <p>© 2025 ManuscriptHub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    }]
  };

  const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emailContent)
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${await response.text()}`);
  }
}

/**
 * Send password reset confirmation email
 */
async function sendPasswordResetConfirmationEmail(env, toEmail) {
  const emailContent = {
    personalizations: [{
      to: [{ email: toEmail }],
    }],
    from: {
      email: env.EMAIL_FROM_ADDRESS,
      name: env.EMAIL_FROM_NAME
    },
    subject: 'Password Reset Successful - ManuscriptHub',
    content: [{
      type: 'text/html',
      value: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h2 style="color: #28a745; margin-top: 0;">✓ Password Reset Successful</h2>
            <p>Your ManuscriptHub password has been successfully reset.</p>
            <p>You can now log in to your account using your new password.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${env.FRONTEND_URL}/login.html" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Log In Now
              </a>
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="color: #666; font-size: 12px; margin: 5px 0;">
                <strong>Security Alert:</strong> If you didn't make this change, your account may be compromised.
              </p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">
                Please contact support immediately at ${env.EMAIL_ADMIN_ADDRESS}.
              </p>
            </div>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
              <p>© 2025 ManuscriptHub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    }]
  };

  await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emailContent)
  });
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
  resendVerification: handleResendVerification,
  passwordResetRequest: handlePasswordResetRequest,
  passwordReset: handlePasswordReset,
  verifyResetToken: handleVerifyResetToken
};

// Alias exports for backward compatibility with tests
export { handlePasswordResetRequest as handleRequestPasswordReset };
export { handleGetMe as handleGetCurrentUser };
export { handlePasswordReset as handleResetPassword };
