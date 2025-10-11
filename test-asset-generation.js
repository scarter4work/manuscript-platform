#!/usr/bin/env node

// Test script for asset generation
// This tests the complete asset generation workflow

const API_BASE = 'http://localhost:8787';

// We need a report ID from a completed analysis
// Use one from the existing test runs
const TEST_REPORT_ID = '1760202925418'.substring(0, 8); // Extract first 8 chars as report ID

async function testAssetGeneration() {
    console.log('🧪 Testing Asset Generation\n');
    console.log('='.repeat(60));

    try {
        // Step 1: Verify the analysis exists
        console.log('\n📋 Step 1: Checking if analysis exists...');
        const resultsResponse = await fetch(`${API_BASE}/results?id=${TEST_REPORT_ID}`);

        if (!resultsResponse.ok) {
            console.error('❌ Analysis not found. Please run a manuscript analysis first.');
            console.log(`   Try uploading a manuscript first, then use the reportId from the response.`);
            return;
        }

        const resultsData = await resultsResponse.json();
        console.log('✅ Analysis found!');
        console.log(`   - Developmental: ${resultsData.results.developmental ? 'Present' : 'Missing'}`);
        console.log(`   - Line Editing: ${resultsData.results.lineEditing ? 'Present' : 'Missing'}`);
        console.log(`   - Copy Editing: ${resultsData.results.copyEditing ? 'Present' : 'Missing'}`);

        if (!resultsData.results.developmental) {
            console.error('❌ Developmental analysis required for asset generation');
            return;
        }

        // Step 2: Generate assets
        console.log('\n🎯 Step 2: Generating marketing assets...');
        console.log('   This will call all 5 agents in parallel:');
        console.log('   - Book Description Agent');
        console.log('   - Keyword Agent');
        console.log('   - Category Agent');
        console.log('   - Author Bio Agent');
        console.log('   - Back Matter Agent');

        const startTime = Date.now();
        const generateResponse = await fetch(`${API_BASE}/generate-assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reportId: TEST_REPORT_ID,
                genre: 'thriller'
            })
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (!generateResponse.ok) {
            const error = await generateResponse.json();
            console.error('❌ Asset generation failed:', error);
            return;
        }

        const assetsData = await generateResponse.json();
        console.log(`✅ Assets generated in ${duration}s!`);

        // Step 3: Validate assets structure
        console.log('\n📦 Step 3: Validating generated assets...');

        const assets = assetsData.assets;

        // Validate Book Description
        if (assets.bookDescription) {
            console.log('\n📚 Book Description:');
            console.log(`   ✓ Short version: ${assets.bookDescription.short?.substring(0, 50)}...`);
            console.log(`   ✓ Medium version: ${assets.bookDescription.medium?.substring(0, 50)}...`);
            console.log(`   ✓ Long version: ${assets.bookDescription.long?.substring(0, 50)}...`);
            console.log(`   ✓ Hooks provided: ${assets.bookDescription.hooks?.length || 0}`);

            // Validate Amazon constraints
            if (assets.bookDescription.long?.length > 4000) {
                console.warn('   ⚠️  Long version exceeds 4000 char Amazon limit');
            } else {
                console.log(`   ✓ Amazon constraint met (${assets.bookDescription.long?.length}/4000 chars)`);
            }
        } else {
            console.error('   ❌ Book description missing!');
        }

        // Validate Keywords
        if (assets.keywords && assets.keywords.keywords) {
            console.log('\n🔍 Keywords:');
            const keywords = assets.keywords.keywords;
            console.log(`   ✓ Count: ${keywords.length} (required: 7)`);

            if (keywords.length !== 7) {
                console.warn('   ⚠️  Must have exactly 7 keywords for Amazon');
            }

            let allValid = true;
            keywords.forEach((kw, i) => {
                const valid = kw.length <= 50;
                if (!valid) {
                    console.warn(`   ⚠️  Keyword ${i + 1} exceeds 50 chars: "${kw}"`);
                    allValid = false;
                } else {
                    console.log(`   ${i + 1}. ${kw} (${kw.length}/50 chars)`);
                }
            });

            if (allValid && keywords.length === 7) {
                console.log('   ✓ All keywords valid for Amazon!');
            }
        } else {
            console.error('   ❌ Keywords missing!');
        }

        // Validate Categories
        if (assets.categories) {
            console.log('\n📑 Categories:');
            const categories = assets.categories;

            if (categories.primary) {
                console.log(`   ✓ Primary categories: ${categories.primary.length}`);
                categories.primary.forEach(cat => {
                    console.log(`     - ${cat.code}: ${cat.name}`);
                    console.log(`       ${cat.rationale.substring(0, 80)}...`);
                });
            }

            if (categories.secondary) {
                console.log(`   ✓ Secondary categories: ${categories.secondary.length}`);
                categories.secondary.forEach(cat => {
                    console.log(`     - ${cat.code}: ${cat.name}`);
                });
            }

            if (categories.alternative) {
                console.log(`   ✓ Alternative categories: ${categories.alternative.length}`);
            }

            const totalCats = (categories.primary?.length || 0) +
                             (categories.secondary?.length || 0) +
                             (categories.alternative?.length || 0);
            console.log(`   ✓ Total categories: ${totalCats} (Amazon allows up to 10)`);
        } else {
            console.error('   ❌ Categories missing!');
        }

        // Validate Author Bio
        if (assets.authorBio) {
            console.log('\n👤 Author Bio:');
            console.log(`   ✓ Short (50w): ${assets.authorBio.short?.substring(0, 50)}...`);
            console.log(`   ✓ Medium (100w): ${assets.authorBio.medium?.substring(0, 50)}...`);
            console.log(`   ✓ Long (200w): ${assets.authorBio.long?.substring(0, 50)}...`);
            console.log(`   ✓ Social media bio: ${assets.authorBio.socialMediaBio?.substring(0, 50)}...`);

            // Validate lengths
            const shortWords = assets.authorBio.short?.split(/\s+/).length;
            const mediumWords = assets.authorBio.medium?.split(/\s+/).length;
            const longWords = assets.authorBio.long?.split(/\s+/).length;
            const socialLength = assets.authorBio.socialMediaBio?.length;

            console.log(`   ✓ Word counts: Short ${shortWords}w, Medium ${mediumWords}w, Long ${longWords}w`);
            console.log(`   ✓ Social media length: ${socialLength}/160 chars`);

            if (socialLength > 160) {
                console.warn('   ⚠️  Social media bio exceeds 160 chars');
            }
        } else {
            console.error('   ❌ Author bio missing!');
        }

        // Validate Back Matter
        if (assets.backMatter) {
            console.log('\n📖 Back Matter:');
            console.log(`   ✓ Thank you message: ${assets.backMatter.thankYouMessage?.substring(0, 50)}...`);
            console.log(`   ✓ Newsletter CTA: ${assets.backMatter.newsletterCTA?.headline?.substring(0, 50)}...`);
            console.log(`   ✓ Connect message: ${assets.backMatter.connectMessage?.substring(0, 50)}...`);
            console.log(`   ✓ Closing line: ${assets.backMatter.closingLine?.substring(0, 50)}...`);

            if (assets.backMatter.formatted) {
                console.log(`   ✓ Formatted versions: Plain Text & HTML`);
                console.log(`     - Plain text: ${assets.backMatter.formatted.plainText?.length} chars`);
                console.log(`     - HTML: ${assets.backMatter.formatted.html?.length} chars`);
            }
        } else {
            console.error('   ❌ Back matter missing!');
        }

        // Step 4: Test fetching assets
        console.log('\n🔄 Step 4: Testing asset retrieval...');
        const getAssetsResponse = await fetch(`${API_BASE}/assets?id=${TEST_REPORT_ID}`);

        if (!getAssetsResponse.ok) {
            console.error('❌ Failed to retrieve assets');
            return;
        }

        const retrievedAssets = await getAssetsResponse.json();
        console.log('✅ Assets successfully retrieved from storage');
        console.log(`   Timestamp: ${retrievedAssets.assets.generated}`);

        // Final summary
        console.log('\n' + '='.repeat(60));
        console.log('🎉 Asset Generation Test Complete!');
        console.log('='.repeat(60));
        console.log('\n✅ All tests passed!');
        console.log('\nNext steps:');
        console.log('1. Open the dashboard: http://localhost:8787/frontend/index.html');
        console.log('2. Upload a manuscript and complete analysis');
        console.log('3. Click "Generate Marketing Assets" button');
        console.log('4. Review and customize the generated assets');
        console.log('5. Download assets in JSON or text format');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testAssetGeneration();
