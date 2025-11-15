/**
 * Amazon KDP Package Generator
 * Generates complete KDP submission packages with:
 * - EPUB file (Kindle-compatible)
 * - Cover image (meeting Amazon specs)
 * - Metadata.txt (pre-filled KDP form data)
 * - Instructions.html (step-by-step upload guide)
 * Returns JSON with file contents for client-side ZIP generation
 *
 * Storage: Uses Backblaze B2 via storage adapter
 * - EPUBs: env.R2.getBucket('manuscripts_processed')
 * - Covers: env.R2.getBucket('marketing_assets')
 */

import { generateEPUB } from './epub-generator.js';
import crypto from 'crypto';

/**
 * Amazon KDP Specifications
 */
const KDP_SPECS = {
  // File formats
  MANUSCRIPT_FORMATS: ['epub', 'mobi', 'docx', 'pdf'],
  MAX_FILE_SIZE_MB: 650,

  // Cover specs
  COVER_MIN_WIDTH: 1000,
  COVER_MIN_HEIGHT: 1600,
  COVER_RECOMMENDED_WIDTH: 2560,
  COVER_RECOMMENDED_HEIGHT: 1600,
  COVER_FORMATS: ['jpg', 'jpeg', 'tiff', 'tif'],
  COVER_MAX_SIZE_MB: 50,
  COVER_DPI_MIN: 72,
  COVER_DPI_RECOMMENDED: 300,

  // Metadata limits
  TITLE_MAX_LENGTH: 200,
  SUBTITLE_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 4000,
  AUTHOR_BIO_MAX_LENGTH: 2500,
  KEYWORDS_COUNT: 7,
  KEYWORD_MAX_LENGTH: 50,
  CATEGORIES_MAX: 10,

  // Pricing
  ROYALTY_35_MIN_PRICE: 0.99,
  ROYALTY_35_MAX_PRICE: 200.00,
  ROYALTY_70_MIN_PRICE: 2.99,
  ROYALTY_70_MAX_PRICE: 9.99,
  DELIVERY_COST_PER_MB: 0.15, // For 70% royalty

  // Review timeline
  REVIEW_TIME_HOURS: 72
};

/**
 * Generate complete KDP submission package
 * @param {Object} params - Package parameters
 * @param {string} params.manuscriptId - Manuscript ID
 * @param {string} params.userId - User ID
 * @param {Object} params.metadata - KDP metadata
 * @param {string} params.epubKey - Existing EPUB R2 key (optional)
 * @param {string} params.coverKey - Cover image R2 key
 * @param {Object} env - Cloudflare environment
 * @returns {Object} Package with file contents for ZIP generation
 */
export async function generateKDPPackage(params, env) {
  const {
    manuscriptId,
    userId,
    metadata,
    epubKey,
    coverKey
  } = params;

  try {
    const packageId = `kdp-${crypto.randomUUID()}`;
    const files = {};

    // 1. Get or generate EPUB file
    let epubContent;
    if (epubKey) {
      // Use existing EPUB from formatting engine
      epubContent = await env.R2.getBucket('manuscripts_processed').get(epubKey);
      if (!epubContent) {
        throw new Error('EPUB file not found in storage');
      }
      files.epub = {
        name: `${metadata.title}.epub`,
        content: await epubContent.arrayBuffer(),
        size: epubContent.size
      };
    } else {
      // Generate new EPUB
      const manuscript = await getManuscript(manuscriptId, env);
      const epubResult = await generateEPUB({
        manuscriptId,
        userId,
        title: metadata.title,
        author: metadata.author_name,
        content: manuscript.content,
        options: {
          includeTableOfContents: true,
          includeMetadata: true
        }
      }, env);

      files.epub = {
        name: `${metadata.title}.epub`,
        content: epubResult.buffer,
        size: epubResult.buffer.byteLength
      };
    }

    // 2. Get cover image
    const coverObject = await env.R2.getBucket('marketing_assets').get(coverKey);
    if (!coverObject) {
      throw new Error('Cover image not found in storage');
    }
    const coverBuffer = await coverObject.arrayBuffer();
    files.cover = {
      name: `${metadata.title}_cover.jpg`,
      content: coverBuffer,
      size: coverBuffer.byteLength
    };

    // 3. Generate metadata.txt
    const metadataText = generateMetadataFile(metadata);
    files.metadata = {
      name: 'KDP_Metadata.txt',
      content: metadataText,
      size: metadataText.length
    };

    // 4. Generate instructions.html
    const instructionsHtml = generateInstructionsFile(metadata);
    files.instructions = {
      name: 'KDP_Upload_Instructions.html',
      content: instructionsHtml,
      size: instructionsHtml.length
    };

    // 5. Calculate package stats
    const totalSize = Object.values(files).reduce((sum, file) => sum + file.size, 0);

    return {
      packageId,
      files,
      stats: {
        totalFiles: Object.keys(files).length,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      },
      metadata: {
        title: metadata.title,
        author: metadata.author_name,
        format: 'ebook',
        validationRequired: true
      }
    };
  } catch (error) {
    console.error('Error generating KDP package:', error);
    throw error;
  }
}

