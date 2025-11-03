/**
 * Author Bio Generator
 * Generates professional author bios in multiple lengths and styles
 * Uses Claude API for AI-powered bio generation
 */

import Anthropic from '@anthropic-ai/sdk';
import { callClaudeWithCostTracking } from '../utils/agent-utils.js';

/**
 * Bio length specifications
 */
export const BIO_LENGTHS = {
  short: {
    wordCount: '50-100',
    minWords: 50,
    maxWords: 100,
    description: 'For Amazon author page, social media profiles',
    sentences: '2-3 sentences'
  },
  medium: {
    wordCount: '150-250',
    minWords: 150,
    maxWords: 250,
    description: 'For book back matter "About the Author" section',
    sentences: '4-6 sentences'
  },
  long: {
    wordCount: '300-500',
    minWords: 300,
    maxWords: 500,
    description: 'For author website, press kits, speaking engagements',
    sentences: '8-12 sentences'
  }
};

/**
 * Genre-specific tone guidelines
 */
const GENRE_TONES = {
  thriller: {
    tone: 'Mysterious and intriguing, with hints of suspense',
    style: 'Sharp, punchy sentences that create intrigue',
    focus: 'Edge-of-your-seat storytelling, tension, plot twists'
  },
  mystery: {
    tone: 'Clever and analytical, with a touch of wit',
    style: 'Clear, methodical prose with clever turns of phrase',
    focus: 'Puzzle-solving, detective work, plot intricacy'
  },
  romance: {
    tone: 'Warm, emotional, and heartfelt',
    style: 'Flowing, lyrical prose with emotional depth',
    focus: 'Character relationships, emotional journeys, happily-ever-afters'
  },
  fantasy: {
    tone: 'Imaginative and epic, with a sense of wonder',
    style: 'Rich, descriptive language with world-building flair',
    focus: 'World-building, magic systems, epic quests'
  },
  'sci-fi': {
    tone: 'Innovative and thought-provoking',
    style: 'Precise, technical yet accessible prose',
    focus: 'Future visions, technology, big ideas'
  },
  literary: {
    tone: 'Sophisticated and introspective',
    style: 'Elegant, nuanced prose with literary depth',
    focus: 'Character depth, themes, beautiful language'
  },
  horror: {
    tone: 'Dark and atmospheric, with unsettling undertones',
    style: 'Vivid, visceral prose that evokes fear',
    focus: 'Psychological terror, atmosphere, dread'
  },
  general: {
    tone: 'Professional and engaging',
    style: 'Clear, accessible prose with broad appeal',
    focus: 'Compelling storytelling and relatable characters'
  }
};

/**
 * Generate author bio variations
 * @param {Object} options - Bio generation options
 * @param {string} options.authorName - Author's name
 * @param {string} options.genre - Book genre
 * @param {string} options.length - Bio length (short/medium/long)
 * @param {Object} options.authorProfile - Author profile data
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} Generated bio variations
 */
