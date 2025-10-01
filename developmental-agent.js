// Developmental Editing Agent
// Analyzes manuscript structure, plot, pacing, and character development

export class DevelopmentalAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Main analysis entry point
   * @param {string} manuscriptKey - R2 key for the manuscript
   * @param {string} genre - Book genre (romance, thriller, fantasy, etc.)
   * @returns {Object} Complete developmental analysis
   */
  async analyze(manuscriptKey, genre) {
    console.log(`Starting developmental analysis for ${manuscriptKey}`);
    
    // 1. Retrieve manuscript from R2
    const manuscript = await this.env.MANUSCRIPTS_RAW.get(manuscriptKey);
    if (!manuscript) {
      throw new Error('Manuscript not found');
    }

    // 2. Extract text content based on file type
    const textContent = await this.extractText(manuscript);
    
    // 3. Break into analyzable chunks (chapters, scenes)
    const structure = await this.analyzeStructure(textContent);
    
    // 4. Run comprehensive developmental analysis
    const analysis = await this.runDevelopmentalAnalysis(textContent, structure, genre);
    
    // 5. Generate embeddings for comp title matching
    const embeddings = await this.generateEmbeddings(textContent, analysis);
    
    // 6. Find successful comp titles
    const compTitles = await this.findCompTitles(embeddings, genre);
    
    // 7. Generate actionable recommendations
    const recommendations = await this.generateRecommendations(analysis, compTitles);
    
    // 8. Store results
    await this.storeAnalysis(manuscriptKey, {
      structure,
      analysis,
      compTitles,
      recommendations,
      embeddings
    });
    
    return {
      manuscriptKey,
      structure,
      analysis,
      compTitles,
      recommendations,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract text from various file formats
   */
  async extractText(manuscript) {
    const contentType = manuscript.httpMetadata?.contentType;
    const buffer = await manuscript.arrayBuffer();
    
    switch(contentType) {
      case 'text/plain':
        return new TextDecoder().decode(buffer);
      
      case 'application/pdf':
        // In production, use a PDF parser library
        // For now, return placeholder
        return this.extractFromPDF(buffer);
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // In production, use mammoth or similar
        return this.extractFromDOCX(buffer);
      
      default:
        throw new Error(`Unsupported file type: ${contentType}`);
    }
  }

  /**
   * Extract text from PDF (placeholder - use pdf-parse or similar in production)
   */
  async extractFromPDF(buffer) {
    // TODO: Implement PDF text extraction
    // For now, return a note that this needs implementation
    return "PDF extraction not yet implemented. Use .txt or .docx for now.";
  }

  /**
   * Extract text from DOCX (placeholder - use mammoth in production)
   */
  async extractFromDOCX(buffer) {
    // TODO: Implement DOCX text extraction with mammoth
    return "DOCX extraction not yet implemented. Use .txt for now.";
  }

  /**
   * Analyze manuscript structure (chapters, scenes, acts)
   */
  async analyzeStructure(text) {
    // Simple chapter detection based on common patterns
    const chapterPattern = /(?:^|\n)(?:Chapter|CHAPTER)\s+(?:\d+|[IVXLCDM]+)(?:\s*[\:\-\.]?\s*)([^\n]*)/gi;
    const matches = [...text.matchAll(chapterPattern)];
    
    const chapters = matches.map((match, index) => ({
      number: index + 1,
      title: match[1]?.trim() || `Chapter ${index + 1}`,
      position: match.index,
      wordCount: 0 // Will calculate below
    }));

    // Calculate word counts for each chapter
    for (let i = 0; i < chapters.length; i++) {
      const start = chapters[i].position;
      const end = chapters[i + 1]?.position || text.length;
      const chapterText = text.substring(start, end);
      chapters[i].wordCount = chapterText.split(/\s+/).length;
      chapters[i].excerpt = chapterText.substring(0, 500); // First 500 chars for preview
    }

    // Calculate overall stats
    const totalWords = text.split(/\s+/).length;
    const avgChapterLength = chapters.length > 0 
      ? totalWords / chapters.length 
      : 0;

    return {
      totalWords,
      chapterCount: chapters.length,
      avgChapterLength: Math.round(avgChapterLength),
      chapters,
      hasStructuredChapters: chapters.length > 0
    };
  }

  /**
   * Run comprehensive developmental analysis using Claude
   */
  async runDevelopmentalAnalysis(text, structure, genre) {
    // Prepare the manuscript for analysis (truncate if too long)
    const maxTokens = 100000; // Approximate token limit
    const truncatedText = this.truncateForAnalysis(text, maxTokens);
    
    const prompt = `You are an expert developmental editor specializing in ${genre} fiction. Analyze this manuscript and provide detailed feedback on:

1. **Story Structure & Pacing**
   - Does the story follow a clear three-act structure?
   - Is the pacing appropriate for the genre?
   - Are there any sagging middle sections?
   - Does the climax land effectively?

2. **Character Development**
   - Are the main characters well-developed with clear motivations?
   - Do characters show meaningful growth/arc?
   - Are supporting characters distinct and purposeful?
   - Is dialogue authentic and character-specific?

3. **Plot & Conflict**
   - Is the central conflict clear and compelling?
   - Are plot threads resolved satisfactorily?
   - Are there any plot holes or inconsistencies?
   - Do subplots enhance the main story?

4. **Voice & Style**
   - Is the narrative voice consistent and engaging?
   - Does the writing style suit the genre and audience?
   - Are there areas where prose could be tightened?

5. **Genre Expectations**
   - Does this meet reader expectations for ${genre}?
   - Are genre conventions properly utilized?
   - What tropes are working well vs. feeling tired?

Manuscript Statistics:
- Total Words: ${structure.totalWords}
- Chapters: ${structure.chapterCount}
- Average Chapter Length: ${structure.avgChapterLength} words

Manuscript Text:
${truncatedText}

Provide your analysis in JSON format with the following structure:
{
  "overallScore": 1-10,
  "structure": { "score": 1-10, "strengths": [], "weaknesses": [], "recommendations": [] },
  "characters": { "score": 1-10, "strengths": [], "weaknesses": [], "recommendations": [] },
  "plot": { "score": 1-10, "strengths": [], "weaknesses": [], "recommendations": [] },
  "voice": { "score": 1-10, "strengths": [], "weaknesses": [], "recommendations": [] },
  "genreFit": { "score": 1-10, "strengths": [], "weaknesses": [], "recommendations": [] },
  "topPriorities": ["Most important fix 1", "Most important fix 2", "Most important fix 3"],
  "marketability": { "score": 1-10, "summary": "Brief assessment of commercial potential" }
}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const analysisText = data.content[0].text;
      
      // Parse JSON response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback if JSON parsing fails
      return {
        overallScore: 7,
        rawAnalysis: analysisText,
        parseError: true
      };
      
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error(`Failed to analyze manuscript: ${error.message}`);
    }
  }

  /**
   * Truncate text intelligently for analysis
   */
  truncateForAnalysis(text, maxChars) {
    if (text.length <= maxChars) {
      return text;
    }

    // Take first 40%, middle 20%, and last 40% for balanced analysis
    const firstChunk = Math.floor(maxChars * 0.4);
    const middleChunk = Math.floor(maxChars * 0.2);
    const lastChunk = Math.floor(maxChars * 0.4);
    
    const middle = Math.floor(text.length / 2);
    
    return text.substring(0, firstChunk) +
           '\n\n[... middle section omitted for analysis ...]\n\n' +
           text.substring(middle - middleChunk/2, middle + middleChunk/2) +
           '\n\n[... content omitted ...]\n\n' +
           text.substring(text.length - lastChunk);
  }

  /**
   * Generate embeddings for vector similarity search
   */
  async generateEmbeddings(text, analysis) {
    // Create a rich embedding prompt that captures the essence
    const embeddingPrompt = `
      Genre: ${analysis.genreFit?.score || 'unknown'}
      Tone: ${analysis.voice?.score || 'unknown'}
      Pacing: ${analysis.structure?.score || 'unknown'}
      Character Depth: ${analysis.characters?.score || 'unknown'}
      Plot Complexity: ${analysis.plot?.score || 'unknown'}
      
      Key Themes: ${analysis.topPriorities?.join(', ') || 'none'}
      
      Sample Text: ${text.substring(0, 1000)}
    `;

    // In production, use a dedicated embedding model
    // For now, we'll use a simple placeholder
    // You'd typically use OpenAI's embeddings or similar
    
    return {
      vector: new Array(1536).fill(0).map(() => Math.random()), // Placeholder
      metadata: {
        genre: analysis.genreFit,
        overallScore: analysis.overallScore
      }
    };
  }

  /**
   * Find comparable titles using Vectorize
   */
  async findCompTitles(embeddings, genre) {
    // TODO: Implement Vectorize integration
    // For now, return placeholder comp titles
    
    return [
      {
        title: "Example Bestseller 1",
        author: "Famous Author",
        similarity: 0.85,
        salesRank: 245,
        relevantFeatures: ["Strong character arcs", "Fast pacing"]
      },
      {
        title: "Example Bestseller 2", 
        author: "Another Author",
        similarity: 0.78,
        salesRank: 892,
        relevantFeatures: ["Similar themes", "Genre conventions"]
      }
    ];
  }

  /**
   * Generate actionable recommendations
   */
  async generateRecommendations(analysis, compTitles) {
    const recommendations = [];

    // Priority 1: Critical structural issues
    if (analysis.structure?.score < 6) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Structure',
        issue: 'Story structure needs strengthening',
        action: analysis.structure.recommendations?.[0] || 'Review three-act structure',
        impact: 'Critical for reader engagement'
      });
    }

    // Priority 2: Character development
    if (analysis.characters?.score < 7) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Characters',
        issue: 'Character development could be deeper',
        action: analysis.characters.recommendations?.[0] || 'Add more character motivation and backstory',
        impact: 'Essential for emotional connection'
      });
    }

    // Priority 3: Genre fit
    if (analysis.genreFit?.score < 7) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Genre',
        issue: 'Genre expectations not fully met',
        action: `Study successful ${compTitles[0]?.title || 'comp titles'} for genre conventions`,
        impact: 'Important for marketability'
      });
    }

    // Add comp title insights
    if (compTitles.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Market Positioning',
        issue: 'Learn from successful comp titles',
        action: `Analyze what makes ${compTitles[0].title} successful: ${compTitles[0].relevantFeatures.join(', ')}`,
        impact: 'Improves commercial potential'
      });
    }

    return recommendations;
  }

  /**
   * Store analysis results in D1 and processed bucket
   */
  async storeAnalysis(manuscriptKey, results) {
    // Store comprehensive results in MANUSCRIPTS_PROCESSED
    const processedKey = manuscriptKey.replace('MANUSCRIPTS_RAW', 'PROCESSED');
    
    await this.env.MANUSCRIPTS_PROCESSED.put(
      `${processedKey}-analysis.json`,
      JSON.stringify(results, null, 2),
      {
        customMetadata: {
          analysisType: 'developmental',
          timestamp: new Date().toISOString(),
          manuscriptKey: manuscriptKey
        },
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );

    // TODO: Store in D1 for querying
    // await this.env.DB.prepare(
    //   'INSERT INTO manuscript_analyses (manuscript_key, analysis_type, results, created_at) VALUES (?, ?, ?, ?)'
    // ).bind(manuscriptKey, 'developmental', JSON.stringify(results), new Date().toISOString()).run();

    // TODO: Store embeddings in Vectorize
    // await this.env.VECTORIZE.insert(results.embeddings);
  }
}
