// Platform Metadata Agent
// Generates platform-specific metadata for Amazon KDP, IngramSpark, Draft2Digital, etc.

import {
  callClaudeWithCostTracking,
  validateRequiredFields,
  storeAsset,
  AGENT_CONFIG
} from './agent-utils.js';

export class PlatformMetadataAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Generate metadata for all publishing platforms
   * @param {string} manuscriptKey - R2 key for manuscript
   * @param {Object} baseMetadata - Base book metadata (title, description, categories, keywords)
   * @param {string} platforms - Target platforms (kdp, ingramspark, draft2digital, all)
   * @param {string} userId - User ID for cost tracking
   * @param {string} manuscriptId - Manuscript ID for cost tracking
   * @returns {Object} Platform-specific metadata
   */
  async generatePlatformMetadata(manuscriptKey, baseMetadata, platforms, userId, manuscriptId) {
    console.log(`Generating metadata for platforms: ${platforms.join(', ')}`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    // Determine which platforms to generate for
    const targetPlatforms = platforms.includes('all')
      ? ['kdp', 'ingramspark', 'draft2digital', 'google_play', 'apple_books', 'kobo']
      : platforms;

    const results = {};

    // Generate metadata for each platform
    for (const platform of targetPlatforms) {
      results[platform] = await this.generateForPlatform(
        platform,
        baseMetadata,
        userId,
        manuscriptId
      );
    }

    // Store combined results
    const storageKey = `platform-metadata-${manuscriptId}-${Date.now()}`;
    await storeAsset(
      this.env.MANUSCRIPTS_PROCESSED,
      storageKey,
      'platform-metadata',
      {
        platforms: results,
        baseMetadata,
        generatedAt: new Date().toISOString()
      }
    );

    return results;
  }

  /**
   * Generate metadata for a specific platform
   */
  async generateForPlatform(platform, baseMetadata, userId, manuscriptId) {
    console.log(`Generating ${platform} metadata`);

    const {
      title,
      subtitle,
      seriesName,
      seriesNumber,
      description,
      keywords,
      categories,
      genre,
      targetAudience,
      contentRating,
      language = 'English',
      pageCount,
      wordCount,
      isbn,
      publicationDate
    } = baseMetadata;

    let prompt;

    switch (platform) {
      case 'kdp':
        prompt = this.getKDPPrompt(baseMetadata);
        break;
      case 'ingramspark':
        prompt = this.getIngramSparkPrompt(baseMetadata);
        break;
      case 'draft2digital':
        prompt = this.getDraft2DigitalPrompt(baseMetadata);
        break;
      case 'google_play':
        prompt = this.getGooglePlayPrompt(baseMetadata);
        break;
      case 'apple_books':
        prompt = this.getAppleBooksPrompt(baseMetadata);
        break;
      case 'kobo':
        prompt = this.getKoboPrompt(baseMetadata);
        break;
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }

    const metadata = await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.PRECISE,
      'PlatformMetadataAgent',
      this.env,
      userId,
      manuscriptId,
      'publishing',
      `generate_${platform}_metadata`
    );

    validateRequiredFields(metadata, ['platform'], 'Platform Metadata');

    return metadata;
  }

  /**
   * Generate Amazon KDP metadata prompt
   */
  getKDPPrompt(baseMetadata) {
    return `You are an expert Amazon KDP publishing specialist with deep knowledge of KDP requirements, BISAC categories, and Amazon's algorithm.

BOOK INFORMATION:
Title: ${baseMetadata.title}
${baseMetadata.subtitle ? `Subtitle: ${baseMetadata.subtitle}` : ''}
${baseMetadata.seriesName ? `Series: ${baseMetadata.seriesName} #${baseMetadata.seriesNumber}` : ''}
Genre: ${baseMetadata.genre}
Description: ${baseMetadata.description}
Keywords: ${baseMetadata.keywords?.join(', ') || 'None provided'}
Categories: ${baseMetadata.categories?.join(', ') || 'None provided'}
Target Audience: ${baseMetadata.targetAudience}
Content Rating: ${baseMetadata.contentRating}
Word Count: ${baseMetadata.wordCount}
Language: ${baseMetadata.language || 'English'}

TASK: Generate complete Amazon KDP metadata optimized for discoverability and sales.

REQUIREMENTS:

1. **BISAC CATEGORIES** (Select exactly 2)
   - Choose the 2 most specific and accurate BISAC categories
   - Use full BISAC code format (e.g., "FIC031080 - FICTION / Thrillers / Psychological")
   - Prioritize categories with good visibility but manageable competition

2. **7 KEYWORDS** (Amazon allows up to 7 keyword phrases)
   - Each keyword can be up to 50 characters
   - Mix of:
     * High-volume search terms (broad)
     * Specific niche terms (narrow but relevant)
     * Comparable author/title terms
     * Trope/theme terms
   - Avoid redundant words already in title/subtitle
   - No trademark violations

3. **DESCRIPTION** (4000 character limit)
   - Format with HTML tags: <b>, <i>, <u>, <br>, <p>
   - Opening hook (1-2 sentences)
   - Brief synopsis without spoilers
   - Key selling points/unique elements
   - Call to action
   - Optional: Series description if applicable
   - Use formatting to enhance readability

4. **TITLE & SUBTITLE OPTIMIZATION**
   - Recommend any tweaks for better searchability
   - Keyword opportunities in subtitle
   - Series title best practices

5. **CONTENT RATING**
   - Appropriate age suitability
   - Content warnings if needed
   - KDP Select eligibility check

6. **PRICING STRATEGY**
   - Recommended price range based on genre/length
   - 70% vs 35% royalty considerations
   - KU/KDP Select recommendations
   - Launch pricing strategy

7. **PUBLICATION DATE**
   - Pre-order strategy recommendations
   - Best day of week for genre
   - Avoid major holidays if applicable

8. **A+ CONTENT RECOMMENDATIONS**
   - Module suggestions for Amazon A+ content
   - Key visuals to include
   - Author story elements

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "platform": "kdp",
  "bisacCategories": [
    {
      "code": "FIC031080",
      "description": "FICTION / Thrillers / Psychological",
      "competitiveness": "medium",
      "visibility": "high",
      "rationale": "Primary genre, good visibility with manageable competition"
    }
  ],
  "keywords": [
    "psychological thriller dark secrets",
    "unreliable narrator suspense",
    "domestic thriller twisted family",
    "readers of Gillian Flynn",
    "psychological suspense page turner",
    "dark family secrets mystery",
    "gripping psychological fiction"
  ],
  "description": "<b>What if your closest family member was a stranger?</b><br><br><p>Description here...</p>",
  "title": {
    "recommended": "Original Title",
    "alternativeSuggestion": "Alternative Title: Subtitle for Keywords",
    "rationale": "Why this title/subtitle works for Amazon"
  },
  "contentRating": {
    "ageRating": "18+",
    "contentWarnings": ["violence", "strong language"],
    "kdpSelectEligible": true
  },
  "pricingStrategy": {
    "recommendedPrice": "$4.99",
    "royaltyRate": "70%",
    "priceRangeRationale": "Standard thriller pricing, word count supports $4.99",
    "launchStrategy": "$0.99 for first week, then $2.99 for month 1, $4.99 thereafter",
    "kdpSelect": {
      "recommended": true,
      "rationale": "New author benefits from KU exposure"
    }
  },
  "publicationTiming": {
    "recommendedDay": "Tuesday",
    "rationale": "Mid-week launches perform well for thrillers",
    "preOrderLength": "2 weeks",
    "preOrderRationale": "Build anticipation without long wait"
  },
  "aPlusContent": {
    "recommendedModules": [
      "Author Bio with photo",
      "Book excerpt preview",
      "Series overview (if series)",
      "Comparison chart (if series)"
    ],
    "keyVisuals": [
      "Author headshot",
      "Book cover variations",
      "Genre mood board"
    ]
  },
  "competitorResearch": {
    "comparableAuthors": ["Gillian Flynn", "Ruth Ware", "Lisa Jewell"],
    "comparableTitles": ["The Woman in the Window", "Behind Closed Doors"],
    "uniqueSellingPoints": ["What makes this book stand out"]
  },
  "seoOptimization": {
    "backendKeywords": ["Additional keyword suggestions not used in the 7 slots"],
    "algorithmTips": ["Tips for Amazon algorithm optimization"]
  }
}`;
  }

  /**
   * Generate IngramSpark metadata prompt
   */
  getIngramSparkPrompt(baseMetadata) {
    return `You are an expert IngramSpark publishing specialist with knowledge of ONIX, Thema codes, and print distribution.

