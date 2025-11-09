// Audiobook Pronunciation Agent
// Generates pronunciation guides for proper nouns, character names, and unique terms

import {
  callClaudeWithCostTracking,
  extractManuscriptText,
  validateRequiredFields,
  storeAsset,
  AGENT_CONFIG
} from '../utils/agent-utils.js';

export class AudiobookPronunciationAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Generate pronunciation guide for audiobook narration
   * @param {string} manuscriptKey - R2 key for the manuscript
   * @param {Object} developmentalAnalysis - Results from developmental agent
   * @param {string} genre - Book genre
   * @param {string} userId - User ID for cost tracking
   * @param {string} manuscriptId - Manuscript ID for cost tracking
   * @returns {Object} Generated pronunciation guide
   */
  async generate(manuscriptKey, developmentalAnalysis, genre, userId, manuscriptId) {
    console.log(`Generating audiobook pronunciation guide for ${manuscriptKey}`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    // Extract key elements from developmental analysis
    const analysis = developmentalAnalysis.analysis || developmentalAnalysis;
    const characters = analysis.characters || {};

    // Get manuscript full text for comprehensive name/term extraction
    const manuscript = await this.env.R2.getBucket('manuscripts_raw').get(manuscriptKey);
    const textContent = await extractManuscriptText(manuscript, 50000); // More text for thorough analysis

    const pronunciationGuide = await this.generatePronunciationGuide(
      textContent,
      analysis,
      genre,
      characters,
      userId,
      manuscriptId
    );

    // Store results
    await storeAsset(
      this.env.R2.getBucket('manuscripts_processed'),
      manuscriptKey,
      'audiobook-pronunciation',
      pronunciationGuide
    );

    return {
      manuscriptKey,
      pronunciationGuide,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate pronunciation guide using Claude
   */
  async generatePronunciationGuide(excerpt, analysis, genre, characters, userId, manuscriptId) {
    const charactersList = characters.mainCharacters?.map(c => c.name).join(', ') || 'No characters identified';

    const prompt = `You are an expert linguist and audiobook production specialist with deep knowledge of phonetics, pronunciation, and narrative audio production.

MANUSCRIPT CONTEXT:
Genre: ${genre}
Main Characters: ${charactersList}

MANUSCRIPT TEXT (for analysis):
${excerpt}

TASK: Create a comprehensive pronunciation guide for audiobook narration. Identify ALL proper nouns, character names, place names, fictional terms, foreign words, and potentially ambiguous words that a narrator needs guidance on.

REQUIREMENTS:

1. **CHARACTER NAMES**
   - Every character name (main and supporting)
   - Phonetic spelling (using simple phonetic notation)
   - IPA notation if complex
   - Emphasis syllables (CAPS for stressed syllables)
   - Origin/etymology if relevant
   - Common mispronunciations to avoid

2. **PLACE NAMES**
   - Cities, countries, regions, buildings, streets
   - Real-world and fictional locations
   - Geographic terms specific to the story

3. **FICTIONAL TERMS**
   - Made-up words, magic systems, technology terms
   - World-building vocabulary
   - Titles, ranks, organizations
   - Objects, creatures, phenomena unique to the story

4. **FOREIGN WORDS & PHRASES**
   - Non-English words used in the text
   - Proper pronunciation in original language
   - Context for when narrator should use accent vs. anglicized

5. **AMBIGUOUS ENGLISH WORDS**
   - Words with multiple pronunciations (lead, read, live, tear, etc.)
   - Context-specific pronunciations
   - Regional variations to avoid

6. **PRONUNCIATION KEY**
   - Simple phonetic guide (e.g., "Sarah = SAIR-uh")
   - IPA notation for complex words
   - Audio reference suggestions (sounds like X)
   - Syllable breakdown with emphasis

PRONUNCIATION NOTATION GUIDE:
- Use simple phonetics: "Hermione = her-MY-oh-nee"
- CAPS for stressed syllables
- Hyphens between syllables
- Include IPA in parentheses for complex words
- Note: ah, ay, ee, eye, oh, oo, ow common vowel sounds

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "characterNames": [
    {
      "name": "Character Name",
      "phonetic": "KAR-ak-ter NAYM",
      "ipa": "/ˈkærəktər neɪm/" or "N/A",
      "emphasis": "second syllable",
      "notes": "Avoid common mispronunciation as...",
      "origin": "etymology or language origin if relevant",
      "soundsLike": "similar to 'X word'" or "N/A"
    }
  ],
  "placeNames": [
    {
      "name": "Place Name",
      "phonetic": "PLAYS NAYM",
      "ipa": "N/A",
      "type": "city|country|building|region",
      "notes": "pronunciation guidance",
      "soundsLike": "similar to 'X word'" or "N/A"
    }
  ],
  "fictionalTerms": [
    {
      "term": "Fictional Term",
      "phonetic": "fik-SHUN-al TURM",
      "ipa": "N/A",
      "category": "magic|technology|creature|title|object|other",
      "meaning": "brief definition",
      "notes": "pronunciation context",
      "soundsLike": "similar to 'X word'" or "N/A"
    }
  ],
  "foreignWords": [
    {
      "word": "Foreign Word",
      "language": "French|Spanish|German|etc",
      "phonetic": "for-EN wurd",
      "nativePronunciation": "authentic pronunciation",
      "anglicizedOption": "anglicized alternative",
      "usage": "when to use which pronunciation",
      "notes": "additional context"
    }
  ],
  "ambiguousWords": [
    {
      "word": "read",
      "context": "past tense vs present tense",
      "correctPronunciation": "RED (past) vs REED (present)",
      "rule": "how to determine from context",
      "examples": "example sentences from manuscript"
    }
  ],
  "pronunciationKey": {
    "notation": "explanation of phonetic system used",
    "vowelGuide": {
      "ah": "as in father",
      "ay": "as in say",
      "ee": "as in see"
    },
    "stressGuide": "CAPS = stressed syllable, lowercase = unstressed"
  },
  "overallNotes": "general pronunciation guidance for this manuscript",
  "dialectConsiderations": "accent/dialect notes if applicable",
  "totalTermsIdentified": number
}`;

    const pronunciationGuide = await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.PRECISE, // Use precise temperature for accurate pronunciation
      'AudiobookPronunciationAgent',
      this.env,
      userId,
      manuscriptId,
      'audiobook_generation',
      'generate_pronunciation_guide'
    );

    // Validate structure
    validateRequiredFields(pronunciationGuide, ['characterNames', 'pronunciationKey'], 'Pronunciation Guide');

    console.log(`Pronunciation guide generated successfully (${pronunciationGuide.totalTermsIdentified || 'N/A'} terms identified)`);
    return pronunciationGuide;
  }
}
