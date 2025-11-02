// Metadata Optimizer
// AI-powered metadata optimization for discoverability and sales

/**
 * Genre-specific keyword patterns for SEO
 */
const GENRE_KEYWORDS = {
  mystery: ['mystery', 'detective', 'crime', 'suspense', 'thriller', 'whodunit', 'investigation', 'murder'],
  thriller: ['thriller', 'suspense', 'action', 'conspiracy', 'espionage', 'tension', 'fast-paced'],
  romance: ['romance', 'love', 'relationship', 'contemporary', 'sweet', 'steamy', 'happily ever after'],
  fantasy: ['fantasy', 'magic', 'adventure', 'epic', 'quest', 'dragons', 'wizards', 'swords'],
  'science-fiction': ['sci-fi', 'space', 'future', 'dystopian', 'aliens', 'technology', 'time travel'],
  horror: ['horror', 'scary', 'supernatural', 'dark', 'terror', 'haunted', 'ghost'],
  literary: ['literary', 'contemporary', 'character-driven', 'thought-provoking', 'literary fiction'],
  'young-adult': ['YA', 'teen', 'coming of age', 'young adult', 'high school', 'first love'],
};

/**
 * BISAC category mappings by genre
 */
const BISAC_CATEGORIES = {
  mystery: [
    'FIC022000 - FICTION / Mystery & Detective / General',
    'FIC022020 - FICTION / Mystery & Detective / Cozy',
    'FIC022080 - FICTION / Mystery & Detective / Police Procedural',
    'FIC022070 - FICTION / Mystery & Detective / Private Investigators',
  ],
  thriller: [
    'FIC030000 - FICTION / Thrillers / General',
    'FIC031000 - FICTION / Thrillers / Suspense',
    'FIC031010 - FICTION / Thrillers / Psychological',
    'FIC006000 - FICTION / Thrillers / Crime',
  ],
  romance: [
    'FIC027000 - FICTION / Romance / General',
    'FIC027020 - FICTION / Romance / Contemporary',
    'FIC027070 - FICTION / Romance / Paranormal',
    'FIC027050 - FICTION / Romance / Historical',
  ],
  fantasy: [
    'FIC009000 - FICTION / Fantasy / General',
    'FIC009020 - FICTION / Fantasy / Epic',
    'FIC009010 - FICTION / Fantasy / Contemporary',
    'FIC009070 - FICTION / Fantasy / Urban',
  ],
  'science-fiction': [
    'FIC028000 - FICTION / Science Fiction / General',
    'FIC028010 - FICTION / Science Fiction / Action & Adventure',
    'FIC028050 - FICTION / Science Fiction / Space Opera',
    'FIC028030 - FICTION / Science Fiction / Cyberpunk',
  ],
  horror: [
    'FIC015000 - FICTION / Horror',
    'FIC015010 - FICTION / Horror / General',
  ],
  literary: [
    'FIC019000 - FICTION / Literary',
    'FIC045000 - FICTION / Family Life',
  ],
  'young-adult': [
    'YAF000000 - YOUNG ADULT FICTION / General',
    'YAF024000 - YOUNG ADULT FICTION / Fantasy',
    'YAF052000 - YOUNG ADULT FICTION / Romance',
  ],
};

/**
 * Pricing recommendations by genre and word count
 * @param {string} genre - Book genre
 * @param {number} wordCount - Total word count
 * @returns {Object} Pricing recommendations
 */
