/**
 * Text Extraction Utilities
 *
 * Provides text extraction from various file formats:
 * - Plain text (.txt) - Full support
 * - Microsoft Word (.docx) - Full support
 * - PDF (.pdf) - Limited support (recommend converting to .docx)
 * - EPUB (.epub) - Full support
 */

import mammoth from 'mammoth';
import JSZip from 'jszip';

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
 * EPUB files are ZIP archives containing XHTML files
 */
async function extractFromEPUB(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    let fullText = '';
    let chapterCount = 0;

    // Find and parse content.opf to get reading order
    const opfFile = Object.keys(zip.files).find(name => name.endsWith('.opf'));
    let spine = [];

    if (opfFile) {
      const opfContent = await zip.files[opfFile].async('string');
      spine = parseSpineFromOPF(opfContent);
    }

    // Extract text from all HTML/XHTML files
    const contentFiles = Object.keys(zip.files).filter(name =>
      name.match(/\.(xhtml|html|htm)$/i) && !name.startsWith('__MACOSX')
    );

    // Sort by spine order if available, otherwise by filename
    const filesToProcess = spine.length > 0
      ? spine.filter(f => contentFiles.includes(f))
      : contentFiles.sort();

    for (const filename of filesToProcess) {
      if (zip.files[filename] && !zip.files[filename].dir) {
        const content = await zip.files[filename].async('string');
        const text = stripHTMLTags(content);

        if (text.trim().length > 100) { // Filter out very short files (metadata, etc.)
          fullText += text + '\n\n';
          chapterCount++;
        }
      }
    }

    if (!fullText.trim()) {
      throw new Error('No text content found in EPUB file');
    }

    const wordCount = countWords(fullText);

    console.log(`[EPUB Extraction] Successfully extracted ${wordCount} words from ${chapterCount} chapters`);

    return fullText;
  } catch (error) {
    console.error('[EPUB Extraction] Error:', error);

    if (error.message.includes('encrypted') || error.message.includes('DRM')) {
      throw new Error('This EPUB file appears to be DRM-protected. Please upload a DRM-free version.');
    }

    throw new Error(`Failed to extract text from EPUB: ${error.message}`);
  }
}

/**
 * Parse spine (reading order) from OPF file
 */
function parseSpineFromOPF(opfContent) {
  const spine = [];
  const spineMatch = opfContent.match(/<spine[^>]*>([\s\S]*?)<\/spine>/i);

  if (spineMatch) {
    const itemrefRegex = /<itemref[^>]*idref=["']([^"']+)["']/gi;
    let match;

    while ((match = itemrefRegex.exec(spineMatch[1])) !== null) {
      spine.push(match[1]);
    }

    // Map idrefs to actual file paths
    const manifestItems = {};
    const manifestMatch = opfContent.match(/<manifest[^>]*>([\s\S]*?)<\/manifest>/i);

    if (manifestMatch) {
      const itemRegex = /<item[^>]*id=["']([^"']+)["'][^>]*href=["']([^"']+)["']/gi;
      let itemMatch;

      while ((itemMatch = itemRegex.exec(manifestMatch[1])) !== null) {
        manifestItems[itemMatch[1]] = itemMatch[2];
      }
    }

    return spine.map(id => manifestItems[id]).filter(Boolean);
  }

  return [];
}

/**
 * Strip HTML tags and extract plain text
 */
function stripHTMLTags(html) {
  // Remove script and style tags entirely
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Replace common block elements with newlines
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n');

  // Remove all other HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&apos;/g, "'");
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));

  // Clean up whitespace
  text = text.replace(/\n\s*\n/g, '\n\n'); // Multiple newlines to double newline
  text = text.replace(/[ \t]+/g, ' '); // Multiple spaces to single space
  text = text.trim();

  return text;
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
