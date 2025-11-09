/**
 * Queue Consumer for Manuscript Analysis (Phase C)
 *
 * This worker consumes messages from the ANALYSIS_QUEUE and orchestrates
 * the full manuscript analysis pipeline:
 * 1. Developmental Analysis (plot, characters, pacing, themes)
 * 2. Line Editing Analysis (sentence-level improvements)
 * 3. Copy Editing Analysis (grammar, spelling, style guide)
 *
 * Status updates are written to R2 throughout the process so the frontend
 * can poll for progress. The manuscript status is updated in the database
 * when analysis completes.
 */

import { DevelopmentalAgent } from '../agents/developmental-agent.js';
import { LineEditingAgent } from '../agents/line-editing-agent.js';
import { CopyEditingAgent } from '../agents/copy-editing-agent.js';
import { sendAnalysisCompleteEmail } from '../services/email-service.js';

export default {
  /**
   * Queue message handler
   *
   * Message format:
   * {
   *   manuscriptKey: string,    // R2 key for manuscript file
   *   genre: string,            // Genre for analysis context
   *   styleGuide: string,       // Style guide (chicago, ap, etc.)
   *   reportId: string          // Short ID for status tracking
   * }
   */
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const { manuscriptKey, genre, styleGuide, reportId } = message.body;

        console.log(`[Queue Consumer] Processing analysis for ${manuscriptKey}`);
        console.log(`[Queue Consumer] Report ID: ${reportId}, Genre: ${genre}, Style: ${styleGuide}`);

        // Update status: Processing started
        await updateStatus(env, reportId, {
          status: 'processing',
          progress: 0,
          message: 'Starting analysis...',
          currentStep: 'initialization',
          timestamp: new Date().toISOString()
        });

        // Get manuscript ID and user ID from database for status updates and cost tracking
        const manuscriptId = await getManuscriptIdFromKey(env, manuscriptKey);

        // Extract userId from manuscriptKey (format: userId/manuscriptId/filename)
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

        console.log('[Queue Consumer] Starting developmental analysis...');
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

        console.log('[Queue Consumer] Developmental analysis complete');

        await updateStatus(env, reportId, {
          status: 'processing',
          progress: 33,
          message: 'Developmental analysis complete. Starting line editing...',
          currentStep: 'line-editing',
          timestamp: new Date().toISOString()
        });

        // Step 2: Line Editing Analysis (33% of work)
        console.log('[Queue Consumer] Starting line editing analysis...');
        const lineAgent = new LineEditingAgent(env);

        const lineAnalysis = await runWithProgress(
          lineAgent.analyze(manuscriptKey, genre, userId, manuscriptId),
          env,
          reportId,
          33, // start progress
          63, // end progress
          'Reviewing prose quality and sentence structure...',
          'line-editing'
        );

        console.log('[Queue Consumer] Line editing analysis complete');

        await updateStatus(env, reportId, {
          status: 'processing',
          progress: 66,
          message: 'Line editing complete. Starting copy editing...',
          currentStep: 'copy-editing',
          timestamp: new Date().toISOString()
        });

        // Step 3: Copy Editing Analysis (33% of work)
        console.log('[Queue Consumer] Starting copy editing analysis...');
        const copyAgent = new CopyEditingAgent(env);

        const copyAnalysis = await runWithProgress(
          copyAgent.analyze(manuscriptKey, styleGuide, userId, manuscriptId),
          env,
          reportId,
          66, // start progress
          98, // end progress
          'Checking grammar, punctuation, and style consistency...',
          'copy-editing'
        );

        console.log('[Queue Consumer] Copy editing analysis complete');

        // Update status: Complete
        await updateStatus(env, reportId, {
          status: 'complete',
          progress: 100,
          message: 'Analysis complete!',
          currentStep: 'complete',
          timestamp: new Date().toISOString(),
          completedAt: new Date().toISOString()
        });

        // Update database status to 'complete'
        if (manuscriptId) {
          await env.DB.prepare(
            'UPDATE manuscripts SET status = ?, updated_at = ? WHERE id = ?'
          ).bind('complete', Math.floor(Date.now() / 1000), manuscriptId).run();
        }

        console.log(`[Queue Consumer] Analysis complete for ${reportId}`);

        // Send analysis complete email
        try {
          const manuscript = await env.DB.prepare(
            'SELECT m.title, u.email, u.full_name FROM manuscripts m JOIN users u ON m.user_id = u.id WHERE m.id = ?'
          ).bind(manuscriptId).first();

          if (manuscript) {
            await sendAnalysisCompleteEmail({
              to: manuscript.email,
              userName: manuscript.full_name || 'Author',
              manuscriptTitle: manuscript.title,
              reportId,
              env
            });
            console.log(`[Queue Consumer] Analysis complete email sent to ${manuscript.email}`);
          }
        } catch (emailError) {
          console.error(`[Queue Consumer] Failed to send analysis complete email:`, emailError);
          // Don't fail the analysis if email fails
        }

        // Phase D: Automatically queue asset generation after analysis completes
        console.log(`[Queue Consumer] Queueing asset generation for ${reportId}...`);
        try {
          await env.ASSET_QUEUE.send({
            manuscriptKey,
            reportId,
            genre: genre || 'general',
            authorData: {}, // TODO: Extract from manuscript metadata if available
            seriesData: {}  // TODO: Extract from manuscript metadata if available
          });

          console.log(`[Queue Consumer] Asset generation queued successfully for ${reportId}`);
        } catch (assetQueueError) {
          console.error(`[Queue Consumer] Failed to queue asset generation:`, assetQueueError);
          // Don't fail the analysis if asset queueing fails - analysis still succeeded
        }

        // Acknowledge successful processing
        message.ack();

      } catch (error) {
        console.error('[Queue Consumer] Error processing message:', error);
        console.error('[Queue Consumer] Error stack:', error.stack);

        // Update status: Failed
        const { reportId, manuscriptKey } = message.body;
        if (reportId) {
          await updateStatus(env, reportId, {
            status: 'failed',
            progress: 0,
            message: `Analysis failed: ${error.message}`,
            currentStep: 'failed',
            error: error.message,
            errorStack: error.stack,
            timestamp: new Date().toISOString()
          }).catch(statusError => {
            console.error('[Queue Consumer] Failed to update error status:', statusError);
          });
        }

        // Update database status to 'failed'
        const manuscriptId = await getManuscriptIdFromKey(env, manuscriptKey);
        if (manuscriptId) {
          await env.DB.prepare(
            'UPDATE manuscripts SET status = ?, updated_at = ? WHERE id = ?'
          ).bind('failed', Math.floor(Date.now() / 1000), manuscriptId).run();
        }

        // Retry the message (Cloudflare will automatically retry based on queue config)
        message.retry();
      }
    }
  }
};

