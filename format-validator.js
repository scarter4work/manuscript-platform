/**
 * Format Validator (MAN-43)
 *
 * Validates manuscripts, covers, and exports against platform-specific requirements
 */

// import sharp from 'sharp'; // Disabled: not compatible with Workers
import { validateEPUB } from './epub-generator.js';
import { validatePrintPDF } from './pdf-generator.js';
import { validateCoverImage } from './cover-processor.js';

/**
 * Platform-specific requirements
 */
export const PLATFORM_REQUIREMENTS = {
  kdp: {
    ebook: {
      formats: ['docx', 'epub', 'html', 'rtf', 'mobi', 'txt'],
      maxFileSize: 650 * 1024 * 1024, // 650MB
      coverFormats: ['jpg', 'jpeg', 'tiff'],
      coverMinWidth: 1000,
      coverMinHeight: 1000,
      coverAspectRatio: 1.6, // Height/Width ratio
      coverMaxSize: 50 * 1024 * 1024, // 50MB
    },
    print: {
      interiorFormats: ['pdf'],
      coverFormats: ['pdf'],
      trimSizes: ['5x8', '5.25x8', '5.5x8.5', '6x9', '7x10', '8x10', '8.5x11'],
      pageCountMin: 24,
      pageCountMax: 828,
      bleedRequired: false,
      colorSpace: 'RGB',
    },
  },
  d2d: {
    ebook: {
      formats: ['docx', 'rtf', 'epub'],
      maxFileSize: 650 * 1024 * 1024,
      coverFormats: ['jpg', 'jpeg'],
      coverMinWidth: 1600,
      coverMinHeight: 2400,
      coverAspectRatio: 1.5,
      coverMaxSize: 50 * 1024 * 1024,
    },
  },
  ingramspark: {
    print: {
      interiorFormats: ['pdf'],
      coverFormats: ['pdf'],
      pdfStandard: 'PDF/X-1a:2001 or PDF/X-3:2002',
      trimSizes: ['5x8', '5.5x8.5', '6x9', '6.14x9.21', '7x10', '8x10', '8.5x11'],
      bleedRequired: true,
      bleedSize: 0.125, // inches
      colorSpace: 'CMYK or RGB',
    },
    ebook: {
      formats: ['epub'],
      epubVersion: '2.0 or 3.0',
      coverFormats: ['jpg', 'jpeg'],
      coverMinHeight: 1400,
    },
  },
  apple_books: {
    ebook: {
      formats: ['epub'],
      epubVersion: '3.0 preferred',
      validationRequired: true,
      coverFormats: ['jpg', 'jpeg', 'png'],
      coverMinWidth: 1400,
      coverMinHeight: 1400,
    },
  },
};

/**
 * Validate manuscript file against platform requirements
 *
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileType - File extension (docx, epub, pdf)
 * @param {string} platform - Platform identifier
 * @param {string} publishType - 'ebook' or 'print'
 * @returns {Promise<Object>} - Validation result
 */
export async function validateManuscript(fileBuffer, fileType, platform, publishType = 'ebook') {
  const requirements = PLATFORM_REQUIREMENTS[platform]?.[publishType];

  if (!requirements) {
    return {
      valid: false,
      errors: [`Unknown platform/type: ${platform}/${publishType}`],
    };
  }

  const validation = {
    valid: true,
    errors: [],
    warnings: [],
    info: {},
    requirements,
  };

  // File size check
  validation.info.fileSizeBytes = fileBuffer.length;
  validation.info.fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);

  if (requirements.maxFileSize && fileBuffer.length > requirements.maxFileSize) {
    validation.errors.push(
      `File size ${validation.info.fileSizeMB}MB exceeds maximum ${(requirements.maxFileSize / (1024 * 1024)).toFixed(0)}MB`
    );
    validation.valid = false;
  }

  // Format check
  if (requirements.formats && !requirements.formats.includes(fileType.toLowerCase())) {
    validation.errors.push(
      `Format ${fileType} not supported. Allowed: ${requirements.formats.join(', ')}`
    );
    validation.valid = false;
  }

  // Type-specific validation
  if (fileType === 'epub') {
    const epubValidation = await validateEPUB(fileBuffer);
    validation.errors.push(...epubValidation.errors);
    validation.warnings.push(...epubValidation.warnings);
    Object.assign(validation.info, epubValidation.info);
    validation.valid = validation.valid && epubValidation.valid;
  } else if (fileType === 'pdf') {
    const pdfValidation = await validatePrintPDF(fileBuffer, platform);
    validation.errors.push(...pdfValidation.errors);
    validation.warnings.push(...pdfValidation.warnings);
    Object.assign(validation.info, pdfValidation.info);
    validation.valid = validation.valid && pdfValidation.valid;
  }

  return validation;
}

/**
 * Validate cover file against platform requirements
 *
 * @param {Buffer} imageBuffer - Cover image buffer
 * @param {string} platform - Platform identifier
 * @param {string} publishType - 'ebook' or 'print'
 * @returns {Promise<Object>} - Validation result
 */
