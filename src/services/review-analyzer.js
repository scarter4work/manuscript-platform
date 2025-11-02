// Review Analyzer
// Sentiment analysis, trend detection, and response generation for book reviews

/**
 * Sentiment categories
 */
export const SENTIMENT_TYPES = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
  MIXED: 'mixed',
};

/**
 * Review platforms
 */
export const PLATFORMS = {
  AMAZON: 'amazon',
  GOODREADS: 'goodreads',
  BOOKBUB: 'bookbub',
  MANUAL: 'manual', // Manually added reviews
};

/**
 * Analyze sentiment of a review
 * Uses simple keyword-based analysis (can be enhanced with Claude API)
 * @param {string} reviewText - The review text
 * @param {number} rating - Star rating (1-5)
 * @returns {Object} Sentiment analysis result
 */
export function analyzeSentiment(reviewText, rating = null) {
  const text = reviewText.toLowerCase();

  // Positive indicators
  const positiveWords = [
    'love', 'loved', 'amazing', 'excellent', 'great', 'wonderful', 'fantastic',
    'brilliant', 'perfect', 'beautiful', 'incredible', 'outstanding', 'superb',
    'masterpiece', 'compelling', 'engaging', 'captivating', 'gripping',
    'page-turner', 'recommend', 'highly recommend', 'best', 'favorite',
  ];

  // Negative indicators
  const negativeWords = [
    'hate', 'hated', 'terrible', 'awful', 'horrible', 'boring', 'slow',
    'disappointing', 'disappointed', 'waste', 'poor', 'bad', 'worst',
    'confusing', 'confused', 'predictable', 'cliche', 'weak', 'poorly',
    'uninteresting', 'tedious', 'not recommend', 'avoid',
  ];

  // Count sentiment indicators
  let positiveCount = 0;
  let negativeCount = 0;

  positiveWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) positiveCount += matches.length;
  });

  negativeWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) negativeCount += matches.length;
  });

  // Calculate sentiment score (-1 to 1)
  const totalCount = positiveCount + negativeCount;
  let sentimentScore = 0;

  if (totalCount > 0) {
    sentimentScore = (positiveCount - negativeCount) / totalCount;
  }

  // Factor in rating if available
  if (rating !== null) {
    const ratingScore = (rating - 3) / 2; // Convert 1-5 to -1 to 1
    sentimentScore = (sentimentScore + ratingScore) / 2; // Average with text sentiment
  }

  // Determine sentiment category
  let sentiment = SENTIMENT_TYPES.NEUTRAL;
  if (positiveCount > 0 && negativeCount > 0 && Math.abs(sentimentScore) < 0.3) {
    sentiment = SENTIMENT_TYPES.MIXED;
  } else if (sentimentScore > 0.2) {
    sentiment = SENTIMENT_TYPES.POSITIVE;
  } else if (sentimentScore < -0.2) {
    sentiment = SENTIMENT_TYPES.NEGATIVE;
  }

  return {
    sentiment: sentiment,
    score: sentimentScore,
    confidence: totalCount > 5 ? 'high' : totalCount > 2 ? 'medium' : 'low',
    positiveIndicators: positiveCount,
    negativeIndicators: negativeCount,
  };
}

/**
 * Extract common themes from multiple reviews
 * @param {Array} reviews - Array of review objects with text
 * @returns {Array} Common themes with counts
 */
export function extractThemes(reviews) {
  const themePatterns = {
    'plot': /plot|story|storyline|narrative/gi,
    'characters': /character|protagonist|hero|heroine|villain/gi,
    'pacing': /pacing|pace|slow|fast|rushed/gi,
    'writing_style': /writing|prose|style|written/gi,
    'world_building': /world|worldbuilding|setting|atmosphere/gi,
    'dialogue': /dialogue|conversation|talk|speak/gi,
    'ending': /ending|conclusion|finale|climax/gi,
    'twists': /twist|surprise|unexpected|shock/gi,
    'emotional_impact': /emotional|emotion|feel|feeling|cry|cried|laugh/gi,
    'romance': /romance|romantic|love story|relationship/gi,
    'suspense': /suspense|suspenseful|tension|thrilling/gi,
    'humor': /funny|humor|humorous|laugh|comedy/gi,
  };

  const themeCounts = {};
  const themeExamples = {};

  // Initialize counts
  Object.keys(themePatterns).forEach(theme => {
    themeCounts[theme] = 0;
    themeExamples[theme] = [];
  });

  // Count theme mentions
  reviews.forEach(review => {
    const text = review.review_text || '';

    Object.entries(themePatterns).forEach(([theme, pattern]) => {
      const matches = text.match(pattern);
      if (matches) {
        themeCounts[theme] += matches.length;

        // Extract example sentence
        if (themeExamples[theme].length < 3) {
          const sentences = text.split(/[.!?]+/);
          const exampleSentence = sentences.find(s => pattern.test(s));
          if (exampleSentence && exampleSentence.trim().length > 10) {
            themeExamples[theme].push(exampleSentence.trim());
          }
        }
      }
    });
  });

  // Convert to array and sort by frequency
  const themes = Object.entries(themeCounts)
    .filter(([_, count]) => count > 0)
    .map(([theme, count]) => ({
      theme: theme.replace('_', ' '),
      count: count,
      frequency: count / reviews.length,
      examples: themeExamples[theme],
    }))
    .sort((a, b) => b.count - a.count);

  return themes;
}

