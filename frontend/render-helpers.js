/**
 * Frontend Rendering Helper Functions
 *
 * These functions help build HTML consistently and reduce code duplication
 * in dashboard-spa.js. All rendering logic for asset display is centralized here.
 *
 * Why this file exists:
 * - Reduces 250+ lines of repetitive HTML string building
 * - Centralizes styling constants for easy theming
 * - Makes code more testable and maintainable
 * - Easier for non-expert JS developers to understand
 */

// ============================================================================
// STYLING CONSTANTS
// ============================================================================

/**
 * Color scheme used throughout the dashboard
 * Change these values to restyle the entire UI
 */
const COLORS = {
  PRIMARY: '#667eea',      // Main brand color (purple-blue)
  ACCENT: '#ffa726',       // Accent color (orange)
  HIGHLIGHT: '#9c27b0',    // Highlight color (purple)
  BORDER: '#ddd',          // Light border color
  BACKGROUND: 'white',     // Card background
  TEXT_MUTED: '#666'       // Muted text color
};

/**
 * Common spacing values (in pixels)
 */
const SPACING = {
  SMALL: 5,
  MEDIUM: 10,
  LARGE: 15,
  XLARGE: 20
};

// ============================================================================
// HTML BUILDING HELPERS
// ============================================================================

/**
 * Creates a styled key-value pair display
 *
 * @param {string} label - The label text (e.g., "Main Imagery")
 * @param {string} value - The value text
 * @param {boolean} isBold - Whether to bold the label
 * @returns {string} HTML string
 */
function renderKeyValue(label, value, isBold = true) {
  const displayValue = value || 'N/A';
  const labelStyle = isBold ? 'font-weight: bold;' : '';

  return `
    <div style="margin-bottom: ${SPACING.MEDIUM}px;">
      <span style="${labelStyle}">${label}:</span> ${displayValue}
    </div>
  `;
}

/**
 * Creates a section heading
 *
 * @param {string} text - The heading text
 * @param {string} color - The heading color (defaults to PRIMARY)
 * @returns {string} HTML string
 */
function renderHeading(text, color = COLORS.PRIMARY) {
  return `<h4 style="color: ${color}; margin-bottom: ${SPACING.MEDIUM}px;">${text}</h4>`;
}

/**
 * Creates a paragraph
 *
 * @param {string} text - The paragraph text
 * @param {Object} options - Optional styling options
 * @returns {string} HTML string
 */
function renderParagraph(text, options = {}) {
  const marginBottom = options.marginBottom || SPACING.XLARGE;
  const fontStyle = options.italic ? 'font-style: italic;' : '';

  return `<p style="margin-bottom: ${marginBottom}px; ${fontStyle}">${text}</p>`;
}

/**
 * Creates an unordered list from an array of items
 *
 * @param {string[]} items - Array of list items
 * @param {Object} options - Optional styling options
 * @returns {string} HTML string
 */
function renderList(items, options = {}) {
  const marginBottom = options.marginBottom || SPACING.XLARGE;

  if (!items || items.length === 0) {
    return '';
  }

  const listItems = items.map(item =>
    `<li style="margin-bottom: ${SPACING.SMALL}px;">${item}</li>`
  ).join('');

  return `<ul style="margin-bottom: ${marginBottom}px;">${listItems}</ul>`;
}

/**
 * Creates a code block (for AI prompts, etc.)
 *
 * @param {string} text - The code text
 * @param {string} label - Optional label
 * @returns {string} HTML string
 */
function renderCodeBlock(text, label = null) {
  const labelHtml = label ? `<strong style="color: ${COLORS.HIGHLIGHT};">${label}:</strong>` : '';

  return `
    <div style="margin-bottom: ${SPACING.LARGE}px;">
      ${labelHtml}
      <div style="
        margin-top: ${SPACING.SMALL}px;
        padding: ${SPACING.MEDIUM}px;
        background: ${COLORS.BACKGROUND};
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;
      ">
        ${text || 'N/A'}
      </div>
    </div>
  `;
}

/**
 * Creates a card container (used for book arc items, etc.)
 *
 * @param {string} content - The card content HTML
 * @returns {string} HTML string
 */
function renderCard(content) {
  return `
    <div style="
      padding: ${SPACING.LARGE}px;
      background: ${COLORS.BACKGROUND};
      border-radius: 6px;
      margin-bottom: ${SPACING.MEDIUM}px;
    ">
      ${content}
    </div>
  `;
}

// ============================================================================
// COVER DESIGN BRIEF RENDERERS
// ============================================================================

/**
 * Renders the visual concept section of a cover brief
 *
 * @param {Object} visualConcept - The visual concept object
 * @returns {string} HTML string
 */
