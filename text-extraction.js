/**
 * Text Extraction Utilities
 *
 * Provides text extraction from various file formats:
 * - Plain text (.txt) - Full support
 * - Microsoft Word (.docx) - Full support
 * - PDF (.pdf) - Limited support (recommend converting to .docx)
 * - EPUB (.epub) - Planned
 */

import mammoth from 'mammoth';

/**
 * Extract text from manuscript buffer based on content type
 * @param {ArrayBuffer} buffer - File buffer
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} Extracted text content
 */
export async function extractText(buffer, contentType) {
  switch(contentType) {
    case 'text/plain':
      return extractFromPlainText(buffer);

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractFromDOCX(buffer);

    case 'application/msword': // Old .doc format
      // Note: mammoth doesn't support old .doc format
      throw new Error('Legacy .doc format not supported. Please save as .docx');

    case 'application/pdf':
      return extractFromPDF(buffer);

    case 'application/epub+zip':
      return extractFromEPUB(buffer);

    default:
      throw new Error(`Unsupported file type: ${contentType}. Supported formats: .txt, .docx, .pdf, .epub`);
  }
}

/**
 * Extract text from plain text file
 */
function extractFromPlainText(buffer) {
  return new TextDecoder('utf-8').decode(buffer);
}

/**
 * Extract text from DOCX file using mammoth
 * Preserves paragraph structure and basic formatting
 */
async function extractFromDOCX(buffer) {
  try {
    // mammoth expects a Buffer or ArrayBuffer
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });

    if (!result.value) {
      throw new Error('No text content found in DOCX file');
    }

    // Log any conversion warnings (optional)
    if (result.messages && result.messages.length > 0) {
      console.log('[DOCX Extraction] Warnings:', result.messages);
    }

    return result.value;
  } catch (error) {
    console.error('[DOCX Extraction] Error:', error);
    throw new Error(`Failed to extract text from DOCX: ${error.message}`);
  }
}

/**
 * Extract text from PDF file
 *
 * Note: PDF text extraction in serverless environments has technical limitations.
 * We recommend converting PDFs to .docx format for best results.
 */
async function extractFromPDF(buffer) {
  console.log('[PDF Extraction] PDF upload detected');

  // PDF extraction in Cloudflare Workers faces technical challenges:
  // 1. PDF.js requires browser APIs (DOMMatrix, Canvas) not available in Workers
  // 2. pdf-parse has module compatibility issues with Workers
  // 3. OCR libraries require large data files and Canvas APIs
  //
  // For reliable manuscript analysis, we recommend .docx format which provides:
  // - Full text extraction with formatting preservation
  // - Faster processing
  // - Better compatibility
  // - More reliable results

  throw new Error(
    'PDF format is not fully supported for manuscript analysis. ' +
    'For best results, please convert your PDF to Microsoft Word format:\n\n' +
    '📄 How to convert:\n' +
    '1. Open your PDF in Microsoft Word (File → Open)\n' +
    '2. Word will automatically convert it\n' +
    '3. Save as .docx (File → Save As)\n' +
    '4. Upload the .docx file here\n\n' +
    '💡 Alternative tools:\n' +
    '   • Adobe Acrobat: Export to Word\n' +
    '   • Google Docs: Open PDF, Download as .docx\n' +
    '   • Online converters: smallpdf.com, ilovepdf.com\n\n' +
    '✨ Why .docx is better:\n' +
    '   • Preserves formatting and structure\n' +
    '   • Faster and more reliable analysis\n' +
    '   • Better chapter detection\n' +
    '   • Full feature support'
  );
}

/**
 * Extract text from EPUB file
 * Note: This is a placeholder. For production, use epub parser
 */
async function extractFromEPUB(buffer) {
  // TODO: Implement EPUB extraction
  // Options:
  // 1. epub-parser: npm install epub-parser
  // 2. Extract and parse XHTML files from ZIP

  throw new Error('EPUB extraction not yet implemented. Please convert to .docx or .txt format.');
}

/**
 * Estimate word count from text
 */
export function countWords(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Split on whitespace and filter empty strings
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

/**
 * Detect chapters in manuscript text
 * Returns array of chapter start positions
 */
export function detectChapters(text) {
  const chapterPatterns = [
    /^chapter\s+\d+/im,
    /^chapter\s+[ivxlcdm]+/im, // Roman numerals
    /^\d+\.\s/m, // "1. Chapter Title"
    /^part\s+\d+/im,
  ];

  const chapters = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    for (const pattern of chapterPatterns) {
      if (pattern.test(line)) {
        chapters.push({
          line: i,
          title: line,
          position: text.indexOf(lines[i])
        });
        break;
      }
    }
  }

  return chapters;
}

/**
 * Extract metadata from document structure
 */
export function analyzeStructure(text) {
  const chapters = detectChapters(text);
  const wordCount = countWords(text);
  const lineCount = text.split('\n').length;
  const charCount = text.length;

  return {
    wordCount,
    charCount,
    lineCount,
    chapterCount: chapters.length,
    chapters,
    avgWordsPerChapter: chapters.length > 0 ? Math.floor(wordCount / chapters.length) : wordCount
  };
}