BOOK INFORMATION:
Title: ${baseMetadata.title}
${baseMetadata.subtitle ? `Subtitle: ${baseMetadata.subtitle}` : ''}
Genre: ${baseMetadata.genre}
Description: ${baseMetadata.description}
Target Audience: ${baseMetadata.targetAudience}
Page Count: ${baseMetadata.pageCount || 'Unknown'}
ISBN: ${baseMetadata.isbn || 'To be assigned'}

TASK: Generate complete IngramSpark metadata for print and digital distribution.

REQUIREMENTS:

1. **THEMA CODES** (up to 5)
   - International subject categorization
   - Primary + secondary Thema codes
   - More specific than BISAC

2. **ONIX DATA**
   - Complete ONIX 3.0 metadata fields
   - Audience codes
   - Reading level if YA/children's

3. **DISTRIBUTION CHANNELS**
   - Recommended channels (bookstores, libraries, online, etc.)
   - Territory rights recommendations
   - Returns policy suggestions

4. **PRINT SPECIFICATIONS**
   - Recommended trim size for genre
   - Paper type (cream vs white)
   - Binding recommendations
   - Cover finish (matte vs glossy)

5. **PRICING RECOMMENDATIONS**
   - Print pricing (wholesale vs retail)
   - Digital pricing
   - International pricing considerations