function renderCoverVisualConcept(visualConcept) {
  if (!visualConcept) return '';

  return renderKeyValue('Main Imagery', visualConcept.mainImagery) +
         renderKeyValue('Composition', visualConcept.composition) +
         renderKeyValue('Focal Point', visualConcept.focalPoint);
}

/**
 * Renders the color palette section of a cover brief
 *
 * @param {Object} colorPalette - The color palette object
 * @returns {string} HTML string
 */
function renderCoverColorPalette(colorPalette) {
  if (!colorPalette) return '';

  return `
    ${renderKeyValue('Primary', colorPalette.primary)}
    ${renderKeyValue('Secondary', colorPalette.secondary)}
    ${renderKeyValue('Accent', colorPalette.accent)}
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid ${COLORS.BORDER};">
      <em>${colorPalette.overall || 'N/A'}</em>
    </div>
  `;
}

/**
 * Renders the typography section of a cover brief
 *
 * @param {Object} typography - The typography object
 * @returns {string} HTML string
 */
function renderCoverTypography(typography) {
  if (!typography) return '';

  return renderKeyValue('Title Font', typography.titleFont) +
         renderKeyValue('Author Font', typography.authorFont) +
         renderKeyValue('Hierarchy', typography.hierarchy) +
         renderKeyValue('Placement', typography.placement);
}

/**
 * Renders AI art prompts for different platforms
 *
 * @param {Object} aiArtPrompts - The AI art prompts object
 * @returns {string} HTML string
 */
function renderCoverAIPrompts(aiArtPrompts) {
  if (!aiArtPrompts) return '';

  return renderCodeBlock(aiArtPrompts.midjourney, 'Midjourney') +
         renderCodeBlock(aiArtPrompts.dalle, 'DALL-E') +
         renderCodeBlock(aiArtPrompts.stableDiffusion, 'Stable Diffusion');
}

/**
 * Renders the complete cover design brief
 *
 * @param {Object} coverBrief - The full cover brief object
 * @returns {string} HTML string
 */
function renderFullCoverBrief(coverBrief) {
  if (!coverBrief) return '';

  let html = '';

  // Designer Brief
  if (coverBrief.designerBrief) {
    html += renderHeading('Designer Brief');
    html += renderParagraph(coverBrief.designerBrief);
  }

  // Mood & Atmosphere
  if (coverBrief.moodAtmosphere) {
    html += renderHeading('Mood & Atmosphere');
    html += renderParagraph(coverBrief.moodAtmosphere);
  }

  // Genre Conventions
  if (coverBrief.genreConventions && coverBrief.genreConventions.length > 0) {
    html += renderHeading('Genre Conventions');
    html += renderList(coverBrief.genreConventions);
  }

  // Design Elements
  if (coverBrief.designElements && coverBrief.designElements.length > 0) {
    html += renderHeading('Design Elements');
    html += renderList(coverBrief.designElements);
  }

  // Comparable Covers
  if (coverBrief.comparableCovers && coverBrief.comparableCovers.length > 0) {
    html += renderHeading('Comparable Covers');
    html += renderList(coverBrief.comparableCovers);
  }

  // DIY Guidance
  if (coverBrief.diyGuidance) {
    html += renderHeading('DIY Guidance');

    if (coverBrief.diyGuidance.canvaTemplate) {
      html += renderParagraph(`<strong>Canva Template:</strong> ${coverBrief.diyGuidance.canvaTemplate}`, { marginBottom: SPACING.MEDIUM });
    }

    if (coverBrief.diyGuidance.keyTips && coverBrief.diyGuidance.keyTips.length > 0) {
      html += '<p><strong>Key Tips:</strong></p>';
      html += renderList(coverBrief.diyGuidance.keyTips);
    }
  }

  return html;
}

// ============================================================================
// SERIES DESCRIPTION RENDERERS
// ============================================================================

/**
 * Renders a single book in the series arc
 *
 * @param {Object} book - The book object with bookNumber, tentativeTitle, purpose, etc.
 * @returns {string} HTML string
 */
function renderSeriesBookCard(book) {
  let content = `
    <h5 style="color: ${COLORS.ACCENT}; margin-bottom: 8px;">
      Book ${book.bookNumber}: ${book.tentativeTitle || 'Untitled'}
    </h5>
    <p style="margin-bottom: 5px;"><strong>Purpose:</strong> ${book.purpose || 'N/A'}</p>
  `;

  if (book.cliffhanger) {
    content += `<p style="margin-bottom: 5px;"><strong>Cliffhanger:</strong> ${book.cliffhanger}</p>`;
  }

  if (book.resolution) {
    content += `<p style="margin-bottom: 5px;"><strong>Resolution:</strong> ${book.resolution}</p>`;
  }

  return renderCard(content);
}

