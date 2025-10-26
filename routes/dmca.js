/**
 * DMCA Routes for Hono
 *
 * Public DMCA takedown request submission endpoint
 */

import { handleDMCASubmission } from '../dmca-handlers.js';

/**
 * Wrap existing handler to work with Hono context
 * These handlers already accept (request, env, corsHeaders)
 */
function wrapHandler(handler) {
  return async (c) => {
    // Get CORS headers from context (set by middleware)
    const corsHeaders = {};

    // Call the original handler with request, env, and corsHeaders
    const response = await handler(c.req.raw, c.env, corsHeaders);

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
 * Register DMCA routes
 *
 * @param {Hono} app - Hono app instance
 */
export default function registerDMCARoutes(app) {
  // POST /dmca/submit - Submit DMCA takedown request
  // Public endpoint - no authentication required
  app.post('/dmca/submit', wrapHandler(handleDMCASubmission));
}
