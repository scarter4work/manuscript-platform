/**
 * Manuscript Platform Worker (Refactored with Hono)
 *
 * This is the new entry point using Hono for modular routing.
 * Phase 2: Auth routes migrated (8 routes)
 * Phase 3: All remaining routes migrated (46 routes)
 * Total: 54 routes across 8 route groups
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getUserFromRequest } from './auth-utils.js';
import { applyRateLimit } from './rate-limiter.js';
import { createErrorResponse } from './error-handling.js';
import { getAllHeaders } from './middleware/cors.js';
import registerAuthRoutes from './routes/auth.js';
import registerManuscriptRoutes from './routes/manuscripts.js';
import registerPaymentRoutes from './routes/payments.js';
import registerAdminRoutes from './routes/admin.js';
import registerAnalysisRoutes from './routes/analysis.js';
import registerAssetRoutes from './routes/assets.js';
import registerDMCARoutes from './routes/dmca.js';
import registerResultsRoutes from './routes/results.js';
import registerPublicAPIRoutes from './routes/public-api.js';
import registerKDPRoutes from './routes/kdp.js';
import queueConsumer from './queue-consumer.js';
import assetConsumer from './asset-generation-consumer.js';

// Create Hono app instance
const app = new Hono();

// ============================================================================
// GLOBAL MIDDLEWARE
// ============================================================================

// 1. CORS Middleware
app.use('*', cors({
  origin: (origin) => {
    const allowedOrigins = [
      'https://scarter4workmanuscripthub.com',
      'https://www.scarter4workmanuscripthub.com',
      'https://manuscript-platform.pages.dev',
      'http://localhost:8000',
      'http://localhost:3000',
      'http://localhost:8787',
    ];
    return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  },
  allowMethods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'X-Filename', 'X-Author-Id', 'X-File-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}));

// 2. Security Headers Middleware
app.use('*', async (c, next) => {
  await next();

  // Add security headers to response
  const securityHeaders = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com;",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  };

  Object.entries(securityHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

// 3. Auth Middleware - Attach user info to context
app.use('*', async (c, next) => {
  try {
    const userId = await getUserFromRequest(c.req.raw, c.env);
    c.set('userId', userId);

    if (userId) {
      const user = await c.env.DB.prepare(
        'SELECT id, email, role, email_verified, subscription_tier FROM users WHERE id = ?'
      ).bind(userId).first();
      c.set('user', user);
    } else {
      c.set('user', null);
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    c.set('userId', null);
    c.set('user', null);
  }

  await next();
});

// 4. Rate Limiting Middleware
app.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname;

  // Skip rate limiting for webhooks and static assets
  if (path.startsWith('/webhooks/') || path.startsWith('/assets/')) {
    c.set('rateLimitHeaders', {});
    await next();
    return;
  }

  try {
    const userId = c.get('userId');
    const user = c.get('user');
    const userTier = user?.subscription_tier || null;

    const rateLimitResult = await applyRateLimit(c.req.raw, c.env, userId, userTier);

    if (rateLimitResult.response) {
      // Rate limit exceeded
      return rateLimitResult.response;
    }

    // Store headers for later
    c.set('rateLimitHeaders', rateLimitResult.headers || {});
  } catch (error) {
    console.error('Rate limit middleware error:', error);
    c.set('rateLimitHeaders', {});
  }

  await next();

  // Add rate limit headers to response
  const rateLimitHeaders = c.get('rateLimitHeaders') || {};
  Object.entries(rateLimitHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.onError((err, c) => {
  console.error('Hono error handler:', err);

  // Create standardized error response
  const errorResponse = createErrorResponse(err, c.req.raw);

  // Add rate limit headers if available
  const rateLimitHeaders = c.get('rateLimitHeaders') || {};
  const headers = new Headers(errorResponse.headers);
  Object.entries(rateLimitHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(errorResponse.body, {
    status: errorResponse.status,
    headers,
  });
});

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

// Phase 2: Auth routes
registerAuthRoutes(app);

// Phase 3: Manuscript routes
registerManuscriptRoutes(app);

// Phase 3: Payment routes
registerPaymentRoutes(app);

// Phase 3: Admin routes
registerAdminRoutes(app);

// Phase 3: Analysis routes
registerAnalysisRoutes(app);

// Phase 3: Asset routes
registerAssetRoutes(app);

// Phase 3: DMCA routes
registerDMCARoutes(app);

// Phase 3: Results routes
registerResultsRoutes(app);

// MAN-14: Public API routes (Enterprise tier)
registerPublicAPIRoutes(app);

// MAN-15: KDP Export routes
registerKDPRoutes(app);

// ============================================================================
// 404 HANDLER
// ============================================================================

app.notFound((c) => {
  return c.json({
    error: 'Route not found',
    message: 'Phase 2 & 3 complete: All 54 routes migrated to modular Hono router.',
    availableRoutes: {
      auth: [
        'POST /auth/register',
        'POST /auth/login',
        'POST /auth/logout',
        'GET /auth/me',
        'GET /auth/verify-email',
        'POST /auth/password-reset-request',
        'POST /auth/password-reset',
        'GET /auth/verify-reset-token',
      ],
      manuscripts: [
        'POST /manuscripts/upload',
        'GET /manuscripts',
        'GET /manuscripts/:id',
        'DELETE /manuscripts/:id',
        'PATCH /manuscripts/:id',
        'GET /manuscripts/:id/status',
      ],
      payments: [
        'POST /payments/create-checkout-session',
        'POST /payments/create-payment-intent',
        'POST /payments/create-portal-session',
        'GET /payments/subscription',
        'GET /payments/history',
        'GET /payments/can-upload',
        'POST /webhooks/stripe',
        'POST /payments/webhook',
      ],
      admin: [
        'GET /admin/users',
        'GET /admin/manuscripts',
        'GET /admin/analytics/overview',
        'GET /admin/analytics/activity',
        'GET /admin/billing/transactions',
        'GET /admin/billing/subscriptions/stats',
        'GET /admin/billing/revenue',
        'GET /admin/billing/failed-payments',
        'POST /admin/billing/refund',
        'POST /admin/billing/cancel-subscription',
        'GET /admin/dmca/requests',
        'GET /admin/dmca/stats',
        'PATCH /admin/dmca/status',
        'POST /admin/dmca/resolve',
      ],
      analysis: [
        'POST /analyze/developmental',
        'POST /analyze/line-editing',
        'POST /analyze/copy-editing',
        'POST /analyze/start',
        'GET /analyze/status',
      ],
      assets: [
        'GET /assets/status',
        'POST /generate-assets',
        'GET /assets',
        'POST /format-manuscript',
        'GET /download-formatted',
        'POST /analyze-market',
        'GET /market-analysis',
        'POST /generate-social-media',
        'GET /social-media',
      ],
      dmca: [
        'POST /dmca/submit',
      ],
      results: [
        'GET /report',
        'GET /annotated',
        'GET /results',
      ]
    },
    requestedPath: new URL(c.req.url).pathname,
  }, 404);
});

// ============================================================================
// WORKER EXPORT
// ============================================================================

export default {
  /**
   * HTTP Request Handler
   */
  async fetch(request, env, ctx) {
    console.log('[Hono] Incoming request:', request.method, new URL(request.url).pathname);
    return app.fetch(request, env, ctx);
  },

  /**
   * Queue Consumer Handler
   */
  async queue(batch, env) {
    const queueName = batch.queue;
    console.log(`[Queue Router] Processing batch from queue: ${queueName}`);

    try {
      if (queueName === 'manuscript-analysis-queue') {
        return await queueConsumer.queue(batch, env);
      } else if (queueName === 'asset-generation-queue') {
        return await assetConsumer.queue(batch, env);
      } else {
        console.error(`[Queue Router] Unknown queue: ${queueName}`);
      }
    } catch (error) {
      console.error(`[Queue Router] Error processing queue ${queueName}:`, error);
    }
  },
};
