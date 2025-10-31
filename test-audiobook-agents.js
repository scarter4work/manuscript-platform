#!/usr/bin/env node

/**
 * Test script for Audiobook Asset Generation
 *
 * Tests the 5 audiobook agents:
 * 1. Narration Brief
 * 2. Pronunciation Guide
 * 3. Timing Estimates
 * 4. Sample Selections
 * 5. ACX/Audible Metadata
 *
 * Usage:
 *   node test-audiobook-agents.js <manuscript-id>
 *
 * Example:
 *   node test-audiobook-agents.js abc123
 *
 * Prerequisites:
 *   - Manuscript must already exist and be analyzed
 *   - Asset generation must have run (or run via /manuscripts/:id/audiobook/regenerate)
 *   - Valid auth token in environment or passed as argument
 */

// Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:8787';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your-test-token-here';

/**
 * Get all audiobook assets for a manuscript
 */
async function getAudiobookAssets(manuscriptId) {
  console.log(`\n📚 Fetching audiobook assets for manuscript: ${manuscriptId}`);

  const response = await fetch(`${API_BASE}/manuscripts/${manuscriptId}/audiobook`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch audiobook assets: ${response.status} ${error}`);
  }

  return await response.json();
}

/**
 * Get a specific audiobook asset type
 */
async function getSpecificAsset(manuscriptId, assetType) {
  console.log(`\n📄 Fetching ${assetType} asset...`);

  const response = await fetch(`${API_BASE}/manuscripts/${manuscriptId}/audiobook/${assetType}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch ${assetType}: ${response.status} ${error}`);
  }

  return await response.json();
}

/**
 * Regenerate audiobook assets
 */
async function regenerateAudiobookAssets(manuscriptId, assetTypes = ['all']) {
  console.log(`\n🔄 Regenerating audiobook assets for manuscript: ${manuscriptId}`);
  console.log(`   Asset types: ${assetTypes.join(', ')}`);

  const response = await fetch(`${API_BASE}/manuscripts/${manuscriptId}/audiobook/regenerate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ assetTypes })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to regenerate assets: ${response.status} ${error}`);
  }

  return await response.json();
}

/**
 * Display narration brief summary
 */
function displayNarrationBrief(narration) {
  if (!narration) {
    console.log('   ❌ Narration brief not available');
    return;
  }

  console.log('\n🎙️  NARRATION BRIEF');
  console.log('═'.repeat(60));

  if (narration.narrationStyle) {
    console.log(`\n📋 Narration Style:`);
    console.log(`   Approach: ${narration.narrationStyle.approach}`);
    console.log(`   Tone: ${narration.narrationStyle.tone}`);
    console.log(`   Pacing: ${narration.narrationStyle.pacing}`);
  }

  if (narration.characterVoices && narration.characterVoices.length > 0) {
    console.log(`\n🎭 Character Voices (${narration.characterVoices.length}):`);
    narration.characterVoices.slice(0, 3).forEach(char => {
      console.log(`   - ${char.characterName}: ${char.vocalCharacteristics}`);
    });
    if (narration.characterVoices.length > 3) {
      console.log(`   ... and ${narration.characterVoices.length - 3} more`);
    }
  }

  if (narration.productionNotes) {
    console.log(`\n⏱️  Production:`);
    console.log(`   Studio Hours: ${narration.productionNotes.estimatedStudioHours || 'N/A'}`);
    console.log(`   Difficulty: ${narration.productionNotes.difficultyLevel || 'N/A'}`);
  }

  if (narration.estimatedListeningTime) {
    console.log(`\n🎧 Listening Time: ${narration.estimatedListeningTime}`);
  }
}

/**
 * Display pronunciation guide summary
 */
function displayPronunciationGuide(pronunciation) {
  if (!pronunciation) {
    console.log('   ❌ Pronunciation guide not available');
    return;
  }

  console.log('\n📖 PRONUNCIATION GUIDE');
  console.log('═'.repeat(60));

  const characterNames = pronunciation.characterNames || [];
  const placeNames = pronunciation.placeNames || [];
  const fictionalTerms = pronunciation.fictionalTerms || [];
  const foreignWords = pronunciation.foreignWords || [];

  console.log(`\n📊 Terms Identified: ${pronunciation.totalTermsIdentified || 'Unknown'}`);
  console.log(`   Character Names: ${characterNames.length}`);
  console.log(`   Place Names: ${placeNames.length}`);
  console.log(`   Fictional Terms: ${fictionalTerms.length}`);
  console.log(`   Foreign Words: ${foreignWords.length}`);

  if (characterNames.length > 0) {
    console.log(`\n👤 Sample Character Pronunciations:`);
    characterNames.slice(0, 3).forEach(char => {
      console.log(`   ${char.name}: ${char.phonetic}`);
      if (char.notes) console.log(`      Notes: ${char.notes}`);
    });
  }
}

/**
 * Display timing estimates summary
 */
function displayTimingEstimates(timing) {
  if (!timing) {
    console.log('   ❌ Timing estimates not available');
    return;
  }

  console.log('\n⏱️  TIMING ESTIMATES');
  console.log('═'.repeat(60));

  if (timing.overallTiming) {
    console.log(`\n📊 Overall:`);
    console.log(`   Listening Time: ${timing.overallTiming.totalListeningTime}`);
    console.log(`   Studio Hours: ${timing.overallTiming.estimatedStudioHours || 'N/A'}`);
    console.log(`   Post-Production: ${timing.overallTiming.estimatedPostProductionHours || 'N/A'} hours`);
    console.log(`   Recommended Speed: ${timing.overallTiming.recommendedNarrationSpeed}`);
  }

  if (timing.chapterEstimates && timing.chapterEstimates.length > 0) {
    console.log(`\n📚 Chapters (${timing.chapterEstimates.length}):`);
    timing.chapterEstimates.slice(0, 5).forEach(ch => {
      console.log(`   Ch ${ch.chapterNumber}: ${ch.estimatedMinutes} min (${ch.pacing})`);
    });
    if (timing.chapterEstimates.length > 5) {
      console.log(`   ... and ${timing.chapterEstimates.length - 5} more chapters`);
    }
  }

  if (timing.budgetEstimate) {
    console.log(`\n💰 Budget Estimate:`);
    console.log(`   ${timing.budgetEstimate.totalEstimate || 'N/A'}`);
  }
}

/**
 * Display sample selections summary
 */
function displaySampleSelections(samples) {
  if (!samples) {
    console.log('   ❌ Sample selections not available');
    return;
  }

  console.log('\n🎬 SAMPLE SELECTIONS');
  console.log('═'.repeat(60));

  if (samples.retailAudioSample) {
    console.log(`\n🔊 Retail Audio Sample (ACX):`);
    console.log(`   Duration: ${samples.retailAudioSample.estimatedDuration || '~5:00'}`);
    console.log(`   Words: ${samples.retailAudioSample.estimatedWords || 'N/A'}`);
    console.log(`   Hook: ${samples.retailAudioSample.hookAnalysis || 'N/A'}`);
  }

  if (samples.auditionSamples && samples.auditionSamples.length > 0) {
    console.log(`\n🎭 Audition Samples (${samples.auditionSamples.length}):`);
    samples.auditionSamples.forEach((sample, i) => {
      console.log(`   ${i + 1}. ${sample.purpose} (${sample.estimatedDuration})`);
    });
  }

  if (samples.showcaseSamples) {
    console.log(`\n🌟 Showcase Samples:`);
    if (samples.showcaseSamples.bestAction) {
      console.log(`   Best Action: ${samples.showcaseSamples.bestAction.location}`);
    }
    if (samples.showcaseSamples.bestEmotional) {
      console.log(`   Best Emotional: ${samples.showcaseSamples.bestEmotional.location}`);
    }
  }
}

/**
 * Display ACX metadata summary
 */
function displayACXMetadata(metadata) {
  if (!metadata) {
    console.log('   ❌ ACX metadata not available');
    return;
  }

  console.log('\n📋 ACX/AUDIBLE METADATA');
  console.log('═'.repeat(60));

  if (metadata.titleMetadata) {
    console.log(`\n📚 Title:`);
    console.log(`   ${metadata.titleMetadata.audiobookTitle || 'N/A'}`);
    if (metadata.titleMetadata.subtitle) {
      console.log(`   Subtitle: ${metadata.titleMetadata.subtitle}`);
    }
    if (metadata.titleMetadata.seriesName) {
      console.log(`   Series: ${metadata.titleMetadata.seriesName} #${metadata.titleMetadata.seriesNumber}`);
    }
  }

  if (metadata.contentRating) {
    console.log(`\n🔞 Content Rating: ${metadata.contentRating.rating}`);
  }

  if (metadata.categories && metadata.categories.audible) {
    console.log(`\n📂 Audible Categories (${metadata.categories.audible.length}):`);
    metadata.categories.audible.slice(0, 2).forEach(cat => {
      console.log(`   - ${cat.path}`);
    });
  }

  if (metadata.audiobookSpecs) {
    console.log(`\n⏱️  Runtime: ${metadata.audiobookSpecs.estimatedRuntime}`);
    console.log(`   Narration: ${metadata.audiobookSpecs.narrationType}`);
  }

  if (metadata.distributionMetadata && metadata.distributionMetadata.priceTierSuggestion) {
    console.log(`\n💰 Pricing: ${metadata.distributionMetadata.priceTierSuggestion.estimatedRetailPrice || 'N/A'}`);
  }
}