/**
 * Generate metadata.txt file with pre-filled KDP form data
 * @param {Object} metadata - KDP metadata
 * @returns {string} Formatted metadata text
 */
function generateMetadataFile(metadata) {
  const lines = [
    '='.repeat(80),
    'AMAZON KDP METADATA - Copy & Paste Ready',
    '='.repeat(80),
    '',
    '=== BOOK DETAILS ===',
    '',
    `Title: ${metadata.title}`,
    metadata.subtitle ? `Subtitle: ${metadata.subtitle}` : '',
    metadata.series_name ? `Series Name: ${metadata.series_name}` : '',
    metadata.series_number ? `Series Number: ${metadata.series_number}` : '',
    `Edition Number: ${metadata.edition_number || 1}`,
    '',
    '=== CONTRIBUTORS ===',
    '',
    `Primary Author: ${metadata.author_name}`,
    metadata.contributors ? `Additional Contributors:\n${formatContributors(metadata.contributors)}` : '',
    '',
    '=== DESCRIPTION ===',
    '',
    metadata.description,
    `(${metadata.description_length || metadata.description.length} / 4000 characters)`,
    '',
    '=== PUBLISHING RIGHTS ===',
    '',
    `Rights: ${formatPublishingRights(metadata.publishing_rights)}`,
    metadata.territories ? `Territories: ${formatTerritories(metadata.territories)}` : '',
    '',
    '=== KEYWORDS (7 phrases max, separate with commas) ===',
    '',
    formatKeywords(metadata.keywords),
    '',
    '=== CATEGORIES ===',
    '',
    `Primary: ${metadata.primary_category || 'Select from KDP dropdown'}`,
    `Secondary: ${metadata.secondary_category || 'Select from KDP dropdown'}`,
    metadata.bisac_codes ? `BISAC Codes: ${metadata.bisac_codes}` : '',
    '',
    '=== AGE & GRADE (if applicable) ===',
    '',
    metadata.age_range_min ? `Age Range: ${metadata.age_range_min}-${metadata.age_range_max} years` : 'N/A',
    metadata.grade_level ? `Grade Level: ${metadata.grade_level}` : 'N/A',
    '',
    '=== CONTENT FLAGS ===',
    '',
    `Adult Content: ${metadata.adult_content ? 'Yes' : 'No'}`,
    `Public Domain: ${metadata.public_domain ? 'Yes' : 'No'}`,
    '',
    '=== ISBN ===',
    '',
    metadata.isbn_type === 'author_owned' ? `Your ISBN: ${metadata.isbn}` : 'Use Amazon Free ISBN',
    '',
    '=== PRICING & ROYALTIES ===',
    '',
    `Royalty Option: ${metadata.royalty_option}%`,
    `USD: $${metadata.price_usd?.toFixed(2) || 'TBD'}`,
    metadata.price_gbp ? `GBP: £${metadata.price_gbp.toFixed(2)}` : '',
    metadata.price_eur ? `EUR: €${metadata.price_eur.toFixed(2)}` : '',
    metadata.price_cad ? `CAD: $${metadata.price_cad.toFixed(2)}` : '',
    metadata.price_aud ? `AUD: $${metadata.price_aud.toFixed(2)}` : '',
    '',
    `KDP Select (Exclusive): ${metadata.kdp_select_enrolled ? 'Yes (90 days)' : 'No'}`,
    `Kindle Book Lending: ${metadata.enable_lending ? 'Enabled' : 'Disabled'}`,
    '',
    '=== PUBLICATION DATE ===',
    '',
    metadata.publication_date ? `Scheduled: ${new Date(metadata.publication_date * 1000).toISOString().split('T')[0]}` : 'Publish Immediately',
    '',
    '=== FILES INCLUDED ===',
    '',
    `✓ ${metadata.title}.epub - Manuscript file`,
    `✓ ${metadata.title}_cover.jpg - Cover image`,
    '',
    '='.repeat(80),
    'END OF METADATA',
    '='.repeat(80)
  ].filter(line => line !== false && line !== '');

  return lines.join('\n');
}

