// Cloudflare Worker for handling manuscript uploads
// Deploy this via Cloudflare Dashboard > Workers & Pages

import { DevelopmentalAgent } from './developmental-agent.js';
import { LineEditingAgent } from './line-editing-agent.js';
import { CopyEditingAgent } from './copy-editing-agent.js';
import { ReportGenerator } from './report-generator.js';
import { AnnotatedManuscriptGenerator } from './annotated-manuscript-generator.js';
import { BookDescriptionAgent } from './book-description-agent.js';
import { KeywordAgent } from './keyword-agent.js';
import { CategoryAgent } from './category-agent.js';
import { AuthorBioAgent } from './author-bio-agent.js';
import { BackMatterAgent } from './back-matter-agent.js';
import { CoverDesignAgent } from './cover-design-agent.js';
import { SeriesDescriptionAgent } from './series-description-agent.js';
import { FormattingAgent } from './formatting-agent.js';
import { MarketAnalysisAgent } from './market-analysis-agent.js';
import { SocialMediaAgent } from './social-media-agent.js';
import { authHandlers } from './auth-handlers.js';
import { manuscriptHandlers } from './manuscript-handlers.js';
import { audiobookHandlers } from './audiobook-handlers.js';
import { reviewHandlers } from './review-handlers.js';
import { publishingHandlers } from './publishing-handlers.js';
import { teamHandlers } from './team-handlers.js';
import { emailPreferenceHandlers } from './email-preference-handlers.js';
import queueConsumer from './queue-consumer.js';
import assetConsumer from './asset-generation-consumer.js';
import { handleStripeWebhook } from './webhook-handlers.js';
import { initSentry, captureError } from './sentry-config.js';
import { logError, logInfo, logWarning, logRequest, logSecurity } from './logging.js';
import { applyRateLimit, createRateLimitHeaders } from './rate-limiter.js';
import { getUserFromRequest } from './auth-utils.js';

