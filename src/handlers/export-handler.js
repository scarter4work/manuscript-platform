/**
 * Unified Export Handler (MAN-40, MAN-41, MAN-42)
 *
 * Handles export package generation for all platforms:
 * - Draft2Digital (MAN-40)
 * - IngramSpark (MAN-41)
 * - Apple Books (MAN-42)
 */

import { generateExportPackage } from './document-processor.js';
import crypto from 'crypto';

/**
 * Platform configuration
 */
const PLATFORM_CONFIG = {
  d2d: {
    name: 'Draft2Digital',
    table: 'd2d_export_packages',
    publishType: 'ebook',
    defaultFormat: 'docx', // D2D accepts DOCX and auto-converts
  },
  ingramspark: {
    name: 'IngramSpark',
    table: 'ingramspark_export_packages',
    publishType: 'print', // Can also do ebook (EPUB)
    requiresPageCount: true,
  },
  apple_books: {
    name: 'Apple Books',
    table: 'apple_books_export_packages',
    publishType: 'ebook',
    defaultFormat: 'epub', // Apple requires EPUB
  },
};

/**
 * Generate export package for a platform
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Cloudflare environment
 * @param {string} platformId - Platform identifier (d2d, ingramspark, apple_books)
 * @param {string} manuscriptId - Manuscript ID
 * @returns {Response}
 */
