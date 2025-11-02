// Cover Validator
// Platform-specific cover image validation for publishing platforms

/**
 * Platform-specific cover requirements
 */
export const COVER_SPECS = {
  kdp: {
    ebook: {
      formats: ['jpg', 'jpeg', 'tiff', 'tif'],
      minShortestSide: 1000, // pixels
      idealRatio: 1.6, // height:width (e.g., 1600x2500)
      ratioTolerance: 0.1,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      minDPI: 72,
      recommendedDPI: 300,
    },
    print: {
      formats: ['pdf'],
      requiresSpineCalculation: true,
      minDPI: 300,
      maxFileSize: 650 * 1024 * 1024, // 650MB
    },
  },
  draft2digital: {
    ebook: {
      formats: ['jpg', 'jpeg'],
      minWidth: 1600,
      minHeight: 2400,
      idealRatio: 1.5, // 1600x2400 = 1.5
      ratioTolerance: 0.2,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      minDPI: 72,
      recommendedDPI: 300,
    },
  },
  ingramspark: {
    ebook: {
      formats: ['jpg', 'jpeg'],
      minHeight: 1400,
      minWidth: 900, // Estimated from typical 1.5-1.6 ratio
      idealRatio: 1.5,
      ratioTolerance: 0.2,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      minDPI: 300,
      recommendedDPI: 300,
    },
    print: {
      formats: ['pdf'],
      requiresTemplate: true,
      minDPI: 300,
      colorSpace: 'CMYK', // Print requirement
      maxFileSize: 650 * 1024 * 1024, // 650MB
    },
  },
  apple_books: {
    ebook: {
      formats: ['jpg', 'jpeg', 'png'],
      minShortestSide: 1400, // Apple's minimum
      idealRatio: 1.5,
      ratioTolerance: 0.2,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      minDPI: 72,
      recommendedDPI: 300,
    },
  },
  google_play: {
    ebook: {
      formats: ['jpg', 'jpeg', 'png'],
      minWidth: 1600,
      minHeight: 2400,
      idealRatio: 1.5, // Same as industry standard
      ratioTolerance: 0.2,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      minDPI: 72,
      recommendedDPI: 300,
    },
  },
  kobo: {
    ebook: {
      formats: ['jpg', 'jpeg', 'png'],
      minWidth: 1400,
      minHeight: 2100,
      idealRatio: 1.5,
      ratioTolerance: 0.2,
      maxFileSize: 5 * 1024 * 1024, // 5MB (Kobo has stricter limit)
      minDPI: 72,
      recommendedDPI: 300,
    },
  },
  barnes_noble: {
    ebook: {
      formats: ['jpg', 'jpeg', 'png'],
      minWidth: 1400,
      minHeight: 2100,
      idealRatio: 1.5,
      ratioTolerance: 0.2,
      maxFileSize: 2 * 1024 * 1024, // 2MB (B&N has strict limit)
      minDPI: 72,
      recommendedDPI: 300,
    },
  },
  publishdrive: {
    ebook: {
      formats: ['jpg', 'jpeg', 'png'],
      minWidth: 1600,
      minHeight: 2400,
      idealRatio: 1.5,
      ratioTolerance: 0.2,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      minDPI: 72,
      recommendedDPI: 300,
    },
  },
};

/**
 * Validation result structure
 */
class ValidationResult {
  constructor(platform, type = 'ebook') {
    this.platform = platform;
    this.type = type;
    this.valid = true;
    this.errors = [];
    this.warnings = [];
    this.metadata = {};
  }

  addError(message) {
    this.valid = false;
    this.errors.push(message);
  }

  addWarning(message) {
    this.warnings.push(message);
  }

  setMetadata(metadata) {
    this.metadata = metadata;
  }
}

/**
 * Validate cover image against platform specifications
 * @param {Object} imageMetadata - Image metadata from sharp
 * @param {string} platform - Target platform (kdp, draft2digital, ingramspark, apple_books)
 * @param {string} type - ebook or print
 * @param {number} fileSize - File size in bytes
 * @returns {ValidationResult}
 */
