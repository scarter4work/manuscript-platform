/**
 * Market Analysis Agent for Amazon KDP
 *
 * Analyzes manuscripts and provides strategic recommendations for:
 * - Pricing strategy
 * - Amazon categories (BISAC codes)
 * - Keywords for Amazon SEO
 * - Competitive positioning
 * - Target audience profile
 *
 * Uses Claude API to analyze market trends and manuscript positioning
 */

export class MarketAnalysisAgent {
    constructor(anthropicApiKey) {
        this.apiKey = anthropicApiKey;
        this.apiUrl = 'https://api.anthropic.com/v1/messages';
    }

    /**
     * Perform complete market analysis
     */
    async analyzeMarket(manuscriptText, metadata = {}) {
        console.log('[Market Analysis] Starting comprehensive market analysis...');
        const startTime = Date.now();

        try {
            // Step 1: Genre and positioning analysis
            const genreAnalysis = await this.analyzeGenreAndPositioning(manuscriptText);

            // Step 2: Pricing strategy
            const pricingStrategy = await this.analyzePricingStrategy(genreAnalysis, metadata);

            // Step 3: Category recommendations
            const categoryRecommendations = await this.recommendCategories(genreAnalysis);

            // Step 4: Keyword strategy
            const keywordStrategy = await this.generateKeywordStrategy(genreAnalysis, manuscriptText);

            // Step 5: Target audience profile
            const audienceProfile = await this.analyzeTargetAudience(genreAnalysis, manuscriptText);

            // Step 6: Competitive positioning
            const competitivePositioning = await this.analyzeCompetitivePositioning(genreAnalysis, metadata);

            const duration = Date.now() - startTime;

            return {
                success: true,
                analysis: {
                    genreAnalysis,
                    pricingStrategy,
                    categoryRecommendations,
                    keywordStrategy,
                    audienceProfile,
                    competitivePositioning
                },
                metadata: {
                    duration,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('[Market Analysis] Error:', error);
            throw new Error(`Market analysis failed: ${error.message}`);
        }
    }

    /**
     * Analyze genre and market positioning
     */
    async analyzeGenreAndPositioning(manuscriptText) {
        console.log('[Market Analysis] Analyzing genre and positioning...');

        const prompt = `You are a publishing market analyst specializing in Amazon KDP. Analyze this manuscript excerpt and provide detailed genre classification and market positioning insights.

MANUSCRIPT EXCERPT:
${manuscriptText.substring(0, 15000)}

Provide a comprehensive analysis in JSON format with the following structure:
{
  "primaryGenre": "Main genre (e.g., Thriller, Romance, Fantasy)",
  "subGenres": ["List", "of", "specific", "subgenres"],
  "marketPosition": "Description of where this fits in the current market",
  "comparableTitles": ["List of 5-10 comparable bestselling titles"],
  "uniqueSellingPoints": ["What", "makes", "this", "unique"],
  "tropes": ["Common", "tropes", "present"],
  "tone": "Overall tone (e.g., dark, humorous, suspenseful)",
  "pacing": "Pacing style (e.g., fast-paced, slow-burn)",
  "targetAgeRange": "Target reader age (e.g., Adult 25-45, YA 14-18)",
  "marketSize": "small/medium/large - based on genre popularity",
  "competition": "low/medium/high - based on genre saturation"
}

Be specific and data-driven in your analysis.`;

        const response = await this.callClaude(prompt);
        return JSON.parse(this.extractJsonFromResponse(response));
    }

    /**
     * Analyze pricing strategy
     */
    async analyzePricingStrategy(genreAnalysis, metadata) {
        console.log('[Market Analysis] Analyzing pricing strategy...');

        const prompt = `You are a publishing pricing strategist for Amazon KDP. Based on the genre analysis below, recommend optimal pricing strategies.

GENRE ANALYSIS:
${JSON.stringify(genreAnalysis, null, 2)}

MANUSCRIPT DETAILS:
- Estimated word count: ${metadata.wordCount || 'Unknown'}
- Series: ${metadata.isSeries ? 'Yes' : 'No'}
- Author platform: ${metadata.authorPlatform || 'New author'}

Provide pricing recommendations in JSON format:
{
  "ebook": {
    "recommended": 2.99,
    "range": {"min": 0.99, "max": 4.99},
    "reasoning": "Explanation of pricing strategy",
    "competitivePosition": "Where this price sits in the market"
  },
  "paperback": {
    "recommended": 12.99,
    "range": {"min": 9.99, "max": 15.99},
    "reasoning": "Explanation based on page count and genre"
  },
  "launchStrategy": {
    "initialPrice": 0.99,
    "duration": "First 7 days",
    "normalPrice": 2.99,
    "reasoning": "Launch strategy explanation"
  },
  "kdpSelectRecommendation": {
    "recommend": true,
    "reasoning": "Whether to enroll in KDP Select and why"
  }
}

Consider genre standards, market competition, and author goals (visibility vs revenue).`;

        const response = await this.callClaude(prompt);
        return JSON.parse(this.extractJsonFromResponse(response));
    }

    /**
     * Recommend Amazon categories
     */
    async recommendCategories(genreAnalysis) {
        console.log('[Market Analysis] Recommending Amazon categories...');

        const prompt = `You are an Amazon KDP category expert. Based on the genre analysis, recommend the best BISAC categories for maximum visibility.

GENRE ANALYSIS:
${JSON.stringify(genreAnalysis, null, 2)}

Amazon allows up to 10 categories. Recommend categories in JSON format:
{
  "primary": [
    {
      "bisac": "FIC031000",
      "name": "FICTION / Thrillers / General",
      "competitiveness": "high/medium/low",
      "reasoning": "Why this category is recommended"
    }
  ],
  "secondary": [
    {
      "bisac": "FIC030000",
      "name": "FICTION / Thrillers / Suspense",
      "competitiveness": "medium",
      "reasoning": "Secondary category rationale"
    }
  ],
  "strategy": "Overall category selection strategy",
  "bestseller_potential": {
    "categories": ["List", "of", "categories", "with", "bestseller", "potential"],
    "reasoning": "Why these categories offer best ranking opportunities"
  }
}

Prioritize categories that balance:
1. Relevance to the book
2. Achievable bestseller rankings
3. Search discoverability
4. Competition level`;

        const response = await this.callClaude(prompt);
        return JSON.parse(this.extractJsonFromResponse(response));
    }

    /**
     * Generate keyword strategy
     */
    async generateKeywordStrategy(genreAnalysis, manuscriptText) {
        console.log('[Market Analysis] Generating keyword strategy...');

        const prompt = `You are an Amazon KDP SEO expert. Generate a comprehensive keyword strategy for maximum discoverability.

GENRE ANALYSIS:
${JSON.stringify(genreAnalysis, null, 2)}

MANUSCRIPT THEMES (extracted):
${this.extractThemes(manuscriptText)}

Amazon allows 7 keyword phrases. Generate a keyword strategy in JSON format:
{
  "keywords": [
    {
      "phrase": "psychological thriller suspense",
      "searchVolume": "high/medium/low (estimated)",
      "competition": "high/medium/low",
      "relevance": "10/10",
      "reasoning": "Why this keyword is valuable"
    }
  ],
  "alternativeKeywords": [
    "List of backup keyword phrases if primary keywords don't perform"
  ],
  "longtailStrategy": {
    "phrases": ["very", "specific", "niche", "phrases"],
    "reasoning": "Why longtail keywords matter for this book"
  },
  "avoidKeywords": [
    "Keywords to avoid (misleading, oversaturated, or irrelevant)"
  ],
  "seoTips": [
    "Additional tips for optimizing book discoverability"
  ]
}

Focus on:
- High-intent search terms (readers actively looking to buy)
- Genre-specific phrases
- Mood/tone descriptors
- Comparable title associations
- Unique plot elements`;

        const response = await this.callClaude(prompt);
        return JSON.parse(this.extractJsonFromResponse(response));
    }

    /**
     * Analyze target audience
     */
    async analyzeTargetAudience(genreAnalysis, manuscriptText) {
        console.log('[Market Analysis] Analyzing target audience...');

        const prompt = `You are a reader demographic analyst for publishing. Create a detailed target audience profile.

GENRE ANALYSIS:
${JSON.stringify(genreAnalysis, null, 2)}

SAMPLE CONTENT:
${manuscriptText.substring(0, 5000)}

IMPORTANT: Return ONLY valid JSON. No explanatory text before or after. No markdown code blocks.

Return a JSON object with this exact structure:
{
  "primaryAudience": {
    "ageRange": "25-45",
    "gender": "Primarily female (70%) but appeals to all",
    "demographics": "Education, income level, location patterns",
    "psychographics": "Values, interests, lifestyle",
    "readingHabits": "How they discover and consume books"
  },
  "secondaryAudience": {
    "description": "Secondary reader groups"
  },
  "readerMotivations": [
    "Why readers will choose this book",
    "What emotional needs it fulfills"
  ],
  "marketingChannels": [
    {
      "channel": "BookTok (TikTok)",
      "effectiveness": "high/medium/low",
      "reasoning": "Why this channel works for this audience"
    }
  ],
  "influencerTypes": [
    "Types of influencers who could promote this book"
  ],
  "seasonality": {
    "bestLaunchMonths": ["Month", "list"],
    "reasoning": "Why these months are optimal"
  }
}`;

        const response = await this.callClaude(prompt);
        return JSON.parse(this.extractJsonFromResponse(response));
    }

    /**
     * Analyze competitive positioning
     */
    async analyzeCompetitivePositioning(genreAnalysis, metadata) {
        console.log('[Market Analysis] Analyzing competitive positioning...');

        const prompt = `You are a publishing strategist analyzing competitive positioning in the Amazon marketplace.

GENRE ANALYSIS:
${JSON.stringify(genreAnalysis, null, 2)}

AUTHOR STATUS:
- Platform size: ${metadata.authorPlatform || 'New author (no existing audience)'}
- Previous publications: ${metadata.previousBooks || 0}
- Series potential: ${metadata.isSeries ? 'Yes' : 'No'}

Provide a competitive strategy in JSON format:
{
  "marketGap": {
    "description": "What gap this book fills in the market",
    "opportunity": "Why this timing/positioning is advantageous"
  },
  "competitiveAdvantages": [
    "Specific advantages this book has over competitors"
  ],
  "challenges": [
    "Competitive challenges to be aware of"
  ],
  "positioningStatement": "One-sentence positioning (e.g., 'For fans of X who want Y')",
  "differentiators": [
    "What makes this book stand out"
  ],
  "launchStrategy": {
    "approach": "aggressive/moderate/conservative",
    "reasoning": "Why this approach for this book",
    "timeline": "Recommended launch timeline",
    "tactics": ["Specific", "launch", "tactics"]
  },
  "longTermStrategy": {
    "firstYear": "Goals and tactics for first year",
    "seriesPotential": "If applicable, series development strategy",
    "platformBuilding": "How to build author platform alongside this book"
  }
}`;

        const response = await this.callClaude(prompt);
        return JSON.parse(this.extractJsonFromResponse(response));
    }

    /**
     * Call Claude API
     */
    async callClaude(prompt, maxTokens = 4000) {
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: maxTokens,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Claude API error: ${response.status} ${error}`);
        }

        const data = await response.json();
        return data.content[0].text;
    }

    /**
     * Extract JSON from Claude's response
     */
    extractJsonFromResponse(text) {
        // Try to find JSON block
        let jsonText = text;

        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                         text.match(/```\s*([\s\S]*?)\s*```/);

        if (jsonMatch) {
            jsonText = jsonMatch[1];
        } else {
            // Try to extract JSON object
            const objectMatch = text.match(/\{[\s\S]*\}/);
            if (objectMatch) {
                jsonText = objectMatch[0];
            }
        }

        // Clean up common JSON issues
        jsonText = jsonText
            .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
            .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // Quote unquoted keys
            .trim();

        // Try to parse and validate
        try {
            JSON.parse(jsonText);
            return jsonText;
        } catch (e) {
            // If parsing fails, return original text
            console.error('JSON parse error, returning original text:', e.message);
            return text;
        }
    }

    /**
     * Extract themes from manuscript
     */
    extractThemes(manuscriptText) {
        // Get first 3000 characters for theme extraction
        const sample = manuscriptText.substring(0, 3000);
        return sample;
    }

    /**
     * Generate formatted market analysis report
     */
    generateReport(analysis) {
        const { genreAnalysis, pricingStrategy, categoryRecommendations,
                keywordStrategy, audienceProfile, competitivePositioning } = analysis;

        return {
            title: 'Amazon KDP Market Analysis Report',
            sections: [
                {
                    title: 'Genre & Market Position',
                    data: genreAnalysis
                },
                {
                    title: 'Pricing Strategy',
                    data: pricingStrategy
                },
                {
                    title: 'Amazon Categories',
                    data: categoryRecommendations
                },
                {
                    title: 'Keyword Strategy',
                    data: keywordStrategy
                },
                {
                    title: 'Target Audience',
                    data: audienceProfile
                },
                {
                    title: 'Competitive Positioning',
                    data: competitivePositioning
                }
            ],
            summary: {
                primaryGenre: genreAnalysis.primaryGenre,
                recommendedEbookPrice: pricingStrategy.ebook.recommended,
                recommendedPaperbackPrice: pricingStrategy.paperback.recommended,
                topCategories: categoryRecommendations.primary.slice(0, 3).map(c => c.name),
                topKeywords: keywordStrategy.keywords.slice(0, 3).map(k => k.phrase),
                targetDemographic: audienceProfile.primaryAudience.ageRange,
                launchRecommendation: competitivePositioning.launchStrategy.approach
            }
        };
    }
}
