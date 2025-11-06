/**
 * Market Analysis Handlers
 * API endpoints for Amazon comp title research and market analysis
 */

import { generateMarketAnalysis, saveCompTitles } from '../generators/market-analysis-generator.js';

/**
 * POST /manuscripts/:id/market-analysis
 * Generate market analysis report for a manuscript
 */
export async function handleGenerateMarketAnalysis(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { genre, keywords = [] } = body;

    if (!genre) {
      return new Response(JSON.stringify({
        error: 'Missing required field: genre'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if analysis already exists and is recent (< 7 days)
    const existingAnalysis = await env.DB.prepare(`
      SELECT * FROM market_analysis_reports
      WHERE manuscript_id = ? AND status = 'completed'
        AND created_at > ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(
      manuscriptId,
      Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)
    ).first();

    if (existingAnalysis) {
      return new Response(JSON.stringify({
        error: 'Recent analysis exists',
        message: 'A market analysis was generated within the last 7 days. Use GET endpoint to retrieve it.',
        existingAnalysisId: existingAnalysis.id
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create analysis record
    const analysisId = `analysis-${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO market_analysis_reports (
        id, manuscript_id, user_id, genre, search_keywords, status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      analysisId,
      manuscriptId,
      userId,
      genre,
      JSON.stringify(keywords),
      'analyzing'
    ).run();

    // Generate analysis
    const analysisResult = await generateMarketAnalysis({
      manuscriptId,
      userId,
      genre,
      keywords,
      compTitlesLimit: 50
    }, env);

    // Save comp titles to database
    const compTitleIds = await saveCompTitles(analysisResult.analysis.compTitles, env);

    // Link comp titles to analysis
    for (let i = 0; i < compTitleIds.length; i++) {
      const linkId = `link-${crypto.randomUUID()}`;
      await env.DB.prepare(`
        INSERT INTO analysis_comp_titles (
          id, analysis_id, comp_title_id, relevance_score
        ) VALUES (?, ?, ?, ?)
      `).bind(
        linkId,
        analysisId,
        compTitleIds[i],
        1.0 - (i * 0.01) // Decreasing relevance
      ).run();
    }

    // Update analysis record with results
    await env.DB.prepare(`
      UPDATE market_analysis_reports
      SET
        comp_titles_count = ?,
        recommended_price_usd = ?,
        price_range_min = ?,
        price_range_max = ?,
        price_confidence_score = ?,
        price_reasoning = ?,
        recommended_categories = ?,
        category_confidence_scores = ?,
        recommended_keywords = ?,
        keyword_search_volumes = ?,
        keyword_competition_scores = ?,
        positioning_strategy = ?,
        target_audience_profile = ?,
        competitive_advantages = ?,
        market_gaps = ?,
        market_saturation_level = ?,
        trend_direction = ?,
        report_text = ?,
        report_summary = ?,
        ai_cost = ?,
        status = ?
      WHERE id = ?
    `).bind(
      analysisResult.analysis.compTitlesCount,
      analysisResult.analysis.pricing.recommended,
      analysisResult.analysis.pricing.min,
      analysisResult.analysis.pricing.max,
      analysisResult.analysis.pricing.confidence,
      `Based on ${analysisResult.analysis.compTitlesCount} comparable titles`,
      JSON.stringify(analysisResult.analysis.categories.recommended),
      JSON.stringify(analysisResult.analysis.categories.scores),
      JSON.stringify(analysisResult.analysis.keywords.recommended),
      JSON.stringify(analysisResult.analysis.keywords.searchVolumes),
      JSON.stringify(analysisResult.analysis.keywords.competitionScores),
      analysisResult.analysis.positioning.saturationLevel,
      'Indie author in competitive genre',
      JSON.stringify(analysisResult.analysis.positioning.competitiveAdvantages),
      JSON.stringify(analysisResult.analysis.positioning.marketGaps),
      analysisResult.analysis.positioning.saturationLevel,
      analysisResult.analysis.positioning.trendDirection,
      analysisResult.analysis.report,
      analysisResult.analysis.summary,
      analysisResult.cost,
      'completed',
      analysisId
    ).run();

    return new Response(JSON.stringify({
      success: true,
      analysisId,
      analysis: analysisResult.analysis,
      cost: analysisResult.cost,
      duration: analysisResult.duration
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error generating market analysis:', error);

    // Update analysis status to failed if it was created
    try {
      await env.DB.prepare(`
        UPDATE market_analysis_reports
        SET status = 'failed', error_message = ?
        WHERE manuscript_id = ? AND status = 'analyzing'
      `).bind(error.message, manuscriptId).run();
    } catch (updateError) {
      console.error('Error updating failed analysis:', updateError);
    }

    return new Response(JSON.stringify({
      error: 'Failed to generate market analysis',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /manuscripts/:id/market-analysis
 * Get market analysis for a manuscript
 */
export async function handleGetMarketAnalysis(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get latest analysis
    const analysis = await env.DB.prepare(`
      SELECT * FROM market_analysis_reports
      WHERE manuscript_id = ? AND user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(manuscriptId, userId).first();

    if (!analysis) {
      return new Response(JSON.stringify({
        error: 'No market analysis found for this manuscript'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get comp titles
    const compTitles = await env.DB.prepare(`
      SELECT ct.*, act.relevance_score
      FROM analysis_comp_titles act
      JOIN comp_titles ct ON act.comp_title_id = ct.id
      WHERE act.analysis_id = ?
      ORDER BY act.relevance_score DESC
    `).bind(analysis.id).all();

    return new Response(JSON.stringify({
      success: true,
      analysis: {
        ...analysis,
        recommended_categories: JSON.parse(analysis.recommended_categories || '[]'),
        category_confidence_scores: JSON.parse(analysis.category_confidence_scores || '{}'),
        recommended_keywords: JSON.parse(analysis.recommended_keywords || '[]'),
        keyword_search_volumes: JSON.parse(analysis.keyword_search_volumes || '{}'),
        keyword_competition_scores: JSON.parse(analysis.keyword_competition_scores || '{}'),
        competitive_advantages: JSON.parse(analysis.competitive_advantages || '[]'),
        market_gaps: JSON.parse(analysis.market_gaps || '[]')
      },
      compTitles: compTitles.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting market analysis:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get market analysis',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /market-analysis/:id
 * Get specific market analysis by ID
 */
export async function handleGetMarketAnalysisById(request, env) {
  const { analysisId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const analysis = await env.DB.prepare(`
      SELECT * FROM market_analysis_reports
      WHERE id = ? AND user_id = ?
    `).bind(analysisId, userId).first();

    if (!analysis) {
      return new Response(JSON.stringify({
        error: 'Market analysis not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get comp titles
    const compTitles = await env.DB.prepare(`
      SELECT ct.*, act.relevance_score
      FROM analysis_comp_titles act
      JOIN comp_titles ct ON act.comp_title_id = ct.id
      WHERE act.analysis_id = ?
      ORDER BY act.relevance_score DESC
    `).bind(analysisId).all();

    return new Response(JSON.stringify({
      success: true,
      analysis: {
        ...analysis,
        recommended_categories: JSON.parse(analysis.recommended_categories || '[]'),
        category_confidence_scores: JSON.parse(analysis.category_confidence_scores || '{}'),
        recommended_keywords: JSON.parse(analysis.recommended_keywords || '[]'),
        keyword_search_volumes: JSON.parse(analysis.keyword_search_volumes || '{}'),
        keyword_competition_scores: JSON.parse(analysis.keyword_competition_scores || '{}'),
        competitive_advantages: JSON.parse(analysis.competitive_advantages || '[]'),
        market_gaps: JSON.parse(analysis.market_gaps || '[]')
      },
      compTitles: compTitles.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting market analysis by ID:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get market analysis',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /market-analysis/:id
 * Delete market analysis
 */
export async function handleDeleteMarketAnalysis(request, env) {
  const { analysisId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Verify ownership
    const analysis = await env.DB.prepare(`
      SELECT * FROM market_analysis_reports
      WHERE id = ? AND user_id = ?
    `).bind(analysisId, userId).first();

    if (!analysis) {
      return new Response(JSON.stringify({
        error: 'Market analysis not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete analysis (cascades to links)
    await env.DB.prepare(`
      DELETE FROM market_analysis_reports WHERE id = ?
    `).bind(analysisId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Market analysis deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting market analysis:', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete market analysis',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /market-analysis/stats
 * Get market analysis statistics for user
 */
export async function handleGetMarketAnalysisStats(request, env) {
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(DISTINCT id) as total_analyses,
        COUNT(DISTINCT manuscript_id) as manuscripts_analyzed,
        AVG(comp_titles_count) as avg_comp_titles,
        AVG(price_confidence_score) as avg_price_confidence,
        SUM(ai_cost) as total_cost,
        COUNT(DISTINCT CASE WHEN status = 'completed' THEN id END) as completed,
        COUNT(DISTINCT CASE WHEN status = 'failed' THEN id END) as failed
      FROM market_analysis_reports
      WHERE user_id = ?
    `).bind(userId).first();

    return new Response(JSON.stringify({
      success: true,
      stats
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting market analysis stats:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get statistics',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /genre-pricing/:genre
 * Get pricing summary for a specific genre
 */
export async function handleGetGenrePricing(request, env) {
  const { genre } = request.params;

  try {
    const pricing = await env.DB.prepare(`
      SELECT
        genre,
        COUNT(*) as book_count,
        MIN(price_usd) as min_price,
        MAX(price_usd) as max_price,
        AVG(price_usd) as avg_price,
        AVG(CASE WHEN bestseller_rank <= 100 THEN price_usd END) as bestseller_avg_price,
        AVG(CASE WHEN average_rating >= 4.5 THEN price_usd END) as high_rated_avg_price
      FROM comp_titles
      WHERE genre = ? AND price_usd IS NOT NULL
      GROUP BY genre
    `).bind(genre).first();

    if (!pricing) {
      return new Response(JSON.stringify({
        error: 'No pricing data available for this genre'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      pricing
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting genre pricing:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get genre pricing',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
