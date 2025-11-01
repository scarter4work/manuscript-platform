/**
 * PDF Generator (MAN-43)
 *
 * Generates print-ready PDFs with proper margins, bleeds, and trim sizes
 * for platforms like IngramSpark and Amazon KDP Print
 */

import PDFDocument from 'pdfkit';

/**
 * Standard trim sizes in points (72 points = 1 inch)
 */
export const TRIM_SIZES = {
  '5x8': { width: 5 * 72, height: 8 * 72, name: '5" x 8"' },
  '5.25x8': { width: 5.25 * 72, height: 8 * 72, name: '5.25" x 8"' },
  '5.5x8.5': { width: 5.5 * 72, height: 8.5 * 72, name: '5.5" x 8.5"' },
  '6x9': { width: 6 * 72, height: 9 * 72, name: '6" x 9"' },
  '6.14x9.21': { width: 6.14 * 72, height: 9.21 * 72, name: '6.14" x 9.21" (A5)' },
  '7x10': { width: 7 * 72, height: 10 * 72, name: '7" x 10"' },
  '8x10': { width: 8 * 72, height: 10 * 72, name: '8" x 10"' },
  '8.5x11': { width: 8.5 * 72, height: 11 * 72, name: '8.5" x 11" (Letter)' },
};

/**
 * Calculate page margins based on trim size and bleed
 *
 * @param {Object} trimSize - Trim size object
 * @param {number} bleed - Bleed amount in points (default: 0.125" = 9pts)
 * @returns {Object} - Margin specifications
 */
function calculateMargins(trimSize, bleed = 9) {
  // Standard margins for print books
  const baseMargin = {
    top: 0.75 * 72, // 0.75 inches
    bottom: 0.75 * 72,
    left: 1 * 72, // 1 inch for binding
    right: 0.75 * 72,
  };

  // Adjust for bleed if specified
  if (bleed > 0) {
    return {
      top: baseMargin.top + bleed,
      bottom: baseMargin.bottom + bleed,
      left: baseMargin.left + bleed,
      right: baseMargin.right + bleed,
    };
  }

  return baseMargin;
}

/**
 * Generate print-ready PDF from manuscript content
 *
 * @param {Object} options - PDF generation options
 * @param {string} options.trimSize - Trim size key (e.g., '6x9')
 * @param {string} options.title - Book title
 * @param {string} options.author - Author name
 * @param {Array<Object>} options.chapters - Array of {title, content} objects
 * @param {number} options.bleed - Bleed amount in points (0 for no bleed)
 * @param {Object} options.metadata - Additional metadata
 * @param {boolean} options.includeBleedMarks - Include crop/bleed marks
 * @returns {Promise<Buffer>} - PDF file buffer
 */
