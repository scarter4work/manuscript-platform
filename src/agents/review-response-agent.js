// Review Response Agent
// Generates AI-powered response suggestions for book reviews

import {
  callClaudeWithCostTracking,
  validateRequiredFields,
  storeAsset,
  AGENT_CONFIG
} from '../utils/agent-utils.js';

export class ReviewResponseAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Generate response suggestions for a review
   * @param {Object} review - Review object with sentiment analysis
   * @param {string} bookTitle - Book title
   * @param {string} authorName - Author name for personalization
   * @param {Object} authorVoice - Author's brand voice preferences
   * @param {string} userId - User ID for cost tracking
   * @param {string} manuscriptId - Manuscript ID for cost tracking
   * @returns {Object} Response suggestions
   */
  async generateResponse(review, bookTitle, authorName, authorVoice, userId, manuscriptId) {
    console.log(`Generating response for review (${review.sentiment})`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    if (!review || !review.reviewText) {
      throw new Error('Invalid review: reviewText is required');
    }

    const prompt = `You are an expert literary publicist and author relations specialist, skilled in crafting thoughtful and professional responses to book reviews.

BOOK CONTEXT:
Title: ${bookTitle}
Author: ${authorName}
Genre: ${review.genre || 'Unknown'}

REVIEW DETAILS:
Platform: ${review.platform || 'Unknown'}
Rating: ${review.rating}⭐
Sentiment: ${review.sentiment} (Score: ${review.sentimentScore || 'N/A'})
Reviewer: ${review.reviewerName || 'Anonymous'}
Verified Purchase: ${review.verifiedPurchase ? 'Yes' : 'No'}

Review Title: ${review.reviewTitle || 'No title'}
Review Text:
${review.reviewText}

SENTIMENT ANALYSIS:
Themes: ${review.themes ? review.themes.join(', ') : 'None'}
Praises: ${review.praises ? review.praises.join(', ') : 'None'}
Criticisms: ${review.criticisms ? review.criticisms.join(', ') : 'None'}
Response Priority: ${review.responsePriority || 'Unknown'}
Needs Attention: ${review.needsAttention ? 'Yes' : 'No'}

AUTHOR VOICE GUIDELINES:
${authorVoice ? `
- Tone: ${authorVoice.tone || 'professional, warm, authentic'}
- Formality: ${authorVoice.formality || 'semi-formal'}
- Brand Values: ${authorVoice.brandValues || 'authenticity, reader connection, gratitude'}
- Avoid: ${authorVoice.avoid || 'defensive language, dismissiveness, over-apologizing'}
` : 'Use professional, authentic, and grateful tone'}

TASK: Generate response suggestions for this review.

RESPONSE STRATEGY GUIDELINES:

1. **When to Respond**
   - Positive reviews: Thank reviewers who left thoughtful, detailed feedback
   - Negative reviews: Only respond if there's a genuine misunderstanding to clarify
   - Neutral reviews: Respond if reviewer seems on the fence or asks questions
   - DO NOT respond to every review (appears desperate)
   - NEVER respond defensively or argumentatively

2. **Response Best Practices**
   - Keep responses SHORT (2-4 sentences max)
   - Be genuine and personal (not templated/robotic)
   - Thank the reviewer for their time
   - Acknowledge specific points they made
   - NEVER argue with criticism
   - NEVER ask for rating changes
   - NEVER be defensive or make excuses
   - For negative reviews: Be gracious, acknowledge their perspective, thank them for feedback

3. **Tone Variations**
   - Professional: Polished, author-as-professional
   - Warm: Friendly, personal, authentic
   - Brief: Quick thank-you, minimal engagement
   - Detailed: Acknowledges specific elements they mentioned

4. **Red Flags to Avoid**
   - Defensive language ("Actually, you misunderstood...")
   - Explaining away criticisms
   - Asking for review changes
   - Over-apologizing
   - Generic copy-paste responses
   - Engaging with trolls or hostile reviewers

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "shouldRespond": true|false,
  "responseRecommendation": "respond|skip|monitor",
  "rationale": "Why you recommend responding or not",
  "riskLevel": "low|medium|high",
  "riskFactors": ["might appear defensive", "reviewer seems hostile"],

  "responseSuggestions": [
    {
      "tone": "warm|professional|brief|detailed",
      "responseText": "The actual response text",
      "lengthWords": 45,
      "pros": ["Shows appreciation", "Acknowledges their point"],
      "cons": ["Might seem too casual"],
      "bestFor": "Positive reviews from engaged readers"
    }
  ],

  "doNotSay": [
    "Avoid saying X because...",
    "Don't mention Y because..."
  ],

  "keyPointsToAddress": [
    "Thank them for their time",
    "Acknowledge their feedback about pacing"
  ],

  "timingRecommendation": {
    "whenToPost": "within 24-48 hours|within a week|wait for more reviews",
    "reasoning": "Respond quickly to show engagement without appearing desperate"
  },

  "alternativeActions": [
    "Consider this feedback for next book",
    "Use their praise as a testimonial (with permission)"
  ]
}`;

    const analysis = await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.PRECISE,
      'ReviewResponseAgent',
      this.env,
      userId,
      manuscriptId,
      'review_monitoring',
      'generate_response'
    );

    // Validate structure
    validateRequiredFields(analysis, ['shouldRespond', 'responseRecommendation'], 'Response Generation');

    // Store results
    const storageKey = `response-${manuscriptId}-${review.id || Date.now()}`;
    await storeAsset(
      this.env.MANUSCRIPTS_PROCESSED,
      storageKey,
      'review-response',
      {
        review,
        response: analysis,
        generatedAt: new Date().toISOString()
      }
    );

    return analysis;
  }

  /**
   * Generate responses for multiple reviews in batch
   * @param {Array} reviews - Array of review objects with sentiment
   * @param {string} bookTitle - Book title
   * @param {string} authorName - Author name
   * @param {Object} authorVoice - Author voice guidelines
   * @param {string} userId - User ID for cost tracking
   * @param {string} manuscriptId - Manuscript ID for cost tracking
   * @returns {Object} Batch response suggestions
   */
  async generateBatchResponses(reviews, bookTitle, authorName, authorVoice, userId, manuscriptId) {
    console.log(`Generating responses for ${reviews.length} reviews in batch`);

    // Filter reviews that need responses
    const reviewsNeedingResponse = reviews.filter(r =>
      r.needsResponse || r.responsePriority === 'high' || r.responsePriority === 'medium'
    );

    if (reviewsNeedingResponse.length === 0) {
      return {
        totalReviews: reviews.length,
        reviewsAnalyzed: 0,
        responses: [],
        summary: 'No reviews require responses at this time'
      };
    }

    console.log(`${reviewsNeedingResponse.length} reviews need response consideration`);

    const responses = [];
    for (const review of reviewsNeedingResponse) {
      try {
        const response = await this.generateResponse(
          review,
          bookTitle,
          authorName,
          authorVoice,
          userId,
          manuscriptId
        );
        responses.push({
          reviewId: review.id,
          reviewText: review.reviewText,
          rating: review.rating,
          sentiment: review.sentiment,
          response
        });
      } catch (error) {
        console.error(`Failed to generate response for review ${review.id}:`, error);
        responses.push({
          reviewId: review.id,
          error: error.message
        });
      }
    }

    return {
      totalReviews: reviews.length,
      reviewsAnalyzed: reviewsNeedingResponse.length,
      responses,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate response template library for common review types
   * @param {string} bookTitle - Book title
   * @param {string} authorName - Author name
   * @param {string} genre - Book genre
   * @param {Object} authorVoice - Author voice guidelines
   * @param {string} userId - User ID for cost tracking
   * @param {string} manuscriptId - Manuscript ID for cost tracking
   * @returns {Object} Template library
   */
  async generateTemplateLibrary(bookTitle, authorName, genre, authorVoice, userId, manuscriptId) {
    console.log('Generating response template library');

    const prompt = `You are an expert literary publicist creating a response template library for author ${authorName}.

BOOK CONTEXT:
Title: ${bookTitle}
Author: ${authorName}
Genre: ${genre}

AUTHOR VOICE:
${authorVoice ? `
- Tone: ${authorVoice.tone || 'professional, warm, authentic'}
- Formality: ${authorVoice.formality || 'semi-formal'}
- Brand Values: ${authorVoice.brandValues || 'authenticity, reader connection, gratitude'}
` : 'Use professional, authentic, and grateful tone'}

TASK: Create a library of response templates for common review scenarios.

For each scenario, provide:
1. When to use this template
2. Multiple variations (warm, professional, brief)
3. Customization points (where to add personal touches)
4. Examples of how to adapt it

Scenarios to cover:
1. Enthusiastic positive review (5 stars)
2. Thoughtful positive review with minor criticism (4 stars)
3. Mixed review (3 stars) - liked some, not others
4. Constructive negative review (2 stars) - valid criticisms
5. Hostile/angry review (1 star) - should probably not respond
6. Review with questions about the story/characters
7. Review that mentions specific plot elements
8. Review that compares to other authors
9. First review on a new release
10. Review from influential reviewer/blogger

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "templates": [
    {
      "scenario": "Enthusiastic positive review",
      "whenToUse": "5-star reviews with detailed enthusiasm",
      "shouldRespond": true,
      "variations": [
        {
          "tone": "warm",
          "template": "Template text with [CUSTOMIZATION_POINT] markers",
          "example": "Filled-in example"
        }
      ],
      "customizationGuide": "How to personalize this template",
      "timingRecommendation": "within 24-48 hours"
    }
  ],
  "generalGuidelines": [
    "Always be genuine, never use templates verbatim",
    "Customize each response to the specific review"
  ],
  "redFlags": [
    "Never respond defensively to criticism",
    "Don't engage with hostile reviewers"
  ]
}`;

    const templates = await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.BALANCED,
      'ReviewResponseAgent',
      this.env,
      userId,
      manuscriptId,
      'review_monitoring',
      'generate_templates'
    );

    validateRequiredFields(templates, ['templates'], 'Template Library');

    // Store template library
    const storageKey = `response-templates-${manuscriptId}-${Date.now()}`;
    await storeAsset(
      this.env.MANUSCRIPTS_PROCESSED,
      storageKey,
      'review-response-templates',
      templates
    );

    return templates;
  }
}
