/**
 * Router module for handling all API routes
 * Maps incoming requests to appropriate handlers
 */

import { authHandlers } from '../handlers/auth-handlers.js';
import { manuscriptHandlers } from '../handlers/manuscript-handlers.js';
import { audiobookHandlers } from '../handlers/audiobook-handlers.js';
import { audiobookGenerationHandlers } from '../handlers/audiobook-generation-handlers.js';
import { reviewHandlers } from '../handlers/review-handlers.js';
import { publishingHandlers } from '../handlers/publishing-handlers.js';
import { publicAPIHandlers } from '../handlers/public-api-handlers.js';
import { teamHandlers } from '../handlers/team-handlers.js';
import { emailPreferenceHandlers } from '../handlers/email-preference-handlers.js';
import { handleStripeWebhook } from '../handlers/webhook-handlers.js';
import { progressHandlers } from '../services/progress-tracker.js';
import { coverHandlers } from '../handlers/cover-handlers.js';
import { packageHandlers } from '../handlers/package-handlers.js';
import { metadataHandlers } from '../handlers/metadata-handlers.js';
import { seriesHandlers } from '../handlers/series-handlers.js';
import { authorBioHandlers } from '../handlers/author-bio-handlers.js';
import { enhancedMetadataHandlers } from '../handlers/enhanced-metadata-handlers.js';
import { supportingDocumentsHandlers } from '../handlers/supporting-documents-handlers.js';
import { submissionPackageHandlers } from '../handlers/submission-package-handlers.js';
import { submissionResponseHandlers } from '../handlers/submission-response-handlers.js';
import * as humanEditorHandlers from '../handlers/human-editor-handlers.js';
import * as marketingHandlers from '../handlers/marketing-handlers.js';
import * as formattingHandlers from '../handlers/formatting-handlers.js';
import * as communicationHandlers from '../handlers/communication-handlers.js';
import * as slushPileHandlers from '../handlers/slush-pile-handlers.js';
import * as submissionWindowsHandlers from '../handlers/submission-windows-handlers.js';
import * as kdpHandlers from '../handlers/kdp-handlers.js';
import * as salesTrackingHandlers from '../handlers/sales-tracking-handlers.js';
import * as rightsManagementHandlers from '../handlers/rights-management-handlers.js';
import * as marketAnalysisHandlers from '../handlers/market-analysis-handlers.js';
import * as aiChatHandlers from '../handlers/ai-chat-handlers.js';
import * as competitiveAnalysisHandlers from '../handlers/competitive-analysis-handlers.js';

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

  if (path === '/auth/resend-verification' && method === 'POST') {
    return addCorsHeaders(await authHandlers.resendVerification(request, env), rateLimitHeaders);
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

  // POST /manuscripts/:id/cover/generate-brief - Generate AI cover design brief
  if (path.match(/^\/manuscripts\/[^/]+\/cover\/generate-brief$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await coverHandlers.generateCoverBrief(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/cover/brief - Get cover design brief
  if (path.match(/^\/manuscripts\/[^/]+\/cover\/brief$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await coverHandlers.getCoverBrief(request, env, manuscriptId), rateLimitHeaders);
  }

  // POST /manuscripts/:id/cover/midjourney-prompt - Get Midjourney/AI prompts from brief
  if (path.match(/^\/manuscripts\/[^/]+\/cover\/midjourney-prompt$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await coverHandlers.generateMidjourneyPrompt(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /cover/templates/:genre - Get genre-specific cover design templates
  if (path.match(/^\/cover\/templates\/[^/]+$/) && method === 'GET') {
    const genre = path.split('/')[3];
    return addCorsHeaders(await coverHandlers.getGenreTemplates(request, env, genre), rateLimitHeaders);
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
  // AUTHOR BIO ROUTES
  // ========================================================================

  // POST /manuscripts/:id/author-bio/generate - Generate author bio variations
  if (path.match(/^\/manuscripts\/[^/]+\/author-bio\/generate$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await authorBioHandlers.generateBio(request, env), rateLimitHeaders);
  }

  // POST /manuscripts/:id/author-bio/generate-all - Generate complete bio package (all lengths)
  if (path.match(/^\/manuscripts\/[^/]+\/author-bio\/generate-all$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await authorBioHandlers.generateCompleteBioPackage(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/author-bio - Get author bios for manuscript
  if (path.match(/^\/manuscripts\/[^/]+\/author-bio$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await authorBioHandlers.getAuthorBios(request, env), rateLimitHeaders);
  }

  // PATCH /author/profile - Update author profile
  if (path === '/author/profile' && method === 'PATCH') {
    return addCorsHeaders(await authorBioHandlers.updateAuthorProfile(request, env), rateLimitHeaders);
  }

  // GET /author/profile - Get author profile
  if (path === '/author/profile' && method === 'GET') {
    return addCorsHeaders(await authorBioHandlers.getAuthorProfile(request, env), rateLimitHeaders);
  }

  // ========================================================================
  // HUMAN-STYLE EDITOR ROUTES (Issue #60)
  // ========================================================================

  // POST /manuscripts/:id/human-edit/chapter/:chapterNum - Generate chapter feedback
  if (path.match(/^\/manuscripts\/[^/]+\/human-edit\/chapter\/\d+$/) && method === 'POST') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const chapterNum = parts[5];
    request.params = { manuscriptId, chapterNum };
    return addCorsHeaders(await humanEditorHandlers.handleGenerateChapterFeedback(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/human-edit - Get all feedback for manuscript
  if (path.match(/^\/manuscripts\/[^/]+\/human-edit$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await humanEditorHandlers.handleGetAllFeedback(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/human-edit/chapter/:chapterNum - Get chapter feedback
  if (path.match(/^\/manuscripts\/[^/]+\/human-edit\/chapter\/\d+$/) && method === 'GET') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const chapterNum = parts[5];
    request.params = { manuscriptId, chapterNum };
    return addCorsHeaders(await humanEditorHandlers.handleGetChapterFeedback(request, env), rateLimitHeaders);
  }

  // PATCH /manuscripts/:id/human-edit/accept/:editId - Mark annotation as addressed
  if (path.match(/^\/manuscripts\/[^/]+\/human-edit\/accept\/[^/]+$/) && method === 'PATCH') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const editId = parts[5];
    request.params = { manuscriptId, editId };
    return addCorsHeaders(await humanEditorHandlers.handleAcceptAnnotation(request, env), rateLimitHeaders);
  }

  // DELETE /manuscripts/:id/human-edit/:editId - Dismiss annotation
  if (path.match(/^\/manuscripts\/[^/]+\/human-edit\/[^/]+$/) && method === 'DELETE') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const editId = parts[4];
    request.params = { manuscriptId, editId };
    return addCorsHeaders(await humanEditorHandlers.handleDismissAnnotation(request, env), rateLimitHeaders);
  }

  // ========================================================================
  // MARKETING CONTENT ROUTES (Issue #45)
  // ========================================================================

  // POST /manuscripts/:id/marketing/generate - Generate complete marketing kit
  if (path.match(/^\/manuscripts\/[^/]+\/marketing\/generate$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await marketingHandlers.handleGenerateMarketingKit(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/marketing/kits - Get all marketing kits
  if (path.match(/^\/manuscripts\/[^/]+\/marketing\/kits$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await marketingHandlers.handleGetMarketingKits(request, env), rateLimitHeaders);
  }

  // GET /marketing/:kitId/social-posts - Get social media posts (optionally filtered by platform)
  if (path.match(/^\/marketing\/[^/]+\/social-posts$/) && method === 'GET') {
    const kitId = path.split('/')[2];
    request.params = { kitId };
    return addCorsHeaders(await marketingHandlers.handleGetSocialPosts(request, env), rateLimitHeaders);
  }

  // GET /marketing/:kitId/email-template - Get launch email template
  if (path.match(/^\/marketing\/[^/]+\/email-template$/) && method === 'GET') {
    const kitId = path.split('/')[2];
    request.params = { kitId };
    return addCorsHeaders(await marketingHandlers.handleGetEmailTemplate(request, env), rateLimitHeaders);
  }

  // GET /marketing/:kitId/content-calendar - Get 30-day content calendar
  if (path.match(/^\/marketing\/[^/]+\/content-calendar$/) && method === 'GET') {
    const kitId = path.split('/')[2];
    request.params = { kitId };
    return addCorsHeaders(await marketingHandlers.handleGetContentCalendar(request, env), rateLimitHeaders);
  }

  // GET /marketing/:kitId/trailer-script - Get book trailer script
  if (path.match(/^\/marketing\/[^/]+\/trailer-script$/) && method === 'GET') {
    const kitId = path.split('/')[2];
    request.params = { kitId };
    return addCorsHeaders(await marketingHandlers.handleGetTrailerScript(request, env), rateLimitHeaders);
  }

  // GET /marketing/:kitId/reader-magnets - Get reader magnet ideas
  if (path.match(/^\/marketing\/[^/]+\/reader-magnets$/) && method === 'GET') {
    const kitId = path.split('/')[2];
    request.params = { kitId };
    return addCorsHeaders(await marketingHandlers.handleGetReaderMagnets(request, env), rateLimitHeaders);
  }

  // PATCH /marketing/posts/:postId/mark-used - Mark social media post as used
  if (path.match(/^\/marketing\/posts\/[^/]+\/mark-used$/) && method === 'PATCH') {
    const postId = path.split('/')[3];
    request.params = { postId };
    return addCorsHeaders(await marketingHandlers.handleMarkPostAsUsed(request, env), rateLimitHeaders);
  }

  // ========================================================================
  // MANUSCRIPT FORMATTING ROUTES (Issue #44)
  // ========================================================================

  // POST /manuscripts/:id/format/epub - Generate EPUB format for Kindle
  if (path.match(/^\/manuscripts\/[^/]+\/format\/epub$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await formattingHandlers.handleGenerateEPUB(request, env), rateLimitHeaders);
  }

  // POST /manuscripts/:id/format/pdf - Generate PDF format for paperback print
  if (path.match(/^\/manuscripts\/[^/]+\/format\/pdf$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await formattingHandlers.handleGeneratePDF(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/formatted - Get all formatted versions of a manuscript
  if (path.match(/^\/manuscripts\/[^/]+\/formatted$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await formattingHandlers.handleGetFormattedManuscripts(request, env), rateLimitHeaders);
  }

  // GET /formatted/:id/download - Download formatted file
  if (path.match(/^\/formatted\/[^/]+\/download$/) && method === 'GET') {
    const formattedId = path.split('/')[2];
    request.params = { formattedId };
    return addCorsHeaders(await formattingHandlers.handleDownloadFormatted(request, env), rateLimitHeaders);
  }

  // GET /trim-sizes - Get available trim sizes for PDF generation
  if (path === '/trim-sizes' && method === 'GET') {
    return addCorsHeaders(await formattingHandlers.handleGetTrimSizes(request, env), rateLimitHeaders);
  }

  // ========================================================================
  // AMAZON KDP INTEGRATION ROUTES (Issue #47)
  // ========================================================================

  // POST /manuscripts/:id/kdp/prepare - Prepare KDP submission package
  if (path.match(/^\/manuscripts\/[^/]+\/kdp\/prepare$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await kdpHandlers.handlePrepareKDPPackage(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/kdp/package - Get KDP package details
  if (path.match(/^\/manuscripts\/[^/]+\/kdp\/package$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await kdpHandlers.handleGetKDPPackage(request, env), rateLimitHeaders);
  }

  // POST /manuscripts/:id/kdp/validate - Validate KDP package
  if (path.match(/^\/manuscripts\/[^/]+\/kdp\/validate$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await kdpHandlers.handleValidateKDPPackage(request, env), rateLimitHeaders);
  }

  // DELETE /manuscripts/:id/kdp/package - Delete KDP package
  if (path.match(/^\/manuscripts\/[^/]+\/kdp\/package$/) && method === 'DELETE') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await kdpHandlers.handleDeleteKDPPackage(request, env), rateLimitHeaders);
  }

  // GET /kdp/royalty-calculator - Calculate royalty estimates
  if (path === '/kdp/royalty-calculator' && method === 'GET') {
    return addCorsHeaders(await kdpHandlers.handleCalculateRoyalties(request, env), rateLimitHeaders);
  }

  // POST /manuscripts/:id/kdp/royalty - Save royalty calculation
  if (path.match(/^\/manuscripts\/[^/]+\/kdp\/royalty$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await kdpHandlers.handleSaveRoyaltyCalculation(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/kdp/stats - Get KDP statistics
  if (path.match(/^\/manuscripts\/[^/]+\/kdp\/stats$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await kdpHandlers.handleGetKDPStats(request, env), rateLimitHeaders);
  }

  // ========================================================================
  // MARKET ANALYSIS ROUTES (Issue #42)
  // ========================================================================

  // POST /manuscripts/:id/market-analysis - Generate market analysis
  if (path.match(/^\/manuscripts\/[^/]+\/market-analysis$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await marketAnalysisHandlers.handleGenerateMarketAnalysis(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/market-analysis - Get market analysis for manuscript
  if (path.match(/^\/manuscripts\/[^/]+\/market-analysis$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await marketAnalysisHandlers.handleGetMarketAnalysis(request, env), rateLimitHeaders);
  }

  // GET /market-analysis/:id - Get specific market analysis by ID
  if (path.match(/^\/market-analysis\/[^/]+$/) && method === 'GET') {
    const analysisId = path.split('/')[2];
    request.params = { analysisId };
    return addCorsHeaders(await marketAnalysisHandlers.handleGetMarketAnalysisById(request, env), rateLimitHeaders);
  }

  // DELETE /market-analysis/:id - Delete market analysis
  if (path.match(/^\/market-analysis\/[^/]+$/) && method === 'DELETE') {
    const analysisId = path.split('/')[2];
    request.params = { analysisId };
    return addCorsHeaders(await marketAnalysisHandlers.handleDeleteMarketAnalysis(request, env), rateLimitHeaders);
  }

  // GET /market-analysis/stats - Get market analysis statistics
  if (path === '/market-analysis/stats' && method === 'GET') {
    return addCorsHeaders(await marketAnalysisHandlers.handleGetMarketAnalysisStats(request, env), rateLimitHeaders);
  }

  // GET /genre-pricing/:genre - Get pricing data for genre
  if (path.match(/^\/genre-pricing\/[^/]+$/) && method === 'GET') {
    const genre = decodeURIComponent(path.split('/')[2]);
    request.params = { genre };
    return addCorsHeaders(await marketAnalysisHandlers.handleGetGenrePricing(request, env), rateLimitHeaders);
  }

  // ========================================================================
  // COMMUNICATION & FEEDBACK ROUTES (Issue #55)
  // ========================================================================

  // GET /notifications/preferences - Get notification preferences
  if (path === '/notifications/preferences' && method === 'GET') {
    return addCorsHeaders(await communicationHandlers.handleGetNotificationPreferences(request, env), rateLimitHeaders);
  }

  // PATCH /notifications/preferences - Update notification preferences
  if (path === '/notifications/preferences' && method === 'PATCH') {
    return addCorsHeaders(await communicationHandlers.handleUpdateNotificationPreferences(request, env), rateLimitHeaders);
  }

  // GET /templates - Get message templates
  if (path === '/templates' && method === 'GET') {
    return addCorsHeaders(await communicationHandlers.handleGetTemplates(request, env), rateLimitHeaders);
  }

  // POST /templates - Create message template
  if (path === '/templates' && method === 'POST') {
    return addCorsHeaders(await communicationHandlers.handleCreateTemplate(request, env), rateLimitHeaders);
  }

  // PATCH /templates/:id - Update message template
  if (path.match(/^\/templates\/[^/]+$/) && method === 'PATCH') {
    const templateId = path.split('/')[2];
    request.params = { templateId };
    return addCorsHeaders(await communicationHandlers.handleUpdateTemplate(request, env), rateLimitHeaders);
  }

  // DELETE /templates/:id - Delete message template
  if (path.match(/^\/templates\/[^/]+$/) && method === 'DELETE') {
    const templateId = path.split('/')[2];
    request.params = { templateId };
    return addCorsHeaders(await communicationHandlers.handleDeleteTemplate(request, env), rateLimitHeaders);
  }

  // GET /submissions/:id/messages - Get submission messages
  if (path.match(/^\/submissions\/[^/]+\/messages$/) && method === 'GET') {
    const submissionId = path.split('/')[2];
    request.params = { submissionId };
    return addCorsHeaders(await communicationHandlers.handleGetSubmissionMessages(request, env), rateLimitHeaders);
  }

  // POST /submissions/:id/messages - Send submission message
  if (path.match(/^\/submissions\/[^/]+\/messages$/) && method === 'POST') {
    const submissionId = path.split('/')[2];
    request.params = { submissionId };
    return addCorsHeaders(await communicationHandlers.handleSendSubmissionMessage(request, env), rateLimitHeaders);
  }

  // POST /submissions/:id/revision-request - Create revision request
  if (path.match(/^\/submissions\/[^/]+\/revision-request$/) && method === 'POST') {
    const submissionId = path.split('/')[2];
    request.params = { submissionId };
    return addCorsHeaders(await communicationHandlers.handleCreateRevisionRequest(request, env), rateLimitHeaders);
  }

  // GET /revision-requests/:id - Get revision request
  if (path.match(/^\/revision-requests\/[^/]+$/) && method === 'GET') {
    const requestId = path.split('/')[2];
    request.params = { requestId };
    return addCorsHeaders(await communicationHandlers.handleGetRevisionRequest(request, env), rateLimitHeaders);
  }

  // PATCH /revision-requests/:id/respond - Respond to revision request
  if (path.match(/^\/revision-requests\/[^/]+\/respond$/) && method === 'PATCH') {
    const requestId = path.split('/')[2];
    request.params = { requestId };
    return addCorsHeaders(await communicationHandlers.handleRespondToRevisionRequest(request, env), rateLimitHeaders);
  }

  // ========================================================================
  // SLUSH PILE MANAGEMENT ROUTES (Issue #54)
  // ========================================================================

  // GET /publisher/inbox - Get publisher inbox with filtering
  if (path === '/publisher/inbox' && method === 'GET') {
    return addCorsHeaders(await slushPileHandlers.handleGetPublisherInbox(request, env), rateLimitHeaders);
  }

  // POST /submissions/:id/assign - Assign submission to reader
  if (path.match(/^\/submissions\/[^/]+\/assign$/) && method === 'POST') {
    const submissionId = path.split('/')[2];
    request.params = { submissionId };
    return addCorsHeaders(await slushPileHandlers.handleAssignSubmission(request, env), rateLimitHeaders);
  }

  // GET /submissions/:id/assignments - Get assignment history
  if (path.match(/^\/submissions\/[^/]+\/assignments$/) && method === 'GET') {
    const submissionId = path.split('/')[2];
    request.params = { submissionId };
    return addCorsHeaders(await slushPileHandlers.handleGetAssignments(request, env), rateLimitHeaders);
  }

  // PATCH /submissions/:submissionId/assignments/:assignmentId - Update assignment
  if (path.match(/^\/submissions\/[^/]+\/assignments\/[^/]+$/) && method === 'PATCH') {
    const parts = path.split('/');
    request.params = { submissionId: parts[2], assignmentId: parts[4] };
    return addCorsHeaders(await slushPileHandlers.handleUpdateAssignment(request, env), rateLimitHeaders);
  }

  // POST /submissions/:id/rate - Submit rating
  if (path.match(/^\/submissions\/[^/]+\/rate$/) && method === 'POST') {
    const submissionId = path.split('/')[2];
    request.params = { submissionId };
    return addCorsHeaders(await slushPileHandlers.handleRateSubmission(request, env), rateLimitHeaders);
  }

  // GET /submissions/:id/ratings - Get ratings
  if (path.match(/^\/submissions\/[^/]+\/ratings$/) && method === 'GET') {
    const submissionId = path.split('/')[2];
    request.params = { submissionId };
    return addCorsHeaders(await slushPileHandlers.handleGetRatings(request, env), rateLimitHeaders);
  }

  // GET /submissions/:id/consensus - Get consensus score
  if (path.match(/^\/submissions\/[^/]+\/consensus$/) && method === 'GET') {
    const submissionId = path.split('/')[2];
    request.params = { submissionId };
    return addCorsHeaders(await slushPileHandlers.handleGetConsensus(request, env), rateLimitHeaders);
  }

  // POST /submissions/:id/discuss - Add discussion comment
  if (path.match(/^\/submissions\/[^/]+\/discuss$/) && method === 'POST') {
    const submissionId = path.split('/')[2];
    request.params = { submissionId };
    return addCorsHeaders(await slushPileHandlers.handleAddDiscussion(request, env), rateLimitHeaders);
  }

  // GET /submissions/:id/discussion - Get discussion thread
  if (path.match(/^\/submissions\/[^/]+\/discussion$/) && method === 'GET') {
    const submissionId = path.split('/')[2];
    request.params = { submissionId };
    return addCorsHeaders(await slushPileHandlers.handleGetDiscussion(request, env), rateLimitHeaders);
  }

  // POST /publisher/batch-reject - Batch reject submissions
  if (path === '/publisher/batch-reject' && method === 'POST') {
    return addCorsHeaders(await slushPileHandlers.handleBatchReject(request, env), rateLimitHeaders);
  }

  // GET /publisher/stats - Publisher statistics
  if (path === '/publisher/stats' && method === 'GET') {
    return addCorsHeaders(await slushPileHandlers.handleGetPublisherStats(request, env), rateLimitHeaders);
  }

  // ========================================================================
  // SUBMISSION WINDOWS & DEADLINES ROUTES (Issue #53)
  // ========================================================================

  // GET /publishers - List publishers
  if (path === '/publishers' && method === 'GET') {
    return addCorsHeaders(await submissionWindowsHandlers.handleGetPublishers(request, env), rateLimitHeaders);
  }

  // POST /publishers - Create publisher (admin)
  if (path === '/publishers' && method === 'POST') {
    return addCorsHeaders(await submissionWindowsHandlers.handleCreatePublisher(request, env), rateLimitHeaders);
  }

  // GET /publishers/:id/windows - Get publisher windows
  if (path.match(/^\/publishers\/[^/]+\/windows$/) && method === 'GET') {
    const publisherId = path.split('/')[2];
    request.params = { publisherId };
    return addCorsHeaders(await submissionWindowsHandlers.handleGetPublisherWindows(request, env), rateLimitHeaders);
  }

  // GET /publishers/:id/windows/current - Get current window
  if (path.match(/^\/publishers\/[^/]+\/windows\/current$/) && method === 'GET') {
    const publisherId = path.split('/')[2];
    request.params = { publisherId };
    return addCorsHeaders(await submissionWindowsHandlers.handleGetCurrentWindow(request, env), rateLimitHeaders);
  }

  // POST /publishers/:id/windows - Create window
  if (path.match(/^\/publishers\/[^/]+\/windows$/) && method === 'POST') {
    const publisherId = path.split('/')[2];
    request.params = { publisherId };
    return addCorsHeaders(await submissionWindowsHandlers.handleCreateWindow(request, env), rateLimitHeaders);
  }

  // PATCH /publishers/:publisherId/windows/:windowId - Update window
  if (path.match(/^\/publishers\/[^/]+\/windows\/[^/]+$/) && method === 'PATCH') {
    const parts = path.split('/');
    request.params = { publisherId: parts[2], windowId: parts[4] };
    return addCorsHeaders(await submissionWindowsHandlers.handleUpdateWindow(request, env), rateLimitHeaders);
  }

  // GET /publishers/open-now - List open publishers
  if (path === '/publishers/open-now' && method === 'GET') {
    return addCorsHeaders(await submissionWindowsHandlers.handleGetOpenPublishers(request, env), rateLimitHeaders);
  }

  // GET /publishers/opening-soon - List opening soon
  if (path === '/publishers/opening-soon' && method === 'GET') {
    return addCorsHeaders(await submissionWindowsHandlers.handleGetOpeningSoonPublishers(request, env), rateLimitHeaders);
  }

  // POST /submissions/:id/deadlines - Add deadline
  if (path.match(/^\/submissions\/[^/]+\/deadlines$/) && method === 'POST') {
    const submissionId = path.split('/')[2];
    request.params = { submissionId };
    return addCorsHeaders(await submissionWindowsHandlers.handleAddDeadline(request, env), rateLimitHeaders);
  }

  // GET /submissions/:id/deadlines - Get deadlines
  if (path.match(/^\/submissions\/[^/]+\/deadlines$/) && method === 'GET') {
    const submissionId = path.split('/')[2];
    request.params = { submissionId };
    return addCorsHeaders(await submissionWindowsHandlers.handleGetDeadlines(request, env), rateLimitHeaders);
  }

  // GET /deadlines/upcoming - Get upcoming deadlines
  if (path === '/deadlines/upcoming' && method === 'GET') {
    return addCorsHeaders(await submissionWindowsHandlers.handleGetUpcomingDeadlines(request, env), rateLimitHeaders);
  }

  // POST /publishers/:id/alerts - Subscribe to alerts
  if (path.match(/^\/publishers\/[^/]+\/alerts$/) && method === 'POST') {
    const publisherId = path.split('/')[2];
    request.params = { publisherId };
    return addCorsHeaders(await submissionWindowsHandlers.handleSubscribeToAlerts(request, env), rateLimitHeaders);
  }

  // GET /alerts - Get user alerts
  if (path === '/alerts' && method === 'GET') {
    return addCorsHeaders(await submissionWindowsHandlers.handleGetAlerts(request, env), rateLimitHeaders);
  }

  // ========================================================================
  // ENHANCED METADATA ROUTES (Issue #51)
  // ========================================================================

  // GET /genres - Get genre taxonomy (hierarchical)
  if (path === '/genres' && method === 'GET') {
    return addCorsHeaders(await enhancedMetadataHandlers.getGenres(request, env), rateLimitHeaders);
  }

  // GET /genres/:id - Get specific genre with subgenres
  if (path.match(/^\/genres\/[^/]+$/) && method === 'GET') {
    const genreId = path.split('/')[2];
    return addCorsHeaders(await enhancedMetadataHandlers.getGenreById(request, env, genreId), rateLimitHeaders);
  }

  // GET /genres/:id/subgenres - Get subgenres for a parent genre
  if (path.match(/^\/genres\/[^/]+\/subgenres$/) && method === 'GET') {
    const genreId = path.split('/')[2];
    return addCorsHeaders(await enhancedMetadataHandlers.getSubgenres(request, env, genreId), rateLimitHeaders);
  }

  // GET /content-warnings - Get content warning types
  if (path === '/content-warnings' && method === 'GET') {
    return addCorsHeaders(await enhancedMetadataHandlers.getContentWarnings(request, env), rateLimitHeaders);
  }

  // PATCH /manuscripts/:id/enhanced-metadata - Update enhanced metadata
  if (path.match(/^\/manuscripts\/[^/]+\/enhanced-metadata$/) && method === 'PATCH') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await enhancedMetadataHandlers.updateEnhancedMetadata(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/validate-genre - Validate word count vs genre norms
  if (path.match(/^\/manuscripts\/[^/]+\/validate-genre$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await enhancedMetadataHandlers.validateGenre(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/metadata-history - Get metadata change history
  if (path.match(/^\/manuscripts\/[^/]+\/metadata-history$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await enhancedMetadataHandlers.getMetadataHistory(request, env, manuscriptId), rateLimitHeaders);
  }

  // ========================================================================
  // SUPPORTING DOCUMENTS ROUTES (Issue #49)
  // ========================================================================

  // POST /manuscripts/:id/documents/generate - Generate query letter or synopsis
  if (path.match(/^\/manuscripts\/[^/]+\/documents\/generate$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await supportingDocumentsHandlers.generateDocument(request, env, manuscriptId), rateLimitHeaders);
  }

  // POST /manuscripts/:id/documents/generate-all - Generate query letter + both synopsis
  if (path.match(/^\/manuscripts\/[^/]+\/documents\/generate-all$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await supportingDocumentsHandlers.generateAllDocuments(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/documents - List all supporting documents
  if (path.match(/^\/manuscripts\/[^/]+\/documents$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await supportingDocumentsHandlers.listDocuments(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/documents/:docType/versions - Get version history
  if (path.match(/^\/manuscripts\/[^/]+\/documents\/[^/]+\/versions$/) && method === 'GET') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const documentType = parts[4];
    return addCorsHeaders(await supportingDocumentsHandlers.getDocumentVersions(request, env, manuscriptId, documentType), rateLimitHeaders);
  }

  // GET /manuscripts/:id/documents/:docId - Get specific document
  if (path.match(/^\/manuscripts\/[^/]+\/documents\/[^/]+$/) && method === 'GET') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const docId = parts[4];
    return addCorsHeaders(await supportingDocumentsHandlers.getDocument(request, env, manuscriptId, docId), rateLimitHeaders);
  }

  // PUT /manuscripts/:id/documents/:docId - Update document (creates new version)
  if (path.match(/^\/manuscripts\/[^/]+\/documents\/[^/]+$/) && method === 'PUT') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const docId = parts[4];
    return addCorsHeaders(await supportingDocumentsHandlers.updateDocument(request, env, manuscriptId, docId), rateLimitHeaders);
  }

  // DELETE /manuscripts/:id/documents/:docId - Delete document
  if (path.match(/^\/manuscripts\/[^/]+\/documents\/[^/]+$/) && method === 'DELETE') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const docId = parts[4];
    return addCorsHeaders(await supportingDocumentsHandlers.deleteDocument(request, env, manuscriptId, docId), rateLimitHeaders);
  }

  // ========================================================================
  // SUBMISSION PACKAGE ROUTES (Issue #50)
  // ========================================================================

  // GET /manuscripts/:id/packages/templates - Get package templates
  if (path.match(/^\/manuscripts\/[^/]+\/packages\/templates$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await submissionPackageHandlers.getPackageTemplates(request, env, manuscriptId), rateLimitHeaders);
  }

  // POST /manuscripts/:id/packages/:pkgId/duplicate - Duplicate package
  if (path.match(/^\/manuscripts\/[^/]+\/packages\/[^/]+\/duplicate$/) && method === 'POST') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const packageId = parts[4];
    return addCorsHeaders(await submissionPackageHandlers.duplicatePackage(request, env, manuscriptId, packageId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/packages/:pkgId/download - Download package as ZIP
  if (path.match(/^\/manuscripts\/[^/]+\/packages\/[^/]+\/download$/) && method === 'GET') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const packageId = parts[4];
    return addCorsHeaders(await submissionPackageHandlers.downloadPackage(request, env, manuscriptId, packageId), rateLimitHeaders);
  }

  // POST /manuscripts/:id/packages - Create package
  if (path.match(/^\/manuscripts\/[^/]+\/packages$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await submissionPackageHandlers.createPackage(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/packages - List packages
  if (path.match(/^\/manuscripts\/[^/]+\/packages$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await submissionPackageHandlers.listPackages(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/packages/:pkgId - Get package details
  if (path.match(/^\/manuscripts\/[^/]+\/packages\/[^/]+$/) && method === 'GET') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const packageId = parts[4];
    return addCorsHeaders(await submissionPackageHandlers.getPackage(request, env, manuscriptId, packageId), rateLimitHeaders);
  }

  // PUT /manuscripts/:id/packages/:pkgId - Update package
  if (path.match(/^\/manuscripts\/[^/]+\/packages\/[^/]+$/) && method === 'PUT') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const packageId = parts[4];
    return addCorsHeaders(await submissionPackageHandlers.updatePackage(request, env, manuscriptId, packageId), rateLimitHeaders);
  }

  // DELETE /manuscripts/:id/packages/:pkgId - Delete package
  if (path.match(/^\/manuscripts\/[^/]+\/packages\/[^/]+$/) && method === 'DELETE') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const packageId = parts[4];
    return addCorsHeaders(await submissionPackageHandlers.deletePackage(request, env, manuscriptId, packageId), rateLimitHeaders);
  }

  // ========================================================================
  // SUBMISSION RESPONSE ROUTES (Issue #52)
  // ========================================================================

  // POST /manuscripts/:id/submissions - Create submission
  if (path.match(/^\/manuscripts\/[^/]+\/submissions$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await submissionResponseHandlers.createSubmission(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/submissions - List submissions
  if (path.match(/^\/manuscripts\/[^/]+\/submissions$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await submissionResponseHandlers.listSubmissions(request, env, manuscriptId), rateLimitHeaders);
  }

  // GET /manuscripts/:id/feedback-summary - Get feedback summary
  if (path.match(/^\/manuscripts\/[^/]+\/feedback-summary$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    return addCorsHeaders(await submissionResponseHandlers.getFeedbackSummary(request, env, manuscriptId), rateLimitHeaders);
  }

  // POST /submissions/:id/resubmit - Create resubmission from R&R
  if (path.match(/^\/submissions\/[^/]+\/resubmit$/) && method === 'POST') {
    const submissionId = path.split('/')[2];
    return addCorsHeaders(await submissionResponseHandlers.createResubmission(request, env, submissionId), rateLimitHeaders);
  }

  // POST /submissions/:id/feedback - Add categorized feedback
  if (path.match(/^\/submissions\/[^/]+\/feedback$/) && method === 'POST') {
    const submissionId = path.split('/')[2];
    return addCorsHeaders(await submissionResponseHandlers.createFeedback(request, env, submissionId), rateLimitHeaders);
  }

  // GET /submissions/:id/feedback - Get all feedback
  if (path.match(/^\/submissions\/[^/]+\/feedback$/) && method === 'GET') {
    const submissionId = path.split('/')[2];
    return addCorsHeaders(await submissionResponseHandlers.listFeedback(request, env, submissionId), rateLimitHeaders);
  }

  // PATCH /submissions/:id/feedback/:fbId - Mark feedback as addressed
  if (path.match(/^\/submissions\/[^/]+\/feedback\/[^/]+$/) && method === 'PATCH') {
    const parts = path.split('/');
    const submissionId = parts[2];
    const feedbackId = parts[4];
    return addCorsHeaders(await submissionResponseHandlers.updateFeedback(request, env, submissionId, feedbackId), rateLimitHeaders);
  }

  // PATCH /submissions/:id/response - Update submission response
  if (path.match(/^\/submissions\/[^/]+\/response$/) && method === 'PATCH') {
    const submissionId = path.split('/')[2];
    return addCorsHeaders(await submissionResponseHandlers.updateSubmissionResponse(request, env, submissionId), rateLimitHeaders);
  }

  // GET /submissions/:id - Get submission details
  if (path.match(/^\/submissions\/[^/]+$/) && method === 'GET') {
    const submissionId = path.split('/')[2];
    return addCorsHeaders(await submissionResponseHandlers.getSubmission(request, env, submissionId), rateLimitHeaders);
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
    const { getDMCARequests } = await import('../handlers/dmca-admin-handlers.js');
    return await getDMCARequests(request, env, allHeaders);
  }

  if (path === '/admin/dmca/stats' && method === 'GET') {
    const { getDMCAStats } = await import('../handlers/dmca-admin-handlers.js');
    return await getDMCAStats(request, env, allHeaders);
  }

  if (path === '/admin/dmca/status' && method === 'PATCH') {
    const { updateDMCAStatus } = await import('../handlers/dmca-admin-handlers.js');
    return await updateDMCAStatus(request, env, allHeaders);
  }

  if (path === '/admin/dmca/resolve' && method === 'POST') {
    const { resolveDMCARequest } = await import('../handlers/dmca-admin-handlers.js');
    return await resolveDMCARequest(request, env, allHeaders);
  }

  if (path === '/admin/users' && method === 'GET') {
    const { listUsers } = await import('../handlers/admin-handlers.js');
    return await listUsers(request, env, allHeaders);
  }

  if (path.match(/^\/admin\/users\/[^\/]+$/) && method === 'GET') {
    const userId = path.split('/')[3];
    const { getUserDetails } = await import('../handlers/admin-handlers.js');
    return await getUserDetails(request, env, allHeaders, userId);
  }

  if (path.match(/^\/admin\/users\/[^\/]+$/) && method === 'PATCH') {
    const userId = path.split('/')[3];
    const { updateUser } = await import('../handlers/admin-handlers.js');
    return await updateUser(request, env, allHeaders, userId);
  }

  if (path.match(/^\/admin\/users\/[^\/]+\/subscription$/) && method === 'POST') {
    const userId = path.split('/')[3];
    const { adjustUserSubscription } = await import('../handlers/admin-handlers.js');
    return await adjustUserSubscription(request, env, allHeaders, userId);
  }

  if (path === '/admin/manuscripts' && method === 'GET') {
    const { listAllManuscripts } = await import('../handlers/admin-handlers.js');
    return await listAllManuscripts(request, env, allHeaders);
  }

  if (path.match(/^\/admin\/manuscripts\/[^\/]+$/) && method === 'DELETE') {
    const manuscriptId = path.split('/')[3];
    const { adminDeleteManuscript } = await import('../handlers/admin-handlers.js');
    return await adminDeleteManuscript(request, env, allHeaders, manuscriptId);
  }

  if (path === '/admin/analytics/overview' && method === 'GET') {
    const { getAnalyticsOverview } = await import('../handlers/admin-handlers.js');
    return await getAnalyticsOverview(request, env, allHeaders);
  }

  if (path === '/admin/analytics/activity' && method === 'GET') {
    const { getRecentActivity } = await import('../handlers/admin-handlers.js');
    return await getRecentActivity(request, env, allHeaders);
  }

  if (path === '/admin/billing/transactions' && method === 'GET') {
    const { listPaymentTransactions } = await import('../handlers/admin-billing-handlers.js');
    return await listPaymentTransactions(request, env, allHeaders);
  }

  if (path.match(/^\/admin\/billing\/transactions\/[^\/]+$/) && method === 'GET') {
    const transactionId = path.split('/')[4];
    const { getTransactionDetails } = await import('../handlers/admin-billing-handlers.js');
    return await getTransactionDetails(request, env, allHeaders, transactionId);
  }

  if (path === '/admin/billing/subscriptions/stats' && method === 'GET') {
    const { getSubscriptionStats } = await import('../handlers/admin-billing-handlers.js');
    return await getSubscriptionStats(request, env, allHeaders);
  }

  if (path === '/admin/billing/revenue' && method === 'GET') {
    const { getRevenueAnalytics } = await import('../handlers/admin-billing-handlers.js');
    return await getRevenueAnalytics(request, env, allHeaders);
  }

  if (path === '/admin/billing/failed-payments' && method === 'GET') {
    const { getFailedPayments } = await import('../handlers/admin-billing-handlers.js');
    return await getFailedPayments(request, env, allHeaders);
  }

  if (path === '/admin/billing/refund' && method === 'POST') {
    const { issueRefund } = await import('../handlers/admin-billing-handlers.js');
    return await issueRefund(request, env, allHeaders);
  }

  if (path === '/admin/billing/cancel-subscription' && method === 'POST') {
    const { cancelSubscription } = await import('../handlers/admin-billing-handlers.js');
    return await cancelSubscription(request, env, allHeaders);
  }

  // Payment routes
  if (path === '/payments/create-checkout-session' && method === 'POST') {
    const { createCheckoutSession } = await import('../handlers/payment-handlers.js');
    return await createCheckoutSession(request, env, allHeaders);
  }

  if (path === '/payments/create-payment-intent' && method === 'POST') {
    const { createPaymentIntent } = await import('../handlers/payment-handlers.js');
    return await createPaymentIntent(request, env, allHeaders);
  }

  if (path === '/payments/create-portal-session' && method === 'POST') {
    const { createPortalSession } = await import('../handlers/payment-handlers.js');
    return await createPortalSession(request, env, allHeaders);
  }

  if (path === '/payments/subscription' && method === 'GET') {
    const { getSubscription } = await import('../handlers/payment-handlers.js');
    return await getSubscription(request, env, allHeaders);
  }

  if (path === '/payments/history' && method === 'GET') {
    const { getPaymentHistory } = await import('../handlers/payment-handlers.js');
    return await getPaymentHistory(request, env, allHeaders);
  }

  if (path === '/payments/can-upload' && method === 'GET') {
    const { checkCanUpload } = await import('../handlers/payment-handlers.js');
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

  // ========================================================================
  // SALES & ROYALTY TRACKING ROUTES (Issue #48)
  // ========================================================================

  // GET /manuscripts/:id/sales - Get sales data for manuscript
  if (path.match(/^\/manuscripts\/[^/]+\/sales$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await salesTrackingHandlers.handleGetManuscriptSales(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/royalties - Get royalty data for manuscript
  if (path.match(/^\/manuscripts\/[^/]+\/royalties$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await salesTrackingHandlers.handleGetManuscriptRoyalties(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/bestseller-rank - Get bestseller rank history
  if (path.match(/^\/manuscripts\/[^/]+\/bestseller-rank$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await salesTrackingHandlers.handleGetBestsellerRank(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/sales/export - Export sales data as CSV
  if (path.match(/^\/manuscripts\/[^/]+\/sales\/export$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await salesTrackingHandlers.handleExportSales(request, env), rateLimitHeaders);
  }

  // GET /dashboard/sales-overview - Multi-book sales dashboard
  if (path === '/dashboard/sales-overview' && method === 'GET') {
    return addCorsHeaders(await salesTrackingHandlers.handleSalesOverview(request, env), rateLimitHeaders);
  }

  // GET /dashboard/royalty-summary - Royalty summary across all books
  if (path === '/dashboard/royalty-summary' && method === 'GET') {
    return addCorsHeaders(await salesTrackingHandlers.handleRoyaltySummary(request, env), rateLimitHeaders);
  }

  // GET /platforms/connections - Get connected platforms
  if (path === '/platforms/connections' && method === 'GET') {
    return addCorsHeaders(await salesTrackingHandlers.handleGetPlatformConnections(request, env), rateLimitHeaders);
  }

  // POST /platforms/:platform/connect - Connect publishing platform
  if (path.match(/^\/platforms\/[^/]+\/connect$/) && method === 'POST') {
    const platform = path.split('/')[2];
    request.params = { platform };
    return addCorsHeaders(await salesTrackingHandlers.handleConnectPlatform(request, env), rateLimitHeaders);
  }

  // POST /platforms/:platform/sync - Trigger platform data sync
  if (path.match(/^\/platforms\/[^/]+\/sync$/) && method === 'POST') {
    const platform = path.split('/')[2];
    request.params = { platform };
    return addCorsHeaders(await salesTrackingHandlers.handleSyncPlatform(request, env), rateLimitHeaders);
  }

  // POST /sales/seed - Seed sample sales data (development/testing)
  if (path === '/sales/seed' && method === 'POST') {
    return addCorsHeaders(await salesTrackingHandlers.handleSeedSalesData(request, env), rateLimitHeaders);
  }

  // ==================== RIGHTS MANAGEMENT ROUTES (Issue #56) ====================

  // GET /manuscripts/:id/rights - Get all rights grants for a manuscript
  if (path.match(/^\/manuscripts\/[^/]+\/rights$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await rightsManagementHandlers.handleGetManuscriptRights(request, env), rateLimitHeaders);
  }

  // POST /manuscripts/:id/rights - Create new rights grant
  if (path.match(/^\/manuscripts\/[^/]+\/rights$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await rightsManagementHandlers.handleCreateRights(request, env), rateLimitHeaders);
  }

  // PATCH /manuscripts/:id/rights/:rightId - Update rights grant
  if (path.match(/^\/manuscripts\/[^/]+\/rights\/[^/]+$/) && method === 'PATCH') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const rightId = parts[4];
    request.params = { manuscriptId, rightId };
    return addCorsHeaders(await rightsManagementHandlers.handleUpdateRights(request, env), rateLimitHeaders);
  }

  // DELETE /manuscripts/:id/rights/:rightId - Delete rights grant
  if (path.match(/^\/manuscripts\/[^/]+\/rights\/[^/]+$/) && method === 'DELETE') {
    const parts = path.split('/');
    const manuscriptId = parts[2];
    const rightId = parts[4];
    request.params = { manuscriptId, rightId };
    return addCorsHeaders(await rightsManagementHandlers.handleDeleteRights(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/publication-history - Get publication history
  if (path.match(/^\/manuscripts\/[^/]+\/publication-history$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await rightsManagementHandlers.handleGetPublicationHistory(request, env), rateLimitHeaders);
  }

  // POST /manuscripts/:id/publication-history - Add publication history entry
  if (path.match(/^\/manuscripts\/[^/]+\/publication-history$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await rightsManagementHandlers.handleAddPublicationHistory(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/rights/available - Get available rights for manuscript
  if (path.match(/^\/manuscripts\/[^/]+\/rights\/available$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await rightsManagementHandlers.handleGetAvailableRights(request, env), rateLimitHeaders);
  }

  // GET /rights/expiring-soon - Get rights expiring in next 90 days
  if (path === '/rights/expiring-soon' && method === 'GET') {
    return addCorsHeaders(await rightsManagementHandlers.handleGetExpiringRights(request, env), rateLimitHeaders);
  }

  // GET /rights/templates - Get rights templates
  if (path === '/rights/templates' && method === 'GET') {
    return addCorsHeaders(await rightsManagementHandlers.handleGetRightsTemplates(request, env), rateLimitHeaders);
  }

  // POST /manuscripts/:id/rights/check-conflicts - Check for rights conflicts
  if (path.match(/^\/manuscripts\/[^/]+\/rights\/check-conflicts$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await rightsManagementHandlers.handleCheckRightsConflicts(request, env), rateLimitHeaders);
  }

  // ==================== AI CHAT ASSISTANT ROUTES (Issue #59) ====================

  // POST /chat/:platform - Send message to platform-specific AI agent
  if (path.match(/^\/chat\/[^/]+$/) && method === 'POST') {
    const platform = path.split('/')[2];
    request.params = { platform };
    return addCorsHeaders(await aiChatHandlers.handleChatMessage(request, env), rateLimitHeaders);
  }

  // GET /chat/:platform/history - Get conversation history
  if (path.match(/^\/chat\/[^/]+\/history$/) && method === 'GET') {
    const platform = path.split('/')[2];
    request.params = { platform };
    return addCorsHeaders(await aiChatHandlers.handleGetChatHistory(request, env), rateLimitHeaders);
  }

  // POST /workflows/:platform/start - Start a workflow for user
  if (path.match(/^\/workflows\/[^/]+\/start$/) && method === 'POST') {
    const platform = path.split('/')[2];
    request.params = { platform };
    return addCorsHeaders(await aiChatHandlers.handleStartWorkflow(request, env), rateLimitHeaders);
  }

  // GET /workflows/:platform - Get workflow definition for platform
  if (path.match(/^\/workflows\/[^/]+$/) && method === 'GET') {
    const platform = path.split('/')[2];
    request.params = { platform };
    return addCorsHeaders(await aiChatHandlers.handleGetWorkflow(request, env), rateLimitHeaders);
  }

  // PATCH /workflows/:platform/progress - Update user workflow progress
  if (path.match(/^\/workflows\/[^/]+\/progress$/) && method === 'PATCH') {
    const platform = path.split('/')[2];
    request.params = { platform };
    return addCorsHeaders(await aiChatHandlers.handleUpdateWorkflowProgress(request, env), rateLimitHeaders);
  }

  // GET /workflows/user - Get all user workflows
  if (path === '/workflows/user' && method === 'GET') {
    return addCorsHeaders(await aiChatHandlers.handleGetUserWorkflows(request, env), rateLimitHeaders);
  }

  // GET /agent/:platform/config - Get agent configuration
  if (path.match(/^\/agent\/[^/]+\/config$/) && method === 'GET') {
    const platform = path.split('/')[2];
    request.params = { platform };
    return addCorsHeaders(await aiChatHandlers.handleGetAgentConfig(request, env), rateLimitHeaders);
  }

  // POST /docs/crawl/:platform - Trigger documentation crawl (for scheduled cron)
  if (path.match(/^\/docs\/crawl\/[^/]+$/) && method === 'POST') {
    const platform = path.split('/')[2];
    request.params = { platform };
    return addCorsHeaders(await aiChatHandlers.handleCrawlPlatformDocs(request, env), rateLimitHeaders);
  }

  // ============================================================================
  // Competitive Analysis & Market Positioning Routes (Issue #57)
  // Comp titles, marketing hooks, author platform, market reports
  // ============================================================================

  // POST /manuscripts/:id/comp-titles/analyze - AI analyze comp titles
  if (path.match(/^\/manuscripts\/[^/]+\/comp-titles\/analyze$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await competitiveAnalysisHandlers.handleAnalyzeCompTitles(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/comp-titles - Get comp titles for manuscript
  if (path.match(/^\/manuscripts\/[^/]+\/comp-titles$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await competitiveAnalysisHandlers.handleGetCompTitles(request, env), rateLimitHeaders);
  }

  // POST /manuscripts/:id/comp-titles - Add manual comp title
  if (path.match(/^\/manuscripts\/[^/]+\/comp-titles$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await competitiveAnalysisHandlers.handleAddCompTitle(request, env), rateLimitHeaders);
  }

  // DELETE /comp-titles/:id - Delete comp title
  if (path.match(/^\/comp-titles\/[^/]+$/) && method === 'DELETE') {
    const compId = path.split('/')[2];
    request.params = { compId };
    return addCorsHeaders(await competitiveAnalysisHandlers.handleDeleteCompTitle(request, env), rateLimitHeaders);
  }

  // POST /manuscripts/:id/marketing-hooks/generate - Generate marketing hooks
  if (path.match(/^\/manuscripts\/[^/]+\/marketing-hooks\/generate$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await competitiveAnalysisHandlers.handleGenerateMarketingHooks(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/marketing-hooks - Get marketing hooks
  if (path.match(/^\/manuscripts\/[^/]+\/marketing-hooks$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await competitiveAnalysisHandlers.handleGetMarketingHooks(request, env), rateLimitHeaders);
  }

  // PATCH /marketing-hooks/:id/mark-used - Mark hook as used
  if (path.match(/^\/marketing-hooks\/[^/]+\/mark-used$/) && method === 'PATCH') {
    const hookId = path.split('/')[2];
    request.params = { hookId };
    return addCorsHeaders(await competitiveAnalysisHandlers.handleMarkHookUsed(request, env), rateLimitHeaders);
  }

  // GET /author/platform - Get author platform
  if (path === '/author/platform' && method === 'GET') {
    return addCorsHeaders(await competitiveAnalysisHandlers.handleGetAuthorPlatform(request, env), rateLimitHeaders);
  }

  // POST /author/platform - Add author platform
  if (path === '/author/platform' && method === 'POST') {
    return addCorsHeaders(await competitiveAnalysisHandlers.handleAddAuthorPlatform(request, env), rateLimitHeaders);
  }

  // PATCH /author/platform/:id - Update author platform
  if (path.match(/^\/author\/platform\/[^/]+$/) && method === 'PATCH') {
    const platformId = path.split('/')[3];
    request.params = { platformId };
    return addCorsHeaders(await competitiveAnalysisHandlers.handleUpdateAuthorPlatform(request, env), rateLimitHeaders);
  }

  // POST /author/platform/calculate-score - Calculate platform score
  if (path === '/author/platform/calculate-score' && method === 'POST') {
    return addCorsHeaders(await competitiveAnalysisHandlers.handleCalculatePlatformScore(request, env), rateLimitHeaders);
  }

  // POST /manuscripts/:id/market-report/generate - Generate market report
  if (path.match(/^\/manuscripts\/[^/]+\/market-report\/generate$/) && method === 'POST') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await competitiveAnalysisHandlers.handleGenerateMarketReport(request, env), rateLimitHeaders);
  }

  // GET /manuscripts/:id/market-report - Get latest market report
  if (path.match(/^\/manuscripts\/[^/]+\/market-report$/) && method === 'GET') {
    const manuscriptId = path.split('/')[2];
    request.params = { manuscriptId };
    return addCorsHeaders(await competitiveAnalysisHandlers.handleGetMarketReport(request, env), rateLimitHeaders);
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
      dashboard: 'Visit https://selfpubhub.co for the dashboard'
    }), {
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }

  // No route matched
  return null;
}