export async function validateCover(imageBuffer, platform, publishType = 'ebook') {
  const requirements = PLATFORM_REQUIREMENTS[platform]?.[publishType];

  if (!requirements) {
    return {
      valid: false,
      errors: [`Unknown platform/type: ${platform}/${publishType}`],
    };
  }

  // Build validation requirements
  const validationReqs = {
    formats: requirements.coverFormats,
    minWidth: requirements.coverMinWidth,
    minHeight: requirements.coverMinHeight,
    aspectRatio: requirements.coverAspectRatio,
    maxSize: requirements.coverMaxSize,
    colorSpace: 'srgb',
    noTransparency: publishType === 'print',
  };

  return await validateCoverImage(imageBuffer, validationReqs);
}

/**
 * Validate complete export package
 *
 * @param {Object} exportPackage - Export package object
 * @param {string} platform - Platform identifier
 * @param {string} publishType - 'ebook' or 'print'
 * @returns {Promise<Object>} - Validation result
 */
export async function validateExportPackage(exportPackage, platform, publishType = 'ebook') {
  const validation = {
    valid: true,
    errors: [],
    warnings: [],
    components: {},
  };

  // Validate manuscript
  if (exportPackage.manuscript) {
    const manuscriptValidation = await validateManuscript(
      exportPackage.manuscript.buffer,
      exportPackage.manuscript.type,
      platform,
      publishType
    );

    validation.components.manuscript = manuscriptValidation;

    if (!manuscriptValidation.valid) {
      validation.valid = false;
      validation.errors.push('Manuscript validation failed');
    }
  } else {
    validation.errors.push('Manuscript file missing');
    validation.valid = false;
  }

  // Validate cover
  if (exportPackage.cover) {
    const coverValidation = await validateCover(
      exportPackage.cover.buffer,
      platform,
      publishType
    );

    validation.components.cover = coverValidation;

    if (!coverValidation.valid) {
      validation.valid = false;
      validation.errors.push('Cover validation failed');
    }
  } else {
    validation.warnings.push('Cover file missing (may be required by platform)');
  }

  // Validate metadata
  if (exportPackage.metadata) {
    const metadataValidation = validateMetadata(exportPackage.metadata, platform);
    validation.components.metadata = metadataValidation;

    if (!metadataValidation.valid) {
      validation.valid = false;
      validation.errors.push('Metadata validation failed');
    }
  }

  return validation;
}

/**
 * Validate metadata against platform requirements
 *
 * @param {Object} metadata - Book metadata
 * @param {string} platform - Platform identifier
 * @returns {Object} - Validation result
 */
function validateMetadata(metadata, platform) {
  const validation = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Required fields (common across all platforms)
  const requiredFields = ['title', 'author'];

  for (const field of requiredFields) {
    if (!metadata[field]) {
      validation.errors.push(`Missing required field: ${field}`);
      validation.valid = false;
    }
  }

  // Description checks
  if (metadata.description) {
    if (metadata.description.length > 4000) {
      validation.warnings.push('Description exceeds 4000 characters, may be truncated');
    }
    if (metadata.description.length < 100) {
      validation.warnings.push('Description is quite short (<100 characters)');
    }
  }

  // Keyword checks (KDP allows 7)
  if (platform === 'kdp' && metadata.keywords) {
    if (metadata.keywords.length > 7) {
      validation.warnings.push('KDP allows maximum 7 keywords, extras will be ignored');
    }

    for (const keyword of metadata.keywords) {
      if (keyword.length > 50) {
        validation.warnings.push(`Keyword "${keyword}" exceeds 50 characters`);
      }
    }
  }

  // Category checks (KDP allows 2 initially, up to 10 via support)
  if (platform === 'kdp' && metadata.categories) {
    if (metadata.categories.length > 2) {
      validation.warnings.push('KDP initially allows 2 categories (can request up to 10 via support)');
    }
  }

  // ISBN check
  if (metadata.isbn) {
    // Basic ISBN validation (10 or 13 digits)
    const isbnDigits = metadata.isbn.replace(/[-\s]/g, '');
    if (isbnDigits.length !== 10 && isbnDigits.length !== 13) {
      validation.errors.push('ISBN must be 10 or 13 digits');
      validation.valid = false;
    }
  }

  return validation;
}

/**
 * Get platform-specific validation summary
 *
 * @param {string} platform - Platform identifier
 * @param {string} publishType - 'ebook' or 'print'
 * @returns {Object} - Platform requirements summary
 */
export function getPlatformRequirements(platform, publishType = 'ebook') {
  return PLATFORM_REQUIREMENTS[platform]?.[publishType] || null;
}

export default {
  validateManuscript,
  validateCover,
  validateExportPackage,
  validateMetadata,
  getPlatformRequirements,
  PLATFORM_REQUIREMENTS,
};
