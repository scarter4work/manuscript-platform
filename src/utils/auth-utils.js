/**
 * Authentication Utilities for Manuscript Platform
 *
 * Handles user authentication, session management, and security
 * Uses bcrypt for password hashing and Redis for sessions
 *
 * Security Features:
 * - bcrypt password hashing (cost factor 12)
 * - Secure session tokens (crypto.randomUUID)
 * - HttpOnly, Secure, SameSite cookies
 * - Session expiration (30 minutes default, 30 days with remember me)
 * - Audit logging for all auth events
 */

import bcrypt from 'bcryptjs';

// ============================================================================
// CONFIGURATION
// ============================================================================

export const AUTH_CONFIG = {
  SESSION_DURATION: 30 * 60,                // 30 minutes in seconds (inactivity timeout)
  SESSION_DURATION_REMEMBER: 30 * 24 * 60 * 60, // 30 days for "remember me"
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIREMENTS: {
    uppercase: true,
    lowercase: true,
    number: true,
    special: true
  },
  BCRYPT_COST: 12,                          // bcrypt cost factor
  TOKEN_EXPIRY: 24 * 60 * 60 * 1000,        // 24 hours for verification tokens
  RESET_TOKEN_EXPIRY: 60 * 60 * 1000,       // 1 hour for password reset
  RATE_LIMIT: {
    LOGIN_ATTEMPTS: 5,                       // Max login attempts
    LOGIN_WINDOW: 5 * 60 * 1000              // in 5 minutes (milliseconds)
  }
};

// ============================================================================
// PASSWORD VALIDATION
// ============================================================================

/**
 * Validates password meets security requirements
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 *
 * @param {string} password - The password to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validatePassword(password) {
  const errors = [];

  if (!password || password.length < AUTH_CONFIG.PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${AUTH_CONFIG.PASSWORD_MIN_LENGTH} characters long`);
  }

  if (AUTH_CONFIG.PASSWORD_REQUIREMENTS.uppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (AUTH_CONFIG.PASSWORD_REQUIREMENTS.lowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (AUTH_CONFIG.PASSWORD_REQUIREMENTS.number && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (AUTH_CONFIG.PASSWORD_REQUIREMENTS.special && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates email format
 *
 * @param {string} email - The email to validate
 * @returns {boolean} True if valid email format
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================================================
// PASSWORD HASHING
// ============================================================================

/**
 * Hash a password using bcrypt
 *
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
  return await bcrypt.hash(password, AUTH_CONFIG.BCRYPT_COST);
}

/**
 * Verify a password against a bcrypt hash
 *
 * @param {string} password - Plain text password
 * @param {string} hash - Stored bcrypt hash
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new session for a user
 *
 * @param {string} userId - User ID
 * @param {Object} env - Environment with Redis client
 * @param {boolean} rememberMe - Extend session duration
 * @returns {Promise<string>} Session ID
 */
export async function createSession(userId, env, rememberMe = false) {
  const sessionId = crypto.randomUUID();
  const duration = rememberMe ? AUTH_CONFIG.SESSION_DURATION_REMEMBER : AUTH_CONFIG.SESSION_DURATION;

  const sessionData = {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + (duration * 1000),
    rememberMe
  };

  // Store in Redis with TTL
  if (env.REDIS) {
    try {
      await env.REDIS.setEx(
        `session:${sessionId}`,
        duration,
        JSON.stringify(sessionData)
      );
    } catch (error) {
      console.error('Failed to create session in Redis:', error);
      // Continue anyway - session won't persist but login can succeed
    }
  } else {
    console.warn('Session storage not available: Redis not configured');
  }

  return sessionId;
}

/**
 * Validate a session and return user ID
 *
 * @param {string} sessionId - Session ID from cookie
 * @param {Object} env - Environment with Redis client
 * @returns {Promise<string|null>} User ID if valid, null otherwise
 */
