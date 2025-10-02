// Professional Report Generator
// Converts JSON analysis into beautiful, readable reports

export class ReportGenerator {
  /**
   * Generate a complete HTML report combining all three analyses
   */
  static generateFullReport(manuscriptKey, devAnalysis, lineAnalysis, copyAnalysis, metadata, reportId = null) {
    const reportDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manuscript Analysis Report</title>
    <style>
        @media print {
            body { margin: 0; }
            .page-break { page-break-before: always; }
            .no-print { display: none; }
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            line-height: 1.6;
            color: #2c3e50;
            background: #f8f9fa;
            padding: 20px;
        }
        
        .report-container {
            max-width: 8.5in;
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        
        .page {
            padding: 0.75in;
            min-height: 11in;
        }
        
        /* Header */
        .report-header {
            border-bottom: 3px solid #3498db;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        .report-title {
            font-size: 32px;
            color: #2c3e50;
            margin-bottom: 10px;
            font-weight: 300;
            letter-spacing: -0.5px;
        }
        
        .report-subtitle {
            font-size: 18px;
            color: #7f8c8d;
            font-style: italic;
        }
        
        .report-meta {
            display: flex;
            justify-content: space-between;
            margin-top: 15px;
            font-size: 14px;
            color: #95a5a6;
        }
        
        /* Executive Summary */
        .executive-summary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px;
            margin: 30px 0;
        }
        
        .executive-summary h2 {
            font-size: 24px;
            margin-bottom: 15px;
            font-weight: 300;
        }
        
        .summary-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-top: 20px;
        }
        
        .stat-box {
            text-align: center;
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 5px;
        }
        
        .stat-value {
            font-size: 36px;
            font-weight: bold;
            display: block;
        }
        
