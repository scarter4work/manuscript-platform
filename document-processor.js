/**
 * Document Processor - Main Orchestrator (MAN-43)
 *
 * Central pipeline for generating platform-specific export packages
 * Coordinates EPUB, PDF, cover processing, and validation
 */

import { generateEPUB, generateEPUBFromDOCX } from './epub-generator.js';
import { generatePrintPDF, generateInteriorPDF, generateInteriorPDFFromDOCX, TRIM_SIZES } from './pdf-generator.js';
import { calculateSpineWidth, processCoverImage, generatePrintCover, PAPER_TYPES } from './cover-processor.js';
import { validateExportPackage, validateManuscript, validateCover } from './format-validator.js';

/**
 * Generate export package for a platform
 *
 * @param {Object} options - Export generation options
 * @param {string} options.platform - Platform identifier (kdp, d2d, ingramspark, apple_books)
 * @param {string} options.publishType - 'ebook' or 'print'
 * @param {Buffer} options.manuscriptBuffer - Edited manuscript buffer
 * @param {string} options.manuscriptType - Manuscript file type (docx, txt)
 * @param {Buffer} options.coverBuffer - Cover image buffer
 * @param {Object} options.metadata - Book metadata
 * @param {Object} options.formatOptions - Platform-specific format options
 * @returns {Promise<Object>} - Export package with files and validation
 */
export async function generateExportPackage(options) {
  const {
    platform,
    publishType = 'ebook',
    manuscriptBuffer,
    manuscriptType = 'docx',
    coverBuffer,
    metadata = {},
    formatOptions = {},
  } = options;

  console.log(`[DocumentProcessor] Generating ${platform} ${publishType} export package...`);

  const exportPackage = {
    platform,
    publishType,
    timestamp: Date.now(),
    files: {},
    validation: {},
    metadata,
  };

  try {
    // Generate files based on publish type
    if (publishType === 'ebook') {
      await generateEbookPackage(exportPackage, options);
    } else if (publishType === 'print') {
      await generatePrintPackage(exportPackage, options);
    } else {
      throw new Error(`Invalid publish type: ${publishType}`);
    }

    // Validate complete package
    const validation = await validateExportPackage(
      {
        manuscript: exportPackage.files.manuscript ? {
          buffer: exportPackage.files.manuscript,
          type: exportPackage.files.manuscriptType,
        } : null,
        cover: coverBuffer ? { buffer: coverBuffer } : null,
        metadata,
      },
      platform,
      publishType
    );

    exportPackage.validation = validation;

    console.log(`[DocumentProcessor] Export package generated successfully. Valid: ${validation.valid}`);

    return exportPackage;
  } catch (error) {
    console.error(`[DocumentProcessor] Error generating export package:`, error);
    throw error;
  }
}

/**
 * Generate ebook export package
 *
 * @param {Object} exportPackage - Export package object to populate
 * @param {Object} options - Generation options
 */
async function generateEbookPackage(exportPackage, options) {
  const {
    platform,
    manuscriptBuffer,
    manuscriptType,
    coverBuffer,
    metadata,
    formatOptions,
  } = options;

  // Determine output format based on platform
  let outputFormat = 'epub'; // Default

  if (platform === 'kdp' && (formatOptions.preferDOCX || !coverBuffer)) {
    outputFormat = 'docx'; // KDP accepts DOCX directly
  }

  if (platform === 'd2d' && formatOptions.preferDOCX) {
    outputFormat = 'docx'; // D2D accepts DOCX and auto-converts
  }

  if (platform === 'apple_books' || platform === 'ingramspark') {
    outputFormat = 'epub'; // These require EPUB
  }

  console.log(`[DocumentProcessor] Generating ${outputFormat.toUpperCase()} for ${platform}...`);

  // Generate EPUB if needed
  if (outputFormat === 'epub') {
    const epubBuffer = await generateEPUBFromDOCX(manuscriptBuffer, coverBuffer, metadata);

    exportPackage.files.manuscript = epubBuffer;
    exportPackage.files.manuscriptType = 'epub';
    exportPackage.files.manuscriptName = `${metadata.title || 'manuscript'}.epub`;
  } else if (outputFormat === 'docx') {
    // Use original DOCX
    exportPackage.files.manuscript = manuscriptBuffer;
    exportPackage.files.manuscriptType = 'docx';
    exportPackage.files.manuscriptName = `${metadata.title || 'manuscript'}.docx`;
  }

  // Process cover for ebook
  if (coverBuffer) {
    const processedCover = await processCoverImage(coverBuffer, {
      width: formatOptions.coverWidth || 1600,
      height: formatOptions.coverHeight || 2400,
      format: formatOptions.coverFormat || 'jpeg',
      quality: 95,
      removeAlpha: true,
    });

    exportPackage.files.cover = processedCover;
    exportPackage.files.coverType = formatOptions.coverFormat || 'jpeg';
    exportPackage.files.coverName = `cover.${formatOptions.coverFormat || 'jpg'}`;
  }
}

/**
 * Generate print export package
 *
 * @param {Object} exportPackage - Export package object to populate
 * @param {Object} options - Generation options
 */
