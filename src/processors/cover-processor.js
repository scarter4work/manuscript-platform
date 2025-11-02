/**
 * Cover Processor with Spine Calculator (MAN-43)
 *
 * Processes cover images and calculates spine width for print books
 * Uses basic image handling suitable for Cloudflare Workers
 */

import { PDFDocument } from 'pdf-lib';

/**
 * Paper types and their PPI (pages per inch) for spine calculation
 */
export const PAPER_TYPES = {
  white_50: { ppi: 442, name: 'White 50# (0.0025")' },
  white_55: { ppi: 400, name: 'White 55# (0.0028")' },
  white_60: { ppi: 352, name: 'White 60# (0.0033")' },
  white_70: { ppi: 310, name: 'White 70# (0.0038")' },
  cream_50: { ppi: 420, name: 'Cream 50# (0.0027")' },
  cream_55: { ppi: 382, name: 'Cream 55# (0.0029")' },
  cream_60: { ppi: 336, name: 'Cream 60# (0.0035")' },
  cream_70: { ppi: 300, name: 'Cream 70# (0.004")' },
};

/**
 * Calculate spine width based on page count and paper type
 *
 * Formula: Spine Width = (Page Count / PPI) + 0.06" (for cover stock thickness)
 *
 * @param {number} pageCount - Total page count (must be even)
 * @param {string} paperType - Paper type key (e.g., 'cream_60')
 * @returns {Object} - Spine calculations
 */
export function calculateSpineWidth(pageCount, paperType = 'cream_60') {
  if (!pageCount || pageCount <= 0) {
    throw new Error('Page count must be a positive number');
  }

  // Ensure even page count
  const adjustedPageCount = pageCount % 2 === 0 ? pageCount : pageCount + 1;

  const paper = PAPER_TYPES[paperType];
  if (!paper) {
    throw new Error(`Invalid paper type: ${paperType}. Available: ${Object.keys(PAPER_TYPES).join(', ')}`);
  }

  // Calculate spine width
  const interiorThickness = adjustedPageCount / paper.ppi;
  const coverThickness = 0.06; // Standard cover stock thickness
  const spineWidth = interiorThickness + coverThickness;

  return {
    pageCount: adjustedPageCount,
    originalPageCount: pageCount,
    paperType: paper.name,
    spineWidthInches: spineWidth,
    spineWidthPoints: spineWidth * 72, // Convert to points for PDF
    interiorThickness,
    coverThickness,
  };
}

/**
 * Detect image format from buffer signature
 */
function detectImageFormat(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // Check file signatures
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpeg';
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }
  if (buffer[0] === 0x49 && buffer[1] === 0x49 || buffer[0] === 0x4D && buffer[1] === 0x4D) {
    return 'tiff';
  }

  return null;
}

/**
 * Validate cover image against platform requirements
 *
 * @param {Buffer} imageBuffer - Cover image buffer
 * @param {Object} requirements - Platform-specific requirements
 * @returns {Promise<Object>} - Validation result
 */
export async function validateCoverImage(imageBuffer, requirements = {}) {
  const validation = {
    valid: true,
    errors: [],
    warnings: [],
    info: {},
  };

  try {
    // Detect format from buffer
    const format = detectImageFormat(imageBuffer);

    if (!format) {
      validation.errors.push('Unable to detect image format');
      validation.valid = false;
      return validation;
    }

    validation.info.format = format;
    validation.info.fileSize = imageBuffer.length;
    validation.info.fileSizeMB = (imageBuffer.length / (1024 * 1024)).toFixed(2);

    // Check format
    const allowedFormats = requirements.formats || ['jpeg', 'jpg', 'png', 'tiff'];
    if (!allowedFormats.includes(format)) {
      validation.errors.push(`Invalid format: ${format}. Allowed: ${allowedFormats.join(', ')}`);
      validation.valid = false;
    }

    // File size validation
    if (requirements.maxSize && imageBuffer.length > requirements.maxSize) {
      validation.errors.push(`File size ${validation.info.fileSizeMB}MB exceeds maximum ${(requirements.maxSize / (1024 * 1024)).toFixed(0)}MB`);
      validation.valid = false;
    }

    // Note: Detailed dimension validation would require image decoding library
    // For now, we do basic format and size validation
    validation.warnings.push('Detailed image dimension validation not available in Workers environment');

  } catch (error) {
    validation.valid = false;
    validation.errors.push(`Failed to process image: ${error.message}`);
  }

  return validation;
}

