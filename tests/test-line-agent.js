#!/usr/bin/env node

/**
 * Test script for the Line Editing Agent
 * 
 * Usage:
 *   node test-line-agent.js <manuscript-file> <genre>
 * 
 * Example:
 *   node test-line-agent.js sample-manuscript.txt thriller
 */

const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:8787';
const AUTHOR_ID = 'test-author';

async function uploadManuscript(filePath) {
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const blob = new Blob([fileBuffer], { type: 'text/plain' });
  
  formData.append('file', blob, fileName);
  formData.append('authorId', AUTHOR_ID);
  formData.append('manuscriptId', `test-${Date.now()}`);

  console.log('📤 Uploading manuscript...');
  const response = await fetch(`${API_BASE}/upload/manuscript`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  console.log('✅ Upload successful!');
  console.log('   Key:', result.key);
  
  return result.key;
}

async function analyzeManuscript(manuscriptKey, genre) {
  console.log('\n✍️  Triggering line editing analysis...');
  console.log('   Genre:', genre);
  console.log('   This will take 1-3 minutes depending on manuscript length...');
  console.log('   (Agent processes in sections to provide detailed feedback)\n');

  const response = await fetch(`${API_BASE}/analyze/line-editing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      manuscriptKey: manuscriptKey,
      genre: genre
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Analysis failed: ${response.status} ${error}`);
  }

  const result = await response.json();
  console.log('\n✅ Analysis complete!');
  console.log('   Response keys:', Object.keys(result));
  
  if (!result.analysis) {
    console.log('\n⚠️  Warning: No analysis object in response');
    console.log('   Full response:', JSON.stringify(result, null, 2));
  }
  
  return result.analysis;
}

function displayAnalysis(analysis) {
  console.log('\n📊 LINE EDITING ANALYSIS\n');
  console.log('═'.repeat(70));
  
  // Debug: Check if we have the expected structure
  if (!analysis || !analysis.overallAssessment) {
    console.log('\n⚠️  Analysis structure issue:');
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }
  
  // Overall Assessment
  const assessment = analysis.overallAssessment;
  console.log(`\n🎯 Overall Prose Score: ${assessment.overallProseScore}/10\n`);
  console.log(`📝 Summary: ${assessment.summary}\n`);
  
  // Key Strengths
  if (assessment.keyStrengths?.length > 0) {
    console.log('💪 KEY STRENGTHS:');
    assessment.keyStrengths.forEach(strength => {
      console.log(`   ✓ ${strength}`);
    });
    console.log();
  }
  
  // Key Weaknesses
  if (assessment.keyWeaknesses?.length > 0) {
    console.log('⚠️  KEY WEAKNESSES:');
    assessment.keyWeaknesses.forEach(weakness => {
      console.log(`   • ${weakness}`);
    });
    console.log();
  }
  
  // Urgent Issues
  if (assessment.urgentIssues?.length > 0) {
    console.log('🚨 URGENT ISSUES:');
    assessment.urgentIssues.forEach(issue => {
      console.log(`   ! ${issue}`);
    });
    console.log();
  }
  
  // Patterns
  const patterns = analysis.patterns;
  console.log('📈 MANUSCRIPT-WIDE PATTERNS:');
  console.log(`   Sections Analyzed: ${patterns.totalSections}`);
  console.log(`   Total Issues Found: ${patterns.totalIssues}`);
  console.log(`   Passive Voice Count: ${patterns.passiveVoiceTotal}`);
  console.log(`   Adverb Count: ${patterns.adverbTotal}`);
  console.log(`   Avg Sentence Length: ${patterns.averageSentenceLengthOverall} words`);
  console.log();
  
  // Top Issues by Type
  if (patterns.issueTypeCounts && Object.keys(patterns.issueTypeCounts).length > 0) {
    console.log('📋 ISSUE BREAKDOWN:');
    const sorted = Object.entries(patterns.issueTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    sorted.forEach(([type, count]) => {
      console.log(`   ${type.replace(/_/g, ' ').toUpperCase()}: ${count}`);
    });
    console.log();
  }
  
  // Top Priority Suggestions
  console.log('🔧 TOP PRIORITY FIXES:\n');
  analysis.topSuggestions.slice(0, 10).forEach((suggestion, index) => {
    const severity = suggestion.severity === 'high' ? '🔴' : 
                     suggestion.severity === 'medium' ? '🟡' : '🟢';
    
    console.log(`${index + 1}. ${severity} ${suggestion.type.replace(/_/g, ' ').toUpperCase()}`);
    console.log(`   Section ${suggestion.sectionNumber} (words ${suggestion.wordRange})`);
    console.log(`   Original: "${suggestion.original}"`);
    console.log(`   Suggested: "${suggestion.suggestion}"`);
    console.log(`   Why: ${suggestion.explanation}`);
    console.log();
  });
  
  console.log('═'.repeat(70));
  console.log(`\n💡 TIP: Focus on fixing ${analysis.topSuggestions[0]?.type.replace(/_/g, ' ')} issues first for maximum impact.\n`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node test-line-agent.js <manuscript-file> <genre>');
    console.error('Example: node test-line-agent.js sample.txt thriller');
    console.error('\nGenres: thriller, romance, fantasy, sci-fi, mystery, literary, etc.');
    process.exit(1);
  }

  const [filePath, genre] = args;
  
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    // Step 1: Upload
    const manuscriptKey = await uploadManuscript(filePath);
    
    // Step 2: Analyze
    const analysis = await analyzeManuscript(manuscriptKey, genre);
    
    // Step 3: Display results
    displayAnalysis(analysis);
    
    // Save full results to file
    const outputFile = `line-analysis-${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(analysis, null, 2));
    console.log(`💾 Full analysis saved to: ${outputFile}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