async function generatePrintPackage(exportPackage, options) {
  const {
    platform,
    manuscriptBuffer,
    coverBuffer,
    metadata,
    formatOptions,
  } = options;

  const {
    trimSize = '6x9',
    pageCount,
    paperType = 'cream_60',
    includeBleed = platform === 'ingramspark',
  } = formatOptions;

  console.log(`[DocumentProcessor] Generating print PDF for ${platform} (${trimSize}, ${pageCount} pages)...`);

  // Generate interior PDF from DOCX
  const interiorPDF = await generateInteriorPDFFromDOCX(platform, manuscriptBuffer, {
    trimSize,
    title: metadata.title,
    author: metadata.author,
    metadata,
  });

  exportPackage.files.interior = interiorPDF;
  exportPackage.files.interiorType = 'pdf';
  exportPackage.files.interiorName = 'interior.pdf';

  // Generate print cover if cover image provided
  if (coverBuffer && pageCount) {
    const trimSizeObj = TRIM_SIZES[trimSize];

    const coverPDF = await generatePrintCover(coverBuffer, null, {
      trimWidth: trimSizeObj.width,
      trimHeight: trimSizeObj.height,
      pageCount,
      paperType,
      bleed: includeBleed ? 9 : 0, // 0.125" = 9 points
    });

    exportPackage.files.cover = coverPDF;
    exportPackage.files.coverType = 'pdf';
    exportPackage.files.coverName = 'cover.pdf';

    // Include spine calculation info
    const spineInfo = calculateSpineWidth(pageCount, paperType);
    exportPackage.spineInfo = spineInfo;
  }
}

/**
 * Process manuscript for multi-platform export
 *
 * @param {Buffer} manuscriptBuffer - Original manuscript buffer
 * @param {Buffer} coverBuffer - Cover image buffer
 * @param {Object} metadata - Book metadata
 * @param {Array<string>} platforms - Platforms to generate packages for
 * @returns {Promise<Object>} - Map of platform -> export package
 */
export async function processForMultiplePlatforms(manuscriptBuffer, coverBuffer, metadata, platforms) {
  console.log(`[DocumentProcessor] Processing manuscript for ${platforms.length} platforms...`);

  const packages = {};

  for (const platform of platforms) {
    try {
      // Determine publish type (ebook for most, print if specified)
      const publishType = metadata.publishType || 'ebook';

      const exportPackage = await generateExportPackage({
        platform,
        publishType,
        manuscriptBuffer,
        manuscriptType: 'docx',
        coverBuffer,
        metadata,
        formatOptions: metadata.formatOptions?.[platform] || {},
      });

      packages[platform] = exportPackage;
    } catch (error) {
      console.error(`[DocumentProcessor] Failed to generate ${platform} package:`, error);
      packages[platform] = {
        error: error.message,
        platform,
      };
    }
  }

  console.log(`[DocumentProcessor] Multi-platform processing complete: ${Object.keys(packages).length} packages`);

  return packages;
}

/**
 * Validate manuscript before processing
 *
 * @param {Buffer} manuscriptBuffer - Manuscript buffer
 * @param {string} manuscriptType - File type
 * @returns {Promise<Object>} - Pre-validation result
 */
export async function preValidateManuscript(manuscriptBuffer, manuscriptType = 'docx') {
  console.log(`[DocumentProcessor] Pre-validating ${manuscriptType} manuscript...`);

  const validation = {
    valid: true,
    errors: [],
    warnings: [],
    info: {},
  };

  // Basic checks
  if (!manuscriptBuffer || manuscriptBuffer.length === 0) {
    validation.errors.push('Manuscript buffer is empty');
    validation.valid = false;
    return validation;
  }

  validation.info.fileSize = manuscriptBuffer.length;
  validation.info.fileSizeMB = (manuscriptBuffer.length / (1024 * 1024)).toFixed(2);

  // File size warnings
  if (manuscriptBuffer.length > 100 * 1024 * 1024) {
    validation.warnings.push('Manuscript is quite large (>100MB), processing may be slow');
  }

  if (manuscriptBuffer.length > 650 * 1024 * 1024) {
    validation.errors.push('Manuscript exceeds 650MB maximum for most platforms');
    validation.valid = false;
  }

  // Type-specific validation
  if (manuscriptType === 'docx') {
    // Check DOCX signature (PK zip header)
    if (manuscriptBuffer[0] !== 0x50 || manuscriptBuffer[1] !== 0x4B) {
      validation.errors.push('File does not appear to be a valid DOCX file');
      validation.valid = false;
    }
  }

  return validation;
}

/**
 * Get supported export formats for a platform
 *
 * @param {string} platform - Platform identifier
 * @param {string} publishType - 'ebook' or 'print'
 * @returns {Array<string>} - Supported formats
 */
export function getSupportedFormats(platform, publishType = 'ebook') {
  const formats = {
    kdp: {
      ebook: ['docx', 'epub', 'html', 'rtf', 'mobi', 'txt'],
      print: ['pdf'],
    },
    d2d: {
      ebook: ['docx', 'rtf', 'epub'],
    },
    ingramspark: {
      ebook: ['epub'],
      print: ['pdf'],
    },
    apple_books: {
      ebook: ['epub'],
    },
  };

  return formats[platform]?.[publishType] || [];
}

export default {
  generateExportPackage,
  processForMultiplePlatforms,
  preValidateManuscript,
  getSupportedFormats,
  TRIM_SIZES,
  PAPER_TYPES,
};