export default {
  async fetch(request, env, ctx) {
    console.log('Incoming request:', request.method, request.url);

    // CORS headers - Update with your actual domain
    const allowedOrigins = [
      'https://scarter4workmanuscripthub.com',
      'https://www.scarter4workmanuscripthub.com',
      'https://api.scarter4workmanuscripthub.com',
      'https://dashboard.scarter4workmanuscripthub.com', // Custom domain for dashboard
      'https://dce046dd.manuscript-platform.pages.dev', // Cloudflare Pages deployment
      'https://manuscript-platform.pages.dev', // Custom domain (if configured)
      'http://localhost:8000', // for local testing
      'http://localhost:3000', // for local React dev
      'http://localhost:8787', // for local wrangler dev
    ];

    const origin = request.headers.get('Origin');

    // Determine allowed origin (reject unknown origins for security)
    const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Filename, X-Author-Id, X-File-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true', // Important for cookie-based auth
      'Access-Control-Max-Age': '86400',
    };

    // Security headers (OWASP recommended)
    const securityHeaders = {
      // Content Security Policy - Prevents XSS attacks
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com;",
      // Prevent clickjacking attacks
      'X-Frame-Options': 'DENY',
      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',
      // Enable browser XSS protection
      'X-XSS-Protection': '1; mode=block',
      // Enforce HTTPS (only add in production)
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      // Control referrer information
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      // Control browser features and APIs
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    };

    // Combine CORS and security headers
    const allHeaders = { ...corsHeaders, ...securityHeaders };

    // Helper function to add CORS, security, and rate limit headers to any response
    const addCorsHeaders = (response, extraHeaders = {}) => {
      const newHeaders = new Headers(response.headers);
      Object.entries({ ...allHeaders, ...extraHeaders }).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: allHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    console.log('Request path:', path);

    // Track request start time for monitoring
    const requestStartTime = Date.now();

    try {
      // ========================================================================
      // RATE LIMITING (MAN-25)
      // ========================================================================

      // Get user info if authenticated (for user-specific rate limits)
      let userId = null;
      let userTier = null;

      // Try to get user from session (don't fail if not authenticated)
      try {
        userId = await getUserFromRequest(request, env);
        if (userId) {
          // Get user tier from database
          const user = await env.DB.prepare(
            'SELECT role, subscription_tier FROM users WHERE id = ?'
          ).bind(userId).first();

          if (user) {
            // Map role to tier for rate limiting
            if (user.role === 'admin') {
              userTier = 'ADMIN';
            } else if (user.subscription_tier) {
              userTier = user.subscription_tier.toUpperCase();
            } else {
              userTier = 'FREE';
            }
          }
        }
      } catch (authError) {
        // Not authenticated or session invalid - continue with IP-only rate limiting
        console.log('[RateLimit] No valid session, applying IP-only limits');
      }

      // Apply rate limiting (skip for webhooks and static assets)
      let rateLimitHeaders = {};
      if (!path.startsWith('/webhooks/') && !path.startsWith('/assets/')) {
        const rateLimitResult = await applyRateLimit(request, env, userId, userTier);

        if (rateLimitResult.response) {
          // Rate limit exceeded - return 429 response
          return addCorsHeaders(rateLimitResult.response, rateLimitHeaders);
        }

        // Store rate limit headers to add to successful responses
        rateLimitHeaders = rateLimitResult.headers;
      }

      // ========================================================================
      // AUTHENTICATION ROUTES (Phase A)
      // ========================================================================

      // POST /auth/register - User registration with email verification
      if (path === '/auth/register' && request.method === 'POST') {
        return addCorsHeaders(await authHandlers.register(request, env), rateLimitHeaders);
      }

      // POST /auth/login - User login with rate limiting
      if (path === '/auth/login' && request.method === 'POST') {
        return addCorsHeaders(await authHandlers.login(request, env), rateLimitHeaders);
      }

      // POST /auth/logout - User logout (destroy session)
      if (path === '/auth/logout' && request.method === 'POST') {
        return addCorsHeaders(await authHandlers.logout(request, env), rateLimitHeaders);
      }

      // GET /auth/me - Get current authenticated user info
      if (path === '/auth/me' && request.method === 'GET') {
        return addCorsHeaders(await authHandlers.getMe(request, env), rateLimitHeaders);
      }

      // GET /auth/verify-email - Email verification with token
      if (path === '/auth/verify-email' && request.method === 'GET') {
        return addCorsHeaders(await authHandlers.verifyEmail(request, env), rateLimitHeaders);
      }

      // POST /auth/password-reset-request - Request password reset
      if (path === '/auth/password-reset-request' && request.method === 'POST') {
        return addCorsHeaders(await authHandlers.passwordResetRequest(request, env), rateLimitHeaders);
      }

      // POST /auth/password-reset - Reset password with token
      if (path === '/auth/password-reset' && request.method === 'POST') {
        return addCorsHeaders(await authHandlers.passwordReset(request, env), rateLimitHeaders);
      }

      // GET /auth/verify-reset-token - Verify reset token validity
      if (path === '/auth/verify-reset-token' && request.method === 'GET') {
        return addCorsHeaders(await authHandlers.verifyResetToken(request, env), rateLimitHeaders);
      }

      // ========================================================================
      // MANUSCRIPT LIBRARY ROUTES (Phase B)
      // ========================================================================

      // GET /manuscripts - List user's manuscripts
      if (path === '/manuscripts' && request.method === 'GET') {
        return addCorsHeaders(await manuscriptHandlers.listManuscripts(request, env), rateLimitHeaders);
      }

      // GET /manuscripts/stats - Get user's manuscript statistics
      if (path === '/manuscripts/stats' && request.method === 'GET') {
        return addCorsHeaders(await manuscriptHandlers.getManuscriptStats(request, env), rateLimitHeaders);
      }

      // GET /manuscripts/:id - Get specific manuscript details
      if (path.startsWith('/manuscripts/') && request.method === 'GET' && !path.includes('stats')) {
        const manuscriptId = path.replace('/manuscripts/', '');
        return addCorsHeaders(await manuscriptHandlers.getManuscript(request, env, manuscriptId), rateLimitHeaders);
      }

      // PUT /manuscripts/:id - Update manuscript metadata
      if (path.startsWith('/manuscripts/') && request.method === 'PUT') {
        const manuscriptId = path.replace('/manuscripts/', '');
        return addCorsHeaders(await manuscriptHandlers.updateManuscript(request, env, manuscriptId), rateLimitHeaders);
      }

      // DELETE /manuscripts/:id - Delete manuscript
      if (path.startsWith('/manuscripts/') && request.method === 'DELETE') {
        const manuscriptId = path.replace('/manuscripts/', '');
        return addCorsHeaders(await manuscriptHandlers.deleteManuscript(request, env, manuscriptId), rateLimitHeaders);
      }

      // POST /manuscripts/:id/reanalyze - Re-run analysis
      if (path.match(/^\/manuscripts\/.+\/reanalyze$/) && request.method === 'POST') {
        const manuscriptId = path.match(/^\/manuscripts\/(.+)\/reanalyze$/)[1];
        return addCorsHeaders(await manuscriptHandlers.reanalyzeManuscript(request, env, manuscriptId), rateLimitHeaders);
      }

      // ========================================================================
      // AUDIOBOOK ASSET ROUTES (MAN-18)
      // ========================================================================

      // GET /manuscripts/:id/audiobook - Get all audiobook assets
      if (path.match(/^\/manuscripts\/[^/]+\/audiobook$/) && request.method === 'GET') {
        const manuscriptId = path.split('/')[2];
        return addCorsHeaders(await audiobookHandlers.getAudiobookAssets(request, env, manuscriptId), rateLimitHeaders);
      }

      // GET /manuscripts/:id/audiobook/:assetType - Get specific audiobook asset
      if (path.match(/^\/manuscripts\/[^/]+\/audiobook\/[^/]+$/) && request.method === 'GET') {
        const pathParts = path.split('/');
        const manuscriptId = pathParts[2];
        const assetType = pathParts[4];
        return addCorsHeaders(await audiobookHandlers.getAudiobookAsset(request, env, manuscriptId, assetType), rateLimitHeaders);
      }

      // POST /manuscripts/:id/audiobook/regenerate - Regenerate audiobook assets
      if (path.match(/^\/manuscripts\/[^/]+\/audiobook\/regenerate$/) && request.method === 'POST') {
        const manuscriptId = path.split('/')[2];
        return addCorsHeaders(await audiobookHandlers.regenerateAudiobookAssets(request, env, manuscriptId), rateLimitHeaders);
      }

      // ========================================================================
      // REVIEW MONITORING ROUTES (MAN-19)
      // ========================================================================

      // GET /manuscripts/:id/reviews - Get review monitoring status and recent reviews
      if (path.match(/^\/manuscripts\/[^/]+\/reviews$/) && request.method === 'GET') {
        const manuscriptId = path.split('/')[2];
        return addCorsHeaders(await reviewHandlers.getReviewMonitoring(request, env, manuscriptId), rateLimitHeaders);
      }

      // POST /manuscripts/:id/reviews/setup - Setup or update review monitoring
      if (path.match(/^\/manuscripts\/[^/]+\/reviews\/setup$/) && request.method === 'POST') {
        const manuscriptId = path.split('/')[2];
        return addCorsHeaders(await reviewHandlers.setupReviewMonitoring(request, env, manuscriptId), rateLimitHeaders);
      }

      // POST /manuscripts/:id/reviews/fetch - Manually trigger review fetch
      if (path.match(/^\/manuscripts\/[^/]+\/reviews\/fetch$/) && request.method === 'POST') {
        const manuscriptId = path.split('/')[2];
        return addCorsHeaders(await reviewHandlers.fetchReviews(request, env, manuscriptId), rateLimitHeaders);
      }

      // GET /manuscripts/:id/reviews/sentiment - Get sentiment analysis
      if (path.match(/^\/manuscripts\/[^/]+\/reviews\/sentiment$/) && request.method === 'GET') {
        const manuscriptId = path.split('/')[2];
        return addCorsHeaders(await reviewHandlers.getReviewSentiment(request, env, manuscriptId), rateLimitHeaders);
      }

      // POST /manuscripts/:id/reviews/responses - Get response suggestions
      if (path.match(/^\/manuscripts\/[^/]+\/reviews\/responses$/) && request.method === 'POST') {
        const manuscriptId = path.split('/')[2];
        return addCorsHeaders(await reviewHandlers.getReviewResponses(request, env, manuscriptId), rateLimitHeaders);
      }

      // GET /manuscripts/:id/reviews/trends - Get trend analysis
      if (path.match(/^\/manuscripts\/[^/]+\/reviews\/trends$/) && request.method === 'GET') {
        const manuscriptId = path.split('/')[2];
        return addCorsHeaders(await reviewHandlers.getReviewTrends(request, env, manuscriptId), rateLimitHeaders);
      }

      // ========================================================================
      // MULTI-PLATFORM PUBLISHING ROUTES (MAN-20)
      // ========================================================================

      // POST /manuscripts/:id/publishing/metadata - Generate platform-specific metadata
      if (path.match(/^\/manuscripts\/[^/]+\/publishing\/metadata$/) && request.method === 'POST') {
        const manuscriptId = path.split('/')[2];
        return addCorsHeaders(await publishingHandlers.generatePlatformMetadata(request, env, manuscriptId), rateLimitHeaders);
      }

      // POST /manuscripts/:id/publishing/formats - Prepare manuscript formats
      if (path.match(/^\/manuscripts\/[^/]+\/publishing\/formats$/) && request.method === 'POST') {
        const manuscriptId = path.split('/')[2];
        return addCorsHeaders(await publishingHandlers.prepareFormats(request, env, manuscriptId), rateLimitHeaders);
      }

      // POST /manuscripts/:id/publishing/strategy - Generate distribution strategy
      if (path.match(/^\/manuscripts\/[^/]+\/publishing\/strategy$/) && request.method === 'POST') {
        const manuscriptId = path.split('/')[2];
        return addCorsHeaders(await publishingHandlers.generateDistributionStrategy(request, env, manuscriptId), rateLimitHeaders);
      }

      // POST /manuscripts/:id/publishing/package - Generate complete publishing package
      if (path.match(/^\/manuscripts\/[^/]+\/publishing\/package$/) && request.method === 'POST') {
        const manuscriptId = path.split('/')[2];
        return addCorsHeaders(await publishingHandlers.generatePublishingPackage(request, env, manuscriptId), rateLimitHeaders);
      }

      // ========================================================================
      // TEAM COLLABORATION ROUTES (MAN-13)
      // ========================================================================

      // POST /teams - Create a new team (Enterprise tier only)
      if (path === '/teams' && request.method === 'POST') {
        return addCorsHeaders(await teamHandlers.createTeam(request, env), rateLimitHeaders);
      }

      // GET /teams - List user's teams
      if (path === '/teams' && request.method === 'GET') {
        return addCorsHeaders(await teamHandlers.listTeams(request, env), rateLimitHeaders);
      }

      // GET /teams/:id - Get team details
      if (path.match(/^\/teams\/[^/]+$/) && request.method === 'GET') {
        const teamId = path.split('/')[2];
        return addCorsHeaders(await teamHandlers.getTeam(request, env, teamId), rateLimitHeaders);
      }

      // POST /teams/:id/invite - Invite member to team (admin only)
      if (path.match(/^\/teams\/[^/]+\/invite$/) && request.method === 'POST') {
        const teamId = path.split('/')[2];
        return addCorsHeaders(await teamHandlers.inviteToTeam(request, env, teamId), rateLimitHeaders);
      }

      // POST /teams/accept-invitation/:token - Accept team invitation
      if (path.match(/^\/teams\/accept-invitation\/[^/]+$/) && request.method === 'POST') {
        const token = path.split('/')[3];
        return addCorsHeaders(await teamHandlers.acceptInvitation(request, env, token), rateLimitHeaders);
      }

      // DELETE /teams/:teamId/members/:userId - Remove team member (admin only)
      if (path.match(/^\/teams\/[^/]+\/members\/[^/]+$/) && request.method === 'DELETE') {
        const parts = path.split('/');
        const teamId = parts[2];
        const userId = parts[4];
        return addCorsHeaders(await teamHandlers.removeMember(request, env, teamId, userId), rateLimitHeaders);
      }

      // POST /teams/:id/share-manuscript - Share manuscript with team
      if (path.match(/^\/teams\/[^/]+\/share-manuscript$/) && request.method === 'POST') {
        const teamId = path.split('/')[2];
        return addCorsHeaders(await teamHandlers.shareManuscript(request, env, teamId), rateLimitHeaders);
      }

      // GET /teams/:id/manuscripts - Get team's shared manuscripts
      if (path.match(/^\/teams\/[^/]+\/manuscripts$/) && request.method === 'GET') {
        const teamId = path.split('/')[2];
        return addCorsHeaders(await teamHandlers.getTeamManuscripts(request, env, teamId), rateLimitHeaders);
      }

      // GET /teams/:id/activity - Get team activity feed
      if (path.match(/^\/teams\/[^/]+\/activity$/) && request.method === 'GET') {
        const teamId = path.split('/')[2];
        return addCorsHeaders(await teamHandlers.getTeamActivity(request, env, teamId), rateLimitHeaders);
      }

      // ========================================================================
      // USER PREFERENCE ROUTES
      // ========================================================================

      // GET /user/email-preferences - Get user's email notification preferences
      if (path === '/user/email-preferences' && request.method === 'GET') {
        return addCorsHeaders(await emailPreferenceHandlers.getEmailPreferences(request, env), rateLimitHeaders);
      }

      // PUT /user/email-preferences - Update user's email notification preferences
      if (path === '/user/email-preferences' && request.method === 'PUT') {
        return addCorsHeaders(await emailPreferenceHandlers.updateEmailPreferences(request, env), rateLimitHeaders);
      }

      // POST /user/resubscribe - Re-enable all email notifications
      if (path === '/user/resubscribe' && request.method === 'POST') {
        return addCorsHeaders(await emailPreferenceHandlers.resubscribe(request, env), rateLimitHeaders);
      }

      // GET /unsubscribe/:token - One-click unsubscribe (no auth required)
      if (path.match(/^\/unsubscribe\/[^/]+$/) && request.method === 'GET') {
        return await emailPreferenceHandlers.unsubscribeByToken(request, env);
      }

      // ========================================================================
      // MANUSCRIPT MANAGEMENT ROUTES
      // ========================================================================
      // Route: Upload raw manuscript
      if (path === '/upload/manuscript' && request.method === 'POST') {
        return addCorsHeaders(await handleManuscriptUpload(request, env, allHeaders), rateLimitHeaders);
      }

      // Route: Upload marketing asset
      if (path === '/upload/marketing' && request.method === 'POST') {
        return addCorsHeaders(await handleMarketingUpload(request, env), rateLimitHeaders);
      }

      // Route: Get file (with signed URL generation)
      if (path.startsWith('/get/') && request.method === 'GET') {
        return addCorsHeaders(await handleFileGet(request, env), rateLimitHeaders);
      }

      // Route: List files for an author
      if (path.startsWith('/list/') && request.method === 'GET') {
        return await handleFileList(request, env, allHeaders);
      }

      // Route: Delete file
      if (path.startsWith('/delete/') && request.method === 'DELETE') {
        return await handleFileDelete(request, env, allHeaders);
      }

      // Route: Analyze manuscript (Developmental Agent)
      if (path === '/analyze/developmental' && request.method === 'POST') {
        return await handleDevelopmentalAnalysis(request, env, allHeaders);
      }

      // Route: Analyze manuscript (Line Editing Agent)
      if (path === '/analyze/line-editing' && request.method === 'POST') {
        return await handleLineEditingAnalysis(request, env, allHeaders);
      }

      // Route: Analyze manuscript (Copy Editing Agent)
      if (path === '/analyze/copy-editing' && request.method === 'POST') {
        return await handleCopyEditingAnalysis(request, env, allHeaders);
      }

      // NEW: Start async analysis (queues the job)
      if (path === '/analyze/start' && request.method === 'POST') {
        return await handleStartAnalysis(request, env, allHeaders);
      }

      // NEW: Check analysis status
      if (path === '/analyze/status' && request.method === 'GET') {
        return await handleAnalysisStatus(request, env, allHeaders);
      }

      // Phase D: Check asset generation status
      if (path === '/assets/status' && request.method === 'GET') {
        return await handleAssetStatus(request, env, allHeaders);
      }

      // Phase E: DMCA Takedown Request Submission
      if (path === '/dmca/submit' && request.method === 'POST') {
        return await handleDMCASubmission(request, env, allHeaders);
      }

      // Phase E: Admin DMCA Management Routes
      if (path === '/admin/dmca/requests' && request.method === 'GET') {
        const { getDMCARequests } = await import('./dmca-admin-handlers.js');
        return await getDMCARequests(request, env, allHeaders);
      }

      if (path === '/admin/dmca/stats' && request.method === 'GET') {
        const { getDMCAStats } = await import('./dmca-admin-handlers.js');
        return await getDMCAStats(request, env, allHeaders);
      }

      if (path === '/admin/dmca/status' && request.method === 'PATCH') {
        const { updateDMCAStatus } = await import('./dmca-admin-handlers.js');
        return await updateDMCAStatus(request, env, allHeaders);
      }

      if (path === '/admin/dmca/resolve' && request.method === 'POST') {
        const { resolveDMCARequest } = await import('./dmca-admin-handlers.js');
        return await resolveDMCARequest(request, env, allHeaders);
      }

      // ========================================================================
      // ADMIN MANAGEMENT ROUTES (Phase G)
      // ========================================================================

      // GET /admin/users - List all users
      if (path === '/admin/users' && request.method === 'GET') {
        const { listUsers } = await import('./admin-handlers.js');
        return await listUsers(request, env, allHeaders);
      }

      // GET /admin/users/:userId - Get user details
      if (path.match(/^\/admin\/users\/[^\/]+$/) && request.method === 'GET') {
        const userId = path.split('/')[3];
        const { getUserDetails } = await import('./admin-handlers.js');
        return await getUserDetails(request, env, allHeaders, userId);
      }

      // PATCH /admin/users/:userId - Update user
      if (path.match(/^\/admin\/users\/[^\/]+$/) && request.method === 'PATCH') {
        const userId = path.split('/')[3];
        const { updateUser } = await import('./admin-handlers.js');
        return await updateUser(request, env, allHeaders, userId);
      }

      // POST /admin/users/:userId/subscription - Adjust subscription
      if (path.match(/^\/admin\/users\/[^\/]+\/subscription$/) && request.method === 'POST') {
        const userId = path.split('/')[3];
        const { adjustUserSubscription } = await import('./admin-handlers.js');
        return await adjustUserSubscription(request, env, allHeaders, userId);
      }

      // GET /admin/manuscripts - List all manuscripts
      if (path === '/admin/manuscripts' && request.method === 'GET') {
        const { listAllManuscripts } = await import('./admin-handlers.js');
        return await listAllManuscripts(request, env, allHeaders);
      }

      // DELETE /admin/manuscripts/:manuscriptId - Admin delete manuscript
      if (path.match(/^\/admin\/manuscripts\/[^\/]+$/) && request.method === 'DELETE') {
        const manuscriptId = path.split('/')[3];
        const { adminDeleteManuscript } = await import('./admin-handlers.js');
        return await adminDeleteManuscript(request, env, allHeaders, manuscriptId);
      }

      // GET /admin/analytics/overview - Platform analytics
      if (path === '/admin/analytics/overview' && request.method === 'GET') {
        const { getAnalyticsOverview } = await import('./admin-handlers.js');
        return await getAnalyticsOverview(request, env, allHeaders);
      }

      // GET /admin/analytics/activity - Recent activity
      if (path === '/admin/analytics/activity' && request.method === 'GET') {
        const { getRecentActivity } = await import('./admin-handlers.js');
        return await getRecentActivity(request, env, allHeaders);
      }

      // GET /admin/billing/transactions - List payment transactions
      if (path === '/admin/billing/transactions' && request.method === 'GET') {
        const { listPaymentTransactions } = await import('./admin-billing-handlers.js');
        return await listPaymentTransactions(request, env, allHeaders);
      }

      // GET /admin/billing/transactions/:transactionId - Get transaction details
      if (path.match(/^\/admin\/billing\/transactions\/[^\/]+$/) && request.method === 'GET') {
        const transactionId = path.split('/')[4];
        const { getTransactionDetails } = await import('./admin-billing-handlers.js');
        return await getTransactionDetails(request, env, allHeaders, transactionId);
      }

      // GET /admin/billing/subscriptions/stats - Get subscription statistics
      if (path === '/admin/billing/subscriptions/stats' && request.method === 'GET') {
        const { getSubscriptionStats } = await import('./admin-billing-handlers.js');
        return await getSubscriptionStats(request, env, allHeaders);
      }

      // GET /admin/billing/revenue - Get revenue analytics
      if (path === '/admin/billing/revenue' && request.method === 'GET') {
        const { getRevenueAnalytics } = await import('./admin-billing-handlers.js');
        return await getRevenueAnalytics(request, env, allHeaders);
      }

      // GET /admin/billing/failed-payments - Get failed payments
      if (path === '/admin/billing/failed-payments' && request.method === 'GET') {
        const { getFailedPayments } = await import('./admin-billing-handlers.js');
        return await getFailedPayments(request, env, allHeaders);
      }

      // POST /admin/billing/refund - Issue refund
      if (path === '/admin/billing/refund' && request.method === 'POST') {
        const { issueRefund } = await import('./admin-billing-handlers.js');
        return await issueRefund(request, env, allHeaders);
      }

      // POST /admin/billing/cancel-subscription - Cancel subscription
      if (path === '/admin/billing/cancel-subscription' && request.method === 'POST') {
        const { cancelSubscription } = await import('./admin-billing-handlers.js');
        return await cancelSubscription(request, env, allHeaders);
      }

      // ========================================================================
      // PAYMENT ROUTES (Phase F)
      // ========================================================================

      // POST /payments/create-checkout-session - Create Stripe checkout for subscription
      if (path === '/payments/create-checkout-session' && request.method === 'POST') {
        const { createCheckoutSession } = await import('./payment-handlers.js');
        return await createCheckoutSession(request, env, allHeaders);
      }

      // POST /payments/create-payment-intent - Create payment intent for one-time purchase
      if (path === '/payments/create-payment-intent' && request.method === 'POST') {
        const { createPaymentIntent } = await import('./payment-handlers.js');
        return await createPaymentIntent(request, env, allHeaders);
      }

      // POST /payments/create-portal-session - Create Stripe customer portal session
      if (path === '/payments/create-portal-session' && request.method === 'POST') {
        const { createPortalSession } = await import('./payment-handlers.js');
        return await createPortalSession(request, env, allHeaders);
      }

      // GET /payments/subscription - Get current subscription details
      if (path === '/payments/subscription' && request.method === 'GET') {
        const { getSubscription } = await import('./payment-handlers.js');
        return await getSubscription(request, env, allHeaders);
      }

      // GET /payments/history - Get payment history
      if (path === '/payments/history' && request.method === 'GET') {
        const { getPaymentHistory } = await import('./payment-handlers.js');
        return await getPaymentHistory(request, env, allHeaders);
      }

      // GET /payments/can-upload - Check if user can upload (usage limits)
      if (path === '/payments/can-upload' && request.method === 'GET') {
        const { checkCanUpload } = await import('./payment-handlers.js');
        return await checkCanUpload(request, env, allHeaders);
      }

      // POST /payments/webhook - Stripe webhook handler (coming soon)
      if (path === '/payments/webhook' && request.method === 'POST') {
        return await handleStripeWebhook(request, env, allHeaders);
      }

      // POST /webhooks/stripe - Stripe webhook handler (production endpoint)
      if (path === '/webhooks/stripe' && request.method === 'POST') {
        return await handleStripeWebhook(request, env, allHeaders);
      }

      // Route: Generate marketing assets (book description, keywords, categories)
      if (path === '/generate-assets' && request.method === 'POST') {
        return await handleGenerateAssets(request, env, allHeaders);
      }

      // Route: Get generated assets
      if (path === '/assets' && request.method === 'GET') {
        return await handleGetAssets(request, env, allHeaders);
      }

      // Route: Format manuscript (generate EPUB and PDF)
      if (path === '/format-manuscript' && request.method === 'POST') {
        return await handleFormatManuscript(request, env, allHeaders);
      }

      // Route: Download formatted file
      if (path === '/download-formatted' && request.method === 'GET') {
        return await handleDownloadFormatted(request, env, allHeaders);
      }

      // Route: Analyze market (Phase 2)
      if (path === '/analyze-market' && request.method === 'POST') {
        return await handleMarketAnalysis(request, env, allHeaders);
      }

      // Route: Get market analysis results
      if (path === '/market-analysis' && request.method === 'GET') {
        return await handleGetMarketAnalysis(request, env, allHeaders);
      }

      // Route: Generate social media marketing (Phase 5)
      if (path === '/generate-social-media' && request.method === 'POST') {
        return await handleGenerateSocialMedia(request, env, allHeaders);
      }

      // Route: Get social media marketing results
      if (path === '/social-media' && request.method === 'GET') {
        return await handleGetSocialMedia(request, env, allHeaders);
      }

      // Route: Get analysis results
      if (path.startsWith('/analysis/') && request.method === 'GET') {
        return await handleGetAnalysis(request, env, allHeaders);
      }

      // Route: Get analysis results as JSON by reportId
      if (path === '/results' && request.method === 'GET') {
        return await handleGetAnalysisResults(request, env, allHeaders);
      }

      // Route: Generate formatted report
      if (path === '/report' && request.method === 'GET') {
        return await handleGenerateReport(request, env, allHeaders);
      }

      // Route: Generate annotated manuscript
      if (path === '/annotated' && request.method === 'GET') {
        return await handleGenerateAnnotatedManuscript(request, env, allHeaders);
      }

      // Debug endpoint to check report ID mapping
      if (path === '/debug/report-id' && request.method === 'GET') {
        const reportId = url.searchParams.get('id');
        if (!reportId) {
          return new Response(JSON.stringify({ error: 'id parameter required' }), {
            status: 400,
            headers: { ...allHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);
        if (mappingObject) {
          const manuscriptKey = await mappingObject.text();
          
          // Also check if the manuscript file exists
          const manuscript = await env.MANUSCRIPTS_RAW.get(manuscriptKey);
          
          return new Response(JSON.stringify({ 
            found: true,
            reportId: reportId,
            manuscriptKey: manuscriptKey,
            manuscriptExists: !!manuscript,
            manuscriptSize: manuscript?.size || 0
          }), {
            headers: { ...allHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ 
            found: false,
            reportId: reportId,
            message: 'No mapping found for this report ID'
          }), {
            headers: { ...allHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Add a root route for testing
      if (path === '/' && request.method === 'GET') {
        return new Response(JSON.stringify({
          message: 'Manuscript Upload API is running!',
          version: '2.0.0',
          features: [
            'Multi-user authentication system',
            'AI-powered manuscript analysis',
            'Marketing asset generation',
            'Market analysis and social media marketing',
            'EPUB/PDF formatting'
          ],
          endpoints: {
            authentication: [
              'POST /auth/register',
              'POST /auth/login',
              'POST /auth/logout',
              'GET /auth/me',
              'GET /auth/verify-email',
              'POST /auth/password-reset-request',
              'POST /auth/password-reset'
            ],
            manuscripts: [
              'GET /manuscripts - List user manuscripts',
              'GET /manuscripts/stats - Get statistics',
              'GET /manuscripts/:id - Get manuscript details',
              'PUT /manuscripts/:id - Update manuscript',
              'DELETE /manuscripts/:id - Delete manuscript',
              'POST /manuscripts/:id/reanalyze - Re-run analysis',
              'POST /upload/manuscript - Upload new manuscript',
              'POST /upload/marketing',
              'GET /list/{authorId}',
              'GET /get/{key}',
              'DELETE /delete/{key}'
            ],
            audiobook: [
              'GET /manuscripts/:id/audiobook - Get all audiobook assets',
              'GET /manuscripts/:id/audiobook/:assetType - Get specific asset (narration/pronunciation/timing/samples/metadata)',
              'POST /manuscripts/:id/audiobook/regenerate - Regenerate audiobook assets'
            ],
            reviews: [
              'GET /manuscripts/:id/reviews - Get review monitoring status',
              'POST /manuscripts/:id/reviews/setup - Setup review monitoring',
              'POST /manuscripts/:id/reviews/fetch - Manually fetch reviews',
              'GET /manuscripts/:id/reviews/sentiment - Get sentiment analysis',
              'POST /manuscripts/:id/reviews/responses - Get response suggestions',
              'GET /manuscripts/:id/reviews/trends - Get trend analysis'
            ],
            publishing: [
              'POST /manuscripts/:id/publishing/metadata - Generate platform-specific metadata',
              'POST /manuscripts/:id/publishing/formats - Prepare manuscript formats',
              'POST /manuscripts/:id/publishing/strategy - Generate distribution strategy',
              'POST /manuscripts/:id/publishing/package - Generate complete publishing package'
            ],
            analysis: [
              'POST /analyze/developmental',
              'POST /analyze/line-editing',
              'POST /analyze/copy-editing',
              'POST /analyze/start',
              'GET /analyze/status'
            ],
            assets: [
              'POST /generate-assets',
              'GET /assets',
              'POST /format-manuscript',
              'GET /download-formatted'
            ],
            marketing: [
              'POST /analyze-market',
              'GET /market-analysis',
              'POST /generate-social-media',
              'GET /social-media'
            ],
            reports: [
              'GET /report',
              'GET /annotated',
              'GET /results'
            ]
          },
          dashboard: 'Visit https://scarter4workmanuscripthub.com for the dashboard'
        }), {
          headers: { ...allHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not Found', { status: 404, headers: allHeaders });

    } catch (error) {
      // Log error with structured logging
      logError('request_error', error, {
        path,
        method: request.method,
        url: request.url
      });

      // Capture error in Sentry
      captureError(error, {
        path,
        method: request.method,
        url: request.url
      }, env);

      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }
  },

  // Queue consumer router for multiple queues (Phase C & D)
  async queue(batch, env) {
    // Route to the correct consumer based on queue name
    const queueName = batch.queue;

    console.log(`[Queue Router] Processing batch from queue: ${queueName}`);

    if (queueName === 'manuscript-analysis-queue') {
      return await queueConsumer.queue(batch, env);
    } else if (queueName === 'asset-generation-queue') {
      return await assetConsumer.queue(batch, env);
    } else {
      console.error(`[Queue Router] Unknown queue: ${queueName}`);
      // Acknowledge messages from unknown queues to prevent infinite retries
      for (const message of batch.messages) {
        message.ack();
      }
    }
  },

  // Scheduled handler for automated backups (MAN-29)
  // Triggered by CRON: "0 3 * * *" (daily at 3 AM UTC)
  async scheduled(event, env, ctx) {
    console.log('[Scheduled] CRON trigger fired:', event.cron);

    try {
      // Import and run backup handler
      const { handleScheduledBackup } = await import('./backup-worker.js');
      const result = await handleScheduledBackup(env);

      if (result.success) {
        console.log('[Scheduled] Backup completed successfully:', result.filename);
      } else {
        console.error('[Scheduled] Backup failed:', result.error);
      }
    } catch (error) {
      console.error('[Scheduled] CRON handler error:', error);
    }
  }
};

// Handle manuscript uploads
async function handleManuscriptUpload(request, env, corsHeaders) {
  try {
    console.log('Processing manuscript upload...');

    // Import auth utilities
    const { getUserFromRequest } = await import('./auth-utils.js');

    // Get authenticated user (REQUIRED)
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized - please log in' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Phase F: Check usage limits before allowing upload
    const subscription = await env.DB.prepare(`
      SELECT * FROM user_subscriptions_with_usage WHERE user_id = ?
    `).bind(userId).first();

    const canUpload = !subscription || subscription.manuscripts_this_period < subscription.monthly_limit;

    if (!canUpload) {
      return new Response(JSON.stringify({
        error: 'Upload limit reached',
        planType: subscription.plan_type,
        manuscriptsUsed: subscription.manuscripts_this_period,
        monthlyLimit: subscription.monthly_limit,
        upgradeRequired: true,
        message: 'You have reached your monthly manuscript limit. Please upgrade your plan or wait for your billing period to reset.'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const title = formData.get('title') || file.name.replace(/\.[^/.]+$/, '');
    const genre = formData.get('genre') || 'general';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ error: 'File too large. Maximum size is 50MB' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'application/epub+zip'
    ];

    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Invalid file type. Allowed: PDF, DOCX, DOC, TXT, EPUB' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate IDs
    const manuscriptId = crypto.randomUUID();
    const reportId = crypto.randomUUID().substring(0, 8);
    const timestamp = new Date().toISOString();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const r2Key = `${userId}/${manuscriptId}/${timestamp}_${sanitizedFilename}`;

    // Calculate file hash for duplicate detection
    const fileBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
    const fileHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Count words (approximate)
    const fileText = new TextDecoder().decode(fileBuffer);
    const wordCount = fileText.split(/\s+/).filter(w => w.length > 0).length;

    // Upload to R2
    await env.MANUSCRIPTS_RAW.put(r2Key, new Uint8Array(fileBuffer), {
      customMetadata: {
        manuscriptId,
        userId: userId,
        originalName: file.name,
        uploadTime: timestamp,
        fileType: file.type,
        fileSize: file.size.toString()
      },
      httpMetadata: {
        contentType: file.type,
      }
    });

    // Store report ID mapping
    await env.MANUSCRIPTS_RAW.put(`report-id:${reportId}`, r2Key, {
      expirationTtl: 60 * 60 * 24 * 30 // 30 days
    });

    // Save to database
    await env.DB.prepare(`
      INSERT INTO manuscripts (id, user_id, title, r2_key, file_hash, status, genre, word_count, file_type, metadata, uploaded_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)
    `).bind(
      manuscriptId,
      userId,
      title,
      r2Key,
      fileHash,
      genre,
      wordCount,
      file.type,
      JSON.stringify({ reportId, originalName: file.name }),
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();

    // Log audit event
    await env.DB.prepare(`
      INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, timestamp, metadata)
      VALUES (?, ?, 'upload', 'manuscript', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      manuscriptId,
      Math.floor(Date.now() / 1000),
      JSON.stringify({ title, fileSize: file.size, wordCount })
    ).run();

    // Phase C: Queue analysis automatically after successful upload
    console.log('[Upload] Queueing analysis for manuscript:', manuscriptId);

    try {
      // Initialize status tracking
      await env.MANUSCRIPTS_RAW.put(
        `status:${reportId}`,
        JSON.stringify({
          status: 'queued',
          progress: 0,
          message: 'Analysis queued',
          currentStep: 'queued',
          timestamp: new Date().toISOString()
        }),
        { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
      );

      // Queue the analysis job
      await env.ANALYSIS_QUEUE.send({
        manuscriptKey: r2Key,
        genre: genre,
        styleGuide: 'chicago', // Default style guide
        reportId: reportId
      });

      // Update manuscript status to 'queued' (will change to 'analyzing' when queue consumer starts)
      await env.DB.prepare(
        'UPDATE manuscripts SET status = ?, updated_at = ? WHERE id = ?'
      ).bind('queued', Math.floor(Date.now() / 1000), manuscriptId).run();

      console.log('[Upload] Analysis queued successfully for report:', reportId);
    } catch (queueError) {
      console.error('[Upload] Failed to queue analysis:', queueError);
      // Don't fail the upload if queueing fails - manuscript is still uploaded
      // The user can manually trigger analysis later
    }

    // Phase F: Track usage for billing
    try {
      const { trackUsage } = await import('./payment-handlers.js');
      await trackUsage(env, userId, manuscriptId, 'full', false);
      console.log('[Upload] Usage tracked for manuscript:', manuscriptId);
    } catch (usageError) {
      console.error('[Upload] Failed to track usage:', usageError);
      // Don't fail the upload if usage tracking fails
    }

    return new Response(JSON.stringify({
      success: true,
      manuscript: {
        id: manuscriptId,
        title,
        reportId,
        wordCount,
        fileSize: file.size,
        status: 'queued'
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle marketing asset uploads (covers, author photos, etc.)
async function handleMarketingUpload(request, env, corsHeaders) {
  const formData = await request.formData();
  const file = formData.get('file');
  const authorId = formData.get('authorId') || 'anonymous';
  const assetType = formData.get('assetType') || 'general'; // cover, author-photo, banner, etc.
  
  if (!file) {
    return new Response(JSON.stringify({ error: 'No file provided' }), {
      status: 400,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Validate image file
  const allowedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ];
  
  if (!allowedImageTypes.includes(file.type)) {
    return new Response(JSON.stringify({ error: 'Invalid image type' }), {
      status: 400,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Max 10MB for images
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return new Response(JSON.stringify({ error: 'Image too large. Maximum size is 10MB' }), {
      status: 400,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }

  const timestamp = new Date().toISOString();
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `${authorId}/${assetType}/${timestamp}_${sanitizedFilename}`;

  // Upload to marketing assets bucket
  await env.MARKETING_ASSETS.put(key, file.stream(), {
    customMetadata: {
      authorId: authorId,
      assetType: assetType,
      originalName: file.name,
      uploadTime: timestamp
    },
    httpMetadata: {
      contentType: file.type,
    }
  });

  // Generate a public URL (if bucket is configured for public access)
  const publicUrl = `https://your-domain.com/marketing/${key}`;

  return new Response(JSON.stringify({
    success: true,
    key: key,
    url: publicUrl,
    assetType: assetType
  }), {
    status: 200,
    headers: { ...allHeaders, 'Content-Type': 'application/json' }
  });
}

// Get file with signed URL generation
async function handleFileGet(request, env, corsHeaders) {
  const url = new URL(request.url);
  const key = url.pathname.replace('/get/', '');
  
  // Determine which bucket based on key prefix or parameter
  const bucket = url.searchParams.get('bucket') || 'raw';
  let r2Bucket;
  
  switch(bucket) {
    case 'raw':
      r2Bucket = env.MANUSCRIPTS_RAW;
      break;
    case 'processed':
      r2Bucket = env.MANUSCRIPTS_PROCESSED;
      break;
    case 'marketing':
      r2Bucket = env.MARKETING_ASSETS;
      break;
    default:
      return new Response(JSON.stringify({ error: 'Invalid bucket' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
  }

  const object = await r2Bucket.get(key);
  
  if (!object) {
    return new Response(JSON.stringify({ error: 'File not found' }), {
      status: 404,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Return file directly or generate signed URL
  const returnUrl = url.searchParams.get('url') === 'true';
  
  if (returnUrl) {
    // In production, you'd generate a signed URL here
    // For now, return the key and metadata
    return new Response(JSON.stringify({
      key: key,
      metadata: object.customMetadata,
      size: object.size,
      uploaded: object.uploaded
    }), {
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Return the file directly
  return new Response(object.body, {
    headers: {
      ...allHeaders,
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
    }
  });
}

// List files for an author
async function handleFileList(request, env, corsHeaders) {
  const url = new URL(request.url);
  const authorId = url.pathname.replace('/list/', '');
  const bucket = url.searchParams.get('bucket') || 'raw';
  
  console.log('List files for author:', authorId, 'in bucket:', bucket);
  
  let r2Bucket;
  switch(bucket) {
    case 'raw':
      r2Bucket = env.MANUSCRIPTS_RAW;
      break;
    case 'processed':
      r2Bucket = env.MANUSCRIPTS_PROCESSED;
      break;
    case 'marketing':
      r2Bucket = env.MARKETING_ASSETS;
      break;
    default:
      return new Response(JSON.stringify({ error: 'Invalid bucket' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
  }

  // List objects with prefix
  const listed = await r2Bucket.list({
    prefix: `${authorId}/`,
    limit: 100
  });

  const files = listed.objects.map(obj => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded,
    metadata: obj.customMetadata
  }));

  return new Response(JSON.stringify({
    files: files,
    truncated: listed.truncated,
    cursor: listed.cursor
  }), {
    headers: { ...allHeaders, 'Content-Type': 'application/json' }
  });
}

// Delete file
async function handleFileDelete(request, env, corsHeaders) {
  const url = new URL(request.url);
  const key = url.pathname.replace('/delete/', '');
  const bucket = url.searchParams.get('bucket') || 'raw';
  
  // Add authentication check here in production
  // const authHeader = request.headers.get('Authorization');
  // if (!isAuthorized(authHeader)) { ... }
  
  let r2Bucket;
  switch(bucket) {
    case 'raw':
      r2Bucket = env.MANUSCRIPTS_RAW;
      break;
    case 'processed':
      r2Bucket = env.MANUSCRIPTS_PROCESSED;
      break;
    case 'marketing':
      r2Bucket = env.MARKETING_ASSETS;
      break;
    default:
      return new Response(JSON.stringify({ error: 'Invalid bucket' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
  }

  await r2Bucket.delete(key);

  return new Response(JSON.stringify({
    success: true,
    deleted: key
  }), {
    headers: { ...allHeaders, 'Content-Type': 'application/json' }
  });
}

// Helper function for authentication (implement based on your needs)
function isAuthorized(authHeader) {
  // Implement your auth logic here
  // For now, returning true for development
  return true;
}

// Handle developmental analysis request
async function handleDevelopmentalAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { manuscriptKey, genre } = body;

    if (!manuscriptKey) {
      return new Response(JSON.stringify({ error: 'manuscriptKey is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize the developmental agent
    const agent = new DevelopmentalAgent(env);

    // Run analysis (this may take a while)
    console.log(`Starting developmental analysis for ${manuscriptKey}`);
    const analysis = await agent.analyze(manuscriptKey, genre || 'general');

    return new Response(JSON.stringify({
      success: true,
      analysis: analysis
    }), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle line editing analysis request
async function handleLineEditingAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { manuscriptKey, genre } = body;

    if (!manuscriptKey) {
      return new Response(JSON.stringify({ error: 'manuscriptKey is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize the line editing agent
    const agent = new LineEditingAgent(env);

    // Run analysis (this will take longer as it processes sections)
    console.log(`Starting line editing analysis for ${manuscriptKey}`);
    const analysis = await agent.analyze(manuscriptKey, genre || 'general');

    return new Response(JSON.stringify({
      success: true,
      analysis: analysis
    }), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Line editing analysis error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle copy editing analysis request
async function handleCopyEditingAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { manuscriptKey, styleGuide } = body;

    if (!manuscriptKey) {
      return new Response(JSON.stringify({ error: 'manuscriptKey is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize the copy editing agent
    const agent = new CopyEditingAgent(env);

    // Run analysis
    console.log(`Starting copy editing analysis for ${manuscriptKey}`);
    const analysis = await agent.analyze(manuscriptKey, styleGuide || 'chicago');

    return new Response(JSON.stringify({
      success: true,
      analysis: analysis
    }), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Copy editing analysis error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Get stored analysis results
async function handleGetAnalysis(request, env, corsHeaders) {
  const url = new URL(request.url);
  const manuscriptKey = url.pathname.replace('/analysis/', '');
  const processedKey = `${manuscriptKey}-analysis.json`;

  try {
    const analysis = await env.MANUSCRIPTS_PROCESSED.get(processedKey);
    
    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const analysisData = await analysis.json();

    return new Response(JSON.stringify(analysisData), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving analysis:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Generate formatted HTML report
async function handleGenerateReport(request, env, corsHeaders) {
  const url = new URL(request.url);
  const reportId = url.searchParams.get('id');
  
  if (!reportId) {
    return new Response(JSON.stringify({ error: 'Report ID required' }), {
      status: 400,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  console.log('Generating report for ID:', reportId);
  
  try {
    // Get manuscript key from mapping
    console.log('Looking up report-id:', `report-id:${reportId}`);
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);
    
    if (!mappingObject) {
      console.error('No mapping found for report ID:', reportId);
      return new Response(JSON.stringify({ 
        error: 'Report not found',
        reportId: reportId,
        hint: 'The report ID may have expired or is invalid'
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const manuscriptKey = await mappingObject.text();
    console.log('Found manuscript key from mapping:', manuscriptKey);
    // Fetch all three analyses
    console.log('Fetching analyses from R2...');
    const [devAnalysis, lineAnalysis, copyAnalysis] = await Promise.all([
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-analysis.json`).then(r => r?.json()).catch(e => { console.error('Dev analysis error:', e); return null; }),
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-line-analysis.json`).then(r => r?.json()).catch(e => { console.error('Line analysis error:', e); return null; }),
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-copy-analysis.json`).then(r => r?.json()).catch(e => { console.error('Copy analysis error:', e); return null; })
    ]);
    
    console.log('Analyses fetched:', { 
      hasDev: !!devAnalysis, 
      hasLine: !!lineAnalysis, 
      hasCopy: !!copyAnalysis 
    });
    
    if (!devAnalysis && !lineAnalysis && !copyAnalysis) {
      return new Response(JSON.stringify({ error: 'No analysis found for this manuscript' }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Get manuscript metadata
    console.log('Fetching manuscript metadata...');
    const rawManuscript = await env.MANUSCRIPTS_RAW.get(manuscriptKey);
    const metadata = rawManuscript?.customMetadata || { originalName: 'Unknown', authorId: 'Unknown' };
    console.log('Metadata:', metadata);
    
    // Generate HTML report
    console.log('Generating HTML report...');
    const reportHtml = ReportGenerator.generateFullReport(
      manuscriptKey,
      devAnalysis,
      lineAnalysis,
      copyAnalysis,
      metadata,
      reportId
    );
    
    console.log('Report generated, length:', reportHtml.length);
    
    return new Response(reportHtml, {
      status: 200,
      headers: { 
        ...allHeaders, 
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="manuscript-report-${Date.now()}.html"`
      }
    });
    
  } catch (error) {
    console.error('Error generating report:', error);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack,
      manuscriptKey: manuscriptKey
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Generate annotated manuscript with inline highlights
async function handleGenerateAnnotatedManuscript(request, env, corsHeaders) {
  const url = new URL(request.url);
  const reportId = url.searchParams.get('id');
  
  if (!reportId) {
    return new Response(JSON.stringify({ error: 'Report ID required' }), {
      status: 400,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  console.log('Generating annotated manuscript for ID:', reportId);
  
  try {
    // Get manuscript key from mapping
    console.log('Looking up report-id:', `report-id:${reportId}`);
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);
    
    if (!mappingObject) {
      console.error('No mapping found for report ID:', reportId);
      return new Response(JSON.stringify({ 
        error: 'Report not found',
        reportId: reportId,
        hint: 'The report ID may have expired or is invalid'
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const manuscriptKey = await mappingObject.text();
    console.log('Found manuscript key from mapping:', manuscriptKey);
    // Fetch the original manuscript text
    const manuscript = await env.MANUSCRIPTS_RAW.get(manuscriptKey);
    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Extract text
    const buffer = await manuscript.arrayBuffer();
    const manuscriptText = new TextDecoder().decode(buffer);
    
    // Fetch all analyses
    const [lineAnalysis, copyAnalysis] = await Promise.all([
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-line-analysis.json`).then(r => r?.json()).catch(() => null),
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-copy-analysis.json`).then(r => r?.json()).catch(() => null)
    ]);
    
    // Combine all issues from both analyses
    const allIssues = [];
    
    if (lineAnalysis?.topSuggestions) {
      allIssues.push(...lineAnalysis.topSuggestions.map(issue => ({
        ...issue,
        category: 'line-editing'
      })));
    }
    
    if (copyAnalysis?.topIssues) {
      allIssues.push(...copyAnalysis.topIssues.map(issue => ({
        ...issue,
        category: 'copy-editing',
        original: issue.original,
        suggestion: issue.correction
      })));
    }
    
    console.log(`Found ${allIssues.length} total issues to annotate`);
    
    // Get metadata
    const metadata = manuscript.customMetadata || { originalName: 'Unknown', authorId: 'Unknown' };
    
    // Generate annotated HTML
    const annotatedHtml = AnnotatedManuscriptGenerator.generateAnnotatedManuscript(
      manuscriptKey,
      manuscriptText,
      allIssues,
      metadata,
      reportId
    );
    
    return new Response(annotatedHtml, {
      status: 200,
      headers: { 
        ...allHeaders, 
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
    
  } catch (error) {
    console.error('Error generating annotated manuscript:', error);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Get analysis results as JSON by reportId
async function handleGetAnalysisResults(request, env, corsHeaders) {
  const url = new URL(request.url);
  const reportId = url.searchParams.get('id');

  if (!reportId) {
    return new Response(JSON.stringify({ error: 'Report ID required' }), {
      status: 400,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get manuscript key from mapping
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

    if (!mappingObject) {
      return new Response(JSON.stringify({
        error: 'Report not found',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();

    // Fetch all three analyses
    const [devAnalysis, lineAnalysis, copyAnalysis] = await Promise.all([
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-analysis.json`).then(r => r?.json()).catch(() => null),
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-line-analysis.json`).then(r => r?.json()).catch(() => null),
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-copy-analysis.json`).then(r => r?.json()).catch(() => null)
    ]);

    return new Response(JSON.stringify({
      success: true,
      results: {
        developmental: devAnalysis,
        lineEditing: lineAnalysis,
        copyEditing: copyAnalysis
      }
    }), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching results:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// NEW ASYNC HANDLERS

// Start async analysis (queues the job)
async function handleStartAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { manuscriptKey, genre, styleGuide, reportId } = body;

    if (!manuscriptKey || !reportId) {
      return new Response(JSON.stringify({ error: 'manuscriptKey and reportId are required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize status
    await env.MANUSCRIPTS_RAW.put(
      `status:${reportId}`,
      JSON.stringify({
        status: 'queued',
        progress: 0,
        message: 'Analysis queued',
        timestamp: new Date().toISOString()
      }),
      { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
    );

    // Queue the analysis job
    await env.ANALYSIS_QUEUE.send({
      manuscriptKey,
      genre: genre || 'general',
      styleGuide: styleGuide || 'chicago',
      reportId
    });

    console.log(`Analysis queued for ${manuscriptKey}`);

    return new Response(JSON.stringify({
      success: true,
      reportId: reportId,
      message: 'Analysis started'
    }), {
      status: 202, // Accepted
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error starting analysis:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Check analysis status
async function handleAnalysisStatus(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const statusObj = await env.MANUSCRIPTS_RAW.get(`status:${reportId}`);
    
    if (!statusObj) {
      return new Response(JSON.stringify({ 
        error: 'Status not found',
        status: 'unknown'
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const status = await statusObj.json();

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error checking status:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Check asset generation status (Phase D)
 *
 * GET /assets/status?reportId={reportId}
 * Returns the current status of asset generation for a given report
 */
async function handleAssetStatus(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const statusObj = await env.MANUSCRIPTS_RAW.get(`asset-status:${reportId}`);

    if (!statusObj) {
      return new Response(JSON.stringify({
        error: 'Asset status not found',
        status: 'not_started'
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const status = await statusObj.json();

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error checking asset status:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// ASSET GENERATION HANDLERS (Phase 3)
// ============================================================================

/**
 * Generate all marketing and publishing assets for a manuscript
 *
 * This endpoint runs 7 AI agents in parallel to generate:
 * 1. Book Description - Multiple lengths (elevator pitch, short, long, retailer-optimized)
 * 2. Keywords - Amazon search keywords for discoverability
 * 3. Categories - Amazon category recommendations (BISAC codes)
 * 4. Author Bio - Professional author biographies (multiple lengths)
 * 5. Back Matter - "Also by" section, newsletter signup, social links
 * 6. Cover Design Brief - Visual concepts, color palettes, AI art prompts
 * 7. Series Description - Multi-book arc planning and series marketing
 *
 * Why parallel execution?
 * All 7 agents are independent and can run simultaneously, reducing total
 * generation time from ~70 seconds (sequential) to ~10 seconds (parallel).
 *
 * Request body:
 * - reportId: Required - The manuscript report ID
 * - genre: Optional - Genre for better targeting (default: 'general')
 * - authorData: Optional - { name, bio, website, social } for author bio agent
 * - seriesData: Optional - { seriesTitle, bookNumber, totalBooks } for series planning
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Cloudflare environment variables (R2 buckets, API keys)
 * @param {Object} corsHeaders - CORS headers for response
 * @returns {Response} JSON response with all generated assets
 */
async function handleGenerateAssets(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { reportId } = body;

    // Validate required parameters
    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Generating assets for report:', reportId);

    // Look up the manuscript key from the short report ID
    // Report IDs are 8-character UUIDs that map to full manuscript storage keys
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

    if (!mappingObject) {
      return new Response(JSON.stringify({
        error: 'Report not found',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();
    console.log('Found manuscript key:', manuscriptKey);

    // Fetch developmental analysis (required input for all asset generators)
    // The developmental analysis contains plot, character, pacing, and theme insights
    // that inform all marketing materials
    const devAnalysisObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-analysis.json`);

    if (!devAnalysisObj) {
      return new Response(JSON.stringify({
        error: 'Developmental analysis not found. Please complete manuscript analysis first.',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const devAnalysis = await devAnalysisObj.json();
    const genre = body.genre || 'general';

    // Extract optional data from request body
    // authorData: Used by author bio and back matter agents
    //   Example: { name: "Jane Doe", bio: "...", website: "...", social: {...} }
    const authorData = body.authorData || {};

    // seriesData: Used by series description agent for multi-book planning
    //   Example: { seriesTitle: "The Dragon Chronicles", bookNumber: 1, totalBooks: 3 }
    //   If not provided, agent generates generic 3-book series plan
    const seriesData = body.seriesData || {};

    // Initialize all 7 asset generation agents
    // Each agent is independent and uses the developmental analysis as input
    const bookDescAgent = new BookDescriptionAgent(env);
    const keywordAgent = new KeywordAgent(env);
    const categoryAgent = new CategoryAgent(env);
    const authorBioAgent = new AuthorBioAgent(env);
    const backMatterAgent = new BackMatterAgent(env);
    const coverDesignAgent = new CoverDesignAgent(env);
    const seriesDescriptionAgent = new SeriesDescriptionAgent(env);

    console.log('Running all 7 asset generation agents in parallel...');

    // Execute all agents in parallel using Promise.all
    // Each agent call is wrapped in .catch() to prevent one failure from stopping others
    // This allows partial success - if 6 of 7 agents succeed, we still return those results
    const [bookDescription, keywords, categories, authorBio, backMatter, coverBrief, seriesDescription] = await Promise.all([
      bookDescAgent.generate(manuscriptKey, devAnalysis, genre)
        .catch(e => ({ error: e.message, type: 'bookDescription' })),
      keywordAgent.generate(manuscriptKey, devAnalysis, genre)
        .catch(e => ({ error: e.message, type: 'keywords' })),
      categoryAgent.generate(manuscriptKey, devAnalysis, genre)
        .catch(e => ({ error: e.message, type: 'categories' })),
      authorBioAgent.generate(manuscriptKey, devAnalysis, genre, authorData)
        .catch(e => ({ error: e.message, type: 'authorBio' })),
      backMatterAgent.generate(manuscriptKey, devAnalysis, genre, authorData)
        .catch(e => ({ error: e.message, type: 'backMatter' })),
      coverDesignAgent.generate(manuscriptKey, devAnalysis, genre)
        .catch(e => ({ error: e.message, type: 'coverBrief' })),
      seriesDescriptionAgent.generate(manuscriptKey, devAnalysis, genre, seriesData)
        .catch(e => ({ error: e.message, type: 'seriesDescription' }))
    ]);

    // Collect any errors that occurred during generation
    const errors = [];
    if (bookDescription.error) errors.push(bookDescription);
    if (keywords.error) errors.push(keywords);
    if (categories.error) errors.push(categories);
    if (authorBio.error) errors.push(authorBio);
    if (backMatter.error) errors.push(backMatter);
    if (coverBrief.error) errors.push(coverBrief);
    if (seriesDescription.error) errors.push(seriesDescription);

    // If any errors occurred, return partial results with error details
    if (errors.length > 0) {
      console.error('Asset generation errors:', errors);
      return new Response(JSON.stringify({
        success: false,
        partialSuccess: errors.length < 7, // True if at least one agent succeeded
        errors: errors,
        results: {
          bookDescription: bookDescription.error ? null : bookDescription.description,
          keywords: keywords.error ? null : keywords.keywords,
          categories: categories.error ? null : categories.categories,
          authorBio: authorBio.error ? null : authorBio.bio,
          backMatter: backMatter.error ? null : backMatter.backMatter,
          coverBrief: coverBrief.error ? null : coverBrief.coverBrief,
          seriesDescription: seriesDescription.error ? null : seriesDescription.seriesDescription
        }
      }), {
        status: 500,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // All agents succeeded - combine results into a single asset package
    const combinedAssets = {
      manuscriptKey,
      reportId,
      generated: new Date().toISOString(),
      bookDescription: bookDescription.description,
      keywords: keywords.keywords,
      categories: categories.categories,
      authorBio: authorBio.bio,
      backMatter: backMatter.backMatter,
      coverBrief: coverBrief.coverBrief,
      seriesDescription: seriesDescription.seriesDescription
    };

    // Store the combined assets in R2 for later retrieval
    // This allows the /assets endpoint to fetch all assets in one request
    await env.MANUSCRIPTS_PROCESSED.put(
      `${manuscriptKey}-assets.json`,
      JSON.stringify(combinedAssets, null, 2),
      {
        customMetadata: {
          reportId: reportId,
          timestamp: new Date().toISOString()
        },
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );

    console.log('Assets generated and stored successfully');

    return new Response(JSON.stringify({
      success: true,
      reportId: reportId,
      assets: combinedAssets
    }), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating assets:', error);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Get generated assets by reportId
async function handleGetAssets(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('id');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'id parameter required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Fetching assets for report:', reportId);

    // Get manuscript key from mapping
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

    if (!mappingObject) {
      return new Response(JSON.stringify({
        error: 'Report not found',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();

    // Fetch combined assets
    const assetsObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-assets.json`);

    if (!assetsObj) {
      return new Response(JSON.stringify({
        error: 'Assets not found. Please generate assets first.',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const assets = await assetsObj.json();

    return new Response(JSON.stringify({
      success: true,
      assets: assets
    }), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching assets:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// FORMATTING HANDLERS (Phase 4)

// Format manuscript to EPUB and PDF
async function handleFormatManuscript(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { reportId, metadata, trimSize, includeBleed } = body;

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Formatting manuscript for report:', reportId);

    // Get manuscript key from mapping
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

    if (!mappingObject) {
      return new Response(JSON.stringify({
        error: 'Report not found',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();
    console.log('Found manuscript key:', manuscriptKey);

    // Fetch the original manuscript text
    const manuscriptObj = await env.MANUSCRIPTS_RAW.get(manuscriptKey);
    if (!manuscriptObj) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract text
    const buffer = await manuscriptObj.arrayBuffer();
    const manuscriptText = new TextDecoder().decode(buffer);

    // Try to fetch back matter (optional)
    let backMatter = null;
    try {
      const backMatterObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-back-matter.json`);
      if (backMatterObj) {
        backMatter = await backMatterObj.json();
      }
    } catch (e) {
      console.log('No back matter found, continuing without it');
    }

    // Prepare metadata
    const formattingMetadata = {
      title: metadata?.title || manuscriptObj.customMetadata?.originalName?.replace(/\.[^/.]+$/, '') || 'Untitled',
      author: metadata?.author || manuscriptObj.customMetadata?.authorId || 'Unknown Author',
      copyrightYear: metadata?.copyrightYear || new Date().getFullYear(),
      isbn: metadata?.isbn || '',
      publisher: metadata?.publisher || '',
      description: metadata?.description || '',
      language: metadata?.language || 'en'
    };

    console.log('Formatting metadata:', formattingMetadata);

    // Initialize formatting agent
    const formattingAgent = new FormattingAgent();

    // Generate both EPUB and PDF
    const formattingOptions = {
      manuscriptText,
      metadata: formattingMetadata,
      backMatter,
      trimSize: trimSize || '6x9',
      includeBleed: includeBleed || false
    };

    console.log('Starting formatting agent...');
    const result = await formattingAgent.formatManuscript(formattingOptions);

    if (!result.success) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Formatting failed',
        errors: result.errors
      }), {
        status: 500,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Store formatted files in R2
    const storagePromises = [];

    if (result.results.epub) {
      console.log('Storing EPUB file...');
      storagePromises.push(
        env.MANUSCRIPTS_PROCESSED.put(
          `${manuscriptKey}-formatted.epub`,
          result.results.epub.buffer,
          {
            customMetadata: {
              reportId: reportId,
              format: 'epub',
              size: result.results.epub.size,
              timestamp: new Date().toISOString()
            },
            httpMetadata: {
              contentType: 'application/epub+zip'
            }
          }
        )
      );
    }

    if (result.results.pdf) {
      console.log('Storing PDF file...');
      storagePromises.push(
        env.MANUSCRIPTS_PROCESSED.put(
          `${manuscriptKey}-formatted.pdf`,
          result.results.pdf.buffer,
          {
            customMetadata: {
              reportId: reportId,
              format: 'pdf',
              trimSize: result.results.pdf.trimSize,
              pageCount: result.results.pdf.pageCount,
              size: result.results.pdf.size,
              timestamp: new Date().toISOString()
            },
            httpMetadata: {
              contentType: 'application/pdf'
            }
          }
        )
      );
    }

    await Promise.all(storagePromises);

    console.log('Formatted files stored successfully');

    return new Response(JSON.stringify({
      success: true,
      reportId: reportId,
      formats: {
        epub: result.results.epub ? {
          available: true,
          size: result.results.epub.size,
          sizeKB: Math.round(result.results.epub.size / 1024),
          validation: result.results.epub.validation
        } : null,
        pdf: result.results.pdf ? {
          available: true,
          size: result.results.pdf.size,
          sizeKB: Math.round(result.results.pdf.size / 1024),
          pageCount: result.results.pdf.pageCount,
          trimSize: result.results.pdf.trimSize,
          validation: result.results.pdf.validation
        } : null
      },
      metadata: result.metadata
    }), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error formatting manuscript:', error);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Download formatted file (EPUB or PDF)
async function handleDownloadFormatted(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('id');
    const format = url.searchParams.get('format'); // 'epub' or 'pdf'

    if (!reportId || !format) {
      return new Response(JSON.stringify({ error: 'id and format parameters required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!['epub', 'pdf'].includes(format)) {
      return new Response(JSON.stringify({ error: 'format must be epub or pdf' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Downloading formatted file:', reportId, format);

    // Get manuscript key from mapping
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

    if (!mappingObject) {
      return new Response(JSON.stringify({
        error: 'Report not found',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();

    // Fetch formatted file
    const fileKey = `${manuscriptKey}-formatted.${format}`;
    const formattedFile = await env.MANUSCRIPTS_PROCESSED.get(fileKey);

    if (!formattedFile) {
      return new Response(JSON.stringify({
        error: 'Formatted file not found. Please format the manuscript first.',
        reportId: reportId,
        format: format
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine content type and filename
    const contentType = format === 'epub' ? 'application/epub+zip' : 'application/pdf';
    const filename = `manuscript-${reportId}.${format}`;

    return new Response(formattedFile.body, {
      status: 200,
      headers: {
        ...allHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': formattedFile.size.toString()
      }
    });

  } catch (error) {
    console.error('Error downloading formatted file:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle market analysis request
 */
async function handleMarketAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { reportId, metadata = {} } = body;

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Market analysis for report:', reportId);

    // Get manuscript key from mapping
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

    if (!mappingObject) {
      return new Response(JSON.stringify({
        error: 'Report not found',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();
    console.log('Found manuscript key:', manuscriptKey);

    // Fetch the original manuscript text
    const manuscriptObj = await env.MANUSCRIPTS_RAW.get(manuscriptKey);
    if (!manuscriptObj) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract text
    const buffer = await manuscriptObj.arrayBuffer();
    const manuscriptText = new TextDecoder().decode(buffer);

    // Add word count to metadata
    metadata.wordCount = manuscriptText.split(/\s+/).length;

    // Initialize market analysis agent
    const agent = new MarketAnalysisAgent(env.ANTHROPIC_API_KEY);

    // Perform analysis
    const result = await agent.analyzeMarket(manuscriptText, metadata);

    // Generate formatted report
    const report = agent.generateReport(result.analysis);

    // Store analysis results in R2
    await env.MANUSCRIPTS_PROCESSED.put(
      `${manuscriptKey}-market-analysis.json`,
      JSON.stringify({
        reportId,
        analysis: result.analysis,
        report,
        metadata: result.metadata,
        timestamp: new Date().toISOString()
      }),
      {
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );

    console.log('Market analysis completed and stored');

    return new Response(JSON.stringify({
      success: true,
      reportId,
      summary: report.summary,
      duration: result.metadata.duration
    }), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Market analysis error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get market analysis results
 */
async function handleGetMarketAnalysis(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId') || url.searchParams.get('id');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get manuscript key from mapping
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

    if (!mappingObject) {
      return new Response(JSON.stringify({
        error: 'Report not found',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();

    // Fetch market analysis results
    const analysisObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-market-analysis.json`);

    if (!analysisObj) {
      return new Response(JSON.stringify({
        error: 'Market analysis not found. Run /analyze-market first.',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const analysisData = await analysisObj.json();

    return new Response(JSON.stringify(analysisData), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching market analysis:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle social media marketing generation (Phase 5)
 */
async function handleGenerateSocialMedia(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { reportId } = body;

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Generating social media marketing for report:', reportId);

    // Get manuscript key from mapping
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

    if (!mappingObject) {
      return new Response(JSON.stringify({
        error: 'Report not found',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();
    console.log('Found manuscript key:', manuscriptKey);

    // Fetch the original manuscript text
    const manuscriptObj = await env.MANUSCRIPTS_RAW.get(manuscriptKey);
    if (!manuscriptObj) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract text
    const buffer = await manuscriptObj.arrayBuffer();
    const manuscriptText = new TextDecoder().decode(buffer);

    // Fetch market analysis (if available, for better targeting)
    let marketAnalysis = null;
    try {
      const marketAnalysisObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-market-analysis.json`);
      if (marketAnalysisObj) {
        marketAnalysis = await marketAnalysisObj.json();
      }
    } catch (e) {
      console.log('No market analysis found, continuing without it');
    }

    // Prepare book metadata
    const bookMetadata = {
      title: manuscriptObj.customMetadata?.originalName?.replace(/\.[^/.]+$/, '') || 'Untitled',
      author: manuscriptObj.customMetadata?.authorId || 'Unknown Author',
      ...body.metadata
    };

    console.log('Book metadata:', bookMetadata);

    // Initialize social media agent
    const agent = new SocialMediaAgent(env.ANTHROPIC_API_KEY);

    // Generate marketing package
    const result = await agent.generateMarketingPackage(
      manuscriptText,
      bookMetadata,
      marketAnalysis?.analysis
    );

    // Generate formatted report
    const report = agent.generateReport(result.marketingPackage);

    // Store results in R2
    await env.MANUSCRIPTS_PROCESSED.put(
      `${manuscriptKey}-social-media.json`,
      JSON.stringify({
        reportId,
        marketingPackage: result.marketingPackage,
        report,
        metadata: result.metadata,
        timestamp: new Date().toISOString()
      }),
      {
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );

    console.log('Social media marketing generated and stored');

    return new Response(JSON.stringify({
      success: true,
      reportId,
      summary: {
        totalPosts: report.sections[0].totalPosts,
        emailCount: report.sections[1].emailCount,
        calendarDuration: report.sections[2].duration,
        trailerDuration: report.sections[3].duration,
        magnetIdeas: report.sections[4].ideaCount
      },
      duration: result.metadata.duration
    }), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Social media generation error:', error);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get social media marketing results
 */
async function handleGetSocialMedia(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId') || url.searchParams.get('id');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get manuscript key from mapping
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

    if (!mappingObject) {
      return new Response(JSON.stringify({
        error: 'Report not found',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();

    // Fetch social media marketing results
    const socialMediaObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-social-media.json`);

    if (!socialMediaObj) {
      return new Response(JSON.stringify({
        error: 'Social media marketing not found. Run /generate-social-media first.',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const socialMediaData = await socialMediaObj.json();

    return new Response(JSON.stringify(socialMediaData), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching social media marketing:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// DMCA & COPYRIGHT HANDLERS (Phase E)
// ============================================================================

/**
 * Handle DMCA takedown request submission (Phase E)
 *
 * POST /dmca/submit
 * Accepts DMCA takedown requests from copyright holders
 *
 * Required fields:
 * - requesterName: Full name of copyright owner or authorized agent
 * - requesterEmail: Contact email address
 * - manuscriptId: ID or URL of the infringing manuscript
 * - claimDetails: Description of copyrighted work and infringement
 * - goodFaithAttestation: Boolean - good faith belief statement
 * - accuracyAttestation: Boolean - accuracy under penalty of perjury
 * - digitalSignature: Typed name as digital signature
 *
 * Optional fields:
 * - requesterCompany: Company/organization name
 * - originalWorkUrl: URL where original work can be found
 *
 * @param {Request} request - HTTP request with DMCA form data
 * @param {Object} env - Cloudflare environment (D1 database, R2 buckets)
 * @param {Object} corsHeaders - CORS headers for response
 * @returns {Response} JSON response with DMCA request ID or error
 */
async function handleDMCASubmission(request, env, corsHeaders) {
  try {
    const body = await request.json();

    // Extract and validate required fields
    const {
      requesterName,
      requesterEmail,
      requesterCompany,
      manuscriptId,
      claimDetails,
      originalWorkUrl,
      goodFaithAttestation,
      accuracyAttestation,
      digitalSignature
    } = body;

    // Validate required fields
    if (!requesterName || !requesterEmail || !manuscriptId || !claimDetails ||
        !goodFaithAttestation || !accuracyAttestation || !digitalSignature) {
      return new Response(JSON.stringify({
        error: 'Missing required fields. Please complete all required fields including attestations and digital signature.'
      }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requesterEmail)) {
      return new Response(JSON.stringify({
        error: 'Invalid email address format'
      }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate attestations are true
    if (goodFaithAttestation !== true || accuracyAttestation !== true) {
      return new Response(JSON.stringify({
        error: 'Both attestations must be confirmed to submit a DMCA request'
      }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[DMCA] Processing takedown request for manuscript:', manuscriptId);

    // Look up manuscript in database
    // manuscriptId could be either a UUID or a URL containing the manuscript ID
    let actualManuscriptId = manuscriptId;

    // If it's a URL, try to extract the manuscript ID from it
    if (manuscriptId.includes('http') || manuscriptId.includes('/')) {
      const urlMatch = manuscriptId.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
      if (urlMatch) {
        actualManuscriptId = urlMatch[0];
      }
    }

    // Verify manuscript exists in database
    const manuscriptResult = await env.DB.prepare(
      'SELECT id, user_id, title FROM manuscripts WHERE id = ?'
    ).bind(actualManuscriptId).first();

    if (!manuscriptResult) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found. Please verify the manuscript ID or URL.',
        providedId: manuscriptId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate unique DMCA request ID
    const dmcaRequestId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);

    // Insert DMCA request into database
    await env.DB.prepare(`
      INSERT INTO dmca_requests (
        id, manuscript_id, requester_name, requester_email, requester_company,
        claim_details, original_work_url, good_faith_attestation, accuracy_attestation,
        digital_signature, submitted_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      dmcaRequestId,
      actualManuscriptId,
      requesterName,
      requesterEmail,
      requesterCompany || null,
      claimDetails,
      originalWorkUrl || null,
      goodFaithAttestation ? 1 : 0,
      accuracyAttestation ? 1 : 0,
      digitalSignature,
      timestamp
    ).run();

    // Flag the manuscript for review
    await env.DB.prepare(`
      UPDATE manuscripts
      SET flagged_for_review = 1,
          updated_at = ?
      WHERE id = ?
    `).bind(timestamp, actualManuscriptId).run();

    // Log DMCA submission to audit log
    await env.DB.prepare(`
      INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, timestamp, metadata)
      VALUES (?, ?, 'dmca_request', 'manuscript', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      manuscriptResult.user_id, // Log against manuscript owner's user ID
      actualManuscriptId,
      timestamp,
      JSON.stringify({
        dmcaRequestId,
        requesterEmail,
        requesterName,
        manuscriptTitle: manuscriptResult.title
      })
    ).run();

    console.log('[DMCA] Request submitted successfully:', dmcaRequestId);
    console.log('[DMCA] Manuscript flagged for review:', actualManuscriptId);

    // Send email notifications (don't block the response)
    try {
      const { sendDMCARequestNotification, sendDMCAOwnerNotification } = await import('./email-service.js');

      // Get manuscript owner email
      const owner = await env.DB.prepare('SELECT email FROM users WHERE id = ?')
        .bind(manuscriptResult.user_id).first();

      // Send notification to admin
      sendDMCARequestNotification({
        requestId: dmcaRequestId,
        manuscriptId: actualManuscriptId,
        manuscriptTitle: manuscriptResult.title,
        requesterName,
        requesterEmail,
        claimDetails
      }, env).catch(err => console.error('[Email] Failed to send admin notification:', err));

      // Send notification to manuscript owner
      if (owner && owner.email) {
        sendDMCAOwnerNotification({
          ownerEmail: owner.email,
          manuscriptTitle: manuscriptResult.title,
          manuscriptId: actualManuscriptId,
          requestId: dmcaRequestId,
          action: 'flagged'
        }, env).catch(err => console.error('[Email] Failed to send owner notification:', err));
      }
    } catch (emailError) {
      console.error('[Email] Email service error:', emailError);
      // Don't fail the request if email fails
    }

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: 'DMCA takedown request submitted successfully',
      dmcaRequestId,
      manuscriptId: actualManuscriptId,
      status: 'pending',
      reviewInfo: 'Your request will be reviewed within 24 hours. You will receive an email confirmation shortly.'
    }), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[DMCA] Submission error:', error);
    console.error('[DMCA] Error stack:', error.stack);
    return new Response(JSON.stringify({
      error: 'Failed to submit DMCA request',
      details: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}