/**
 * Generate review summary statistics
 * @param {Array} reviews - Array of review objects
 * @returns {Object} Summary statistics
 */
export function generateReviewSummary(reviews) {
  if (reviews.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      sentimentBreakdown: {},
      platformBreakdown: {},
      recentTrend: 'stable',
    };
  }

  // Calculate average rating
  const ratingsSum = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
  const averageRating = ratingsSum / reviews.length;

  // Sentiment breakdown
  const sentimentBreakdown = {
    positive: 0,
    negative: 0,
    neutral: 0,
    mixed: 0,
  };

  reviews.forEach(review => {
    if (review.sentiment) {
      sentimentBreakdown[review.sentiment]++;
    }
  });

  // Platform breakdown
  const platformBreakdown = {};
  reviews.forEach(review => {
    const platform = review.platform || 'unknown';
    platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
  });

  // Recent trend (last 30 days vs previous 30 days)
  const now = Date.now() / 1000;
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
  const sixtyDaysAgo = now - (60 * 24 * 60 * 60);

  const recentReviews = reviews.filter(r => r.review_date >= thirtyDaysAgo);
  const previousReviews = reviews.filter(r => r.review_date >= sixtyDaysAgo && r.review_date < thirtyDaysAgo);

  let recentTrend = 'stable';
  if (recentReviews.length > 0 && previousReviews.length > 0) {
    const recentAvg = recentReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / recentReviews.length;
    const previousAvg = previousReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / previousReviews.length;

    if (recentAvg > previousAvg + 0.5) {
      recentTrend = 'improving';
    } else if (recentAvg < previousAvg - 0.5) {
      recentTrend = 'declining';
    }
  }

  return {
    totalReviews: reviews.length,
    averageRating: parseFloat(averageRating.toFixed(2)),
    sentimentBreakdown: sentimentBreakdown,
    platformBreakdown: platformBreakdown,
    recentTrend: recentTrend,
    recentReviewCount: recentReviews.length,
    ratingDistribution: getRatingDistribution(reviews),
  };
}

/**
 * Get rating distribution (1-5 stars)
 */
function getRatingDistribution(reviews) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  reviews.forEach(review => {
    const rating = Math.round(review.rating || 0);
    if (rating >= 1 && rating <= 5) {
      distribution[rating]++;
    }
  });

  return distribution;
}

/**
 * Generate AI response suggestion for a review
 * @param {Object} review - Review object
 * @param {string} authorName - Author's name
 * @returns {string} Suggested response
 */
export function generateResponseSuggestion(review, authorName = 'Author') {
  const sentiment = review.sentiment || SENTIMENT_TYPES.NEUTRAL;
  const rating = review.rating || 3;

  // Response templates based on sentiment
  const templates = {
    positive: [
      `Thank you so much for your wonderful review! I'm thrilled that you enjoyed the story. Your kind words mean the world to me as an author. Happy reading!`,
      `I'm so glad the book resonated with you! Thank you for taking the time to share your thoughts. Readers like you make the writing journey worthwhile!`,
      `What a wonderful review - thank you! I'm delighted that you connected with the characters and story. I hope you'll enjoy my future books as well!`,
    ],
    negative: [
      `Thank you for taking the time to share your feedback. I appreciate your honesty and will take your comments into consideration for future work. Every reader's perspective helps me grow as an author.`,
      `I'm sorry this book didn't resonate with you as I'd hoped. I appreciate you giving it a chance and sharing your thoughts. Your feedback is valuable as I continue to develop my craft.`,
      `Thank you for your honest review. I'm sorry the story didn't work for you. I genuinely appreciate readers who take the time to share constructive feedback.`,
    ],
    neutral: [
      `Thank you for reading and sharing your thoughts! I appreciate you taking the time to review the book. Happy reading!`,
      `Thanks for your feedback! I'm glad you gave the book a try. I hope you'll enjoy my future work as well.`,
      `I appreciate you taking the time to review my book. Thank you for being a reader!`,
    ],
    mixed: [
      `Thank you for your detailed and balanced review! I appreciate both your kind words and constructive feedback. Every reader brings their own perspective, and I value yours.`,
      `I'm glad you enjoyed some aspects of the story, and I appreciate your honest feedback on areas that didn't work as well for you. Thank you for taking the time to review!`,
    ],
  };

  // Select appropriate template
  const options = templates[sentiment] || templates.neutral;
  const baseResponse = options[Math.floor(Math.random() * options.length)];

  // Add personalization if review mentions specific elements
  const reviewText = review.review_text?.toLowerCase() || '';
  let personalization = '';

  if (reviewText.includes('character')) {
    personalization = " I'm especially glad the characters resonated with you.";
  } else if (reviewText.includes('plot') || reviewText.includes('story')) {
    personalization = " I'm so happy the story kept you engaged.";
  } else if (reviewText.includes('twist') || reviewText.includes('ending')) {
    personalization = " I'm thrilled you enjoyed the twists and ending.";
  }

  return baseResponse + personalization;
}

