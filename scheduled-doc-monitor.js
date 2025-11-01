/**
 * Scheduled Documentation Monitor (MAN-50)
 *
 * Cloudflare Cron job that runs daily to monitor platform documentation changes
 * Schedule: Daily at 2 AM UTC (0 2 * * *)
 */

import { fetchAllPlatformDocs, getLatestDocs } from './doc-crawler.js';
import { detectChanges, summarizeChanges, extractChangeExcerpts, areChangesSignificant } from './change-detector.js';
import { analyzeChanges } from './change-analyzer.js';
import { performKnowledgeUpdate } from './knowledge-updater.js';
import { notifyUsers } from './user-notifier.js';

/**
 * Process documentation updates for a single platform
 *
 * @param {string} platformId - Platform identifier
 * @param {Object} platformDocs - Documentation fetched by crawler
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<Object>} - Processing summary
 */
async function processPlatformDocs(platformId, platformDocs, env) {
  const summary = {
    platformId,
    timestamp: Date.now(),
    success: false,
    hasChanges: false,
    changesSummary: null,
    analysis: null,
    knowledgeUpdate: null,
    notificationsSent: 0,
    error: null,
  };

  try {
    // Get platform info
    const platform = await env.DB.prepare(
      'SELECT * FROM monitored_platforms WHERE id = ?'
    ).bind(platformId).first();

    if (!platform) {
      summary.error = 'Platform not found in database';
      return summary;
    }

    console.log(`\n[DocMonitor] Processing ${platform.name}...`);

    // Check if fetch was successful
    if (platformDocs.error) {
      summary.error = platformDocs.error;
      return summary;
    }

    // Get latest stored documentation
    const latestDocs = await getLatestDocs(platformId, env);

    if (!latestDocs) {
      // First time crawling this platform
      console.log(`[DocMonitor] First crawl for ${platform.name}, storing initial version`);

      const knowledgeUpdate = await performKnowledgeUpdate(
        platformId,
        platform.name,
        platformDocs,
        null, // No analysis for initial version
        env
      );

      summary.success = true;
      summary.hasChanges = false;
      summary.knowledgeUpdate = knowledgeUpdate;
      return summary;
    }

    // Check if content actually changed
    if (latestDocs.content_hash === platformDocs.hash) {
      console.log(`[DocMonitor] No changes detected for ${platform.name}`);
      summary.success = true;
      summary.hasChanges = false;
      return summary;
    }

    // Detect changes
    console.log(`[DocMonitor] Changes detected for ${platform.name}, analyzing...`);
    const changes = detectChanges(latestDocs.content, platformDocs.content);
    const changesSummary = summarizeChanges(changes);
    summary.changesSummary = changesSummary;

    console.log(`[DocMonitor] ${platform.name} changes: ${changesSummary.summary}`);

    // Check if changes are significant enough to analyze
    if (!areChangesSignificant(changes)) {
      console.log(`[DocMonitor] Changes not significant enough for analysis, storing without notification`);

      const knowledgeUpdate = await performKnowledgeUpdate(
        platformId,
        platform.name,
        platformDocs,
        { overallCriticality: 'MINOR', summary: changesSummary.summary },
        env
      );

      summary.success = true;
      summary.hasChanges = true;
      summary.knowledgeUpdate = knowledgeUpdate;
      return summary;
    }

    // Extract change excerpts for Claude analysis
    const changeExcerpts = extractChangeExcerpts(changes, 10);

    // Analyze changes with Claude
    const analysis = await analyzeChanges(
      platformId,
      platform.name,
      changeExcerpts,
      env.ANTHROPIC_API_KEY
    );

    summary.analysis = {
      overallCriticality: analysis.overallCriticality,
      changeCount: analysis.changes.length,
      summary: analysis.summary,
    };

    console.log(`[DocMonitor] Analysis complete: ${analysis.overallCriticality} - ${analysis.summary}`);

    // Update knowledge base
    const knowledgeUpdate = await performKnowledgeUpdate(
      platformId,
      platform.name,
      platformDocs,
      analysis,
      env
    );

    summary.knowledgeUpdate = knowledgeUpdate;

    // Notify users if critical or important
    if (analysis.overallCriticality === 'CRITICAL' || analysis.overallCriticality === 'IMPORTANT') {
      const notificationResult = await notifyUsers(
        platformId,
        platform.name,
        knowledgeUpdate.docVersion,
        analysis,
        env
      );

      summary.notificationsSent = notificationResult.notificationsSent;
      console.log(`[DocMonitor] Sent ${notificationResult.notificationsSent} notifications for ${platform.name}`);
    }

    summary.success = true;
    summary.hasChanges = true;

    return summary;
  } catch (error) {
    console.error(`[DocMonitor] Error processing ${platformId}:`, error);
    summary.error = error.message;
    return summary;
  }
}

/**
 * Main scheduled handler - runs daily
 *
 * @param {Event} event - Cloudflare scheduled event
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} ctx - Execution context
 */
export async function handleScheduled(event, env, ctx) {
  const startTime = Date.now();

  console.log('\n=================================================');
  console.log('📚 PLATFORM DOCUMENTATION MONITOR - DAILY RUN');
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log('=================================================\n');

  const results = {
    timestamp: startTime,
    duration: 0,
    platformsProcessed: 0,
    platformsWithChanges: 0,
    totalNotifications: 0,
    errors: [],
    platformResults: {},
  };

  try {
    // Fetch documentation for all enabled platforms
    console.log('[DocMonitor] Fetching documentation from all platforms...\n');
    const allDocs = await fetchAllPlatformDocs(env);

    console.log(`[DocMonitor] Fetched documentation from ${allDocs.size} platforms\n`);

    // Process each platform
    for (const [platformId, docs] of allDocs.entries()) {
      const platformSummary = await processPlatformDocs(platformId, docs, env);

      results.platformResults[platformId] = platformSummary;
      results.platformsProcessed++;

      if (platformSummary.hasChanges) {
        results.platformsWithChanges++;
      }

      if (platformSummary.notificationsSent) {
        results.totalNotifications += platformSummary.notificationsSent;
      }

      if (platformSummary.error) {
        results.errors.push({
          platform: platformId,
          error: platformSummary.error,
        });
      }
    }

    results.duration = Date.now() - startTime;

    // Log final summary
    console.log('\n=================================================');
    console.log('📊 DOCUMENTATION MONITOR - RUN COMPLETE');
    console.log(`   Duration: ${(results.duration / 1000).toFixed(2)}s`);
    console.log(`   Platforms Processed: ${results.platformsProcessed}`);
    console.log(`   Platforms with Changes: ${results.platformsWithChanges}`);
    console.log(`   Total Notifications Sent: ${results.totalNotifications}`);
    console.log(`   Errors: ${results.errors.length}`);
    console.log('=================================================\n');

    if (results.errors.length > 0) {
      console.error('Errors during run:');
      results.errors.forEach(e => {
        console.error(`  - ${e.platform}: ${e.error}`);
      });
    }

    return results;
  } catch (error) {
    console.error('[DocMonitor] Critical error during scheduled run:', error);
    results.duration = Date.now() - startTime;
    results.errors.push({
      platform: 'system',
      error: error.message,
    });
    return results;
  }
}

export default {
  handleScheduled,
};