/**
 * Run analysis with progress updates by actively polling
 */
async function runWithProgress(analysisPromise, env, reportId, startProgress, endProgress, message, currentStep) {
  const startTime = Date.now();
  let completed = false;
  let currentProgress = startProgress;

  // Start the analysis
  const analysisTask = analysisPromise.then(result => {
    completed = true;
    return result;
  });

  // Poll for progress updates every 2 seconds
  const progressTask = (async () => {
    while (!completed) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!completed) {
        // Increment progress gradually
        currentProgress = Math.min(currentProgress + 2, endProgress - 1);
        console.log(`[Queue Consumer] Progress update: ${currentProgress}%`);

        await updateStatus(env, reportId, {
          status: 'processing',
          progress: currentProgress,
          message,
          currentStep,
          timestamp: new Date().toISOString()
        });
      }
    }
  })();

  // Wait for analysis to complete
  const result = await analysisTask;

  // Signal progress updater to stop and wait a bit for it to finish
  completed = true;
  await new Promise(resolve => setTimeout(resolve, 100));

  return result;
}

/**
 * Update status in R2 for frontend polling
 */
async function updateStatus(env, reportId, statusData) {
  try {
    await env.R2.getBucket('manuscripts_raw').put(
      `status:${reportId}`,
      JSON.stringify(statusData),
      {
        expirationTtl: 60 * 60 * 24 * 7, // 7 days
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );
    console.log(`[Queue Consumer] Status updated for ${reportId}: ${statusData.message}`);
  } catch (error) {
    console.error('[Queue Consumer] Failed to update status:', error);
    // Don't throw - status update failure shouldn't fail the analysis
  }
}

/**
 * Get manuscript ID from R2 key for database updates
 */
async function getManuscriptIdFromKey(env, manuscriptKey) {
  try {
    // manuscriptKey format: userId/manuscriptId/timestamp_filename
    // Extract manuscriptId from the path
    const parts = manuscriptKey.split('/');
    if (parts.length >= 2) {
      return parts[1]; // manuscriptId
    }

    // Fallback: Query database by r2_key
    const { results } = await env.DB.prepare(
      'SELECT id FROM manuscripts WHERE r2_key = ? LIMIT 1'
    ).bind(manuscriptKey).all();

    return results.length > 0 ? results[0].id : null;
  } catch (error) {
    console.error('[Queue Consumer] Failed to get manuscript ID:', error);
    return null;
  }
}
