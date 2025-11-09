/**
 * Analysis Queue Worker (Redis-based)
 *
 * Continuously polls the Redis queue for manuscript analysis jobs
 * Replaces Cloudflare Workers queue consumer
 *
 * Run with: node src/workers/analysis-queue-worker.js
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createDatabaseAdapter } from '../adapters/database-adapter.js';
import { createStorageAdapter } from '../adapters/storage-adapter.js';
import { createQueueService } from '../services/queue-service.js';
import Redis from 'ioredis';

import { DevelopmentalAgent } from '../agents/developmental-agent.js';
import { LineEditingAgent } from '../agents/line-editing-agent.js';
import { CopyEditingAgent } from '../agents/copy-editing-agent.js';
import { sendAnalysisCompleteEmail } from '../services/email-service.js';

// Initialize services
let db, storage, queue, redis;
let isShuttingDown = false;

async function init() {
  console.log('[Analysis Worker] Initializing...');

  // Create database adapter
  db = createDatabaseAdapter(process.env);
  console.log('[Analysis Worker] ✓ Database connected');

  // Create storage adapter
  storage = createStorageAdapter(process.env);
  console.log('[Analysis Worker] ✓ Storage connected');

  // Create Redis client
  redis = new Redis(process.env.REDIS_URL);
  console.log('[Analysis Worker] ✓ Redis connected');

  // Create queue service
  queue = createQueueService(redis);
  console.log('[Analysis Worker] ✓ Queue service initialized');
}

async function processAnalysisJob(job) {
  const { manuscriptKey, genre, styleGuide, reportId } = job.data;

  console.log(`[Analysis Worker] Processing job ${job.id}`);
  console.log(`[Analysis Worker] Report ID: ${reportId}, Genre: ${genre}, Style: ${styleGuide}`);

  // Create env object (mimics Workers env)
  const env = {
    DB: db,
    R2: storage,
    REDIS: redis,
    QUEUE: queue,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  };

  try {
    // Update status: Processing started
    await updateStatus(env, reportId, {
      status: 'processing',
      progress: 0,
      message: 'Starting analysis...',
      currentStep: 'initialization',
      timestamp: new Date().toISOString()
    });

    // Get manuscript ID and user ID from database
    const manuscriptId = await getManuscriptIdFromKey(env, manuscriptKey);
    const userId = manuscriptKey.split('/')[0];

    // Update database status to 'analyzing'
    if (manuscriptId) {
      await env.DB.prepare(
        'UPDATE manuscripts SET status = ?, updated_at = ? WHERE id = ?'
      ).bind('analyzing', Math.floor(Date.now() / 1000), manuscriptId).run();
    }

    // Step 1: Developmental Analysis (33% of work)
    await updateStatus(env, reportId, {
      status: 'processing',
      progress: 5,
      message: 'Running developmental analysis...',
      currentStep: 'developmental',
      timestamp: new Date().toISOString()
    });

    console.log('[Analysis Worker] Starting developmental analysis...');
    const devAgent = new DevelopmentalAgent(env);

    const devAnalysis = await runWithProgress(
      devAgent.analyze(manuscriptKey, genre, userId, manuscriptId),
      env,
      reportId,
      5,  // start progress
      30, // end progress
      'Analyzing plot, characters, and pacing...',
      'developmental'
    );

    console.log('[Analysis Worker] Developmental analysis complete');

    // Step 2: Line Editing Analysis (33% of work)
    await updateStatus(env, reportId, {
      status: 'processing',
      progress: 35,
      message: 'Running line editing analysis...',
      currentStep: 'line-editing',
      timestamp: new Date().toISOString()
    });

    console.log('[Analysis Worker] Starting line editing analysis...');
    const lineAgent = new LineEditingAgent(env);

    const lineAnalysis = await runWithProgress(
      lineAgent.analyze(manuscriptKey, genre, userId, manuscriptId),
      env,
      reportId,
      35, // start progress
      65, // end progress
      'Analyzing prose and style...',
      'line-editing'
    );

    console.log('[Analysis Worker] Line editing analysis complete');

    // Step 3: Copy Editing Analysis (34% of work)
    await updateStatus(env, reportId, {
      status: 'processing',
      progress: 70,
      message: 'Running copy editing analysis...',
      currentStep: 'copy-editing',
      timestamp: new Date().toISOString()
    });

    console.log('[Analysis Worker] Starting copy editing analysis...');
    const copyAgent = new CopyEditingAgent(env);

    const copyAnalysis = await runWithProgress(
      copyAgent.analyze(manuscriptKey, genre, styleGuide || 'chicago', userId, manuscriptId),
      env,
      reportId,
      70, // start progress
      95, // end progress
      'Checking grammar, spelling, and style...',
      'copy-editing'
    );

    console.log('[Analysis Worker] Copy editing analysis complete');

    // Update status: Complete
    await updateStatus(env, reportId, {
      status: 'complete',
      progress: 100,
      message: 'Analysis complete!',
      currentStep: 'complete',
      timestamp: new Date().toISOString()
    });

    // Update database status to 'analyzed'
    if (manuscriptId) {
      await env.DB.prepare(
        'UPDATE manuscripts SET status = ?, updated_at = ? WHERE id = ?'
      ).bind('analyzed', Math.floor(Date.now() / 1000), manuscriptId).run();
    }

    // Send completion email
    try {
      await sendAnalysisCompleteEmail(env, userId, manuscriptId, reportId);
    } catch (emailError) {
      console.error('[Analysis Worker] Failed to send completion email:', emailError);
      // Don't fail the job if email fails
    }

    console.log(`[Analysis Worker] ✓ Job ${job.id} completed successfully`);

    // Mark job as completed
    await queue.completeJob('analysis', job.id, {
      devAnalysis,
      lineAnalysis,
      copyAnalysis
    });

  } catch (error) {
    console.error(`[Analysis Worker] ✗ Job ${job.id} failed:`, error);

    // Update status: Failed
    await updateStatus(env, reportId, {
      status: 'error',
      progress: 0,
      message: `Analysis failed: ${error.message}`,
      currentStep: 'error',
      timestamp: new Date().toISOString()
    }).catch(err => console.error('[Analysis Worker] Failed to update error status:', err));

    // Update database status to 'failed'
    const manuscriptId = await getManuscriptIdFromKey(env, manuscriptKey);
    if (manuscriptId) {
      await env.DB.prepare(
        'UPDATE manuscripts SET status = ?, updated_at = ? WHERE id = ?'
      ).bind('failed', Math.floor(Date.now() / 1000), manuscriptId).run();
    }

    // Mark job as failed (will retry or move to DLQ)
    await queue.failJob('analysis', job.id, error);
  }
}

async function pollQueue() {
  console.log('[Analysis Worker] Starting queue polling...');

  while (!isShuttingDown) {
    try {
      // Get next job (blocks for 5 seconds)
      const job = await queue.getNextJob('analysis', 5);

      if (job) {
        await processAnalysisJob(job);
      }
      // If no job, loop continues and polls again

    } catch (error) {
      console.error('[Analysis Worker] Queue polling error:', error);
      // Wait 5 seconds before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('[Analysis Worker] Polling stopped');
}

// Helper functions (from original queue-consumer.js)

async function updateStatus(env, reportId, statusData) {
  try {
    const mappedReportId = await env.R2.getBucket('manuscripts_raw').get(`report-id:${reportId}`);
    if (!mappedReportId) {
      console.error(`[Analysis Worker] Report ID ${reportId} not found in mapping`);
      return;
    }
    const rawBucket = env.R2.getBucket('manuscripts_raw');
    await rawBucket.put(
      `status:${reportId}`,
      JSON.stringify(statusData),
      { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
    );
  } catch (error) {
    console.error('[Analysis Worker] Failed to update status:', error);
  }
}

async function getManuscriptIdFromKey(env, manuscriptKey) {
  try {
    const parts = manuscriptKey.split('/');
    if (parts.length >= 2) {
      return parts[1]; // Format: userId/manuscriptId/filename
    }
    return null;
  } catch (error) {
    console.error('[Analysis Worker] Failed to extract manuscript ID:', error);
    return null;
  }
}

async function runWithProgress(promise, env, reportId, startProgress, endProgress, message, step) {
  // Update progress periodically
  const progressInterval = setInterval(async () => {
    const currentProgress = startProgress + Math.random() * (endProgress - startProgress - 5);
    await updateStatus(env, reportId, {
      status: 'processing',
      progress: Math.floor(currentProgress),
      message,
      currentStep: step,
      timestamp: new Date().toISOString()
    }).catch(() => {}); // Ignore errors in progress updates
  }, 3000); // Update every 3 seconds

  try {
    const result = await promise;
    clearInterval(progressInterval);
    return result;
  } catch (error) {
    clearInterval(progressInterval);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Analysis Worker] SIGTERM received, shutting down gracefully...');
  isShuttingDown = true;

  // Wait for current job to finish (max 60 seconds)
  await new Promise(resolve => setTimeout(resolve, 60000));

  // Close connections
  await redis.quit();
  await db.close();

  console.log('[Analysis Worker] Shutdown complete');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Analysis Worker] SIGINT received, shutting down gracefully...');
  isShuttingDown = true;

  // Wait for current job to finish (max 60 seconds)
  await new Promise(resolve => setTimeout(resolve, 60000));

  // Close connections
  await redis.quit();
  await db.close();

  console.log('[Analysis Worker] Shutdown complete');
  process.exit(0);
});

// Start worker
async function start() {
  try {
    await init();
    console.log('[Analysis Worker] ✓ Initialization complete');
    console.log('[Analysis Worker] Waiting for jobs...');
    await pollQueue();
  } catch (error) {
    console.error('[Analysis Worker] Fatal error:', error);
    process.exit(1);
  }
}

start();