export function generatePricingRecommendations(genre, wordCount) {
  // Base pricing tiers
  const pricingTiers = {
    short: { min: 0.99, max: 2.99, recommended: 1.99 },      // < 40k words
    novella: { min: 2.99, max: 4.99, recommended: 3.99 },    // 40-60k words
    standard: { min: 2.99, max: 9.99, recommended: 4.99 },   // 60-100k words
    long: { min: 4.99, max: 12.99, recommended: 6.99 },      // > 100k words
  };

  // Determine length tier
  let tier = 'standard';
  if (wordCount < 40000) tier = 'short';
  else if (wordCount < 60000) tier = 'novella';
  else if (wordCount > 100000) tier = 'long';

  const basePricing = pricingTiers[tier];

  // Genre-specific adjustments
  const genreMultipliers = {
    'literary': 1.2,      // Literary commands premium
    'fantasy': 1.15,      // Epic fantasy readers expect value
    'science-fiction': 1.15,
    'thriller': 1.0,
    'mystery': 1.0,
    'romance': 0.95,      // Romance has competitive pricing
    'horror': 1.0,
    'young-adult': 0.9,   // YA tends to be priced lower
  };

  const multiplier = genreMultipliers[genre?.toLowerCase()] || 1.0;

  return {
    wordCount: wordCount,
    lengthCategory: tier,
    genre: genre,
    ebook: {
      min: parseFloat((basePricing.min * multiplier).toFixed(2)),
      max: parseFloat((basePricing.max * multiplier).toFixed(2)),
      recommended: parseFloat((basePricing.recommended * multiplier).toFixed(2)),
      sweet_spot: parseFloat((basePricing.recommended * multiplier).toFixed(2)),
    },
    paperback: {
      recommended: calculatePaperbackPrice(wordCount),
      note: 'Based on page count and printing costs',
    },
    reasoning: `${tier} length (${wordCount.toLocaleString()} words) in ${genre} genre`,
    kdp70Eligible: basePricing.recommended * multiplier >= 2.99 && basePricing.recommended * multiplier <= 9.99,
  };
}

/**
 * Calculate paperback pricing based on word count
 */
function calculatePaperbackPrice(wordCount) {
  // Rough estimate: 250 words per page
  const pages = Math.ceil(wordCount / 250);

  // Base cost + per-page cost + margin
  const printCost = 1.50 + (pages * 0.012); // Approximate KDP costs
  const recommended = printCost * 2.5; // 2.5x markup for reasonable margin

  return {
    min: parseFloat((printCost * 1.5).toFixed(2)),
    recommended: parseFloat(Math.max(recommended, 9.99).toFixed(2)), // Minimum $9.99 for perceived value
    estimatedPages: pages,
    estimatedPrintCost: parseFloat(printCost.toFixed(2)),
  };
}

/**
 * Generate SEO-optimized keywords
 * @param {string} genre - Book genre
 * @param {Array} themes - Themes extracted from manuscript
 * @param {string} title - Book title
 * @returns {Array} Optimized keywords
 */
export function generateSEOKeywords(genre, themes = [], title = '') {
  const keywords = new Set();

  // Add genre-specific keywords
  const genreKeys = GENRE_KEYWORDS[genre?.toLowerCase()] || [];
  genreKeys.forEach(k => keywords.add(k));

  // Add themes as keywords
  themes.slice(0, 5).forEach(theme => {
    if (typeof theme === 'string') {
      keywords.add(theme.toLowerCase());
    } else if (theme.name) {
      keywords.add(theme.name.toLowerCase());
    }
  });

  // Extract meaningful words from title
  if (title) {
    const titleWords = title.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !isCommonWord(word));
    titleWords.forEach(w => keywords.add(w));
  }

  // Convert to array and limit to 7 (Amazon KDP limit)
  return Array.from(keywords).slice(0, 7);
}

/**
 * Check if word is too common to be a good keyword
 */
function isCommonWord(word) {
  const common = ['the', 'and', 'but', 'for', 'with', 'from', 'this', 'that'];
  return common.includes(word.toLowerCase());
}

/**
 * Recommend BISAC categories
 * @param {string} genre - Primary genre
 * @param {Array} themes - Themes from manuscript
 * @returns {Array} Recommended BISAC categories
 */
