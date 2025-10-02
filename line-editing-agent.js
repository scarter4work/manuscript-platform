// Line Editing Agent
// Focuses on prose quality, sentence-level improvements, and style

export class LineEditingAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Main analysis entry point
   * @param {string} manuscriptKey - R2 key for the manuscript
   * @param {string} genre - Book genre for style expectations
   * @returns {Object} Complete line editing analysis with specific suggestions
   */
  async analyze(manuscriptKey, genre) {
    console.log(`Starting line editing analysis for ${manuscriptKey}`);
    
    // 1. Retrieve manuscript from R2
    const manuscript = await this.env.MANUSCRIPTS_RAW.get(manuscriptKey);
    if (!manuscript) {
      throw new Error('Manuscript not found');
    }

    // 2. Extract text content
    const textContent = await this.extractText(manuscript);
    
    // 3. Break into sections for detailed analysis
    const sections = this.chunkIntoSections(textContent);
    
    // 4. Analyze each section
    const sectionAnalyses = [];
    for (let i = 0; i < sections.length; i++) {
      console.log(`Analyzing section ${i + 1}/${sections.length}...`);
      const analysis = await this.analyzeSection(sections[i], i, genre);
      sectionAnalyses.push(analysis);
      
      // Rate limit: pause between sections to avoid API throttling
      if (i < sections.length - 1) {
        await this.sleep(1000); // 1 second between sections
      }
    }
    
    // 5. Aggregate patterns across all sections
    const patterns = this.aggregatePatterns(sectionAnalyses);
    
    // 6. Generate overall prose assessment
    const overallAssessment = this.generateOverallAssessment(patterns, sectionAnalyses);
    
    // 7. Prioritize suggestions
    const prioritizedSuggestions = this.prioritizeSuggestions(sectionAnalyses);
    
    // 8. Store results
    await this.storeAnalysis(manuscriptKey, {
      overallAssessment,
      patterns,
      sections: sectionAnalyses,
      topSuggestions: prioritizedSuggestions.slice(0, 20), // Top 20
      timestamp: new Date().toISOString()
    });
    
    return {
      manuscriptKey,
      overallAssessment,
      patterns,
      sections: sectionAnalyses,
      topSuggestions: prioritizedSuggestions.slice(0, 20)
    };
  }

  /**
   * Extract text from manuscript (same as developmental agent)
   */
  async extractText(manuscript) {
    const contentType = manuscript.httpMetadata?.contentType;
    const buffer = await manuscript.arrayBuffer();
    
    switch(contentType) {
      case 'text/plain':
        return new TextDecoder().decode(buffer);
      
      case 'application/pdf':
        return this.extractFromPDF(buffer);
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.extractFromDOCX(buffer);
      
      default:
        throw new Error(`Unsupported file type: ${contentType}`);
    }
  }

  async extractFromPDF(buffer) {
    return "PDF extraction not yet implemented. Use .txt for now.";
  }

  async extractFromDOCX(buffer) {
    return "DOCX extraction not yet implemented. Use .txt for now.";
  }

  /**
   * Break manuscript into manageable sections for analysis
   * Target: ~800 words per section for detailed feedback
   */
  chunkIntoSections(text) {
    const wordsPerSection = 800;
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
   * Analyze a single section for line-level issues
   */
  async analyzeSection(section, index, genre) {
    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    const prompt = `You are an expert line editor specializing in ${genre} fiction. Analyze this section of manuscript for prose-level issues and provide specific, actionable suggestions.

Focus on:

1. **Prose Quality**
   - Weak or overused words (very, really, just, etc.)
   - Passive voice that should be active
   - Redundancies and unnecessary words
   - Adverb overuse (especially -ly words)

2. **Sentence Structure**
   - Sentence variety (mix of short, medium, long)
   - Run-on sentences or fragments
   - Monotonous rhythm

3. **Show vs Tell**
   - Instances where the author tells instead of shows
   - Opportunities for more vivid, sensory details
   - Weak dialogue attribution

4. **Word Choice**
   - Generic verbs that could be stronger (went → strode, walked → shuffled)
   - Clichés or overused phrases
   - Anachronisms or inappropriate vocabulary for the setting

5. **Style Issues**
   - POV slips or inconsistencies
   - Tense shifts
   - Tone inconsistencies

Section Text:
${section.text}

Provide your analysis ONLY as valid JSON (no other text before or after). 

IMPORTANT JSON RULES:
- Use double quotes for all strings
- Escape any internal quotes with backslash: \" 
- No trailing commas
- No comments in the JSON
- Keep all text values on single lines (no line breaks inside strings)

Return this exact structure:
{
  "overallScore": 1-10,
  "issues": [
    {
      "type": "passive_voice|weak_verb|redundancy|adverb|show_not_tell|sentence_variety|cliche|other",
      "severity": "high|medium|low",
      "location": "approximate word position or first few words",
      "original": "the exact text with the issue",
      "suggestion": "specific rewrite suggestion",
      "explanation": "brief reason why this is an issue"
    }
  ],
  "strengths": ["things that are working well in this section"],
  "readabilityMetrics": {
    "averageSentenceLength": number,
    "passiveVoiceCount": number,
    "adverbCount": number,
    "sentenceVariety": "good|needs_work|poor"
  }
}

Be specific with locations and examples. Provide actual rewrites, not just descriptions of what's wrong.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: 0.3  // Lower temperature for more consistent JSON
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Claude API error details:', errorBody);
        throw new Error(`Claude API error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();
      const analysisText = data.content[0].text;
      
      // Parse JSON response - be more robust with multiple cleanup strategies
      let analysis;
      try {
        // Try to find JSON in the response
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        
        let jsonStr = jsonMatch[0];
        
        // Multiple cleanup strategies
        // 1. Remove trailing commas before closing braces/brackets
        jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
        
        // 2. Fix unescaped quotes in strings (common issue)
        // This is tricky - we'll try to detect strings with internal quotes
        // and escape them properly
        
        // 3. Remove any control characters that might break JSON
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, '');
        
        // 4. Try parsing
        try {
          analysis = JSON.parse(jsonStr);
        } catch (firstError) {
          // If that fails, try more aggressive cleanup
          console.log('First parse failed, trying aggressive cleanup...');
          
          // Try to fix common issues with quotes in values
          // Replace any single quotes with double quotes (if used incorrectly)
          jsonStr = jsonStr.replace(/([{,]\s*["']?\w+["']?\s*:\s*)'([^']*?)'/g, '$1"$2"');
          
          analysis = JSON.parse(jsonStr);
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError.message);
        console.error('Attempted to parse:', analysisText.substring(0, 500) + '...');
        
        // Return a fallback structure so we don't completely fail
        return {
          sectionNumber: section.sectionNumber,
          wordRange: `${section.startWord}-${section.endWord}`,
          overallScore: 7,
          parseError: true,
          errorMessage: parseError.message,
          rawResponse: analysisText.substring(0, 1000),
          issues: [],
          strengths: ['Parse error - manual review needed'],
          readabilityMetrics: {}
        };
      }
      
      return {
        sectionNumber: section.sectionNumber,
        wordRange: `${section.startWord}-${section.endWord}`,
        ...analysis
      };
      
      // Fallback if JSON parsing fails
      return {
        sectionNumber: section.sectionNumber,
        wordRange: `${section.startWord}-${section.endWord}`,
        overallScore: 7,
        rawAnalysis: analysisText,
        parseError: true,
        issues: [],
        strengths: [],
        readabilityMetrics: {}
      };
      
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error(`Failed to analyze section: ${error.message}`);
    }
  }

  /**
   * Aggregate patterns across all sections
   */
  aggregatePatterns(sectionAnalyses) {
    const patterns = {
      totalSections: sectionAnalyses.length,
      averageScore: 0,
      issueTypeCounts: {},
      totalIssues: 0,
      passiveVoiceTotal: 0,
      adverbTotal: 0,
      averageSentenceLengthOverall: 0,
      sentenceVarietyDistribution: {
        good: 0,
        needs_work: 0,
        poor: 0
      }
    };

    let scoreSum = 0;
    let sentenceLengthSum = 0;
    let sectionsWithMetrics = 0;

    sectionAnalyses.forEach(section => {
      // Aggregate scores
      scoreSum += section.overallScore || 0;

      // Count issue types
      if (section.issues) {
        section.issues.forEach(issue => {
          patterns.issueTypeCounts[issue.type] = 
            (patterns.issueTypeCounts[issue.type] || 0) + 1;
          patterns.totalIssues++;
        });
      }

      // Aggregate readability metrics
      if (section.readabilityMetrics) {
        const metrics = section.readabilityMetrics;
        patterns.passiveVoiceTotal += metrics.passiveVoiceCount || 0;
        patterns.adverbTotal += metrics.adverbCount || 0;
        
        if (metrics.averageSentenceLength) {
          sentenceLengthSum += metrics.averageSentenceLength;
          sectionsWithMetrics++;
        }

        if (metrics.sentenceVariety) {
          patterns.sentenceVarietyDistribution[metrics.sentenceVariety]++;
        }
      }
    });

    patterns.averageScore = (scoreSum / sectionAnalyses.length).toFixed(1);
    patterns.averageSentenceLengthOverall = sectionsWithMetrics > 0
      ? (sentenceLengthSum / sectionsWithMetrics).toFixed(1)
      : 0;

    return patterns;
  }

  /**
   * Generate overall prose assessment
   */
  generateOverallAssessment(patterns, sections) {
    const assessment = {
      overallProseScore: parseFloat(patterns.averageScore),
      summary: '',
      keyStrengths: [],
      keyWeaknesses: [],
      urgentIssues: []
    };

    // Identify top issue types
    const sortedIssues = Object.entries(patterns.issueTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Generate summary
    if (assessment.overallProseScore >= 8) {
      assessment.summary = 'Strong prose with minimal issues. Focus on fine-tuning.';
    } else if (assessment.overallProseScore >= 6) {
      assessment.summary = 'Solid foundation with room for improvement in several areas.';
    } else {
      assessment.summary = 'Prose needs significant revision to meet publishing standards.';
    }

    // Key weaknesses
    sortedIssues.forEach(([type, count]) => {
      assessment.keyWeaknesses.push(`${type.replace(/_/g, ' ')}: ${count} instances`);
    });

    // Collect strengths from sections
    const allStrengths = sections
      .flatMap(s => s.strengths || [])
      .slice(0, 5);
    assessment.keyStrengths = [...new Set(allStrengths)];

    // Urgent issues (high severity across multiple sections)
    const highSeverityIssues = sections
      .flatMap(s => s.issues || [])
      .filter(i => i.severity === 'high');
    
    if (highSeverityIssues.length > 10) {
      assessment.urgentIssues.push(`${highSeverityIssues.length} high-severity prose issues need immediate attention`);
    }

    if (patterns.passiveVoiceTotal > 50) {
      assessment.urgentIssues.push(`Excessive passive voice (${patterns.passiveVoiceTotal} instances)`);
    }

    if (patterns.adverbTotal > 100) {
      assessment.urgentIssues.push(`Adverb overuse (${patterns.adverbTotal} instances)`);
    }

    return assessment;
  }

  /**
   * Prioritize all suggestions across sections
   */
  prioritizeSuggestions(sections) {
    const allIssues = sections.flatMap(section => 
      (section.issues || []).map(issue => ({
        ...issue,
        sectionNumber: section.sectionNumber,
        wordRange: section.wordRange
      }))
    );

    // Sort by severity (high -> medium -> low) and type
    const severityOrder = { high: 0, medium: 1, low: 2 };
    
    return allIssues.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      // Within same severity, prioritize certain types
      const typePriority = {
        show_not_tell: 0,
        passive_voice: 1,
        weak_verb: 2,
        redundancy: 3,
        adverb: 4,
        sentence_variety: 5,
        cliche: 6,
        other: 7
      };
      
      return (typePriority[a.type] || 10) - (typePriority[b.type] || 10);
    });
  }

  /**
   * Store analysis results
   */
  async storeAnalysis(manuscriptKey, results) {
    const processedKey = manuscriptKey.replace('MANUSCRIPTS_RAW', 'PROCESSED');
    
    await this.env.MANUSCRIPTS_PROCESSED.put(
      `${processedKey}-line-analysis.json`,
      JSON.stringify(results, null, 2),
      {
        customMetadata: {
          analysisType: 'line-editing',
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
