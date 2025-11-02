/**
 * PDF Generator (MAN-43)
 *
 * Generates print-ready PDFs with proper margins, bleeds, and trim sizes
 * for platforms like IngramSpark and Amazon KDP Print
 *
 * Uses pdf-lib which is Workers-compatible
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import mammoth from 'mammoth';

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
  '8.5x11': { width: 8.5 * 72, height: 11 * 72, name: '8.5" x 11"' },
};

/**
 * Parse DOCX to extract text content for PDF
 */
async function parseDocxForPDF(docxBuffer) {
  try {
    const result = await mammoth.extractRawText({ buffer: docxBuffer });
    const text = result.value;

    // Split by double line breaks or "Chapter" headings
    const chapterRegex = /(Chapter\s+\d+[^\n]*\n)/gi;
    const parts = text.split(chapterRegex);

    const chapters = [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].match(/Chapter\s+\d+/i)) {
        const title = parts[i].trim();
        const content = parts[i + 1] || '';
        chapters.push({ title, content: content.trim() });
        i++; // Skip the content part since we already processed it
      }
    }

    if (chapters.length === 0) {
      // No chapter headings found, treat as single chapter
      chapters.push({
        title: 'Chapter 1',
        content: text
      });
    }

    return { chapters };
  } catch (error) {
    console.error('[PDF] Error parsing DOCX:', error);
    return {
      chapters: [{
        title: 'Chapter 1',
        content: 'Content extraction failed. Please ensure the manuscript is a valid DOCX file.'
      }]
    };
  }
}

/**
 * Generate print PDF with specific formatting
 *
 * @param {Object} options - PDF generation options
 * @returns {Promise<Buffer>} - PDF buffer
 */
export async function generatePrintPDF(options) {
  const {
    title = 'Untitled',
    author = 'Unknown Author',
    trimSize = '6x9',
    chapters = [],
    bleed = 0,
  } = options;

  const size = TRIM_SIZES[trimSize] || TRIM_SIZES['6x9'];
  const pdfDoc = await PDFDocument.create();

  // Set PDF metadata
  pdfDoc.setTitle(title);
  pdfDoc.setAuthor(author);
  pdfDoc.setCreator('ManuscriptHub PDF Generator');

  // Embed standard font
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  // Page dimensions
  const pageWidth = size.width + (bleed * 2);
  const pageHeight = size.height + (bleed * 2);
  const margin = 54 + bleed; // 0.75" margins + bleed
  const textWidth = pageWidth - (margin * 2);
  const textHeight = pageHeight - (margin * 2);

  for (const chapter of chapters) {
    // Add chapter title page
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin - 100;

    page.drawText(chapter.title, {
      x: pageWidth / 2 - (chapter.title.length * 6),
      y: yPosition,
      size: 18,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 60;

    // Split chapter content into paragraphs
    const paragraphs = chapter.content.split(/\n\n+/);

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;

      // Word wrap
      const words = paragraph.split(/\s+/);
      let line = '';
      const fontSize = 12;
      const lineHeight = fontSize * 1.5;

      for (const word of words) {
        const testLine = line + word + ' ';
        const textWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (textWidth > textWidth && line !== '') {
          // Draw line
          page.drawText(line.trim(), {
            x: margin,
            y: yPosition,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
          });

          line = word + ' ';
          yPosition -= lineHeight;

          // Check if we need a new page
          if (yPosition < margin + 50) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            yPosition = pageHeight - margin;
          }
        } else {
          line = testLine;
        }
      }

      // Draw remaining line
      if (line.trim()) {
        page.drawText(line.trim(), {
          x: margin,
          y: yPosition,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        });
        yPosition -= lineHeight * 1.5; // Extra space between paragraphs
      }

      // Check if we need a new page
      if (yPosition < margin + 50) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  console.log(`[PDF] Generated print PDF: ${pdfBytes.length} bytes, ${pdfDoc.getPageCount()} pages`);
  return Buffer.from(pdfBytes);
}

/**
 * Generate interior PDF for print books
 *
 * @param {string} platform - Platform identifier (kdp, ingramspark)
 * @param {Object} options - PDF generation options
 * @returns {Promise<Buffer>} - PDF buffer
 */
export async function generateInteriorPDF(platform, options) {
  const {
    trimSize = '6x9',
    title = 'Untitled',
    author = 'Unknown Author',
    chapters = [],
    metadata = {},
  } = options;

  // IngramSpark requires bleed, KDP doesn't
  const bleed = platform === 'ingramspark' ? 9 : 0; // 0.125" = 9 points

  return await generatePrintPDF({
    title,
    author,
    trimSize,
    chapters,
    bleed,
    metadata,
  });
}

/**
 * Generate interior PDF from DOCX
 */
export async function generateInteriorPDFFromDOCX(platform, docxBuffer, options = {}) {
  console.log('[PDF] Generating interior PDF from DOCX...');

  // Parse DOCX to extract chapters
  const parsed = await parseDocxForPDF(docxBuffer);

  return await generateInteriorPDF(platform, {
    ...options,
    chapters: parsed.chapters,
  });
}

/**
 * Validate PDF file
 *
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} platform - Platform identifier (optional)
 * @returns {Promise<Object>} - Validation result
 */
export async function validatePrintPDF(pdfBuffer, platform = null) {
  const validation = {
    valid: true,
    errors: [],
    warnings: [],
    info: {},
  };

  try {
    // Load and validate PDF structure
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    validation.info.pageCount = pdfDoc.getPageCount();
    validation.info.fileSize = pdfBuffer.length;
    validation.info.fileSizeMB = (pdfBuffer.length / (1024 * 1024)).toFixed(2);

    // Check page count
    if (pdfDoc.getPageCount() < 24) {
      validation.errors.push('PDF has less than 24 pages (minimum for most POD platforms)');
      validation.valid = false;
    }

    if (pdfDoc.getPageCount() > 828) {
      validation.errors.push('PDF exceeds 828 pages (maximum for KDP)');
      validation.valid = false;
    }

    // Check if page count is even (required for print books)
    if (pdfDoc.getPageCount() % 2 !== 0) {
      validation.warnings.push('Page count is odd - print books typically require even page counts');
    }

    // File size check
    if (pdfBuffer.length > 650 * 1024 * 1024) {
      validation.errors.push('PDF exceeds 650MB maximum');
      validation.valid = false;
    }

    // Get first page dimensions
    const firstPage = pdfDoc.getPage(0);
    const { width, height } = firstPage.getSize();
    validation.info.pageWidth = width;
    validation.info.pageHeight = height;
    validation.info.pageDimensions = `${(width / 72).toFixed(2)}" x ${(height / 72).toFixed(2)}"`;

  } catch (error) {
    validation.valid = false;
    validation.errors.push(`Failed to validate PDF: ${error.message}`);
  }

  return validation;
}

export default {
  TRIM_SIZES,
  generatePrintPDF,
  generateInteriorPDF,
  generateInteriorPDFFromDOCX,
  validatePrintPDF,
};