export async function generateAuthorBio(options, env) {
  const { authorName, genre = 'general', length = 'medium', authorProfile = {} } = options;

  if (!authorName) {
    throw new Error('Author name is required');
  }

  const lengthSpec = BIO_LENGTHS[length];
  if (!lengthSpec) {
    throw new Error(`Invalid bio length: ${length}. Must be short, medium, or long`);
  }

  const genreTone = GENRE_TONES[genre] || GENRE_TONES.general;

  // Build author context from profile
  const authorContext = buildAuthorContext(authorProfile);

  // Generate 3-5 variations
  const variations = [];
  const approaches = [
    'achievement-focused', // Highlight awards, credentials
    'storytelling-focused', // Tell author's journey
    'reader-focused', // Connect with readers, emphasize impact
    'professional-focused', // Credentials, expertise, authority
    'personal-focused' // Personal story, passions, motivations
  ];

  // Generate 3 variations (can expand to 5 if needed)
  for (let i = 0; i < 3; i++) {
    const approach = approaches[i];
    const variation = await generateSingleBio({
      authorName,
      genre,
      genreTone,
      lengthSpec,
      authorContext,
      approach,
      variationNumber: i + 1
    }, env);

    variations.push({
      id: `bio-${length}-${approach}`,
      approach,
      text: variation.text,
      wordCount: variation.wordCount,
      tone: genreTone.tone,
      length
    });
  }

  return {
    authorName,
    genre,
    length,
    variations,
    lengthSpec,
    genreTone,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Build author context from profile data
 */
function buildAuthorContext(profile) {
  const context = [];

  if (profile.previousWorks && profile.previousWorks.length > 0) {
    context.push(`Previous works: ${profile.previousWorks.join(', ')}`);
  }

  if (profile.awards && profile.awards.length > 0) {
    context.push(`Awards: ${profile.awards.join(', ')}`);
  }

  if (profile.credentials) {
    context.push(`Credentials: ${profile.credentials}`);
  }

  if (profile.location) {
    context.push(`Location: ${profile.location}`);
  }

  if (profile.website) {
    context.push(`Website: ${profile.website}`);
  }

  if (profile.socialMedia) {
    const platforms = Object.entries(profile.socialMedia)
      .filter(([_, handle]) => handle)
      .map(([platform, handle]) => `${platform}: ${handle}`);
    if (platforms.length > 0) {
      context.push(`Social media: ${platforms.join(', ')}`);
    }
  }

  if (profile.newsletter) {
    context.push(`Newsletter: ${profile.newsletter}`);
  }

  if (profile.bio) {
    context.push(`Existing bio notes: ${profile.bio}`);
  }

  return context.join('\n');
}

/**
 * Generate a single bio variation using Claude API
 */
async function generateSingleBio(params, env) {
  const {
    authorName,
    genre,
    genreTone,
    lengthSpec,
    authorContext,
    approach,
    variationNumber
  } = params;

  const prompt = `You are a professional author bio writer. Generate a compelling third-person author bio.

AUTHOR NAME: ${authorName}

GENRE: ${genre}

BIO LENGTH: ${lengthSpec.wordCount} words (${lengthSpec.sentences})
PURPOSE: ${lengthSpec.description}

TONE: ${genreTone.tone}
STYLE: ${genreTone.style}
FOCUS: ${genreTone.focus}

APPROACH: ${approach}
${approach === 'achievement-focused' ? 'Emphasize awards, credentials, and accomplishments' : ''}
${approach === 'storytelling-focused' ? 'Tell the author\'s journey into writing as a compelling story' : ''}
${approach === 'reader-focused' ? 'Connect with readers, emphasize the impact of their work' : ''}
${approach === 'professional-focused' ? 'Highlight expertise, authority, and professional credentials' : ''}
${approach === 'personal-focused' ? 'Share personal story, passions, and what drives their writing' : ''}

AUTHOR CONTEXT:
${authorContext || 'No additional context provided - use creative liberty'}

REQUIREMENTS:
1. Write in third person (use "he/she/they", not "I")
2. Target exactly ${lengthSpec.wordCount} words
3. Make it engaging and professional
4. Match the ${genre} genre tone
5. Include a compelling hook in the first sentence
6. End with something memorable
7. Avoid clichés like "when not writing, enjoys long walks"
8. Be specific and vivid, not generic

Generate only the bio text, no additional commentary.`;

  const response = await callClaudeWithCostTracking(
    env,
    [{ role: 'user', content: prompt }],
    {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0.8 // Higher temperature for creative variation
    },
    'author-bio-generation',
    null, // no manuscriptId
    {
      operation: 'author_bio_generation',
      genre,
      length: lengthSpec.wordCount,
      approach,
      variationNumber
    }
  );

  const bioText = response.content[0].text.trim();
  const wordCount = bioText.split(/\s+/).length;

  return {
    text: bioText,
    wordCount,
    approach,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    cost: response.cost
  };
}

/**
 * Generate complete bio package (all lengths)
 * @param {Object} options - Bio generation options
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} Complete bio package
 */
export async function generateCompleteBioPackage(options, env) {
  const { authorName, genre, authorProfile } = options;

  const results = {
    authorName,
    genre,
    short: null,
    medium: null,
    long: null,
    generatedAt: new Date().toISOString(),
    totalCost: 0,
    totalTokens: 0
  };

  // Generate all three lengths
  for (const length of ['short', 'medium', 'long']) {
    const bioResult = await generateAuthorBio({
      authorName,
      genre,
      length,
      authorProfile
    }, env);

    results[length] = bioResult;

    // Sum up costs
    bioResult.variations.forEach(v => {
      results.totalCost += v.cost || 0;
      results.totalTokens += v.tokensUsed || 0;
    });
  }

  return results;
}

/**
 * Validate bio meets requirements
 */
export function validateBio(bio, lengthSpec) {
  const wordCount = bio.split(/\s+/).length;
  const warnings = [];

  if (wordCount < lengthSpec.minWords) {
    warnings.push(`Bio is too short (${wordCount} words, minimum ${lengthSpec.minWords})`);
  }

  if (wordCount > lengthSpec.maxWords) {
    warnings.push(`Bio is too long (${wordCount} words, maximum ${lengthSpec.maxWords})`);
  }

  // Check for first-person (should be third-person)
  if (/\b(I|me|my|mine)\b/i.test(bio)) {
    warnings.push('Bio contains first-person pronouns (should be third-person)');
  }

  // Check for common clichés
  const cliches = [
    /when not writing/i,
    /lives with (his|her|their) (cat|dog)/i,
    /enjoys long walks/i,
    /passionate about/i
  ];

  cliches.forEach(cliche => {
    if (cliche.test(bio)) {
      warnings.push('Bio contains common cliché phrases');
    }
  });

  return {
    valid: warnings.length === 0,
    wordCount,
    warnings
  };
}