Provide your response ONLY as valid JSON.

Return this exact structure:
{
  "platform": "ingramspark",
  "themaCodes": [
    {
      "code": "FH",
      "description": "Thriller / suspense",
      "isPrimary": true
    }
  ],
  "onixData": {
    "audienceCodes": ["01"],
    "audienceDescription": "General/trade",
    "readingLevel": "Adult",
    "contentWarnings": []
  },
  "distribution": {
    "channels": ["bookstores", "libraries", "online_retailers"],
    "territories": {
      "world": true,
      "restrictions": []
    },
    "returnsPolicy": "returnable",
    "rationale": "Wide distribution recommended for maximum exposure"
  },
  "printSpecifications": {
    "trimSize": "5.5 x 8.5 inches",
    "paperType": "cream",
    "binding": "perfectbound",
    "coverFinish": "matte",
    "rationale": "Standard thriller specs, professional appearance"
  },
  "pricing": {
    "printRetail": "$16.99",
    "printWholesale": "$8.50",
    "digitalRetail": "$4.99",
    "internationPricing": {
      "UK": "£12.99",
      "EUR": "€14.99",
      "AUD": "$22.99"
    },
    "rationale": "Competitive pricing for genre and page count"
  }
}`;
  }

  /**
   * Generate Draft2Digital metadata prompt
   */
  getDraft2DigitalPrompt(baseMetadata) {
    return `You are a Draft2Digital publishing expert specializing in wide distribution strategies.

BOOK INFORMATION:
Title: ${baseMetadata.title}
Genre: ${baseMetadata.genre}
Description: ${baseMetadata.description}
Keywords: ${baseMetadata.keywords?.join(', ')}

TASK: Generate Draft2Digital metadata optimized for wide distribution.

REQUIREMENTS:

1. **DISTRIBUTION PARTNERS**
   - Recommended D2D distribution channels
   - Platform-specific considerations

2. **UNIVERSAL BOOK LINK**
   - Configuration recommendations

3. **PRICING STRATEGY**
   - Platform-specific pricing
   - Regional pricing recommendations

4. **METADATA OPTIMIZATION**
   - Categories for each platform
   - Keywords for discovery

Provide response as JSON:
{
  "platform": "draft2digital",
  "distributionPartners": {
    "apple": { "include": true, "notes": "" },
    "barnes_noble": { "include": true, "notes": "" },
    "kobo": { "include": true, "notes": "" },
    "tolino": { "include": true, "notes": "" },
    "scribd": { "include": true, "notes": "" },
    "overdrive": { "include": true, "notes": "Library distribution" }
  },
  "universalBookLink": {
    "enabled": true,
    "customSlug": "author-title",
    "trackingRecommendations": []
  },
  "pricingByPlatform": {},
  "categoryMapping": {}
}`;
  }

  /**
   * Generate Google Play Books metadata prompt
   */
  getGooglePlayPrompt(baseMetadata) {
    return `Generate Google Play Books metadata for: ${baseMetadata.title}

Focus on: Google Play categories, pricing, preview length.

Return JSON with: platform, categories, pricing, preview_settings`;
  }

  /**
   * Generate Apple Books metadata prompt
   */
  getAppleBooksPrompt(baseMetadata) {
    return `Generate Apple Books metadata for: ${baseMetadata.title}

Focus on: Apple Books categories, pricing, preview settings.

Return JSON with: platform, categories, pricing, preview_settings, accessibility_features`;
  }

  /**
   * Generate Kobo metadata prompt
   */
  getKoboPrompt(baseMetadata) {
    return `Generate Kobo Writing Life metadata for: ${baseMetadata.title}

Focus on: Kobo categories, pricing, merchandising options.

Return JSON with: platform, categories, pricing, merchandising_tags`;
  }
}
