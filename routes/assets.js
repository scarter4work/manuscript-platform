/**
 * Assets and Publishing Routes for Hono
 *
 * Marketing assets, manuscript formatting, market analysis, and social media endpoints
 */

import {
  handleAssetStatus,
  handleGenerateAssets,
  handleGetAssets,
  handleFormatManuscript,
  handleDownloadFormatted,
  handleMarketAnalysis,
  handleGetMarketAnalysis,
  handleGenerateSocialMedia,
  handleGetSocialMedia,
} from '../asset-handlers.js';
import { assertAuthenticated } from '../error-handling.js';

/**
 * Middleware to require authentication for Hono routes
 */
function requireAuth(c, next) {
  const userId = c.get('userId');
  assertAuthenticated(userId, 'Please log in to access asset features');
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
 * Register all asset and publishing routes
 *
 * @param {Hono} app - Hono app instance
 */
export default function registerAssetRoutes(app) {
  // GET /assets/status - Check asset generation status
  // Protected endpoint - requires authentication
  app.get('/assets/status', requireAuth, wrapHandler(handleAssetStatus));

  // POST /generate-assets - Generate all marketing and publishing assets
  // Protected endpoint - requires authentication
  app.post('/generate-assets', requireAuth, wrapHandler(handleGenerateAssets));

  // GET /assets - Get generated assets by reportId
  // Protected endpoint - requires authentication
  app.get('/assets', requireAuth, wrapHandler(handleGetAssets));

  // POST /format-manuscript - Format manuscript to EPUB and PDF
  // Protected endpoint - requires authentication
  app.post('/format-manuscript', requireAuth, wrapHandler(handleFormatManuscript));

  // GET /download-formatted - Download formatted file (EPUB or PDF)
  // Protected endpoint - requires authentication
  app.get('/download-formatted', requireAuth, wrapHandler(handleDownloadFormatted));

  // POST /analyze-market - Run market analysis
  // Protected endpoint - requires authentication
  app.post('/analyze-market', requireAuth, wrapHandler(handleMarketAnalysis));

  // GET /market-analysis - Get market analysis results
  // Protected endpoint - requires authentication
  app.get('/market-analysis', requireAuth, wrapHandler(handleGetMarketAnalysis));

  // POST /generate-social-media - Generate social media marketing content
  // Protected endpoint - requires authentication
  app.post('/generate-social-media', requireAuth, wrapHandler(handleGenerateSocialMedia));

  // GET /social-media - Get social media marketing results
  // Protected endpoint - requires authentication
  app.get('/social-media', requireAuth, wrapHandler(handleGetSocialMedia));
}
