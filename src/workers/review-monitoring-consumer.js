// Review Monitoring Queue Consumer
// Handles background jobs for review fetching, sentiment analysis, and trend detection

import { ReviewMonitoringAgent, structureReviewData } from '../agents/review-monitoring-agent.js';
import { ReviewSentimentAgent } from '../agents/review-sentiment-agent.js';
import { ReviewTrendAgent } from '../agents/review-trend-agent.js';
import { sendEmail } from '../services/email-service.js';

/**
 * Queue consumer for REVIEW_QUEUE
 * Processes review monitoring jobs in the background
 */
export default {
  async queue(batch, env) {
    console.log(`Processing ${batch.messages.length} review monitoring jobs`);

    for (const message of batch.messages) {
      try {
        const job = message.body;
        console.log(`Processing job ${job.jobId} (type: ${job.type})`);

        switch (job.type) {
          case 'fetch_reviews':
            await handleFetchReviews(job, env);
            break;

          case 'analyze_sentiment':
            await handleAnalyzeSentiment(job, env);
            break;

          case 'analyze_trends':
            await handleAnalyzeTrends(job, env);
            break;

          case 'scheduled_check':
            await handleScheduledCheck(job, env);
            break;

          default:
            console.error(`Unknown job type: ${job.type}`);
        }

        message.ack();
      } catch (error) {
        console.error('Error processing review monitoring job:', error);
        message.retry();
      }
    }
  }
};

/**
 * Handle fetch_reviews job
 * Fetches reviews from platforms and stores them in database
 */
