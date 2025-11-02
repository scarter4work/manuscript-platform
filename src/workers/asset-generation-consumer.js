/**
 * Asset Generation Queue Consumer (Phase D)
 *
 * This worker consumes messages from the ASSET_QUEUE and generates
 * all marketing assets for a manuscript after analysis is complete:
 * 1. Book Description (for retailers)
 * 2. Keywords (for discoverability)
 * 3. Categories (Amazon/Apple/etc.)
 * 4. Author Bio (professional biography)
 * 5. Back Matter (about the author, other books)
 * 6. Cover Design Brief (for designers)
 * 7. Series Description (if part of a series)
 * 8. Audiobook Narration Brief (narrator guidance and style)
 * 9. Audiobook Pronunciation Guide (proper nouns and terms)
 * 10. Audiobook Timing Estimates (chapter timing and pacing)
 * 11. Audiobook Sample Selections (audition and retail samples)
 * 12. Audiobook Metadata (ACX/Audible submission data)
 *
 * Status updates are written to R2 throughout the process so the frontend
 * can poll for progress. Results are stored in R2 for later retrieval.
 */

import { BookDescriptionAgent } from '../agents/book-description-agent.js';
import { KeywordAgent } from '../agents/keyword-agent.js';
import { CategoryAgent } from '../agents/category-agent.js';
import { AuthorBioAgent } from '../agents/author-bio-agent.js';
import { BackMatterAgent } from '../agents/back-matter-agent.js';
import { CoverDesignAgent } from '../agents/cover-design-agent.js';
import { SeriesDescriptionAgent } from '../agents/series-description-agent.js';
import { AudiobookNarrationAgent } from '../agents/audiobook-narration-agent.js';
import { AudiobookPronunciationAgent } from '../agents/audiobook-pronunciation-agent.js';
import { AudiobookTimingAgent } from '../agents/audiobook-timing-agent.js';
import { AudiobookSampleAgent } from '../agents/audiobook-sample-agent.js';
import { AudiobookMetadataAgent } from '../agents/audiobook-metadata-agent.js';
import { sendAssetGenerationCompleteEmail } from '../services/email-service.js';

