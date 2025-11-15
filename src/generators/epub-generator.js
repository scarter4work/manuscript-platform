/**
 * EPUB Generator (MAN-43)
 *
 * Generates EPUB files from edited manuscripts for ebook distribution
 * Uses JSZip to manually assemble EPUB structure (Workers-compatible)
 */

import JSZip from 'jszip';
import mammoth from 'mammoth';
import crypto from 'crypto';

/**
 * Parse DOCX content to extract chapters and metadata
 *
 * @param {Buffer} docxBuffer - DOCX file buffer
 * @returns {Promise<Object>} - Parsed content with chapters and HTML
 */
async function parseDocxContent(docxBuffer) {
  try {
    const result = await mammoth.convertToHtml({ buffer: docxBuffer });

    // Split content by chapter headings (h1, h2, or "Chapter" text)
    const html = result.value;
    const chapters = [];

    // Simple chapter splitting - split by <h1> tags
    const h1Regex = /<h1[^>]*>(.*?)<\/h1>/gi;
    const parts = html.split(h1Regex);

    if (parts.length > 1) {
      // Has chapter headings
      for (let i = 1; i < parts.length; i += 2) {
        const title = parts[i].replace(/<[^>]*>/g, '').trim() || `Chapter ${Math.floor(i / 2) + 1}`;
        const content = parts[i + 1] || '';
        chapters.push({ title, content });
      }
    } else {
      // No chapter headings, treat as single chapter
      chapters.push({
        title: 'Chapter 1',
        content: html
      });
    }

    return { chapters };
  } catch (error) {
    console.error('[EPUB] Error parsing DOCX:', error);
    // Fallback to basic chapter structure
    return {
      chapters: [{
        title: 'Chapter 1',
        content: '<p>Content extracted from manuscript.</p>'
      }]
    };
  }
}

/**
 * Generate EPUB from manuscript content
 *
 * @param {Object} options - EPUB generation options
 * @param {string} options.title - Book title
 * @param {string} options.author - Author name
 * @param {string} options.description - Book description
 * @param {string} options.publisher - Publisher name
 * @param {string} options.language - Language code (default: 'en')
 * @param {Buffer} options.cover - Cover image buffer
 * @param {Array<Object>} options.chapters - Array of {title, content} objects
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<Buffer>} - EPUB file buffer
 */
export async function generateEPUB(options) {
  const {
    title = 'Untitled',
    author = 'Unknown Author',
    description = '',
    publisher = 'ManuscriptHub',
    language = 'en',
    cover = null,
    chapters = [],
    metadata = {},
  } = options;

  const zip = new JSZip();
  const uuid = crypto.randomUUID();

  // 1. Add mimetype file (MUST be first and uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. Add META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.file('META-INF/container.xml', containerXml);

  // 3. Add cover image if provided
  let coverImagePath = null;
  if (cover) {
    coverImagePath = 'OEBPS/images/cover.jpg';
    zip.file(coverImagePath, cover);
  }

  // 4. Generate content.opf (package document)
  const manifestItems = chapters.map((ch, i) =>
    `    <item id="chapter${i + 1}" href="chapter${i + 1}.xhtml" media-type="application/xhtml+xml"/>`
  ).join('\n');

  const spineItems = chapters.map((ch, i) =>
    `    <itemref idref="chapter${i + 1}"/>`
  ).join('\n');

  const coverManifest = cover ? `    <item id="cover-image" href="images/cover.jpg" media-type="image/jpeg"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>` : '';

  const coverSpine = cover ? `    <itemref idref="cover"/>` : '';

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>${language}</dc:language>
    <dc:publisher>${escapeXml(publisher)}</dc:publisher>
    ${description ? `<dc:description>${escapeXml(description)}</dc:description>` : ''}
    <meta property="dcterms:modified">${new Date().toISOString().split('.')[0]}Z</meta>
    ${cover ? `<meta name="cover" content="cover-image"/>` : ''}
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${coverManifest}
${manifestItems}
  </manifest>
  <spine toc="ncx">
${coverSpine}
${spineItems}
  </spine>
</package>`;
  zip.file('OEBPS/content.opf', contentOpf);

  // 5. Generate toc.ncx (navigation)
  const navPoints = chapters.map((ch, i) => `    <navPoint id="chapter${i + 1}" playOrder="${i + 1}">
      <navLabel>
        <text>${escapeXml(ch.title)}</text>
      </navLabel>
      <content src="chapter${i + 1}.xhtml"/>
    </navPoint>`).join('\n');

  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(title)}</text>
  </docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
  zip.file('OEBPS/toc.ncx', tocNcx);

  // 6. Generate cover page if cover provided
  if (cover) {
    const coverXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Cover</title>
  <style type="text/css">
    body { margin: 0; padding: 0; text-align: center; }
    img { max-width: 100%; max-height: 100%; }
  </style>
</head>
<body>
  <img src="images/cover.jpg" alt="Cover"/>
</body>
</html>`;
    zip.file('OEBPS/cover.xhtml', coverXhtml);
  }

  // 7. Generate chapter files
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const chapterXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(chapter.title)}</title>
  <style type="text/css">
    body { font-family: serif; margin: 2em; line-height: 1.6; }
    h1 { text-align: center; margin-bottom: 2em; }
    p { text-indent: 1.5em; margin: 0; }
    p:first-of-type { text-indent: 0; }
  </style>