/**
 * Generate step-by-step instructions HTML
 * @param {Object} metadata - KDP metadata
 * @returns {string} HTML instructions
 */
function generateInstructionsFile(metadata) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Amazon KDP Upload Instructions - ${metadata.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 {
      color: #ff9900;
      border-bottom: 3px solid #ff9900;
      padding-bottom: 10px;
    }
    h2 {
      color: #146eb4;
      margin-top: 30px;
    }
    .step {
      background: #f7f7f7;
      border-left: 4px solid #146eb4;
      padding: 15px;
      margin: 20px 0;
    }
    .step-number {
      font-weight: bold;
      color: #146eb4;
      font-size: 1.2em;
    }
    .important {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 10px;
      margin: 10px 0;
    }
    .success {
      background: #d4edda;
      border-left: 4px solid #28a745;
      padding: 10px;
      margin: 10px 0;
    }
    code {
      background: #e9ecef;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    ul {
      margin-left: 20px;
    }
    li {
      margin: 8px 0;
    }
    .checklist {
      list-style-type: none;
      padding-left: 0;
    }
    .checklist li:before {
      content: "☐ ";
      margin-right: 8px;
      font-size: 1.2em;
    }
    .metadata-box {
      background: #f0f0f0;
      border: 1px solid #ccc;
      padding: 15px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      margin: 10px 0;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #666;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <h1>📚 Amazon KDP Upload Instructions</h1>
  <p><strong>Book:</strong> ${metadata.title}</p>
  <p><strong>Author:</strong> ${metadata.author_name}</p>

  <div class="important">
    <strong>⏱️ Estimated Time:</strong> 15-20 minutes<br>
    <strong>📋 Review Time:</strong> 24-72 hours after submission
  </div>

  <h2>Pre-Flight Checklist</h2>
  <ul class="checklist">
    <li>EPUB file ready (<code>${metadata.title}.epub</code>)</li>
    <li>Cover image ready (<code>${metadata.title}_cover.jpg</code>)</li>
    <li>Metadata text file reviewed (<code>KDP_Metadata.txt</code>)</li>
    <li>Amazon KDP account created (or log in to existing account)</li>
    <li>Bank account details ready (for royalty payments)</li>
    <li>Tax information ready (W-9 for US, W-8 for international)</li>
  </ul>

  <h2>Step-by-Step Upload Process</h2>

  <div class="step">
    <span class="step-number">Step 1:</span> <strong>Access Amazon KDP</strong>
    <ol>
      <li>Go to <a href="https://kdp.amazon.com" target="_blank">https://kdp.amazon.com</a></li>
      <li>Sign in with your Amazon account</li>
      <li>Click <strong>"Create New Title"</strong> or <strong>"+ Kindle eBook"</strong></li>
    </ol>
  </div>

  <div class="step">
    <span class="step-number">Step 2:</span> <strong>Enter Kindle eBook Details</strong>
    <p>Open <code>KDP_Metadata.txt</code> and copy/paste the following fields:</p>
    <ul>
      <li><strong>Title:</strong> ${metadata.title}</li>
      ${metadata.subtitle ? `<li><strong>Subtitle:</strong> ${metadata.subtitle}</li>` : ''}
      ${metadata.series_name ? `<li><strong>Series:</strong> ${metadata.series_name} #${metadata.series_number}</li>` : ''}
      <li><strong>Edition Number:</strong> ${metadata.edition_number || 1}</li>
      <li><strong>Author:</strong> ${metadata.author_name}</li>
      <li><strong>Description:</strong> Copy from metadata file (${metadata.description_length || metadata.description.length}/4000 chars)</li>
    </ul>
  </div>

  <div class="step">
    <span class="step-number">Step 3:</span> <strong>Publishing Rights</strong>
    <ul>
      <li>Select: <strong>"${formatPublishingRights(metadata.publishing_rights)}"</strong></li>
      ${metadata.isbn_type === 'author_owned' ? `<li>ISBN: <strong>${metadata.isbn}</strong></li>` : '<li>Select: <strong>"Assign me a free Amazon ISBN"</strong></li>'}
      <li>Publication Date: <strong>${metadata.publication_date ? new Date(metadata.publication_date * 1000).toISOString().split('T')[0] : 'Publish when ready'}</strong></li>
    </ul>
  </div>

  <div class="step">
    <span class="step-number">Step 4:</span> <strong>Keywords & Categories</strong>
    <p><strong>Keywords (up to 7):</strong></p>
    <div class="metadata-box">${formatKeywords(metadata.keywords)}</div>
    <p><strong>Categories:</strong></p>
    <ul>
      <li>Browse KDP category tree and select: <strong>${metadata.primary_category || 'Select appropriate category'}</strong></li>
      ${metadata.secondary_category ? `<li>Second category: <strong>${metadata.secondary_category}</strong></li>` : ''}
    </ul>
    ${metadata.age_range_min ? `<p><strong>Age Range:</strong> ${metadata.age_range_min}-${metadata.age_range_max} years</p>` : ''}
  </div>

  <div class="step">
    <span class="step-number">Step 5:</span> <strong>Upload Manuscript & Cover</strong>
    <ol>
      <li>Click <strong>"Upload eBook manuscript"</strong></li>
      <li>Select file: <code>${metadata.title}.epub</code></li>
      <li>Wait for upload to complete (Amazon will convert your file)</li>
      <li>Click <strong>"Upload a cover you already have"</strong></li>
      <li>Select file: <code>${metadata.title}_cover.jpg</code></li>
      <li>Review the preview using <strong>"Launch Previewer"</strong></li>
    </ol>
    <div class="important">
      <strong>⚠️ Important:</strong> Check the preview carefully for formatting issues, missing images, or broken links.
    </div>
  </div>

  <div class="step">
    <span class="step-number">Step 6:</span> <strong>Pricing & Royalties</strong>
    <ul>
      <li><strong>KDP Select Enrollment:</strong> ${metadata.kdp_select_enrolled ? 'Yes (90-day exclusivity)' : 'No'}</li>
      <li><strong>Territories:</strong> ${formatPublishingRights(metadata.publishing_rights)}</li>
      <li><strong>Royalty Plan:</strong> <strong>${metadata.royalty_option}%</strong></li>
      <li><strong>Pricing:</strong>
        <ul>
          <li>USD: <strong>$${metadata.price_usd?.toFixed(2) || 'TBD'}</strong></li>
          ${metadata.price_gbp ? `<li>GBP: <strong>£${metadata.price_gbp.toFixed(2)}</strong></li>` : ''}
          ${metadata.price_eur ? `<li>EUR: <strong>€${metadata.price_eur.toFixed(2)}</strong></li>` : ''}
        </ul>
      </li>
      <li><strong>Kindle Book Lending:</strong> ${metadata.enable_lending ? 'Enabled' : 'Disabled'}</li>
    </ul>
    <div class="important">
      <strong>💡 Tip:</strong> For ${metadata.royalty_option}% royalty, your price must be between $${metadata.royalty_option === '70' ? '2.99 and $9.99' : '0.99 and $200.00'}.
    </div>
  </div>

  <div class="step">
    <span class="step-number">Step 7:</span> <strong>Review & Publish</strong>
    <ol>
      <li>Click <strong>"Save and Continue"</strong></li>
      <li>Review all information on the summary page</li>
      <li>Check for any warnings or errors (must be resolved before publishing)</li>
      <li>Click <strong>"Publish Your Kindle eBook"</strong></li>
    </ol>
    <div class="success">
      <strong>✅ Success!</strong> Your book is now in Amazon's review queue.
    </div>
  </div>

  <h2>What Happens Next?</h2>
  <ul>
    <li><strong>Review Time:</strong> 24-72 hours (usually within 48 hours)</li>
    <li><strong>Email Notification:</strong> You'll receive an email when your book goes live</li>
    <li><strong>Book Page:</strong> Your book will be available at amazon.com/dp/[ASIN]</li>
    <li><strong>Royalty Payments:</strong> Monthly, 60 days after end of month of sale</li>
  </ul>

  <h2>Troubleshooting Common Issues</h2>
  <div class="step">
    <strong>❌ File Upload Failed</strong>
    <ul>
      <li>Check file size (must be under 650 MB)</li>
      <li>Verify EPUB file opens in a reader (Calibre, Apple Books)</li>
      <li>Try re-uploading after 5 minutes</li>
    </ul>
  </div>

  <div class="step">
    <strong>❌ Cover Rejected</strong>
    <ul>
      <li>Minimum dimensions: 1000x1600px</li>
      <li>Recommended: 2560x1600px at 300 DPI</li>
      <li>Format: JPG or TIFF</li>
      <li>File size: Under 50 MB</li>
    </ul>
  </div>

  <div class="step">
    <strong>❌ Content Rejected</strong>
    <ul>
      <li>Check for missing pages or chapters</li>
      <li>Verify table of contents links work</li>
      <li>Ensure all images are embedded properly</li>
      <li>Review Amazon's content guidelines</li>
    </ul>
  </div>

  <h2>Additional Resources</h2>
  <ul>
    <li><a href="https://kdp.amazon.com/help" target="_blank">Amazon KDP Help Center</a></li>
    <li><a href="https://kdp.amazon.com/help?topicId=A29FL26OKE7R7B" target="_blank">Kindle Publishing Guidelines</a></li>
    <li><a href="https://kdp.amazon.com/help?topicId=A2GF0UFHIYG9VQ" target="_blank">Cover Creator Tool</a></li>
    <li><a href="https://kdp.amazon.com/help?topicId=A3RWH3C8QLOWP4" target="_blank">Previewer Help</a></li>
  </ul>

  <div class="footer">
    <p>Generated by Manuscript Platform | Amazon KDP Integration</p>
    <p>Good luck with your book launch! 🚀</p>
  </div>
</body>
</html>`;
}

/**
 * Helper: Format contributors list
 */
function formatContributors(contributors) {
  try {
    const list = typeof contributors === 'string' ? JSON.parse(contributors) : contributors;
    return list.map(c => `  ${c.name} (${c.role})`).join('\n');
  } catch {
    return contributors;
  }
}

/**
 * Helper: Format publishing rights
 */
function formatPublishingRights(rights) {
  const map = {
    'worldwide': 'Worldwide rights',
    'territories_included': 'Specific territories (included)',
    'territories_excluded': 'All territories except (excluded)'
  };
  return map[rights] || rights;
}

/**
 * Helper: Format territories list
 */
function formatTerritories(territories) {
  try {
    const list = typeof territories === 'string' ? JSON.parse(territories) : territories;
    return list.join(', ');
  } catch {
    return territories;
  }
}

/**
 * Helper: Format keywords
 */
function formatKeywords(keywords) {
  try {
    const list = typeof keywords === 'string' ? JSON.parse(keywords) : keywords;
    return list.join(', ');
  } catch {
    return keywords;
  }
}

/**
 * Helper: Get manuscript from database
 */
async function getManuscript(manuscriptId, env) {
  const result = await env.DB.prepare(
    'SELECT * FROM manuscripts WHERE id = ?'
  ).bind(manuscriptId).first();

  if (!result) {
    throw new Error('Manuscript not found');
  }

  return result;
}

/**
 * Validate KDP package against Amazon specs
 * @param {Object} params - Validation parameters
 * @param {Object} env - Cloudflare environment
 * @returns {Object} Validation results
 */
export async function validateKDPPackage(params, env) {
  const { packageId, epubKey, coverKey, metadata } = params;
  const issues = [];
  const recommendations = [];

  try {
    // Validate EPUB
    if (epubKey) {
      const epubObject = await env.R2.getBucket('manuscripts_processed').get(epubKey);
      if (epubObject) {
        const sizeMB = epubObject.size / (1024 * 1024);
        if (sizeMB > KDP_SPECS.MAX_FILE_SIZE_MB) {
          issues.push({
            type: 'file_format',
            severity: 'error',
            message: `EPUB file is ${sizeMB.toFixed(2)} MB (max: ${KDP_SPECS.MAX_FILE_SIZE_MB} MB)`
          });
        }
      } else {
        issues.push({
          type: 'file_format',
          severity: 'error',
          message: 'EPUB file not found'
        });
      }
    }

    // Validate cover image
    if (coverKey) {
      const coverObject = await env.R2.getBucket('marketing_assets').get(coverKey);
      if (coverObject) {
        const sizeMB = coverObject.size / (1024 * 1024);
        if (sizeMB > KDP_SPECS.COVER_MAX_SIZE_MB) {
          issues.push({
            type: 'cover_specs',
            severity: 'error',
            message: `Cover file is ${sizeMB.toFixed(2)} MB (max: ${KDP_SPECS.COVER_MAX_SIZE_MB} MB)`
          });
        }
        // Note: Cannot validate dimensions without image processing library
        recommendations.push({
          type: 'cover_specs',
          message: `Ensure cover is at least ${KDP_SPECS.COVER_RECOMMENDED_WIDTH}x${KDP_SPECS.COVER_RECOMMENDED_HEIGHT}px at 300 DPI`
        });
      } else {
        issues.push({
          type: 'cover_specs',
          severity: 'error',
          message: 'Cover image not found'
        });
      }
    }

    // Validate metadata
    if (metadata.title.length > KDP_SPECS.TITLE_MAX_LENGTH) {
      issues.push({
        type: 'metadata',
        severity: 'error',
        message: `Title is ${metadata.title.length} characters (max: ${KDP_SPECS.TITLE_MAX_LENGTH})`
      });
    }

    if (metadata.subtitle && metadata.subtitle.length > KDP_SPECS.SUBTITLE_MAX_LENGTH) {
      issues.push({
        type: 'metadata',
        severity: 'error',
        message: `Subtitle is ${metadata.subtitle.length} characters (max: ${KDP_SPECS.SUBTITLE_MAX_LENGTH})`
      });
    }

    if (metadata.description.length > KDP_SPECS.DESCRIPTION_MAX_LENGTH) {
      issues.push({
        type: 'metadata',
        severity: 'error',
        message: `Description is ${metadata.description.length} characters (max: ${KDP_SPECS.DESCRIPTION_MAX_LENGTH})`
      });
    }

    if (metadata.description.length < 200) {
      recommendations.push({
        type: 'metadata',
        message: 'Description is quite short. Aim for 300-500 words for better discoverability.'
      });
    }

    // Validate keywords
    const keywords = typeof metadata.keywords === 'string' ? JSON.parse(metadata.keywords) : metadata.keywords;
    if (keywords.length > KDP_SPECS.KEYWORDS_COUNT) {
      issues.push({
        type: 'metadata',
        severity: 'error',
        message: `You have ${keywords.length} keywords (max: ${KDP_SPECS.KEYWORDS_COUNT})`
      });
    }

    keywords.forEach((kw, idx) => {
      if (kw.length > KDP_SPECS.KEYWORD_MAX_LENGTH) {
        issues.push({
          type: 'metadata',
          severity: 'warning',
          message: `Keyword ${idx + 1} is ${kw.length} characters (max: ${KDP_SPECS.KEYWORD_MAX_LENGTH})`
        });
      }
    });

    // Validate pricing
    if (metadata.royalty_option === '70') {
      if (metadata.price_usd < KDP_SPECS.ROYALTY_70_MIN_PRICE || metadata.price_usd > KDP_SPECS.ROYALTY_70_MAX_PRICE) {
        issues.push({
          type: 'metadata',
          severity: 'error',
          message: `Price $${metadata.price_usd} is outside 70% royalty range ($${KDP_SPECS.ROYALTY_70_MIN_PRICE}-$${KDP_SPECS.ROYALTY_70_MAX_PRICE})`
        });
      }
    } else if (metadata.royalty_option === '35') {
      if (metadata.price_usd < KDP_SPECS.ROYALTY_35_MIN_PRICE || metadata.price_usd > KDP_SPECS.ROYALTY_35_MAX_PRICE) {
        issues.push({
          type: 'metadata',
          severity: 'error',
          message: `Price $${metadata.price_usd} is outside 35% royalty range ($${KDP_SPECS.ROYALTY_35_MIN_PRICE}-$${KDP_SPECS.ROYALTY_35_MAX_PRICE})`
        });
      }
    }

    // Determine pass/fail
    const hasErrors = issues.some(issue => issue.severity === 'error');
    const status = hasErrors ? 'fail' : (issues.length > 0 ? 'warning' : 'pass');

    return {
      status,
      issues,
      recommendations,
      summary: {
        totalIssues: issues.length,
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        recommendations: recommendations.length
      }
    };
  } catch (error) {
    console.error('Error validating KDP package:', error);
    return {
      status: 'fail',
      issues: [{
        type: 'full_package',
        severity: 'error',
        message: `Validation error: ${error.message}`
      }],
      recommendations: [],
      summary: { totalIssues: 1, errors: 1, warnings: 0, recommendations: 0 }
    };
  }
}

/**
 * Calculate royalty estimates
 * @param {Object} params - Royalty calculation parameters
 * @param {number} params.priceUSD - Book price in USD
 * @param {string} params.royaltyOption - '35' or '70'
 * @param {number} params.fileSizeMB - File size in MB
 * @returns {Object} Royalty calculations
 */
export function calculateRoyalties(params) {
  const { priceUSD, royaltyOption, fileSizeMB } = params;

  let deliveryCost = 0;
  let royaltyPerSale = 0;

  if (royaltyOption === '70') {
    // 70% royalty has delivery cost
    deliveryCost = fileSizeMB * KDP_SPECS.DELIVERY_COST_PER_MB;
    royaltyPerSale = (priceUSD * 0.70) - deliveryCost;
  } else {
    // 35% royalty has no delivery cost
    royaltyPerSale = priceUSD * 0.35;
  }

  // Determine recommended royalty option
  const royalty70Estimate = (priceUSD * 0.70) - (fileSizeMB * KDP_SPECS.DELIVERY_COST_PER_MB);
  const royalty35Estimate = priceUSD * 0.35;
  const isEligibleFor70 = priceUSD >= KDP_SPECS.ROYALTY_70_MIN_PRICE && priceUSD <= KDP_SPECS.ROYALTY_70_MAX_PRICE;

  let recommendedRoyalty = '35';
  let recommendationReason = '35% royalty selected';

  if (isEligibleFor70 && royalty70Estimate > royalty35Estimate) {
    recommendedRoyalty = '70';
    recommendationReason = `70% royalty earns $${(royalty70Estimate - royalty35Estimate).toFixed(2)} more per sale`;
  } else if (isEligibleFor70 && royalty70Estimate <= royalty35Estimate) {
    recommendedRoyalty = '35';
    recommendationReason = `35% royalty earns more due to high delivery cost (file size: ${fileSizeMB.toFixed(2)} MB)`;
  } else if (!isEligibleFor70) {
    recommendedRoyalty = '35';
    recommendationReason = `Price $${priceUSD} is outside 70% royalty range ($${KDP_SPECS.ROYALTY_70_MIN_PRICE}-$${KDP_SPECS.ROYALTY_70_MAX_PRICE})`;
  }

  return {
    priceUSD,
    royaltyOption,
    deliveryCostUSD: deliveryCost,
    royaltyPerSaleUSD: Math.max(royaltyPerSale, 0), // Can't be negative
    netRoyaltyUSD: Math.max(royaltyPerSale, 0),
    fileSizeMB,
    recommendedRoyalty,
    recommendationReason,
    comparisons: {
      royalty70: isEligibleFor70 ? royalty70Estimate : null,
      royalty35: royalty35Estimate
    },
    limits: {
      minimum_price_35: KDP_SPECS.ROYALTY_35_MIN_PRICE,
      maximum_price_35: KDP_SPECS.ROYALTY_35_MAX_PRICE,
      minimum_price_70: KDP_SPECS.ROYALTY_70_MIN_PRICE,
      maximum_price_70: KDP_SPECS.ROYALTY_70_MAX_PRICE
    }
  };
}

export { KDP_SPECS };