export async function generatePlatformExportPackage(request, env, platformId, manuscriptId) {
  const userId = request?.headers?.get('X-User-Id');

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const config = PLATFORM_CONFIG[platformId];
  if (!config) {
    return new Response(JSON.stringify({ error: `Invalid platform: ${platformId}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get analysis results for metadata
    const analysis = await env.DB.prepare(
      'SELECT * FROM manuscript_analyses WHERE manuscript_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(manuscriptId).first();

    // Parse request body for format options
    const body = await request.json().catch(() => ({}));
    const formatOptions = body.formatOptions || {};

    // Fetch manuscript file from R2
    const manuscriptKey = `manuscripts/${userId}/${manuscriptId}/edited.docx`;
    const manuscriptObj = await env.R2.getBucket('manuscripts_processed').get(manuscriptKey);

    if (!manuscriptObj) {
      return new Response(JSON.stringify({ error: 'Manuscript file not found in storage' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const manuscriptBuffer = await manuscriptObj.arrayBuffer();

    // Fetch cover if available
    let coverBuffer = null;
    const coverKey = `assets/${userId}/${manuscriptId}/cover.jpg`;
    const coverObj = await env.R2.getBucket('marketing_assets').get(coverKey);

    if (coverObj) {
      coverBuffer = await coverObj.arrayBuffer();
    }

    // Build metadata from manuscript and analysis
    const metadata = {
      title: manuscript.title || 'Untitled',
      author: body.author || 'Author',
      description: body.description || (analysis?.market_analysis ? JSON.parse(analysis.market_analysis).description : ''),
      keywords: body.keywords || (analysis?.keywords ? JSON.parse(analysis.keywords) : []),
      categories: body.categories || [],
      ...body.metadata,
    };

    // Platform-specific metadata
    if (platformId === 'ingramspark') {
      if (!body.pageCount) {
        return new Response(JSON.stringify({ error: 'Page count is required for IngramSpark' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      metadata.publishType = body.publishType || 'print';
      formatOptions.trimSize = body.trimSize || '6x9';
      formatOptions.pageCount = body.pageCount;
      formatOptions.paperType = body.paperType || 'cream_60';
      formatOptions.includeBleed = true;
    }

    // Generate export package using document processor
    console.log(`[ExportHandler] Generating ${config.name} export for ${manuscriptId}...`);

    const exportPackage = await generateExportPackage({
      platform: platformId,
      publishType: config.publishType,
      manuscriptBuffer: Buffer.from(manuscriptBuffer),
      manuscriptType: 'docx',
      coverBuffer: coverBuffer ? Buffer.from(coverBuffer) : null,
      metadata,
      formatOptions,
    });

    // Generate package ID
    const packageId = crypto.randomUUID();

    // Store files in R2
    const basePath = `exports/${platformId}/${userId}/${packageId}`;

    if (exportPackage.files.manuscript) {
      await env.R2.getBucket('marketing_assets').put(
        `${basePath}/${exportPackage.files.manuscriptName}`,
        exportPackage.files.manuscript
      );
    }

    if (exportPackage.files.cover) {
      await env.R2.getBucket('marketing_assets').put(
        `${basePath}/${exportPackage.files.coverName}`,
        exportPackage.files.cover
      );
    }

    if (exportPackage.files.interior) {
      await env.R2.getBucket('marketing_assets').put(
        `${basePath}/${exportPackage.files.interiorName}`,
        exportPackage.files.interior
      );
    }

    // Generate README
    const readme = generateReadme(platformId, metadata, exportPackage);
    await env.R2.getBucket('marketing_assets').put(`${basePath}/README.txt`, readme);

    // Store package record in database
    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days

    const packageData = {
      id: packageId,
      manuscript_id: manuscriptId,
      user_id: userId,
      status: 'ready',
      title: metadata.title,
      author: metadata.author,
      description: metadata.description,
      keywords: JSON.stringify(metadata.keywords || []),
      categories: JSON.stringify(metadata.categories || []),
      has_manuscript: exportPackage.files.manuscript ? 1 : 0,
      has_cover: exportPackage.files.cover ? 1 : 0,
      format_options: JSON.stringify(formatOptions),
      generated_at: Date.now(),
      expires_at: expiresAt,
    };

    // Platform-specific fields
    if (platformId === 'd2d') {
      packageData.manuscript_format = exportPackage.files.manuscriptType;
      packageData.cover_format = exportPackage.files.coverType;
      packageData.series_name = metadata.series_name || null;
      packageData.series_number = metadata.series_number || null;
      packageData.pricing_data = JSON.stringify(body.pricing || {});
    } else if (platformId === 'ingramspark') {
      packageData.trim_size = formatOptions.trimSize;
      packageData.page_count = formatOptions.pageCount;
      packageData.paper_type = formatOptions.paperType;
      packageData.binding_type = body.bindingType || 'paperback';
      packageData.color_interior = body.colorInterior || 0;
      packageData.has_interior_pdf = exportPackage.files.interior ? 1 : 0;
      packageData.has_cover_pdf = exportPackage.files.cover ? 1 : 0;
      packageData.returnable = body.returnable || 0;
      packageData.discount_percentage = body.discountPercentage || 55;
      packageData.distribution_territories = JSON.stringify(body.territories || ['US', 'UK', 'CA', 'AU']);
      packageData.isbn = metadata.isbn || null;

      if (exportPackage.spineInfo) {
        packageData.spine_width_inches = exportPackage.spineInfo.spineWidthInches;
        packageData.spine_calculation_data = JSON.stringify(exportPackage.spineInfo);
      }
    } else if (platformId === 'apple_books') {
      packageData.has_epub = exportPackage.files.manuscript ? 1 : 0;
      packageData.epub_version = '3.0';
      packageData.validation_status = exportPackage.validation?.valid ? 'passed' : 'failed';
      packageData.validation_errors = JSON.stringify(exportPackage.validation?.errors || []);
      packageData.series_name = metadata.series_name || null;
      packageData.series_number = metadata.series_number || null;
      packageData.language = metadata.language || 'en';
      packageData.age_rating = body.ageRating || null;
      packageData.explicit_content = body.explicitContent || 0;
    }

    // Build INSERT query dynamically based on platform
    const fields = Object.keys(packageData);
    const placeholders = fields.map(() => '?').join(', ');

    await env.DB.prepare(
      `INSERT INTO ${config.table} (${fields.join(', ')}) VALUES (${placeholders})`
    ).bind(...fields.map(f => packageData[f])).run();

    console.log(`[ExportHandler] ${config.name} export package created: ${packageId}`);

    return new Response(JSON.stringify({
      success: true,
      packageId,
      platform: platformId,
      platformName: config.name,
      files: {
        manuscript: exportPackage.files.manuscriptName,
        cover: exportPackage.files.coverName,
        interior: exportPackage.files.interiorName,
      },
      validation: exportPackage.validation,
      expiresAt,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`[ExportHandler] Error generating ${platformId} export:`, error);

    return new Response(JSON.stringify({
      error: 'Failed to generate export package',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * List export packages for a platform
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Cloudflare environment
 * @param {string} platformId - Platform identifier
 * @returns {Response}
 */
export async function listPlatformExportPackages(request, env, platformId) {
  const userId = request?.headers?.get('X-User-Id');

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const config = PLATFORM_CONFIG[platformId];
  if (!config) {
    return new Response(JSON.stringify({ error: `Invalid platform: ${platformId}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const packages = await env.DB.prepare(
      `SELECT * FROM ${config.table} WHERE user_id = ? ORDER BY created_at DESC`
    ).bind(userId).all();

    return new Response(JSON.stringify({
      platform: platformId,
      platformName: config.name,
      packages: packages.results.map(pkg => ({
        ...pkg,
        keywords: pkg.keywords ? JSON.parse(pkg.keywords) : [],
        categories: pkg.categories ? JSON.parse(pkg.categories) : [],
        format_options: pkg.format_options ? JSON.parse(pkg.format_options) : {},
        isExpired: pkg.expires_at < Date.now(),
      })),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`[ExportHandler] Error listing ${platformId} packages:`, error);

    return new Response(JSON.stringify({ error: 'Failed to list packages' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Download export package file
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Cloudflare environment
 * @param {string} platformId - Platform identifier
 * @param {string} packageId - Package ID
 * @param {string} fileType - File type (manuscript, cover, interior, readme)
 * @returns {Response}
 */
export async function downloadPlatformExportFile(request, env, platformId, packageId, fileType) {
  const userId = request?.headers?.get('X-User-Id');

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const config = PLATFORM_CONFIG[platformId];
  if (!config) {
    return new Response(JSON.stringify({ error: `Invalid platform: ${platformId}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get package
    const pkg = await env.DB.prepare(
      `SELECT * FROM ${config.table} WHERE id = ? AND user_id = ?`
    ).bind(packageId, userId).first();

    if (!pkg) {
      return new Response(JSON.stringify({ error: 'Package not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check expiration
    if (pkg.expires_at < Date.now()) {
      return new Response(JSON.stringify({ error: 'Package expired' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Determine file key
    const basePath = `exports/${platformId}/${userId}/${packageId}`;
    let fileKey, contentType, filename;

    if (fileType === 'readme') {
      fileKey = `${basePath}/README.txt`;
      contentType = 'text/plain';
      filename = 'README.txt';
    } else if (fileType === 'manuscript') {
      const format = pkg.manuscript_format || 'docx';
      fileKey = `${basePath}/${pkg.title}.${format}`;
      contentType = format === 'epub' ? 'application/epub+zip' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      filename = `${pkg.title}.${format}`;
    } else if (fileType === 'cover') {
      const format = pkg.cover_format || 'jpg';
      fileKey = `${basePath}/cover.${format}`;
      contentType = `image/${format}`;
      filename = `cover.${format}`;
    } else if (fileType === 'interior') {
      fileKey = `${basePath}/interior.pdf`;
      contentType = 'application/pdf';
      filename = 'interior.pdf';
    } else {
      return new Response(JSON.stringify({ error: 'Invalid file type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch file from R2
    const fileObj = await env.R2.getBucket('marketing_assets').get(fileKey);

    if (!fileObj) {
      return new Response(JSON.stringify({ error: 'File not found in storage' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update download count
    await env.DB.prepare(
      `UPDATE ${config.table} SET download_count = download_count + 1, last_downloaded_at = ? WHERE id = ?`
    ).bind(Date.now(), packageId).run();

    return new Response(fileObj.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error(`[ExportHandler] Error downloading ${platformId} file:`, error);

    return new Response(JSON.stringify({ error: 'Failed to download file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Generate README file for export package
 *
 * @param {string} platformId - Platform identifier
 * @param {Object} metadata - Book metadata
 * @param {Object} exportPackage - Export package
 * @returns {string} - README content
 */
function generateReadme(platformId, metadata, exportPackage) {
  const config = PLATFORM_CONFIG[platformId];
  const date = new Date().toISOString().split('T')[0];

  let readme = `${config.name} Export Package
Generated: ${date}

Book: ${metadata.title}
Author: ${metadata.author}

Files Included:
`;

  if (exportPackage.files.manuscript) {
    readme += `- ${exportPackage.files.manuscriptName}\n`;
  }

  if (exportPackage.files.cover) {
    readme += `- ${exportPackage.files.coverName}\n`;
  }

  if (exportPackage.files.interior) {
    readme += `- ${exportPackage.files.interiorName}\n`;
  }

  readme += `\nUpload Instructions:\n\n`;

  if (platformId === 'd2d') {
    readme += `1. Log into Draft2Digital at https://draft2digital.com
2. Click "Books" > "Add New Book"
3. Upload your manuscript file
4. Upload your cover image
5. Fill in book details (title, author, description, categories)
6. Set pricing by territory
7. Select distribution channels
8. Review and publish
`;
  } else if (platformId === 'ingramspark') {
    readme += `1. Log into IngramSpark at https://www.ingramspark.com
2. Click "Add a New Title"
3. Fill in title information
4. Upload Interior PDF
5. Upload Cover PDF
6. Review specifications:
   - Trim Size: ${exportPackage.metadata?.trimSize || '6x9'}
   - Page Count: ${exportPackage.metadata?.pageCount || 'N/A'}
${exportPackage.spineInfo ? `   - Spine Width: ${exportPackage.spineInfo.spineWidthInches.toFixed(3)}"\n` : ''}
7. Set pricing and distribution
8. Review and submit for approval
`;
  } else if (platformId === 'apple_books') {
    readme += `1. Log into Apple Books Partner at https://itunespartner.apple.com/books
2. Click "Add Book"
3. Upload your EPUB file
4. Upload cover image
5. Fill in metadata:
   - Title, author, description
   - Categories, keywords
   - Language, age rating
6. Set pricing by territory
7. Review and publish
`;
  }

  readme += `\nNotes:
- This package expires 30 days after generation
- All files meet ${config.name} technical requirements
- Validation ${exportPackage.validation?.valid ? 'passed' : 'had warnings/errors'}
`;

  if (!exportPackage.validation?.valid) {
    readme += `\nValidation Issues:\n`;
    exportPackage.validation.errors?.forEach(err => {
      readme += `- ${err}\n`;
    });
    exportPackage.validation.warnings?.forEach(warn => {
      readme += `- WARNING: ${warn}\n`;
    });
  }

  return readme;
}

export const exportHandlers = {
  generatePlatformExportPackage,
  listPlatformExportPackages,
  downloadPlatformExportFile,
};
