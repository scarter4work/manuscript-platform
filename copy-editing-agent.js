// Copy Editing Agent
// Focuses on grammar, punctuation, consistency, and technical correctness

import { extractText } from './text-extraction.js';
import { callClaudeWithCostTracking, AGENT_CONFIG } from './agent-utils.js';

export class CopyEditingAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Main analysis entry point
   * @param {string} manuscriptKey - R2 key for the manuscript
   * @param {string} styleGuide - 'chicago' (default), 'ap', or 'custom'
   * @param {string} userId - User ID (optional, for cost tracking)
   * @param {string} manuscriptId - Manuscript ID (optional, for cost tracking)
   * @returns {Object} Complete copy editing analysis
   */
  async analyze(manuscriptKey, styleGuide = 'chicago', userId = null, manuscriptId = null) {
    // Store for cost tracking
    this.userId = userId;
    this.manuscriptId = manuscriptId;

    console.log(`Starting copy editing analysis for ${manuscriptKey}`);
    
    // 1. Retrieve manuscript from R2
    const manuscript = await this.env.MANUSCRIPTS_RAW.get(manuscriptKey);
    if (!manuscript) {
      throw new Error('Manuscript not found');
    }

    // 2. Extract text content
    const textContent = await this.extractText(manuscript);
    
    // 3. Extract entities for consistency tracking
    const entities = this.extractEntities(textContent);
    
    // 4. Break into sections for detailed analysis
    const sections = this.chunkIntoSections(textContent);
    
    // 5. Analyze each section
    const sectionAnalyses = [];
    for (let i = 0; i < sections.length; i++) {
      console.log(`Copy editing section ${i + 1}/${sections.length}...`);
      const analysis = await this.analyzeSection(sections[i], i, styleGuide);
      sectionAnalyses.push(analysis);
      
      // Rate limit: pause between sections
      if (i < sections.length - 1) {
        await this.sleep(1000);
      }
    }
    
    // 6. Check consistency across entire manuscript
    const consistencyIssues = await this.checkConsistency(entities, textContent, styleGuide);
    
    // 7. Aggregate all issues
    const aggregatedIssues = this.aggregateIssues(sectionAnalyses, consistencyIssues);
    
    // 8. Generate overall assessment
    const overallAssessment = this.generateOverallAssessment(aggregatedIssues);
    
    // 9. Store results
    await this.storeAnalysis(manuscriptKey, {
      overallAssessment,
      errorsByType: aggregatedIssues.errorsByType,
      consistencyIssues,
      sections: sectionAnalyses,
      topIssues: aggregatedIssues.prioritized.slice(0, 30),
      timestamp: new Date().toISOString()
    });
    
    return {
      manuscriptKey,
      overallAssessment,
      errorsByType: aggregatedIssues.errorsByType,
      consistencyIssues,
      sections: sectionAnalyses,
      topIssues: aggregatedIssues.prioritized.slice(0, 30)
    };
  }

  /**
   * Extract text from manuscript using shared utility
   */
  async extractText(manuscript) {
    const contentType = manuscript.httpMetadata?.contentType;
    const buffer = await manuscript.arrayBuffer();

    try {
      const text = await extractText(buffer, contentType);
      console.log(`[Copy Editing Agent] Extracted ${text.length} characters from ${contentType}`);
      return text;
    } catch (error) {
      console.error(`[Copy Editing Agent] Text extraction failed:`, error);
      throw error;
    }
  }

  /**
   * Extract entities (names, places) for consistency checking
   */
  extractEntities(text) {
    // Simple entity extraction - in production, use NER
    const entities = {
      properNouns: new Set(),
      capitalizedWords: new Map() // word -> count
    };

    // Find capitalized words (potential names/places)
    const words = text.split(/\s+/);
    words.forEach(word => {
      const cleaned = word.replace(/[^a-zA-Z]/g, '');
      if (cleaned && cleaned[0] === cleaned[0].toUpperCase() && cleaned.length > 1) {
        // Skip common sentence starters
        if (!['The', 'A', 'An', 'I', 'It', 'He', 'She', 'They'].includes(cleaned)) {
          entities.properNouns.add(cleaned);
          entities.capitalizedWords.set(
            cleaned, 
            (entities.capitalizedWords.get(cleaned) || 0) + 1
          );
        }
      }
    });

    return entities;
  }

  /**
   * Break manuscript into sections
   */
  chunkIntoSections(text) {
    const wordsPerSection = 1000; // Slightly larger for copy editing
    const words = text.split(/\s+/);
    const sections = [];
    
    for (let i = 0; i < words.length; i += wordsPerSection) {
      const chunk = words.slice(i, i + wordsPerSection).join(' ');
      sections.push({
        sectionNumber: Math.floor(i / wordsPerSection) + 1,
        startWord: i,
        endWord: Math.min(i + wordsPerSection, words.length),
        text: chunk,
        wordCount: Math.min(wordsPerSection, words.length - i)
      });
    }
    
    return sections;
  }

  /**
   * Analyze a single section for copy editing issues
   */
  async analyzeSection(section, index, styleGuide) {
    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    const styleGuideInstructions = this.getStyleGuideInstructions(styleGuide);

    const prompt = `You are an expert copy editor. Review this section for grammar, punctuation, and technical errors. Follow ${styleGuide.toUpperCase()} style guide rules.

${styleGuideInstructions}

Focus on:

1. **Grammar Errors**
   - Subject-verb agreement
   - Pronoun agreement
   - Verb tense consistency
   - Comma splices
   - Sentence fragments
   - Run-on sentences

2. **Punctuation**
   - Missing or incorrect commas
   - Quotation mark placement
   - Apostrophe errors (it's vs its, possessives)
   - Semicolon usage
   - Colon usage
   - Em dash vs en dash

3. **Spelling & Word Choice**
   - Misspellings
   - Commonly confused words (their/there/they're, affect/effect)
   - Incorrect homophones

4. **Capitalization**
   - Proper nouns
   - Titles
   - Sentence beginnings

5. **Numbers & Formatting**
   - Number style (spelled out vs numerals)
   - Time formatting
   - Date formatting

Section Text:
${section.text}

Provide specific errors ONLY as valid JSON (no other text before or after).

IMPORTANT JSON RULES:
- Use double quotes for all strings
- Escape any internal quotes with backslash: \" 
- No trailing commas
- No comments in the JSON
- Keep all text values on single lines (no line breaks inside strings)

Return this exact structure:
{
  "overallScore": 1-10,
  "errorCount": number,
  "errors": [
    {
      "type": "grammar|punctuation|spelling|capitalization|formatting",
      "subtype": "specific error type (e.g., 'subject_verb_agreement')",
      "severity": "high|medium|low",
      "location": "approximate position or first few words",
      "original": "exact text with error",
      "correction": "corrected text",
      "rule": "brief explanation of the rule",
      "confidence": "high|medium|low"
    }
  ],
  "strengths": ["things that are technically correct"]
}

Only flag clear, definite errors. If something is stylistic preference rather than wrong, don't flag it unless it violates the style guide.`;

    // Use shared utility with cost tracking
    const analysis = await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.PRECISE,
      'CopyEditingAgent',
      this.env,
      this.userId,
      this.manuscriptId,
      'analysis',
      'analyze_copy_editing'
    );

    return {
      sectionNumber: section.sectionNumber,
      wordRange: `${section.startWord}-${section.endWord}`,
      ...analysis
    };
  }

  /**
   * Get style guide specific instructions
   */
  getStyleGuideInstructions(styleGuide) {
    const guides = {
      chicago: `Chicago Manual of Style (Fiction):
- Use serial comma (Oxford comma)
- Spell out numbers one through one hundred
- Use em dashes (—) without spaces
- Italicize thoughts
- Use double quotation marks for dialogue
- Punctuation inside quotation marks`,
      
      ap: `AP Style:
- No serial comma (except for clarity)
- Spell out numbers one through nine
- Use en dashes with spaces ( – )
- Use single quotes inside double quotes
- Punctuation placement varies`,
      
      custom: `Standard editorial rules:
- Be consistent within the document
- Follow common grammar rules
- Flag ambiguities`
    };

    return guides[styleGuide] || guides.chicago;
  }

  /**
   * Check consistency across entire manuscript
   */
  async checkConsistency(entities, text, styleGuide) {
    const issues = {
      characterNames: [],
      placeNames: [],
      spellingVariations: [],
      numberStyle: [],
      timeFormat: []
    };

    // Check for potential name variations
    const names = Array.from(entities.properNouns);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const name1 = names[i];
        const name2 = names[j];
        
        // Check if names are similar (potential typo or variation)
        if (this.areSimilar(name1, name2)) {
          const count1 = entities.capitalizedWords.get(name1) || 0;
          const count2 = entities.capitalizedWords.get(name2) || 0;
          
          issues.characterNames.push({
            variations: [name1, name2],
            counts: [count1, count2],
            severity: 'high',
            suggestion: `Possible inconsistency: "${name1}" (${count1}x) vs "${name2}" (${count2}x)`
          });
        }
      }
    }

    // Check number style consistency
    const numberPattern = /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/gi;
    const numbers = text.match(numberPattern) || [];
    const spelledOut = numbers.filter(n => isNaN(n)).length;
    const numerals = numbers.filter(n => !isNaN(n)).length;
    
    if (spelledOut > 10 && numerals > 10) {
      issues.numberStyle.push({
        severity: 'medium',
        spelledOut: spelledOut,
        numerals: numerals,
        suggestion: `Inconsistent number style: ${spelledOut} spelled out vs ${numerals} numerals. ${styleGuide === 'chicago' ? 'Chicago style: spell out one-hundred' : 'AP style: spell out one-nine'}`
      });
    }

    return issues;
  }

  /**
   * Check if two names are similar (potential variations)
   */
  areSimilar(str1, str2) {
    // Simple similarity check - one letter difference or one is substring
    if (Math.abs(str1.length - str2.length) > 2) return false;
    
    // Check if one is substring of other
    if (str1.includes(str2) || str2.includes(str1)) return true;
    
    // Check Levenshtein distance (simplified)
    let diff = 0;
    const minLen = Math.min(str1.length, str2.length);
    for (let i = 0; i < minLen; i++) {
      if (str1[i] !== str2[i]) diff++;
    }
    diff += Math.abs(str1.length - str2.length);
    
    return diff <= 2;
  }

  /**
   * Aggregate all issues from sections
   */
  aggregateIssues(sectionAnalyses, consistencyIssues) {
    const errorsByType = {
      grammar: 0,
      punctuation: 0,
      spelling: 0,
      capitalization: 0,
      formatting: 0,
      consistency: 0
    };

    const allErrors = [];
    
    // Collect errors from sections
    sectionAnalyses.forEach(section => {
      if (section.errors) {
        section.errors.forEach(error => {
          errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
          allErrors.push({
            ...error,
            sectionNumber: section.sectionNumber,
            wordRange: section.wordRange
          });
        });
      }
    });

    // Add consistency issues
    errorsByType.consistency = 
      (consistencyIssues.characterNames?.length || 0) +
      (consistencyIssues.placeNames?.length || 0) +
      (consistencyIssues.numberStyle?.length || 0);

    // Prioritize errors
    const prioritized = allErrors.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      // Within same severity, prioritize grammar > punctuation > spelling
      const typePriority = {
        grammar: 0,
        punctuation: 1,
        spelling: 2,
        capitalization: 3,
        formatting: 4
      };
      
      return (typePriority[a.type] || 10) - (typePriority[b.type] || 10);
    });

    return {
      errorsByType,
      allErrors,
      prioritized,
      totalErrors: allErrors.length
    };
  }

  /**
   * Generate overall assessment
   */
  generateOverallAssessment(aggregatedIssues) {
    const totalErrors = aggregatedIssues.totalErrors;
    const errorsByType = aggregatedIssues.errorsByType;
    
    // Calculate score based on error density
    // Assuming ~50k words manuscript
    // < 50 errors = excellent (9-10)
    // 50-150 errors = good (7-8)
    // 150-300 errors = needs work (5-6)
    // > 300 errors = significant issues (< 5)
    
    let overallScore = 10;
    if (totalErrors > 300) overallScore = 4;
    else if (totalErrors > 150) overallScore = 6;
    else if (totalErrors > 50) overallScore = 7.5;
    else if (totalErrors > 20) overallScore = 9;

    // Generate summary
    let summary = '';
    if (overallScore >= 9) {
      summary = 'Excellent technical quality. Minimal corrections needed.';
    } else if (overallScore >= 7) {
      summary = 'Good technical foundation with moderate corrections needed.';
    } else if (overallScore >= 5) {
      summary = 'Significant technical issues requiring thorough revision.';
    } else {
      summary = 'Extensive technical errors. Professional copy editing strongly recommended.';
    }

    // Identify focus areas
    const focusAreas = Object.entries(errorsByType)
      .filter(([_, count]) => count > 10)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type}: ${count} errors`);

    return {
      overallCopyScore: overallScore,
      totalErrors: totalErrors,
      summary: summary,
      focusAreas: focusAreas,
      readyForPublication: overallScore >= 9 && totalErrors < 20
    };
  }

  /**
   * Store analysis results
   */
  async storeAnalysis(manuscriptKey, results) {
    const processedKey = manuscriptKey.replace('MANUSCRIPTS_RAW', 'PROCESSED');
    
    await this.env.MANUSCRIPTS_PROCESSED.put(
      `${processedKey}-copy-analysis.json`,
      JSON.stringify(results, null, 2),
      {
        customMetadata: {
          analysisType: 'copy-editing',
          timestamp: new Date().toISOString(),
          manuscriptKey: manuscriptKey
        },
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );
  }

  /**
   * Sleep utility for rate limiting
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
