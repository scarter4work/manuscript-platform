/**
 * Router module for handling all API routes
 * Maps incoming requests to appropriate handlers
 */

import { authHandlers } from '../../auth-handlers.js';
import { manuscriptHandlers } from '../../manuscript-handlers.js';
import { audiobookHandlers } from '../../audiobook-handlers.js';
import { audiobookGenerationHandlers } from '../../audiobook-generation-handlers.js';
import { reviewHandlers } from '../../review-handlers.js';
import { publishingHandlers } from '../../publishing-handlers.js';
import { publicAPIHandlers } from '../../public-api-handlers.js';
import { teamHandlers } from '../../team-handlers.js';
import { emailPreferenceHandlers } from '../../email-preference-handlers.js';
import { handleStripeWebhook } from '../../webhook-handlers.js';
import { progressHandlers } from '../../progress-tracker.js';
import { coverHandlers } from '../../cover-handlers.js';
import { packageHandlers } from '../../package-handlers.js';
import { metadataHandlers } from '../../metadata-handlers.js';
import { seriesHandlers } from '../../series-handlers.js';

// Legacy handlers (extracted from worker.js)
import * as manuscriptLegacy from '../handlers/legacy-manuscript-handlers.js';
import * as analysisLegacy from '../handlers/legacy-analysis-handlers.js';
import * as assetLegacy from '../handlers/legacy-asset-handlers.js';
import * as formatLegacy from '../handlers/legacy-format-handlers.js';
import * as marketLegacy from '../handlers/legacy-market-handlers.js';
import * as socialLegacy from '../handlers/legacy-social-handlers.js';
import * as dmcaLegacy from '../handlers/legacy-dmca-handlers.js';

/**
 * Route a request to the appropriate handler
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {Function} addCorsHeaders - Function to add CORS headers to response
 * @param {Object} rateLimitHeaders - Rate limiting headers to include
 * @param {Object} allHeaders - All CORS and security headers
 * @returns {Response|null} Response if route matched, null otherwise
 */
