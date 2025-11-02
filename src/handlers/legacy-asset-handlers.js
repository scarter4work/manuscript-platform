// Legacy asset handler functions extracted from worker.js
// These handlers manage asset generation status and retrieval

import { BookDescriptionAgent } from '../agents/book-description-agent.js';
import { KeywordAgent } from '../agents/keyword-agent.js';
import { CategoryAgent } from '../agents/category-agent.js';
import { AuthorBioAgent } from '../agents/author-bio-agent.js';
import { BackMatterAgent } from '../agents/back-matter-agent.js';
import { CoverDesignAgent } from '../agents/cover-design-agent.js';
import { SeriesDescriptionAgent } from '../agents/series-description-agent.js';

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

export {
  handleAssetStatus,
  handleGenerateAssets,
  handleGetAssets
};
