// Metadata Optimization Handlers
// API handlers for metadata optimization features

import { getUserFromRequest } from '../utils/auth-utils.js';
import {
  generatePricingRecommendations,
  generateSEOKeywords,
  recommendBISACCategories,
  optimizeDescription,
  generateABTestSuggestions,
  analyzeCompetitivePosition,
  generateOptimizationReport,
} from '../optimizers/metadata-optimizer.js';

/**
 * Get complete optimization report for a manuscript
 * GET /manuscripts/:id/metadata/optimize
 */
export async function getOptimizationReport(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Get manuscript metadata
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse options from query params
    const url = new URL(request.url);
    const includeCompetitive = url.searchParams.get('includeCompetitive') === 'true';
    const targetPrice = parseFloat(url.searchParams.get('targetPrice')) || null;

    const options = {
      includeCompetitive,
      targetPrice,
    };

    // Generate optimization report
    const report = generateOptimizationReport(manuscript, options);

    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      manuscriptTitle: manuscript.title,
      report: report,
      generatedAt: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating optimization report:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate optimization report',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get SEO keyword recommendations
 * GET /manuscripts/:id/metadata/keywords
 */
export async function getKeywordRecommendations(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Get manuscript metadata
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse themes from query params (comma-separated)
    const url = new URL(request.url);
    const themesParam = url.searchParams.get('themes');
    const themes = themesParam ? themesParam.split(',').map(t => t.trim()) : [];

    // Generate keywords
    const keywords = generateSEOKeywords(
      manuscript.genre || 'fiction',
      themes,
      manuscript.title || ''
    );

    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      genre: manuscript.genre,
      currentKeywords: manuscript.keywords || 'Not set',
      recommendedKeywords: keywords,
      usage: {
        amazon_kdp: 'Use up to 7 keywords',
        draft2digital: 'Use up to 10 keywords',
        apple_books: 'Use up to 12 keywords',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating keywords:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate keywords',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get BISAC category recommendations
 * GET /manuscripts/:id/metadata/categories
 */
export async function getCategoryRecommendations(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Get manuscript metadata
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse themes from query params
    const url = new URL(request.url);
    const themesParam = url.searchParams.get('themes');
    const themes = themesParam ? themesParam.split(',').map(t => t.trim()) : [];

    // Generate BISAC categories
    const categories = recommendBISACCategories(
      manuscript.genre || 'fiction',
      themes
    );

    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      genre: manuscript.genre,
      currentCategories: manuscript.categories || 'Not set',
      recommendedCategories: categories,
      usage: {
        amazon_kdp: 'Select 2 BISAC categories (can browse for 8 more)',
        ingramspark: 'Select up to 3 BISAC categories',
        draft2digital: 'BISAC categories applied automatically',
      },
      note: 'BISAC categories are standardized book industry subject classifications',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating categories:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate categories',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get pricing recommendations
 * POST /manuscripts/:id/metadata/pricing
 */
export async function getPricingRecommendations(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Get manuscript metadata
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get word count from request body or manuscript
    const body = await request.json().catch(() => ({}));
    const wordCount = body.wordCount || manuscript.word_count || 75000;

    // Generate pricing recommendations
    const pricing = generatePricingRecommendations(
      manuscript.genre || 'fiction',
      wordCount
    );

    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      genre: manuscript.genre,
      wordCount: wordCount,
      pricing: pricing,
      royaltyEstimates: {
        kdp_70_percent: {
          ebook: (pricing.ebook.recommended * 0.70).toFixed(2),
          note: 'Available for $2.99-$9.99 range in most markets',
        },
        kdp_35_percent: {
          ebook: (pricing.ebook.recommended * 0.35).toFixed(2),
          note: 'For prices outside $2.99-$9.99 range',
        },
        draft2digital: {
          ebook: (pricing.ebook.recommended * 0.60).toFixed(2),
          note: 'D2D takes 10%, retailers take 30%',
        },
        ingramspark_print: {
          paperback: (pricing.paperback.recommended * 0.55 - pricing.paperback.printCost).toFixed(2),
          note: '55% wholesale discount is standard',
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating pricing recommendations:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate pricing recommendations',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Optimize book description
 * POST /manuscripts/:id/metadata/description
 */
export async function optimizeBookDescription(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Get manuscript metadata
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get description from request body or use manuscript description
    const body = await request.json().catch(() => ({}));
    const description = body.description || manuscript.description || '';
    const keywords = body.keywords || [];

    if (!description) {
      return new Response(JSON.stringify({
        error: 'No description provided. Include description in request body or set manuscript description.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Optimize description
    const optimization = optimizeDescription(
      description,
      manuscript.genre || 'fiction',
      keywords
    );

    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      genre: manuscript.genre,
      optimization: optimization,
      platformGuidance: {
        amazon_kdp: {
          maxLength: 4000,
          htmlAllowed: true,
          tip: 'Use bold, italics, and line breaks for better readability',
        },
        draft2digital: {
          maxLength: 4000,
          htmlAllowed: false,
          tip: 'Plain text only, use line breaks for paragraphs',
        },
        apple_books: {
          maxLength: 4000,
          htmlAllowed: false,
          tip: 'Keep it concise and compelling',
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error optimizing description:', error);
    return new Response(JSON.stringify({
      error: 'Failed to optimize description',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Generate A/B test suggestions
 * GET /manuscripts/:id/metadata/ab-test
 */
export async function getABTestSuggestions(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Get manuscript metadata
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate A/B test suggestions
    const abTests = generateABTestSuggestions(
      manuscript.title || 'Untitled',
      manuscript.description || '',
      manuscript.genre || 'fiction'
    );

    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      current: {
        title: manuscript.title,
        description: manuscript.description,
      },
      abTests: abTests,
      testingPlatforms: {
        amazon_kdp: 'Use Amazon Marketing Services (AMS) for A/B testing ads',
        facebook_ads: 'Test different titles/descriptions in ad copy',
        bookbub_ads: 'Test variations in BookBub Featured Deal campaigns',
      },
      note: 'Run each variation for at least 2 weeks with similar ad spend to get statistically significant results',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating A/B test suggestions:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate A/B test suggestions',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Analyze competitive position
 * POST /manuscripts/:id/metadata/competitive
 */
export async function getCompetitiveAnalysis(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Get manuscript metadata
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get competitive data from request body
    const body = await request.json().catch(() => ({}));
    const compTitles = body.compTitles || [];
    const wordCount = body.wordCount || manuscript.word_count || 75000;

    if (compTitles.length === 0) {
      return new Response(JSON.stringify({
        error: 'No competitive titles provided. Include compTitles array in request body.',
        example: {
          compTitles: [
            { title: 'Comp Title 1', price: 4.99, rating: 4.5, reviewCount: 1234 },
            { title: 'Comp Title 2', price: 5.99, rating: 4.3, reviewCount: 567 },
          ],
          wordCount: 80000,
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate competitive analysis
    const analysis = analyzeCompetitivePosition(
      manuscript.genre || 'fiction',
      compTitles,
      wordCount
    );

    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      genre: manuscript.genre,
      analysis: analysis,
      actionItems: [
        ...analysis.recommendations,
        'Monitor comp titles monthly for pricing changes',
        'Track review velocity of top performers',
        'Adjust metadata based on successful competitors',
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating competitive analysis:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate competitive analysis',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Update manuscript metadata with optimized values
 * PATCH /manuscripts/:id/metadata
 */
export async function updateManuscriptMetadata(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Get manuscript metadata
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse update data from request body
    const updates = await request.json();
    const allowedFields = ['title', 'description', 'keywords', 'categories', 'genre', 'price_ebook', 'price_paperback'];

    // Build dynamic update query
    const updateFields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (updateFields.length === 0) {
      return new Response(JSON.stringify({
        error: 'No valid fields to update',
        allowedFields: allowedFields,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update manuscript
    values.push(manuscriptId, user.id);
    const query = `UPDATE manuscripts SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;

    await env.DB.prepare(query).bind(...values).run();

    // Get updated manuscript
    const updatedManuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'Manuscript metadata updated successfully',
      updatedFields: Object.keys(updates).filter(k => allowedFields.includes(k)),
      manuscript: {
        id: updatedManuscript.id,
        title: updatedManuscript.title,
        description: updatedManuscript.description,
        keywords: updatedManuscript.keywords,
        categories: updatedManuscript.categories,
        genre: updatedManuscript.genre,
        price_ebook: updatedManuscript.price_ebook,
        price_paperback: updatedManuscript.price_paperback,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating manuscript metadata:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update manuscript metadata',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Export handlers
export const metadataHandlers = {
  getOptimizationReport,
  getKeywordRecommendations,
  getCategoryRecommendations,
  getPricingRecommendations,
  optimizeBookDescription,
  getABTestSuggestions,
  getCompetitiveAnalysis,
  updateManuscriptMetadata,
};

export default metadataHandlers;
