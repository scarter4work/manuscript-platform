/**
 * Cover Processor with Spine Calculator (MAN-43)
 *
 * Processes cover images and calculates spine width for print books
 */

import sharp from 'sharp';
import PDFDocument from 'pdfkit';

/**
 * Paper types and their PPI (pages per inch) for spine calculation
 */
const PAPER_TYPES = {
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
    const metadata = await sharp(imageBuffer).metadata();

    validation.info = {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      colorSpace: metadata.space,
      hasAlpha: metadata.hasAlpha,
      resolution: metadata.density,
    };

    // Check format
    const allowedFormats = requirements.formats || ['jpeg', 'jpg', 'png', 'tiff'];
    if (!allowedFormats.includes(metadata.format.toLowerCase())) {
      validation.errors.push(`Invalid format: ${metadata.format}. Allowed: ${allowedFormats.join(', ')}`);
      validation.valid = false;
    }

    // Check minimum dimensions
    if (requirements.minWidth && metadata.width < requirements.minWidth) {
      validation.errors.push(`Width ${metadata.width}px is below minimum ${requirements.minWidth}px`);
      validation.valid = false;
    }

    if (requirements.minHeight && metadata.height < requirements.minHeight) {
      validation.errors.push(`Height ${metadata.height}px is below minimum ${requirements.minHeight}px`);
      validation.valid = false;
    }

    // Check aspect ratio if specified
    if (requirements.aspectRatio) {
      const actualRatio = metadata.height / metadata.width;
      const expectedRatio = requirements.aspectRatio;
      const tolerance = 0.05; // 5% tolerance

      if (Math.abs(actualRatio - expectedRatio) > tolerance) {
        validation.warnings.push(
          `Aspect ratio ${actualRatio.toFixed(2)} differs from recommended ${expectedRatio.toFixed(2)}`
        );
      }
    }

    // Check for transparency (usually not allowed for print covers)
    if (metadata.hasAlpha && requirements.noTransparency) {
      validation.errors.push('Cover image contains transparency, which is not allowed for print');
      validation.valid = false;
    }

    // Check color space (should be RGB for most platforms)
    if (requirements.colorSpace && metadata.space !== requirements.colorSpace) {
      validation.warnings.push(
        `Color space is ${metadata.space}, recommended: ${requirements.colorSpace}`
      );
    }

    // Check resolution (DPI)
    if (requirements.minDPI && metadata.density && metadata.density < requirements.minDPI) {
      validation.warnings.push(
        `Resolution ${metadata.density} DPI is below recommended ${requirements.minDPI} DPI`
      );
    }
  } catch (error) {
    validation.valid = false;
    validation.errors.push(`Failed to process image: ${error.message}`);
  }

  return validation;
}

/**
 * Resize and optimize cover image to meet platform requirements
 *
 * @param {Buffer} imageBuffer - Original cover image
 * @param {Object} options - Resize options
 * @returns {Promise<Buffer>} - Processed cover image
 */
export async function processCoverImage(imageBuffer, options = {}) {
  const {
    width = null,
    height = null,
    format = 'jpeg',
    quality = 95,
    colorSpace = 'srgb',
    removeAlpha = true,
  } = options;

  let processor = sharp(imageBuffer);

  // Resize if dimensions specified
  if (width || height) {
    processor = processor.resize(width, height, {
      fit: 'cover',
      position: 'center',
    });
  }

  // Remove alpha channel if requested
  if (removeAlpha) {
    processor = processor.flatten({ background: { r: 255, g: 255, b: 255 } });
  }

  // Set color space
  if (colorSpace === 'srgb') {
    processor = processor.toColorspace('srgb');
  }

  // Convert to specified format
  if (format === 'jpeg' || format === 'jpg') {
    processor = processor.jpeg({ quality, mozjpeg: true });
  } else if (format === 'png') {
    processor = processor.png({ quality, compressionLevel: 9 });
  } else if (format === 'tiff') {
    processor = processor.tiff({ quality, compression: 'lzw' });
  }

  return await processor.toBuffer();
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
    barcodePosition = null, // {x, y, width, height} for barcode placement
  } = options;

  // Calculate spine width
  const spine = calculateSpineWidth(pageCount, paperType);
  console.log(`[CoverProcessor] Calculated spine width: ${spine.spineWidthInches.toFixed(3)}" (${spine.pageCount} pages)`);

  // Calculate cover dimensions
  // Total width = front + spine + back + (2 * bleed)
  const totalWidth = (trimWidth * 2) + spine.spineWidthPoints + (bleed * 2);
  const totalHeight = trimHeight + (bleed * 2);

  return new Promise((resolve, reject) => {
    const chunks = [];

    const doc = new PDFDocument({
      size: [totalWidth, totalHeight],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: 'Print Cover',
        Creator: 'ManuscriptHub Cover Generator',
      },
    });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      console.log(`[CoverProcessor] Generated cover PDF: ${pdfBuffer.length} bytes`);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    try {
      // Add front cover (right side)
      const frontX = bleed + trimWidth + spine.spineWidthPoints;
      const frontY = bleed;

      doc.image(frontCover, frontX, frontY, {
        width: trimWidth,
        height: trimHeight,
      });

      // Add back cover (left side) if provided
      if (backCover) {
        const backX = bleed;
        const backY = bleed;

        doc.image(backCover, backX, backY, {
          width: trimWidth,
          height: trimHeight,
        });
      } else {
        // Fill with white if no back cover
        doc.rect(bleed, bleed, trimWidth, trimHeight).fill('white');
      }

      // Add spine area (center)
      const spineX = bleed + trimWidth;
      const spineY = bleed;

      doc.rect(spineX, spineY, spine.spineWidthPoints, trimHeight).fill('white');

      // Add barcode placeholder if specified
      if (barcodePosition) {
        const { x, y, width, height } = barcodePosition;
        doc.rect(x, y, width, height).fill('white');
        doc.fontSize(8).fillColor('black').text('ISBN Barcode', x, y + height + 5);
      }

      doc.end();
    } catch (error) {
      doc.end();
      reject(error);
    }
  });
}

export default {
  calculateSpineWidth,
  validateCoverImage,
  processCoverImage,
  generatePrintCover,
  PAPER_TYPES,
};
