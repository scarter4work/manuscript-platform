// Audiobook Narration Agent
// Generates professional narration scripts and narrator briefs for audiobook production

import {
  callClaudeWithCostTracking,
  extractManuscriptText,
  validateRequiredFields,
  storeAsset,
  AGENT_CONFIG
} from '../utils/agent-utils.js';

export class AudiobookNarrationAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Generate audiobook narration script and narrator brief
   * @param {string} manuscriptKey - R2 key for the manuscript
   * @param {Object} developmentalAnalysis - Results from developmental agent
   * @param {string} genre - Book genre
   * @param {string} userId - User ID for cost tracking
   * @param {string} manuscriptId - Manuscript ID for cost tracking
   * @returns {Object} Generated narration script and narrator brief
   */
  async generate(manuscriptKey, developmentalAnalysis, genre, userId, manuscriptId) {
    console.log(`Generating audiobook narration brief for ${manuscriptKey}`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    // Extract key elements from developmental analysis
    const analysis = developmentalAnalysis.analysis || developmentalAnalysis;
    const structure = developmentalAnalysis.structure;
    const characters = analysis.characters || {};

    // Get manuscript excerpt for context
    const manuscript = await this.env.R2.getBucket('manuscripts_raw').get(manuscriptKey);
    const textContent = await extractManuscriptText(manuscript, 10000); // First 10K chars for narration analysis

    const narrationBrief = await this.generateNarrationBrief(
      textContent,
      analysis,
      structure,
      genre,
      characters,
      userId,
      manuscriptId
    );

    // Store results
    await storeAsset(
      this.env.R2.getBucket('manuscripts_processed'),
      manuscriptKey,
      'audiobook-narration',
      narrationBrief
    );

    return {
      manuscriptKey,
      narrationBrief,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate comprehensive narration brief using Claude
   */
  async generateNarrationBrief(excerpt, analysis, structure, genre, characters, userId, manuscriptId) {
    const charactersList = characters.mainCharacters?.map(c =>
      `${c.name}: ${c.role || 'Character'} - ${c.arc || c.description || 'No description'}`
    ).join('\n') || 'No character data available';

    const prompt = `You are an expert audiobook production director with deep knowledge of narration styles, voice acting, and audio performance.

MANUSCRIPT CONTEXT:
Genre: ${genre}
Word Count: ${structure?.totalWords || 'Unknown'}
Chapters: ${structure?.chapterCount || 'Unknown'}
Estimated Narration Time: ${this.estimateNarrationTime(structure?.totalWords || 0)}

STORY ANALYSIS:
Overall Score: ${analysis.overallScore}/10
Tone: ${analysis.tone?.overall || 'Not analyzed'}
Pacing: ${analysis.pacing?.overall || 'Not analyzed'}
POV: ${analysis.pov || 'Not specified'}
Target Audience: ${analysis.audience || 'General'}

MAIN CHARACTERS:
${charactersList}

MANUSCRIPT OPENING (for narration style analysis):
${excerpt}

TASK: Create a comprehensive audiobook narration brief for professional voice actors and audiobook producers.

REQUIREMENTS:

1. **NARRATION STYLE GUIDE**
   - Recommended narration approach (single narrator vs. full cast)
   - Overall tone and mood (intimate, epic, conversational, dramatic, etc.)
   - Pacing guidance (leisurely, brisk, varies by scene)
   - Emotional range required
   - Genre-specific narration conventions

2. **CHARACTER VOICE GUIDELINES**
   - For each main character: age, gender, vocal characteristics, accent/dialect
   - Differentiation strategy (pitch, pace, accent, tone)
   - Character emotional arcs and how they should be reflected in voice
   - Relationships between characters and how that affects dialogue delivery

3. **TECHNICAL SPECIFICATIONS**
   - Suggested narration format (first-person intimate, third-person omniscient, etc.)
   - Chapter structure and transition notes
   - Special considerations (flashbacks, multiple timelines, unreliable narrator, etc.)
   - Sound effects or music recommendations (if any)

4. **SCRIPT FORMATTING NOTES**
   - Dialogue delivery notes
   - Internal monologue vs. spoken dialogue differentiation
   - Scene transitions and chapter breaks
   - Pronunciation guide for unusual names/terms (will be generated separately)

5. **SAMPLE SCRIPT SELECTION**
   - Recommend 3-5 passages (with approximate timestamps) that showcase:
     - Opening hook (first 5 minutes for ACX requirements)
     - Character dialogue variety
     - Emotional range
     - Genre tone
     - Narrative style

6. **PRODUCTION NOTES**
   - Estimated studio time (based on word count and complexity)
   - Difficulty level (beginner-friendly, intermediate, expert required)
   - Special vocal challenges (extensive dialogue, accents, character count, etc.)
   - Target listening experience (casual, immersive, literary, etc.)

7. **ACX/AUDIBLE OPTIMIZATION**
   - Retail audio sample recommendations (hook listeners in first 5 mins)
   - Chapter/section break strategy for listener navigation
   - Credits and front/back matter handling

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "narrationStyle": {
    "approach": "single-narrator|full-cast",
    "tone": "overall tone description",
    "pacing": "pacing guidance",
    "emotionalRange": "description of emotional range needed",
    "genreConventions": ["convention 1", "convention 2"]
  },
  "characterVoices": [
    {
      "characterName": "Name",
      "ageRange": "20s-30s",
      "gender": "male|female|non-binary",
      "vocalCharacteristics": "description",
      "accentDialect": "description or none",
      "emotionalArc": "brief arc description",
      "deliveryNotes": "how to voice this character"
    }
  ],
  "technicalSpecs": {
    "narrationFormat": "first-person|third-person-omniscient|third-person-limited",
    "chapterStructure": "description",
    "specialConsiderations": ["consideration 1", "consideration 2"],
    "soundEffectsMusic": "recommendations or none"
  },
  "scriptFormatting": {
    "dialogueNotes": "delivery guidance",
    "internalMonologue": "how to differentiate",
    "sceneTransitions": "how to handle",
    "pronunciationNeeded": ["term1", "term2"]
  },
  "sampleSelections": [
    {
      "section": "Opening (0-5 min)",
      "purpose": "Hook listeners, establish tone",
      "location": "Chapter/page reference",
      "notes": "why this section is ideal"
    }
  ],
  "productionNotes": {
    "estimatedStudioHours": number,
    "difficultyLevel": "beginner|intermediate|expert",
    "vocalChallenges": ["challenge 1", "challenge 2"],
    "targetExperience": "description"
  },
  "acxOptimization": {
    "retailSampleStrategy": "guidance for the ACX retail sample",
    "chapterBreakStrategy": "how to structure for listener navigation",
    "creditsFrontBackMatter": "how to handle"
  },
  "narratorPersonalityFit": "description of ideal narrator personality/strengths",
  "estimatedListeningTime": "X hours Y minutes"
}`;

    const narrationBrief = await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.BALANCED,
      'AudiobookNarrationAgent',
      this.env,
      userId,
      manuscriptId,
      'audiobook_generation',
      'generate_narration_brief'
    );

    // Validate structure
    validateRequiredFields(narrationBrief, ['narrationStyle', 'characterVoices', 'technicalSpecs'], 'Narration Brief');

    console.log('Audiobook narration brief generated successfully');
    return narrationBrief;
  }

  /**
   * Estimate narration time based on word count
   * Industry standard: ~9,300 words per finished hour of audio
   * @param {number} wordCount
   * @returns {string} Estimated time
   */
  estimateNarrationTime(wordCount) {
    if (!wordCount) return 'Unknown';

    const WORDS_PER_HOUR = 9300;
    const hours = wordCount / WORDS_PER_HOUR;
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);

    if (wholeHours === 0) {
      return `${minutes} minutes`;
    } else if (minutes === 0) {
      return `${wholeHours} ${wholeHours === 1 ? 'hour' : 'hours'}`;
    } else {
      return `${wholeHours} ${wholeHours === 1 ? 'hour' : 'hours'} ${minutes} minutes`;
    }
  }
}
