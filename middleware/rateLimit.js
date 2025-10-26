/**
 * Rate Limiting Middleware
 *
 * Integrates the existing rate-limiter.js with itty-router
 */

import { applyRateLimit } from '../rate-limiter.js';
import { RateLimitError } from '../error-handling.js';

/**
 * Rate limiting middleware for itty-router
 * Checks IP-based, user-based, and endpoint-based rate limits
 *
 * Throws RateLimitError (429) if rate limit is exceeded
 * Attaches rate limit headers to request.rateLimitHeaders for use in responses
 *
 * Usage:
 *   router.all('*', rateLimitMiddleware);
 *
 * To skip rate limiting for specific routes:
 *   router.post('/webhooks/stripe', skipRateLimit, handleWebhook);
 *
 * After this middleware runs:
 *   - request.rateLimitHeaders will contain X-RateLimit-* headers
 *   - If rate limited, RateLimitError is thrown (caught by error handling middleware)
 */
export async function rateLimitMiddleware(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Skip rate limiting for webhooks and static assets
  if (path.startsWith('/webhooks/') || path.startsWith('/assets/')) {
    request.rateLimitHeaders = {};
    return; // Continue to next middleware
  }

  try {
    // Get user info from request (set by authMiddleware)
    const userId = request.userId || null;
    const userTier = request.user?.subscription_tier || null;

    // Apply rate limiting using existing rate-limiter.js
    const rateLimitResult = await applyRateLimit(request, env, userId, userTier);

    if (rateLimitResult.response) {
      // Rate limit exceeded - throw error
      const retryAfter = rateLimitResult.limitInfo
        ? Math.ceil((rateLimitResult.limitInfo.reset - Date.now()) / 1000)
        : 60;

      throw new RateLimitError(retryAfter);
    }

    // Rate limit not exceeded - attach headers to request
    request.rateLimitHeaders = rateLimitResult.headers || {};
  } catch (error) {
    // If it's already a RateLimitError, rethrow it
    if (error instanceof RateLimitError) {
      throw error;
    }

    // Otherwise, log and continue without rate limiting (fail open)
    console.error('Rate limit middleware error:', error);
    request.rateLimitHeaders = {};
  }

  // Continue to next middleware
  return;
}

/**
 * Middleware to skip rate limiting for specific routes
 * Use this for webhooks, health checks, or other routes that shouldn't be rate limited
 *
 * Usage:
 *   router.post('/webhooks/stripe', skipRateLimit, handleStripeWebhook);
 *   router.get('/health', skipRateLimit, handleHealthCheck);
 */
export function skipRateLimit(request) {
  request.rateLimitHeaders = {};
  // Middleware just sets empty headers and continues
}

/**
 * Helper to add rate limit headers to a response
 * Used in route handlers to include rate limit info in responses
 *
 * Usage:
 *   const response = new Response(JSON.stringify(data), {
 *     headers: { 'Content-Type': 'application/json' }
 *   });
 *   return addRateLimitHeaders(response, request);
 */
export function addRateLimitHeaders(response, request) {
  if (!request.rateLimitHeaders) {
    return response;
  }

  const newHeaders = new Headers(response.headers);

  Object.entries(request.rateLimitHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Stricter rate limiting for sensitive endpoints (login, password reset, etc.)
 * Uses more restrictive limits than general API endpoints
 *
 * Usage:
 *   router.post('/auth/login', strictRateLimit, handleLogin);
 *   router.post('/auth/password-reset', strictRateLimit, handlePasswordReset);
 *
 * Note: This is handled automatically by the rate-limiter.js based on endpoint,
 * but this middleware can be used to explicitly mark sensitive routes.
 */
export async function strictRateLimit(request, env) {
  // The rate-limiter.js already applies stricter limits based on endpoint
  // This middleware is mainly for documentation/clarity
  await rateLimitMiddleware(request, env);
}
