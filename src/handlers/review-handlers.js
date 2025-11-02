// Review Monitoring HTTP Handlers
// Endpoints for review monitoring, sentiment analysis, response suggestions, and trend detection

import { checkManuscriptAccess } from './manuscript-handlers.js';
import { ReviewMonitoringAgent, structureReviewData } from './review-monitoring-agent.js';
import { ReviewSentimentAgent } from './review-sentiment-agent.js';
import { ReviewResponseAgent } from './review-response-agent.js';
import { ReviewTrendAgent } from './review-trend-agent.js';

/**
 * Get review monitoring configuration and status for a manuscript
 * GET /manuscripts/:id/reviews
 */
export async function getReviewMonitoring(request, env, manuscriptId) {
  try {
    // Authenticate and check access
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await env.USERS_KV.get(`session:${token}`, 'json');
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check manuscript access
    const hasAccess = await checkManuscriptAccess(env, manuscriptId, user.userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Manuscript not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch manuscript details
    const manuscript = await env.DB.prepare(
      'SELECT id, title, genre, user_id FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    // Fetch monitoring configuration
    const monitoringConfig = await env.DB.prepare(
      'SELECT * FROM review_monitoring WHERE manuscript_id = ? AND is_active = 1'
    ).bind(manuscriptId).first();

    // Fetch latest reviews
    const reviews = await env.DB.prepare(
      'SELECT * FROM reviews WHERE manuscript_id = ? ORDER BY review_date DESC LIMIT 50'
    ).bind(manuscriptId).all();

    // Fetch latest sentiment analysis
    const latestSentiment = await env.DB.prepare(
      'SELECT * FROM review_sentiment_analyses WHERE manuscript_id = ? ORDER BY analyzed_at DESC LIMIT 1'
    ).bind(manuscriptId).first();

    // Fetch latest trend analysis
    const latestTrends = await env.DB.prepare(
      'SELECT * FROM review_trend_analyses WHERE manuscript_id = ? ORDER BY analyzed_at DESC LIMIT 1'
    ).bind(manuscriptId).first();

    return new Response(JSON.stringify({
      manuscript: {
        id: manuscript.id,
        title: manuscript.title,
        genre: manuscript.genre
      },
      monitoring: monitoringConfig ? {
        isActive: Boolean(monitoringConfig.is_active),
        bookIdentifier: monitoringConfig.book_identifier,
        platforms: JSON.parse(monitoringConfig.platforms || '[]'),
        checkFrequency: monitoringConfig.check_frequency,
        lastChecked: monitoringConfig.last_checked,
        nextCheckScheduled: monitoringConfig.next_check_scheduled,
        alertOnNewReview: Boolean(monitoringConfig.alert_on_new_review),
        alertOnNegativeReview: Boolean(monitoringConfig.alert_on_negative_review)
      } : null,
      statistics: {
        totalReviews: reviews.results.length,
        averageRating: reviews.results.length > 0
          ? reviews.results.reduce((sum, r) => sum + r.rating, 0) / reviews.results.length
          : 0,
        lastReviewDate: reviews.results[0]?.review_date || null
      },
      sentiment: latestSentiment ? {
        analyzedAt: latestSentiment.analyzed_at,
        averageSentimentScore: latestSentiment.average_sentiment_score,
        sentimentDistribution: JSON.parse(latestSentiment.sentiment_distribution || '{}'),
        reviewsNeedingAttention: JSON.parse(latestSentiment.reviews_needing_attention || '[]').length,
        reviewsNeedingResponse: JSON.parse(latestSentiment.reviews_needing_response || '[]').length
      } : null,
      trends: latestTrends ? {
        analyzedAt: latestTrends.analyzed_at,
        overallTrend: latestTrends.overall_trend,
        reviewVelocity: latestTrends.review_velocity,
        anomalyRiskLevel: latestTrends.anomaly_risk_level
      } : null,
      recentReviews: reviews.results.slice(0, 10).map(r => ({
        id: r.id,
        platform: r.platform,
        rating: r.rating,
        reviewDate: r.review_date,
        reviewerName: r.reviewer_name,
        reviewText: r.review_text.substring(0, 200) + (r.review_text.length > 200 ? '...' : ''),
        sentiment: r.sentiment,
        needsResponse: Boolean(r.needs_response)
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in getReviewMonitoring:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Setup or update review monitoring for a manuscript
 * POST /manuscripts/:id/reviews/setup
 */
export async function setupReviewMonitoring(request, env, manuscriptId) {
  try {
    // Authenticate
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await env.USERS_KV.get(`session:${token}`, 'json');
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check manuscript access
    const hasAccess = await checkManuscriptAccess(env, manuscriptId, user.userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Manuscript not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const config = await request.json();
    const {
      bookIdentifier, // ASIN or ISBN
      platforms = { amazon: true },
      checkFrequency = 'daily',
      alertOnNewReview = true,
      alertOnNegativeReview = true,
      minimumRatingForAlert = 3
    } = config;

    if (!bookIdentifier) {
      return new Response(JSON.stringify({ error: 'bookIdentifier (ASIN or ISBN) is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use ReviewMonitoringAgent to setup monitoring
    const agent = new ReviewMonitoringAgent(env);
    const monitoringRecord = await agent.setupMonitoring(
      manuscriptId,
      {
        bookIdentifier,
        platforms,
        checkFrequency,
        alertOnNewReview,
        alertOnNegativeReview,
        minimumRatingForAlert
      },
      user.userId
    );

    // Store in database
    const existingConfig = await env.DB.prepare(
      'SELECT id FROM review_monitoring WHERE manuscript_id = ?'
    ).bind(manuscriptId).first();

    if (existingConfig) {
      // Update existing
      await env.DB.prepare(`
        UPDATE review_monitoring
        SET book_identifier = ?,
            platforms = ?,
            check_frequency = ?,
            alert_on_new_review = ?,
            alert_on_negative_review = ?,
            minimum_rating_for_alert = ?,
            is_active = 1,
            next_check_scheduled = ?,
            updated_at = ?
        WHERE manuscript_id = ?
      `).bind(
        bookIdentifier,
        JSON.stringify(Object.keys(platforms).filter(p => platforms[p])),
        checkFrequency,
        alertOnNewReview ? 1 : 0,
        alertOnNegativeReview ? 1 : 0,
        minimumRatingForAlert,
        monitoringRecord.nextCheckScheduled,
        Math.floor(Date.now() / 1000),
        manuscriptId
      ).run();
    } else {
      // Insert new
      await env.DB.prepare(`
        INSERT INTO review_monitoring (
          id, manuscript_id, user_id, book_identifier, platforms,
          check_frequency, alert_on_new_review, alert_on_negative_review,
          minimum_rating_for_alert, is_active, next_check_scheduled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        manuscriptId,
        user.userId,
        bookIdentifier,
        JSON.stringify(Object.keys(platforms).filter(p => platforms[p])),
        checkFrequency,
        alertOnNewReview ? 1 : 0,
        alertOnNegativeReview ? 1 : 0,
        minimumRatingForAlert,
        monitoringRecord.nextCheckScheduled,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      ).run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Review monitoring configured successfully',
      monitoring: monitoringRecord
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in setupReviewMonitoring:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Manually trigger review fetch
 * POST /manuscripts/:id/reviews/fetch
 */
export async function fetchReviews(request, env, manuscriptId) {
  try {
    // Authenticate
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await env.USERS_KV.get(`session:${token}`, 'json');
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check access
    const hasAccess = await checkManuscriptAccess(env, manuscriptId, user.userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get monitoring config
    const config = await env.DB.prepare(
      'SELECT * FROM review_monitoring WHERE manuscript_id = ?'
    ).bind(manuscriptId).first();

    if (!config) {
      return new Response(JSON.stringify({ error: 'Review monitoring not configured for this manuscript' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Queue review fetch job
    const jobId = crypto.randomUUID();
    await env.REVIEW_QUEUE.send({
      type: 'fetch_reviews',
      jobId,
      manuscriptId,
      userId: user.userId,
      bookIdentifier: config.book_identifier,
      platforms: JSON.parse(config.platforms || '[]'),
      timestamp: Date.now()
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Review fetch queued',
      jobId,
      statusUrl: `/manuscripts/${manuscriptId}/reviews/status/${jobId}`
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in fetchReviews:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get sentiment analysis for reviews
 * GET /manuscripts/:id/reviews/sentiment
 */
export async function getReviewSentiment(request, env, manuscriptId) {
  try {
    // Authenticate
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await env.USERS_KV.get(`session:${token}`, 'json');
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check access
    const hasAccess = await checkManuscriptAccess(env, manuscriptId, user.userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch latest sentiment analysis from R2
    const manuscript = await env.DB.prepare(
      'SELECT title, genre FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    // Look for sentiment analysis in R2
    const sentimentKey = `${user.userId}/${manuscriptId}/sentiment-${manuscriptId}`;
    const listResult = await env.MANUSCRIPTS_PROCESSED.list({ prefix: sentimentKey });

    if (listResult.objects.length === 0) {
      return new Response(JSON.stringify({
        error: 'No sentiment analysis found. Reviews may not have been analyzed yet.'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the most recent sentiment analysis
    const latestKey = listResult.objects.sort((a, b) =>
      b.uploaded.getTime() - a.uploaded.getTime()
    )[0].key;

    const sentimentObj = await env.MANUSCRIPTS_PROCESSED.get(latestKey);
    const sentimentData = JSON.parse(await sentimentObj.text());

    return new Response(JSON.stringify({
      manuscript: {
        id: manuscriptId,
        title: manuscript.title
      },
      sentiment: sentimentData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in getReviewSentiment:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get response suggestions for reviews
 * POST /manuscripts/:id/reviews/responses
 */
export async function getReviewResponses(request, env, manuscriptId) {
  try {
    // Authenticate
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await env.USERS_KV.get(`session:${token}`, 'json');
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check access
    const hasAccess = await checkManuscriptAccess(env, manuscriptId, user.userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request
    const body = await request.json();
    const { reviewIds, authorVoice } = body;

    // Fetch manuscript
    const manuscript = await env.DB.prepare(
      'SELECT title, author_name FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    // Fetch reviews
    let reviews;
    if (reviewIds && reviewIds.length > 0) {
      const placeholders = reviewIds.map(() => '?').join(',');
      reviews = await env.DB.prepare(
        `SELECT * FROM reviews WHERE id IN (${placeholders})`
      ).bind(...reviewIds).all();
    } else {
      // Get all reviews needing response
      reviews = await env.DB.prepare(
        'SELECT * FROM reviews WHERE manuscript_id = ? AND needs_response = 1'
      ).bind(manuscriptId).all();
    }

    if (reviews.results.length === 0) {
      return new Response(JSON.stringify({
        message: 'No reviews found requiring responses',
        responses: []
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate responses using agent
    const agent = new ReviewResponseAgent(env);
    const result = await agent.generateBatchResponses(
      reviews.results,
      manuscript.title,
      manuscript.author_name || 'Author',
      authorVoice,
      user.userId,
      manuscriptId
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in getReviewResponses:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get trend analysis for reviews
 * GET /manuscripts/:id/reviews/trends
 */
export async function getReviewTrends(request, env, manuscriptId) {
  try {
    // Authenticate
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await env.USERS_KV.get(`session:${token}`, 'json');
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check access
    const hasAccess = await checkManuscriptAccess(env, manuscriptId, user.userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch latest trends from R2
    const trendsKey = `${user.userId}/${manuscriptId}/trends-${manuscriptId}`;
    const listResult = await env.MANUSCRIPTS_PROCESSED.list({ prefix: trendsKey });

    if (listResult.objects.length === 0) {
      return new Response(JSON.stringify({
        error: 'No trend analysis found. Reviews may not have been analyzed yet.'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the most recent trend analysis
    const latestKey = listResult.objects.sort((a, b) =>
      b.uploaded.getTime() - a.uploaded.getTime()
    )[0].key;

    const trendsObj = await env.MANUSCRIPTS_PROCESSED.get(latestKey);
    const trendsData = JSON.parse(await trendsObj.text());

    return new Response(JSON.stringify(trendsData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in getReviewTrends:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
      });
  }
}

// Export handlers object for worker.js
export const reviewHandlers = {
  getReviewMonitoring,
  setupReviewMonitoring,
  fetchReviews,
  getReviewSentiment,
  getReviewResponses,
  getReviewTrends
};
