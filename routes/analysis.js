/**
 * Analysis Routes for Hono
 *
 * Manuscript analysis endpoints (developmental, line editing, copy editing)
 */

import {
  handleDevelopmentalAnalysis,
  handleLineEditingAnalysis,
  handleCopyEditingAnalysis,
  handleStartAnalysis,
  handleAnalysisStatus,
} from '../analysis-handlers.js';
import { assertAuthenticated } from '../error-handling.js';

/**
 * Middleware to require authentication for Hono routes
 */
function requireAuth(c, next) {
  const userId = c.get('userId');
  assertAuthenticated(userId, 'Please log in to access analysis features');
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
 * Register all analysis routes
 *
 * @param {Hono} app - Hono app instance
 */
export default function registerAnalysisRoutes(app) {
  // POST /analyze/developmental - Run developmental analysis
  // Protected endpoint - requires authentication
  app.post('/analyze/developmental', requireAuth, wrapHandler(handleDevelopmentalAnalysis));

  // POST /analyze/line-editing - Run line editing analysis
  // Protected endpoint - requires authentication
  app.post('/analyze/line-editing', requireAuth, wrapHandler(handleLineEditingAnalysis));

  // POST /analyze/copy-editing - Run copy editing analysis
  // Protected endpoint - requires authentication
  app.post('/analyze/copy-editing', requireAuth, wrapHandler(handleCopyEditingAnalysis));

  // POST /analyze/start - Start async analysis (queue-based)
  // Protected endpoint - requires authentication
  app.post('/analyze/start', requireAuth, wrapHandler(handleStartAnalysis));

  // GET /analyze/status - Check analysis status
  // Protected endpoint - requires authentication
  app.get('/analyze/status', requireAuth, wrapHandler(handleAnalysisStatus));
}
