// Cover Design Agent
// Generates comprehensive cover design briefs and AI art prompts for book covers
// This helps authors create professional covers using designers or AI tools

import {
  AGENT_CONFIG,
  extractManuscriptText,
  callClaudeWithRetry,
  validateRequiredFields,
  storeAsset
} from '../utils/agent-utils.js';

export class CoverDesignAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
    this.agentName = 'CoverDesignAgent';
  }

  /**
   * Generate a comprehensive cover design brief from manuscript analysis
   *
   * @param {string} manuscriptKey - R2 storage key for the manuscript
   * @param {Object} developmentalAnalysis - Analysis results from the developmental editing agent
   * @param {string} genre - Book genre (thriller, romance, fantasy, etc.)
   * @returns {Promise<Object>} Generated cover design brief with AI art prompts
   * @throws {Error} If API key is missing or generation fails
   */
  async generate(manuscriptKey, developmentalAnalysis, genre) {
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

    // Generate the cover brief using Claude
    const coverBrief = await this.generateCoverBrief(excerpt, analysis, structure, genre);

    // Validate that we got all required fields
    validateRequiredFields(
      coverBrief,
      ['visualConcept', 'colorPalette', 'typography', 'aiArtPrompts'],
      'Cover Brief'
    );

    // Store in R2 for later retrieval
    await storeAsset(
      this.env.R2.getBucket('manuscripts_processed'),
      manuscriptKey,
      'cover-brief',
      coverBrief
    );

    // Return the result with metadata
    return {
      manuscriptKey,
      coverBrief,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate cover design brief using Claude AI
   * Creates detailed specifications for visual design, colors, typography, and AI prompts
   *
   * @private
   * @param {string} excerpt - Opening of the manuscript for context
   * @param {Object} analysis - Developmental analysis results
   * @param {Object} structure - Manuscript structure data (word count, etc.)
   * @param {string} genre - Book genre
   * @returns {Promise<Object>} Cover design brief with all specifications
   */
  async generateCoverBrief(excerpt, analysis, structure, genre) {
    // Build the prompt for Claude
    // This prompt is carefully structured to get consistent JSON output
    const prompt = `You are an expert book cover designer and art director specializing in covers that sell books on Amazon.

MANUSCRIPT CONTEXT:
Genre: ${genre}
Word Count: ${structure?.totalWords || 'Unknown'}

STORY ANALYSIS:
Overall Score: ${analysis.overallScore}/10
Plot Strengths: ${analysis.plot?.strengths?.join(', ') || 'N/A'}
Character Strengths: ${analysis.characters?.strengths?.join(', ') || 'N/A'}
Key Themes: ${analysis.topPriorities?.join(', ') || 'N/A'}
Mood/Tone: ${analysis.pacing?.overallTone || 'Varied'}
Setting: ${analysis.setting?.mainSetting || 'N/A'}

MANUSCRIPT OPENING:
${excerpt}

TASK: Create a comprehensive cover design brief that can be used by:
1. A professional designer
2. AI art generators (Midjourney, DALL-E, Stable Diffusion)
3. DIY authors using Canva or similar tools

REQUIREMENTS:
1. Visual Concept: Core imagery and composition that captures the story essence
2. Color Palette: Specific colors with emotional/genre justification
3. Typography: Font style recommendations (serif/sans-serif, elegant/bold, etc.)
4. Mood & Atmosphere: Overall emotional feel
5. Genre Conventions: Must-have elements for ${genre} covers
6. Target Audience Appeal: What makes this cover click for the right readers
7. AI Art Prompts: Ready-to-use prompts for Midjourney, DALL-E, Stable Diffusion
8. Design Elements: Specific visual motifs, symbols, or imagery
9. Composition Guidelines: Layout, focal points, negative space
10. Comparable Cover Examples: Reference successful covers in the genre

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "visualConcept": {
    "mainImagery": "Primary visual element description",
    "composition": "Layout and arrangement of elements",
    "focalPoint": "Where the eye should be drawn"
  },
  "colorPalette": {
    "primary": "Main color with hex code and reason",
    "secondary": "Secondary color with hex code and reason",
    "accent": "Accent color with hex code and reason",
    "overall": "Color scheme description (dark/light, vibrant/muted, etc.)"
  },
  "typography": {
    "titleFont": "Font style recommendation for title",
    "authorFont": "Font style for author name",
    "hierarchy": "Size and weight guidance",
    "placement": "Where text should appear"
  },
  "moodAtmosphere": "Overall emotional tone and atmosphere",
  "genreConventions": [
    "Must-have element 1 for ${genre}",
    "Must-have element 2",
    "Must-have element 3"
  ],
  "aiArtPrompts": {
    "midjourney": "Full Midjourney prompt with parameters",
    "dalle": "DALL-E 3 prompt",
    "stableDiffusion": "Stable Diffusion prompt with negative prompts"
  },
  "designElements": [
    "Specific visual motif or symbol 1",
    "Specific visual motif or symbol 2",
    "Specific visual motif or symbol 3"
  ],
  "comparableCovers": [
    "Title 1 by Author 1 - Why it works",
    "Title 2 by Author 2 - Why it works",
    "Title 3 by Author 3 - Why it works"
  ],
  "designerBrief": "Comprehensive brief for a professional designer (2-3 paragraphs)",
  "diyGuidance": {
    "canvaTemplate": "Which Canva template type to use",
    "keyTips": ["DIY tip 1", "DIY tip 2", "DIY tip 3"],
    "commonMistakes": ["Mistake to avoid 1", "Mistake to avoid 2"]
  },
  "targetAudienceAppeal": "What makes this cover click with the right readers"
}`;

    // Call Claude with automatic retry logic
    // Using CREATIVE temperature (0.8) for imaginative cover concepts
    return await callClaudeWithRetry(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.CREATIVE,
      this.agentName
    );
  }
}