/**
 * Main test execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node test-audiobook-agents.js <manuscript-id>');
    console.error('Example: node test-audiobook-agents.js abc123');
    process.exit(1);
  }

  const manuscriptId = args[0];
  const regenerate = args.includes('--regenerate');

  try {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║   AUDIOBOOK ASSET GENERATION TEST (MAN-18)           ║');
    console.log('╚═══════════════════════════════════════════════════════╝');

    // Regenerate if requested
    if (regenerate) {
      const regenResult = await regenerateAudiobookAssets(manuscriptId);
      console.log('✅ Regeneration queued!');
      console.log(`   Report ID: ${regenResult.reportId}`);
      console.log(`   Status URL: ${regenResult.statusUrl}`);
      console.log('\n⏳ Waiting for generation to complete (60 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 60000));
    }

    // Fetch all audiobook assets
    const audiobook = await getAudiobookAssets(manuscriptId);

    console.log('\n✅ Audiobook assets retrieved!');
    console.log(`   Manuscript: ${audiobook.manuscriptTitle || manuscriptId}`);
    console.log(`   Has Assets: ${audiobook.hasAssets ? 'Yes' : 'No'}`);

    if (!audiobook.hasAssets) {
      console.log('\n⚠️  No audiobook assets found.');
      console.log('   Run with --regenerate to generate assets, or ensure analysis is complete.');
      process.exit(1);
    }

    // Display each asset type
    displayNarrationBrief(audiobook.narration);
    displayPronunciationGuide(audiobook.pronunciation);
    displayTimingEstimates(audiobook.timing);
    displaySampleSelections(audiobook.samples);
    displayACXMetadata(audiobook.metadata);

    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║   TEST COMPLETE ✅                                    ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { getAudiobookAssets, getSpecificAsset, regenerateAudiobookAssets };