/**
 * Renders the book-by-book arc section
 *
 * @param {Object[]} bookByBookArc - Array of book objects
 * @returns {string} HTML string
 */
function renderSeriesBookArc(bookByBookArc) {
  if (!bookByBookArc || bookByBookArc.length === 0) return '';

  return bookByBookArc.map(book => renderSeriesBookCard(book)).join('');
}

/**
 * Renders the complete series strategy section
 *
 * @param {Object} seriesDescription - The full series description object
 * @returns {string} HTML string
 */
function renderSeriesStrategy(seriesDescription) {
  if (!seriesDescription) return '';

  let html = '';

  // Overarching Conflict
  if (seriesDescription.overarchingConflict) {
    html += renderHeading('Overarching Conflict');
    html += renderParagraph(seriesDescription.overarchingConflict);
  }

  // Character Journey
  if (seriesDescription.characterJourney) {
    html += renderHeading('Character Journey');
    html += '<div style="margin-bottom: ' + SPACING.XLARGE + 'px;">';

    const journey = seriesDescription.characterJourney;
    if (journey.protagonist) {
      html += renderParagraph(`<strong>Protagonist:</strong> ${journey.protagonist}`, { marginBottom: SPACING.SMALL });
    }
    if (journey.startingPoint) {
      html += renderParagraph(`<strong>Starting Point:</strong> ${journey.startingPoint}`, { marginBottom: SPACING.SMALL });
    }
    if (journey.endPoint) {
      html += renderParagraph(`<strong>End Point:</strong> ${journey.endPoint}`, { marginBottom: SPACING.SMALL });
    }
    if (journey.transformation) {
      html += renderParagraph(`<strong>Transformation:</strong> ${journey.transformation}`, { marginBottom: SPACING.SMALL });
    }

    html += '</div>';
  }

  // World Building
  if (seriesDescription.worldBuilding) {
    html += renderHeading('World Building');
    html += renderParagraph(seriesDescription.worldBuilding);
  }

  // Reading Order
  if (seriesDescription.readingOrder) {
    html += renderHeading('Reading Order');
    html += '<div style="margin-bottom: ' + SPACING.XLARGE + 'px;">';

    const order = seriesDescription.readingOrder;
    html += renderParagraph(`<strong>Must Read in Order:</strong> ${order.mustReadInOrder ? 'Yes' : 'No'}`, { marginBottom: SPACING.SMALL });

    if (order.reason) {
      html += renderParagraph(`<strong>Reason:</strong> ${order.reason}`, { marginBottom: SPACING.SMALL });
    }
    if (order.newReaderStart) {
      html += renderParagraph(`<strong>New Reader Start:</strong> ${order.newReaderStart}`, { marginBottom: SPACING.SMALL });
    }

    html += '</div>';
  }

  // Series Themes
  if (seriesDescription.seriesThemes && seriesDescription.seriesThemes.length > 0) {
    html += renderHeading('Series Themes');
    html += renderList(seriesDescription.seriesThemes);
  }

  // Target Audience
  if (seriesDescription.targetAudience) {
    html += renderHeading('Target Audience');
    html += renderParagraph(seriesDescription.targetAudience);
  }

  // Comparable Series
  if (seriesDescription.comparableSeries && seriesDescription.comparableSeries.length > 0) {
    html += renderHeading('Comparable Series');
    html += renderList(seriesDescription.comparableSeries);
  }

  // Marketing Hooks
  if (seriesDescription.marketingHooks && seriesDescription.marketingHooks.length > 0) {
    html += renderHeading('Marketing Hooks');
    html += renderList(seriesDescription.marketingHooks);
  }

  // Binge Appeal
  if (seriesDescription.bingeAppeal) {
    html += renderHeading('Binge Appeal');
    html += renderParagraph(seriesDescription.bingeAppeal);
  }

  return html;
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export all functions for use in dashboard-spa.js
window.RenderHelpers = {
  // Constants
  COLORS,
  SPACING,

  // Basic helpers
  renderKeyValue,
  renderHeading,
  renderParagraph,
  renderList,
  renderCodeBlock,
  renderCard,

  // Cover design renderers
  renderCoverVisualConcept,
  renderCoverColorPalette,
  renderCoverTypography,
  renderCoverAIPrompts,
  renderFullCoverBrief,

  // Series description renderers
  renderSeriesBookCard,
  renderSeriesBookArc,
  renderSeriesStrategy
};
