// Annotated Manuscript Generator
// Creates an interactive HTML view with inline comments and highlights

export class AnnotatedManuscriptGenerator {
  /**
   * Generate an annotated manuscript with inline highlights and comments
   */
  static generateAnnotatedManuscript(manuscriptKey, manuscriptText, allIssues, metadata, reportId) {
    // Sort issues by position in manuscript (if available)
    const sortedIssues = this.sortIssuesByPosition(allIssues, manuscriptText);
    
    // Create annotations map
    const annotations = this.createAnnotations(sortedIssues, manuscriptText);
    
    // Generate HTML with highlights
    const annotatedHtml = this.generateHTML(manuscriptText, annotations, metadata, sortedIssues, reportId);
    
    return annotatedHtml;
  }

  /**
   * Sort issues by their position in the manuscript
   */
  static sortIssuesByPosition(allIssues, manuscriptText) {
    const issuesWithPositions = [];
    
    allIssues.forEach(issue => {
      if (!issue.original) return;
      
      // Try to find the exact position in the manuscript
      const position = manuscriptText.indexOf(issue.original);
      
      if (position !== -1) {
        issuesWithPositions.push({
          ...issue,
          position: position,
          endPosition: position + issue.original.length
        });
      }
    });
    
    // Sort by position
    return issuesWithPositions.sort((a, b) => a.position - b.position);
  }

  /**
   * Create annotations map (position -> list of issues)
   */
  static createAnnotations(sortedIssues, manuscriptText) {
    const annotations = new Map();
    
    sortedIssues.forEach((issue, index) => {
      const key = `${issue.position}-${issue.endPosition}`;
      
      if (!annotations.has(key)) {
        annotations.set(key, []);
      }
      
      annotations.get(key).push({
        id: `issue-${index}`,
        type: issue.type || 'general',
        category: issue.category || 'line-editing',
        severity: issue.severity || 'medium',
        original: issue.original,
        suggestion: issue.suggestion || issue.correction,
        explanation: issue.explanation || issue.rule,
        position: issue.position,
        endPosition: issue.endPosition
      });
    });
    
    return annotations;
  }

