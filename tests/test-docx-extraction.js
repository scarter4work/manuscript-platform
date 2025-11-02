/**
 * Test script for DOCX text extraction
 *
 * This script tests the text-extraction.js utility with a sample DOCX file.
 */

import { extractText, countWords, detectChapters, analyzeStructure } from './text-extraction.js';
import fs from 'fs';
import path from 'path';

async function testDocxExtraction() {
  console.log('='.repeat(60));
  console.log('DOCX Text Extraction Test');
  console.log('='.repeat(60));
  console.log('');

  // Test with a sample DOCX file if it exists
  const sampleFiles = [
    'test-manuscript.docx',
    'sample.docx',
    'manuscript.docx'
  ];

  let testFile = null;
  for (const filename of sampleFiles) {
    if (fs.existsSync(filename)) {
      testFile = filename;
      break;
    }
  }

  if (!testFile) {
    console.log('❌ No sample DOCX file found.');
    console.log('   Please create a test file named "test-manuscript.docx"');
    console.log('   Or run: npm install && node create-sample-docx.js');
    return;
  }

  console.log(`📄 Testing with file: ${testFile}`);
  console.log('');

  try {
    // Read the file
    const buffer = fs.readFileSync(testFile);
    const contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    console.log(`📊 File size: ${buffer.length} bytes`);
    console.log('');

    // Extract text
    console.log('Extracting text...');
    const text = await extractText(buffer, contentType);

    if (!text || text.length === 0) {
      console.log('❌ Extraction failed: No text returned');
      return;
    }

    console.log('✅ Text extracted successfully!');
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
      chapters.forEach((chapter, i) => {
        console.log(`   ${i + 1}. ${chapter.title} (line ${chapter.line})`);
      });
      console.log('');
    }

    // Summary
    console.log('='.repeat(60));
    console.log('✅ DOCX Extraction Test: PASSED');
    console.log('='.repeat(60));
    console.log('');
    console.log('The DOCX text extraction is working correctly!');
    console.log('You can now upload .docx files to the platform.');
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testDocxExtraction().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