/**
 * Process cover image - pass through for now
 * In production, use Cloudflare Image Resizing API at the edge
 *
 * @param {Buffer} imageBuffer - Original cover image
 * @param {Object} options - Resize options
 * @returns {Promise<Buffer>} - Processed cover image
 */
export async function processCoverImage(imageBuffer, options = {}) {
  // For now, return the original buffer unchanged
  // In production, consider using Cloudflare's Image Resizing:
  // https://developers.cloudflare.com/images/image-resizing/
  console.log('[CoverProcessor] Passing through cover image (no processing)');
  return imageBuffer;
}

/**
 * Generate print cover PDF with spine
 *
 * @param {Buffer} frontCover - Front cover image buffer
 * @param {Buffer} backCover - Back cover image buffer (optional)
 * @param {Object} options - Cover generation options
 * @returns {Promise<Buffer>} - Cover PDF buffer
 */
export async function generatePrintCover(frontCover, backCover = null, options = {}) {
  const {
    trimWidth = 6 * 72, // 6 inches in points
    trimHeight = 9 * 72, // 9 inches in points
    pageCount,
    paperType = 'cream_60',
    bleed = 9, // 0.125" bleed
  } = options;

  if (!pageCount) {
    throw new Error('Page count is required for print cover generation');
  }

  // Calculate spine width
  const spine = calculateSpineWidth(pageCount, paperType);
  console.log(`[CoverProcessor] Calculated spine width: ${spine.spineWidthInches.toFixed(3)}" (${spine.pageCount} pages)`);

  // Calculate cover dimensions
  // Total width = front + spine + back + (2 * bleed)
  const totalWidth = (trimWidth * 2) + spine.spineWidthPoints + (bleed * 2);
  const totalHeight = trimHeight + (bleed * 2);

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([totalWidth, totalHeight]);

  try {
    // Embed front cover image
    let frontImage;
    if (detectImageFormat(frontCover) === 'jpeg') {
      frontImage = await pdfDoc.embedJpg(frontCover);
    } else if (detectImageFormat(frontCover) === 'png') {
      frontImage = await pdfDoc.embedPng(frontCover);
    } else {
      throw new Error('Front cover must be JPEG or PNG');
    }

    // Position front cover on right side
    const frontX = bleed + trimWidth + spine.spineWidthPoints;
    const frontY = bleed;

    page.drawImage(frontImage, {
      x: frontX,
      y: frontY,
      width: trimWidth,
      height: trimHeight,
    });

    // Embed and position back cover if provided
    if (backCover) {
      let backImage;
      if (detectImageFormat(backCover) === 'jpeg') {
        backImage = await pdfDoc.embedJpg(backCover);
      } else if (detectImageFormat(backCover) === 'png') {
        backImage = await pdfDoc.embedPng(backCover);
      } else {
        throw new Error('Back cover must be JPEG or PNG');
      }

      const backX = bleed;
      const backY = bleed;

      page.drawImage(backImage, {
        x: backX,
        y: backY,
        width: trimWidth,
        height: trimHeight,
      });
    }

    // Spine area in the middle (left as white/empty for now)
    // In production, you could add spine text here

  } catch (error) {
    console.error('[CoverProcessor] Error generating print cover:', error);
    throw error;
  }

  const pdfBytes = await pdfDoc.save();
  console.log(`[CoverProcessor] Generated cover PDF: ${pdfBytes.length} bytes`);
  return Buffer.from(pdfBytes);
}

export default {
  calculateSpineWidth,
  validateCoverImage,
  processCoverImage,
  generatePrintCover,
  PAPER_TYPES,
};