export async function routeRequest(request, env, addCorsHeaders, rateLimitHeaders, allHeaders) {
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
  // AUDIOBOOK GENERATION ROUTES (On-demand generation)
  // ========================================================================

  if (path.match(/^\/manuscripts\/[^/]+\/audiobook\/generate-script$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await audiobookGenerationHandlers.generateNarrationScript(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/audiobook\/calculate-timing$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await audiobookGenerationHandlers.getChapterTiming(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/audiobook\/generate-pronunciation$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await audiobookGenerationHandlers.getPronunciationGuide(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/audiobook\/generate-samples$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await audiobookGenerationHandlers.generateSamplePassages(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/audiobook\/generate-narrator-brief$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await audiobookGenerationHandlers.getNarratorBrief(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/audiobook\/generate-acx-metadata$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await audiobookGenerationHandlers.getACXMetadata(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path.match(/^\/manuscripts\/[^/]+\/audiobook\/generate-findaway-metadata$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await audiobookGenerationHandlers.getFindawayMetadata(request, env, manuscriptId), rateLimitHeaders);
  }

  if (path === '/audiobook/acx-checklist' && method === 'GET') {
    return addCorsHeaders(await audiobookGenerationHandlers.getACXChecklist(request, env), rateLimitHeaders);
  }

  if (path === '/audiobook/export-csv' && method === 'POST') {
    return addCorsHeaders(await audiobookGenerationHandlers.exportMetadataCSV(request, env), rateLimitHeaders);
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
  // PROGRESS TRACKING ROUTES
  // ========================================================================

  // POST /manuscripts/:id/progress/:platform - Initialize progress tracking for a platform
  if (path.match(/^\/manuscripts\/[^/]+\/progress\/[^/]+$/) && method === 'POST') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const platform = parts[4];
    return addCorsHeaders(await progressHandlers.initializeProgress(request, env, manuscriptId, platform), rateLimitHeaders);
  }

  // GET /manuscripts/:id/progress - Get progress for all platforms
  if (path.match(/^\/manuscripts\/[^/]+\/progress$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await progressHandlers.getProgress(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/progress/:platform - Get progress for specific platform
  if (path.match(/^\/manuscripts\/[^/]+\/progress\/[^/]+$/) && method === 'GET') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const platform = parts[4];
    return addCorsHeaders(await progressHandlers.getProgress(request, env, manuscriptId, platform), rateLimitHeaders);
  }

  // PATCH /manuscripts/:id/progress/:platform/checklist/:itemKey - Update checklist item
  if (path.match(/^\/manuscripts\/[^/]+\/progress\/[^/]+\/checklist\/[^/]+$/) && method === 'PATCH') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const platform = parts[4];
    const itemKey = parts[6];
    return addCorsHeaders(await progressHandlers.updateChecklistItem(request, env, manuscriptId, platform, itemKey), rateLimitHeaders);
  }

  // PATCH /manuscripts/:id/progress/:platform/status - Update platform status
  if (path.match(/^\/manuscripts\/[^/]+\/progress\/[^/]+\/status$/) && method === 'PATCH') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const platform = parts[4];
    return addCorsHeaders(await progressHandlers.updatePlatformStatus(request, env, manuscriptId, platform), rateLimitHeaders);
  }

  // ========================================================================
  // COVER IMAGE ROUTES
  // ========================================================================

  // POST /manuscripts/:id/cover - Upload cover image
  if (path.match(/^\/manuscripts\/[^/]+\/cover$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await coverHandlers.uploadCover(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/cover - Get cover image
  if (path.match(/^\/manuscripts\/[^/]+\/cover$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return await coverHandlers.getCover(request, env, manuscriptId); // No CORS - direct image response
  }

  // DELETE /manuscripts/:id/cover - Delete cover image
  if (path.match(/^\/manuscripts\/[^/]+\/cover$/) && method === 'DELETE') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await coverHandlers.deleteCover(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /cover/specs - Get cover specifications for platforms
  if (path === '/cover/specs' && method === 'GET') {
    return addCorsHeaders(await coverHandlers.getCoverSpecifications(request, env), rateLimitHeaders);
  }

  // POST /cover/spine-calculator - Calculate spine width for print covers
  if (path === '/cover/spine-calculator' && method === 'POST') {
    return addCorsHeaders(await coverHandlers.calculateSpine(request, env), rateLimitHeaders);
  }

  // ========================================================================
  // PACKAGE DOWNLOAD ROUTES
  // ========================================================================

  // GET /manuscripts/:id/packages - Get available packages
  if (path.match(/^\/manuscripts\/[^/]+\/packages$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await packageHandlers.getAvailablePackages(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/packages/all - Download all platforms bundle
  if (path.match(/^\/manuscripts\/[^/]+\/packages\/all$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return await packageHandlers.downloadAllPlatformsBundle(request, env, manuscriptId); // No CORS - file download
  }

  // GET /manuscripts/:id/packages/analytics - Get download analytics
  if (path.match(/^\/manuscripts\/[^/]+\/packages\/analytics$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await packageHandlers.getPackageAnalytics(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/packages/:platform - Download specific platform package
  if (path.match(/^\/manuscripts\/[^/]+\/packages\/[^/]+$/) && method === 'GET' && !path.endsWith('/all') && !path.endsWith('/analytics')) {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const platform = parts[4];
    return await packageHandlers.downloadPlatformPackage(request, env, manuscriptId, platform); // No CORS - file download
  }

  // ========================================================================
  // METADATA OPTIMIZATION ROUTES
  // ========================================================================

  // GET /manuscripts/:id/metadata/optimize - Get complete optimization report
  if (path.match(/^\/manuscripts\/[^/]+\/metadata\/optimize$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await metadataHandlers.getOptimizationReport(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/metadata/keywords - Get keyword recommendations
  if (path.match(/^\/manuscripts\/[^/]+\/metadata\/keywords$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await metadataHandlers.getKeywordRecommendations(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/metadata/categories - Get BISAC category recommendations
  if (path.match(/^\/manuscripts\/[^/]+\/metadata\/categories$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await metadataHandlers.getCategoryRecommendations(request, env, manuscriptId), rateLimitHeaders);
  }

  // POST /manuscripts/:id/metadata/pricing - Get pricing recommendations
  if (path.match(/^\/manuscripts\/[^/]+\/metadata\/pricing$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await metadataHandlers.getPricingRecommendations(request, env, manuscriptId), rateLimitHeaders);
  }

  // POST /manuscripts/:id/metadata/description - Optimize book description
  if (path.match(/^\/manuscripts\/[^/]+\/metadata\/description$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await metadataHandlers.optimizeBookDescription(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/metadata/ab-test - Generate A/B test suggestions
  if (path.match(/^\/manuscripts\/[^/]+\/metadata\/ab-test$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await metadataHandlers.getABTestSuggestions(request, env, manuscriptId), rateLimitHeaders);
  }

  // POST /manuscripts/:id/metadata/competitive - Get competitive analysis
  if (path.match(/^\/manuscripts\/[^/]+\/metadata\/competitive$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await metadataHandlers.getCompetitiveAnalysis(request, env, manuscriptId), rateLimitHeaders);
  }

  // PATCH /manuscripts/:id/metadata - Update manuscript metadata
  if (path.match(/^\/manuscripts\/[^/]+\/metadata$/) && method === 'PATCH') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await metadataHandlers.updateManuscriptMetadata(request, env, manuscriptId), rateLimitHeaders);
  }

  // ========================================================================
  // SERIES MANAGEMENT ROUTES
  // ========================================================================

  // POST /series - Create new series
  if (path === '/series' && method === 'POST') {
    return addCorsHeaders(await seriesHandlers.handleCreateSeries(request, env), rateLimitHeaders);
  }

  // GET /series - List all series for user
  if (path === '/series' && method === 'GET') {
    return addCorsHeaders(await seriesHandlers.handleListSeries(request, env), rateLimitHeaders);
  }

  // GET /series/:id - Get series details
  if (path.match(/^\/series\/[^/]+$/) && method === 'GET') {
    const seriesId = path.split('/')[2];
    return addCorsHeaders(await seriesHandlers.handleGetSeries(request, env, seriesId), rateLimitHeaders);
  }

  // PATCH /series/:id - Update series
  if (path.match(/^\/series\/[^/]+$/) && method === 'PATCH') {
    const seriesId = path.split('/')[2];
    return addCorsHeaders(await seriesHandlers.handleUpdateSeries(request, env, seriesId), rateLimitHeaders);
  }

  // DELETE /series/:id - Delete series
  if (path.match(/^\/series\/[^/]+$/) && method === 'DELETE') {
    const seriesId = path.split('/')[2];
    return addCorsHeaders(await seriesHandlers.handleDeleteSeries(request, env, seriesId), rateLimitHeaders);
  }

  // POST /series/:id/manuscripts - Add manuscript to series
  if (path.match(/^\/series\/[^/]+\/manuscripts$/) && method === 'POST') {
    const seriesId = path.split('/')[2];
    return addCorsHeaders(await seriesHandlers.handleAddManuscriptToSeries(request, env, seriesId), rateLimitHeaders);
  }

  // DELETE /series/:id/manuscripts/:manuscriptId - Remove manuscript from series
  if (path.match(/^\/series\/[^/]+\/manuscripts\/[^/]+$/) && method === 'DELETE') {
    const parts = path.split('/');
    const seriesId = parts[2];
    const manuscriptId = parts[4];
    return addCorsHeaders(await seriesHandlers.handleRemoveManuscriptFromSeries(request, env, seriesId, manuscriptId), rateLimitHeaders);
  }

  // PATCH /series/:id/manuscripts/:manuscriptId - Update manuscript in series
  if (path.match(/^\/series\/[^/]+\/manuscripts\/[^/]+$/) && method === 'PATCH') {
    const parts = path.split('/');
    const seriesId = parts[2];
    const manuscriptId = parts[4];
    return addCorsHeaders(await seriesHandlers.handleUpdateSeriesManuscript(request, env, seriesId, manuscriptId), rateLimitHeaders);
  }

  // POST /series/:id/bundles - Create series bundle
  if (path.match(/^\/series\/[^/]+\/bundles$/) && method === 'POST') {
    const seriesId = path.split('/')[2];
    return addCorsHeaders(await seriesHandlers.handleCreateBundle(request, env, seriesId), rateLimitHeaders);
  }

  // POST /series/:id/reading-orders - Create custom reading order
  if (path.match(/^\/series\/[^/]+\/reading-orders$/) && method === 'POST') {
    const seriesId = path.split('/')[2];
    return addCorsHeaders(await seriesHandlers.handleCreateReadingOrder(request, env, seriesId), rateLimitHeaders);
  }

  // GET /series/:id/read-through - Get read-through rate
  if (path.match(/^\/series\/[^/]+\/read-through$/) && method === 'GET') {
    const seriesId = path.split('/')[2];
    return addCorsHeaders(await seriesHandlers.handleGetReadThroughRate(request, env, seriesId), rateLimitHeaders);
  }

  // GET /series/:id/backmatter/:bookNumber - Generate backmatter for book
  if (path.match(/^\/series\/[^/]+\/backmatter\/[^/]+$/) && method === 'GET') {
    const parts = path.split('/');
    const seriesId = parts[2];
    const bookNumber = parts[4];
    return addCorsHeaders(await seriesHandlers.handleGenerateBackmatter(request, env, seriesId, bookNumber), rateLimitHeaders);
  }

  // GET /series/:id/performance - Get series performance metrics
  if (path.match(/^\/series\/[^/]+\/performance$/) && method === 'GET') {
    const seriesId = path.split('/')[2];
    return addCorsHeaders(await seriesHandlers.handleGetPerformance(request, env, seriesId), rateLimitHeaders);
  }

  // GET /series/:id/marketing - Generate series marketing copy
  if (path.match(/^\/series\/[^/]+\/marketing$/) && method === 'GET') {
    const seriesId = path.split('/')[2];
    return addCorsHeaders(await seriesHandlers.handleGenerateMarketing(request, env, seriesId), rateLimitHeaders);
  }

  // ========================================================================
  // LEGACY MANUSCRIPT MANAGEMENT ROUTES
  // Delegate to legacy handlers from extracted modules
  // ========================================================================

  return await routeLegacyHandlers(path, method, request, env, addCorsHeaders, rateLimitHeaders, allHeaders);
}

/**
 * Route legacy handlers using imported handler modules
 */
async function routeLegacyHandlers(path, method, request, env, addCorsHeaders, rateLimitHeaders, allHeaders) {
  // Manuscript routes
  if (path === '/upload/manuscript' && method === 'POST') {
    return addCorsHeaders(await manuscriptLegacy.handleManuscriptUpload(request, env, allHeaders), rateLimitHeaders);
  }

  if (path === '/upload/marketing' && method === 'POST') {
    return addCorsHeaders(await manuscriptLegacy.handleMarketingUpload(request, env, allHeaders), rateLimitHeaders);
  }

  if (path.startsWith('/get/') && method === 'GET') {
    return addCorsHeaders(await manuscriptLegacy.handleFileGet(request, env, allHeaders), rateLimitHeaders);
  }

  if (path.startsWith('/list/') && method === 'GET') {
    return await manuscriptLegacy.handleFileList(request, env, allHeaders);
  }

  if (path.startsWith('/delete/') && method === 'DELETE') {
    return await manuscriptLegacy.handleFileDelete(request, env, allHeaders);
  }

  // Analysis routes
  if (path === '/analyze/developmental' && method === 'POST') {
    return await analysisLegacy.handleDevelopmentalAnalysis(request, env, allHeaders);
  }

  if (path === '/analyze/line-editing' && method === 'POST') {
    return await analysisLegacy.handleLineEditingAnalysis(request, env, allHeaders);
  }

  if (path === '/analyze/copy-editing' && method === 'POST') {
    return await analysisLegacy.handleCopyEditingAnalysis(request, env, allHeaders);
  }

  if (path === '/analyze/start' && method === 'POST') {
    return await analysisLegacy.handleStartAnalysis(request, env, allHeaders);
  }

  if (path === '/analyze/status' && method === 'GET') {
    return await analysisLegacy.handleAnalysisStatus(request, env, allHeaders);
  }

  // Asset routes
  if (path === '/assets/status' && method === 'GET') {
    return await assetLegacy.handleAssetStatus(request, env, allHeaders);
  }

  // DMCA routes
  if (path === '/dmca/submit' && method === 'POST') {
    return await dmcaLegacy.handleDMCASubmission(request, env, allHeaders);
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

  // Asset generation routes
  if (path === '/generate-assets' && method === 'POST') {
    return await assetLegacy.handleGenerateAssets(request, env, allHeaders);
  }

  if (path === '/assets' && method === 'GET') {
    return await assetLegacy.handleGetAssets(request, env, allHeaders);
  }

  // Format routes
  if (path === '/format-manuscript' && method === 'POST') {
    return await formatLegacy.handleFormatManuscript(request, env, allHeaders);
  }

  if (path === '/download-formatted' && method === 'GET') {
    return await formatLegacy.handleDownloadFormatted(request, env, allHeaders);
  }

  // Market analysis routes
  if (path === '/analyze-market' && method === 'POST') {
    return await marketLegacy.handleMarketAnalysis(request, env, allHeaders);
  }

  if (path === '/market-analysis' && method === 'GET') {
    return await marketLegacy.handleGetMarketAnalysis(request, env, allHeaders);
  }

  // Social media routes
  if (path === '/generate-social-media' && method === 'POST') {
    return await socialLegacy.handleGenerateSocialMedia(request, env, allHeaders);
  }

  if (path === '/social-media' && method === 'GET') {
    return await socialLegacy.handleGetSocialMedia(request, env, allHeaders);
  }

  // Analysis result routes
  if (path.startsWith('/analysis/') && method === 'GET') {
    return await analysisLegacy.handleGetAnalysis(request, env, allHeaders);
  }

  if (path === '/results' && method === 'GET') {
    return await analysisLegacy.handleGetAnalysisResults(request, env, allHeaders);
  }

  if (path === '/report' && method === 'GET') {
    return await analysisLegacy.handleGenerateReport(request, env, allHeaders);
  }

  if (path === '/annotated' && method === 'GET') {
    return await analysisLegacy.handleGenerateAnnotatedManuscript(request, env, allHeaders);
  }

  // Debug and root routes
  if (path === '/debug/report-id' && method === 'GET') {
    const reportId = new URL(request.url).searchParams.get('id');
    if (!reportId) {
      return new Response(JSON.stringify({ error: 'id parameter required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);
    if (mappingObject) {
      const manuscriptKey = await mappingObject.text();
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

  if (path === '/' && method === 'GET') {
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
          'GET /auth/me'
        ],
        manuscripts: [
          'GET /manuscripts',
          'POST /upload/manuscript',
          'GET /manuscripts/:id',
          'DELETE /manuscripts/:id'
        ],
        analysis: [
          'POST /analyze/start',
          'GET /analyze/status',
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

  // No route matched
  return null;
}
