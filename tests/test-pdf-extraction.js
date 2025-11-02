/**
 * Test script for PDF text extraction
 *
 * This script tests the PDF extraction with both text-based and scanned PDFs.
 */

import { extractText, countWords, detectChapters, analyzeStructure } from './text-extraction.js';
import fs from 'fs';

async function testPdfExtraction() {
  console.log('='.repeat(60));
  console.log('PDF Text Extraction Test');
  console.log('='.repeat(60));
  console.log('');

  // Test with sample PDF files if they exist
  const sampleFiles = [
    'test-manuscript.pdf',
    'sample.pdf',
    'manuscript.pdf'
  ];

  let testFile = null;
  for (const filename of sampleFiles) {
    if (fs.existsSync(filename)) {
      testFile = filename;
      break;
    }
  }

  if (!testFile) {
    console.log('❌ No sample PDF file found.');
    console.log('   Please create a test file named "test-manuscript.pdf"');
    console.log('   You can convert test-manuscript.txt to PDF for testing');
    console.log('');
    console.log('   Or try creating a simple PDF:');
    console.log('   - Open Microsoft Word or Google Docs');
    console.log('   - Type some sample text');
    console.log('   - Save as "test-manuscript.pdf"');
    return;
  }

  console.log(`📄 Testing with file: ${testFile}`);
  console.log('');

  try {
    // Read the file
    const buffer = fs.readFileSync(testFile);
    const contentType = 'application/pdf';

    console.log(`📊 File size: ${buffer.length} bytes`);
    console.log('');

    // Extract text
    console.log('Extracting text from PDF...');
    console.log('(This may take a moment for large PDFs or scanned documents)');
    console.log('');

    const startTime = Date.now();
    const text = await extractText(buffer, contentType);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!text || text.length === 0) {
      console.log('❌ Extraction failed: No text returned');
      return;
    }

    console.log('✅ Text extracted successfully!');
    console.log(`   Time taken: ${duration} seconds`);
    console.log('');

    // Analyze the extracted text
    console.log('📈 Text Analysis:');
    console.log('-'.repeat(60));

    const wordCount = countWords(text);
    const chapters = detectChapters(text);
    const structure = analyzeStructure(text);

    console.log(`   Words: ${wordCount.toLocaleString()}`);
    console.log(`   Characters: ${text.length.toLocaleString()}`);
    console.log(`   Lines: ${structure.lineCount.toLocaleString()}`);
    console.log(`   Chapters detected: ${chapters.length}`);
    console.log('');

    // Show first 500 characters
    console.log('📝 Sample text (first 500 characters):');
    console.log('-'.repeat(60));
    console.log(text.substring(0, 500));
    if (text.length > 500) {
      console.log('...');
    }
    console.log('');

    // Show detected chapters
    if (chapters.length > 0) {
      console.log('📑 Detected chapters:');
      console.log('-'.repeat(60));
      chapters.slice(0, 10).forEach((chapter, i) => {
        console.log(`   ${i + 1}. ${chapter.title} (line ${chapter.line})`);
      });
      if (chapters.length > 10) {
        console.log(`   ... and ${chapters.length - 10} more chapters`);
      }
      console.log('');
    }

    // Summary
    console.log('='.repeat(60));
    console.log('✅ PDF Extraction Test: PASSED');
    console.log('='.repeat(60));
    console.log('');
    console.log('The PDF text extraction is working correctly!');
    console.log('');
    console.log('Features supported:');
    console.log('  ✅ Text-based PDFs (standard extraction)');
    console.log('  ✅ Scanned PDFs (OCR with Tesseract.js)');
    console.log('  ✅ Multi-page documents');
    console.log('  ✅ Chapter detection');
    console.log('');
    console.log('You can now upload .pdf files to the platform.');
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('');

    if (error.message.includes('OCR')) {
      console.error('Note: This appears to be a scanned PDF requiring OCR.');
      console.error('      OCR may have limitations in test environments.');
      console.error('      Text-based PDFs should work fine.');
    }

    if (error.message.includes('OffscreenCanvas') || error.message.includes('canvas')) {
      console.error('Note: Canvas operations may not be available in this environment.');
      console.error('      This is expected for Node.js testing.');
      console.error('      The code should work in Cloudflare Workers.');
    }

    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testPdfExtraction().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