export async function validateSession(sessionId, env) {
  if (!sessionId) {
    return null;
  }

  if (!env.REDIS) {
    console.warn('Session validation skipped: Redis not configured');
    return null;
  }

  try {
    const sessionData = await env.REDIS.get(`session:${sessionId}`);

    if (!sessionData) {
      return null;
    }

    const session = JSON.parse(sessionData);

    // Check if session is expired
    if (session.expiresAt < Date.now()) {
      // Clean up expired session
      await env.REDIS.del(`session:${sessionId}`);
      return null;
    }

    // Refresh session on activity (extend expiration)
    const duration = session.rememberMe ? AUTH_CONFIG.SESSION_DURATION_REMEMBER : AUTH_CONFIG.SESSION_DURATION;
    session.expiresAt = Date.now() + (duration * 1000);

    // Update session in Redis with refreshed TTL
    await env.REDIS.setEx(
      `session:${sessionId}`,
      duration,
      JSON.stringify(session)
    );

    return session.userId;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

/**
 * Destroy a session (logout)
 *
 * @param {string} sessionId - Session ID to destroy
 * @param {Object} env - Environment with Redis client
 * @returns {Promise<void>}
 */
export async function destroySession(sessionId, env) {
  if (!sessionId) {
    return;
  }

  if (!env.REDIS) {
    console.warn('Session destruction skipped: Redis not configured');
    return;
  }

  try {
    await env.REDIS.del(`session:${sessionId}`);
  } catch (error) {
    console.error('Failed to destroy session:', error);
    // Don't throw - logout should succeed even if Redis fails
  }
}

/**
 * Get user ID from request (checks session cookie)
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Cloudflare environment
 * @returns {Promise<string|null>} User ID if authenticated
 */
export async function getUserFromRequest(request, env) {
  const cookie = request.headers.get('Cookie');

  if (!cookie) {
    return null;
  }

  // Parse session ID from cookie
  const sessionMatch = cookie.match(/session_id=([^;]+)/);
  if (!sessionMatch) {
    return null;
  }

  const sessionId = sessionMatch[1];
  return await validateSession(sessionId, env);
}

// ============================================================================
// COOKIE HELPERS
// ============================================================================

/**
 * Create a secure session cookie
 *
 * @param {string} sessionId - Session ID
 * @param {boolean} rememberMe - Whether to extend cookie duration
 * @returns {string} Set-Cookie header value
 */
export function createSessionCookie(sessionId, rememberMe = false) {
  const maxAge = rememberMe ? AUTH_CONFIG.SESSION_DURATION_REMEMBER : AUTH_CONFIG.SESSION_DURATION;

  return `session_id=${sessionId}; Path=/; Domain=.selfpubhub.co; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`;
}

/**
 * Create a cookie to clear the session (logout)
 *
 * @returns {string} Set-Cookie header value
 */
export function clearSessionCookie() {
  return 'session_id=; Path=/; Domain=.selfpubhub.co; HttpOnly; Secure; SameSite=None; Max-Age=0';
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log an authentication event to the audit log
 *
 * @param {Object} env - Cloudflare environment (D1 access)
 * @param {string} userId - User ID (use 'anonymous' for failed logins)
 * @param {string} action - Action performed (login/logout/register/password_reset)
 * @param {Request} request - HTTP request (for IP, user agent)
 * @param {Object} metadata - Additional context
 * @returns {Promise<void>}
 */
export async function logAuthEvent(env, userId, action, request, metadata = {}) {
  const id = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);

  // Handle missing headers in test context
  const ipAddress = request?.headers?.get ?
    (request.headers.get('CF-Connecting-IP') || 'unknown') :
    'unknown';
  const userAgent = request?.headers?.get ?
    (request.headers.get('User-Agent') || 'unknown') :
    'unknown';

  // Skip logging for anonymous/invalid users (no user record exists)
  // This prevents foreign key constraint violations
  if (userId === 'anonymous' || !userId) {
    console.log(`[Audit] Skipping audit log for ${action} - no valid user_id`);
    return;
  }

  try {
    await env.DB.prepare(`
      INSERT INTO audit_log (id, user_id, event_type, resource_type, resource_id, created_at, ip_address, user_agent, event_details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      userId,
      action,
      'auth',
      userId,
      timestamp,
      ipAddress,
      userAgent,
      JSON.stringify(metadata)
    ).run();
  } catch (error) {
    console.error('Audit log error:', error);
    // Don't throw - logging failures shouldn't block auth
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Check if an IP has exceeded rate limits for login attempts
 *
 * @param {string} ipAddress - IP address to check
 * @param {Object} env - Environment with Redis client
 * @returns {Promise<boolean>} True if rate limited
 */
export async function isRateLimited(ipAddress, env) {
  // Skip rate limiting if Redis not available
  if (!env.REDIS) {
    console.warn('Rate limiting disabled: Redis not configured');
    return false;
  }

  const key = `rate_limit:login:${ipAddress}`;

  try {
    const attempts = await env.REDIS.get(key);

    if (!attempts) {
      return false;
    }

    const attemptData = JSON.parse(attempts);

    // Check if within time window and exceeded max attempts
    const now = Date.now();
    if (attemptData.timestamp + AUTH_CONFIG.RATE_LIMIT.LOGIN_WINDOW > now) {
      return attemptData.count >= AUTH_CONFIG.RATE_LIMIT.LOGIN_ATTEMPTS;
    }

    // Window expired, reset
    await env.REDIS.del(key);
    return false;
  } catch (error) {
    console.error('Rate limit check error:', error);
    return false; // Fail open - don't block on Redis errors
  }
}

/**
 * Record a failed login attempt
 *
 * @param {string} ipAddress - IP address
 * @param {Object} env - Environment with Redis client
 * @returns {Promise<void>}
 */
export async function recordLoginAttempt(ipAddress, env) {
  // Skip rate limiting if Redis not available
  if (!env.REDIS) {
    console.warn('Rate limiting disabled: Redis not configured');
    return;
  }

  const key = `rate_limit:login:${ipAddress}`;

  try {
    const attempts = await env.REDIS.get(key);

    let attemptData = attempts ? JSON.parse(attempts) : { count: 0, timestamp: Date.now() };

    attemptData.count++;

    // Store with TTL matching the rate limit window (EX = seconds)
    const ttlSeconds = Math.ceil(AUTH_CONFIG.RATE_LIMIT.LOGIN_WINDOW / 1000);
    await env.REDIS.setEx(
      key,
      ttlSeconds,
      JSON.stringify(attemptData)
    );
  } catch (error) {
    console.error('Failed to record login attempt:', error);
    // Don't throw - rate limiting failures shouldn't block login attempts
  }
}

/**
 * Clear rate limit for an IP (on successful login)
 *
 * @param {string} ipAddress - IP address
 * @param {Object} env - Environment with Redis client
 * @returns {Promise<void>}
 */
export async function clearRateLimit(ipAddress, env) {
  // Skip rate limiting if Redis not available
  if (!env.REDIS) {
    return;
  }

  const key = `rate_limit:login:${ipAddress}`;

  try {
    await env.REDIS.del(key);
  } catch (error) {
    console.error('Failed to clear rate limit:', error);
    // Don't throw - this is a cleanup operation
  }
}

// ============================================================================
// VERIFICATION TOKENS
// ============================================================================

/**
 * Generate a verification token for email verification or password reset
 *
 * @param {string} userId - User ID
 * @param {string} tokenType - 'email_verification' or 'password_reset'
 * @param {Object} env - Cloudflare environment
 * @returns {Promise<string>} Token string
 */
export async function generateVerificationToken(userId, tokenType, env) {
  // Generate secure random token (32 bytes = 64 hex chars)
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = createdAt + Math.floor(
    tokenType === 'password_reset'
      ? AUTH_CONFIG.RESET_TOKEN_EXPIRY / 1000
      : AUTH_CONFIG.TOKEN_EXPIRY / 1000
  );

  // Store in database
  await env.DB.prepare(`
    INSERT INTO verification_tokens (token, user_id, token_type, created_at, expires_at, used)
    VALUES (?, ?, ?, ?, ?, 0)
  `).bind(token, userId, tokenType, createdAt, expiresAt).run();

  return token;
}

/**
 * Validate and consume a verification token
 *
 * @param {string} token - Token string
 * @param {string} tokenType - Expected token type
 * @param {Object} env - Cloudflare environment
 * @returns {Promise<string|null>} User ID if valid, null otherwise
 */
export async function validateVerificationToken(token, tokenType, env) {
  const result = await env.DB.prepare(`
    SELECT user_id, expires_at, used
    FROM verification_tokens
    WHERE token = ? AND token_type = ?
  `).bind(token, tokenType).first();

  if (!result) {
    return null;
  }

  // Check if already used
  if (result.used === 1) {
    return null;
  }

  // Check if expired
  const now = Math.floor(Date.now() / 1000);
  if (result.expires_at < now) {
    return null;
  }

  // Mark as used
  await env.DB.prepare(`
    UPDATE verification_tokens
    SET used = 1
    WHERE token = ?
  `).bind(token).run();

  return result.user_id;
}
