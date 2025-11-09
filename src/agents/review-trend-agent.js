// Review Trend Analysis Agent
// Detects patterns, trends, and anomalies across reviews over time

import {
  callClaudeWithCostTracking,
  validateRequiredFields,
  storeAsset,
  AGENT_CONFIG
} from '../utils/agent-utils.js';

export class ReviewTrendAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Analyze trends across reviews over time
   * @param {Array} reviews - Array of review objects with sentiment analysis
   * @param {Object} historicalData - Previous trend data for comparison
   * @param {string} bookTitle - Book title
   * @param {string} userId - User ID for cost tracking
   * @param {string} manuscriptId - Manuscript ID for cost tracking
   * @returns {Object} Trend analysis results
   */
  async analyzeTrends(reviews, historicalData, bookTitle, userId, manuscriptId) {
    console.log(`Analyzing trends for ${reviews.length} reviews`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    if (!reviews || reviews.length === 0) {
      return {
        totalReviews: 0,
        trends: [],
        warnings: ['No reviews to analyze']
      };
    }

    // Sort reviews by date for temporal analysis
    const sortedReviews = [...reviews].sort((a, b) =>
      new Date(a.reviewDate) - new Date(b.reviewDate)
    );

    // Group reviews by time period
    const reviewsByPeriod = this.groupReviewsByPeriod(sortedReviews);

    // Calculate aggregate statistics
    const statistics = this.calculateStatistics(reviews);

    // Prepare prompt for Claude
    const prompt = `You are an expert data analyst and literary market researcher, specializing in analyzing review trends and patterns for published books.

BOOK CONTEXT:
Title: ${bookTitle}
Total Reviews: ${reviews.length}
Date Range: ${sortedReviews[0]?.reviewDate || 'Unknown'} to ${sortedReviews[sortedReviews.length - 1]?.reviewDate || 'Unknown'}

AGGREGATE STATISTICS:
Average Rating: ${statistics.averageRating.toFixed(2)}⭐
Rating Distribution:
  5⭐: ${statistics.ratingDistribution[5] || 0} (${((statistics.ratingDistribution[5] || 0) / reviews.length * 100).toFixed(1)}%)
  4⭐: ${statistics.ratingDistribution[4] || 0} (${((statistics.ratingDistribution[4] || 0) / reviews.length * 100).toFixed(1)}%)
  3⭐: ${statistics.ratingDistribution[3] || 0} (${((statistics.ratingDistribution[3] || 0) / reviews.length * 100).toFixed(1)}%)
  2⭐: ${statistics.ratingDistribution[2] || 0} (${((statistics.ratingDistribution[2] || 0) / reviews.length * 100).toFixed(1)}%)
  1⭐: ${statistics.ratingDistribution[1] || 0} (${((statistics.ratingDistribution[1] || 0) / reviews.length * 100).toFixed(1)}%)

Sentiment Distribution:
  Positive: ${statistics.sentimentDistribution.positive || 0} (${((statistics.sentimentDistribution.positive || 0) / reviews.length * 100).toFixed(1)}%)
  Neutral: ${statistics.sentimentDistribution.neutral || 0} (${((statistics.sentimentDistribution.neutral || 0) / reviews.length * 100).toFixed(1)}%)
  Negative: ${statistics.sentimentDistribution.negative || 0} (${((statistics.sentimentDistribution.negative || 0) / reviews.length * 100).toFixed(1)}%)
  Mixed: ${statistics.sentimentDistribution.mixed || 0} (${((statistics.sentimentDistribution.mixed || 0) / reviews.length * 100).toFixed(1)}%)

REVIEWS BY TIME PERIOD:
${JSON.stringify(reviewsByPeriod, null, 2)}

HISTORICAL DATA:
${historicalData ? JSON.stringify(historicalData, null, 2) : 'No historical data available (first analysis)'}

SAMPLE REVIEWS (showing temporal distribution):
${this.formatSampleReviews(sortedReviews)}

TASK: Analyze review trends and patterns to identify:
1. Temporal trends (sentiment changes over time)
2. Emerging themes (new topics appearing in recent reviews)
3. Anomalies and outliers (unusual patterns, potential review bombing)
4. Platform-specific differences
5. Verified vs. unverified purchase patterns
6. Suspicious activity detection

REQUIREMENTS:

1. **TEMPORAL TRENDS**
   - Is sentiment improving or declining over time?
   - Are recent reviews more positive/negative than older ones?
   - Any sudden shifts in rating patterns?
   - Seasonal patterns (if data spans multiple months)?

2. **EMERGING THEMES**
   - What themes appear in recent reviews that weren't common earlier?
   - Are criticisms increasing or decreasing?
   - New praises appearing?
   - Changes in what readers focus on?

3. **ANOMALY DETECTION**
   - Suspicious review patterns (clusters of similar reviews)
   - Potential review bombing (sudden influx of negative reviews)
   - Potential fake positive reviews
   - Rating manipulation indicators
   - Coordinated reviewing activity

4. **PLATFORM ANALYSIS**
   - Do Amazon reviews differ from Goodreads reviews?
   - Platform-specific sentiment patterns
   - Verified purchase correlation with sentiment

5. **ACTIONABLE INSIGHTS**
   - What trends should the author be aware of?
   - Marketing opportunities based on positive trends
   - Issues that need addressing
   - Recommendations for improvement

6. **PREDICTIONS**
   - Based on current trends, what's the likely trajectory?
   - Will sentiment continue improving/declining?
   - What themes will likely become more prominent?

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "temporalTrends": {
    "overallTrend": "improving|stable|declining",
    "sentimentTrajectory": "description of sentiment changes over time",
    "ratingTrend": "ratings are trending up/down/stable",
    "recentVsHistorical": {
      "recentAverageRating": 4.2,
      "historicalAverageRating": 3.8,
      "change": "+0.4",
      "interpretation": "Book gaining more positive reception over time"
    },
    "periodAnalysis": [
      {
        "period": "2024-01",
        "avgRating": 4.5,
        "reviewCount": 10,
        "sentiment": "positive",
        "notableEvents": "Launch month - enthusiastic early readers"
      }
    ]
  },

  "emergingThemes": {
    "newPraises": [
      {
        "theme": "character development",
        "recentMentions": 15,
        "historicalMentions": 3,
        "trend": "sharply increasing",
        "examples": ["strong character arcs", "relatable protagonist"]
      }
    ],
    "newCriticisms": [
      {
        "theme": "pacing issues",
        "recentMentions": 8,
        "historicalMentions": 1,
        "trend": "increasing",
        "severity": "medium"
      }
    ],
    "fadingThemes": ["themes that were common but are now rare"]
  },

  "anomalyDetection": {
    "suspiciousPatterns": [
      {
        "type": "review_cluster",
        "description": "5 similar positive reviews posted within 24 hours",
        "severity": "low|medium|high",
        "reviewIndices": [10, 11, 12, 13, 14],
        "recommendation": "Monitor but likely coincidental"
      }
    ],
    "reviewBombingRisk": "none|low|medium|high",
    "fakeReviewIndicators": [
      "Generic language in multiple reviews",
      "Unverified purchases with 5-star ratings"
    ],
    "qualityScore": 0.85
  },

  "platformAnalysis": {
    "byPlatform": [
      {
        "platform": "Amazon",
        "avgRating": 4.2,
        "reviewCount": 50,
        "sentiment": "positive",
        "verifiedPurchaseRate": 0.8,
        "notablePattern": "Verified purchases are more critical"
      }
    ],
    "platformDifferences": "Amazon reviews are more critical than Goodreads"
  },

  "actionableInsights": {
    "opportunities": [
      "Recent positive trend - good time for marketing push",
      "Strong character praise - emphasize in promotional materials"
    ],
    "concerns": [
      "Pacing criticism increasing - consider for next book",
      "Low review velocity - may need review solicitation campaign"
    ],
    "recommendations": [
      "Focus marketing on character-driven appeal",
      "Address pacing feedback in author note or sequel"
    ]
  },

  "predictions": {
    "sentimentTrajectory": "likely to remain positive with gradual improvement",
    "expectedAverageRating": 4.3,
    "riskFactors": ["Limited review volume may cause volatility"],
    "confidenceLevel": "medium"
  },

  "keyMetrics": {
    "reviewVelocity": "2.5 reviews per week",
    "sentimentMomentum": "positive",
    "themeStability": "stable",
    "overallHealth": "good|fair|concerning"
  },

  "comparisonToHistorical": ${historicalData ? `{
    "ratingChange": "+0.2",
    "sentimentChange": "more positive",
    "themeEvolution": "character focus increasing, plot focus stable",
    "notableShifts": ["description of major changes"]
  }` : 'null'}
}`;

    const analysis = await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.BALANCED,
      'ReviewTrendAgent',
      this.env,
      userId,
      manuscriptId,
      'review_monitoring',
      'analyze_trends'
    );

    // Validate structure
    validateRequiredFields(analysis, ['temporalTrends', 'actionableInsights'], 'Trend Analysis');

    // Add metadata
    const results = {
      ...analysis,
      analyzedAt: new Date().toISOString(),
      totalReviews: reviews.length,
      dateRange: {
        earliest: sortedReviews[0]?.reviewDate,
        latest: sortedReviews[sortedReviews.length - 1]?.reviewDate
      },
      statistics
    };

    // Store results
    const storageKey = `trends-${manuscriptId}-${Date.now()}`;
    await storeAsset(
      this.env.R2.getBucket('manuscripts_processed'),
      storageKey,
      'review-trends',
      results
    );

    return results;
  }

  /**
   * Group reviews by time period for trend analysis
   */
  groupReviewsByPeriod(sortedReviews, periodType = 'month') {
    const periods = {};

    for (const review of sortedReviews) {
      const date = new Date(review.reviewDate);
      let periodKey;

      if (periodType === 'month') {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (periodType === 'week') {
        const weekNum = Math.ceil(date.getDate() / 7);
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-W${weekNum}`;
      } else {
        periodKey = date.toISOString().split('T')[0]; // Daily
      }

      if (!periods[periodKey]) {
        periods[periodKey] = {
          reviews: [],
          count: 0,
          avgRating: 0,
          sentimentCounts: { positive: 0, neutral: 0, negative: 0, mixed: 0 }
        };
      }

      periods[periodKey].reviews.push(review);
      periods[periodKey].count++;
      periods[periodKey].sentimentCounts[review.sentiment]++;
    }

    // Calculate averages
    for (const period in periods) {
      const data = periods[period];
      data.avgRating = data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.count;
    }

    return periods;
  }

  /**
   * Calculate aggregate statistics
   */
  calculateStatistics(reviews) {
    const stats = {
      totalReviews: reviews.length,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      sentimentDistribution: { positive: 0, neutral: 0, negative: 0, mixed: 0 },
      verifiedPurchaseRate: 0,
      platformDistribution: {}
    };

    let totalRating = 0;
    let verifiedCount = 0;

    for (const review of reviews) {
      totalRating += review.rating;
      stats.ratingDistribution[review.rating]++;
      stats.sentimentDistribution[review.sentiment]++;

      if (review.verifiedPurchase) verifiedCount++;

      const platform = review.platform || 'unknown';
      stats.platformDistribution[platform] = (stats.platformDistribution[platform] || 0) + 1;
    }

    stats.averageRating = totalRating / reviews.length;
    stats.verifiedPurchaseRate = verifiedCount / reviews.length;

    return stats;
  }

  /**
   * Format sample reviews for prompt
   */
  formatSampleReviews(sortedReviews) {
    // Sample reviews from different time periods
    const sampleCount = Math.min(10, sortedReviews.length);
    const interval = Math.floor(sortedReviews.length / sampleCount);
    const samples = [];

    for (let i = 0; i < sampleCount; i++) {
      const index = i * interval;
      if (index < sortedReviews.length) {
        const r = sortedReviews[index];
        samples.push(
          `[${r.reviewDate}] ${r.rating}⭐ (${r.sentiment}) - ${r.reviewText.substring(0, 100)}...`
        );
      }
    }

    return samples.join('\n');
  }

  /**
   * Detect review bombing or suspicious activity
   * @param {Array} reviews - Array of review objects
   * @returns {Object} Suspicious activity report
   */
  detectSuspiciousActivity(reviews) {
    const suspicious = {
      reviewBombingDetected: false,
      suspiciousPatterns: [],
      riskLevel: 'low',
      recommendations: []
    };

    // Check for review clustering (many reviews in short time)
    const reviewsByDay = {};
    for (const review of reviews) {
      const day = review.reviewDate.split('T')[0];
      reviewsByDay[day] = (reviewsByDay[day] || 0) + 1;
    }

    for (const day in reviewsByDay) {
      if (reviewsByDay[day] > 10) {
        suspicious.suspiciousPatterns.push({
          type: 'review_cluster',
          day,
          count: reviewsByDay[day],
          description: `${reviewsByDay[day]} reviews on ${day}`
        });
      }
    }

    // Check for identical or very similar review text
    const reviewTexts = reviews.map(r => r.reviewText.toLowerCase());
    const duplicates = reviewTexts.filter((text, idx) =>
      reviewTexts.indexOf(text) !== idx
    );

    if (duplicates.length > 0) {
      suspicious.suspiciousPatterns.push({
        type: 'duplicate_text',
        count: duplicates.length,
        description: 'Multiple reviews with identical text'
      });
    }

    // Determine risk level
    if (suspicious.suspiciousPatterns.length > 3) {
      suspicious.riskLevel = 'high';
      suspicious.reviewBombingDetected = true;
    } else if (suspicious.suspiciousPatterns.length > 0) {
      suspicious.riskLevel = 'medium';
    }

    return suspicious;
  }
}