export function recommendBISACCategories(genre, themes = []) {
  const categories = [];

  // Get primary genre categories
  const primaryCategories = BISAC_CATEGORIES[genre?.toLowerCase()] || BISAC_CATEGORIES.literary;
  categories.push(...primaryCategories.slice(0, 2));

  // Add secondary categories based on themes
  themes.forEach(theme => {
    const themeName = typeof theme === 'string' ? theme : theme.name;

    if (themeName?.toLowerCase().includes('romance') && !categories.some(c => c.includes('Romance'))) {
      categories.push('FIC027000 - FICTION / Romance / General');
    }
    if (themeName?.toLowerCase().includes('family') && !categories.some(c => c.includes('Family'))) {
      categories.push('FIC045000 - FICTION / Family Life');
    }
    if (themeName?.toLowerCase().includes('war') && !categories.some(c => c.includes('War'))) {
      categories.push('FIC032000 - FICTION / War & Military');
    }
  });

  // Limit to 3 categories (Amazon allows up to 10, but 3 is strategic)
  return categories.slice(0, 3);
}

/**
 * Optimize book description for discoverability
 * @param {string} description - Original description
 * @param {string} genre - Book genre
 * @param {Array} keywords - SEO keywords
 * @returns {Object} Optimized description with suggestions
 */
export function optimizeDescription(description, genre, keywords = []) {
  if (!description) {
    return {
      original: '',
      optimized: '',
      suggestions: ['Add a compelling hook in the first sentence', 'Include character names and stakes', 'End with a question or cliffhanger'],
      seoScore: 0,
    };
  }

  const suggestions = [];
  let seoScore = 0;

  // Check length (recommended 150-300 words for Amazon)
  const wordCount = description.split(/\s+/).length;
  if (wordCount < 100) {
    suggestions.push('Description is too short (< 100 words). Aim for 150-250 words.');
  } else if (wordCount > 300) {
    suggestions.push('Description is too long (> 300 words). Consider condensing to 150-250 words.');
  } else {
    seoScore += 20;
  }

  // Check for keywords
  const keywordsInDesc = keywords.filter(kw =>
    description.toLowerCase().includes(kw.toLowerCase())
  );

  if (keywordsInDesc.length >= 3) {
    seoScore += 30;
  } else {
    suggestions.push(`Include more keywords: ${keywords.slice(0, 5).join(', ')}`);
  }

  // Check for hook (compelling first sentence)
  const firstSentence = description.split(/[.!?]/)[0];
  if (firstSentence.length < 50) {
    suggestions.push('Strengthen opening hook - make the first sentence more compelling');
  } else {
    seoScore += 20;
  }

  // Check for call-to-action or cliffhanger ending
  const lastSentence = description.split(/[.!?]/).filter(s => s.trim()).pop();
  if (lastSentence?.includes('?') || lastSentence?.toLowerCase().includes('discover') || lastSentence?.toLowerCase().includes('find out')) {
    seoScore += 15;
  } else {
    suggestions.push('End with a question or call-to-action to engage readers');
  }

  // Check for genre-appropriate language
  const genreWords = GENRE_KEYWORDS[genre?.toLowerCase()] || [];
  const genreWordsInDesc = genreWords.filter(gw =>
    description.toLowerCase().includes(gw.toLowerCase())
  );

  if (genreWordsInDesc.length >= 2) {
    seoScore += 15;
  } else {
    suggestions.push(`Add genre-specific language: ${genreWords.slice(0, 3).join(', ')}`);
  }

  return {
    original: description,
    optimized: description, // Would apply AI improvements here
    suggestions: suggestions,
    seoScore: seoScore,
    wordCount: wordCount,
    keywordsFound: keywordsInDesc,
  };
}

/**
 * Generate A/B testing suggestions for titles and descriptions
 * @param {string} title - Current title
 * @param {string} description - Current description
 * @param {string} genre - Book genre
 * @returns {Object} A/B test variations
 */
