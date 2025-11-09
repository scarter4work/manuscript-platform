// Series Description Agent
// Generates series descriptions and multi-book arc planning
// Helps authors plan and market book series with compelling hooks and strategy

import {
  AGENT_CONFIG,
  extractManuscriptText,
  callClaudeWithRetry,
  validateRequiredFields,
  storeAsset
} from '../utils/agent-utils.js';

export class SeriesDescriptionAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
    this.agentName = 'SeriesDescriptionAgent';
  }

  /**
   * Generate series description and multi-book arc planning
   *
   * @param {string} manuscriptKey - R2 storage key for the manuscript
   * @param {Object} developmentalAnalysis - Analysis results from the developmental editing agent
   * @param {string} genre - Book genre (thriller, romance, fantasy, etc.)
   * @param {Object} seriesData - Optional series metadata
   * @param {string} seriesData.seriesTitle - Title of the series
   * @param {number} seriesData.bookNumber - Which book this is (1, 2, 3, etc.)
   * @param {number} seriesData.totalBooks - Total number of books planned
   * @returns {Promise<Object>} Generated series descriptions and arc planning
   * @throws {Error} If API key is missing or generation fails
   */
  async generate(manuscriptKey, developmentalAnalysis, genre, seriesData = {}) {
    console.log(`${this.agentName}: Starting generation for ${manuscriptKey}`);

    // Ensure API key is available
    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured in environment variables');
    }

    // Extract the analysis data (handle different structures)
    const analysis = developmentalAnalysis.analysis || developmentalAnalysis;
    const structure = developmentalAnalysis.structure;

    // Get manuscript excerpt for context
    const manuscript = await this.env.R2.getBucket('manuscripts_raw').get(manuscriptKey);
    if (!manuscript) {
      throw new Error(`Manuscript not found: ${manuscriptKey}`);
    }

    // Extract first ~5000 characters for AI context
    const excerpt = await extractManuscriptText(manuscript);

    // Generate the series description using Claude
    const seriesDescription = await this.generateSeriesDescription(
      excerpt,
      analysis,
      structure,
      genre,
      seriesData
    );

    // Validate that we got all required fields
    validateRequiredFields(
      seriesDescription,
      ['seriesTagline', 'shortSeriesDescription', 'bookByBookArc'],
      'Series Description'
    );

    // Additional validation: ensure we have enough books in the arc
    if (!Array.isArray(seriesDescription.bookByBookArc) ||
        seriesDescription.bookByBookArc.length < 3) {
      throw new Error('Series description must include at least 3 books in the arc');
    }

    // Store in R2 for later retrieval
    await storeAsset(
      this.env.R2.getBucket('manuscripts_processed'),
      manuscriptKey,
      'series-description',
      seriesDescription
    );

    // Return the result with metadata
    return {
      manuscriptKey,
      seriesDescription,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate series description using Claude AI
   * Creates taglines, descriptions, and multi-book arc planning
   *
   * @private
   * @param {string} excerpt - Opening of the manuscript for context
   * @param {Object} analysis - Developmental analysis results
   * @param {Object} structure - Manuscript structure data (word count, etc.)
   * @param {string} genre - Book genre
   * @param {Object} seriesData - Optional series metadata (title, book number, total books)
   * @returns {Promise<Object>} Series description with marketing materials and arc planning
   */
  async generateSeriesDescription(excerpt, analysis, structure, genre, seriesData) {
    // Extract series data with sensible defaults
    const bookNumber = seriesData.bookNumber || 1;
    const totalBooks = seriesData.totalBooks || 3;
    const seriesTitle = seriesData.seriesTitle || 'Untitled Series';

    // Build the prompt for Claude
    // This prompt is carefully structured to get consistent JSON output
    const prompt = `You are an expert book marketing copywriter specializing in series descriptions that hook readers into multi-book story arcs.

SERIES CONTEXT:
Series Title: ${seriesTitle}
This Book: Book ${bookNumber} of ${totalBooks}
Genre: ${genre}

CURRENT BOOK ANALYSIS:
Overall Score: ${analysis.overallScore}/10
Plot Strengths: ${analysis.plot?.strengths?.join(', ') || 'N/A'}
Character Strengths: ${analysis.characters?.strengths?.join(', ') || 'N/A'}
Key Themes: ${analysis.topPriorities?.join(', ') || 'N/A'}
Character Arc: ${analysis.characters?.developmentArc || 'Classic hero\'s journey'}
Conflict Resolution: ${analysis.plot?.conflictResolution || 'N/A'}

MANUSCRIPT OPENING:
${excerpt}

TASK: Create compelling series descriptions for different platforms and use cases.

REQUIREMENTS:
1. Series Tagline: One memorable sentence that captures the entire series essence
2. Series Hook: Opening paragraph that makes readers want to start Book 1
3. Overarching Conflict: What's the big story spanning all books?
4. Character Journey: How does the protagonist evolve across the series?
5. Stakes: What's at risk if they fail the overall series quest?
6. World/Setting: What makes this series world unique and immersive?
7. Reading Order: Should books be read in order or can they stand alone?
8. Target Audience: Who will love this series?
9. Series Comparison: "If you liked X series, you'll love this"
10. Book-by-Book Arc: Brief description of each book's role in the series

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "seriesTagline": "One compelling sentence that defines the series",
  "shortSeriesDescription": "100-150 words - Quick pitch for back of books",
  "longSeriesDescription": "300-400 words - Detailed series overview for website/marketing",
  "overarchingConflict": "The big conflict/mystery/quest spanning all books",
  "characterJourney": {
    "protagonist": "Main character name/description",
    "startingPoint": "Where they begin (Book 1)",
    "endPoint": "Where they end (Final book)",
    "transformation": "How they change across the series"
  },
  "worldBuilding": "What makes the series world unique and worth exploring for multiple books",
  "readingOrder": {
    "mustReadInOrder": true,
    "reason": "Why order matters or why books can stand alone",
    "newReaderStart": "Best entry point for new readers"
  },
  "bookByBookArc": [
    {
      "bookNumber": 1,
      "tentativeTitle": "Suggested title for Book 1",
      "purpose": "Sets up the world and introduces conflict",
      "cliffhanger": "What hooks readers into Book 2"
    },
    {
      "bookNumber": 2,
      "tentativeTitle": "Suggested title for Book 2",
      "purpose": "Deepens the mystery/raises the stakes",
      "cliffhanger": "What hooks readers into Book 3"
    },
    {
      "bookNumber": 3,
      "tentativeTitle": "Suggested title for Book 3",
      "purpose": "Brings the series to a satisfying conclusion",
      "resolution": "How the series concludes"
    }
  ],
  "seriesThemes": [
    "Major theme 1",
    "Major theme 2",
    "Major theme 3"
  ],
  "targetAudience": "Description of ideal series readers",
  "comparableSeries": [
    "Series 1 - Why it's similar",
    "Series 2 - Why it's similar",
    "Series 3 - Why it's similar"
  ],
  "marketingHooks": [
    "Marketing angle 1",
    "Marketing angle 2",
    "Marketing angle 3"
  ],
  "seriesHashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
  "bingeAppeal": "What makes readers devour one book after another",
  "firstBookHook": "Specific pitch for getting readers to start Book 1"
}`;

    // Call Claude with automatic retry logic
    // Using CREATIVE temperature (0.8) for engaging series descriptions
    return await callClaudeWithRetry(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.CREATIVE,
      this.agentName
    );
  }
}
