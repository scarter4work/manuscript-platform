/**
 * Query Letter Generator (Issue #49)
 *
 * Generates professional query letters for traditional publishing submissions.
 * Query letters are 1-page pitch letters (250-500 words) sent to literary agents.
 *
 * Industry Standard Format:
 * 1. Hook (1-2 sentences) - Compelling opening
 * 2. Synopsis paragraph (150-250 words) - Story overview
 * 3. Metadata (genre, word count, comp titles)
 * 4. Bio paragraph (50-100 words) - Author credentials
 * 5. Closing
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Generate a query letter for manuscript submission
 *
 * @param {Object} manuscript - Manuscript data with metadata
 * @param {Object} authorInfo - Author bio and credentials
 * @param {string} targetAgent - Optional agent/publisher name
 * @param {Object} env - Environment bindings (ANTHROPIC_API_KEY)
 * @returns {Promise<Object>} Generated query letter with metadata
 */
export async function generateQueryLetter(manuscript, authorInfo, targetAgent, env) {
  const anthropic = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  });

  // Build the prompt
  const prompt = buildQueryLetterPrompt(manuscript, authorInfo, targetAgent);

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const queryLetter = message.content[0].text;
    const wordCount = countWords(queryLetter);

    // Validate word count
    if (wordCount < 200 || wordCount > 600) {
      throw new Error(`Query letter word count (${wordCount}) outside acceptable range (200-600)`);
    }

    return {
      content: queryLetter,
      wordCount: wordCount,
      generatedBy: 'claude-sonnet-4',
      prompt: prompt,
      metadata: {
        manuscriptTitle: manuscript.title,
        genre: manuscript.primary_genre || manuscript.genre,
        wordCount: manuscript.word_count,
        targetAgent: targetAgent || 'Generic Agent',
      },
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    console.error('Error generating query letter:', error);
    throw error;
  }
}

/**
 * Build the AI prompt for query letter generation
 */
function buildQueryLetterPrompt(manuscript, authorInfo, targetAgent) {
  const genre = manuscript.primary_genre || manuscript.genre || 'fiction';
  const ageCategory = manuscript.age_category || 'adult';
  const wordCount = manuscript.word_count || 80000;
  const title = manuscript.title || 'Untitled';

  // Get comp titles if provided
  const compTitles = authorInfo.compTitles || [];
  const compTitlesText = compTitles.length > 0
    ? `Comparable titles: ${compTitles.join(', ')}`
    : 'No comparable titles provided';

  // Get author credentials
  const credentials = buildAuthorCredentials(authorInfo);

  const prompt = `You are a professional literary agent assistant. Generate a compelling query letter for the following manuscript.

MANUSCRIPT INFORMATION:
- Title: "${title}"
- Genre: ${genre}
- Age Category: ${ageCategory}
- Word Count: ${wordCount.toLocaleString()} words
- ${compTitlesText}

AUTHOR INFORMATION:
${credentials}

TARGET:
${targetAgent ? `Literary Agent: ${targetAgent}` : 'Generic query letter (no specific agent)'}

QUERY LETTER REQUIREMENTS:
1. Professional business letter format
2. Total length: 250-500 words (strict requirement)
3. Three main components:
   a) HOOK (1-2 sentences): Compelling opening that grabs attention
   b) STORY SYNOPSIS (150-250 words):
      - Main character introduction (name, age, key trait)
      - Inciting incident
      - Stakes and conflict
      - What makes this story unique
      - DO NOT reveal the ending
      - Focus on voice and tone matching the genre
   c) METADATA (1-2 sentences):
      - Genre, word count, age category
      - Comparative titles (if provided)
   d) AUTHOR BIO (50-100 words):
      - Relevant credentials and experience
      - Writing accomplishments
      - Professional tone
   e) CLOSING: Thank you and contact information placeholder

TONE & STYLE:
- Professional but engaging
- Match the voice of the manuscript's genre
- ${genre === 'thriller' ? 'Create tension and urgency' : ''}
- ${genre === 'romance' ? 'Emphasize emotional connection' : ''}
- ${genre === 'fantasy' ? 'Highlight unique world-building elements' : ''}
- ${genre === 'literary-fiction' ? 'Focus on themes and character depth' : ''}
- ${ageCategory === 'young_adult' ? 'Emphasize teen appeal and contemporary relevance' : ''}
- Third-person for synopsis, first-person for bio

IMPORTANT GUIDELINES:
- DO NOT include agent name in greeting (use "[Agent Name]" placeholder)
- DO NOT include actual contact information (use placeholders)
- DO NOT exceed 500 words
- DO NOT reveal the ending of the story
- DO include what makes this manuscript marketable
- DO emphasize what sets this story apart

Generate the query letter now. Begin with "Dear [Agent Name]," and ensure the total word count is between 250-500 words.`;

  return prompt;
}

/**
 * Build author credentials section from authorInfo
 */
function buildAuthorCredentials(authorInfo) {
  const parts = [];

  if (authorInfo.authorName) {
    parts.push(`Author Name: ${authorInfo.authorName}`);
  }

  if (authorInfo.previousWorks && authorInfo.previousWorks.length > 0) {
    parts.push(`Previous Works: ${authorInfo.previousWorks.join(', ')}`);
  }

  if (authorInfo.awards && authorInfo.awards.length > 0) {
    parts.push(`Awards/Recognition: ${authorInfo.awards.join(', ')}`);
  }

  if (authorInfo.credentials) {
    parts.push(`Credentials: ${authorInfo.credentials}`);
  }

  if (authorInfo.publications && authorInfo.publications.length > 0) {
    parts.push(`Published in: ${authorInfo.publications.join(', ')}`);
  }

  if (authorInfo.education) {
    parts.push(`Education: ${authorInfo.education}`);
  }

  if (authorInfo.location) {
    parts.push(`Location: ${authorInfo.location}`);
  }

  return parts.length > 0 ? parts.join('\n- ') : 'No author information provided';
}

/**
 * Count words in text
 */
function countWords(text) {
  return text.trim().split(/\s+/).length;
}

/**
 * Validate query letter format and content
 */
export function validateQueryLetter(queryLetter) {
  const wordCount = countWords(queryLetter);
  const errors = [];
  const warnings = [];

  // Word count validation
  if (wordCount < 200) {
    errors.push(`Query letter too short: ${wordCount} words (minimum 200)`);
  } else if (wordCount < 250) {
    warnings.push(`Query letter below recommended minimum: ${wordCount} words (recommended 250+)`);
  }

  if (wordCount > 600) {
    errors.push(`Query letter too long: ${wordCount} words (maximum 600)`);
  } else if (wordCount > 500) {
    warnings.push(`Query letter above recommended maximum: ${wordCount} words (recommended 500 or less)`);
  }

  // Format validation
  if (!queryLetter.includes('Dear')) {
    errors.push('Missing greeting');
  }

  if (!queryLetter.match(/sincerely|regards|best/i)) {
    warnings.push('Missing professional closing');
  }

  // Content validation
  const lowerText = queryLetter.toLowerCase();
  if (!lowerText.includes('word') || !lowerText.match(/\d{1,3},?\d{3}/)) {
    warnings.push('Word count not mentioned');
  }

  return {
    valid: errors.length === 0,
    wordCount: wordCount,
    errors: errors,
    warnings: warnings,
  };
}

export default {
  generateQueryLetter,
  validateQueryLetter,
};
