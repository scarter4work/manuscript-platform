/**
 * Authentication Middleware
 *
 * Provides authentication and authorization middleware for itty-router
 */

import { getUserFromRequest } from '../auth-utils.js';
import { assertAuthenticated, assertAuthorized } from '../error-handling.js';

/**
 * Middleware to attach user information to request
 * Runs on all requests - adds userId and user object if authenticated
 *
 * Usage:
 *   router.all('*', authMiddleware);
 *
 * After this middleware runs:
 *   - request.userId will be set if authenticated (or null)
 *   - request.user will contain full user object if authenticated (or null)
 */
export async function authMiddleware(request, env) {
  try {
    // Get userId from session cookie
    const userId = await getUserFromRequest(request, env);
    request.userId = userId;

    // Fetch full user object if authenticated
    if (userId) {
      const user = await env.DB.prepare(
        'SELECT id, email, role, email_verified FROM users WHERE id = ?'
      ).bind(userId).first();

      request.user = user;
    } else {
      request.user = null;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    // Don't throw - allow request to continue with null user
    request.userId = null;
    request.user = null;
  }

  // Explicitly return undefined to continue to next middleware
  return;
}

/**
 * Middleware to require authentication
 * Throws AuthenticationError (401) if user is not authenticated
 *
 * Usage:
 *   router.get('/manuscripts', requireAuth, handleGetManuscripts);
 *   router.post('/upload', requireAuth, handleUpload);
 */
export function requireAuth(request) {
  assertAuthenticated(request.userId, 'Please log in to access this resource');
}

/**
 * Middleware to require admin role
 * Throws AuthenticationError (401) if not logged in
 * Throws AuthorizationError (403) if not admin
 *
 * Usage:
 *   router.get('/admin/users', requireAdmin, handleGetUsers);
 *   router.post('/admin/refund', requireAdmin, handleRefund);
 */
export function requireAdmin(request) {
  // First check authentication
  assertAuthenticated(request.userId, 'Admin access requires authentication');

  // Then check authorization
  const isAdmin = request.user && request.user.role === 'admin';
  assertAuthorized(isAdmin, 'Admin access required');
}

/**
 * Middleware to require email verification
 * Throws AuthenticationError if not logged in
 * Throws AuthorizationError if email not verified
 *
 * Usage:
 *   router.post('/upload', requireEmailVerified, handleUpload);
 */
export function requireEmailVerified(request) {
  assertAuthenticated(request.userId, 'Authentication required');

  const isVerified = request.user && request.user.email_verified === 1;
  assertAuthorized(
    isVerified,
    'Email verification required. Please check your email for the verification link.'
  );
}

/**
 * Middleware to optionally authenticate (soft auth)
 * Does NOT throw errors if user is not authenticated
 * Useful for endpoints that work differently for authenticated vs anonymous users
 *
 * Usage:
 *   router.get('/public-data', optionalAuth, handlePublicData);
 *   // Handler can check `if (request.userId) { ... }` for user-specific behavior
 */
export async function optionalAuth(request, env) {
  // Same as authMiddleware, but explicitly named for clarity
  await authMiddleware(request, env);
}
