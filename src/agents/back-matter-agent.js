// Back Matter Agent
// Generates "Also by Author", newsletter CTA, and social links for book back matter

export class BackMatterAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Generate back matter content
   * @param {string} manuscriptKey - R2 key for the manuscript
   * @param {Object} developmentalAnalysis - Results from developmental agent
   * @param {string} genre - Book genre
   * @param {Object} authorData - Author information including books, newsletter, social
   * @returns {Object} Generated back matter content
   */
  async generate(manuscriptKey, developmentalAnalysis, genre, authorData = {}) {
    console.log(`Generating back matter for ${manuscriptKey}`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    const analysis = developmentalAnalysis.analysis || developmentalAnalysis;

    const backMatter = await this.generateBackMatter(analysis, genre, authorData);

    // Store results
    await this.storeBackMatter(manuscriptKey, backMatter);

    return {
      manuscriptKey,
      backMatter,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate back matter using Claude (for CTAs) and templates
   */
  async generateBackMatter(analysis, genre, authorData) {
    const authorName = authorData.authorName || '[Author Name]';
    const otherBooks = authorData.otherBooks || [];
    const newsletterUrl = authorData.newsletterUrl || '';
    const website = authorData.website || '';
    const socialLinks = authorData.socialLinks || {};

    const prompt = `You are an expert at creating compelling book back matter that converts readers into fans.

MANUSCRIPT CONTEXT:
Genre: ${genre}
Story Themes: ${analysis.topPriorities?.join(', ') || 'Character-driven narrative'}
Writing Style: ${analysis.voice?.strengths?.join(', ') || 'Engaging, professional'}

AUTHOR DATA:
Author Name: ${authorName}
${otherBooks.length > 0 ? `Other Books: ${otherBooks.join(', ')}` : 'No other books listed yet'}
${newsletterUrl ? `Newsletter: ${newsletterUrl}` : 'No newsletter URL provided'}
${website ? `Website: ${website}` : 'No website provided'}
${Object.keys(socialLinks).length > 0 ? `Social Media: ${Object.keys(socialLinks).join(', ')}` : 'No social media provided'}

TASK: Generate compelling back matter content for the end of the book.

REQUIREMENTS:
1. Create a warm, engaging newsletter signup CTA that matches the ${genre} genre
2. Write a compelling reason for readers to join the newsletter
3. Keep CTAs conversational and author-centric (not salesy)
4. Include a thank you message to readers
5. Make it feel personal and authentic

If data is missing:
- For newsletter: Create a template CTA that encourages signing up
- For books: Create encouraging text about this being the first in a series or standalone
- For social: Generic "connect with me" text

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "thankYouMessage": "Warm, personal thank you to the reader for finishing the book",
  "newsletterCTA": {
    "headline": "Engaging headline for newsletter signup",
    "body": "2-3 sentences explaining why they should join (exclusive content, early access, etc.)",
    "callToAction": "Action text (e.g., 'Join my newsletter for...')"
  },
  "connectMessage": "Friendly message about connecting on social media or visiting website",
  "closingLine": "Final warm sign-off from the author"
}`;

    // Retry logic with exponential backoff
    const maxRetries = 5;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Back Matter - Attempt ${attempt}/${maxRetries}`);

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
            max_tokens: 1536,
            messages: [{
              role: 'user',
              content: prompt
            }],
            temperature: 0.7
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

        const generatedContent = JSON.parse(jsonMatch[0]);

        // Build complete back matter structure
        const backMatter = {
          ...generatedContent,
          alsoByAuthor: {
            authorName,
            books: otherBooks.length > 0 ? otherBooks : null,
            hasOtherBooks: otherBooks.length > 0
          },
          newsletter: {
            url: newsletterUrl || null,
            ...generatedContent.newsletterCTA
          },
          social: {
            website: website || null,
            ...socialLinks
          },
          // Pre-formatted sections for easy use
          formatted: this.formatBackMatter(
            generatedContent,
            authorName,
            otherBooks,
            newsletterUrl,
            website,
            socialLinks
          )
        };

        console.log('Back matter generated successfully');
        return backMatter;

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
    throw new Error(`Failed to generate back matter after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Format back matter as HTML and plain text
   */
  formatBackMatter(content, authorName, otherBooks, newsletterUrl, website, socialLinks) {
    // Plain text version
    let plainText = `\n\n${'='.repeat(50)}\n\n`;
    plainText += `${content.thankYouMessage}\n\n`;

    if (otherBooks.length > 0) {
      plainText += `ALSO BY ${authorName.toUpperCase()}\n\n`;
      otherBooks.forEach(book => {
        plainText += `• ${book}\n`;
      });
      plainText += '\n';
    }

    if (newsletterUrl) {
      plainText += `${content.newsletterCTA.headline}\n\n`;
      plainText += `${content.newsletterCTA.body}\n\n`;
      plainText += `${content.newsletterCTA.callToAction}\n`;
      plainText += `${newsletterUrl}\n\n`;
    }

    if (website || Object.keys(socialLinks).length > 0) {
      plainText += `${content.connectMessage}\n\n`;
      if (website) plainText += `Website: ${website}\n`;
      if (socialLinks.twitter) plainText += `Twitter: ${socialLinks.twitter}\n`;
      if (socialLinks.instagram) plainText += `Instagram: ${socialLinks.instagram}\n`;
      if (socialLinks.facebook) plainText += `Facebook: ${socialLinks.facebook}\n`;
      plainText += '\n';
    }

    plainText += `${content.closingLine}\n`;
    plainText += `\n${'='.repeat(50)}\n\n`;

    // HTML version
    let html = `<div class="back-matter" style="font-family: Georgia, serif; max-width: 600px; margin: 2em auto; padding: 2em; line-height: 1.6;">`;

    html += `<p style="text-align: center; font-size: 1.1em; margin-bottom: 2em;">${content.thankYouMessage}</p>`;

    if (otherBooks.length > 0) {
      html += `<h2 style="text-align: center; margin: 2em 0 1em; font-size: 1.3em;">Also by ${authorName}</h2>`;
      html += `<ul style="list-style: none; padding: 0; text-align: center;">`;
      otherBooks.forEach(book => {
        html += `<li style="margin: 0.5em 0;">${book}</li>`;
      });
      html += `</ul>`;
    }

    if (newsletterUrl) {
      html += `<div style="margin: 3em 0; padding: 2em; background: #f5f5f5; border-radius: 8px; text-align: center;">`;
      html += `<h3 style="margin-top: 0; font-size: 1.2em;">${content.newsletterCTA.headline}</h3>`;
      html += `<p>${content.newsletterCTA.body}</p>`;
      html += `<p><strong><a href="${newsletterUrl}" style="color: #0066cc;">${content.newsletterCTA.callToAction}</a></strong></p>`;
      html += `<p style="font-size: 0.9em; color: #666;">${newsletterUrl}</p>`;
      html += `</div>`;
    }

    if (website || Object.keys(socialLinks).length > 0) {
      html += `<p style="text-align: center; margin: 2em 0;">${content.connectMessage}</p>`;
      html += `<div style="text-align: center; margin: 1em 0;">`;
      if (website) html += `<div><strong>Website:</strong> <a href="${website}" style="color: #0066cc;">${website}</a></div>`;
      if (socialLinks.twitter) html += `<div><strong>Twitter:</strong> ${socialLinks.twitter}</div>`;
      if (socialLinks.instagram) html += `<div><strong>Instagram:</strong> ${socialLinks.instagram}</div>`;
      if (socialLinks.facebook) html += `<div><strong>Facebook:</strong> ${socialLinks.facebook}</div>`;
      html += `</div>`;
    }

    html += `<p style="text-align: center; margin-top: 2em; font-style: italic;">${content.closingLine}</p>`;
    html += `</div>`;

    return {
      plainText,
      html
    };
  }

  /**
   * Store back matter in R2
   */
  async storeBackMatter(manuscriptKey, backMatter) {
    await this.env.R2.getBucket('manuscripts_processed').put(
      `${manuscriptKey}-back-matter.json`,
      JSON.stringify(backMatter, null, 2),
      {
        customMetadata: {
          assetType: 'back-matter',
          timestamp: new Date().toISOString(),
          manuscriptKey: manuscriptKey
        },
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );

    console.log('Back matter stored in R2');
  }
}