</head>
<body>
  <h1>${escapeXml(chapter.title)}</h1>
  ${chapter.content}
</body>
</html>`;
    zip.file(`OEBPS/chapter${i + 1}.xhtml`, chapterXhtml);
  }

  // 8. Generate EPUB file
  const epubBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  console.log(`[EPUB] Generated EPUB: ${epubBuffer.length} bytes, ${chapters.length} chapters`);
  return epubBuffer;
}

/**
 * Generate EPUB from DOCX file
 *
 * @param {Buffer} docxBuffer - DOCX file buffer
 * @param {Buffer} coverBuffer - Cover image buffer (optional)
 * @param {Object} metadata - Book metadata
 * @returns {Promise<Buffer>} - EPUB file buffer
 */
export async function generateEPUBFromDOCX(docxBuffer, coverBuffer, metadata = {}) {
  console.log('[EPUB] Generating EPUB from DOCX...');

  // Parse DOCX to extract chapters
  const parsed = await parseDocxContent(docxBuffer);

  // Generate EPUB
  return await generateEPUB({
    title: metadata.title || 'Untitled',
    author: metadata.author || 'Unknown Author',
    description: metadata.description || '',
    publisher: metadata.publisher || 'ManuscriptHub',
    language: metadata.language || 'en',
    cover: coverBuffer,
    chapters: parsed.chapters,
    metadata,
  });
}

/**
 * Validate EPUB file
 *
 * @param {Buffer} epubBuffer - EPUB file buffer
 * @returns {Promise<Object>} - Validation result
 */
export async function validateEPUB(epubBuffer) {
  const validation = {
    valid: true,
    errors: [],
    warnings: [],
    info: {},
  };

  try {
    // Basic ZIP validation
    const zip = await JSZip.loadAsync(epubBuffer);

    // Check for required files
    const requiredFiles = ['mimetype', 'META-INF/container.xml'];
    for (const file of requiredFiles) {
      if (!zip.files[file]) {
        validation.errors.push(`Missing required file: ${file}`);
        validation.valid = false;
      }
    }

    // Check mimetype content
    if (zip.files['mimetype']) {
      const mimetypeContent = await zip.files['mimetype'].async('string');
      if (mimetypeContent !== 'application/epub+zip') {
        validation.errors.push('Invalid mimetype content');
        validation.valid = false;
      }
    }

    validation.info.fileSize = epubBuffer.length;
    validation.info.fileSizeMB = (epubBuffer.length / (1024 * 1024)).toFixed(2);
    validation.info.fileCount = Object.keys(zip.files).length;

    // File size warnings
    if (epubBuffer.length > 100 * 1024 * 1024) {
      validation.warnings.push('EPUB is quite large (>100MB)');
    }

    if (epubBuffer.length > 650 * 1024 * 1024) {
      validation.errors.push('EPUB exceeds 650MB maximum for most platforms');
      validation.valid = false;
    }

  } catch (error) {
    validation.valid = false;
    validation.errors.push(`Failed to validate EPUB: ${error.message}`);
  }

  return validation;
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default {
  generateEPUB,
  generateEPUBFromDOCX,
  validateEPUB,
};
