/**
 * Combined Middleware
 *
 * Combines all middleware into a single function for itty-router
 */

import { corsMiddleware } from './cors.js';
import { authMiddleware } from './auth.js';
import { rateLimitMiddleware } from './rateLimit.js';

/**
 * Combined middleware that runs all middleware in sequence
 * This ensures proper execution order and avoids itty-router chaining issues
 */
export async function combinedMiddleware(request, env, ctx) {
  // 1. Handle CORS (might return early for OPTIONS)
  const corsResult = corsMiddleware(request);
  if (corsResult) {
    return corsResult; // OPTIONS request, return preflight response
  }

  // 2. Attach auth info (async)
  await authMiddleware(request, env);

  // 3. Check rate limits (async, might throw)
  await rateLimitMiddleware(request, env);

  // Continue to route handler
  return;
}
