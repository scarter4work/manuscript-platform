/**
 * Main entry point for the Manuscript Platform Worker
 * Clean, modular architecture with middleware and routing
 */

import { getAllHeaders, addCorsHeaders as addCorsHeadersUtil, handlePreflight } from './middleware/cors.js';
import { applyRateLimiting } from './middleware/rate-limiter.js';
import { handleError } from './middleware/error-handler.js';
import { routeRequest } from './router/router.js';
import queueConsumer from '../queue-consumer.js';
import assetConsumer from '../asset-generation-consumer.js';

export default {
  /**
   * Main fetch handler for HTTP requests
   */
  async fetch(request, env, ctx) {
    console.log('Incoming request:', request.method, request.url);

    try {
      // Handle CORS preflight
      const preflightResponse = handlePreflight(request);
      if (preflightResponse) {
        return preflightResponse;
      }

      const url = new URL(request.url);
      const path = url.pathname;
      const requestStartTime = Date.now();

      // Get all headers (CORS + security)
      const allHeaders = getAllHeaders(request);

      // Apply rate limiting
      const rateLimitResult = await applyRateLimiting(request, env, path);
      if (rateLimitResult.response) {
        return addCorsHeadersUtil(rateLimitResult.response, request, rateLimitResult.headers);
      }

      // Helper to add CORS headers with context
      const addCorsHeaders = (response, extraHeaders = {}) => {
        return addCorsHeadersUtil(response, request, extraHeaders);
      };

      // Route the request
      const response = await routeRequest(
        request,
        env,
        addCorsHeaders,
        rateLimitResult.headers,
        allHeaders
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

      return addCorsHeaders(notFoundResponse, rateLimitResult.headers);

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
