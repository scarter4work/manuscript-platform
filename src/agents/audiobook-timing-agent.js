// Audiobook Timing Agent
// Calculates narration time estimates per chapter and identifies pacing issues

import {
  callClaudeWithCostTracking,
  extractManuscriptText,
  validateRequiredFields,
  storeAsset,
  AGENT_CONFIG
} from './agent-utils.js';

export class AudiobookTimingAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Generate chapter timing estimates and pacing analysis
   * @param {string} manuscriptKey - R2 key for the manuscript
   * @param {Object} developmentalAnalysis - Results from developmental agent
   * @param {string} genre - Book genre
   * @param {string} userId - User ID for cost tracking
   * @param {string} manuscriptId - Manuscript ID for cost tracking
   * @returns {Object} Generated timing estimates and pacing analysis
   */
  async generate(manuscriptKey, developmentalAnalysis, genre, userId, manuscriptId) {
    console.log(`Generating audiobook timing estimates for ${manuscriptKey}`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    // Extract key elements from developmental analysis
    const analysis = developmentalAnalysis.analysis || developmentalAnalysis;
    const structure = developmentalAnalysis.structure;
    const chapters = structure?.chapters || [];

    // Get manuscript for chapter analysis
    const manuscript = await this.env.MANUSCRIPTS_RAW.get(manuscriptKey);
    const textContent = await extractManuscriptText(manuscript, 30000); // Substantial excerpt for timing analysis

    const timingAnalysis = await this.generateTimingAnalysis(
      textContent,
      analysis,
      structure,
      genre,
      chapters,
      userId,
      manuscriptId
    );

    // Store results
    await storeAsset(
      this.env.MANUSCRIPTS_PROCESSED,
      manuscriptKey,
      'audiobook-timing',
      timingAnalysis
    );

    return {
      manuscriptKey,
      timingAnalysis,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate timing analysis using Claude
   */
  async generateTimingAnalysis(excerpt, analysis, structure, genre, chapters, userId, manuscriptId) {
    const totalWords = structure?.totalWords || 0;
    const chapterCount = structure?.chapterCount || 0;
    const avgWordsPerChapter = chapterCount > 0 ? Math.round(totalWords / chapterCount) : 0;

    const chaptersInfo = chapters.slice(0, 10).map(ch =>
      `Chapter ${ch.number || ch.title}: ${ch.wordCount || 'Unknown'} words`
    ).join('\n') || 'No chapter breakdown available';

    const prompt = `You are an expert audiobook production specialist with deep knowledge of narration timing, pacing, and audio production planning.

MANUSCRIPT CONTEXT:
Genre: ${genre}
Total Word Count: ${totalWords.toLocaleString()}
Chapter Count: ${chapterCount}
Average Words per Chapter: ${avgWordsPerChapter.toLocaleString()}

PACING ANALYSIS:
Overall Pacing: ${analysis.pacing?.overall || 'Not analyzed'}
Pacing Issues: ${analysis.pacing?.issues?.join(', ') || 'None identified'}

CHAPTER INFORMATION:
${chaptersInfo}

MANUSCRIPT EXCERPT (for pacing analysis):
${excerpt}

TASK: Create comprehensive audiobook timing estimates and identify pacing considerations for narration planning.

INDUSTRY STANDARDS:
- Average narration speed: 150-160 words per minute (WPM)
- Finished hour of audio: ~9,300-9,400 words
- Slower narration (literary, complex): ~8,500 words/hour
- Faster narration (thriller, action): ~10,000 words/hour
- Dialogue-heavy sections: slower (more character changes)
- Descriptive prose: can be faster
- Technical content: slower for clarity

REQUIREMENTS:

1. **OVERALL TIMING ESTIMATE**
   - Total estimated listening time (hours:minutes)
   - Narration speed recommendation (slow/medium/fast)
   - Rationale for speed choice based on genre and content
   - Studio time estimate (recording + breaks + retakes): typically 2-3x listening time
   - Post-production time estimate

2. **CHAPTER-BY-CHAPTER ESTIMATES**
   - For each chapter (or estimate if chapter data incomplete):
     - Word count
     - Estimated narration time (minutes)
     - Pacing notes (slower/faster sections)
     - Natural break points for studio sessions

3. **PACING ANALYSIS FOR NARRATION**
   - Identify sections requiring slower narration (complex, emotional, technical)
   - Identify sections allowing faster narration (action, dialogue, transitions)
   - Dramatic tension points requiring pacing variation
   - Climactic scenes requiring special attention
   - Genre-appropriate pacing strategy

4. **PRODUCTION SCHEDULING**
   - Recommended studio session breakdown
   - Daily recording targets (hours of finished audio)
   - Natural stopping points for narrator breaks
   - Quality check points (every X hours)
   - Retake buffer time

5. **LISTENER EXPERIENCE**
   - Optimal chapter length for listener sessions
   - Natural pause points for commuters/multitaskers
   - Binge-listening considerations
   - Chapter cliffhangers and their impact on pacing

6. **NARRATION CHALLENGES**
   - Sections requiring extra studio time (dialogue, accents, emotion)
   - Breath control considerations (long sentences)
   - Vocal fatigue risk areas (intense emotion, action sequences)
   - Technical difficulty multiplier (1x-3x normal time)

7. **ACX/AUDIBLE SPECIFICATIONS**
   - Meets ACX minimum (15 minutes) and maximum (no limit)
   - Retail audio sample placement (first 5 min or custom)
   - Chapter break timing for listener navigation
   - Opening/closing credits duration

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "overallTiming": {
    "totalListeningTime": "X hours Y minutes",
    "totalListeningMinutes": number,
    "recommendedNarrationSpeed": "slow|medium|fast (X WPM)",
    "rationale": "why this speed is appropriate",
    "estimatedStudioHours": number,
    "estimatedPostProductionHours": number,
    "totalProductionDays": number
  },
  "chapterEstimates": [
    {
      "chapterNumber": number,
      "chapterTitle": "title or null",
      "wordCount": number,
      "estimatedMinutes": number,
      "pacing": "slower|normal|faster",
      "pacingNotes": "why this pacing",
      "breakPoints": ["natural breaks for studio sessions"],
      "difficulty": "easy|moderate|challenging"
    }
  ],
  "pacingStrategy": {
    "slowerSections": [
      {
        "location": "chapter/page reference",
        "reason": "complex|emotional|technical",
        "recommendedWPM": number,
        "notes": "guidance"
      }
    ],
    "fasterSections": [
      {
        "location": "chapter/page reference",
        "reason": "action|dialogue|transition",
        "recommendedWPM": number,
        "notes": "guidance"
      }
    ],
    "dramaticTensionPoints": ["locations requiring special pacing attention"],
    "genreStrategy": "overall genre-appropriate pacing approach"
  },
  "productionSchedule": {
    "sessionBreakdown": [
      {
        "session": number,
        "chapters": "1-3",
        "estimatedTime": "X hours",
        "focusArea": "establishing character voices|action sequences|etc"
      }
    ],
    "dailyTarget": "X hours of finished audio per day",
    "recommendedBreaks": "every X minutes|chapters",
    "qualityCheckPoints": ["after chapter X", "at midpoint", "etc"],
    "retakeBufferPercent": number
  },
  "listenerExperience": {
    "optimalChapterLength": "X-Y minutes",
    "naturalPausePoints": ["chapter endings", "scene breaks", "etc"],
    "bingeListeningFriendly": true|false,
    "commuterFriendly": true|false,
    "notes": "listener experience considerations"
  },
  "narrationChallenges": {
    "difficultSections": [
      {
        "location": "chapter/page reference",
        "challenge": "dialogue-heavy|accent-heavy|emotionally-intense|technical",
        "timeMultiplier": number,
        "mitigation": "how to handle"
      }
    ],
    "vocalFatigueRisks": ["locations where narrator may tire"],
    "breathControlConsiderations": "long sentence guidance",
    "overallDifficultyRating": "easy|moderate|challenging|expert-required"
  },
  "acxOptimization": {
    "meetsACXMinimum": true|false,
    "recommendedRetailSampleStart": "00:00:00",
    "recommendedRetailSampleEnd": "00:05:00",
    "chapterBreakStrategy": "guidance for ACX chapter markers",
    "openingCreditsSeconds": number,
    "closingCreditsSeconds": number
  },
  "budgetEstimate": {
    "pfhRate": "industry standard $200-400 per finished hour",
    "estimatedNarratorCost": "$X-Y based on Z hours at PFH rate",
    "postProductionCost": "estimated mastering/editing cost",
    "totalEstimate": "$X-Y total audiobook production"
  }
}`;

    const timingAnalysis = await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.BALANCED,
      'AudiobookTimingAgent',
      this.env,
      userId,
      manuscriptId,
      'audiobook_generation',
      'generate_timing_analysis'
    );

    // Validate structure
    validateRequiredFields(timingAnalysis, ['overallTiming', 'pacingStrategy', 'productionSchedule'], 'Timing Analysis');

    console.log(`Timing analysis generated successfully (${timingAnalysis.overallTiming.totalListeningTime})`);
    return timingAnalysis;
  }
}
