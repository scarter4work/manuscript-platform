/**
 * Admin Routes for Hono
 *
 * Admin management endpoints for users, manuscripts, analytics, billing, and DMCA
 */

import { adminHandlers } from '../admin-handlers.js';
import {
  listPaymentTransactions,
  getSubscriptionStats,
  getRevenueAnalytics,
  getFailedPayments,
  issueRefund,
  cancelSubscription,
} from '../admin-billing-handlers.js';
import {
  getDMCARequests,
  getDMCAStats,
  updateDMCAStatus,
  resolveDMCARequest,
} from '../dmca-admin-handlers.js';
import { assertAuthenticated } from '../error-handling.js';

/**
 * Middleware to require authentication for Hono routes
 */
function requireAuth(c, next) {
  const userId = c.get('userId');
  assertAuthenticated(userId, 'Please log in to access admin features');
  return next();
}

/**
 * Middleware to require admin role
 */
async function requireAdmin(c, next) {
  const user = c.get('user');

  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

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
 * Register all admin routes
 *
 * @param {Hono} app - Hono app instance
 */
export default function registerAdminRoutes(app) {
  // All admin routes require authentication AND admin role

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  // GET /admin/users - List all users with filtering and pagination
  app.get('/admin/users', requireAuth, requireAdmin, wrapHandler(adminHandlers.listUsers));

  // ============================================================================
  // MANUSCRIPT OVERSIGHT
  // ============================================================================

  // GET /admin/manuscripts - List all manuscripts with filtering
  app.get('/admin/manuscripts', requireAuth, requireAdmin, wrapHandler(adminHandlers.listAllManuscripts));

  // ============================================================================
  // PLATFORM ANALYTICS
  // ============================================================================

  // GET /admin/analytics/overview - Platform overview stats
  app.get('/admin/analytics/overview', requireAuth, requireAdmin, wrapHandler(adminHandlers.getAnalyticsOverview));

  // GET /admin/analytics/activity - Recent platform activity
  app.get('/admin/analytics/activity', requireAuth, requireAdmin, wrapHandler(adminHandlers.getRecentActivity));

  // ============================================================================
  // BILLING MANAGEMENT
  // ============================================================================

  // GET /admin/billing/transactions - Get payment transactions with filtering
  app.get('/admin/billing/transactions', requireAuth, requireAdmin, wrapHandler(listPaymentTransactions));

  // GET /admin/billing/subscriptions/stats - Get subscription statistics and breakdown
  app.get('/admin/billing/subscriptions/stats', requireAuth, requireAdmin, wrapHandler(getSubscriptionStats));

  // GET /admin/billing/revenue - Get revenue analytics
  app.get('/admin/billing/revenue', requireAuth, requireAdmin, wrapHandler(getRevenueAnalytics));

  // GET /admin/billing/failed-payments - Get failed payments for admin review
  app.get('/admin/billing/failed-payments', requireAuth, requireAdmin, wrapHandler(getFailedPayments));

  // POST /admin/billing/refund - Issue refund for a payment
  app.post('/admin/billing/refund', requireAuth, requireAdmin, wrapHandler(issueRefund));

  // POST /admin/billing/cancel-subscription - Manually cancel user subscription
  app.post('/admin/billing/cancel-subscription', requireAuth, requireAdmin, wrapHandler(cancelSubscription));

  // ============================================================================
  // DMCA MANAGEMENT
  // ============================================================================

  // GET /admin/dmca/requests - Get all DMCA requests with filtering
  app.get('/admin/dmca/requests', requireAuth, requireAdmin, wrapHandler(getDMCARequests));

  // GET /admin/dmca/stats - Get DMCA request statistics
  app.get('/admin/dmca/stats', requireAuth, requireAdmin, wrapHandler(getDMCAStats));

  // PATCH /admin/dmca/status - Update DMCA request status
  app.patch('/admin/dmca/status', requireAuth, requireAdmin, wrapHandler(updateDMCAStatus));

  // POST /admin/dmca/resolve - Resolve DMCA request (approve or reject)
  app.post('/admin/dmca/resolve', requireAuth, requireAdmin, wrapHandler(resolveDMCARequest));
}
