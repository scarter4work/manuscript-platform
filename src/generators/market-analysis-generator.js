/**
import crypto from 'crypto';

 * Market Analysis Generator
 * Analyzes Amazon marketplace for comparable titles and provides strategic recommendations
 *
 * Note: Since Amazon shut down their public API, this uses simulated comp title data.
 * In production, you would integrate with:
 * - Amazon Product Advertising API (requires approval)
 * - Web scraping (with rate limiting)
 * - Third-party data providers (Jungle Scout, Helium 10, etc.)
 */

/**
 * Simulate Amazon comp title search
 * In production, replace with actual Amazon API or web scraping
 * @param {Object} params - Search parameters
 * @returns {Array} Array of comp titles
 */
async function searchAmazonCompTitles(params) {
  const { genre, keywords, limit = 50 } = params;

  // Simulated comp titles data
  // In production, this would call Amazon API or scrape Amazon search results
  const genreData = {
    'thriller': {
      priceRange: [2.99, 9.99],
      avgRating: 4.2,
      avgReviews: 1200,
      bestsellerRanks: [5000, 50000],
      categories: ['Mystery, Thriller & Suspense', 'Crime Fiction', 'Psychological Thrillers']
    },
    'romance': {
      priceRange: [0.99, 4.99],
      avgRating: 4.3,
      avgReviews: 800,
      bestsellerRanks: [3000, 40000],
      categories: ['Contemporary Romance', 'Romantic Suspense', 'Women\'s Fiction']
    },
    'fantasy': {
      priceRange: [3.99, 9.99],
      avgRating: 4.4,
      avgReviews: 1500,
      bestsellerRanks: [8000, 60000],
      categories: ['Epic Fantasy', 'Urban Fantasy', 'Sword & Sorcery']
    },
    'science fiction': {
      priceRange: [3.99, 9.99],
      avgRating: 4.3,
      avgReviews: 1100,
      bestsellerRanks: [10000, 70000],
      categories: ['Space Opera', 'Dystopian', 'Hard Science Fiction']
    },
    'mystery': {
      priceRange: [2.99, 7.99],
      avgRating: 4.2,
      avgReviews: 900,
      bestsellerRanks: [6000, 45000],
      categories: ['Cozy Mystery', 'Police Procedurals', 'Detective Fiction']
    }
  };

  const genreStats = genreData[genre.toLowerCase()] || {
    priceRange: [2.99, 9.99],
    avgRating: 4.2,
    avgReviews: 1000,
    bestsellerRanks: [5000, 50000],
    categories: ['Fiction', 'Literature & Fiction']
  };

  const compTitles = [];
  for (let i = 0; i < limit; i++) {
    const priceVariation = Math.random() * 0.4 - 0.2; // ±20% variation
    const basePrice = genreStats.priceRange[0] +
      Math.random() * (genreStats.priceRange[1] - genreStats.priceRange[0]);
    const price = Math.max(0.99, basePrice * (1 + priceVariation));

    const ratingVariation = Math.random() * 0.6 - 0.3; // ±0.3 variation
    const rating = Math.max(3.0, Math.min(5.0, genreStats.avgRating + ratingVariation));

    const reviewVariation = Math.random() * 1.0 - 0.5; // ±50% variation
    const reviews = Math.max(10, Math.floor(genreStats.avgReviews * (1 + reviewVariation)));

    const rankVariation = Math.random() * 2.0 - 0.5; // Wide variation
    const rank = Math.max(100, Math.floor(
      genreStats.bestsellerRanks[0] +
      Math.random() * (genreStats.bestsellerRanks[1] - genreStats.bestsellerRanks[0])
    ) * (1 + rankVariation));

    compTitles.push({
      asin: `B0${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      title: `${genre} Book ${i + 1}`,
      author: `Author ${Math.floor(Math.random() * 1000)}`,
      price_usd: parseFloat(price.toFixed(2)),
      bestseller_rank: rank,
      review_count: reviews,
      average_rating: parseFloat(rating.toFixed(1)),
      genre: genre,
      categories: genreStats.categories,
      format: Math.random() > 0.2 ? 'Kindle Edition' : 'Paperback',
      kdp_select: Math.random() > 0.5 ? 1 : 0
    });
  }

  return compTitles;
}

/**
 * Analyze pricing from comp titles
 * @param {Array} compTitles - Array of comp title objects
 * @returns {Object} Pricing analysis
 */
function analyzePricing(compTitles) {
  const prices = compTitles.map(ct => ct.price_usd).filter(p => p > 0).sort((a, b) => a - b);

  if (prices.length === 0) {
    return {
      min: 2.99,
      max: 9.99,
      avg: 4.99,
      median: 4.99,
      p25: 3.99,
      p75: 5.99,
      recommended: 4.99,
      confidence: 0.5
    };
  }

  const sum = prices.reduce((a, b) => a + b, 0);
  const avg = sum / prices.length;
  const median = prices[Math.floor(prices.length / 2)];
  const p25 = prices[Math.floor(prices.length * 0.25)];
  const p75 = prices[Math.floor(prices.length * 0.75)];

  // Bestseller average (top 20%)
  const topSellers = compTitles
    .sort((a, b) => a.bestseller_rank - b.bestseller_rank)
    .slice(0, Math.ceil(compTitles.length * 0.2));
  const bestsellerAvg = topSellers.reduce((sum, ct) => sum + ct.price_usd, 0) / topSellers.length;

  // High-rated average (4.5+)
  const highRated = compTitles.filter(ct => ct.average_rating >= 4.5);
  const highRatedAvg = highRated.length > 0
    ? highRated.reduce((sum, ct) => sum + ct.price_usd, 0) / highRated.length
    : avg;

  // Recommended price (weighted toward bestsellers and high-rated)
  const recommended = (bestsellerAvg * 0.4 + highRatedAvg * 0.3 + median * 0.3);

  // Confidence based on sample size and distribution
  const stdDev = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length);
  const cv = stdDev / avg; // Coefficient of variation
  const sampleFactor = Math.min(1.0, prices.length / 50); // More samples = higher confidence
  const distributionFactor = Math.max(0.5, 1.0 - cv); // Lower variation = higher confidence
  const confidence = sampleFactor * distributionFactor;

  return {
    min: prices[0],
    max: prices[prices.length - 1],
    avg: parseFloat(avg.toFixed(2)),
    median: parseFloat(median.toFixed(2)),
    p25: parseFloat(p25.toFixed(2)),
    p75: parseFloat(p75.toFixed(2)),
    bestsellerAvg: parseFloat(bestsellerAvg.toFixed(2)),
    highRatedAvg: parseFloat(highRatedAvg.toFixed(2)),
    recommended: parseFloat(recommended.toFixed(2)),
    confidence: parseFloat(confidence.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),
    sampleSize: prices.length
  };
}

/**
 * Extract and analyze categories from comp titles
 * @param {Array} compTitles - Array of comp title objects
 * @returns {Object} Category analysis
 */
function analyzeCategories(compTitles) {
  const categoryFrequency = {};
  const categoryPerformance = {};

  compTitles.forEach(ct => {
    if (!ct.categories) return;

    const categories = Array.isArray(ct.categories) ? ct.categories : [ct.categories];
    categories.forEach(cat => {
      if (!categoryFrequency[cat]) {
        categoryFrequency[cat] = 0;
        categoryPerformance[cat] = { totalRank: 0, count: 0, avgRating: 0 };
      }
      categoryFrequency[cat]++;
      categoryPerformance[cat].totalRank += ct.bestseller_rank || 100000;
      categoryPerformance[cat].count++;
      categoryPerformance[cat].avgRating += ct.average_rating || 4.0;
    });
  });

  // Calculate average performance per category
  Object.keys(categoryPerformance).forEach(cat => {
    const perf = categoryPerformance[cat];
    perf.avgRank = perf.totalRank / perf.count;
    perf.avgRating = perf.avgRating / perf.count;
  });

  // Score categories (frequency + performance)
  const categoryScores = Object.entries(categoryFrequency).map(([cat, freq]) => {
    const perf = categoryPerformance[cat];
    // Score: frequency (40%) + inverse rank (30%) + rating (30%)
    const freqScore = Math.min(1.0, freq / compTitles.length);
    const rankScore = Math.max(0, 1.0 - (perf.avgRank / 100000)); // Lower rank = better
    const ratingScore = perf.avgRating / 5.0;
    const totalScore = freqScore * 0.4 + rankScore * 0.3 + ratingScore * 0.3;

    return {
      category: cat,
      frequency: freq,
      avgRank: Math.floor(perf.avgRank),
      avgRating: parseFloat(perf.avgRating.toFixed(2)),
      score: parseFloat(totalScore.toFixed(3))
    };
  });

  // Sort by score and return top 10
  categoryScores.sort((a, b) => b.score - a.score);
  const top10 = categoryScores.slice(0, 10);

  return {
    recommended: top10.map(c => c.category),
    scores: Object.fromEntries(top10.map(c => [c.category, c.score])),
    details: top10
  };
}

/**
 * Extract keywords from comp titles
 * @param {Array} compTitles - Array of comp title objects
 * @param {string} genre - Manuscript genre
 * @returns {Object} Keyword recommendations
 */
function analyzeKeywords(compTitles, genre) {
  // In production, this would analyze:
  // - Title words frequency
  // - Subtitle patterns
  // - Category keywords
  // - Review text mining

  // Simulated keyword extraction based on genre
  const genreKeywords = {
    'thriller': [
      'psychological thriller',
      'suspense thriller',
      'crime thriller',
      'domestic thriller',
      'page turner',
      'twisty plot',
      'unreliable narrator'
    ],
    'romance': [
      'contemporary romance',
      'romantic comedy',
      'second chance romance',
      'enemies to lovers',
      'small town romance',
      'happily ever after',
      'steamy romance'
    ],
    'fantasy': [
      'epic fantasy',
      'sword and sorcery',
      'magic system',
      'coming of age fantasy',
      'dragons and magic',
      'fantasy adventure',
      'high fantasy'
    ],
    'science fiction': [
      'space opera',
      'dystopian future',
      'time travel',
      'first contact',
      'hard science fiction',
      'cyberpunk',
      'post apocalyptic'
    ],
    'mystery': [
      'cozy mystery',
      'detective mystery',
      'whodunit',
      'amateur sleuth',
      'police procedural',
      'murder mystery',
      'small town mystery'
    ]
  };

  const keywords = genreKeywords[genre.toLowerCase()] || [
    'contemporary fiction',
    'literary fiction',
    'character driven',
    'thought provoking',
    'emotional journey',
    'book club pick',
    'compelling story'
  ];

  // Assign simulated search volumes and competition scores
  const keywordData = keywords.slice(0, 7).map((kw, idx) => {
    const searchVolume = Math.floor(Math.random() * 50000) + 10000;
    const competition = Math.random() * 0.5 + 0.3; // 0.3 to 0.8
    const relevance = 1.0 - (idx * 0.1); // Decreasing relevance

    return {
      keyword: kw,
      searchVolume,
      competition: parseFloat(competition.toFixed(2)),
      relevance: parseFloat(relevance.toFixed(2))
    };
  });

  return {
    recommended: keywordData.map(k => k.keyword),
    searchVolumes: Object.fromEntries(keywordData.map(k => [k.keyword, k.searchVolume])),
    competitionScores: Object.fromEntries(keywordData.map(k => [k.keyword, k.competition])),
    details: keywordData
  };
}

/**
 * Analyze market positioning and competitive landscape
 * @param {Array} compTitles - Array of comp title objects
 * @param {Object} pricingAnalysis - Pricing analysis results
 * @returns {Object} Market positioning analysis
 */
function analyzeMarketPositioning(compTitles, pricingAnalysis) {
  // Calculate market saturation
  const avgReviews = compTitles.reduce((sum, ct) => sum + ct.review_count, 0) / compTitles.length;
  const avgRank = compTitles.reduce((sum, ct) => sum + ct.bestseller_rank, 0) / compTitles.length;

  let saturationLevel = 'medium';
  if (avgReviews > 2000 && avgRank < 20000) saturationLevel = 'high';
  else if (avgReviews < 500 || avgRank > 60000) saturationLevel = 'low';

  // Identify market gaps
  const priceGaps = [];
  if (pricingAnalysis.min > 1.99) {
    priceGaps.push('budget_price_point');
  }
  if (pricingAnalysis.max < 12.99) {
    priceGaps.push('premium_price_point');
  }

  const ratingGaps = compTitles.filter(ct => ct.average_rating < 3.5).length / compTitles.length;
  if (ratingGaps > 0.3) {
    priceGaps.push('quality_opportunity');
  }

  // Trend direction (simulated)
  const trendDirection = Math.random() > 0.5 ? 'growing' : 'stable';

  // Competitive advantages to highlight
  const advantages = [];
  if (pricingAnalysis.recommended < pricingAnalysis.median) {
    advantages.push('Competitive pricing below market median');
  }
  if (saturationLevel === 'low') {
    advantages.push('Low competition - easier to stand out');
  }
  if (priceGaps.includes('quality_opportunity')) {
    advantages.push('Quality gap - opportunity for 4.5+ rated book');
  }

  return {
    saturationLevel,
    trendDirection,
    marketGaps: priceGaps,
    competitiveAdvantages: advantages,
    avgMarketReviews: Math.floor(avgReviews),
    avgMarketRank: Math.floor(avgRank)
  };
}

/**
 * Generate market analysis report using Claude API
 * @param {Object} params - Analysis parameters
 * @param {Object} env - Cloudflare environment
 * @returns {Object} Complete market analysis
 */
export async function generateMarketAnalysis(params, env) {
  const {
    manuscriptId,
    userId,
    genre,
    keywords = [],
    compTitlesLimit = 50
  } = params;

  const startTime = Date.now();

  try {
    // 1. Search for comp titles
    const compTitles = await searchAmazonCompTitles({
      genre,
      keywords,
      limit: compTitlesLimit
    });

    // 2. Analyze pricing
    const pricingAnalysis = analyzePricing(compTitles);

    // 3. Analyze categories
    const categoryAnalysis = analyzeCategories(compTitles);

    // 4. Analyze keywords
    const keywordAnalysis = analyzeKeywords(compTitles, genre);

    // 5. Analyze market positioning
    const positioningAnalysis = analyzeMarketPositioning(compTitles, pricingAnalysis);

    // 6. Generate strategic report using Claude API
    const reportData = await generateStrategicReport({
      genre,
      compTitles,
      pricingAnalysis,
      categoryAnalysis,
      keywordAnalysis,
      positioningAnalysis
    }, env);

    const duration = Date.now() - startTime;

    return {
      success: true,
      analysis: {
        compTitles,
        compTitlesCount: compTitles.length,
        pricing: pricingAnalysis,
        categories: categoryAnalysis,
        keywords: keywordAnalysis,
        positioning: positioningAnalysis,
        report: reportData.report,
        summary: reportData.summary
      },
      cost: reportData.cost,
      duration
    };
  } catch (error) {
    console.error('Error generating market analysis:', error);
    throw error;
  }
}

/**
 * Generate strategic report using Claude API
 * @param {Object} data - Analysis data
 * @param {Object} env - Cloudflare environment
 * @returns {Object} Report text and cost
 */
async function generateStrategicReport(data, env) {
  const {
    genre,
    compTitles,
    pricingAnalysis,
    categoryAnalysis,
    keywordAnalysis,
    positioningAnalysis
  } = data;

  const systemPrompt = `You are a publishing market analyst specializing in Amazon Kindle Direct Publishing (KDP) strategy. Your role is to analyze marketplace data and provide actionable recommendations for indie authors.

Focus on:
1. Data-driven pricing strategies
2. Category selection for maximum discoverability
3. Keyword optimization for Amazon SEO
4. Competitive positioning
5. Market timing and trends

Be specific, actionable, and realistic. Avoid generic advice.`;

  const userPrompt = `Analyze this ${genre} market data and provide strategic recommendations:

**Comparable Titles Analyzed:** ${compTitles.length} books

**Pricing Analysis:**
- Price Range: $${pricingAnalysis.min} - $${pricingAnalysis.max}
- Average Price: $${pricingAnalysis.avg}
- Median Price: $${pricingAnalysis.median}
- Bestseller Average: $${pricingAnalysis.bestsellerAvg}
- High-Rated (4.5+) Average: $${pricingAnalysis.highRatedAvg}
- Recommended Price: $${pricingAnalysis.recommended}
- Confidence Score: ${pricingAnalysis.confidence}

**Category Analysis:**
Top Categories: ${categoryAnalysis.recommended.slice(0, 5).join(', ')}

**Keyword Analysis:**
Recommended Keywords: ${keywordAnalysis.recommended.join(', ')}

**Market Positioning:**
- Saturation Level: ${positioningAnalysis.saturationLevel}
- Trend Direction: ${positioningAnalysis.trendDirection}
- Market Gaps: ${positioningAnalysis.marketGaps.join(', ') || 'None identified'}
- Average Market Reviews: ${positioningAnalysis.avgMarketReviews}
- Average Market Rank: ${positioningAnalysis.avgMarketRank}

Generate a comprehensive market analysis report with:
1. **Executive Summary** (3-4 sentences)
2. **Pricing Strategy** (recommended price with rationale)
3. **Category Recommendations** (top 5 categories with reasoning)
4. **Keyword Strategy** (7 keyword phrases with search intent)
5. **Competitive Positioning** (how to stand out)
6. **Market Timing** (best launch strategy)
7. **Action Items** (concrete next steps)

Format in markdown with clear sections and bullet points.`;

  const apiUrl = 'https://api.anthropic.com/v1/messages';
  const requestBody = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4000,
    temperature: 0.7,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt
      }
    ]
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const reportText = result.content[0].text;

  // Extract executive summary (first section)
  const summaryMatch = reportText.match(/##\s*Executive Summary\s*\n\n([\s\S]*?)(?=\n##|$)/i);
  const summary = summaryMatch ? summaryMatch[1].trim() : reportText.substring(0, 500);

  // Calculate cost
  const inputTokens = result.usage.input_tokens;
  const outputTokens = result.usage.output_tokens;
  const cost = (inputTokens / 1000000 * 3.00) + (outputTokens / 1000000 * 15.00);

  return {
    report: reportText,
    summary,
    cost: parseFloat(cost.toFixed(4)),
    tokens: {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens
    }
  };
}

/**
 * Save comp titles to database
 * @param {Array} compTitles - Array of comp title objects
 * @param {Object} env - Cloudflare environment
 * @returns {Array} Array of saved comp title IDs
 */
export async function saveCompTitles(compTitles, env) {
  const savedIds = [];

  for (const ct of compTitles) {
    const id = `comp-${crypto.randomUUID()}`;

    try {
      await env.DB.prepare(`
        INSERT OR REPLACE INTO comp_titles (
          id, asin, title, author, price_usd, bestseller_rank,
          review_count, average_rating, genre, categories,
          format, kdp_select, last_scraped_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        ct.asin,
        ct.title,
        ct.author || 'Unknown',
        ct.price_usd,
        ct.bestseller_rank,
        ct.review_count,
        ct.average_rating,
        ct.genre,
        JSON.stringify(ct.categories),
        ct.format,
        ct.kdp_select ? 1 : 0,
        Math.floor(Date.now() / 1000)
      ).run();

      savedIds.push(id);
    } catch (error) {
      console.error(`Error saving comp title ${ct.asin}:`, error);
    }
  }

  return savedIds;
}
