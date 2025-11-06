/**
 * Authentication Routes for Hono
 *
 * All authentication-related endpoints (/auth/*)
 */

import {
  handleRegister,
  handleLogin,
  handleLogout,
  handleGetMe,
  handleVerifyEmail,
  handleResendVerification,
  handlePasswordResetRequest,
  handlePasswordReset,
  handleVerifyResetToken,
} from '../auth-handlers.js';
import { assertAuthenticated } from '../error-handling.js';

/**
 * Middleware to require authentication for Hono routes
 */
function requireAuth(c, next) {
  const userId = c.get('userId');
  assertAuthenticated(userId, 'Please log in to access this resource');
  return next();
}

/**
 * Wrap existing handler to work with Hono context
 * Converts (request, env) pattern to (c) pattern
 */
function wrapHandler(handler) {
  return async (c) => {
    // Call the original handler with request and env
    const response = await handler(c.req.raw, c.env);

    // Add rate limit headers from context
    const rateLimitHeaders = c.get('rateLimitHeaders') || {};
    const headers = new Headers(response.headers);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    // Return new response with added headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Register all authentication routes
 *
 * @param {Hono} app - Hono app instance
 */
export default function registerAuthRoutes(app) {
  // POST /auth/register - User registration
  // Public endpoint - no authentication required
  app.post('/auth/register', wrapHandler(handleRegister));

  // POST /auth/login - User login
  // Public endpoint - creates session
  app.post('/auth/login', wrapHandler(handleLogin));

  // POST /auth/logout - User logout
  // Protected endpoint - requires authentication
  app.post('/auth/logout', requireAuth, wrapHandler(handleLogout));

  // GET /auth/me - Get current user info
  // Protected endpoint - requires authentication
  app.get('/auth/me', requireAuth, wrapHandler(handleGetMe));

  // GET /auth/verify-email - Email verification
  // Public endpoint - uses token from query parameter
  app.get('/auth/verify-email', wrapHandler(handleVerifyEmail));

  // POST /auth/resend-verification - Resend verification email
  // Public endpoint - sends verification email
  app.post('/auth/resend-verification', wrapHandler(handleResendVerification));

  // POST /auth/password-reset-request - Request password reset
  // Public endpoint - sends reset email
  app.post('/auth/password-reset-request', wrapHandler(handlePasswordResetRequest));

  // POST /auth/password-reset - Reset password with token
  // Public endpoint - uses token from request body
  app.post('/auth/password-reset', wrapHandler(handlePasswordReset));

  // GET /auth/verify-reset-token - Verify reset token validity
  // Public endpoint - checks if token is valid
  app.get('/auth/verify-reset-token', wrapHandler(handleVerifyResetToken));
}