  /**
   * Generate the full HTML document
   */
  static generateHTML(manuscriptText, annotations, metadata, allIssues, reportId) {
    const reportDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Generate annotated text
    const annotatedText = this.generateAnnotatedText(manuscriptText, annotations);
    
    // Count issues by category
    const issueStats = this.calculateIssueStats(allIssues);
    
    // Dashboard URL (assumes dashboard is at root of same domain or custom domain)
    const dashboardUrl = `https://dashboard.scarter4workmanuscripthub.com/?loadReport=${reportId}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Annotated Manuscript - ${metadata.originalName || 'Untitled'}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            line-height: 1.6;
        }

        .breadcrumb {
            background: white;
            padding: 15px 30px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
        }

        .breadcrumb a {
            color: #667eea;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 5px;
            transition: color 0.2s;
        }

        .breadcrumb a:hover {
            color: #5568d3;
            text-decoration: underline;
        }

        .breadcrumb-separator {
            color: #999;
            user-select: none;
        }

        .breadcrumb-current {
            color: #666;
            font-weight: 500;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header h1 {
            font-size: 24px;
            margin-bottom: 5px;
        }

        .header p {
            opacity: 0.9;
            font-size: 14px;
        }

        .controls {
            background: white;
            padding: 15px 30px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            align-items: center;
            position: sticky;
            top: 88px;
            z-index: 99;
        }

        .filter-btn {
            padding: 8px 16px;
            border: 2px solid #e0e0e0;
            background: white;
            border-radius: 20px;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .filter-btn:hover {
            border-color: #667eea;
        }

        .filter-btn.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
        }

        .filter-count {
            background: rgba(0,0,0,0.1);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: bold;
        }

        .filter-btn.active .filter-count {
            background: rgba(255,255,255,0.3);
        }

        .container {
            display: grid;
            grid-template-columns: 1fr 350px;
            gap: 20px;
            max-width: 1600px;
            margin: 20px auto;
            padding: 0 20px;
        }

        .manuscript-panel {
            background: white;
            padding: 60px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-radius: 8px;
            min-height: 800px;
        }

        .manuscript-text {
            font-family: 'Georgia', 'Times New Roman', serif;
            font-size: 16px;
            line-height: 1.8;
            color: #2c3e50;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .highlight {
            background: #fff3cd;
            border-bottom: 2px solid #ffc107;
            cursor: pointer;
            position: relative;
            padding: 2px 0;
            transition: all 0.2s;
        }

        .highlight:hover {
            background: #ffe699;
        }

        .highlight.grammar {
            background: #ffebee;
            border-bottom-color: #f44336;
        }

        .highlight.punctuation {
            background: #e3f2fd;
            border-bottom-color: #2196f3;
        }

        .highlight.spelling {
            background: #fce4ec;
            border-bottom-color: #e91e63;
        }

        .highlight.style {
            background: #fff3e0;
            border-bottom-color: #ff9800;
        }

        .highlight.passive_voice,
        .highlight.weak_verb,
        .highlight.show_not_tell {
            background: #f3e5f5;
            border-bottom-color: #9c27b0;
        }

        .highlight.selected {
            background: #667eea !important;
            color: white;
        }

        .sidebar {
            position: sticky;
            top: 120px;
            height: fit-content;
            max-height: calc(100vh - 140px);
            overflow-y: auto;
        }

        .comment-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: all 0.2s;
            border-left: 4px solid #ffc107;
        }

        .comment-card.grammar {
            border-left-color: #f44336;
        }

        .comment-card.punctuation {
            border-left-color: #2196f3;
        }

        .comment-card.spelling {
            border-left-color: #e91e63;
        }

        .comment-card.style {
            border-left-color: #ff9800;
        }

        .comment-card.passive_voice,
        .comment-card.weak_verb,
        .comment-card.show_not_tell {
            border-left-color: #9c27b0;
        }

        .comment-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateY(-2px);
        }

        .comment-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .comment-type {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: #666;
            letter-spacing: 0.5px;
        }

        .severity-badge {
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .severity-high {
            background: #ffebee;
            color: #c62828;
        }

        .severity-medium {
            background: #fff3e0;
            color: #ef6c00;
        }

        .severity-low {
            background: #e8f5e9;
            color: #2e7d32;
        }

        .comment-original {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            margin: 10px 0;
            color: #e74c3c;
            text-decoration: line-through;
        }

        .comment-suggestion {
            background: #e8f5e9;
            padding: 10px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            margin: 10px 0;
            color: #2e7d32;
        }

        .comment-explanation {
            font-size: 14px;
            color: #666;
            line-height: 1.5;
            margin-top: 10px;
        }

        .goto-btn {
            display: inline-block;
            margin-top: 10px;
            padding: 6px 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .goto-btn:hover {
            background: #5568d3;
        }

        .stats-summary {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .stats-summary h3 {
            font-size: 16px;
            margin-bottom: 15px;
            color: #2c3e50;
        }

        .stat-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }

        .stat-row:last-child {
            border-bottom: none;
        }

        .stat-label {
            font-size: 13px;
            color: #666;
        }

        .stat-value {
            font-weight: bold;
            color: #2c3e50;
        }

        .no-issues {
            text-align: center;
            padding: 40px;
            color: #999;
        }

        @media (max-width: 1200px) {
            .container {
                grid-template-columns: 1fr;
            }

            .sidebar {
                position: static;
                max-height: none;
            }

            .controls {
                position: static;
            }
        }

        @media print {
            .header, .controls, .sidebar {
                display: none;
            }

            .container {
                grid-template-columns: 1fr;
                margin: 0;
                padding: 0;
            }

            .manuscript-panel {
                box-shadow: none;
            }

            .highlight {
                border-bottom: 1px solid #666;
            }
        }
    </style>
</head>
<body>
    <nav class="breadcrumb">
        <a href="${dashboardUrl}">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0L0 6v10h6V10h4v6h6V6L8 0z"/>
            </svg>
            Dashboard
        </a>
        <span class="breadcrumb-separator">›</span>
        <a href="${dashboardUrl}">Analysis Results</a>
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-current">Annotated Manuscript</span>
    </nav>

    <div class="header">
        <h1>📝 ${metadata.originalName || 'Untitled Manuscript'}</h1>
        <p>Author: ${metadata.authorId || 'Unknown'} • Generated: ${reportDate} • ${issueStats.total} Issues Found</p>
    </div>

    <div class="controls">
        <button class="filter-btn active" onclick="filterIssues('all')" data-filter="all">
            All Issues <span class="filter-count">${issueStats.total}</span>
        </button>
        <button class="filter-btn" onclick="filterIssues('grammar')" data-filter="grammar">
            Grammar <span class="filter-count">${issueStats.grammar}</span>
        </button>
        <button class="filter-btn" onclick="filterIssues('punctuation')" data-filter="punctuation">
            Punctuation <span class="filter-count">${issueStats.punctuation}</span>
        </button>
        <button class="filter-btn" onclick="filterIssues('spelling')" data-filter="spelling">
            Spelling <span class="filter-count">${issueStats.spelling}</span>
        </button>
        <button class="filter-btn" onclick="filterIssues('style')" data-filter="style">
            Style <span class="filter-count">${issueStats.style}</span>
        </button>
        <button class="filter-btn" onclick="filterIssues('passive_voice')" data-filter="passive_voice">
            Passive Voice <span class="filter-count">${issueStats.passive_voice}</span>
        </button>
    </div>

    <div class="container">
        <div class="manuscript-panel">
            <div class="manuscript-text" id="manuscriptText">
${annotatedText}
            </div>
        </div>

        <div class="sidebar">
            <div class="stats-summary">
                <h3>📊 Issue Summary</h3>
                <div class="stat-row">
                    <span class="stat-label">Total Issues</span>
                    <span class="stat-value">${issueStats.total}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">High Priority</span>
                    <span class="stat-value" style="color: #f44336;">${issueStats.high}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Medium Priority</span>
                    <span class="stat-value" style="color: #ff9800;">${issueStats.medium}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Low Priority</span>
                    <span class="stat-value" style="color: #4caf50;">${issueStats.low}</span>
                </div>
            </div>

            <div id="commentsList">
                ${this.generateCommentCards(allIssues)}
            </div>
        </div>
    </div>

    <script>
        let currentFilter = 'all';

        function filterIssues(type) {
            currentFilter = type;
            
            // Update active button
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(\`[data-filter="\${type}"]\`).classList.add('active');

            // Filter highlights
            document.querySelectorAll('.highlight').forEach(hl => {
                if (type === 'all' || hl.classList.contains(type)) {
                    hl.style.display = '';
                } else {
                    hl.style.display = 'none';
                }
            });

            // Filter comment cards
            document.querySelectorAll('.comment-card').forEach(card => {
                if (type === 'all' || card.classList.contains(type)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        function scrollToIssue(issueId) {
            const element = document.getElementById(issueId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Highlight temporarily
                document.querySelectorAll('.highlight').forEach(hl => {
                    hl.classList.remove('selected');
                });
                element.classList.add('selected');
                
                setTimeout(() => {
                    element.classList.remove('selected');
                }, 2000);
            }
        }

        // Click on highlight to scroll to comment
        document.querySelectorAll('.highlight').forEach(hl => {
            hl.addEventListener('click', function() {
                const issueId = this.id;
                const commentCard = document.querySelector(\`[data-issue-id="\${issueId}"]\`);
                if (commentCard) {
                    commentCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    commentCard.style.background = '#f0f7ff';
                    setTimeout(() => {
                        commentCard.style.background = 'white';
                    }, 1000);
                }
            });
        });
    </script>
</body>
</html>`;
  }

