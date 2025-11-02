#!/usr/bin/env node

/**
 * Test script for the Developmental Agent
 * 
 * Usage:
 *   node test-dev-agent.js <manuscript-file> <genre>
 * 
 * Example:
 *   node test-dev-agent.js sample-manuscript.txt thriller
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
  console.log('   Manuscript ID:', result.manuscriptId);
  
  return result.key;
}

async function analyzeManuscript(manuscriptKey, genre) {
  console.log('\n🤖 Triggering developmental analysis...');
  console.log('   Genre:', genre);
  console.log('   This may take 30-60 seconds...\n');

  const response = await fetch(`${API_BASE}/analyze/developmental`, {
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
  return result.analysis;
}

function displayAnalysis(analysis) {
  console.log('\n📊 ANALYSIS RESULTS\n');
  console.log('═'.repeat(60));
  
  // Debug: show what we actually got
  if (!analysis.structure || !analysis.characters) {
    console.log('\n⚠️  Raw analysis structure:');
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }
  
  // Overall Score
  console.log(`\n🎯 Overall Score: ${analysis.overallScore}/10\n`);
  
  // Structure
  console.log('📖 STRUCTURE');
  console.log('   Score:', `${analysis.structure.score}/10`);
  console.log('   Strengths:', analysis.structure.strengths?.join(', ') || 'N/A');
  if (analysis.structure.weaknesses?.length > 0) {
    console.log('   Weaknesses:', analysis.structure.weaknesses.join(', '));
  }
  if (analysis.structure.recommendations?.length > 0) {
    console.log('   ➜', analysis.structure.recommendations[0]);
  }
  
  // Characters
  console.log('\n👥 CHARACTERS');
  console.log('   Score:', `${analysis.characters.score}/10`);
  console.log('   Strengths:', analysis.characters.strengths?.join(', ') || 'N/A');
  if (analysis.characters.weaknesses?.length > 0) {
    console.log('   Weaknesses:', analysis.characters.weaknesses.join(', '));
  }
  if (analysis.characters.recommendations?.length > 0) {
    console.log('   ➜', analysis.characters.recommendations[0]);
  }
  
  // Plot
  console.log('\n📝 PLOT');
  console.log('   Score:', `${analysis.plot.score}/10`);
  console.log('   Strengths:', analysis.plot.strengths?.join(', ') || 'N/A');
  if (analysis.plot.weaknesses?.length > 0) {
    console.log('   Weaknesses:', analysis.plot.weaknesses.join(', '));
  }
  
  // Voice
  console.log('\n🎭 VOICE & STYLE');
  console.log('   Score:', `${analysis.voice.score}/10`);
  console.log('   Strengths:', analysis.voice.strengths?.join(', ') || 'N/A');
  
  // Genre Fit
  console.log('\n🎬 GENRE FIT');
  console.log('   Score:', `${analysis.genreFit.score}/10`);
  console.log('   Strengths:', analysis.genreFit.strengths?.join(', ') || 'N/A');
  
  // Marketability
  if (analysis.marketability) {
    console.log('\n💰 MARKETABILITY');
    console.log('   Score:', `${analysis.marketability.score}/10`);
    console.log('   Summary:', analysis.marketability.summary);
  }
  
  // Top Priorities
  if (analysis.topPriorities?.length > 0) {
    console.log('\n🚀 TOP PRIORITIES');
    analysis.topPriorities.forEach((priority, index) => {
      console.log(`   ${index + 1}. ${priority}`);
    });
  }
  
  console.log('\n' + '═'.repeat(60));
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node test-dev-agent.js <manuscript-file> <genre>');
    console.error('Example: node test-dev-agent.js sample.txt thriller');
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
    
    // Save results to file
    const outputFile = `analysis-${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(analysis, null, 2));
    console.log(`\n💾 Full analysis saved to: ${outputFile}`);
    
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