        .stat-label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            opacity: 0.9;
        }
        
        /* Score Meter */
        .score-meter {
            margin: 20px 0;
        }
        
        .score-bar {
            height: 30px;
            background: #ecf0f1;
            border-radius: 15px;
            overflow: hidden;
            position: relative;
        }
        
        .score-fill {
            height: 100%;
            background: linear-gradient(90deg, #e74c3c 0%, #f39c12 50%, #2ecc71 100%);
            transition: width 0.5s ease;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 10px;
            color: white;
            font-weight: bold;
        }
        
        /* Section Headers */
        h2 {
            font-size: 24px;
            color: #2c3e50;
            margin: 40px 0 20px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #3498db;
        }
        
        h3 {
            font-size: 18px;
            color: #34495e;
            margin: 25px 0 15px 0;
        }
        
        /* Lists */
        .strength-list, .weakness-list, .recommendation-list {
            margin: 15px 0;
        }
        
        .list-item {
            padding: 12px 15px;
            margin: 8px 0;
            border-left: 4px solid #3498db;
            background: #f8f9fa;
            border-radius: 0 4px 4px 0;
        }
        
        .weakness-list .list-item {
            border-left-color: #e74c3c;
            background: #fff5f5;
        }
        
        .strength-list .list-item {
            border-left-color: #2ecc71;
            background: #f0fdf4;
        }
        
        .recommendation-list .list-item {
            border-left-color: #f39c12;
            background: #fffbf0;
        }
        
        /* Priority Badge */
        .priority-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-right: 10px;
        }
        
        .priority-high {
            background: #fee;
            color: #c00;
        }
        
        .priority-medium {
            background: #ffeaa7;
            color: #d63031;
        }
        
        .priority-low {
            background: #dfe6e9;
            color: #636e72;
        }
        
        /* Issue Box */
        .issue-box {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 15px;
            margin: 12px 0;
        }
        
        .issue-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .issue-type {
            font-weight: bold;
            color: #3498db;
            text-transform: capitalize;
        }
        
        .issue-text {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            margin: 8px 0;
        }
        
        .issue-original {
            color: #e74c3c;
            text-decoration: line-through;
        }
        
        .issue-suggestion {
            color: #2ecc71;
        }
        
        .issue-explanation {
            font-size: 14px;
            color: #666;
            font-style: italic;
            margin-top: 8px;
        }
        
        /* Summary Box */
        .summary-box {
            background: #f8f9fa;
            border-left: 5px solid #3498db;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
        }
        
        /* Table */
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        .data-table th {
            background: #34495e;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 500;
        }
        
        .data-table td {
            padding: 12px;
            border-bottom: 1px solid #ecf0f1;
        }
        
        .data-table tr:hover {
            background: #f8f9fa;
        }
        
        /* Footer */
        .report-footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #ecf0f1;
            text-align: center;
            color: #95a5a6;
            font-size: 12px;
        }
        
        /* Print Button */
        .print-button {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #3498db;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 50px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(52, 152, 219, 0.4);
            transition: all 0.3s;
        }
        
        .print-button:hover {
            background: #2980b9;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(52, 152, 219, 0.5);
        }
        
        /* Score Colors */
        .score-excellent { color: #2ecc71; }
        .score-good { color: #3498db; }
        .score-fair { color: #f39c12; }
        .score-poor { color: #e74c3c; }
        
        /* Breadcrumb */
        .breadcrumb {
            background: white;
            padding: 15px 30px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
            margin-bottom: 20px;
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
    </style>
</head>
<body>
    <nav class="breadcrumb">
        <a href="https://dashboard.scarter4workmanuscripthub.com${reportId ? '/?loadReport=' + reportId : ''}">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0L0 6v10h6V10h4v6h6V6L8 0z"/>
            </svg>
            Dashboard
        </a>
        <span class="breadcrumb-separator">›</span>
        ${reportId ? `<a href="https://dashboard.scarter4workmanuscripthub.com/?loadReport=${reportId}">Analysis Results</a>` : '<span class="breadcrumb-current">Analysis Results</span>'}
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-current">Summary Report</span>
    </nav>
    <div class="report-container">
        <div class="page">
            <!-- Header -->
            <div class="report-header">
                <h1 class="report-title">Manuscript Analysis Report</h1>
                <p class="report-subtitle">${metadata.originalName || 'Untitled Manuscript'}</p>
                <div class="report-meta">
                    <span>Author: ${metadata.authorId || 'Anonymous'}</span>
                    <span>Report Date: ${reportDate}</span>
                    <span>Analysis ID: ${manuscriptKey.split('/').pop().substring(0, 8)}</span>
                </div>
            </div>
            
            <!-- Executive Summary -->
            <div class="executive-summary">
                <h2>Executive Summary</h2>
                <p>${this.generateExecutiveSummary(devAnalysis, lineAnalysis, copyAnalysis)}</p>
                
                <div class="summary-stats">
                    <div class="stat-box">
                        <span class="stat-value ${this.getScoreClass(devAnalysis?.analysis?.overallScore || 0)}">${(devAnalysis?.analysis?.overallScore || 0).toFixed(1)}</span>
                        <span class="stat-label">Story & Structure</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-value ${this.getScoreClass(lineAnalysis?.overallAssessment?.overallProseScore || 0)}">${(lineAnalysis?.overallAssessment?.overallProseScore || 0).toFixed(1)}</span>
                        <span class="stat-label">Prose Quality</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-value ${this.getScoreClass(copyAnalysis?.overallAssessment?.overallCopyScore || 0)}">${(copyAnalysis?.overallAssessment?.overallCopyScore || 0).toFixed(1)}</span>
                        <span class="stat-label">Technical Quality</span>
                    </div>
                </div>
            </div>
            
            ${this.generateDevelopmentalSection(devAnalysis)}
        </div>
        
        <div class="page page-break">
            ${this.generateLineEditingSection(lineAnalysis)}
        </div>
        
        <div class="page page-break">
            ${this.generateCopyEditingSection(copyAnalysis)}
        </div>
        
        <div class="page page-break">
            ${this.generateRecommendationsSection(devAnalysis, lineAnalysis, copyAnalysis)}
            
            <div class="report-footer">
                <p>This report was generated by ManuscriptHub AI Analysis System</p>
                <p>For questions or revisions, please contact your editor</p>
            </div>
        </div>
    </div>
    
    <button class="print-button no-print" onclick="window.print()">📄 Print / Save as PDF</button>
</body>
</html>`;
  }

  static generateExecutiveSummary(devAnalysis, lineAnalysis, copyAnalysis) {
    const avgScore = ((devAnalysis?.analysis?.overallScore || 0) + 
                     (lineAnalysis?.overallAssessment?.overallProseScore || 0) + 
                     (copyAnalysis?.overallAssessment?.overallCopyScore || 0)) / 3;
    
    if (avgScore >= 8.5) {
      return "Your manuscript demonstrates exceptional quality across all areas. The story structure is solid, the prose is engaging, and technical execution is professional. This work is approaching publication-ready status with minimal revisions needed.";
    } else if (avgScore >= 7) {
      return "Your manuscript shows strong potential with a solid foundation. The story has clear strengths, though some areas would benefit from revision. The prose quality is good overall, with opportunities for refinement that will elevate the work significantly.";
    } else if (avgScore >= 5.5) {
      return "Your manuscript has a promising core concept but requires substantial revision to reach its full potential. Focus on the priority recommendations in this report to strengthen both the story structure and prose quality.";
    } else {
      return "Your manuscript would benefit from significant developmental work before moving forward. The good news: every issue identified in this report is addressable with focused revision. We recommend working through the high-priority items first.";
    }
  }

  static generateDevelopmentalSection(devAnalysis) {
    if (!devAnalysis?.analysis) {
      return '<div class="summary-box"><p>Developmental analysis not available.</p></div>';
    }
    
    const analysis = devAnalysis.analysis;
    
    return `
      <h2>📖 Developmental Analysis</h2>
      <p class="summary-box">${analysis.structure?.summary || analysis.voice?.summary || 'Overall developmental feedback'}</p>
      
      <h3>Story Structure (${analysis.structure?.score || 'N/A'}/10)</h3>
      ${this.renderScoreMeter(analysis.structure?.score || 0)}
      
      ${this.renderStrengthsWeaknesses(analysis.structure)}
      
      <h3>Character Development (${analysis.characters?.score || 'N/A'}/10)</h3>
      ${this.renderScoreMeter(analysis.characters?.score || 0)}
      
      ${this.renderStrengthsWeaknesses(analysis.characters)}
      
      <h3>Plot & Conflict (${analysis.plot?.score || 'N/A'}/10)</h3>
      ${this.renderScoreMeter(analysis.plot?.score || 0)}
      
      ${this.renderStrengthsWeaknesses(analysis.plot)}
      
      <h3>Voice & Style (${analysis.voice?.score || 'N/A'}/10)</h3>
      ${this.renderScoreMeter(analysis.voice?.score || 0)}
      
      ${this.renderStrengthsWeaknesses(analysis.voice)}
      
      ${analysis.topPriorities?.length > 0 ? `
      <h3>Top Priorities for Revision</h3>
      <div class="recommendation-list">
        ${analysis.topPriorities.map((priority, i) => 
          `<div class="list-item"><span class="priority-badge priority-high">Priority ${i + 1}</span>${priority}</div>`
        ).join('')}
      </div>
      ` : ''}
    `;
  }

  static generateLineEditingSection(lineAnalysis) {
    if (!lineAnalysis?.overallAssessment) {
      return '<div class="summary-box"><p>Line editing analysis not available.</p></div>';
    }
    
    const assessment = lineAnalysis.overallAssessment;
    const patterns = lineAnalysis.patterns || {};
    const topIssues = (lineAnalysis.topSuggestions || []).slice(0, 15);
    
    return `
      <h2>✍️ Line Editing Analysis</h2>
      <p class="summary-box">${assessment.summary}</p>
      
      <h3>Prose Quality Score: ${assessment.overallProseScore}/10</h3>
      ${this.renderScoreMeter(assessment.overallProseScore)}
      
      <h3>Key Findings</h3>
      <table class="data-table">
        <tr>
          <th>Metric</th>
          <th>Count</th>
          <th>Assessment</th>
        </tr>
        <tr>
          <td>Passive Voice</td>
          <td>${patterns.passiveVoiceTotal || 0}</td>
          <td>${this.assessMetric(patterns.passiveVoiceTotal, 50, 'instances')}</td>
        </tr>
        <tr>
          <td>Adverb Usage</td>
          <td>${patterns.adverbTotal || 0}</td>
          <td>${this.assessMetric(patterns.adverbTotal, 100, 'adverbs')}</td>
        </tr>
        <tr>
          <td>Average Sentence Length</td>
          <td>${patterns.averageSentenceLengthOverall || 0} words</td>
          <td>${this.assessSentenceLength(patterns.averageSentenceLengthOverall)}</td>
        </tr>
        <tr>
          <td>Total Issues Found</td>
          <td>${patterns.totalIssues || 0}</td>
          <td>${this.assessTotalIssues(patterns.totalIssues)}</td>
        </tr>
      </table>
      
      ${assessment.keyWeaknesses?.length > 0 ? `
      <h3>Areas for Improvement</h3>
      <div class="weakness-list">
        ${assessment.keyWeaknesses.map(weakness => 
          `<div class="list-item">${weakness}</div>`
        ).join('')}
      </div>
      ` : ''}
      
      ${topIssues.length > 0 ? `
      <h3>Specific Suggestions (Top 15)</h3>
      ${topIssues.map((issue, i) => this.renderIssue(issue, i + 1)).join('')}
      ` : ''}
    `;
  }

  static generateCopyEditingSection(copyAnalysis) {
    if (!copyAnalysis?.overallAssessment) {
      return '<div class="summary-box"><p>Copy editing analysis not available.</p></div>';
    }
    
    const assessment = copyAnalysis.overallAssessment;
    const errorsByType = copyAnalysis.errorsByType || {};
    const topIssues = (copyAnalysis.topIssues || []).slice(0, 20);
    
    return `
      <h2>📝 Copy Editing Analysis</h2>
      <p class="summary-box">${assessment.summary}</p>
      
      <h3>Technical Quality Score: ${assessment.overallCopyScore}/10</h3>
      ${this.renderScoreMeter(assessment.overallCopyScore)}
      
      ${assessment.readyForPublication ? 
        '<div class="summary-box" style="border-left-color: #2ecc71; background: #f0fdf4;"><strong>✓ Publication Ready:</strong> Technical quality meets professional standards.</div>' : 
        '<div class="summary-box" style="border-left-color: #f39c12; background: #fffbf0;"><strong>⚠ Needs Revision:</strong> Professional copy editing recommended before publication.</div>'
      }
      
      <h3>Error Summary</h3>
      <table class="data-table">
        <tr>
          <th>Error Type</th>
          <th>Count</th>
        </tr>
        ${Object.entries(errorsByType).map(([type, count]) => `
          <tr>
            <td style="text-transform: capitalize;">${type.replace(/_/g, ' ')}</td>
            <td><strong>${count}</strong></td>
          </tr>
        `).join('')}
        <tr style="background: #f8f9fa; font-weight: bold;">
          <td>Total Errors</td>
          <td>${assessment.totalErrors}</td>
        </tr>
      </table>
      
      ${assessment.focusAreas?.length > 0 ? `
      <h3>Focus Areas</h3>
      <div class="weakness-list">
        ${assessment.focusAreas.map(area => 
          `<div class="list-item">${area}</div>`
        ).join('')}
      </div>
      ` : ''}
      
      ${topIssues.length > 0 ? `
      <h3>Specific Corrections (Top 20)</h3>
      ${topIssues.map((issue, i) => this.renderCopyIssue(issue, i + 1)).join('')}
      ` : ''}
    `;
  }

  static generateRecommendationsSection(devAnalysis, lineAnalysis, copyAnalysis) {
    const recommendations = [];
    
    // Gather top priorities
    if (devAnalysis?.analysis?.topPriorities) {
      recommendations.push(...devAnalysis.analysis.topPriorities.map(p => ({
        type: 'Developmental',
        priority: 'HIGH',
        text: p
      })));
    }
    
    if (lineAnalysis?.overallAssessment?.urgentIssues) {
      recommendations.push(...lineAnalysis.overallAssessment.urgentIssues.map(p => ({
        type: 'Line Editing',
        priority: 'HIGH',
        text: p
      })));
    }
    
    if (copyAnalysis?.overallAssessment?.focusAreas) {
      recommendations.push(...copyAnalysis.overallAssessment.focusAreas.slice(0, 3).map(p => ({
        type: 'Copy Editing',
        priority: 'MEDIUM',
        text: p
      })));
    }
    
    return `
      <h2>🎯 Action Plan & Recommendations</h2>
      
      <div class="summary-box">
        <p><strong>Recommended Revision Order:</strong></p>
        <ol style="margin-left: 20px; margin-top: 10px;">
          <li style="margin: 8px 0;">Address high-priority developmental issues first (story structure, character arcs)</li>
          <li style="margin: 8px 0;">Revise prose at the line level (sentence structure, word choice, show vs tell)</li>
          <li style="margin: 8px 0;">Final copy edit pass for grammar, punctuation, and consistency</li>
          <li style="margin: 8px 0;">Professional proofread before submission</li>
        </ol>
      </div>
      
      ${recommendations.length > 0 ? `
      <h3>Priority Action Items</h3>
      ${recommendations.map(rec => `
        <div class="issue-box">
          <div class="issue-header">
            <span class="issue-type">${rec.type}</span>
            <span class="priority-badge priority-${rec.priority.toLowerCase()}">${rec.priority}</span>
          </div>
          <p>${rec.text}</p>
        </div>
      `).join('')}
      ` : ''}
      
      <h3>Next Steps</h3>
      <div class="recommendation-list">
        <div class="list-item">Review this report thoroughly and make notes on sections that resonate</div>
        <div class="list-item">Start with the highest-priority recommendations in each category</div>
        <div class="list-item">Revise in passes - don't try to fix everything at once</div>
        <div class="list-item">Consider having beta readers review after major revisions</div>
        <div class="list-item">Schedule a follow-up analysis after completing revisions</div>
      </div>
    `;
  }

  static renderScoreMeter(score) {
    const percentage = (score / 10) * 100;
    return `
      <div class="score-meter">
        <div class="score-bar">
          <div class="score-fill" style="width: ${percentage}%">${score}/10</div>
        </div>
      </div>
    `;
  }

  static renderStrengthsWeaknesses(section) {
    if (!section) return '';
    
    let html = '';
    
    if (section.strengths?.length > 0) {
      html += `
        <h4>Strengths:</h4>
        <div class="strength-list">
          ${section.strengths.map(s => `<div class="list-item">${s}</div>`).join('')}
        </div>
      `;
    }
    
    if (section.weaknesses?.length > 0) {
      html += `
        <h4>Weaknesses:</h4>
        <div class="weakness-list">
          ${section.weaknesses.map(w => `<div class="list-item">${w}</div>`).join('')}
        </div>
      `;
    }
    
    if (section.recommendations?.length > 0) {
      html += `
        <h4>Recommendations:</h4>
        <div class="recommendation-list">
          ${section.recommendations.map(r => `<div class="list-item">${r}</div>`).join('')}
        </div>
      `;
    }
    
    return html;
  }

  static renderIssue(issue, index) {
    return `
      <div class="issue-box">
        <div class="issue-header">
          <span class="issue-type">#${index} - ${issue.type?.replace(/_/g, ' ') || 'Issue'}</span>
          <span class="priority-badge priority-${issue.severity}">${issue.severity || 'medium'}</span>
        </div>
        ${issue.location ? `<p style="font-size: 12px; color: #7f8c8d; margin-bottom: 8px;">Location: ${issue.location}</p>` : ''}
        ${issue.original ? `<div class="issue-text issue-original">${this.escapeHtml(issue.original)}</div>` : ''}
        ${issue.suggestion ? `<div class="issue-text issue-suggestion">✓ ${this.escapeHtml(issue.suggestion)}</div>` : ''}
        ${issue.explanation ? `<p class="issue-explanation">${this.escapeHtml(issue.explanation)}</p>` : ''}
      </div>
    `;
  }

  static renderCopyIssue(issue, index) {
    return `
      <div class="issue-box">
        <div class="issue-header">
          <span class="issue-type">#${index} - ${issue.subtype?.replace(/_/g, ' ') || issue.type}</span>
          <span class="priority-badge priority-${issue.severity}">${issue.severity || 'medium'}</span>
        </div>
        ${issue.location ? `<p style="font-size: 12px; color: #7f8c8d; margin-bottom: 8px;">Location: ${issue.location}</p>` : ''}
        ${issue.original ? `<div class="issue-text issue-original">${this.escapeHtml(issue.original)}</div>` : ''}
        ${issue.correction ? `<div class="issue-text issue-suggestion">✓ ${this.escapeHtml(issue.correction)}</div>` : ''}
        ${issue.rule ? `<p class="issue-explanation"><strong>Rule:</strong> ${this.escapeHtml(issue.rule)}</p>` : ''}
      </div>
    `;
  }

  static getScoreClass(score) {
    if (score >= 8.5) return 'score-excellent';
    if (score >= 7) return 'score-good';
    if (score >= 5.5) return 'score-fair';
    return 'score-poor';
  }

  static assessMetric(value, threshold, label) {
    if (value <= threshold) {
      return `✓ Good (under ${threshold} ${label})`;
    } else if (value <= threshold * 1.5) {
      return `⚠ Moderate (consider reducing)`;
    } else {
      return `✗ High (recommend revision)`;
    }
  }

  static assessSentenceLength(length) {
    if (length >= 15 && length <= 20) {
      return '✓ Good variety';
    } else if (length < 15) {
      return '⚠ Consider adding variety (too short)';
    } else {
      return '⚠ Consider breaking up long sentences';
    }
  }

  static assessTotalIssues(count) {
    if (count < 50) return '✓ Minimal issues';
    if (count < 150) return '⚠ Moderate revision needed';
    return '✗ Significant revision needed';
  }

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
