/**
 * EPUB Generator (MAN-43)
 *
 * Generates EPUB files from edited manuscripts for ebook distribution
 */

import Epub from 'epub-gen-memory';
import { Document, Packer, Paragraph, TextRun } from 'docx';

/**
 * Parse DOCX content to extract chapters and metadata
 *
 * @param {Buffer} docxBuffer - DOCX file buffer
 * @returns {Promise<Object>} - Parsed content with chapters and metadata
 */
async function parseDocxContent(docxBuffer) {
  // For now, return a simple structure
  // In production, use mammoth or similar to properly parse DOCX
  return {
    title: 'Manuscript',
    author: 'Author',
    chapters: [
      {
        title: 'Chapter 1',
        content: '<p>Chapter content will be extracted from DOCX here.</p>',
      },
    ],
  };
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
    title,
    author,
    description = '',
    publisher = 'ManuscriptHub',
    language = 'en',
    cover = null,
    chapters = [],
    metadata = {},
  } = options;

  // Validate required fields
  if (!title || !author) {
    throw new Error('Title and author are required for EPUB generation');
  }

  if (chapters.length === 0) {
    throw new Error('At least one chapter is required for EPUB generation');
  }

  // Prepare EPUB options
  const epubOptions = {
    title,
    author,
    publisher,
    description,
    language,
    tocTitle: 'Table of Contents',
    appendChapterTitles: true,
    date: metadata.publicationDate || new Date().toISOString(),
    version: 3, // EPUB 3.0
  };

  // Add cover if provided
  if (cover) {
    epubOptions.cover = cover;
  }

  // Format chapters for epub-gen
  const formattedChapters = chapters.map((chapter, index) => ({
    title: chapter.title || `Chapter ${index + 1}`,
    data: chapter.content || '',
    excludeFromToc: chapter.excludeFromToc || false,
    beforeToc: chapter.beforeToc || false, // For front matter
  }));

  // Add front matter if provided
  if (metadata.dedication) {
    formattedChapters.unshift({
      title: 'Dedication',
      data: `<div class="dedication">${metadata.dedication}</div>`,
      beforeToc: true,
    });
  }

  if (metadata.foreword) {
    formattedChapters.unshift({
      title: 'Foreword',
      data: `<div class="foreword">${metadata.foreword}</div>`,
      beforeToc: true,
    });
  }

  // Add back matter if provided
  if (metadata.acknowledgments) {
    formattedChapters.push({
      title: 'Acknowledgments',
      data: `<div class="acknowledgments">${metadata.acknowledgments}</div>`,
      excludeFromToc: false,
    });
  }

  if (metadata.aboutAuthor) {
    formattedChapters.push({
      title: 'About the Author',
      data: `<div class="about-author">${metadata.aboutAuthor}</div>`,
      excludeFromToc: false,
    });
  }

  // Custom CSS for better formatting
  const css = `
    body {
      font-family: "Georgia", "Times New Roman", serif;
      font-size: 1em;
      line-height: 1.6;
      margin: 0;
      padding: 1em;
    }

    h1 {
      font-size: 2em;
      font-weight: bold;
      margin-top: 2em;
      margin-bottom: 1em;
      text-align: center;
      page-break-before: always;
    }

    h2 {
      font-size: 1.5em;
      font-weight: bold;
      margin-top: 1.5em;
      margin-bottom: 0.75em;
    }

    p {
      margin: 0;
      text-indent: 1.5em;
      margin-bottom: 0.5em;
    }

    p.first {
      text-indent: 0;
    }

    .dedication, .foreword, .acknowledgments, .about-author {
      margin-top: 2em;
      text-align: center;
      font-style: italic;
    }

    .chapter-break {
      page-break-after: always;
    }
  `;

  epubOptions.css = css;
  epubOptions.content = formattedChapters;

  try {
    // Generate EPUB
    console.log(`[EPUBGenerator] Generating EPUB for "${title}" by ${author}...`);

    const epubBuffer = await new Epub(epubOptions, cover).genEpub();

    console.log(`[EPUBGenerator] EPUB generated successfully: ${epubBuffer.length} bytes`);

    return epubBuffer;
  } catch (error) {
    console.error('[EPUBGenerator] Error generating EPUB:', error);
    throw new Error(`Failed to generate EPUB: ${error.message}`);
  }
}

/**
 * Generate EPUB from DOCX manuscript
 *
 * @param {Buffer} docxBuffer - DOCX file buffer
 * @param {Buffer} coverBuffer - Cover image buffer
 * @param {Object} metadata - Book metadata
 * @returns {Promise<Buffer>} - EPUB file buffer
 */
export async function generateEPUBFromDOCX(docxBuffer, coverBuffer, metadata = {}) {
  // Parse DOCX to extract chapters
  const parsed = await parseDocxContent(docxBuffer);

  // Generate EPUB
  return await generateEPUB({
    title: metadata.title || parsed.title,
    author: metadata.author || parsed.author,
    description: metadata.description || '',
    cover: coverBuffer,
    chapters: parsed.chapters,
    metadata,
  });
}

/**
 * Validate EPUB structure (basic checks)
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

  // Basic file size check
  if (!epubBuffer || epubBuffer.length === 0) {
    validation.valid = false;
    validation.errors.push('EPUB buffer is empty');
    return validation;
  }

  validation.info.fileSize = epubBuffer.length;
  validation.info.fileSizeMB = (epubBuffer.length / (1024 * 1024)).toFixed(2);

  // Check minimum size (valid EPUB should be at least a few KB)
  if (epubBuffer.length < 1000) {
    validation.valid = false;
    validation.errors.push('EPUB file size too small, likely corrupt');
  }

  // Check magic number (ZIP file signature: PK)
  if (epubBuffer[0] !== 0x50 || epubBuffer[1] !== 0x4B) {
    validation.valid = false;
    validation.errors.push('Invalid EPUB file: not a valid ZIP archive');
  }

  // Size warnings
  if (epubBuffer.length > 50 * 1024 * 1024) {
    validation.warnings.push('EPUB file is quite large (>50MB), may have compatibility issues');
  }

  return validation;
}

export default {
  generateEPUB,
  generateEPUBFromDOCX,
  validateEPUB,
};
