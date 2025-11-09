// Category Agent
// Recommends BISAC categories for Amazon KDP

export class CategoryAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Generate category recommendations from developmental analysis
   * @param {string} manuscriptKey - R2 key for the manuscript
   * @param {Object} developmentalAnalysis - Results from developmental agent
   * @param {string} genre - Book genre
   * @returns {Object} Recommended categories
   */
  async generate(manuscriptKey, developmentalAnalysis, genre) {
    console.log(`Generating category recommendations for ${manuscriptKey}`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    const analysis = developmentalAnalysis.analysis || developmentalAnalysis;
    const compTitles = developmentalAnalysis.compTitles || [];

    const categories = await this.generateCategories(analysis, genre, compTitles);

    // Store results
    await this.storeCategories(manuscriptKey, categories);

    return {
      manuscriptKey,
      categories,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate category recommendations using Claude
   */
  async generateCategories(analysis, genre, compTitles) {
    const compTitlesText = compTitles.length > 0
      ? compTitles.map(t => `${t.title} by ${t.author}`).join(', ')
      : 'N/A';

    const prompt = `You are an expert in Amazon KDP category selection and BISAC classification codes.

STORY ANALYSIS:
Genre: ${genre}
Overall Score: ${analysis.overallScore}/10
Plot Strengths: ${analysis.plot?.strengths?.join(', ') || 'N/A'}
Character Elements: ${analysis.characters?.strengths?.join(', ') || 'N/A'}
Key Themes: ${analysis.topPriorities?.join(', ') || 'N/A'}
Genre Strengths: ${analysis.genreFit?.strengths?.join(', ') || 'N/A'}
Voice/Style: ${analysis.voice?.strengths?.join(', ') || 'N/A'}

COMPARABLE TITLES:
${compTitlesText}

TASK: Recommend the best BISAC categories for this book to maximize discoverability on Amazon.

AMAZON CATEGORY REQUIREMENTS:
- Recommend 5-10 BISAC categories
- Include 1-2 primary categories (broadest reach, most accurate)
- Include 3-5 secondary categories (more specific, niche targeting)
- Include 2-3 alternative categories (edge cases, cross-genre appeal)
- Use proper BISAC format: CODE / Full Name
- Categories should be ranked by relevance (most relevant first)

BISAC CATEGORY EXAMPLES (Fiction):
- FIC030000 / FICTION / Thrillers / Suspense
- FIC022040 / FICTION / Mystery & Detective / Police Procedural
- FIC031010 / FICTION / Thrillers / Crime
- FIC022020 / FICTION / Mystery & Detective / Hard-Boiled
- FIC031070 / FICTION / Thrillers / Psychological
- FIC045000 / FICTION / Family Life / General
- FIC027110 / FICTION / Romance / Contemporary
- FIC009000 / FICTION / Fantasy / General
- FIC028000 / FICTION / Science Fiction / General
- FIC061000 / FICTION / Fairy Tales, Folk Tales, Legends & Mythology

COMMON BISAC CODES:
Thriller: FIC030000, FIC031010, FIC031070 (psychological)
Mystery: FIC022000, FIC022040 (police), FIC022020 (hard-boiled)
Romance: FIC027000, FIC027110 (contemporary), FIC027020 (suspense)
Fantasy: FIC009000, FIC009020 (epic), FIC009070 (urban)
Sci-Fi: FIC028000, FIC028010 (action), FIC028050 (space opera)
Horror: FIC015000, FIC015010 (ghost), FIC015020 (occult)
Literary: FIC019000
Women's Fiction: FIC044000

STRATEGY:
1. Start with the primary genre category
2. Add the most specific subgenre that fits
3. Consider cross-genre categories if applicable (e.g., thriller + romance)
4. Include character-type categories (e.g., women sleuths, LGBTQ+)
5. Add thematic categories that match story elements
6. Look at where comparable titles are categorized
7. Balance between competitive and niche categories

IMPORTANT:
- Use real BISAC codes (format: XXXNNN### where X=FIC/NON, N=numbers)
- Avoid overly broad categories unless truly applicable
- Don't force categories that don't fit just to reach 10
- Explain WHY each category fits the book

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "primary": [
    {
      "code": "FIC030000",
      "name": "FICTION / Thrillers / Suspense",
      "rationale": "Why this is the best primary category",
      "competitionLevel": "high/medium/low",
      "estimatedRanking": "Estimated sales rank potential in this category"
    }
  ],
  "secondary": [
    {
      "code": "FIC022040",
      "name": "FICTION / Mystery & Detective / Police Procedural",
      "rationale": "Why this secondary category fits",
      "competitionLevel": "high/medium/low",
      "estimatedRanking": "Ranking potential"
    }
  ],
  "alternative": [
    {
      "code": "FIC031070",
      "name": "FICTION / Thrillers / Psychological",
      "rationale": "Why this alternative makes sense",
      "competitionLevel": "high/medium/low",
      "estimatedRanking": "Ranking potential"
    }
  ],
  "recommendations": [
    "Additional advice for category selection",
    "Tips for this specific book"
  ]
}`;

    // Retry logic with exponential backoff
    const maxRetries = 5;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Category Generation - Attempt ${attempt}/${maxRetries}`);

        const gatewayUrl = 'https://gateway.ai.cloudflare.com/v1/8cd795daa8ce3c17078fe6cf3a2de8e3/manuscript-ai-gateway/anthropic/v1/messages';

        const response = await fetch(gatewayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.claudeApiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 3072,
            messages: [{
              role: 'user',
              content: prompt
            }],
            temperature: 0.3
          })
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
          const errorBody = await response.text();
          console.error('Claude API error:', errorBody);

          if (response.status === 429 || response.status >= 500) {
            throw new Error(`Retryable error: ${response.status} - ${errorBody}`);
          }

          throw new Error(`Claude API error: ${response.status} - ${errorBody}`);
        }

        const data = await response.json();
        const responseText = data.content[0].text;

        // Parse JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }

        const result = JSON.parse(jsonMatch[0]);

        // Validate structure
        if (!result.primary || !result.secondary) {
          throw new Error('Invalid response structure - missing primary or secondary categories');
        }

        if (!Array.isArray(result.primary) || !Array.isArray(result.secondary)) {
          throw new Error('Primary and secondary must be arrays');
        }

        // Count total categories
        const totalCategories =
          result.primary.length +
          result.secondary.length +
          (result.alternative?.length || 0);

        console.log(`Generated ${totalCategories} category recommendations`);

        // Validate BISAC code format (rough check)
        const validateCode = (cat) => {
          if (!cat.code || !/^[A-Z]{3}\d{6}$/.test(cat.code)) {
            console.warn(`Invalid BISAC code format: ${cat.code}`);
          }
        };

        result.primary.forEach(validateCode);
        result.secondary.forEach(validateCode);
        if (result.alternative) {
          result.alternative.forEach(validateCode);
        }

        console.log('Categories generated successfully');
        return result;

      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error.message);
        lastError = error;

        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // All retries failed
    throw new Error(`Failed to generate categories after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Store categories in R2
   */
  async storeCategories(manuscriptKey, categories) {
    await this.env.R2.getBucket('manuscripts_processed').put(
      `${manuscriptKey}-categories.json`,
      JSON.stringify(categories, null, 2),
      {
        customMetadata: {
          assetType: 'categories',
          timestamp: new Date().toISOString(),
          manuscriptKey: manuscriptKey
        },
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );

    console.log('Categories stored in R2');
  }
}
