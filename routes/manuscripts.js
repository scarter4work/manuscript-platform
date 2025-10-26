/**
 * Manuscript Routes for Hono
 *
 * Manuscript library management endpoints
 */

import { manuscriptHandlers } from '../manuscript-handlers.js';
import { assertAuthenticated } from '../error-handling.js';

/**
 * Middleware to require authentication for Hono routes
 */
function requireAuth(c, next) {
  const userId = c.get('userId');
  assertAuthenticated(userId, 'Please log in to access manuscripts');
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
 * Wrap handler that takes additional parameters (like manuscriptId)
 */
function wrapHandlerWithId(handler) {
  return async (c) => {
    const manuscriptId = c.req.param('id');
    const response = await handler(c.req.raw, c.env, manuscriptId);

    const rateLimitHeaders = c.get('rateLimitHeaders') || {};
    const headers = new Headers(response.headers);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Register all manuscript routes
 *
 * @param {Hono} app - Hono app instance
 */
export default function registerManuscriptRoutes(app) {
  // GET /manuscripts - List user's manuscripts
  // Protected endpoint - requires authentication
  app.get('/manuscripts', requireAuth, wrapHandler(manuscriptHandlers.listManuscripts));

  // GET /manuscripts/stats - Get manuscript statistics
  // Protected endpoint - requires authentication
  app.get('/manuscripts/stats', requireAuth, wrapHandler(manuscriptHandlers.getManuscriptStats));

  // GET /manuscripts/:id - Get specific manuscript details
  // Protected endpoint - requires authentication
  app.get('/manuscripts/:id', requireAuth, wrapHandlerWithId(manuscriptHandlers.getManuscript));

  // PUT /manuscripts/:id - Update manuscript metadata
  // Protected endpoint - requires authentication
  app.put('/manuscripts/:id', requireAuth, wrapHandlerWithId(manuscriptHandlers.updateManuscript));

  // DELETE /manuscripts/:id - Delete manuscript
  // Protected endpoint - requires authentication
  app.delete('/manuscripts/:id', requireAuth, wrapHandlerWithId(manuscriptHandlers.deleteManuscript));

  // POST /manuscripts/:id/reanalyze - Re-run analysis
  // Protected endpoint - requires authentication
  app.post('/manuscripts/:id/reanalyze', requireAuth, wrapHandlerWithId(manuscriptHandlers.reanalyzeManuscript));
}