export function generateABTestSuggestions(title, description, genre) {
  const variations = {
    titles: [],
    descriptions: [],
  };

  // Title variations
  if (title) {
    // Original
    variations.titles.push({
      version: 'A (Original)',
      text: title,
      strategy: 'Current title',
    });

    // Add subtitle variation
    if (!title.includes(':')) {
      variations.titles.push({
        version: 'B (With Subtitle)',
        text: `${title}: A ${genre} Novel`,
        strategy: 'Add genre identifier for clarity',
      });
    }

    // Genre-specific hook variation
    const genreHooks = {
      mystery: 'A Mystery',
      thriller: 'A Thriller',
      romance: 'A Love Story',
      fantasy: 'An Epic Fantasy',
    };

    const hook = genreHooks[genre?.toLowerCase()];
    if (hook && !title.toLowerCase().includes(hook.toLowerCase())) {
      variations.titles.push({
        version: 'C (Genre Hook)',
        text: `${title}: ${hook}`,
        strategy: 'Emphasize genre for target audience',
      });
    }
  }

  // Description variations
  if (description) {
    const sentences = description.split(/[.!?]/).filter(s => s.trim());

    // Original
    variations.descriptions.push({
      version: 'A (Original)',
      text: description,
      strategy: 'Current description',
    });

    // Question-leading version
    if (sentences.length > 0 && !sentences[0].includes('?')) {
      variations.descriptions.push({
        version: 'B (Question Lead)',
        text: `What would you do if...? ${description}`,
        strategy: 'Start with engagement question',
      });
    }

    // Review quote version (placeholder)
    variations.descriptions.push({
      version: 'C (With Review Quote)',
      text: `"A gripping page-turner!" - Early Reader\n\n${description}`,
      strategy: 'Lead with social proof (add real review when available)',
    });
  }

  return {
    titleVariations: variations.titles.slice(0, 3),
    descriptionVariations: variations.descriptions.slice(0, 3),
    testingRecommendation: 'Run each variation for 2 weeks, track click-through rate and conversions',
  };
}

/**
 * Analyze competitive positioning
 * @param {Object} manuscript - Manuscript metadata
 * @param {Object} categoryData - Category average data
 * @returns {Object} Competitive analysis
 */
export function analyzeCompetitivePosition(manuscript, categoryData = {}) {
  const analysis = {
    pricePosition: 'unknown',
    lengthPosition: 'unknown',
    descriptionPosition: 'unknown',
    recommendations: [],
  };

  // Price comparison
  if (manuscript.price && categoryData.averagePrice) {
    const priceDiff = manuscript.price - categoryData.averagePrice;
    if (priceDiff > 1) {
      analysis.pricePosition = 'premium';
      analysis.recommendations.push('Consider lowering price to match category average for better sales');
    } else if (priceDiff < -1) {
      analysis.pricePosition = 'budget';
      analysis.recommendations.push('Low price may signal lower quality - consider increasing to category average');
    } else {
      analysis.pricePosition = 'competitive';
    }
  }

  // Length comparison
  if (manuscript.word_count && categoryData.averageWordCount) {
    const lengthDiff = manuscript.word_count - categoryData.averageWordCount;
    if (lengthDiff > 20000) {
      analysis.lengthPosition = 'longer';
      analysis.recommendations.push('Longer than average - highlight "epic" or "complete" in description');
    } else if (lengthDiff < -20000) {
      analysis.lengthPosition = 'shorter';
      analysis.recommendations.push('Shorter than average - market as "quick read" or "novella"');
    } else {
      analysis.lengthPosition = 'standard';
    }
  }

  // Description length comparison
  if (manuscript.description && categoryData.averageDescriptionLength) {
    const descLength = manuscript.description.split(/\s+/).length;
    if (descLength < categoryData.averageDescriptionLength * 0.7) {
      analysis.descriptionPosition = 'brief';
      analysis.recommendations.push('Description is shorter than competitors - add more detail');
    } else if (descLength > categoryData.averageDescriptionLength * 1.3) {
      analysis.descriptionPosition = 'detailed';
      analysis.recommendations.push('Description is longer than competitors - consider condensing key points');
    } else {
      analysis.descriptionPosition = 'standard';
    }
  }

  return analysis;
}

