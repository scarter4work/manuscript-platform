// Format Conversion Agent
// Validates and prepares manuscripts for EPUB, MOBI, PDF, and platform-specific formats

import {
  callClaudeWithCostTracking,
  validateRequiredFields,
  storeAsset,
  AGENT_CONFIG
} from '../utils/agent-utils.js';

export class FormatConversionAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Validate and prepare manuscript for target formats
   * @param {string} manuscriptKey - R2 key for manuscript
   * @param {Array} targetFormats - Formats to prepare for (epub, mobi, pdf, print)
   * @param {Object} manuscriptMetadata - Manuscript metadata (title, author, etc.)
   * @param {string} userId - User ID for cost tracking
   * @param {string} manuscriptId - Manuscript ID for cost tracking
   * @returns {Object} Format validation and preparation results
   */
  async prepareFormats(manuscriptKey, targetFormats, manuscriptMetadata, userId, manuscriptId) {
    console.log(`Preparing formats: ${targetFormats.join(', ')}`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    // Fetch manuscript content
    const manuscriptObj = await this.env.MANUSCRIPTS.get(manuscriptKey);
    if (!manuscriptObj) {
      throw new Error(`Manuscript not found: ${manuscriptKey}`);
    }

    const manuscriptText = await manuscriptObj.text();

    // Analyze manuscript structure
    const structureAnalysis = await this.analyzeStructure(
      manuscriptText,
      manuscriptMetadata,
      userId,
      manuscriptId
    );

    // Prepare each format
    const formatResults = {};
    for (const format of targetFormats) {
      formatResults[format] = await this.prepareFormat(
        format,
        manuscriptText,
        structureAnalysis,
        manuscriptMetadata,
        userId,
        manuscriptId
      );
    }

    // Store results
    const storageKey = `format-prep-${manuscriptId}-${Date.now()}`;
    await storeAsset(
      this.env.R2.getBucket('manuscripts_processed'),
      storageKey,
      'format-preparation',
      {
        formats: formatResults,
        structure: structureAnalysis,
        generatedAt: new Date().toISOString()
      }
    );

    return {
      formats: formatResults,
      structure: structureAnalysis
    };
  }

  /**
   * Analyze manuscript structure for formatting
   */
  async analyzeStructure(manuscriptText, metadata, userId, manuscriptId) {
    const sampleText = manuscriptText.substring(0, 10000); // First 10k chars

    const prompt = `You are an expert eBook formatter and print book designer. Analyze this manuscript structure for formatting requirements.

MANUSCRIPT SAMPLE (first 10,000 characters):
${sampleText}

METADATA:
Title: ${metadata.title}
Author: ${metadata.author || 'Unknown'}
Genre: ${metadata.genre}
Word Count: ${metadata.wordCount || 'Unknown'}

TASK: Analyze the manuscript structure and identify formatting requirements.

ANALYZE:

1. **CHAPTER STRUCTURE**
   - How are chapters marked? (e.g., "Chapter 1", "CHAPTER ONE", "1", roman numerals)
   - Consistent chapter headings?
   - Scene breaks within chapters?
   - Part divisions?

2. **FRONT MATTER** (if present)
   - Title page
   - Copyright page
   - Dedication
   - Epigraph
   - Table of contents
   - Prologue

3. **BACK MATTER** (if present)
   - Epilogue
   - Acknowledgments
   - Author bio
   - Preview of next book
   - Additional content

4. **FORMATTING ELEMENTS**
   - Italics usage (thoughts, emphasis, foreign words)
   - Bold usage
   - Em dashes vs hyphens
   - Quote styles (straight vs curly)
   - Paragraph spacing
   - Indentation

5. **SPECIAL ELEMENTS**
   - Letters or documents
   - Poetry or song lyrics
   - Multiple POVs or narrators
   - Unusual formatting needs
   - Images or illustrations

6. **ISSUES DETECTED**
   - Formatting inconsistencies
   - Potential conversion problems
   - Elements that need attention
   - Platform-specific concerns

Provide response as JSON:
{
  "chapterStructure": {
    "format": "Chapter N",
    "consistency": "high|medium|low",
    "count": 25,
    "hasPartDivisions": false,
    "sceneBreaks": "asterisks"
  },
  "frontMatter": {
    "elements": ["title_page", "copyright", "dedication"],
    "suggestedOrder": [],
    "missingRecommended": ["table_of_contents"]
  },
  "backMatter": {
    "elements": ["acknowledgments", "author_bio"],
    "suggestedAdditions": ["preview_of_next_book", "newsletter_signup"]
  },
  "formattingElements": {
    "italics": "present and consistent",
    "bold": "minimal use",
    "dashes": "em dashes used",
    "quotes": "curly quotes",
    "paragraphs": "indented first line"
  },
  "specialElements": [
    {
      "type": "letter",
      "location": "Chapter 5",
      "formattingNeeds": "Indent or italicize to distinguish from narrative"
    }
  ],
  "issuesDetected": [
    {
      "issue": "Inconsistent chapter numbering",
      "severity": "medium",
      "location": "Chapters 10-15",
      "recommendation": "Standardize to 'Chapter N' format"
    }
  ],
  "recommendations": {
    "epub": ["Ensure proper chapter breaks", "Add semantic markup for letters"],
    "mobi": ["Test scene breaks render correctly", "Verify italics preservation"],
    "pdf": ["Set up running headers", "Configure page numbers"],
    "print": ["Add blank pages for chapter starts", "Ensure proper gutters"]
  }
}`;

    const analysis = await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.BALANCED,
      'FormatConversionAgent',
      this.env,
      userId,
      manuscriptId,
      'publishing',
      'analyze_structure'
    );

    validateRequiredFields(analysis, ['chapterStructure'], 'Structure Analysis');

    return analysis;
  }

  /**
   * Prepare manuscript for specific format
   */
  async prepareFormat(format, manuscriptText, structureAnalysis, metadata, userId, manuscriptId) {
    console.log(`Preparing ${format} format`);

    switch (format) {
      case 'epub':
        return await this.prepareEPUB(structureAnalysis, metadata, userId, manuscriptId);
      case 'mobi':
        return await this.prepareMOBI(structureAnalysis, metadata, userId, manuscriptId);
      case 'pdf':
        return await this.preparePDF(structureAnalysis, metadata, userId, manuscriptId);
      case 'print':
        return await this.preparePrint(structureAnalysis, metadata, userId, manuscriptId);
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  /**
   * Prepare EPUB format
   */
  async prepareEPUB(structureAnalysis, metadata, userId, manuscriptId) {
    const prompt = `Generate EPUB preparation guidelines for: ${metadata.title}

STRUCTURE ANALYSIS:
${JSON.stringify(structureAnalysis, null, 2)}

TASK: Create EPUB-specific formatting guidelines and validation checklist.

REQUIREMENTS:

1. **EPUB SPECIFICATIONS**
   - EPUB version recommendation (2.0.1 vs 3.0)
   - Required metadata in OPF file
   - NCX vs Nav document
   - CSS recommendations

2. **FORMATTING GUIDELINES**
   - Chapter break markup
   - Scene break handling
   - Special element formatting (letters, poems, etc.)
   - Image specifications
   - Font recommendations

3. **VALIDATION CHECKLIST**
   - EPUBCheck validation points
   - Common errors to avoid
   - Platform-specific considerations (Kindle, Apple Books, Kobo, Nook)

4. **ACCESSIBILITY**
   - Alt text for images
   - Semantic HTML
   - Navigation structure
   - Screen reader compatibility

Provide response as JSON:
{
  "format": "epub",
  "epubVersion": "3.0",
  "specifications": {
    "metadata": {
      "required": ["title", "author", "language", "identifier"],
      "recommended": ["subject", "description", "publisher", "rights"]
    },
    "structure": {
      "navDocument": true,
      "ncx": true,
      "toc": true
    }
  },
  "formattingGuidelines": {
    "chapters": "Use <section> tags with id attributes",
    "sceneBreaks": "Use <hr/> or centered asterisks with CSS",
    "specialElements": {},
    "images": {
      "format": "JPG or PNG",
      "maxWidth": "1400px",
      "dpi": "72-150"
    },
    "fonts": "Embed custom fonts or use standard serif/sans-serif"
  },
  "css": {
    "recommendations": [
      "Use relative units (em, %) not pixels",
      "Avoid absolute positioning",
      "Test with different font sizes",
      "Ensure sufficient contrast"
    ],
    "sampleCSS": "body { margin: 1em; line-height: 1.5; }"
  },
  "validationChecklist": [
    "Run EPUBCheck validator",
    "Test on multiple readers (Calibre, Adobe Digital Editions)",
    "Verify chapter navigation works",
    "Check table of contents links",
    "Ensure images display correctly",
    "Test font sizing/resizing"
  ],
  "platformConsiderations": {
    "kindle": ["Test with Kindle Previewer", "Verify KF8 compatibility"],
    "apple": ["Check fixed layout if used", "Test on iPad"],
    "kobo": ["Verify custom fonts work", "Test kepub format"],
    "nook": ["Check color profiles", "Test on Nook device/app"]
  },
  "accessibility": {
    "required": [
      "Alt text for all images",
      "Semantic HTML5 elements",
      "Proper heading hierarchy",
      "Language tags"
    ],
    "recommended": [
      "ARIA labels where needed",
      "Skip navigation links",
      "Table captions and summaries"
    ]
  },
  "estimatedEffort": "2-4 hours for standard manuscript",
  "toolsRecommended": ["Calibre", "Sigil", "EPUBCheck", "Kindle Previewer"]
}`;

    const epubPrep = await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.PRECISE,
      'FormatConversionAgent',
      this.env,
      userId,
      manuscriptId,
      'publishing',
      'prepare_epub'
    );

    validateRequiredFields(epubPrep, ['format', 'specifications'], 'EPUB Preparation');

    return epubPrep;
  }

  /**
   * Prepare MOBI/KF8 format
   */
  async prepareMOBI(structureAnalysis, metadata, userId, manuscriptId) {
    // Similar to EPUB but Kindle-specific
    return {
      format: 'mobi',
      note: 'MOBI/KF8 preparation guidelines',
      recommendations: [
        'Use KDP conversion tools',
        'Test with Kindle Previewer',
        'Ensure proper chapter navigation',
        'Verify X-Ray compatibility'
      ]
    };
  }

  /**
   * Prepare PDF format
   */
  async preparePDF(structureAnalysis, metadata, userId, manuscriptId) {
    return {
      format: 'pdf',
      note: 'PDF preparation guidelines',
      specifications: {
        trimSize: '6x9 inches',
        margins: { top: 0.75, bottom: 0.75, inner: 0.875, outer: 0.625 },
        fonts: 'Embed all fonts',
        colorSpace: 'CMYK for print, RGB for screen'
      }
    };
  }

  /**
   * Prepare print format
   */
  async preparePrint(structureAnalysis, metadata, userId, manuscriptId) {
    return {
      format: 'print',
      note: 'Print-ready preparation guidelines',
      specifications: {
        trimSize: '6x9 inches standard',
        interior: 'Cream or white paper',
        binding: 'Perfect bound',
        bleed: '0.125 inches if cover extends to edge'
      }
    };
  }
}
