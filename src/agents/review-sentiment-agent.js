// Review Sentiment Analysis Agent
// Analyzes review sentiment, extracts themes, and identifies issues

import {
  callClaudeWithCostTracking,
  validateRequiredFields,
  storeAsset,
  AGENT_CONFIG
} from '../utils/agent-utils.js';

export class ReviewSentimentAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Analyze sentiment and themes across multiple reviews
   * @param {Array} reviews - Array of review objects
   * @param {string} bookTitle - Book title for context
   * @param {string} genre - Book genre
   * @param {string} userId - User ID for cost tracking
   * @param {string} manuscriptId - Manuscript ID for cost tracking
   * @returns {Object} Sentiment analysis results
   */
  async analyzeSentiment(reviews, bookTitle, genre, userId, manuscriptId) {
    console.log(`Analyzing sentiment for ${reviews.length} reviews`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    if (!reviews || reviews.length === 0) {
      return {
        reviews: [],
        aggregateSentiment: {
          positive: 0,
          neutral: 0,
          negative: 0,
          mixed: 0
        },
        commonThemes: [],
        warnings: ['No reviews to analyze']
      };
    }

    // Analyze reviews in batches
    const batchSize = 20; // Analyze 20 reviews at a time
    const batches = [];

    for (let i = 0; i < reviews.length; i += batchSize) {
      batches.push(reviews.slice(i, i + batchSize));
    }

    const batchResults = [];
    for (const batch of batches) {
      const result = await this.analyzeBatch(batch, bookTitle, genre, userId, manuscriptId);
      batchResults.push(result);
    }

    // Aggregate results from all batches
    const aggregatedResults = this.aggregateBatchResults(batchResults, reviews);

    // Store results
    const storageKey = `sentiment-${manuscriptId}-${Date.now()}`;
    await storeAsset(
      this.env.MANUSCRIPTS_PROCESSED,
      storageKey,
      'review-sentiment',
      aggregatedResults
    );

    return aggregatedResults;
  }

  /**
   * Analyze a batch of reviews using Claude
   */
  async analyzeBatch(reviews, bookTitle, genre, userId, manuscriptId) {
    const reviewTexts = reviews.map((r, i) =>
      `Review ${i + 1} (${r.rating}⭐):\nTitle: ${r.reviewTitle || 'No title'}\n${r.reviewText}\n---`
    ).join('\n\n');

    const prompt = `You are an expert literary review analyst specializing in understanding reader feedback and sentiment analysis.

BOOK CONTEXT:
Title: ${bookTitle}
Genre: ${genre}

REVIEWS TO ANALYZE (${reviews.length} reviews):
${reviewTexts}

TASK: Analyze these reviews to understand reader sentiment, identify common themes, and flag issues that need attention.

REQUIREMENTS:

1. **INDIVIDUAL REVIEW ANALYSIS**
   For each review, provide:
   - Sentiment classification (positive, negative, neutral, mixed)
   - Sentiment score (-1 to +1, where -1 is very negative, +1 is very positive)
   - Key themes mentioned (plot, characters, writing style, pacing, ending, etc.)
   - Specific praises (what readers loved)
   - Specific criticisms (what readers disliked)
   - Whether this review needs author attention (controversial/negative/confused)
   - Response priority (high, medium, low, none)

2. **THEME EXTRACTION**
   Identify recurring themes across reviews:
   - What do readers consistently praise?
   - What do readers consistently criticize?
   - Are there patterns in negative reviews?
   - Are there surprising or unusual comments?

3. **ACTIONABLE INSIGHTS**
   - Which reviews most need a response?
   - What improvements could be made for future books?
   - Are there marketing opportunities (quotes for promotion)?
   - Red flags that need immediate attention

4. **SENTIMENT BREAKDOWN**
   - Overall sentiment distribution
   - Rating vs. sentiment alignment (do 3-star reviews match neutral sentiment?)
   - Fake/suspicious review detection

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "reviewAnalyses": [
    {
      "reviewIndex": 0,
      "sentiment": "positive|negative|neutral|mixed",
      "sentimentScore": 0.8,
      "rating": 5,
      "themes": ["plot", "characters", "ending"],
      "praises": ["compelling story", "well-developed characters"],
      "criticisms": ["slow pacing in middle"],
      "needsAttention": false,
      "needsResponse": false,
      "responsePriority": "none|low|medium|high",
      "reasonForAttention": "explanation if flagged",
      "suspiciousFake": false,
      "quotableExcerpts": ["Amazing book! Couldn't put it down."]
    }
  ],
  "aggregateThemes": {
    "praises": [
      {
        "theme": "plot",
        "count": 15,
        "percentage": 75,
        "examples": ["gripping plot", "page-turner"]
      }
    ],
    "criticisms": [
      {
        "theme": "pacing",
        "count": 8,
        "percentage": 40,
        "examples": ["slow middle", "rushed ending"]
      }
    ]
  },
  "sentimentDistribution": {
    "positive": 12,
    "neutral": 5,
    "negative": 3,
    "mixed": 0
  },
  "actionableInsights": {
    "reviewsNeedingResponse": [0, 5, 12],
    "promotionalQuotes": ["quote 1", "quote 2"],
    "improvementOpportunities": ["consider pacing in middle chapters"],
    "redFlags": ["multiple reviews mention confusion about plot twist"],
    "marketingOpportunities": ["readers love strong female lead - emphasize in marketing"]
  },
  "suspiciousReviews": [2, 7],
  "overallSentimentScore": 0.65,
  "recommendationForAuthor": "Overall positive reception with specific pacing issues to address in next book"
}`;

    const analysis = await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.BALANCED,
      'ReviewSentimentAgent',
      this.env,
      userId,
      manuscriptId,
      'review_monitoring',
      'analyze_sentiment'
    );

    // Validate structure
    validateRequiredFields(analysis, ['reviewAnalyses', 'sentimentDistribution'], 'Sentiment Analysis');

    return analysis;
  }

  /**
   * Aggregate results from multiple batches
   */
  aggregateBatchResults(batchResults, originalReviews) {
    const aggregated = {
      totalReviews: originalReviews.length,
      analyzedAt: new Date().toISOString(),
      sentimentDistribution: {
        positive: 0,
        neutral: 0,
        negative: 0,
        mixed: 0
      },
      averageSentimentScore: 0,
      reviewsWithSentiment: [],
      commonThemes: {
        praises: [],
        criticisms: []
      },
      reviewsNeedingAttention: [],
      reviewsNeedingResponse: [],
      promotionalQuotes: [],
      improvementOpportunities: [],
      redFlags: [],
      suspiciousReviews: []
    };

    let totalSentimentScore = 0;
    let reviewIndex = 0;

    // Aggregate data from each batch
    for (const batchResult of batchResults) {
      // Sentiment distribution
      aggregated.sentimentDistribution.positive += batchResult.sentimentDistribution.positive || 0;
      aggregated.sentimentDistribution.neutral += batchResult.sentimentDistribution.neutral || 0;
      aggregated.sentimentDistribution.negative += batchResult.sentimentDistribution.negative || 0;
      aggregated.sentimentDistribution.mixed += batchResult.sentimentDistribution.mixed || 0;

      // Individual review analyses
      for (const reviewAnalysis of batchResult.reviewAnalyses || []) {
        const enrichedReview = {
          ...originalReviews[reviewIndex],
          sentiment: reviewAnalysis.sentiment,
          sentimentScore: reviewAnalysis.sentimentScore,
          themes: reviewAnalysis.themes,
          praises: reviewAnalysis.praises,
          criticisms: reviewAnalysis.criticisms,
          needsAttention: reviewAnalysis.needsAttention,
          needsResponse: reviewAnalysis.needsResponse,
          responsePriority: reviewAnalysis.responsePriority,
          quotableExcerpts: reviewAnalysis.quotableExcerpts
        };

        aggregated.reviewsWithSentiment.push(enrichedReview);
        totalSentimentScore += reviewAnalysis.sentimentScore || 0;

        if (reviewAnalysis.needsAttention) {
          aggregated.reviewsNeedingAttention.push(reviewIndex);
        }

        if (reviewAnalysis.needsResponse) {
          aggregated.reviewsNeedingResponse.push({
            reviewIndex,
            priority: reviewAnalysis.responsePriority,
            reason: reviewAnalysis.reasonForAttention
          });
        }

        if (reviewAnalysis.suspiciousFake) {
          aggregated.suspiciousReviews.push(reviewIndex);
        }

        reviewIndex++;
      }

      // Aggregate themes
      if (batchResult.aggregateThemes) {
        aggregated.commonThemes.praises.push(...(batchResult.aggregateThemes.praises || []));
        aggregated.commonThemes.criticisms.push(...(batchResult.aggregateThemes.criticisms || []));
      }

      // Aggregate insights
      if (batchResult.actionableInsights) {
        aggregated.promotionalQuotes.push(...(batchResult.actionableInsights.promotionalQuotes || []));
        aggregated.improvementOpportunities.push(...(batchResult.actionableInsights.improvementOpportunities || []));
        aggregated.redFlags.push(...(batchResult.actionableInsights.redFlags || []));
      }
    }

    // Calculate average sentiment score
    aggregated.averageSentimentScore = totalSentimentScore / originalReviews.length;

    // Deduplicate and consolidate themes
    aggregated.commonThemes = this.consolidateThemes(aggregated.commonThemes);

    return aggregated;
  }

  /**
   * Consolidate and deduplicate themes across batches
   */
  consolidateThemes(themes) {
    const praisesMap = new Map();
    const criticismsMap = new Map();

    // Aggregate praises
    for (const praise of themes.praises) {
      if (praisesMap.has(praise.theme)) {
        const existing = praisesMap.get(praise.theme);
        existing.count += praise.count;
        existing.examples = [...new Set([...existing.examples, ...praise.examples])];
      } else {
        praisesMap.set(praise.theme, { ...praise });
      }
    }

    // Aggregate criticisms
    for (const criticism of themes.criticisms) {
      if (criticismsMap.has(criticism.theme)) {
        const existing = criticismsMap.get(criticism.theme);
        existing.count += criticism.count;
        existing.examples = [...new Set([...existing.examples, ...criticism.examples])];
      } else {
        criticismsMap.set(criticism.theme, { ...criticism });
      }
    }

    return {
      praises: Array.from(praisesMap.values()).sort((a, b) => b.count - a.count),
      criticisms: Array.from(criticismsMap.values()).sort((a, b) => b.count - a.count)
    };
  }
}
