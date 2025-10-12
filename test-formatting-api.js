/**
 * Test Formatting API Endpoints
 * Tests the /format-manuscript and /download-formatted endpoints
 */

import fs from 'fs';

const API_BASE = 'http://127.0.0.1:8787';

async function testFormattingAPI() {
    console.log('\n========================================');
    console.log('Testing Formatting API Endpoints');
    console.log('========================================\n');

    try {
        // Step 1: Read sample manuscript
        console.log('1. Reading sample manuscript...');
        const manuscriptText = fs.readFileSync('./sample-manuscript.txt', 'utf-8');
        console.log(`   ✓ Loaded manuscript: ${manuscriptText.length} characters\n`);

        // Step 2: Use a mock report ID and manuscript key
        // (In production, this would come from the upload endpoint)
        const reportId = 'test-' + Date.now();
        console.log(`   ✓ Using mock report ID: ${reportId}\n`);

        // Step 3: Test /format-manuscript endpoint
        console.log('3. Testing /format-manuscript endpoint...');
        const formatPayload = {
            reportId: reportId,
            metadata: {
                title: 'Test Novel',
                author: 'John Doe',
                copyrightYear: 2025,
                isbn: '978-1-234-56789-0',
                publisher: 'Test Publisher',
                description: 'A test novel for formatting',
                language: 'en'
            },
            trimSize: '6x9',
            includeBleed: false
        };

        console.log('   Generating EPUB and PDF...');
        const formatResponse = await fetch(`${API_BASE}/format-manuscript`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formatPayload)
        });

        if (!formatResponse.ok) {
            const errorText = await formatResponse.text();
            throw new Error(`Format failed: ${formatResponse.status} ${formatResponse.statusText}\n${errorText}`);
        }

        const formatData = await formatResponse.json();
        console.log('   ✓ Formatting completed successfully');
        console.log(`     - Duration: ${formatData.metadata.duration}ms`);
        console.log(`     - Formats generated: ${formatData.metadata.formatsGenerated}`);
        console.log(`     - Total size: ${Math.round(formatData.metadata.totalSize / 1024)}KB`);

        if (formatData.formats.epub) {
            console.log('\n   EPUB:');
            console.log(`     - Size: ${Math.round(formatData.formats.epub.size / 1024)}KB`);
            console.log(`     - Version: ${formatData.formats.epub.validation.version}`);
            console.log(`     - KDP Compliant: ${formatData.formats.epub.validation.kdpCompliant}`);
        }

        if (formatData.formats.pdf) {
            console.log('\n   PDF:');
            console.log(`     - Size: ${Math.round(formatData.formats.pdf.size / 1024)}KB`);
            console.log(`     - Pages: ${formatData.formats.pdf.pageCount}`);
            console.log(`     - Trim Size: ${formatData.formats.pdf.trimSize}`);
            console.log(`     - KDP Compliant: ${formatData.formats.pdf.validation.kdpCompliant}`);
        }

        // Step 4: Test /download-formatted endpoint (EPUB)
        console.log('\n4. Testing /download-formatted endpoint (EPUB)...');
        const epubResponse = await fetch(`${API_BASE}/download-formatted?id=${reportId}&format=epub`);

        if (!epubResponse.ok) {
            throw new Error(`EPUB download failed: ${epubResponse.status} ${epubResponse.statusText}`);
        }

        const epubBuffer = await epubResponse.arrayBuffer();
        fs.writeFileSync('./test-api-output.epub', Buffer.from(epubBuffer));
        console.log(`   ✓ EPUB downloaded: ${Math.round(epubBuffer.byteLength / 1024)}KB`);
        console.log('   ✓ Saved to: ./test-api-output.epub');

        // Step 5: Test /download-formatted endpoint (PDF)
        console.log('\n5. Testing /download-formatted endpoint (PDF)...');
        const pdfResponse = await fetch(`${API_BASE}/download-formatted?id=${reportId}&format=pdf`);

        if (!pdfResponse.ok) {
            throw new Error(`PDF download failed: ${pdfResponse.status} ${pdfResponse.statusText}`);
        }

        const pdfBuffer = await pdfResponse.arrayBuffer();
        fs.writeFileSync('./test-api-output.pdf', Buffer.from(pdfBuffer));
        console.log(`   ✓ PDF downloaded: ${Math.round(pdfBuffer.byteLength / 1024)}KB`);
        console.log('   ✓ Saved to: ./test-api-output.pdf');

        console.log('\n========================================');
        console.log('✅ All API Tests Passed!');
        console.log('========================================\n');
        console.log('Generated files:');
        console.log('  - test-api-output.epub');
        console.log('  - test-api-output.pdf\n');

    } catch (error) {
        console.error('\n❌ Test Failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

testFormattingAPI();