export function validateCover(imageMetadata, platform, type = 'ebook', fileSize) {
  const result = new ValidationResult(platform, type);

  // Get platform specs
  const specs = COVER_SPECS[platform]?.[type];
  if (!specs) {
    result.addError(`Unknown platform or type: ${platform}/${type}`);
    return result;
  }

  // Store metadata
  result.setMetadata({
    width: imageMetadata.width,
    height: imageMetadata.height,
    format: imageMetadata.format,
    fileSize: fileSize,
    density: imageMetadata.density,
  });

  // Validate format
  const format = imageMetadata.format.toLowerCase();
  if (!specs.formats.includes(format)) {
    result.addError(
      `Invalid format: ${format}. Must be one of: ${specs.formats.join(', ')}`
    );
  }

  // Validate dimensions
  const { width, height } = imageMetadata;

  if (specs.minWidth && width < specs.minWidth) {
    result.addError(`Width too small: ${width}px. Minimum: ${specs.minWidth}px`);
  }

  if (specs.minHeight && height < specs.minHeight) {
    result.addError(`Height too small: ${height}px. Minimum: ${specs.minHeight}px`);
  }

  if (specs.minShortestSide) {
    const shortestSide = Math.min(width, height);
    if (shortestSide < specs.minShortestSide) {
      result.addError(
        `Shortest side too small: ${shortestSide}px. Minimum: ${specs.minShortestSide}px`
      );
    }
  }

  // Validate aspect ratio
  if (specs.idealRatio) {
    const actualRatio = height / width;
    const ratioDiff = Math.abs(actualRatio - specs.idealRatio);

    if (ratioDiff > specs.ratioTolerance) {
      result.addWarning(
        `Aspect ratio ${actualRatio.toFixed(2)}:1 is outside recommended range. ` +
        `Ideal: ${specs.idealRatio}:1 (±${specs.ratioTolerance})`
      );
    }
  }

  // Validate file size
  if (specs.maxFileSize && fileSize > specs.maxFileSize) {
    result.addError(
      `File too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB. ` +
      `Maximum: ${(specs.maxFileSize / 1024 / 1024).toFixed(2)}MB`
    );
  }

  // Validate DPI/density
  if (imageMetadata.density && specs.minDPI) {
    if (imageMetadata.density < specs.minDPI) {
      result.addError(
        `DPI too low: ${imageMetadata.density}. Minimum: ${specs.minDPI}`
      );
    } else if (imageMetadata.density < specs.recommendedDPI) {
      result.addWarning(
        `DPI below recommended: ${imageMetadata.density}. Recommended: ${specs.recommendedDPI}`
      );
    }
  }

  return result;
}

/**
 * Validate cover against multiple platforms at once
 * @param {Object} imageMetadata - Image metadata from sharp
 * @param {Array<string>} platforms - Array of platform names
 * @param {string} type - ebook or print
 * @param {number} fileSize - File size in bytes
 * @returns {Object} Map of platform -> ValidationResult
 */
export function validateCoverMultiPlatform(imageMetadata, platforms, type = 'ebook', fileSize) {
  const results = {};

  for (const platform of platforms) {
    results[platform] = validateCover(imageMetadata, platform, type, fileSize);
  }

  return results;
}

/**
 * Get cover specifications for a platform
 * @param {string} platform - Platform name
 * @param {string} type - ebook or print
 * @returns {Object} Cover specifications
 */
export function getCoverSpecs(platform, type = 'ebook') {
  return COVER_SPECS[platform]?.[type] || null;
}

/**
 * Calculate recommended dimensions for a platform
 * @param {string} platform - Platform name
 * @param {string} type - ebook or print
 * @returns {Object} {width, height} in pixels
 */
export function getRecommendedDimensions(platform, type = 'ebook') {
  const specs = COVER_SPECS[platform]?.[type];
  if (!specs) return null;

  // Calculate based on specs
  if (specs.minWidth && specs.minHeight) {
    return {
      width: specs.minWidth,
      height: specs.minHeight,
    };
  }

  if (specs.minShortestSide && specs.idealRatio) {
    return {
      width: specs.minShortestSide,
      height: Math.round(specs.minShortestSide * specs.idealRatio),
    };
  }

  if (specs.minHeight && specs.idealRatio) {
    return {
      width: Math.round(specs.minHeight / specs.idealRatio),
      height: specs.minHeight,
    };
  }

  return null;
}

/**
 * Check if image needs resizing for platform
 * @param {Object} imageMetadata - Image metadata from sharp
 * @param {string} platform - Platform name
 * @param {string} type - ebook or print
 * @returns {boolean}
 */
export function needsResizing(imageMetadata, platform, type = 'ebook') {
  const specs = COVER_SPECS[platform]?.[type];
  if (!specs) return false;

  const { width, height } = imageMetadata;

  // Check if below minimums
  if (specs.minWidth && width < specs.minWidth) return true;
  if (specs.minHeight && height < specs.minHeight) return true;
  if (specs.minShortestSide && Math.min(width, height) < specs.minShortestSide) return true;

  // Check aspect ratio
  if (specs.idealRatio && specs.ratioTolerance) {
    const actualRatio = height / width;
    const ratioDiff = Math.abs(actualRatio - specs.idealRatio);
    if (ratioDiff > specs.ratioTolerance) return true;
  }

  return false;
}

/**
 * Get all supported platforms
 * @returns {Array<string>}
 */
export function getSupportedPlatforms() {
  return Object.keys(COVER_SPECS);
}

/**
 * Generate validation summary for display
 * @param {ValidationResult} result
 * @returns {string}
 */
export function getValidationSummary(result) {
  if (result.valid && result.warnings.length === 0) {
    return `✅ ${result.platform} (${result.type}): Perfect! No issues found.`;
  }

  const parts = [];
  if (result.errors.length > 0) {
    parts.push(`❌ Errors: ${result.errors.join(', ')}`);
  }
  if (result.warnings.length > 0) {
    parts.push(`⚠️  Warnings: ${result.warnings.join(', ')}`);
  }

  return `${result.platform} (${result.type}): ${parts.join(' | ')}`;
}
