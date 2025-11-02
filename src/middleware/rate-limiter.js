import { applyRateLimit } from '../utils/rate-limiter.js';
import { getUserFromRequest } from '../utils/auth-utils.js';

/**
 * Apply rate limiting middleware
 * Skips rate limiting for webhooks and static assets
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} path - The request path
 * @returns {Object} Rate limit result with response (if limited) and headers
 */
export async function applyRateLimiting(request, env, path) {
  // Skip rate limiting for webhooks and static assets
  if (path.startsWith('/webhooks/') || path.startsWith('/assets/')) {
    return { response: null, headers: {} };
  }

  // Get user info if authenticated (for user-specific rate limits)
  let userId = null;
  let userTier = null;

  try {
    userId = await getUserFromRequest(request, env);
    if (userId) {
      const user = await env.DB.prepare(
        'SELECT role, subscription_tier FROM users WHERE id = ?'
      ).bind(userId).first();

      if (user) {
        if (user.role === 'admin') {
          userTier = 'ADMIN';
        } else if (user.subscription_tier) {
          userTier = user.subscription_tier.toUpperCase();
        } else {
          userTier = 'FREE';
        }
      }
    }
  } catch (authError) {
    console.log('[RateLimit] No valid session, applying IP-only limits');
  }

  const rateLimitResult = await applyRateLimit(request, env, userId, userTier);

  return {
    response: rateLimitResult.response,
    headers: rateLimitResult.headers || {},
  };
}