  /**
   * Generate annotated text with highlights
   */
  static generateAnnotatedText(manuscriptText, annotations) {
    if (annotations.size === 0) {
      return this.escapeHtml(manuscriptText);
    }

    // Convert annotations to array and sort by position (reverse to insert from end)
    const sortedAnnotations = Array.from(annotations.entries())
      .map(([key, issues]) => ({
        position: issues[0].position,
        endPosition: issues[0].endPosition,
        issues: issues
      }))
      .sort((a, b) => b.position - a.position);

    // First, escape the entire manuscript text
    let result = this.escapeHtml(manuscriptText);

    // Insert highlights from end to beginning (so positions don't shift)
    // We need to work with the escaped version, so recalculate positions
    sortedAnnotations.forEach(annotation => {
      // Find the escaped version of the text to highlight
      const originalText = manuscriptText.substring(annotation.position, annotation.endPosition);
      const escapedText = this.escapeHtml(originalText);
      
      // Find this text in the escaped result (it might be in a different position now)
      const escapedPosition = result.indexOf(escapedText);
      
      if (escapedPosition === -1) {
        console.warn('Could not find text to highlight:', originalText);
        return;
      }
      
      const before = result.substring(0, escapedPosition);
      const after = result.substring(escapedPosition + escapedText.length);

      const issue = annotation.issues[0]; // Use first issue for styling
      const classes = `highlight ${issue.type} ${issue.severity}`;
      
      result = before + 
               `<span class="${classes}" id="${issue.id}">` + 
               escapedText + 
               '</span>' + 
               after;
    });

    return result;
  }

  /**
   * Generate comment cards for sidebar
   */
  static generateCommentCards(allIssues) {
    if (allIssues.length === 0) {
      return '<div class="no-issues">No issues found! 🎉</div>';
    }

    return allIssues.map((issue, index) => `
      <div class="comment-card ${issue.type || 'general'}" data-issue-id="issue-${index}">
        <div class="comment-header">
          <span class="comment-type">${(issue.type || 'issue').replace(/_/g, ' ')}</span>
          <span class="severity-badge severity-${issue.severity || 'medium'}">${issue.severity || 'medium'}</span>
        </div>
        ${issue.original ? `<div class="comment-original">${this.escapeHtml(issue.original)}</div>` : ''}
        ${issue.suggestion ? `<div class="comment-suggestion">✓ ${this.escapeHtml(issue.suggestion)}</div>` : ''}
        ${issue.explanation ? `<div class="comment-explanation">${this.escapeHtml(issue.explanation)}</div>` : ''}
        <button class="goto-btn" onclick="scrollToIssue('issue-${index}')">
          📍 Find in manuscript
        </button>
      </div>
    `).join('');
  }

  /**
   * Calculate issue statistics
   */
  static calculateIssueStats(allIssues) {
    const stats = {
      total: allIssues.length,
      grammar: 0,
      punctuation: 0,
      spelling: 0,
      style: 0,
      passive_voice: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    allIssues.forEach(issue => {
      const type = issue.type || 'other';
      if (stats.hasOwnProperty(type)) {
        stats[type]++;
      }

      const severity = issue.severity || 'medium';
      if (severity === 'high') stats.high++;
      else if (severity === 'medium') stats.medium++;
      else if (severity === 'low') stats.low++;
    });

    return stats;
  }

  /**
   * Escape HTML to prevent XSS
   */
  static escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