/**
 * Identify reviews needing urgent attention
 * (1-2 star reviews, trending negative, mentions specific issues)
 * @param {Array} reviews - Array of review objects
 * @returns {Array} Reviews flagged for attention
 */
export function flagReviewsForAttention(reviews) {
  const flagged = [];

  reviews.forEach(review => {
    const reasons = [];

    // Low rating
    if (review.rating && review.rating <= 2) {
      reasons.push('Low rating (2 stars or less)');
    }

    // Negative sentiment
    if (review.sentiment === SENTIMENT_TYPES.NEGATIVE) {
      reasons.push('Negative sentiment detected');
    }

    // Mentions issues
    const text = review.review_text?.toLowerCase() || '';
    const issueKeywords = [
      'error', 'mistake', 'typo', 'grammar', 'editing',
      'plagiarism', 'stolen', 'copied', 'offensive', 'inappropriate',
    ];

    issueKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        reasons.push(`Mentions: ${keyword}`);
      }
    });

    // Recent and visible (might impact sales)
    const daysSinceReview = (Date.now() / 1000 - review.review_date) / (24 * 60 * 60);
    if (daysSinceReview < 7 && review.rating <= 3) {
      reasons.push('Recent low-rating review (may impact visibility)');
    }

    if (reasons.length > 0) {
      flagged.push({
        ...review,
        flagReasons: reasons,
        priority: review.rating <= 2 ? 'high' : 'medium',
      });
    }
  });

  // Sort by priority and date
  flagged.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority === 'high' ? -1 : 1;
    }
    return b.review_date - a.review_date;
  });

  return flagged;
}

/**
 * Compare reviews to competitor benchmarks
 * @param {Object} bookStats - Book's review statistics
 * @param {Object} categoryAverage - Average for book's category
 * @returns {Object} Comparison analysis
 */
export function compareToCompetitors(bookStats, categoryAverage) {
  const comparison = {
    ratingVsAverage: bookStats.averageRating - categoryAverage.averageRating,
    reviewCountVsAverage: bookStats.totalReviews / (categoryAverage.averageReviewCount || 1),
    sentimentVsAverage: {},
    strengths: [],
    weaknesses: [],
    recommendations: [],
  };

  // Compare sentiment breakdown
  Object.keys(SENTIMENT_TYPES).forEach(type => {
    const bookPct = (bookStats.sentimentBreakdown[type] || 0) / bookStats.totalReviews * 100;
    const avgPct = (categoryAverage.sentimentBreakdown[type] || 0);
    comparison.sentimentVsAverage[type] = bookPct - avgPct;
  });

  // Identify strengths
  if (comparison.ratingVsAverage > 0.3) {
    comparison.strengths.push('Higher than average rating in category');
  }
  if (comparison.reviewCountVsAverage > 1.5) {
    comparison.strengths.push('Significantly more reviews than category average');
  }

  // Identify weaknesses
  if (comparison.ratingVsAverage < -0.3) {
    comparison.weaknesses.push('Lower than average rating in category');
    comparison.recommendations.push('Consider addressing common negative feedback themes');
  }
  if (comparison.reviewCountVsAverage < 0.5) {
    comparison.weaknesses.push('Fewer reviews than category average');
    comparison.recommendations.push('Increase marketing efforts to encourage more reviews');
  }

  return comparison;
}

export default {
  analyzeSentiment,
  extractThemes,
  generateReviewSummary,
  generateResponseSuggestion,
  flagReviewsForAttention,
  compareToCompetitors,
  SENTIMENT_TYPES,
  PLATFORMS,
};
