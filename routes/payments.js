/**
 * Payment and Subscription Routes for Hono
 *
 * Stripe payment and subscription management endpoints
 */

import {
  createCheckoutSession,
  createPaymentIntent,
  createPortalSession,
  getSubscription,
  getPaymentHistory,
  checkCanUpload,
} from '../payment-handlers.js';
import { handleStripeWebhook } from '../webhook-handlers.js';
import { assertAuthenticated } from '../error-handling.js';

/**
 * Middleware to require authentication for Hono routes
 */
function requireAuth(c, next) {
  const userId = c.get('userId');
  assertAuthenticated(userId, 'Please log in to access payment features');
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
 * Register all payment routes
 *
 * @param {Hono} app - Hono app instance
 */
export default function registerPaymentRoutes(app) {
  // POST /payments/create-checkout-session - Create Stripe checkout session
  // Protected endpoint - requires authentication
  app.post('/payments/create-checkout-session', requireAuth, wrapHandler(createCheckoutSession));

  // POST /payments/create-payment-intent - Create Stripe payment intent
  // Protected endpoint - requires authentication
  app.post('/payments/create-payment-intent', requireAuth, wrapHandler(createPaymentIntent));

  // POST /payments/create-portal-session - Create Stripe customer portal session
  // Protected endpoint - requires authentication
  app.post('/payments/create-portal-session', requireAuth, wrapHandler(createPortalSession));

  // GET /payments/subscription - Get user's subscription details
  // Protected endpoint - requires authentication
  app.get('/payments/subscription', requireAuth, wrapHandler(getSubscription));

  // GET /payments/history - Get payment history
  // Protected endpoint - requires authentication
  app.get('/payments/history', requireAuth, wrapHandler(getPaymentHistory));

  // GET /payments/can-upload - Check if user can upload manuscripts
  // Protected endpoint - requires authentication
  app.get('/payments/can-upload', requireAuth, wrapHandler(checkCanUpload));

  // POST /webhooks/stripe - Stripe webhook handler
  // Public endpoint - Stripe signature verification handles security
  // Skip rate limiting for webhooks (handled by middleware)
  app.post('/webhooks/stripe', wrapHandler(handleStripeWebhook));

  // Legacy webhook endpoint (kept for backward compatibility)
  app.post('/payments/webhook', wrapHandler(handleStripeWebhook));
}
