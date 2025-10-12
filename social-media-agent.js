/**
 * Social Media & Marketing Agent for Book Launch
 *
 * Generates complete marketing materials for book launches:
 * - Social media posts (10-20 posts for multiple platforms)
 * - Launch emails (announcement, pre-launch)
 * - Content calendar (30 days)
 * - Book trailer script
 * - Reader magnet ideas
 *
 * Uses Claude API to generate platform-specific, audience-targeted content
 */

export class SocialMediaAgent {
    constructor(anthropicApiKey) {
        this.apiKey = anthropicApiKey;
        this.apiUrl = 'https://api.anthropic.com/v1/messages';
    }

    /**
     * Generate complete social media marketing package
     */
    async generateMarketingPackage(manuscriptText, bookMetadata, marketAnalysis) {
        console.log('[Social Media Agent] Starting marketing package generation...');
        const startTime = Date.now();

        try {
            // Generate all marketing components
            const [
                socialMediaPosts,
                launchEmails,
                contentCalendar,
                bookTrailerScript,
                readerMagnets
            ] = await Promise.all([
                this.generateSocialMediaPosts(manuscriptText, bookMetadata, marketAnalysis),
                this.generateLaunchEmails(bookMetadata, marketAnalysis),
                this.generateContentCalendar(bookMetadata, marketAnalysis),
                this.generateBookTrailerScript(manuscriptText, bookMetadata),
                this.generateReaderMagnets(manuscriptText, bookMetadata)
            ]);

            const duration = Date.now() - startTime;

            return {
                success: true,
                marketingPackage: {
                    socialMediaPosts,
                    launchEmails,
                    contentCalendar,
                    bookTrailerScript,
                    readerMagnets
                },
                metadata: {
                    duration,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('[Social Media Agent] Error:', error);
            throw new Error(`Marketing package generation failed: ${error.message}`);
        }
    }

    /**
     * Generate social media posts for multiple platforms
     */
    async generateSocialMediaPosts(manuscriptText, bookMetadata, marketAnalysis) {
        console.log('[Social Media Agent] Generating social media posts...');

        const prompt = `You are a book marketing expert creating social media content for a book launch.

BOOK INFORMATION:
Title: ${bookMetadata.title || 'Untitled'}
Author: ${bookMetadata.author || 'Unknown Author'}
Genre: ${marketAnalysis?.genreAnalysis?.primaryGenre || 'Fiction'}
Target Audience: ${marketAnalysis?.audienceProfile?.primaryAudience?.ageRange || 'General audience'}

MANUSCRIPT EXCERPT:
${manuscriptText.substring(0, 5000)}

MARKET POSITIONING:
${marketAnalysis?.competitivePositioning?.positioningStatement || 'A compelling new book'}

Generate 15 social media posts across different platforms and post types. Return as JSON:

{
  "twitter": [
    {
      "postNumber": 1,
      "type": "teaser",
      "content": "Post content (max 280 chars)",
      "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
      "timing": "2 weeks before launch",
      "engagement_tip": "How to maximize engagement"
    }
  ],
  "facebook": [
    {
      "postNumber": 1,
      "type": "announcement",
      "content": "Post content (longer form)",
      "timing": "Launch day",
      "cta": "Call to action"
    }
  ],
  "instagram": [
    {
      "postNumber": 1,
      "type": "visual",
      "caption": "Instagram caption",
      "imageIdea": "What image to use",
      "hashtags": ["hashtag1", "hashtag2"],
      "timing": "1 week before launch"
    }
  ],
  "tiktok": [
    {
      "postNumber": 1,
      "type": "behindthescenes",
      "script": "Video script (60 seconds)",
      "visualCues": "What to show",
      "soundSuggestion": "Audio recommendation",
      "timing": "3 weeks before launch"
    }
  ]
}

Post types to include:
- Teaser posts (mysterious, hooks interest)
- Character introduction
- Quote from book
- Behind-the-scenes (writing process)
- Launch announcement
- Review/testimonial requests
- Countdown posts
- Thank you posts

Make posts engaging, genre-appropriate, and authentic.`;

        const response = await this.callClaude(prompt, 4000);
        return JSON.parse(this.extractJsonFromResponse(response));
    }

    /**
     * Generate launch email templates
     */
    async generateLaunchEmails(bookMetadata, marketAnalysis) {
        console.log('[Social Media Agent] Generating launch emails...');

        const prompt = `You are an email marketing expert creating launch emails for a book release.

BOOK INFORMATION:
Title: ${bookMetadata.title || 'Untitled'}
Author: ${bookMetadata.author || 'Unknown Author'}
Genre: ${marketAnalysis?.genreAnalysis?.primaryGenre || 'Fiction'}
Target Audience: ${marketAnalysis?.audienceProfile?.primaryAudience?.ageRange || 'General'}

Generate a complete email marketing package in JSON format:

{
  "preLaunchTeaser": {
    "subjectLines": [
      "Subject line option 1",
      "Subject line option 2",
      "Subject line option 3"
    ],
    "preheader": "Preview text",
    "bodyHtml": "Full HTML email body",
    "bodyPlainText": "Plain text version",
    "timing": "1 week before launch",
    "cta": {
      "text": "Add to Wishlist",
      "url": "{{AMAZON_URL}}"
    }
  },
  "launchAnnouncement": {
    "subjectLines": ["Launch subject 1", "Launch subject 2", "Launch subject 3"],
    "preheader": "Preview text",
    "bodyHtml": "Full HTML email body with excitement",
    "bodyPlainText": "Plain text version",
    "timing": "Launch day",
    "cta": {
      "text": "Buy Now",
      "url": "{{AMAZON_URL}}"
    }
  },
  "postLaunchThankYou": {
    "subjectLines": ["Thank you subject 1", "Thank you subject 2"],
    "bodyHtml": "Thank you email with review request",
    "bodyPlainText": "Plain text version",
    "timing": "3 days after launch",
    "cta": {
      "text": "Leave a Review",
      "url": "{{REVIEW_URL}}"
    }
  },
  "newsletterSignup": {
    "incentive": "What readers get for signing up",
    "welcomeEmail": {
      "subject": "Welcome email subject",
      "body": "Welcome email content with free content delivery"
    }
  }
}

Make emails warm, personal, and conversion-focused.`;

        const response = await this.callClaude(prompt, 4000);
        return JSON.parse(this.extractJsonFromResponse(response));
    }

    /**
     * Generate 30-day content calendar
     */
    async generateContentCalendar(bookMetadata, marketAnalysis) {
        console.log('[Social Media Agent] Generating content calendar...');

        const prompt = `You are a book marketing strategist creating a 30-day launch content calendar.

BOOK INFORMATION:
Title: ${bookMetadata.title || 'Untitled'}
Genre: ${marketAnalysis?.genreAnalysis?.primaryGenre || 'Fiction'}
Launch Strategy: ${marketAnalysis?.competitivePositioning?.launchStrategy?.approach || 'moderate'}

Create a comprehensive 30-day content calendar in JSON format:

{
  "overview": {
    "totalPosts": 30,
    "platforms": ["Twitter", "Facebook", "Instagram", "TikTok"],
    "strategy": "Overall content strategy summary",
    "keyMilestones": ["Day -21: First teaser", "Day 0: Launch", "Day +7: First review request"]
  },
  "calendar": [
    {
      "day": -21,
      "date": "relative to launch",
      "platform": "Twitter + Instagram",
      "contentType": "teaser",
      "postIdea": "What to post",
      "timing": "10:00 AM EST",
      "goal": "Build anticipation",
      "hashtags": ["#hashtag1", "#hashtag2"],
      "notes": "Additional tips"
    }
  ],
  "platformDistribution": {
    "twitter": "Posts per week",
    "facebook": "Posts per week",
    "instagram": "Posts per week",
    "tiktok": "Videos per week"
  },
  "contentMix": {
    "teasers": 30,
    "quotes": 20,
    "behindTheScenes": 15,
    "engagement": 15,
    "promotional": 20
  },
  "weeklyThemes": [
    {
      "week": 1,
      "theme": "Introduction & Mystery",
      "focus": "Build curiosity"
    }
  ]
}

Schedule should peak on launch day and maintain momentum post-launch.`;

        const response = await this.callClaude(prompt, 4000);
        return JSON.parse(this.extractJsonFromResponse(response));
    }

    /**
     * Generate book trailer script
     */
    async generateBookTrailerScript(manuscriptText, bookMetadata) {
        console.log('[Social Media Agent] Generating book trailer script...');

        const prompt = `You are a video script writer creating a compelling book trailer script.

BOOK INFORMATION:
Title: ${bookMetadata.title || 'Untitled'}
Author: ${bookMetadata.author || 'Unknown Author'}

MANUSCRIPT EXCERPT:
${manuscriptText.substring(0, 3000)}

Create a 60-second book trailer script in JSON format:

{
  "duration": "60 seconds",
  "targetPlatforms": ["YouTube", "TikTok", "Instagram Reels"],
  "script": [
    {
      "timestamp": "0:00-0:05",
      "narration": "Opening hook narration",
      "visual": "What viewers see",
      "text_overlay": "Text on screen",
      "music": "Music mood/style",
      "pacing": "fast/medium/slow"
    }
  ],
  "callToAction": {
    "timestamp": "0:55-1:00",
    "text": "Available now on Amazon",
    "visual": "Book cover + where to buy"
  },
  "musicSuggestions": {
    "mood": "suspenseful/romantic/epic",
    "tempo": "fast/medium/slow",
    "style": "orchestral/electronic/acoustic",
    "royaltyFree": ["Epidemic Sound suggestion", "Artlist suggestion"]
  },
  "productionTips": {
    "budget": "low/medium/high",
    "diyFeasibility": "Can this be done DIY?",
    "toolsNeeded": ["Tool 1", "Tool 2"],
    "estimatedCost": "$100-$500"
  }
}

Make the script compelling, genre-appropriate, and feasible to produce.`;

        const response = await this.callClaude(prompt, 4000);
        return JSON.parse(this.extractJsonFromResponse(response));
    }

    /**
     * Generate reader magnet ideas
     */
    async generateReaderMagnets(manuscriptText, bookMetadata) {
        console.log('[Social Media Agent] Generating reader magnet ideas...');

        const prompt = `You are a book marketing strategist creating reader magnets (lead magnets) for newsletter growth.

BOOK INFORMATION:
Title: ${bookMetadata.title || 'Untitled'}

MANUSCRIPT EXCERPT:
${manuscriptText.substring(0, 3000)}

Generate reader magnet ideas in JSON format:

{
  "bonusContent": [
    {
      "type": "deleted scene",
      "title": "Magnet title",
      "description": "What readers get",
      "format": "PDF/EPUB/both",
      "pageCount": "Estimated pages",
      "creationEffort": "low/medium/high",
      "conversionPotential": "Likelihood to convert readers",
      "implementation": "How to create and deliver this"
    }
  ],
  "newsletterIncentives": [
    {
      "incentive": "Free first chapter of next book",
      "value": "Why readers want this",
      "deliveryMethod": "Email automation",
      "ongoingValue": "What keeps them subscribed"
    }
  ],
  "arcProgram": {
    "concept": "Advanced Reader Copy program",
    "benefits": "What ARC readers get",
    "requirements": "What you ask in return",
    "platform": "Where to host (BookSprout, etc.)",
    "timeline": "When to launch",
    "size": "How many ARC readers to recruit"
  },
  "exclusiveContent": [
    {
      "idea": "Character interviews/behind-the-scenes",
      "format": "Blog post/video/audio",
      "frequency": "Monthly newsletter content",
      "engagement": "How to use for community building"
    }
  ],
  "contestIdeas": [
    {
      "type": "Name a character in next book",
      "entryMethod": "Newsletter signup + share",
      "prize": "Character named after winner",
      "duration": "2 weeks",
      "viralPotential": "high/medium/low"
    }
  ]
}

Focus on magnets that are valuable to readers but feasible for authors to create.`;

        const response = await this.callClaude(prompt, 4000);
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
     * Generate formatted marketing package report
     */
    generateReport(marketingPackage) {
        return {
            title: 'Book Launch Marketing Package',
            generated: new Date().toISOString(),
            sections: [
                {
                    title: 'Social Media Posts',
                    content: marketingPackage.socialMediaPosts,
                    totalPosts: this.countTotalPosts(marketingPackage.socialMediaPosts)
                },
                {
                    title: 'Launch Emails',
                    content: marketingPackage.launchEmails,
                    emailCount: Object.keys(marketingPackage.launchEmails).length
                },
                {
                    title: 'Content Calendar',
                    content: marketingPackage.contentCalendar,
                    duration: '30 days'
                },
                {
                    title: 'Book Trailer Script',
                    content: marketingPackage.bookTrailerScript,
                    duration: marketingPackage.bookTrailerScript.duration
                },
                {
                    title: 'Reader Magnets',
                    content: marketingPackage.readerMagnets,
                    ideaCount: this.countReaderMagnetIdeas(marketingPackage.readerMagnets)
                }
            ]
        };
    }

    /**
     * Count total social media posts
     */
    countTotalPosts(socialMediaPosts) {
        let count = 0;
        for (const platform in socialMediaPosts) {
            if (Array.isArray(socialMediaPosts[platform])) {
                count += socialMediaPosts[platform].length;
            }
        }
        return count;
    }

    /**
     * Count reader magnet ideas
     */
    countReaderMagnetIdeas(readerMagnets) {
        let count = 0;
        for (const category in readerMagnets) {
            if (Array.isArray(readerMagnets[category])) {
                count += readerMagnets[category].length;
            }
        }
        return count;
    }
}
