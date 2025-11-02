/**
 * Router module for handling all API routes
 * Maps incoming requests to appropriate handlers
 */

import { authHandlers } from '../../auth-handlers.js';
import { manuscriptHandlers } from '../../manuscript-handlers.js';
import { audiobookHandlers } from '../../audiobook-handlers.js';
import { reviewHandlers } from '../../review-handlers.js';
import { publishingHandlers } from '../../publishing-handlers.js';
import { publicAPIHandlers } from '../../public-api-handlers.js';
import { teamHandlers } from '../../team-handlers.js';
import { emailPreferenceHandlers } from '../../email-preference-handlers.js';
import { handleStripeWebhook } from '../../webhook-handlers.js';

/**
 * Route a request to the appropriate handler
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {Function} addCorsHeaders - Function to add CORS headers to response
 * @param {Object} rateLimitHeaders - Rate limiting headers to include
 * @param {Object} legacyHandlers - Legacy handler functions from worker.js
 * @returns {Response|null} Response if route matched, null otherwise
 */
export async function routeRequest(request, env, addCorsHeaders, rateLimitHeaders, legacyHandlers) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // ========================================================================
  // AUTHENTICATION ROUTES
  // ========================================================================

  if (path === '/auth/register' && method === 'POST') {
    return addCorsHeaders(await authHandlers.register(request, env), rateLimitHeaders);
  }

  if (path === '/auth/login' && method === 'POST') {
    return addCorsHeaders(await authHandlers.login(request, env), rateLimitHeaders);
  }

  if (path === '/auth/logout' && method === 'POST') {
    return addCorsHeaders(await authHandlers.logout(request, env), rateLimitHeaders);
  }

  if (path === '/auth/me' && method === 'GET') {
    return addCorsHeaders(await authHandlers.getMe(request, env), rateLimitHeaders);
  }

  if (path === '/auth/verify-email' && method === 'GET') {
    return addCorsHeaders(await authHandlers.verifyEmail(request, env), rateLimitHeaders);
  }

  if (path === '/auth/password-reset-request' && method === 'POST') {
    return addCorsHeaders(await authHandlers.passwordResetRequest(request, env), rateLimitHeaders);
  }

  if (path === '/auth/password-reset' && method === 'POST') {
    return addCorsHeaders(await authHandlers.passwordReset(request, env), rateLimitHeaders);
  }

  if (path === '/auth/verify-reset-token' && method === 'GET') {
    return addCorsHeaders(await authHandlers.verifyResetToken(request, env), rateLimitHeaders);
  }

  // ========================================================================
  // MANUSCRIPT LIBRARY ROUTES
  // ========================================================================

  if (path === '/manuscripts' && method === 'GET') {
    return addCorsHeaders(await manuscriptHandlers.listManuscripts(request, env), rateLimitHeaders);
  }

  if (path === '/manuscripts/stats' && method === 'GET') {
    return addCorsHeaders(await manuscriptHandlers.getManuscriptStats(request, env), rateLimitHeaders);
  }

  if (path.startsWith('/manuscripts/') && method === 'GET' && !path.includes('stats')) {
    const manuscriptId = path.replace('/manuscripts/', '');
    return addCorsHeaders(await manuscriptHandlers.getManuscript(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.startsWith('/manuscripts/') && method === 'PUT') {
    const manuscriptId = path.replace('/manuscripts/', '');
    return addCorsHeaders(await manuscriptHandlers.updateManuscript(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.startsWith('/manuscripts/') && method === 'DELETE') {
    const manuscriptId = path.replace('/manuscripts/', '');
    return addCorsHeaders(await manuscriptHandlers.deleteManuscript(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/.+\/reanalyze$/) && method === 'POST') {
    const manuscriptId = path.match(/^\/manuscripts\/(.+)\/reanalyze$/)[1];
    return addCorsHeaders(await manuscriptHandlers.reanalyzeManuscript(request, env, manuscriptId), rateLimitHeaders);
  }

  // ========================================================================
  // AUDIOBOOK ASSET ROUTES
  // ========================================================================

  if (path.match(/^\/manuscripts\/[^/]+\/audiobook$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await audiobookHandlers.getAudiobookAssets(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/audiobook\/[^/]+$/) && method === 'GET') {
    const pathParts = path.split('/');
    const manuscriptId = pathParts[2];
    const assetType = pathParts[4];
    return addCorsHeaders(await audiobookHandlers.getAudiobookAsset(request, env, manuscriptId, assetType), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/audiobook\/regenerate$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await audiobookHandlers.regenerateAudiobookAssets(request, env, manuscriptId), rateLimitHeaders);
  }

  // ========================================================================
  // REVIEW MONITORING ROUTES
  // ========================================================================

  if (path.match(/^\/manuscripts\/[^/]+\/reviews$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await reviewHandlers.getReviewMonitoring(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/reviews\/setup$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await reviewHandlers.setupReviewMonitoring(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/reviews\/fetch$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await reviewHandlers.fetchReviews(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/reviews\/sentiment$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await reviewHandlers.getReviewSentiment(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/reviews\/responses$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await reviewHandlers.getReviewResponses(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/reviews\/trends$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await reviewHandlers.getReviewTrends(request, env, manuscriptId), rateLimitHeaders);
  }

  // ========================================================================
  // MULTI-PLATFORM PUBLISHING ROUTES
  // ========================================================================

  if (path.match(/^\/manuscripts\/[^/]+\/publishing\/metadata$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await publishingHandlers.generatePlatformMetadata(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/publishing\/formats$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await publishingHandlers.prepareFormats(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/publishing\/strategy$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await publishingHandlers.generateDistributionStrategy(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/publishing\/package$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await publishingHandlers.generatePublishingPackage(request, env, manuscriptId), rateLimitHeaders);
  }

  // ========================================================================
  // PUBLIC API ROUTES
  // ========================================================================

  if (path === '/api/v1/manuscripts' && method === 'POST') {
    return addCorsHeaders(await publicAPIHandlers.apiUploadManuscript(request, env), rateLimitHeaders);
  }

  if (path === '/api/v1/manuscripts' && method === 'GET') {
    return addCorsHeaders(await publicAPIHandlers.apiListManuscripts(request, env), rateLimitHeaders);
  }

  if (path.match(/^\/api\/v1\/manuscripts\/[^/]+\/analyze$/) && method === 'POST') {
    const manuscriptId = path.split('/')[4];
    return addCorsHeaders(await publicAPIHandlers.apiAnalyzeManuscript(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/api\/v1\/manuscripts\/[^/]+\/status$/) && method === 'GET') {
    const manuscriptId = path.split('/')[4];
    return addCorsHeaders(await publicAPIHandlers.apiGetManuscriptStatus(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/api\/v1\/manuscripts\/[^/]+\/results$/) && method === 'GET') {
    const manuscriptId = path.split('/')[4];
    return addCorsHeaders(await publicAPIHandlers.apiGetManuscriptResults(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path === '/api/v1/webhooks' && method === 'POST') {
    return addCorsHeaders(await publicAPIHandlers.apiConfigureWebhook(request, env), rateLimitHeaders);
  }

  if (path === '/api/v1/usage' && method === 'GET') {
    return addCorsHeaders(await publicAPIHandlers.apiGetUsage(request, env), rateLimitHeaders);
  }

  // ========================================================================
  // TEAM COLLABORATION ROUTES
  // ========================================================================

  if (path === '/teams' && method === 'POST') {
    return addCorsHeaders(await teamHandlers.createTeam(request, env), rateLimitHeaders);
  }

  if (path === '/teams' && method === 'GET') {
    return addCorsHeaders(await teamHandlers.listTeams(request, env), rateLimitHeaders);
  }

  if (path.match(/^\/teams\/[^/]+$/) && method === 'GET') {
    const teamId = path.split('/')[2];
    return addCorsHeaders(await teamHandlers.getTeam(request, env, teamId), rateLimitHeaders);
  }

  if (path.match(/^\/teams\/[^/]+\/invite$/) && method === 'POST') {
    const teamId = path.split('/')[2];
    return addCorsHeaders(await teamHandlers.inviteToTeam(request, env, teamId), rateLimitHeaders);
  }

  if (path.match(/^\/teams\/accept-invitation\/[^/]+$/) && method === 'POST') {
    const token = path.split('/')[3];
    return addCorsHeaders(await teamHandlers.acceptInvitation(request, env, token), rateLimitHeaders);
  }

  if (path.match(/^\/teams\/[^/]+\/members\/[^/]+$/) && method === 'DELETE') {
    const parts = path.split('/');
    const teamId = parts[2];
    const userId = parts[4];
    return addCorsHeaders(await teamHandlers.removeMember(request, env, teamId, userId), rateLimitHeaders);
  }

  if (path.match(/^\/teams\/[^/]+\/share-manuscript$/) && method === 'POST') {
    const teamId = path.split('/')[2];
    return addCorsHeaders(await teamHandlers.shareManuscript(request, env, teamId), rateLimitHeaders);
  }

  if (path.match(/^\/teams\/[^/]+\/manuscripts$/) && method === 'GET') {
    const teamId = path.split('/')[2];
    return addCorsHeaders(await teamHandlers.getTeamManuscripts(request, env, teamId), rateLimitHeaders);
  }

  if (path.match(/^\/teams\/[^/]+\/activity$/) && method === 'GET') {
    const teamId = path.split('/')[2];
    return addCorsHeaders(await teamHandlers.getTeamActivity(request, env, teamId), rateLimitHeaders);
  }

  // ========================================================================
  // USER PREFERENCE ROUTES
  // ========================================================================

  if (path === '/user/email-preferences' && method === 'GET') {
    return addCorsHeaders(await emailPreferenceHandlers.getEmailPreferences(request, env), rateLimitHeaders);
  }

  if (path === '/user/email-preferences' && method === 'PUT') {
    return addCorsHeaders(await emailPreferenceHandlers.updateEmailPreferences(request, env), rateLimitHeaders);
  }

  if (path === '/user/resubscribe' && method === 'POST') {
    return addCorsHeaders(await emailPreferenceHandlers.resubscribe(request, env), rateLimitHeaders);
  }

  if (path.match(/^\/unsubscribe\/[^/]+$/) && method === 'GET') {
    return await emailPreferenceHandlers.unsubscribeByToken(request, env);
  }

  // ========================================================================
  // LEGACY MANUSCRIPT MANAGEMENT ROUTES
  // Delegate to legacy handlers from worker.js
  // ========================================================================

  return await routeLegacyHandlers(path, method, request, env, addCorsHeaders, rateLimitHeaders, legacyHandlers);
}

/**
 * Route legacy handlers that are still defined in worker.js
 * These will eventually be refactored into handler modules
 */
async function routeLegacyHandlers(path, method, request, env, addCorsHeaders, rateLimitHeaders, handlers) {
  const { allHeaders } = handlers;

  if (path === '/upload/manuscript' && method === 'POST') {
    return addCorsHeaders(await handlers.handleManuscriptUpload(request, env, allHeaders), rateLimitHeaders);
  }

  if (path === '/upload/marketing' && method === 'POST') {
    return addCorsHeaders(await handlers.handleMarketingUpload(request, env), rateLimitHeaders);
  }

  if (path.startsWith('/get/') && method === 'GET') {
    return addCorsHeaders(await handlers.handleFileGet(request, env), rateLimitHeaders);
  }

  if (path.startsWith('/list/') && method === 'GET') {
    return await handlers.handleFileList(request, env, allHeaders);
  }

  if (path.startsWith('/delete/') && method === 'DELETE') {
    return await handlers.handleFileDelete(request, env, allHeaders);
  }

  if (path === '/analyze/developmental' && method === 'POST') {
    return await handlers.handleDevelopmentalAnalysis(request, env, allHeaders);
  }

  if (path === '/analyze/line-editing' && method === 'POST') {
    return await handlers.handleLineEditingAnalysis(request, env, allHeaders);
  }

  if (path === '/analyze/copy-editing' && method === 'POST') {
    return await handlers.handleCopyEditingAnalysis(request, env, allHeaders);
  }

  if (path === '/analyze/start' && method === 'POST') {
    return await handlers.handleStartAnalysis(request, env, allHeaders);
  }

  if (path === '/analyze/status' && method === 'GET') {
    return await handlers.handleAnalysisStatus(request, env, allHeaders);
  }

  if (path === '/assets/status' && method === 'GET') {
    return await handlers.handleAssetStatus(request, env, allHeaders);
  }

  if (path === '/dmca/submit' && method === 'POST') {
    return await handlers.handleDMCASubmission(request, env, allHeaders);
  }

  // Admin routes with dynamic imports
  if (path === '/admin/dmca/requests' && method === 'GET') {
    const { getDMCARequests } = await import('../../dmca-admin-handlers.js');
    return await getDMCARequests(request, env, allHeaders);
  }

  if (path === '/admin/dmca/stats' && method === 'GET') {
    const { getDMCAStats } = await import('../../dmca-admin-handlers.js');
    return await getDMCAStats(request, env, allHeaders);
  }

  if (path === '/admin/dmca/status' && method === 'PATCH') {
    const { updateDMCAStatus } = await import('../../dmca-admin-handlers.js');
    return await updateDMCAStatus(request, env, allHeaders);
  }

  if (path === '/admin/dmca/resolve' && method === 'POST') {
    const { resolveDMCARequest } = await import('../../dmca-admin-handlers.js');
    return await resolveDMCARequest(request, env, allHeaders);
  }

  if (path === '/admin/users' && method === 'GET') {
    const { listUsers } = await import('../../admin-handlers.js');
    return await listUsers(request, env, allHeaders);
  }

  if (path.match(/^\/admin\/users\/[^\/]+$/) && method === 'GET') {
    const userId = path.split('/')[3];
    const { getUserDetails } = await import('../../admin-handlers.js');
    return await getUserDetails(request, env, allHeaders, userId);
  }

  if (path.match(/^\/admin\/users\/[^\/]+$/) && method === 'PATCH') {
    const userId = path.split('/')[3];
    const { updateUser } = await import('../../admin-handlers.js');
    return await updateUser(request, env, allHeaders, userId);
  }

  if (path.match(/^\/admin\/users\/[^\/]+\/subscription$/) && method === 'POST') {
    const userId = path.split('/')[3];
    const { adjustUserSubscription } = await import('../../admin-handlers.js');
    return await adjustUserSubscription(request, env, allHeaders, userId);
  }

  if (path === '/admin/manuscripts' && method === 'GET') {
    const { listAllManuscripts } = await import('../../admin-handlers.js');
    return await listAllManuscripts(request, env, allHeaders);
  }

  if (path.match(/^\/admin\/manuscripts\/[^\/]+$/) && method === 'DELETE') {
    const manuscriptId = path.split('/')[3];
    const { adminDeleteManuscript } = await import('../../admin-handlers.js');
    return await adminDeleteManuscript(request, env, allHeaders, manuscriptId);
  }

  if (path === '/admin/analytics/overview' && method === 'GET') {
    const { getAnalyticsOverview } = await import('../../admin-handlers.js');
    return await getAnalyticsOverview(request, env, allHeaders);
  }

  if (path === '/admin/analytics/activity' && method === 'GET') {
    const { getRecentActivity } = await import('../../admin-handlers.js');
    return await getRecentActivity(request, env, allHeaders);
  }

  if (path === '/admin/billing/transactions' && method === 'GET') {
    const { listPaymentTransactions } = await import('../../admin-billing-handlers.js');
    return await listPaymentTransactions(request, env, allHeaders);
  }

  if (path.match(/^\/admin\/billing\/transactions\/[^\/]+$/) && method === 'GET') {
    const transactionId = path.split('/')[4];
    const { getTransactionDetails } = await import('../../admin-billing-handlers.js');
    return await getTransactionDetails(request, env, allHeaders, transactionId);
  }

  if (path === '/admin/billing/subscriptions/stats' && method === 'GET') {
    const { getSubscriptionStats } = await import('../../admin-billing-handlers.js');
    return await getSubscriptionStats(request, env, allHeaders);
  }

  if (path === '/admin/billing/revenue' && method === 'GET') {
    const { getRevenueAnalytics } = await import('../../admin-billing-handlers.js');
    return await getRevenueAnalytics(request, env, allHeaders);
  }

  if (path === '/admin/billing/failed-payments' && method === 'GET') {
    const { getFailedPayments } = await import('../../admin-billing-handlers.js');
    return await getFailedPayments(request, env, allHeaders);
  }

  if (path === '/admin/billing/refund' && method === 'POST') {
    const { issueRefund } = await import('../../admin-billing-handlers.js');
    return await issueRefund(request, env, allHeaders);
  }

  if (path === '/admin/billing/cancel-subscription' && method === 'POST') {
    const { cancelSubscription } = await import('../../admin-billing-handlers.js');
    return await cancelSubscription(request, env, allHeaders);
  }

  // Payment routes
  if (path === '/payments/create-checkout-session' && method === 'POST') {
    const { createCheckoutSession } = await import('../../payment-handlers.js');
    return await createCheckoutSession(request, env, allHeaders);
  }

  if (path === '/payments/create-payment-intent' && method === 'POST') {
    const { createPaymentIntent } = await import('../../payment-handlers.js');
    return await createPaymentIntent(request, env, allHeaders);
  }

  if (path === '/payments/create-portal-session' && method === 'POST') {
    const { createPortalSession } = await import('../../payment-handlers.js');
    return await createPortalSession(request, env, allHeaders);
  }

  if (path === '/payments/subscription' && method === 'GET') {
    const { getSubscription } = await import('../../payment-handlers.js');
    return await getSubscription(request, env, allHeaders);
  }

  if (path === '/payments/history' && method === 'GET') {
    const { getPaymentHistory } = await import('../../payment-handlers.js');
    return await getPaymentHistory(request, env, allHeaders);
  }

  if (path === '/payments/can-upload' && method === 'GET') {
    const { checkCanUpload } = await import('../../payment-handlers.js');
    return await checkCanUpload(request, env, allHeaders);
  }

  if (path === '/payments/webhook' && method === 'POST') {
    return await handleStripeWebhook(request, env, allHeaders);
  }

  if (path === '/webhooks/stripe' && method === 'POST') {
    return await handleStripeWebhook(request, env, allHeaders);
  }

  if (path === '/generate-assets' && method === 'POST') {
    return await handlers.handleGenerateAssets(request, env, allHeaders);
  }

  if (path === '/assets' && method === 'GET') {
    return await handlers.handleGetAssets(request, env, allHeaders);
  }

  if (path === '/format-manuscript' && method === 'POST') {
    return await handlers.handleFormatManuscript(request, env, allHeaders);
  }

  if (path === '/download-formatted' && method === 'GET') {
    return await handlers.handleDownloadFormatted(request, env, allHeaders);
  }

  if (path === '/analyze-market' && method === 'POST') {
    return await handlers.handleMarketAnalysis(request, env, allHeaders);
  }

  if (path === '/market-analysis' && method === 'GET') {
    return await handlers.handleGetMarketAnalysis(request, env, allHeaders);
  }

  if (path === '/generate-social-media' && method === 'POST') {
    return await handlers.handleGenerateSocialMedia(request, env, allHeaders);
  }

  if (path === '/social-media' && method === 'GET') {
    return await handlers.handleGetSocialMedia(request, env, allHeaders);
  }

  if (path.startsWith('/analysis/') && method === 'GET') {
    return await handlers.handleGetAnalysis(request, env, allHeaders);
  }

  if (path === '/results' && method === 'GET') {
    return await handlers.handleGetAnalysisResults(request, env, allHeaders);
  }

  if (path === '/report' && method === 'GET') {
    return await handlers.handleGenerateReport(request, env, allHeaders);
  }

  if (path === '/annotated' && method === 'GET') {
    return await handlers.handleGenerateAnnotatedManuscript(request, env, allHeaders);
  }

  if (path === '/debug/report-id' && method === 'GET') {
    return await handlers.handleDebugReportId(request, env, allHeaders);
  }

  if (path === '/' && method === 'GET') {
    return await handlers.handleRoot(request, env);
  }

  // No route matched
  return null;
}