async function handleFetchReviews(job, env) {
  const { jobId, manuscriptId, userId, bookIdentifier, platforms } = job;

  console.log(`Fetching reviews for ${bookIdentifier} from platforms:`, platforms);

  try {
    // Update job status to processing
    await updateJobStatus(env, jobId, 'processing', { started_at: Math.floor(Date.now() / 1000) });

    // Fetch manuscript details
    const manuscript = await env.DB.prepare(
      'SELECT title, genre, author_name FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript) {
      throw new Error(`Manuscript ${manuscriptId} not found`);
    }

    // Initialize monitoring agent
    const monitoringAgent = new ReviewMonitoringAgent(env);

    // Fetch reviews from platforms
    const reviewData = await monitoringAgent.monitorReviews(
      bookIdentifier,
      platforms.reduce((acc, p) => ({ ...acc, [p]: true }), {}),
      userId,
      manuscriptId
    );

    // In production, this would parse actual API responses
    // For now, we'll check if there are sample reviews to process

    let newReviewsCount = 0;
    let totalReviewsFetched = 0;

    // Process reviews from each platform
    for (const platform of platforms) {
      if (reviewData.reviewsByPlatform[platform]) {
        const platformReviews = reviewData.reviewsByPlatform[platform].reviews || [];
        totalReviewsFetched += platformReviews.length;

        for (const rawReview of platformReviews) {
          // Structure the review data
          const structuredReview = structureReviewData(rawReview, platform);

          // Check if review already exists
          const existing = await env.DB.prepare(
            'SELECT id FROM reviews WHERE platform_review_id = ? AND platform = ?'
          ).bind(structuredReview.id, platform).first();

          if (!existing) {
            // Insert new review
            await env.DB.prepare(`
              INSERT INTO reviews (
                id, manuscript_id, user_id, platform, platform_review_id, review_url,
                reviewer_name, reviewer_verified, verified_purchase,
                rating, review_title, review_text, review_date,
                helpful_votes, images, fetched_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              structuredReview.id,
              manuscriptId,
              userId,
              platform,
              structuredReview.id,
              structuredReview.reviewUrl,
              structuredReview.reviewerName,
              structuredReview.reviewerVerified ? 1 : 0,
              structuredReview.verifiedPurchase ? 1 : 0,
              structuredReview.rating,
              structuredReview.reviewTitle,
              structuredReview.reviewText,
              new Date(structuredReview.reviewDate).getTime() / 1000,
              structuredReview.helpfulVotes,
              JSON.stringify(structuredReview.images),
              Math.floor(Date.now() / 1000),
              Math.floor(Date.now() / 1000)
            ).run();

            newReviewsCount++;

            // Check if this is a negative review that needs immediate attention
            const monitoringConfig = await env.DB.prepare(
              'SELECT * FROM review_monitoring WHERE manuscript_id = ?'
            ).bind(manuscriptId).first();

            if (monitoringConfig) {
              const shouldAlert = (
                (monitoringConfig.alert_on_new_review && newReviewsCount === 1) ||
                (monitoringConfig.alert_on_negative_review &&
                 structuredReview.rating <= monitoringConfig.minimum_rating_for_alert)
              );

              if (shouldAlert) {
                await sendReviewAlert(env, userId, manuscript, structuredReview, 'new_review');
              }
            }
          }
        }
      }
    }

    // Update monitoring config with last checked time
    await env.DB.prepare(`
      UPDATE review_monitoring
      SET last_checked = ?,
          next_check_scheduled = ?,
          updated_at = ?
      WHERE manuscript_id = ?
    `).bind(
      Math.floor(Date.now() / 1000),
      calculateNextCheck(await getCheckFrequency(env, manuscriptId)),
      Math.floor(Date.now() / 1000),
      manuscriptId
    ).run();

    // If new reviews were found, trigger sentiment analysis
    if (newReviewsCount > 0) {
      await env.REVIEW_QUEUE.send({
        type: 'analyze_sentiment',
        jobId: crypto.randomUUID(),
        manuscriptId,
        userId,
        timestamp: Date.now()
      });
    }

    // Update job status to complete
    await updateJobStatus(env, jobId, 'complete', {
      completed_at: Math.floor(Date.now() / 1000),
      reviews_fetched: totalReviewsFetched,
      new_reviews_count: newReviewsCount
    });

    console.log(`Completed fetch_reviews job ${jobId}: ${newReviewsCount} new reviews out of ${totalReviewsFetched} total`);

  } catch (error) {
    console.error(`Failed to fetch reviews for job ${jobId}:`, error);
    await updateJobStatus(env, jobId, 'failed', { error_message: error.message });
    throw error;
  }
}

/**
 * Handle analyze_sentiment job
 * Analyzes sentiment for all reviews of a manuscript
 */
async function handleAnalyzeSentiment(job, env) {
  const { jobId, manuscriptId, userId } = job;

  console.log(`Analyzing sentiment for manuscript ${manuscriptId}`);

  try {
    // Fetch manuscript details
    const manuscript = await env.DB.prepare(
      'SELECT title, genre FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    // Fetch all reviews
    const reviewsResult = await env.DB.prepare(
      'SELECT * FROM reviews WHERE manuscript_id = ? ORDER BY review_date DESC'
    ).bind(manuscriptId).all();

    if (reviewsResult.results.length === 0) {
      console.log('No reviews to analyze');
      return;
    }

    // Initialize sentiment agent
    const sentimentAgent = new ReviewSentimentAgent(env);

    // Analyze sentiment
    const sentimentResults = await sentimentAgent.analyzeSentiment(
      reviewsResult.results,
      manuscript.title,
      manuscript.genre,
      userId,
      manuscriptId
    );

    // Update individual reviews with sentiment data
    for (const reviewWithSentiment of sentimentResults.reviewsWithSentiment) {
      await env.DB.prepare(`
        UPDATE reviews
        SET sentiment = ?,
            sentiment_score = ?,
            themes = ?,
            praises = ?,
            criticisms = ?,
            needs_attention = ?,
            needs_response = ?,
            response_priority = ?,
            reason_for_attention = ?,
            suspicious_fake = ?,
            quotable_excerpts = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(
        reviewWithSentiment.sentiment,
        reviewWithSentiment.sentimentScore,
        JSON.stringify(reviewWithSentiment.themes || []),
        JSON.stringify(reviewWithSentiment.praises || []),
        JSON.stringify(reviewWithSentiment.criticisms || []),
        reviewWithSentiment.needsAttention ? 1 : 0,
        reviewWithSentiment.needsResponse ? 1 : 0,
        reviewWithSentiment.responsePriority || 'none',
        reviewWithSentiment.reasonForAttention || null,
        reviewWithSentiment.suspiciousFake ? 1 : 0,
        JSON.stringify(reviewWithSentiment.quotableExcerpts || []),
        Math.floor(Date.now() / 1000),
        reviewWithSentiment.id
      ).run();
    }

    // Store aggregate sentiment analysis
    const analysisId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO review_sentiment_analyses (
        id, manuscript_id, user_id, total_reviews_analyzed, analyzed_at,
        average_sentiment_score, sentiment_distribution, common_themes,
        reviews_needing_attention, reviews_needing_response,
        promotional_quotes, improvement_opportunities, red_flags,
        suspicious_reviews, r2_storage_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      analysisId,
      manuscriptId,
      userId,
      sentimentResults.totalReviews,
      Math.floor(Date.now() / 1000),
      sentimentResults.averageSentimentScore,
      JSON.stringify(sentimentResults.sentimentDistribution),
      JSON.stringify(sentimentResults.commonThemes),
      JSON.stringify(sentimentResults.reviewsNeedingAttention || []),
      JSON.stringify(sentimentResults.reviewsNeedingResponse || []),
      JSON.stringify(sentimentResults.promotionalQuotes || []),
      JSON.stringify(sentimentResults.improvementOpportunities || []),
      JSON.stringify(sentimentResults.redFlags || []),
      JSON.stringify(sentimentResults.suspiciousReviews || []),
      `${userId}/${manuscriptId}/sentiment-${manuscriptId}-${Date.now()}`
    ).run();

    // Send alert if there are reviews needing attention
    if (sentimentResults.reviewsNeedingAttention?.length > 0) {
      await sendReviewAlert(env, userId, manuscript, null, 'reviews_need_attention', {
        count: sentimentResults.reviewsNeedingAttention.length
      });
    }

    console.log(`Completed sentiment analysis for manuscript ${manuscriptId}`);

  } catch (error) {
    console.error(`Failed to analyze sentiment for manuscript ${manuscriptId}:`, error);
    throw error;
  }
}

/**
 * Handle analyze_trends job
 * Analyzes review trends over time
 */
async function handleAnalyzeTrends(job, env) {
  const { jobId, manuscriptId, userId } = job;

  console.log(`Analyzing trends for manuscript ${manuscriptId}`);

  try {
    // Fetch manuscript details
    const manuscript = await env.DB.prepare(
      'SELECT title FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    // Fetch all reviews with sentiment data
    const reviewsResult = await env.DB.prepare(
      'SELECT * FROM reviews WHERE manuscript_id = ? ORDER BY review_date ASC'
    ).bind(manuscriptId).all();

    if (reviewsResult.results.length < 5) {
      console.log('Not enough reviews for trend analysis (minimum 5)');
      return;
    }

    // Fetch historical trend data for comparison
    const previousTrend = await env.DB.prepare(
      'SELECT * FROM review_trend_analyses WHERE manuscript_id = ? ORDER BY analyzed_at DESC LIMIT 1'
    ).bind(manuscriptId).first();

    // Initialize trend agent
    const trendAgent = new ReviewTrendAgent(env);

    // Analyze trends
    const trendResults = await trendAgent.analyzeTrends(
      reviewsResult.results,
      previousTrend ? JSON.parse(previousTrend.r2_storage_key || '{}') : null,
      manuscript.title,
      userId,
      manuscriptId
    );

    // Store trend analysis
    const analysisId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO review_trend_analyses (
        id, manuscript_id, user_id, total_reviews_analyzed,
        date_range_start, date_range_end, analyzed_at,
        overall_trend, sentiment_trajectory, rating_trend, review_velocity,
        anomaly_risk_level, suspicious_patterns, review_bombing_detected,
        platform_comparison, predicted_trajectory, confidence_level,
        r2_storage_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      analysisId,
      manuscriptId,
      userId,
      trendResults.totalReviews,
      new Date(trendResults.dateRange.earliest).getTime() / 1000,
      new Date(trendResults.dateRange.latest).getTime() / 1000,
      Math.floor(Date.now() / 1000),
      trendResults.temporalTrends?.overallTrend || 'stable',
      trendResults.temporalTrends?.sentimentTrajectory || '',
      trendResults.temporalTrends?.ratingTrend || 'stable',
      trendResults.keyMetrics?.reviewVelocity || 'unknown',
      trendResults.anomalyDetection?.reviewBombingRisk || 'low',
      JSON.stringify(trendResults.anomalyDetection?.suspiciousPatterns || []),
      trendResults.anomalyDetection?.reviewBombingRisk === 'high' ? 1 : 0,
      JSON.stringify(trendResults.platformAnalysis || {}),
      trendResults.predictions?.sentimentTrajectory || '',
      trendResults.predictions?.confidenceLevel || 'medium',
      `${userId}/${manuscriptId}/trends-${manuscriptId}-${Date.now()}`
    ).run();

    // Send alert if review bombing detected or high risk
    if (trendResults.anomalyDetection?.reviewBombingRisk === 'high') {
      await sendReviewAlert(env, userId, manuscript, null, 'review_bombing_detected', trendResults.anomalyDetection);
    }

    console.log(`Completed trend analysis for manuscript ${manuscriptId}`);

  } catch (error) {
    console.error(`Failed to analyze trends for manuscript ${manuscriptId}:`, error);
    throw error;
  }
}

/**
 * Handle scheduled_check job
 * Runs scheduled review monitoring checks
 */
async function handleScheduledCheck(job, env) {
  console.log('Running scheduled review monitoring checks');

  try {
    // Find all monitoring configs that are due for a check
    const now = Math.floor(Date.now() / 1000);
    const dueConfigs = await env.DB.prepare(
      'SELECT * FROM review_monitoring WHERE is_active = 1 AND next_check_scheduled <= ?'
    ).bind(now).all();

    console.log(`Found ${dueConfigs.results.length} monitoring configs due for check`);

    // Queue fetch jobs for each due config
    for (const config of dueConfigs.results) {
      await env.REVIEW_QUEUE.send({
        type: 'fetch_reviews',
        jobId: crypto.randomUUID(),
        manuscriptId: config.manuscript_id,
        userId: config.user_id,
        bookIdentifier: config.book_identifier,
        platforms: JSON.parse(config.platforms || '[]'),
        timestamp: Date.now()
      });
    }

  } catch (error) {
    console.error('Failed to process scheduled checks:', error);
    throw error;
  }
}

/**
 * Update job status in database
 */
async function updateJobStatus(env, jobId, status, updates = {}) {
  const fields = ['status = ?'];
  const values = [status];

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  values.push(jobId);

  await env.DB.prepare(`
    UPDATE review_monitoring_jobs
    SET ${fields.join(', ')}
    WHERE id = ?
  `).bind(...values).run();
}

/**
 * Get check frequency for a manuscript
 */
async function getCheckFrequency(env, manuscriptId) {
  const config = await env.DB.prepare(
    'SELECT check_frequency FROM review_monitoring WHERE manuscript_id = ?'
  ).bind(manuscriptId).first();

  return config?.check_frequency || 'daily';
}

/**
 * Calculate next check time based on frequency
 */
function calculateNextCheck(frequency) {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    default:
      now.setDate(now.getDate() + 1);
  }
  return Math.floor(now.getTime() / 1000);
}

/**
 * Send review alert email to user
 */
async function sendReviewAlert(env, userId, manuscript, review, alertType, extraData = {}) {
  try {
    // Fetch user details
    const user = await env.DB.prepare(
      'SELECT email, full_name FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      console.error(`User ${userId} not found for alert`);
      return;
    }

    let subject, body;

    switch (alertType) {
      case 'new_review':
        subject = `New ${review.rating}⭐ Review for "${manuscript.title}"`;
        body = `
          A new review has been posted for your book "${manuscript.title}".

          Rating: ${review.rating}⭐
          Platform: ${review.platform}
          Reviewer: ${review.reviewerName}
          Date: ${new Date(review.reviewDate).toLocaleDateString()}

          Review:
          ${review.reviewText}

          View all reviews and sentiment analysis in your dashboard:
          https://scarter4workmanuscripthub.com/dashboard
        `;
        break;

      case 'reviews_need_attention':
        subject = `${extraData.count} Reviews Need Your Attention - "${manuscript.title}"`;
        body = `
          ${extraData.count} reviews for "${manuscript.title}" have been flagged for your attention.

          These reviews may require a response or contain important feedback.

          View details and response suggestions:
          https://scarter4workmanuscripthub.com/dashboard
        `;
        break;

      case 'review_bombing_detected':
        subject = `⚠️ Suspicious Review Activity Detected - "${manuscript.title}"`;
        body = `
          Our AI has detected suspicious review patterns for "${manuscript.title}".

          Risk Level: ${extraData.reviewBombingRisk}
          Patterns Detected: ${extraData.suspiciousPatterns?.length || 0}

          This may indicate review bombing or coordinated negative reviewing.

          View full trend analysis:
          https://scarter4workmanuscripthub.com/dashboard
        `;
        break;

      default:
        return;
    }

    await sendEmail(env, {
      to: user.email,
      subject,
      body,
      userId
    });

  } catch (error) {
    console.error('Failed to send review alert:', error);
  }
}
