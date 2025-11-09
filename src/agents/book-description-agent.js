// Book Description Agent
// Generates compelling book descriptions optimized for Amazon KDP

export class BookDescriptionAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Generate book description from developmental analysis
   * @param {string} manuscriptKey - R2 key for the manuscript
   * @param {Object} developmentalAnalysis - Results from developmental agent
   * @param {string} genre - Book genre
   * @returns {Object} Generated book descriptions
   */
  async generate(manuscriptKey, developmentalAnalysis, genre) {
    console.log(`Generating book description for ${manuscriptKey}`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    // Extract key elements from developmental analysis
    const analysis = developmentalAnalysis.analysis || developmentalAnalysis;
    const structure = developmentalAnalysis.structure;
    const compTitles = developmentalAnalysis.compTitles || [];

    // Get manuscript excerpt for context
    const manuscript = await this.env.R2.getBucket('manuscripts_raw').get(manuscriptKey);
    const textContent = await this.extractText(manuscript);
    const excerpt = textContent.substring(0, 5000); // First 5000 chars

    const description = await this.generateDescription(
      excerpt,
      analysis,
      structure,
      genre,
      compTitles
    );

    // Store results
    await this.storeDescription(manuscriptKey, description);

    return {
      manuscriptKey,
      description,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract text from manuscript
   */
  async extractText(manuscript) {
    const contentType = manuscript.httpMetadata?.contentType;
    const buffer = await manuscript.arrayBuffer();

    if (contentType === 'text/plain') {
      return new TextDecoder().decode(buffer);
    }

    // For other formats, would need parsers
    throw new Error(`Unsupported file type for description generation: ${contentType}`);
  }

  /**
   * Generate book description using Claude
   */
  async generateDescription(excerpt, analysis, structure, genre, compTitles) {
    const compTitlesText = compTitles.length > 0
      ? compTitles.map(t => `${t.title} by ${t.author}`).join(', ')
      : 'N/A';

    const prompt = `You are an expert book marketing copywriter specializing in Amazon book descriptions that convert browsers into buyers.

MANUSCRIPT CONTEXT:
Genre: ${genre}
Word Count: ${structure?.totalWords || 'Unknown'}
Chapters: ${structure?.chapterCount || 'Unknown'}

STORY ANALYSIS:
Overall Score: ${analysis.overallScore}/10
Plot Strengths: ${analysis.plot?.strengths?.join(', ') || 'N/A'}
Character Strengths: ${analysis.characters?.strengths?.join(', ') || 'N/A'}
Key Themes: ${analysis.topPriorities?.join(', ') || 'N/A'}
Genre Fit: ${analysis.genreFit?.strengths?.join(', ') || 'N/A'}
Marketability: ${analysis.marketability?.summary || 'N/A'}

COMPARABLE TITLES:
${compTitlesText}

MANUSCRIPT OPENING:
${excerpt}

TASK: Generate compelling book descriptions that will make readers want to buy this book on Amazon.

REQUIREMENTS:
1. Hook readers in the first sentence with the story's unique premise or emotional appeal
2. Introduce the protagonist and their conflict/goal
3. Raise the stakes - what happens if they fail?
4. Hint at the main conflict/antagonist without spoilers
5. End with a compelling question, cliffhanger, or call-to-action
6. Match genre conventions (${genre})
7. Use vivid, emotional language that connects with target readers
8. Avoid clichés and overused phrases
9. No spoilers - tease but don't reveal plot twists

AMAZON CONSTRAINTS:
- Short version: ~150 words (for quick browsers)
- Medium version: ~250 words (main description)
- Long version: ~350 words (detailed/series books, max 4000 chars allowed)

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "short": "150 word compelling description",
  "medium": "250 word compelling description",
  "long": "350 word compelling description",
  "hooks": [
    "Opening hook option 1",
    "Opening hook option 2",
    "Opening hook option 3"
  ],
  "keyWords": ["word1", "word2", "word3"],
  "targetAudience": "Brief description of ideal reader",
  "comparisonLine": "For fans of [comparable titles]..."
}`;

    // Retry logic with exponential backoff
    const maxRetries = 5;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Book Description - Attempt ${attempt}/${maxRetries}`);

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
            max_tokens: 4096,
            messages: [{
              role: 'user',
              content: prompt
            }],
            temperature: 0.7 // Slightly higher for creative writing
          })
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
          const errorBody = await response.text();
          console.error('Claude API error:', errorBody);

          // Retry on rate limits or server errors
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

        const description = JSON.parse(jsonMatch[0]);

        // Validate structure
        if (!description.short || !description.medium || !description.long) {
          throw new Error('Invalid response structure - missing required fields');
        }

        // Validate Amazon constraints
        if (description.long.length > 4000) {
          description.long = description.long.substring(0, 3997) + '...';
        }

        console.log('Book description generated successfully');
        return description;

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
    throw new Error(`Failed to generate book description after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Store description in R2
   */
  async storeDescription(manuscriptKey, description) {
    await this.env.R2.getBucket('manuscripts_processed').put(
      `${manuscriptKey}-book-description.json`,
      JSON.stringify(description, null, 2),
      {
        customMetadata: {
          assetType: 'book-description',
          timestamp: new Date().toISOString(),
          manuscriptKey: manuscriptKey
        },
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );

    console.log('Book description stored in R2');
  }
}
