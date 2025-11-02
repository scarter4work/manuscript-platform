#!/usr/bin/env node

/**
 * Test script for the Copy Editing Agent
 * 
 * Usage:
 *   node test-copy-agent.js <manuscript-file> <style-guide>
 * 
 * Example:
 *   node test-copy-agent.js sample-manuscript.txt chicago
 * 
 * Style Guides: chicago (default), ap, custom
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

async function analyzeManuscript(manuscriptKey, styleGuide) {
  console.log('\n📝 Triggering copy editing analysis...');
  console.log('   Style Guide:', styleGuide.toUpperCase());
  console.log('   Checking grammar, punctuation, and consistency...');
  console.log('   This will take 1-3 minutes...\n');

  const response = await fetch(`${API_BASE}/analyze/copy-editing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      manuscriptKey: manuscriptKey,
      styleGuide: styleGuide
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
  console.log('\n📊 COPY EDITING ANALYSIS\n');
  console.log('═'.repeat(70));
  
  // Check structure
  if (!analysis || !analysis.overallAssessment) {
    console.log('\n⚠️  Analysis structure issue:');
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }
  
  // Overall Assessment
  const assessment = analysis.overallAssessment;
  console.log(`\n🎯 Overall Copy Score: ${assessment.overallCopyScore}/10`);
  console.log(`📋 Total Errors Found: ${assessment.totalErrors}\n`);
  console.log(`📝 Summary: ${assessment.summary}\n`);
  
  if (assessment.readyForPublication) {
    console.log('✅ READY FOR PUBLICATION!\n');
  } else {
    console.log('⚠️  Needs revision before publication\n');
  }
  
  // Focus Areas
  if (assessment.focusAreas?.length > 0) {
    console.log('🎯 FOCUS AREAS:');
    assessment.focusAreas.forEach(area => {
      console.log(`   • ${area}`);
    });
    console.log();
  }
  
  // Error Breakdown
  const errorsByType = analysis.errorsByType;
  if (errorsByType && Object.keys(errorsByType).length > 0) {
    console.log('📊 ERROR BREAKDOWN:');
    Object.entries(errorsByType)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        const icon = count > 20 ? '🔴' : count > 10 ? '🟡' : '🟢';
        console.log(`   ${icon} ${type.toUpperCase()}: ${count}`);
      });
    console.log();
  }
  
  // Consistency Issues
  const consistency = analysis.consistencyIssues;
  if (consistency) {
    let hasIssues = false;
    
    if (consistency.characterNames?.length > 0) {
      if (!hasIssues) {
        console.log('⚠️  CONSISTENCY ISSUES:');
        hasIssues = true;
      }
      console.log('\n   Character Name Variations:');
      consistency.characterNames.forEach(issue => {
        console.log(`   • ${issue.suggestion}`);
      });
    }
    
    if (consistency.numberStyle?.length > 0) {
      if (!hasIssues) {
        console.log('⚠️  CONSISTENCY ISSUES:');
        hasIssues = true;
      }
      console.log('\n   Number Style:');
      consistency.numberStyle.forEach(issue => {
        console.log(`   • ${issue.suggestion}`);
      });
    }
    
    if (hasIssues) console.log();
  }
  
  // Top Issues
  console.log('🔧 TOP PRIORITY CORRECTIONS:\n');
  analysis.topIssues.slice(0, 15).forEach((issue, index) => {
    const severity = issue.severity === 'high' ? '🔴' : 
                     issue.severity === 'medium' ? '🟡' : '🟢';
    
    console.log(`${index + 1}. ${severity} ${issue.type.toUpperCase()} - ${issue.subtype || 'general'}`);
    console.log(`   Section ${issue.sectionNumber} (words ${issue.wordRange})`);
    console.log(`   ❌ Original: "${issue.original}"`);
    console.log(`   ✅ Correction: "${issue.correction}"`);
    console.log(`   📖 Rule: ${issue.rule}`);
    if (issue.confidence !== 'high') {
      console.log(`   ℹ️  Confidence: ${issue.confidence}`);
    }
    console.log();
  });
  
  console.log('═'.repeat(70));
  
  // Recommendations
  if (assessment.totalErrors > 50) {
    console.log('\n💡 RECOMMENDATION: Consider professional copy editing before publication.');
  } else if (assessment.totalErrors > 20) {
    console.log('\n💡 RECOMMENDATION: Review and correct flagged issues before publication.');
  } else {
    console.log('\n💡 RECOMMENDATION: Minor cleanup needed. Nearly publication-ready!');
  }
  console.log();
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: node test-copy-agent.js <manuscript-file> [style-guide]');
    console.error('Example: node test-copy-agent.js sample.txt chicago');
    console.error('\nStyle Guides:');
    console.error('  chicago - Chicago Manual of Style (default for fiction)');
    console.error('  ap      - Associated Press Style');
    console.error('  custom  - Custom/generic rules');
    process.exit(1);
  }

  const filePath = args[0];
  const styleGuide = args[1] || 'chicago';
  
  if (!['chicago', 'ap', 'custom'].includes(styleGuide)) {
    console.error(`Invalid style guide: ${styleGuide}`);
    console.error('Valid options: chicago, ap, custom');
    process.exit(1);
  }
  
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    // Step 1: Upload
    const manuscriptKey = await uploadManuscript(filePath);
    
    // Step 2: Analyze
    const analysis = await analyzeManuscript(manuscriptKey, styleGuide);
    
    // Step 3: Display results
    displayAnalysis(analysis);
    
    // Save full results to file
    const outputFile = `copy-analysis-${Date.now()}.json`;
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
