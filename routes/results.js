/**
 * Results and Report Routes for Hono
 *
 * Endpoints for fetching analysis results and generating formatted reports
 */

import {
  handleGenerateReport,
  handleGenerateAnnotatedManuscript,
  handleGetAnalysisResults,
} from '../results-handlers.js';
import { assertAuthenticated } from '../error-handling.js';

/**
 * Middleware to require authentication for Hono routes
 */
function requireAuth(c, next) {
  const userId = c.get('userId');
  assertAuthenticated(userId, 'Please log in to access results');
  return next();
}

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
 * Register all results and report routes
 *
 * @param {Hono} app - Hono app instance
 */
export default function registerResultsRoutes(app) {
  // GET /report - Generate formatted HTML report
  // Protected endpoint - requires authentication
  app.get('/report', requireAuth, wrapHandler(handleGenerateReport));

  // GET /annotated - Generate annotated manuscript with inline highlights
  // Protected endpoint - requires authentication
  app.get('/annotated', requireAuth, wrapHandler(handleGenerateAnnotatedManuscript));

  // GET /results - Get analysis results as JSON
  // Protected endpoint - requires authentication
  app.get('/results', requireAuth, wrapHandler(handleGetAnalysisResults));
}
