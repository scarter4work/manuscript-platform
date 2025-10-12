/**
 * Test Market Analysis Agent (Phase 2)
 */

import { MarketAnalysisAgent } from './market-analysis-agent.js';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.dev.vars' });

const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not found in .dev.vars');
    process.exit(1);
}

async function testMarketAnalysis() {
    console.log('\n========================================');
    console.log('Testing Market Analysis Agent (Phase 2)');
    console.log('========================================\n');

    try {
        // Step 1: Load sample manuscript
        console.log('1. Loading sample manuscript...');
        const manuscriptText = fs.readFileSync('./sample-manuscript.txt', 'utf-8');
        console.log(`   ✓ Loaded: ${manuscriptText.length} characters\n`);

        // Step 2: Initialize agent
        console.log('2. Initializing Market Analysis Agent...');
        const agent = new MarketAnalysisAgent(API_KEY);
        console.log('   ✓ Agent initialized\n');

        // Step 3: Run market analysis
        console.log('3. Running comprehensive market analysis...');
        console.log('   (This will take 30-60 seconds as it makes multiple Claude API calls)\n');

        const metadata = {
            wordCount: manuscriptText.split(/\s+/).length,
            isSeries: false,
            authorPlatform: 'New author',
            previousBooks: 0
        };

        const result = await agent.analyzeMarket(manuscriptText, metadata);

        console.log(`   ✓ Analysis completed in ${result.metadata.duration}ms\n`);

        // Step 4: Display results
        console.log('4. Market Analysis Results:\n');
        console.log('----------------------------------------');

        console.log('\n📚 GENRE ANALYSIS:');
        console.log(`   Primary Genre: ${result.analysis.genreAnalysis.primaryGenre}`);
        console.log(`   Sub-genres: ${result.analysis.genreAnalysis.subGenres.join(', ')}`);
        console.log(`   Market Position: ${result.analysis.genreAnalysis.marketPosition}`);
        console.log(`   Market Size: ${result.analysis.genreAnalysis.marketSize}`);
        console.log(`   Competition: ${result.analysis.genreAnalysis.competition}`);

        console.log('\n💰 PRICING STRATEGY:');
        console.log(`   Ebook: $${result.analysis.pricingStrategy.ebook.recommended}`);
        console.log(`   Range: $${result.analysis.pricingStrategy.ebook.range.min} - $${result.analysis.pricingStrategy.ebook.range.max}`);
        console.log(`   Paperback: $${result.analysis.pricingStrategy.paperback.recommended}`);
        console.log(`   Launch Price: $${result.analysis.pricingStrategy.launchStrategy.initialPrice} (${result.analysis.pricingStrategy.launchStrategy.duration})`);

        console.log('\n📁 CATEGORY RECOMMENDATIONS:');
        result.analysis.categoryRecommendations.primary.slice(0, 3).forEach((cat, i) => {
            console.log(`   ${i + 1}. ${cat.name}`);
            console.log(`      BISAC: ${cat.bisac}`);
            console.log(`      Competition: ${cat.competitiveness}`);
        });

        console.log('\n🔑 KEYWORD STRATEGY:');
        result.analysis.keywordStrategy.keywords.slice(0, 7).forEach((kw, i) => {
            console.log(`   ${i + 1}. "${kw.phrase}"`);
            console.log(`      Search Volume: ${kw.searchVolume} | Competition: ${kw.competition}`);
        });

        console.log('\n👥 TARGET AUDIENCE:');
        console.log(`   Age Range: ${result.analysis.audienceProfile.primaryAudience.ageRange}`);
        console.log(`   Gender: ${result.analysis.audienceProfile.primaryAudience.gender}`);
        console.log(`   Demographics: ${result.analysis.audienceProfile.primaryAudience.demographics}`);

        console.log('\n🎯 COMPETITIVE POSITIONING:');
        console.log(`   Market Gap: ${result.analysis.competitivePositioning.marketGap.description}`);
        console.log(`   Positioning: ${result.analysis.competitivePositioning.positioningStatement}`);
        console.log(`   Launch Approach: ${result.analysis.competitivePositioning.launchStrategy.approach}`);

        // Step 5: Generate and save report
        console.log('\n5. Generating formatted report...');
        const report = agent.generateReport(result.analysis);

        fs.writeFileSync(
            './test-market-analysis-report.json',
            JSON.stringify(report, null, 2)
        );
        console.log('   ✓ Report saved to: ./test-market-analysis-report.json\n');

        // Step 6: Display summary
        console.log('========================================');
        console.log('✅ Market Analysis Test Complete!');
        console.log('========================================\n');

        console.log('QUICK SUMMARY:');
        console.log(`  Genre: ${report.summary.primaryGenre}`);
        console.log(`  Ebook Price: $${report.summary.recommendedEbookPrice}`);
        console.log(`  Paperback Price: $${report.summary.recommendedPaperbackPrice}`);
        console.log(`  Target Age: ${report.summary.targetDemographic}`);
        console.log(`  Launch: ${report.summary.launchRecommendation}`);
        console.log('\n');

    } catch (error) {
        console.error('\n❌ Test Failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

testMarketAnalysis();
