// Audiobook Metadata Agent
// Generates ACX/Audible metadata for audiobook submission and distribution

import {
  callClaudeWithCostTracking,
  extractManuscriptText,
  validateRequiredFields,
  storeAsset,
  AGENT_CONFIG
} from '../utils/agent-utils.js';

export class AudiobookMetadataAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Generate ACX/Audible audiobook metadata
   * @param {string} manuscriptKey - R2 key for the manuscript
   * @param {Object} developmentalAnalysis - Results from developmental agent
   * @param {Object} bookDescription - Results from book description agent
   * @param {Object} categories - Results from category agent
   * @param {Object} keywords - Results from keyword agent
   * @param {string} genre - Book genre
   * @param {string} userId - User ID for cost tracking
   * @param {string} manuscriptId - Manuscript ID for cost tracking
   * @returns {Object} Generated audiobook metadata
   */
  async generate(manuscriptKey, developmentalAnalysis, bookDescription, categories, keywords, genre, userId, manuscriptId) {
    console.log(`Generating audiobook metadata for ${manuscriptKey}`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    // Extract key elements from existing analysis
    const analysis = developmentalAnalysis.analysis || developmentalAnalysis;
    const structure = developmentalAnalysis.structure;

    // Get manuscript for additional context
    const manuscript = await this.env.MANUSCRIPTS_RAW.get(manuscriptKey);
    const textContent = await extractManuscriptText(manuscript, 5000); // Brief excerpt

    const audiobookMetadata = await this.generateAudiobookMetadata(
      textContent,
      analysis,
      structure,
      bookDescription,
      categories,
      keywords,
      genre,
      userId,
      manuscriptId
    );

    // Store results
    await storeAsset(
      this.env.MANUSCRIPTS_PROCESSED,
      manuscriptKey,
      'audiobook-metadata',
      audiobookMetadata
    );

    return {
      manuscriptKey,
      audiobookMetadata,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate audiobook metadata using Claude
   */
  async generateAudiobookMetadata(excerpt, analysis, structure, bookDescription, categories, keywords, genre, userId, manuscriptId) {
    const totalWords = structure?.totalWords || 0;
    const estimatedListeningHours = Math.round((totalWords / 9300) * 10) / 10; // Industry standard

    const existingDescription = bookDescription?.medium || bookDescription?.short || '';
    const existingCategories = categories?.primary?.map(c => c.name || c).join(', ') || '';
    const existingKeywords = keywords?.primary?.join(', ') || '';

    const prompt = `You are an expert audiobook publisher with deep knowledge of ACX (Audiobook Creation Exchange), Audible, iTunes, and audiobook distribution platforms.

MANUSCRIPT CONTEXT:
Genre: ${genre}
Word Count: ${totalWords.toLocaleString()}
Estimated Listening Time: ${estimatedListeningHours} hours
Content Rating: ${analysis.contentWarnings?.rating || 'Not rated'}

EXISTING METADATA:
Book Description: ${existingDescription.substring(0, 500)}
Categories: ${existingCategories}
Keywords: ${existingKeywords}

CONTENT WARNINGS:
${JSON.stringify(analysis.contentWarnings?.warnings || [])}

MANUSCRIPT EXCERPT:
${excerpt}

TASK: Generate comprehensive audiobook-specific metadata for ACX/Audible submission and distribution across audiobook platforms.

ACX/AUDIBLE REQUIREMENTS:

1. **TITLE AND SUBTITLE**
   - Audiobook title (may differ slightly from print for audio discoverability)
   - Subtitle (if applicable, optimized for audio search)
   - Series information (if part of series)

2. **PUBLISHER SUMMARY (4000 char max)**
   - Compelling description optimized for audiobook listeners
   - Emphasize listening experience ("hear the story unfold")
   - Include narrator performance appeal (if known)
   - SEO-optimized for audiobook discovery
   - Note: Different from ebook description - audio-focused

3. **CATEGORIES (2 required on ACX)**
   - BISAC categories for audiobooks
   - Audible-specific categories
   - iTunes audiobook categories
   - Rationale for each selection

4. **CONTENT RATING**
   - Clean/Not Rated/Adult (explicit)
   - Rationale based on content
   - Advisory warnings if applicable

5. **LANGUAGE AND ACCENT**
   - Primary language
   - Accent/dialect if relevant to story
   - Narration language specifications

6. **KEYWORDS AND TAGS**
   - 7 audiobook-specific keywords
   - Search terms audio listeners use
   - Genre-specific audio tags

7. **AUTHOR INFORMATION**
   - Author name
   - Author bio (150-200 words, audio-focused)
   - Pronunciation of author name
   - Previous audiobooks (if known)

8. **NARRATOR INFORMATION (template)**
   - Narrator name (TBD/placeholder)
   - Narrator bio template
   - Sample pronunciation guide for narrator name
   - Gender/accent preferences

9. **AUDIOBOOK-SPECIFIC METADATA**
   - Estimated runtime (hours:minutes)
   - Narration type (single/multiple narrators/full cast)
   - Copyright year
   - Publication date
   - Edition (unabridged)
   - ISBN (audiobook-specific, if available)

10. **DISTRIBUTION METADATA**
    - Price tier suggestion (based on length)
    - Territory rights (worldwide/specific)
    - Exclusive vs. non-exclusive recommendation
    - Platform-specific optimization notes

11. **PROMOTIONAL METADATA**
    - Audiobook blurb (50 words - ultra-short pitch)
    - Listener hook phrases
    - Comp titles (audiobook versions)
    - "If you liked [audiobook], you'll love this" positioning
    - Award potential categories

12. **TECHNICAL SPECIFICATIONS**
    - File format: MP3, ACX compliant
    - Audio quality: 192 kbps or higher
    - Chapter count estimate
    - Opening/closing credits requirements
    - Retail audio sample specifications

Provide your response ONLY as valid JSON (no other text before or after).

Return this exact structure:
{
  "titleMetadata": {
    "audiobookTitle": "title optimized for audio",
    "subtitle": "subtitle if applicable",
    "seriesName": "series name or null",
    "seriesNumber": number or null,
    "editionType": "Unabridged"
  },
  "publisherSummary": "4000 char max audiobook-optimized description emphasizing listening experience",
  "categories": {
    "bisac": [
      {
        "code": "FIC000000",
        "name": "FICTION / General",
        "rationale": "why selected"
      }
    ],
    "audible": [
      {
        "path": "Fiction > Science Fiction",
        "rationale": "why selected"
      }
    ],
    "itunes": ["category 1", "category 2"]
  },
  "contentRating": {
    "rating": "Clean|Not Rated|Adult",
    "rationale": "based on content analysis",
    "advisoryWarnings": ["warning 1 if applicable"],
    "ageRecommendation": "13+|16+|18+"
  },
  "languageMetadata": {
    "primaryLanguage": "English|Spanish|etc",
    "languageCode": "en-US",
    "accent": "American|British|Australian|Neutral|Character-appropriate",
    "dialectNotes": "any dialect considerations"
  },
  "keywords": {
    "audioSpecific": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7"],
    "searchTerms": ["listener search phrase 1", "listener search phrase 2"],
    "genreTags": ["tag 1", "tag 2"]
  },
  "authorInfo": {
    "authorName": "Author Name (from manuscript or TBD)",
    "authorBio": "150-200 word audio-focused bio",
    "authorPronunciation": "phonetic pronunciation",
    "previousAudiobooks": ["title 1 if known"] or "None/TBD"
  },
  "narratorInfo": {
    "narratorName": "TBD - will be assigned after production",
    "narratorBioTemplate": "template bio for when narrator is selected",
    "narratorPronunciationGuide": "template",
    "desiredNarratorProfile": {
      "gender": "male|female|any",
      "accentPreference": "description",
      "voiceCharacteristics": "description",
      "experienceLevel": "veteran|professional|any"
    }
  },
  "audiobookSpecs": {
    "estimatedRuntime": "X:XX:XX format",
    "estimatedRuntimeMinutes": number,
    "narrationType": "Single Narrator|Multiple Narrators|Full Cast",
    "copyrightYear": number,
    "publicationDate": "suggested date or TBD",
    "edition": "Unabridged",
    "isbn": "audiobook ISBN if available or TBD",
    "hasSubtitles": false,
    "hasCompanionPDF": false
  },
  "distributionMetadata": {
    "priceTierSuggestion": {
      "tier": "based on runtime",
      "rationale": "ACX pricing guidelines",
      "estimatedRetailPrice": "$X.XX-XX.XX"
    },
    "territoryRights": "Worldwide|US-only|etc",
    "exclusivityRecommendation": "Exclusive (higher royalty) vs Non-Exclusive (wider distribution)",
    "platformOptimizations": {
      "acx": "specific ACX notes",
      "audible": "specific Audible notes",
      "itunes": "specific iTunes notes",
      "other": "Google Play Books, etc."
    }
  },
  "promotionalMetadata": {
    "audiobookBlurb": "50 word ultra-short pitch for audio listeners",
    "listenerHooks": ["hook phrase 1", "hook phrase 2", "hook phrase 3"],
    "compAudiobooks": [
      {
        "title": "Comparable Audiobook Title",
        "author": "Author",
        "narrator": "Narrator",
        "similarity": "why comparable"
      }
    ],
    "positioningStatement": "If you liked [audiobook], you'll love this because...",
    "awardCategories": ["Audie Award category" or "N/A"]
  },
  "technicalSpecs": {
    "fileFormat": "MP3",
    "audioQuality": "192 kbps or higher, ACX compliant",
    "sampleRate": "44.1 kHz",
    "bitDepth": "16-bit",
    "estimatedChapterCount": number,
    "openingCreditsFormat": "template",
    "closingCreditsFormat": "template",
    "retailSampleRequirements": "First 5 minutes, ACX specifications",
    "acxCompliance": ["requirement 1", "requirement 2"]
  },
  "submissionChecklist": [
    "Item 1 to verify before ACX submission",
    "Item 2",
    "Item 3"
  ]
}`;

    const audiobookMetadata = await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.BALANCED,
      'AudiobookMetadataAgent',
      this.env,
      userId,
      manuscriptId,
      'audiobook_generation',
      'generate_audiobook_metadata'
    );

    // Validate structure
    validateRequiredFields(audiobookMetadata, ['titleMetadata', 'publisherSummary', 'categories', 'audiobookSpecs'], 'Audiobook Metadata');

    console.log('Audiobook metadata generated successfully');
    return audiobookMetadata;
  }
}
