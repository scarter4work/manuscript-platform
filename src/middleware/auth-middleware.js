import { getUserFromRequest } from '../../auth-utils.js';

/**
 * Get user information from request if authenticated
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @returns {Object|null} User info or null if not authenticated
 */
export async function getUserInfo(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return null;
    }

    const user = await env.DB.prepare(
      'SELECT id, email, role, subscription_tier FROM users WHERE id = ?'
    ).bind(userId).first();

    return user || null;
  } catch (error) {
    console.log('[Auth] Error getting user info:', error.message);
    return null;
  }
}

/**
 * Require authentication middleware
 * Returns 401 response if user is not authenticated
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @returns {Object|null} User info or null if not authenticated
 */
export async function requireAuth(request, env) {
  const user = await getUserInfo(request, env);
  if (!user) {
    throw new Error('Unauthorized: Authentication required');
  }
  return user;
}

/**
 * Require admin role middleware
 * Returns 403 response if user is not an admin
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @returns {Object} User info if admin
 */
export async function requireAdmin(request, env) {
  const user = await requireAuth(request, env);
  if (user.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }
  return user;
}
