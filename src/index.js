/**
 * Main entry point for the Manuscript Platform Worker
 * Orchestrates middleware, routing, and request handling
 */

import { getAllHeaders, addCorsHeaders, handlePreflight } from './middleware/cors.js';
import { applyRateLimiting } from './middleware/rate-limiter.js';
import { handleError } from './middleware/error-handler.js';
import { routeRequest } from './router/router.js';
import queueConsumer from '../queue-consumer.js';
import assetConsumer from '../asset-generation-consumer.js';

// Import all legacy handlers from worker.js that still need to be accessible
// These are exported from worker.js and re-imported here temporarily
// TODO: Refactor these into handler modules in future iterations
import * as legacyWorker from '../worker.js';

export default {
  /**
   * Main fetch handler for HTTP requests
   */
  async fetch(request, env, ctx) {
    console.log('Incoming request:', request.method, request.url);

    try {
      // Handle CORS preflight requests
      const preflightResponse = handlePreflight(request);
      if (preflightResponse) {
        return preflightResponse;
      }

      const url = new URL(request.url);
      const path = url.pathname;

      // Track request start time for monitoring
      const requestStartTime = Date.now();

      // Apply rate limiting
      const rateLimitResult = await applyRateLimiting(request, env, path);
      if (rateLimitResult.response) {
        // Rate limit exceeded
        return addCorsHeaders(rateLimitResult.response, request, rateLimitResult.headers);
      }

      // Create wrapper for addCorsHeaders that includes request context
      const addCorsHeadersWithContext = (response, extraHeaders = {}) => {
        return addCorsHeaders(response, request, extraHeaders);
      };

      // Get all headers for legacy handlers
      const allHeaders = getAllHeaders(request);

      // Prepare legacy handlers object
      const legacyHandlers = {
        allHeaders,
        handleManuscriptUpload: legacyWorker.handleManuscriptUpload,
        handleMarketingUpload: legacyWorker.handleMarketingUpload,
        handleFileGet: legacyWorker.handleFileGet,
        handleFileList: legacyWorker.handleFileList,
        handleFileDelete: legacyWorker.handleFileDelete,
        handleDevelopmentalAnalysis: legacyWorker.handleDevelopmentalAnalysis,
        handleLineEditingAnalysis: legacyWorker.handleLineEditingAnalysis,
        handleCopyEditingAnalysis: legacyWorker.handleCopyEditingAnalysis,
        handleStartAnalysis: legacyWorker.handleStartAnalysis,
        handleAnalysisStatus: legacyWorker.handleAnalysisStatus,
        handleAssetStatus: legacyWorker.handleAssetStatus,
        handleDMCASubmission: legacyWorker.handleDMCASubmission,
        handleGenerateAssets: legacyWorker.handleGenerateAssets,
        handleGetAssets: legacyWorker.handleGetAssets,
        handleFormatManuscript: legacyWorker.handleFormatManuscript,
        handleDownloadFormatted: legacyWorker.handleDownloadFormatted,
        handleMarketAnalysis: legacyWorker.handleMarketAnalysis,
        handleGetMarketAnalysis: legacyWorker.handleGetMarketAnalysis,
        handleGenerateSocialMedia: legacyWorker.handleGenerateSocialMedia,
        handleGetSocialMedia: legacyWorker.handleGetSocialMedia,
        handleGetAnalysis: legacyWorker.handleGetAnalysis,
        handleGetAnalysisResults: legacyWorker.handleGetAnalysisResults,
        handleGenerateReport: legacyWorker.handleGenerateReport,
        handleGenerateAnnotatedManuscript: legacyWorker.handleGenerateAnnotatedManuscript,
        handleDebugReportId: legacyWorker.handleDebugReportId,
        handleRoot: legacyWorker.handleRoot,
      };

      // Route the request
      const response = await routeRequest(
        request,
        env,
        addCorsHeadersWithContext,
        rateLimitResult.headers,
        legacyHandlers
      );

      if (response) {
        return response;
      }

      // No route matched - return 404
      const notFoundResponse = new Response(
        JSON.stringify({ error: 'Not Found', path }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      return addCorsHeaders(notFoundResponse, request, rateLimitResult.headers);

    } catch (error) {
      // Global error handler
      return await handleError(error, request, env);
    }
  },

  /**
   * Queue consumer handler for processing async jobs
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
        // Acknowledge messages from unknown queues to prevent infinite retries
        for (const message of batch.messages) {
          message.ack();
        }
      }
    } catch (error) {
      console.error(`[Queue Router] Error processing queue ${queueName}:`, error);
      // Let messages retry by not acknowledging them
      throw error;
    }
  },

  /**
   * Scheduled handler for CRON jobs
   */
  async scheduled(event, env, ctx) {
    console.log('[Scheduled] CRON trigger fired:', event.cron);

    try {
      // Import and run backup handler
      const { handleScheduledBackup } = await import('../backup-worker.js');
      const result = await handleScheduledBackup(env);

      if (result.success) {
        console.log('[Scheduled] Backup completed successfully:', result.filename);
      } else {
        console.error('[Scheduled] Backup failed:', result.error);
      }
    } catch (error) {
      console.error('[Scheduled] CRON handler error:', error);
    }
  },
};