export default {
  /**
   * Queue message handler
   *
   * Message format:
   * {
   *   manuscriptKey: string,    // R2 key for manuscript file
   *   reportId: string,          // Short ID for status tracking
   *   genre: string,             // Genre for context
   *   authorData: object,        // Optional author information
   *   seriesData: object         // Optional series information
   * }
   */
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const { manuscriptKey, reportId, genre, authorData = {}, seriesData = {} } = message.body;

        console.log(`[Asset Queue] Processing assets for ${manuscriptKey}`);
        console.log(`[Asset Queue] Report ID: ${reportId}, Genre: ${genre}`);

        // Update status: Processing started
        await updateAssetStatus(env, reportId, {
          status: 'processing',
          progress: 0,
          message: 'Starting asset generation...',
          timestamp: new Date().toISOString(),
          agents: {
            bookDescription: { status: 'pending', progress: 0 },
            keywords: { status: 'pending', progress: 0 },
            categories: { status: 'pending', progress: 0 },
            authorBio: { status: 'pending', progress: 0 },
            backMatter: { status: 'pending', progress: 0 },
            coverBrief: { status: 'pending', progress: 0 },
            seriesDescription: { status: 'pending', progress: 0 },
            audiobookNarration: { status: 'pending', progress: 0 },
            audiobookPronunciation: { status: 'pending', progress: 0 },
            audiobookTiming: { status: 'pending', progress: 0 },
            audiobookSamples: { status: 'pending', progress: 0 },
            audiobookMetadata: { status: 'pending', progress: 0 }
          }
        });

        // Fetch developmental analysis (required input for all asset generators)
        const devAnalysisObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-analysis.json`);

        if (!devAnalysisObj) {
          throw new Error('Developmental analysis not found. Cannot generate assets without analysis.');
        }

        const devAnalysis = await devAnalysisObj.json();
        console.log('[Asset Queue] Developmental analysis loaded');

        // Extract userId and manuscriptId from manuscriptKey for cost tracking
        // Format: userId/manuscriptId/filename
        const keyParts = manuscriptKey.split('/');
        const userId = keyParts.length >= 1 ? keyParts[0] : null;
        const manuscriptId = keyParts.length >= 2 ? keyParts[1] : null;

        // Initialize all 12 asset generation agents (7 original + 5 audiobook)
        const bookDescAgent = new BookDescriptionAgent(env);
        const keywordAgent = new KeywordAgent(env);
        const categoryAgent = new CategoryAgent(env);
        const authorBioAgent = new AuthorBioAgent(env);
        const backMatterAgent = new BackMatterAgent(env);
        const coverDesignAgent = new CoverDesignAgent(env);
        const seriesDescriptionAgent = new SeriesDescriptionAgent(env);
        const audiobookNarrationAgent = new AudiobookNarrationAgent(env);
        const audiobookPronunciationAgent = new AudiobookPronunciationAgent(env);
        const audiobookTimingAgent = new AudiobookTimingAgent(env);
        const audiobookSampleAgent = new AudiobookSampleAgent(env);
        const audiobookMetadataAgent = new AudiobookMetadataAgent(env);

        console.log('[Asset Queue] Running all 12 agents in parallel...');

        // Update status to show all agents are running
        await updateAssetStatus(env, reportId, {
          status: 'processing',
          progress: 10,
          message: 'Generating marketing and audiobook assets...',
          timestamp: new Date().toISOString(),
          agents: {
            bookDescription: { status: 'running', progress: 10 },
            keywords: { status: 'running', progress: 10 },
            categories: { status: 'running', progress: 10 },
            authorBio: { status: 'running', progress: 10 },
            backMatter: { status: 'running', progress: 10 },
            coverBrief: { status: 'running', progress: 10 },
            seriesDescription: { status: 'running', progress: 10 },
            audiobookNarration: { status: 'running', progress: 10 },
            audiobookPronunciation: { status: 'running', progress: 10 },
            audiobookTiming: { status: 'running', progress: 10 },
            audiobookSamples: { status: 'running', progress: 10 },
            audiobookMetadata: { status: 'running', progress: 10 }
          }
        });

        // Execute all agents in parallel using Promise.all
        // Each agent call is wrapped in .catch() to prevent one failure from stopping others
        // Note: Audiobook metadata agent will run in parallel but may have null for some inputs initially
        const results = await Promise.allSettled([
          bookDescAgent.generate(manuscriptKey, devAnalysis, genre),
          keywordAgent.generate(manuscriptKey, devAnalysis, genre),
          categoryAgent.generate(manuscriptKey, devAnalysis, genre),
          authorBioAgent.generate(manuscriptKey, devAnalysis, genre, authorData),
          backMatterAgent.generate(manuscriptKey, devAnalysis, genre, authorData),
          coverDesignAgent.generate(manuscriptKey, devAnalysis, genre),
          seriesDescriptionAgent.generate(manuscriptKey, devAnalysis, genre, seriesData),
          audiobookNarrationAgent.generate(manuscriptKey, devAnalysis, genre, userId, manuscriptId),
          audiobookPronunciationAgent.generate(manuscriptKey, devAnalysis, genre, userId, manuscriptId),
          audiobookTimingAgent.generate(manuscriptKey, devAnalysis, genre, userId, manuscriptId),
          audiobookSampleAgent.generate(manuscriptKey, devAnalysis, genre, userId, manuscriptId),
          // Audiobook metadata runs in parallel but fetches other assets from R2 if needed
          (async () => {
            // Wait a bit for other assets to be generated and stored
            // This is a best-effort approach - metadata will work with whatever is available
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Fetch assets that may have been generated by now
            let bookDesc = null, cats = null, keys = null;
            try {
              const bookDescObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-book-description.json`);
              if (bookDescObj) bookDesc = await bookDescObj.json();
            } catch (e) { /* ignore */ }
            try {
              const catsObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-categories.json`);
              if (catsObj) cats = await catsObj.json();
            } catch (e) { /* ignore */ }
            try {
              const keysObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-keywords.json`);
              if (keysObj) keys = await keysObj.json();
            } catch (e) { /* ignore */ }

            return await audiobookMetadataAgent.generate(
              manuscriptKey, devAnalysis, bookDesc, cats, keys, genre, userId, manuscriptId
            );
          })()
        ]);

        console.log('[Asset Queue] All agents completed');

        // Process results
        const [
          bookDescription, keywords, categories, authorBio, backMatter, coverBrief, seriesDescription,
          audiobookNarration, audiobookPronunciation, audiobookTiming, audiobookSamples, audiobookMetadata
        ] = results.map((result, index) => {
          const agentNames = [
            'bookDescription', 'keywords', 'categories', 'authorBio', 'backMatter', 'coverBrief', 'seriesDescription',
            'audiobookNarration', 'audiobookPronunciation', 'audiobookTiming', 'audiobookSamples', 'audiobookMetadata'
          ];
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            console.error(`[Asset Queue] ${agentNames[index]} failed:`, result.reason);
            return { error: result.reason.message, type: agentNames[index] };
          }
        });

        // Collect any errors that occurred during generation
        const errors = [];
        if (bookDescription.error) errors.push(bookDescription);
        if (keywords.error) errors.push(keywords);
        if (categories.error) errors.push(categories);
        if (authorBio.error) errors.push(authorBio);
        if (backMatter.error) errors.push(backMatter);
        if (coverBrief.error) errors.push(coverBrief);
        if (seriesDescription.error) errors.push(seriesDescription);
        if (audiobookNarration.error) errors.push(audiobookNarration);
        if (audiobookPronunciation.error) errors.push(audiobookPronunciation);
        if (audiobookTiming.error) errors.push(audiobookTiming);
        if (audiobookSamples.error) errors.push(audiobookSamples);
        if (audiobookMetadata.error) errors.push(audiobookMetadata);

        // Combine results into a single asset package
        const combinedAssets = {
          manuscriptKey,
          reportId,
          generated: new Date().toISOString(),
          bookDescription: bookDescription.error ? null : bookDescription.description,
          keywords: keywords.error ? null : keywords.keywords,
          categories: categories.error ? null : categories.categories,
          authorBio: authorBio.error ? null : authorBio.bio,
          backMatter: backMatter.error ? null : backMatter.backMatter,
          coverBrief: coverBrief.error ? null : coverBrief.coverBrief,
          seriesDescription: seriesDescription.error ? null : seriesDescription.seriesDescription,
          audiobookNarration: audiobookNarration.error ? null : audiobookNarration.narrationBrief,
          audiobookPronunciation: audiobookPronunciation.error ? null : audiobookPronunciation.pronunciationGuide,
          audiobookTiming: audiobookTiming.error ? null : audiobookTiming.timingAnalysis,
          audiobookSamples: audiobookSamples.error ? null : audiobookSamples.sampleSelections,
          audiobookMetadata: audiobookMetadata.error ? null : audiobookMetadata.audiobookMetadata,
          errors: errors.length > 0 ? errors : undefined
        };

        // Store the combined assets in R2
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

        console.log('[Asset Queue] Assets stored in R2');

        // Update final status (include asset data for frontend)
        const finalStatus = errors.length > 0 ? 'partial' : 'complete';
        const finalMessage = errors.length > 0
          ? `Asset generation completed with ${errors.length} error(s)`
          : 'All assets generated successfully!';

        await updateAssetStatus(env, reportId, {
          status: finalStatus,
          progress: 100,
          message: finalMessage,
          timestamp: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          agents: {
            bookDescription: { status: bookDescription.error ? 'failed' : 'complete', progress: 100 },
            keywords: { status: keywords.error ? 'failed' : 'complete', progress: 100 },
            categories: { status: categories.error ? 'failed' : 'complete', progress: 100 },
            authorBio: { status: authorBio.error ? 'failed' : 'complete', progress: 100 },
            backMatter: { status: backMatter.error ? 'failed' : 'complete', progress: 100 },
            coverBrief: { status: coverBrief.error ? 'failed' : 'complete', progress: 100 },
            seriesDescription: { status: seriesDescription.error ? 'failed' : 'complete', progress: 100 },
            audiobookNarration: { status: audiobookNarration.error ? 'failed' : 'complete', progress: 100 },
            audiobookPronunciation: { status: audiobookPronunciation.error ? 'failed' : 'complete', progress: 100 },
            audiobookTiming: { status: audiobookTiming.error ? 'failed' : 'complete', progress: 100 },
            audiobookSamples: { status: audiobookSamples.error ? 'failed' : 'complete', progress: 100 },
            audiobookMetadata: { status: audiobookMetadata.error ? 'failed' : 'complete', progress: 100 }
          },
          // Include the actual asset data in the status response
          bookDescription: combinedAssets.bookDescription,
          keywords: combinedAssets.keywords,
          categories: combinedAssets.categories,
          authorBio: combinedAssets.authorBio,
          backMatter: combinedAssets.backMatter,
          coverBrief: combinedAssets.coverBrief,
          seriesDescription: combinedAssets.seriesDescription,
          audiobookNarration: combinedAssets.audiobookNarration,
          audiobookPronunciation: combinedAssets.audiobookPronunciation,
          audiobookTiming: combinedAssets.audiobookTiming,
          audiobookSamples: combinedAssets.audiobookSamples,
          audiobookMetadata: combinedAssets.audiobookMetadata,
          errors: errors.length > 0 ? errors : undefined
        });

        console.log(`[Asset Queue] Asset generation complete for ${reportId}`);

        // Send asset generation complete email
        try {
          // Get manuscript ID from manuscriptKey (format: userId/manuscriptId/filename)
          const parts = manuscriptKey.split('/');
          const manuscriptId = parts.length >= 2 ? parts[1] : null;

          if (manuscriptId) {
            const manuscript = await env.DB.prepare(
              'SELECT m.title, u.email, u.full_name FROM manuscripts m JOIN users u ON m.user_id = u.id WHERE m.id = ?'
            ).bind(manuscriptId).first();

            if (manuscript) {
              await sendAssetGenerationCompleteEmail({
                to: manuscript.email,
                userName: manuscript.full_name || 'Author',
                manuscriptTitle: manuscript.title,
                reportId,
                env
              });
              console.log(`[Asset Queue] Asset generation complete email sent to ${manuscript.email}`);
            }
          }
        } catch (emailError) {
          console.error(`[Asset Queue] Failed to send asset generation complete email:`, emailError);
          // Don't fail the asset generation if email fails
        }

        // Acknowledge successful processing
        message.ack();

      } catch (error) {
        console.error('[Asset Queue] Error processing message:', error);
        console.error('[Asset Queue] Error stack:', error.stack);

        // Update status: Failed
        const { reportId } = message.body;
        if (reportId) {
          await updateAssetStatus(env, reportId, {
            status: 'failed',
            progress: 0,
            message: `Asset generation failed: ${error.message}`,
            error: error.message,
            errorStack: error.stack,
            timestamp: new Date().toISOString()
          }).catch(statusError => {
            console.error('[Asset Queue] Failed to update error status:', statusError);
          });
        }

        // Retry the message (Cloudflare will automatically retry based on queue config)
        message.retry();
      }
    }
  }
};

/**
 * Update asset generation status in R2 for frontend polling
 */
async function updateAssetStatus(env, reportId, statusData) {
  try {
    await env.MANUSCRIPTS_RAW.put(
      `asset-status:${reportId}`,
      JSON.stringify(statusData),
      {
        expirationTtl: 60 * 60 * 24 * 7, // 7 days
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );
    console.log(`[Asset Queue] Status updated for ${reportId}: ${statusData.message}`);
  } catch (error) {
    console.error('[Asset Queue] Failed to update status:', error);
    // Don't throw - status update failure shouldn't fail the generation
  }
}
