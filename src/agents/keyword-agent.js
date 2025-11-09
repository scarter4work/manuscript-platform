// Keyword Agent
// Generates 7 SEO keyword phrases optimized for Amazon search

export class KeywordAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Generate keywords from developmental analysis
   * @param {string} manuscriptKey - R2 key for the manuscript
   * @param {Object} developmentalAnalysis - Results from developmental agent
   * @param {string} genre - Book genre
   * @returns {Object} Generated keywords
   */
  async generate(manuscriptKey, developmentalAnalysis, genre) {
    console.log(`Generating keywords for ${manuscriptKey}`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    const analysis = developmentalAnalysis.analysis || developmentalAnalysis;
    const compTitles = developmentalAnalysis.compTitles || [];

    const keywords = await this.generateKeywords(analysis, genre, compTitles);

    // Store results
    await this.storeKeywords(manuscriptKey, keywords);

    return {
      manuscriptKey,
      keywords,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate keywords using Claude
   */
  async generateKeywords(analysis, genre, compTitles) {
    const compTitlesText = compTitles.length > 0
      ? compTitles.map(t => `${t.title} by ${t.author}`).join(', ')
      : 'N/A';

    const prompt = `You are an expert in Amazon KDP keyword optimization and book discoverability.

STORY ANALYSIS:
Genre: ${genre}
Plot Strengths: ${analysis.plot?.strengths?.join(', ') || 'N/A'}
Character Elements: ${analysis.characters?.strengths?.join(', ') || 'N/A'}
Key Themes: ${analysis.topPriorities?.join(', ') || 'N/A'}
Genre Strengths: ${analysis.genreFit?.strengths?.join(', ') || 'N/A'}

COMPARABLE TITLES:
${compTitlesText}

TASK: Generate 7 keyword phrases that will help this book be discovered by the right readers on Amazon.

AMAZON KDP KEYWORD REQUIREMENTS:
- Exactly 7 keyword phrases (no more, no less)
- Each phrase must be 50 characters or less (STRICT LIMIT)
- Use multi-word phrases, not single words
- Focus on what readers actually search for
- Include genre + subgenre combinations
- Include tropes, themes, and plot elements
- Think about reader intent: what would someone type when looking for this book?
- Avoid using the book title or author name
- Use lowercase for better matching

STRATEGY:
1. Start with primary genre + subgenre combinations
2. Add popular tropes and themes from the story
3. Include comparable title keywords (e.g., "for fans of X")
4. Target emotional hooks (e.g., "gripping suspense thriller")
5. Use character-driven keywords (e.g., "strong female detective")
6. Consider series keywords if applicable
7. Think about long-tail searches (specific combinations readers use)

EXAMPLES OF GOOD KEYWORDS:
- "police detective serial killer thriller"
- "strong female protagonist mystery"
- "psychological suspense crime fiction"
- "dark thriller with moral dilemmas"
- "fast paced cop procedural"

BAD KEYWORDS (avoid these):
- Single words like "thriller" or "mystery"
- Brand names or author names
- Keywords over 50 characters
- Generic phrases with no specificity

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "keywords": [
    "keyword phrase 1",
    "keyword phrase 2",
    "keyword phrase 3",
    "keyword phrase 4",
    "keyword phrase 5",
    "keyword phrase 6",
    "keyword phrase 7"
  ],
  "rationale": {
    "keyword phrase 1": "Why this keyword will help discoverability",
    "keyword phrase 2": "Why this keyword will help discoverability",
    "keyword phrase 3": "Why this keyword will help discoverability",
    "keyword phrase 4": "Why this keyword will help discoverability",
    "keyword phrase 5": "Why this keyword will help discoverability",
    "keyword phrase 6": "Why this keyword will help discoverability",
    "keyword phrase 7": "Why this keyword will help discoverability"
  },
  "searchVolume": "estimated relative search volume (high/medium/low)",
  "competitionLevel": "estimated competition (high/medium/low)"
}`;

    // Retry logic with exponential backoff
    const maxRetries = 5;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Keyword Generation - Attempt ${attempt}/${maxRetries}`);

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
            max_tokens: 2048,
            messages: [{
              role: 'user',
              content: prompt
            }],
            temperature: 0.5
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

        // Validate requirements
        if (!result.keywords || !Array.isArray(result.keywords)) {
          throw new Error('Invalid response structure - keywords must be an array');
        }

        if (result.keywords.length !== 7) {
          throw new Error(`Must have exactly 7 keywords, got ${result.keywords.length}`);
        }

        // Validate and truncate keywords if needed
        result.keywords = result.keywords.map((keyword, index) => {
          if (keyword.length > 50) {
            console.warn(`Keyword ${index + 1} exceeds 50 chars, truncating: ${keyword}`);
            return keyword.substring(0, 50).trim();
          }
          return keyword.toLowerCase().trim();
        });

        console.log('Keywords generated successfully:', result.keywords);
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
    throw new Error(`Failed to generate keywords after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Store keywords in R2
   */
  async storeKeywords(manuscriptKey, keywords) {
    await this.env.R2.getBucket('manuscripts_processed').put(
      `${manuscriptKey}-keywords.json`,
      JSON.stringify(keywords, null, 2),
      {
        customMetadata: {
          assetType: 'keywords',
          timestamp: new Date().toISOString(),
          manuscriptKey: manuscriptKey
        },
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );

    console.log('Keywords stored in R2');
  }
}
