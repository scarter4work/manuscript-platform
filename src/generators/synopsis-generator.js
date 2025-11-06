/**
 * Synopsis Generator (Issue #49)
 *
 * Generates professional synopsis for traditional publishing submissions.
 *
 * INDUSTRY STANDARDS:
 * - Short Synopsis: 1 page (~500 words) - For query submissions
 * - Long Synopsis: 5 pages (~2500 words) - For full manuscript requests
 *
 * KEY DIFFERENCES FROM QUERY LETTERS:
 * - Synopsis DOES reveal the ending
 * - Synopsis covers ALL major plot points
 * - Written in present tense, third person
 * - Focus on plot progression, not sales pitch
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Generate synopsis (short or long)
 *
 * @param {Object} manuscript - Manuscript data with metadata
 * @param {string} length - 'short' (500 words) or 'long' (2500 words)
 * @param {Object} env - Environment bindings (ANTHROPIC_API_KEY)
 * @returns {Promise<Object>} Generated synopsis with metadata
 */
export async function generateSynopsis(manuscript, length = 'short', env) {
  const anthropic = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  });

  // Determine target word count
  const targetWordCount = length === 'short' ? 500 : 2500;
  const wordRange = length === 'short' ? '400-600' : '2000-3000';

  // Build the prompt
  const prompt = buildSynopsisPrompt(manuscript, length, targetWordCount);

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: length === 'short' ? 1500 : 4000,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const synopsis = message.content[0].text;
    const wordCount = countWords(synopsis);

    // Validate word count
    const minWords = length === 'short' ? 350 : 1800;
    const maxWords = length === 'short' ? 700 : 3200;

    if (wordCount < minWords || wordCount > maxWords) {
      console.warn(`Synopsis word count (${wordCount}) outside target range (${wordRange})`);
    }

    return {
      content: synopsis,
      wordCount: wordCount,
      length: length,
      generatedBy: 'claude-sonnet-4',
      prompt: prompt,
      metadata: {
        manuscriptTitle: manuscript.title,
        genre: manuscript.primary_genre || manuscript.genre,
        targetWordCount: targetWordCount,
      },
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    console.error('Error generating synopsis:', error);
    throw error;
  }
}

/**
 * Build the AI prompt for synopsis generation
 */
function buildSynopsisPrompt(manuscript, length, targetWordCount) {
  const genre = manuscript.primary_genre || manuscript.genre || 'fiction';
  const ageCategory = manuscript.age_category || 'adult';
  const title = manuscript.title || 'Untitled';
  const wordCount = manuscript.word_count || 80000;

  const isShort = length === 'short';

  const prompt = `You are a professional synopsis writer for traditional publishing. Generate a ${isShort ? 'SHORT' : 'LONG'} synopsis for the following manuscript.

MANUSCRIPT INFORMATION:
- Title: "${title}"
- Genre: ${genre}
- Age Category: ${ageCategory}
- Manuscript Word Count: ${wordCount.toLocaleString()} words

SYNOPSIS REQUIREMENTS:
Target Length: ${targetWordCount} words (${isShort ? '400-600 range' : '2000-3000 range'})

CRITICAL RULES:
1. ✅ MUST reveal the ending - this is NOT a query letter
2. ✅ MUST cover ALL major plot points chronologically
3. ✅ MUST be written in present tense, third person
4. ✅ MUST introduce all main characters with full names
5. ✅ MUST explain how conflicts are resolved
6. ✅ MUST focus on PLOT PROGRESSION, not selling the story
7. ❌ DO NOT use marketing language or hooks
8. ❌ DO NOT leave readers in suspense
9. ❌ DO NOT skip the ending

STRUCTURE:
${isShort ? `
SHORT SYNOPSIS (500 words):
- Opening (50-75 words): Introduce protagonist, setting, initial situation
- Rising Action (200-250 words): Major plot points and conflicts
- Climax (100-125 words): Turning point and confrontation
- Resolution (75-100 words): How everything concludes and ends
- Character arcs: Brief mention of character growth
` : `
LONG SYNOPSIS (2500 words):
- Opening (200-300 words): Detailed character introduction, world-building, inciting incident
- Act 1 (500-600 words): Setup, character establishment, initial conflicts
- Act 2 Part 1 (600-700 words): Rising action, complications, subplots
- Act 2 Part 2 (500-600 words): Midpoint shift, escalating stakes
- Act 3 (500-600 words): Climax, resolution, character transformation
- Subplots: Include major secondary storylines
- Character arcs: Detailed character development for main and supporting characters
`}

GENRE-SPECIFIC GUIDANCE:
${getGenreGuidance(genre)}

CHARACTER GUIDELINES:
- Introduce characters: "[NAME], a [age] [occupation/role]..."
- Include character motivations and goals
- Explain character relationships
- Show character transformation from beginning to end
${isShort ? '- Focus on protagonist and main antagonist only' : '- Include major supporting characters'}

TONE:
- Professional and objective
- Match the genre's voice (e.g., ${genre === 'thriller' ? 'tense and urgent' : genre === 'romance' ? 'emotional and heartfelt' : genre === 'fantasy' ? 'descriptive and immersive' : 'clear and compelling'})
- Present tense throughout
- Third person omniscient narrator voice

WHAT TO INCLUDE:
✅ Protagonist's goal and motivation
✅ Obstacles and conflicts
✅ Major plot twists and revelations
✅ How protagonist changes
✅ How the story ends (including fate of main characters)
✅ Resolution of all major conflicts
${!isShort ? '✅ Subplots and secondary character arcs' : ''}
${!isShort ? '✅ Thematic elements' : ''}

WHAT TO AVOID:
❌ Vague or mysterious endings
❌ "Will they succeed?" questions
❌ Cliffhangers or unanswered questions
❌ Marketing pitch language
❌ Excessive dialogue
❌ Detailed scene descriptions

Generate the ${length} synopsis now. Write in present tense, third person, and ensure you reveal the complete story from beginning to end.`;

  return prompt;
}

