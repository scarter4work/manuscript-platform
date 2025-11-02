// Package Handlers
// API endpoints for downloading platform-specific export packages

import { getUserFromRequest } from '../utils/auth-utils.js';
import {
  createPlatformPackage,
  createAllPlatformsBundle,
  getAvailablePlatforms,
  getPlatformInfo,
} from '../managers/package-manager.js';

/**
 * Download a specific platform package
 * GET /manuscripts/:id/packages/:platform
 */
export async function downloadPlatformPackage(request, env, manuscriptId, platform) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verify manuscript belongs to user
    const manuscript = await env.DB.prepare(
      'SELECT id, user_id, title FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (manuscript.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate platform
    if (!getAvailablePlatforms().includes(platform)) {
      return new Response(
        JSON.stringify({ error: 'Invalid platform', availablePlatforms: getAvailablePlatforms() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create package
    const packageData = await createPlatformPackage(env, manuscriptId, user.id, platform);

    // Log download
    await logPackageDownload(env, user.id, manuscriptId, platform, 'single');

    // Return ZIP file
    return new Response(packageData.buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${packageData.filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error creating platform package:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create package', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Download all platforms bundle
 * GET /manuscripts/:id/packages/all
 */
export async function downloadAllPlatformsBundle(request, env, manuscriptId) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verify manuscript belongs to user
    const manuscript = await env.DB.prepare(
      'SELECT id, user_id, title FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (manuscript.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get selected platforms from query params (or default to all)
    const url = new URL(request.url);
    const platformsParam = url.searchParams.get('platforms');
    const platforms = platformsParam
      ? platformsParam.split(',').filter(p => getAvailablePlatforms().includes(p))
      : getAvailablePlatforms();

    if (platforms.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid platforms specified' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create bundle
    const bundleData = await createAllPlatformsBundle(env, manuscriptId, user.id, platforms);

    // Log download
    await logPackageDownload(env, user.id, manuscriptId, platforms.join(','), 'bundle');

    // Return ZIP file
    return new Response(bundleData.buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${bundleData.filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error creating all-platforms bundle:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create bundle', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get available packages for a manuscript
 * GET /manuscripts/:id/packages
 */
export async function getAvailablePackages(request, env, manuscriptId) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verify manuscript belongs to user
    const manuscript = await env.DB.prepare(
      'SELECT id, user_id, title, filename, cover_image_key FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (manuscript.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get platform information
    const platforms = getAvailablePlatforms();
    const platformDetails = platforms.map(p => {
      const info = getPlatformInfo(p);
      return {
        platform: p,
        name: info.name,
        files: info.files,
        available: true, // Could add logic to check if all required files exist
      };
    });

    return new Response(
      JSON.stringify({
        manuscriptId: manuscript.id,
        manuscriptTitle: manuscript.title,
        platforms: platformDetails,
        hasManuscript: !!manuscript.filename,
        hasCover: !!manuscript.cover_image_key,
        downloadUrls: {
          allPlatforms: `/manuscripts/${manuscriptId}/packages/all`,
          individual: platforms.reduce((acc, p) => {
            acc[p] = `/manuscripts/${manuscriptId}/packages/${p}`;
            return acc;
          }, {}),
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting available packages:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get packages' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get package download analytics
 * GET /manuscripts/:id/packages/analytics
 */
export async function getPackageAnalytics(request, env, manuscriptId) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verify manuscript belongs to user
    const manuscript = await env.DB.prepare(
      'SELECT id, user_id FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (manuscript.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get download logs (if table exists)
    // For now, return placeholder data
    return new Response(
      JSON.stringify({
        manuscriptId: manuscript.id,
        totalDownloads: 0,
        platformBreakdown: {},
        recentDownloads: [],
        note: 'Analytics tracking will be implemented in future version',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting package analytics:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get analytics' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Log package download for analytics
 * (Internal function)
 */
async function logPackageDownload(env, userId, manuscriptId, platform, type) {
  try {
    // Could store in D1 or KV for analytics
    // For now, just log to console
    console.log(`[Package Download] User: ${userId}, Manuscript: ${manuscriptId}, Platform: ${platform}, Type: ${type}`);

    // Could implement:
    // await env.DB.prepare(`
    //   INSERT INTO package_downloads (user_id, manuscript_id, platform, type, downloaded_at)
    //   VALUES (?, ?, ?, ?, ?)
    // `).bind(userId, manuscriptId, platform, type, Math.floor(Date.now() / 1000)).run();
  } catch (error) {
    console.error('Error logging download:', error);
    // Don't fail the request if logging fails
  }
}

export const packageHandlers = {
  downloadPlatformPackage,
  downloadAllPlatformsBundle,
  getAvailablePackages,
  getPackageAnalytics,
};