/**
 * Generate complete metadata optimization report
 * @param {Object} manuscript - Manuscript data
 * @param {Object} options - Optimization options
 * @returns {Object} Complete optimization report
 */
export function generateOptimizationReport(manuscript, options = {}) {
  const {
    includeKeywords = true,
    includeCategories = true,
    includePricing = true,
    includeDescription = true,
    includeABTesting = true,
    categoryData = null,
  } = options;

  const report = {
    manuscriptId: manuscript.id,
    title: manuscript.title,
    genre: manuscript.genre,
    timestamp: Date.now(),
    optimizations: {},
  };

  // Keywords
  if (includeKeywords) {
    report.optimizations.keywords = {
      current: manuscript.keywords ? manuscript.keywords.split(',') : [],
      recommended: generateSEOKeywords(manuscript.genre, manuscript.themes || [], manuscript.title),
      strategy: 'Use high-volume, low-competition keywords from genre research',
    };
  }

  // Categories
  if (includeCategories) {
    report.optimizations.categories = {
      current: manuscript.categories ? manuscript.categories.split(',') : [],
      recommended: recommendBISACCategories(manuscript.genre, manuscript.themes || []),
      strategy: 'Select categories with good visibility but manageable competition',
    };
  }

  // Pricing
  if (includePricing) {
    report.optimizations.pricing = generatePricingRecommendations(
      manuscript.genre,
      manuscript.word_count || 80000
    );
  }

  // Description
  if (includeDescription) {
    report.optimizations.description = optimizeDescription(
      manuscript.description,
      manuscript.genre,
      report.optimizations.keywords?.recommended || []
    );
  }

  // A/B Testing
  if (includeABTesting) {
    report.optimizations.abTesting = generateABTestSuggestions(
      manuscript.title,
      manuscript.description,
      manuscript.genre
    );
  }

  // Competitive Analysis
  if (categoryData) {
    report.optimizations.competitive = analyzeCompetitivePosition(manuscript, categoryData);
  }

  // Overall score and priority actions
  report.overallScore = calculateOverallScore(report.optimizations);
  report.priorityActions = generatePriorityActions(report.optimizations);

  return report;
}

/**
 * Calculate overall optimization score
 */
function calculateOverallScore(optimizations) {
  let score = 0;
  let maxScore = 0;

  if (optimizations.description) {
    score += optimizations.description.seoScore;
    maxScore += 100;
  }

  if (optimizations.keywords) {
    score += optimizations.keywords.recommended.length >= 7 ? 100 : (optimizations.keywords.recommended.length / 7) * 100;
    maxScore += 100;
  }

  if (optimizations.categories) {
    score += optimizations.categories.recommended.length >= 3 ? 100 : (optimizations.categories.recommended.length / 3) * 100;
    maxScore += 100;
  }

  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

/**
 * Generate priority action items
 */
function generatePriorityActions(optimizations) {
  const actions = [];

  if (optimizations.description?.suggestions.length > 0) {
    actions.push({
      priority: 'high',
      action: optimizations.description.suggestions[0],
      category: 'description',
    });
  }

  if (optimizations.keywords?.recommended.length < 5) {
    actions.push({
      priority: 'high',
      action: 'Add more SEO keywords (target 7 keywords)',
      category: 'keywords',
    });
  }

  if (optimizations.pricing?.kdp70Eligible === false) {
    actions.push({
      priority: 'medium',
      action: 'Adjust pricing to qualify for KDP 70% royalty ($2.99-$9.99)',
      category: 'pricing',
    });
  }

  if (optimizations.competitive?.recommendations.length > 0) {
    actions.push({
      priority: 'medium',
      action: optimizations.competitive.recommendations[0],
      category: 'competitive',
    });
  }

  return actions.slice(0, 5);
}

export default {
  generatePricingRecommendations,
  generateSEOKeywords,
  recommendBISACCategories,
  optimizeDescription,
  generateABTestSuggestions,
  analyzeCompetitivePosition,
  generateOptimizationReport,
};