/**
 * Get genre-specific guidance for synopsis
 */
function getGenreGuidance(genre) {
  const guidance = {
    'thriller': '- Emphasize pacing and suspense\n- Highlight key reveals and plot twists\n- Show escalating danger\n- Explain how protagonist outsmarts antagonist',
    'mystery': '- Present clues and red herrings\n- Reveal the solution to the mystery\n- Explain how detective solves the case\n- Include key evidence and deductions',
    'romance': '- Focus on relationship development\n- Show emotional turning points\n- Include both internal and external conflicts\n- Confirm the romantic resolution (HEA or HFN)',
    'fantasy': '- Establish the magic system and world rules\n- Explain how protagonist masters their abilities\n- Include world-building details\n- Show the final confrontation with evil',
    'science-fiction': '- Explain the technology or scientific concept\n- Show how protagonist navigates the futuristic world\n- Include societal or philosophical themes\n- Resolve technological conflicts',
    'horror': '- Describe the horror element/threat\n- Show escalating terror\n- Reveal the nature of the horror\n- Explain how protagonist survives (or doesn\'t)',
    'literary-fiction': '- Emphasize character development and themes\n- Include internal conflicts and growth\n- Show nuanced relationships\n- Focus on emotional truth and transformation',
    'young-adult': '- Emphasize coming-of-age elements\n- Include identity and self-discovery\n- Show protagonist\'s growth to maturity\n- Address teen-relevant themes',
  };

  return guidance[genre] || '- Follow standard plot structure\n- Emphasize unique story elements\n- Show clear character arc';
}

/**
 * Count words in text
 */
function countWords(text) {
  return text.trim().split(/\s+/).length;
}

/**
 * Validate synopsis format and content
 */
export function validateSynopsis(synopsis, expectedLength) {
  const wordCount = countWords(synopsis);
  const errors = [];
  const warnings = [];

  // Word count validation
  const targetRange = expectedLength === 'short'
    ? { min: 350, ideal: 500, max: 700 }
    : { min: 1800, ideal: 2500, max: 3200 };

  if (wordCount < targetRange.min) {
    errors.push(`Synopsis too short: ${wordCount} words (minimum ${targetRange.min})`);
  } else if (wordCount < targetRange.ideal - 100) {
    warnings.push(`Synopsis below target: ${wordCount} words (target ${targetRange.ideal})`);
  }

  if (wordCount > targetRange.max) {
    errors.push(`Synopsis too long: ${wordCount} words (maximum ${targetRange.max})`);
  } else if (wordCount > targetRange.ideal + 100) {
    warnings.push(`Synopsis above target: ${wordCount} words (target ${targetRange.ideal})`);
  }

  // Format validation - check for present tense
  const pastTenseIndicators = synopsis.match(/\b(was|were|had|did|went|came|saw|said|told|asked)\b/gi);
  if (pastTenseIndicators && pastTenseIndicators.length > wordCount * 0.05) {
    warnings.push('Synopsis appears to use past tense (should be present tense)');
  }

  // Content validation - check if ending is revealed
  const lowerText = synopsis.toLowerCase();
  const hasEnding = lowerText.includes('end') || lowerText.includes('finally') ||
                    lowerText.includes('resolution') || lowerText.includes('conclude');

  if (!hasEnding) {
    warnings.push('Synopsis may not include the ending (industry standard requires full plot revelation)');
  }

  return {
    valid: errors.length === 0,
    wordCount: wordCount,
    targetWordCount: targetRange.ideal,
    errors: errors,
    warnings: warnings,
  };
}

/**
 * Generate both short and long synopsis in one call
 */
export async function generateBothSynopses(manuscript, env) {
  const [shortSynopsis, longSynopsis] = await Promise.all([
    generateSynopsis(manuscript, 'short', env),
    generateSynopsis(manuscript, 'long', env),
  ]);

  return {
    short: shortSynopsis,
    long: longSynopsis,
  };
}

export default {
  generateSynopsis,
  validateSynopsis,
  generateBothSynopses,
};
