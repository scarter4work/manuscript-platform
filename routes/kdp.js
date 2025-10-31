/**
 * KDP Export Routes for Hono (MAN-15)
 *
 * Amazon KDP export package generation and download
 */

import { kdpHandlers } from '../kdp-export-handler.js';
import { assertAuthenticated } from '../error-handling.js';

/**
 * Middleware to require authentication for Hono routes
 */
function requireAuth(c, next) {
  const userId = c.get('userId');
  assertAuthenticated(userId, 'Please log in to access KDP export features');
  return next();
}

/**
 * Wrap existing handler to work with Hono context
 */
function wrapHandler(handler) {
  return async (c) => {
    // Set X-User-Id header for handler
    const userId = c.get('userId');
    const headers = new Headers(c.req.raw.headers);
    headers.set('X-User-Id', userId);

    const request = new Request(c.req.raw.url, {
      method: c.req.raw.method,
      headers,
      body: c.req.raw.body
    });

    const response = await handler(request, c.env);

    // Add rate limit headers from context
    const rateLimitHeaders = c.get('rateLimitHeaders') || {};
    const responseHeaders = new Headers(response.headers);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  };
}

/**
 * Wrap handler with path parameters
 */
function wrapHandlerWithParams(handler, ...paramNames) {
  return async (c) => {
    const userId = c.get('userId');
    const headers = new Headers(c.req.raw.headers);
    headers.set('X-User-Id', userId);

    const request = new Request(c.req.raw.url, {
      method: c.req.raw.method,
      headers,
      body: c.req.raw.body
    });

    const params = paramNames.map(name => c.req.param(name));
    const response = await handler(request, c.env, ...params);

    const rateLimitHeaders = c.get('rateLimitHeaders') || {};
    const responseHeaders = new Headers(response.headers);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  };
}

/**
 * Register all KDP export routes
 *
 * @param {Hono} app - Hono app instance
 */
export default function registerKDPRoutes(app) {
  // POST /kdp/export/:manuscriptId - Generate KDP export package
  // Protected endpoint - requires authentication
  app.post('/kdp/export/:manuscriptId', requireAuth, wrapHandlerWithParams(kdpHandlers.generateKDPPackage, 'manuscriptId'));

  // GET /kdp/packages - List all KDP export packages
  // Protected endpoint - requires authentication
  app.get('/kdp/packages', requireAuth, wrapHandler(kdpHandlers.listKDPPackages));

  // GET /kdp/download/:packageId/:fileType - Download individual file from package
  // Protected endpoint - requires authentication
  // fileType: 'manuscript', 'cover', 'metadata', 'readme'
  app.get('/kdp/download/:packageId/:fileType', requireAuth, wrapHandlerWithParams(kdpHandlers.downloadKDPFile, 'packageId', 'fileType'));
}
