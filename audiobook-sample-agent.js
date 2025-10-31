// Audiobook Sample Selection Agent
// Identifies optimal passages for auditions and retail audio samples

import {
  callClaudeWithCostTracking,
  extractManuscriptText,
  validateRequiredFields,
  storeAsset,
  AGENT_CONFIG
} from './agent-utils.js';

export class AudiobookSampleAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Generate audiobook sample selections
   * @param {string} manuscriptKey - R2 key for the manuscript
   * @param {Object} developmentalAnalysis - Results from developmental agent
   * @param {string} genre - Book genre
   * @param {string} userId - User ID for cost tracking
   * @param {string} manuscriptId - Manuscript ID for cost tracking
   * @returns {Object} Generated sample selections
   */
  async generate(manuscriptKey, developmentalAnalysis, genre, userId, manuscriptId) {
    console.log(`Generating audiobook sample selections for ${manuscriptKey}`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    // Extract key elements from developmental analysis
    const analysis = developmentalAnalysis.analysis || developmentalAnalysis;
    const structure = developmentalAnalysis.structure;

    // Get manuscript for sample analysis
    const manuscript = await this.env.MANUSCRIPTS_RAW.get(manuscriptKey);
    const textContent = await extractManuscriptText(manuscript, 40000); // Large excerpt for sample selection

    const sampleSelections = await this.generateSampleSelections(
      textContent,
      analysis,
      structure,
      genre,
      userId,
      manuscriptId
    );

    // Store results
    await storeAsset(
      this.env.MANUSCRIPTS_PROCESSED,
      manuscriptKey,
      'audiobook-samples',
      sampleSelections
    );

    return {
      manuscriptKey,
      sampleSelections,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate sample selections using Claude
   */
  async generateSampleSelections(excerpt, analysis, structure, genre, userId, manuscriptId) {
    const totalWords = structure?.totalWords || 0;

    const prompt = `You are an expert audiobook producer and casting director with deep knowledge of narrator auditions, retail audio samples, and listener engagement.

MANUSCRIPT CONTEXT:
Genre: ${genre}
Total Word Count: ${totalWords.toLocaleString()}
Overall Quality Score: ${analysis.overallScore}/10
Hook Strength: ${analysis.hook?.score || 'Not analyzed'}/10
Marketability: ${analysis.marketability?.score || 'Not analyzed'}/10

STORY STRENGTHS:
Plot: ${analysis.plot?.strengths?.join(', ') || 'Not analyzed'}
Characters: ${analysis.characters?.strengths?.join(', ') || 'Not analyzed'}
Dialogue: ${analysis.dialogue?.strengths?.join(', ') || 'Not analyzed'}

MANUSCRIPT TEXT (for sample analysis):
${excerpt}

TASK: Identify the best passages for audiobook samples. You need to select passages for different purposes: narrator auditions, retail audio samples (first 5 minutes that hook listeners), and showcasing the book's strengths.

ACX/AUDIBLE REQUIREMENTS:
- Retail audio sample: First 5 minutes of the audiobook (typically opening)
- ACX requires samples that represent the book's content and narrator's skill
- Samples should hook potential buyers immediately
- Must showcase narrator's range and the story's appeal

AUDITION SAMPLE REQUIREMENTS:
- 3-5 minutes of narration
- Showcase character voices (if multiple characters)
- Include dialogue and narrative prose
- Display emotional range
- Representative of the book's tone and style
- Not necessarily the opening (can be from middle if more compelling)

REQUIREMENTS:

1. **RETAIL AUDIO SAMPLE (Primary - ACX/Audible)**
   - Must be opening of book (first ~5 minutes)
   - Identify exact start and end points
   - Estimated word count (750-850 words ≈ 5 minutes)
   - Hook analysis: Why this hooks listeners
   - Genre alignment: How it signals genre to listeners
   - Character introduction: What characters/voice we hear
   - Purchase motivation: Why listeners will buy after hearing this

2. **NARRATOR AUDITION SAMPLES (3-5 passages)**
   - For each sample:
     - Location in manuscript (chapter/page estimate)
     - Purpose (showcase dialogue/emotion/range/tone)
     - Estimated duration (minutes)
     - Word count range
     - Why this passage is ideal for auditions
     - Vocal challenges it presents
     - Characters involved
     - Emotional beat

3. **SHOWCASE SAMPLES (Bonus - for marketing)**
   - Best action sequence (if applicable)
   - Best emotional moment
   - Best dialogue exchange
   - Most characteristic scene (essence of the book)
   - Cliffhanger moment (for promotion)

4. **SAMPLE SELECTION STRATEGY**
   - Rationale for all selections
   - How samples work together to represent the book
   - Diversity of emotional tones across samples
   - Range of narrator skills required
   - Casting considerations

5. **LISTENER HOOK ANALYSIS**
   - What makes each sample compelling
   - Genre expectations fulfilled
   - Emotional engagement points
   - Question/tension created
   - Purchase triggers

SAMPLE NOTATION:
- Provide approximate location (chapter, page estimate, or scene description)
- Estimate word count for timing
- Note starting and ending phrases for exact identification

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "retailAudioSample": {
    "startLocation": "exact starting phrase or chapter 1 opening",
    "endLocation": "exact ending phrase after ~5 minutes",
    "estimatedWords": number,
    "estimatedDuration": "5:00",
    "hookAnalysis": "why this hooks listeners",
    "genreSignals": ["signal 1", "signal 2"],
    "charactersIntroduced": ["character names"],
    "purchaseMotivation": "why listeners will buy",
    "strengths": ["strength 1", "strength 2"],
    "potentialWeaknesses": ["if any concerns about this opening"],
    "actualTextSnippet": "First few sentences to identify the exact passage"
  },
  "auditionSamples": [
    {
      "sampleNumber": 1,
      "location": "Chapter X or scene description",
      "purpose": "showcase dialogue|emotional range|action|tone|character voices",
      "estimatedWords": number,
      "estimatedDuration": "3:00-5:00",
      "rationale": "why this is ideal for auditions",
      "vocalChallenges": ["challenge 1", "challenge 2"],
      "charactersInvolved": ["character names"],
      "emotionalBeat": "description",
      "startingPhrase": "to identify passage",
      "endingPhrase": "to identify passage"
    }
  ],
  "showcaseSamples": {
    "bestAction": {
      "location": "chapter/scene",
      "reason": "why this is the best action sequence",
      "estimatedWords": number,
      "snippet": "brief excerpt"
    },
    "bestEmotional": {
      "location": "chapter/scene",
      "reason": "why this is the best emotional moment",
      "estimatedWords": number,
      "snippet": "brief excerpt"
    },
    "bestDialogue": {
      "location": "chapter/scene",
      "reason": "why this is the best dialogue exchange",
      "estimatedWords": number,
      "snippet": "brief excerpt"
    },
    "mostCharacteristic": {
      "location": "chapter/scene",
      "reason": "essence of the book in one scene",
      "estimatedWords": number,
      "snippet": "brief excerpt"
    },
    "bestCliffhanger": {
      "location": "chapter/scene",
      "reason": "ideal for promotional clips",
      "estimatedWords": number,
      "snippet": "brief excerpt"
    }
  },
  "selectionStrategy": {
    "overallRationale": "why these samples work together",
    "emotionalDiversity": "range of tones represented",
    "narratorSkillsRequired": ["skill 1", "skill 2"],
    "castingConsiderations": "what kind of narrator this needs",
    "genreAlignment": "how samples represent genre conventions"
  },
  "listenerHookPoints": {
    "immediateHooks": ["what grabs attention in first 30 seconds"],
    "emotionalEngagement": ["emotional connection points"],
    "questionsRaised": ["mysteries/tensions that drive continued listening"],
    "purchaseTriggers": ["elements that convert browsers to buyers"],
    "genreExpectations": "how samples fulfill genre promises"
  },
  "productionNotes": "additional guidance for using these samples"
}`;

    const sampleSelections = await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.BALANCED,
      'AudiobookSampleAgent',
      this.env,
      userId,
      manuscriptId,
      'audiobook_generation',
      'generate_sample_selections'
    );

    // Validate structure
    validateRequiredFields(sampleSelections, ['retailAudioSample', 'auditionSamples', 'selectionStrategy'], 'Sample Selections');

    console.log(`Sample selections generated successfully (${sampleSelections.auditionSamples?.length || 0} audition samples identified)`);
    return sampleSelections;
  }
}