export async function generatePrintPDF(options) {
  const {
    trimSize = '6x9',
    title,
    author,
    chapters = [],
    bleed = 0, // No bleed by default
    metadata = {},
    includeBleedMarks = false,
  } = options;

  // Validate trim size
  if (!TRIM_SIZES[trimSize]) {
    throw new Error(`Invalid trim size: ${trimSize}. Available: ${Object.keys(TRIM_SIZES).join(', ')}`);
  }

  const size = TRIM_SIZES[trimSize];
  const margins = calculateMargins(size, bleed);

  // Calculate page size with bleed
  const pageWidth = size.width + (bleed * 2);
  const pageHeight = size.height + (bleed * 2);

  return new Promise((resolve, reject) => {
    const chunks = [];

    // Create PDF document
    const doc = new PDFDocument({
      size: [pageWidth, pageHeight],
      margins,
      info: {
        Title: title,
        Author: author,
        Creator: 'ManuscriptHub PDF Generator',
        Producer: 'ManuscriptHub',
        CreationDate: new Date(),
      },
      autoFirstPage: false, // We'll manually add pages for better control
    });

    // Collect PDF data
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    try {
      // Add title page
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(24);
      doc.text(title, {
        align: 'center',
        valign: 'center',
      });

      doc.moveDown(2);

      doc.font('Helvetica').fontSize(16);
      doc.text(`by ${author}`, {
        align: 'center',
      });

      // Add copyright page
      doc.addPage();
      doc.font('Helvetica').fontSize(10);

      const copyrightText = metadata.copyright ||
        `Copyright © ${new Date().getFullYear()} ${author}\nAll rights reserved.`;

      doc.text(copyrightText, {
        align: 'center',
      });

      if (metadata.isbn) {
        doc.moveDown(2);
        doc.text(`ISBN: ${metadata.isbn}`, {
          align: 'center',
        });
      }

      // Add table of contents if requested
      if (metadata.includeTOC && chapters.length > 0) {
        doc.addPage();
        doc.font('Helvetica-Bold').fontSize(18);
        doc.text('Contents', {
          align: 'center',
        });

        doc.moveDown(2);
        doc.font('Helvetica').fontSize(12);

        chapters.forEach((chapter, index) => {
          if (!chapter.excludeFromTOC) {
            doc.text(`${chapter.title || `Chapter ${index + 1}`}`, {
              continued: true,
            });
            doc.text(`..... ${index + 3}`, {
              align: 'right',
            });
          }
        });
      }

      // Add chapters
      chapters.forEach((chapter, index) => {
        doc.addPage();

        // Chapter title
        doc.font('Helvetica-Bold').fontSize(18);
        doc.text(chapter.title || `Chapter ${index + 1}`, {
          align: 'center',
        });

        doc.moveDown(2);

        // Chapter content
        doc.font('Times-Roman').fontSize(12);

        // Split content by paragraphs
        const paragraphs = (chapter.content || '').split('\n\n');

        paragraphs.forEach((paragraph, pIndex) => {
          if (paragraph.trim()) {
            // First paragraph of chapter doesn't indent
            const indent = pIndex === 0 ? 0 : 20;

            doc.text(paragraph.trim(), {
              indent,
              align: 'justify',
            });

            doc.moveDown(0.5);
          }
        });
      });

      // Add bleed marks if requested
      if (includeBleedMarks && bleed > 0) {
        // This would draw crop marks at the corners
        // Simplified for now - production would add proper crop marks
        console.log('[PDFGenerator] Bleed marks requested but not yet implemented');
      }

      // Finalize PDF
      doc.end();
    } catch (error) {
      doc.end();
      reject(error);
    }
  });
}

/**
 * Generate interior PDF optimized for specific platform
 *
 * @param {string} platform - Platform name (kdp, ingramspark, etc.)
 * @param {Object} options - PDF generation options
 * @returns {Promise<Buffer>} - PDF file buffer
 */
export async function generateInteriorPDF(platform, options) {
  // Platform-specific defaults
  const platformDefaults = {
    kdp: {
      trimSize: '6x9',
      bleed: 0, // KDP doesn't require bleed for interior
      includeBleedMarks: false,
    },
    ingramspark: {
      trimSize: '6x9',
      bleed: 9, // 0.125" bleed required
      includeBleedMarks: true,
    },
    d2d: {
      trimSize: '6x9',
      bleed: 0,
      includeBleedMarks: false,
    },
  };

  const defaults = platformDefaults[platform] || {};
  const mergedOptions = { ...defaults, ...options };

  console.log(`[PDFGenerator] Generating ${platform} interior PDF with trim size ${mergedOptions.trimSize}...`);

  return await generatePrintPDF(mergedOptions);
}

/**
 * Validate PDF for platform requirements
 *
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} platform - Platform name
 * @returns {Promise<Object>} - Validation result
 */
export async function validatePrintPDF(pdfBuffer, platform = null) {
  const validation = {
    valid: true,
    errors: [],
    warnings: [],
    info: {},
  };

  // Basic checks
  if (!pdfBuffer || pdfBuffer.length === 0) {
    validation.valid = false;
    validation.errors.push('PDF buffer is empty');
    return validation;
  }

  validation.info.fileSize = pdfBuffer.length;
  validation.info.fileSizeMB = (pdfBuffer.length / (1024 * 1024)).toFixed(2);

  // Check PDF signature (%PDF)
  const pdfSignature = pdfBuffer.slice(0, 4).toString('ascii');
  if (!pdfSignature.startsWith('%PDF')) {
    validation.valid = false;
    validation.errors.push('Invalid PDF file: missing PDF signature');
  }

  // Size checks
  if (pdfBuffer.length > 650 * 1024 * 1024) {
    validation.warnings.push('PDF exceeds 650MB, may be rejected by some platforms');
  }

  // Platform-specific validation
  if (platform === 'ingramspark') {
    // IngramSpark requires PDF/X-1a or PDF/X-3
    validation.warnings.push('Note: IngramSpark requires PDF/X-1a:2001 or PDF/X-3:2002 compliance');
  }

  return validation;
}

export default {
  generatePrintPDF,
  generateInteriorPDF,
  validatePrintPDF,
  TRIM_SIZES,
};
