/**
 * Export Routes - Multi-Platform Export Packages (MAN-40, MAN-41, MAN-42)
 *
 * Handles Draft2Digital, IngramSpark, and Apple Books export generation
 */

import { Hono } from 'hono';
import {
  generatePlatformExportPackage,
  listPlatformExportPackages,
  downloadPlatformExportFile
} from '../export-handler.js';

const exports = new Hono();

/**
 * POST /exports/:platform/:manuscriptId
 * Generate export package for a specific platform
 *
 * Platforms: d2d, ingramspark, apple_books
 */
exports.post('/:platform/:manuscriptId', async (c) => {
  try {
    const { platform, manuscriptId } = c.req.param();

    // Validate platform
    const validPlatforms = ['d2d', 'ingramspark', 'apple_books'];
    if (!validPlatforms.includes(platform)) {
      return c.json({
        error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`
      }, 400);
    }

    return await generatePlatformExportPackage(
      c.req.raw,
      c.env,
      platform,
      manuscriptId
    );
  } catch (error) {
    console.error('[ExportRoutes] Error generating export package:', error);
    return c.json({
      error: 'Failed to generate export package',
      details: error.message
    }, 500);
  }
});

/**
 * GET /exports/:platform
 * List all export packages for a platform
 */
exports.get('/:platform', async (c) => {
  try {
    const { platform } = c.req.param();

    // Validate platform
    const validPlatforms = ['d2d', 'ingramspark', 'apple_books'];
    if (!validPlatforms.includes(platform)) {
      return c.json({
        error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`
      }, 400);
    }

    return await listPlatformExportPackages(
      c.req.raw,
      c.env,
      platform
    );
  } catch (error) {
    console.error('[ExportRoutes] Error listing export packages:', error);
    return c.json({
      error: 'Failed to list export packages',
      details: error.message
    }, 500);
  }
});

/**
 * GET /exports/:platform/:packageId/:fileType
 * Download a specific file from an export package
 *
 * fileType: manuscript, cover, interior, readme
 */
exports.get('/:platform/:packageId/:fileType', async (c) => {
  try {
    const { platform, packageId, fileType } = c.req.param();

    // Validate platform
    const validPlatforms = ['d2d', 'ingramspark', 'apple_books'];
    if (!validPlatforms.includes(platform)) {
      return c.json({
        error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`
      }, 400);
    }

    // Validate file type
    const validFileTypes = ['manuscript', 'cover', 'interior', 'readme'];
    if (!validFileTypes.includes(fileType)) {
      return c.json({
        error: `Invalid file type. Must be one of: ${validFileTypes.join(', ')}`
      }, 400);
    }

    return await downloadPlatformExportFile(
      c.req.raw,
      c.env,
      platform,
      packageId,
      fileType
    );
  } catch (error) {
    console.error('[ExportRoutes] Error downloading file:', error);
    return c.json({
      error: 'Failed to download file',
      details: error.message
    }, 500);
  }
});

/**
 * GET /exports/:platform/:packageId
 * Get details about a specific export package
 */
exports.get('/:platform/:packageId', async (c) => {
  try {
    const { platform, packageId } = c.req.param();
    const userId = c.req.header('X-User-Id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Validate platform
    const validPlatforms = ['d2d', 'ingramspark', 'apple_books'];
    if (!validPlatforms.includes(platform)) {
      return c.json({
        error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`
      }, 400);
    }

    const PLATFORM_CONFIG = {
      d2d: { table: 'd2d_export_packages' },
      ingramspark: { table: 'ingramspark_export_packages' },
      apple_books: { table: 'apple_books_export_packages' },
    };

    const config = PLATFORM_CONFIG[platform];

    const pkg = await c.env.DB.prepare(
      `SELECT * FROM ${config.table} WHERE id = ? AND user_id = ?`
    ).bind(packageId, userId).first();

    if (!pkg) {
      return c.json({ error: 'Export package not found' }, 404);
    }

    // Check if expired
    const isExpired = pkg.expires_at < Date.now();

    return c.json({
      success: true,
      package: {
        ...pkg,
        isExpired,
        keywords: pkg.keywords ? JSON.parse(pkg.keywords) : [],
        categories: pkg.categories ? JSON.parse(pkg.categories) : [],
      },
    });
  } catch (error) {
    console.error('[ExportRoutes] Error fetching package details:', error);
    return c.json({
      error: 'Failed to fetch package details',
      details: error.message
    }, 500);
  }
});

export default exports;
