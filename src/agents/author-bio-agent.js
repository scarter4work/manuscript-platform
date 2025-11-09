// Author Bio Agent
// Generates professional author bios in multiple lengths

export class AuthorBioAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Generate author bio from manuscript analysis and user input
   * @param {string} manuscriptKey - R2 key for the manuscript
   * @param {Object} developmentalAnalysis - Results from developmental agent
   * @param {string} genre - Book genre
   * @param {Object} authorInfo - Optional user-provided author information
   * @returns {Object} Generated author bios
   */
  async generate(manuscriptKey, developmentalAnalysis, genre, authorInfo = {}) {
    console.log(`Generating author bio for ${manuscriptKey}`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    const analysis = developmentalAnalysis.analysis || developmentalAnalysis;

    const bio = await this.generateBio(analysis, genre, authorInfo);

    // Store results
    await this.storeBio(manuscriptKey, bio);

    return {
      manuscriptKey,
      bio,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate author bio using Claude
   */
  async generateBio(analysis, genre, authorInfo) {
    // Extract author info if provided
    const name = authorInfo.name || '[Author Name]';
    const background = authorInfo.background || '';
    const achievements = authorInfo.achievements || '';
    const location = authorInfo.location || '';
    const website = authorInfo.website || '';
    const writingExperience = authorInfo.writingExperience || '';

    const prompt = `You are an expert author bio writer who creates compelling, professional author biographies for book marketing.

MANUSCRIPT CONTEXT:
Genre: ${genre}
Writing Style: ${analysis.voice?.strengths?.join(', ') || 'Professional, engaging'}
Story Themes: ${analysis.topPriorities?.join(', ') || 'Character-driven narrative'}
Overall Quality: ${analysis.overallScore}/10

AUTHOR INFORMATION PROVIDED:
${background ? `Background: ${background}` : 'No background provided'}
${achievements ? `Achievements: ${achievements}` : 'No achievements provided'}
${location ? `Location: ${location}` : 'No location provided'}
${writingExperience ? `Writing Experience: ${writingExperience}` : 'No experience details provided'}
${website ? `Website: ${website}` : 'No website provided'}

TASK: Generate professional author bios that will appear on Amazon and the back cover.

REQUIREMENTS:
1. Write in third person (e.g., "John Smith is..." not "I am...")
2. Match the tone and formality to the ${genre} genre
3. Focus on what makes the author credible and relatable
4. If user data is sparse, create a professional template bio based on the manuscript style
5. Include hints about writing approach/themes that match the manuscript
6. Sound authentic and personable, not corporate or stiff
7. End with something engaging (current projects, location, personal detail)

BIO LENGTHS:
- Short (50 words): Ultra-concise, perfect for Twitter/social media
- Medium (100 words): Standard book bio for Amazon "About the Author"
- Long (200 words): Detailed bio for website, press releases, back matter

If author information is minimal, infer a professional bio based on:
- The manuscript's themes and style
- The genre conventions
- What readers would want to know about an author who writes this type of book

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "short": "50 word bio perfect for social media and brief mentions",
  "medium": "100 word bio suitable for Amazon author page and book back cover",
  "long": "200 word detailed bio for website, press releases, and extended author sections",
  "tone": "Description of the tone used (professional, casual, academic, etc.)",
  "suggestions": [
    "Suggestion for improving the bio if author provides more info",
    "Suggestion for what details would strengthen the bio"
  ],
  "socialMediaBio": "Ultra-short 160 character bio for Twitter/social profiles"
}`;

    // Retry logic with exponential backoff
    const maxRetries = 5;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Author Bio - Attempt ${attempt}/${maxRetries}`);

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
            temperature: 0.7 // Higher for creative bio writing
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

        const bio = JSON.parse(jsonMatch[0]);

        // Validate structure
        if (!bio.short || !bio.medium || !bio.long) {
          throw new Error('Invalid response structure - missing required bio versions');
        }

        // Validate word counts (approximately)
        const shortWords = bio.short.split(/\s+/).length;
        const mediumWords = bio.medium.split(/\s+/).length;
        const longWords = bio.long.split(/\s+/).length;

        console.log(`Bio generated - Short: ${shortWords}w, Medium: ${mediumWords}w, Long: ${longWords}w`);

        // Add author info to result for reference
        bio.authorInfo = {
          name,
          background: background || '(not provided)',
          achievements: achievements || '(not provided)',
          location: location || '(not provided)',
          website: website || '(not provided)'
        };

        return bio;

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
    throw new Error(`Failed to generate author bio after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Store bio in R2
   */
  async storeBio(manuscriptKey, bio) {
    await this.env.R2.getBucket('manuscripts_processed').put(
      `${manuscriptKey}-author-bio.json`,
      JSON.stringify(bio, null, 2),
      {
        customMetadata: {
          assetType: 'author-bio',
          timestamp: new Date().toISOString(),
          manuscriptKey: manuscriptKey
        },
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );

    console.log('Author bio stored in R2');
  }
}
