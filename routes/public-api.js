/**
 * Public API Routes for Hono (MAN-14)
 *
 * Enterprise tier REST API endpoints for programmatic access
 */

import { publicAPIHandlers } from '../public-api-handlers.js';

/**
 * Wrap existing handler to work with Hono context
 * These handlers already accept (request, env) or (request, env, param)
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
 * Wrap handler with path parameter (for /:id routes)
 */
function wrapHandlerWithParam(handler, paramName = 'id') {
  return async (c) => {
    const param = c.req.param(paramName);
    const response = await handler(c.req.raw, c.env, param);

    // Add rate limit headers from context
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
 * Register all public API routes
 *
 * @param {Hono} app - Hono app instance
 */
export default function registerPublicAPIRoutes(app) {
  // POST /api/v1/manuscripts - Upload manuscript via API
  // Authentication handled in handler (API key)
  app.post('/api/v1/manuscripts', wrapHandler(publicAPIHandlers.apiUploadManuscript));

  // GET /api/v1/manuscripts - List manuscripts via API
  // Authentication handled in handler (API key)
  app.get('/api/v1/manuscripts', wrapHandler(publicAPIHandlers.apiListManuscripts));

  // POST /api/v1/manuscripts/:id/analyze - Trigger analysis via API
  // Authentication handled in handler (API key)
  app.post('/api/v1/manuscripts/:id/analyze', wrapHandlerWithParam(publicAPIHandlers.apiAnalyzeManuscript));

  // GET /api/v1/manuscripts/:id/status - Get analysis status via API
  // Authentication handled in handler (API key)
  app.get('/api/v1/manuscripts/:id/status', wrapHandlerWithParam(publicAPIHandlers.apiGetManuscriptStatus));

  // GET /api/v1/manuscripts/:id/results - Get analysis results via API
  // Authentication handled in handler (API key)
  app.get('/api/v1/manuscripts/:id/results', wrapHandlerWithParam(publicAPIHandlers.apiGetManuscriptResults));

  // POST /api/v1/webhooks - Configure webhooks
  // Authentication handled in handler (API key)
  app.post('/api/v1/webhooks', wrapHandler(publicAPIHandlers.apiConfigureWebhook));

  // GET /api/v1/usage - Get API usage statistics
  // Authentication handled in handler (API key)
  app.get('/api/v1/usage', wrapHandler(publicAPIHandlers.apiGetUsage));
}
