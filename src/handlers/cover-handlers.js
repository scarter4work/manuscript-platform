// Cover Handlers
// API endpoints for cover image upload, validation, and processing

import { getUserFromRequest } from './auth-utils.js';
import { validateCoverImage, calculateSpineWidth, PAPER_TYPES } from './cover-processor.js';
import {
  validateCover,
  validateCoverMultiPlatform,
  getCoverSpecs,
  getRecommendedDimensions,
  getSupportedPlatforms,
  getValidationSummary,
} from './cover-validator.js';

/**
 * Upload and validate cover image for a manuscript
 * POST /manuscripts/:id/cover
 */
export async function uploadCover(request, env, manuscriptId) {
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

    // Parse multipart form data
    const formData = await request.formData();
    const coverFile = formData.get('cover');
    const platforms = formData.get('platforms')?.split(',') || ['kdp']; // Default to KDP
    const type = formData.get('type') || 'ebook'; // ebook or print

    if (!coverFile) {
      return new Response(JSON.stringify({ error: 'No cover file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Convert to buffer
    const coverBuffer = Buffer.from(await coverFile.arrayBuffer());

    // Perform basic validation using cover-processor (Works in Workers)
    const basicValidation = await validateCoverImage(coverBuffer, {
      formats: ['jpeg', 'jpg', 'png', 'tiff'],
      maxSize: 50 * 1024 * 1024, // 50MB
    });

    // Note: Detailed dimension validation with cover-validator would require sharp
    // which doesn't work in Workers. We provide validation rules but can't measure actual pixels.
    const validationNote = 'Image dimensions cannot be validated in Workers environment. Please ensure your image meets platform requirements before uploading to publishing platforms.';

    // Store cover in R2
    const coverKey = `${user.id}/${manuscriptId}/covers/${coverFile.name}`;
    await env.MARKETING_ASSETS.put(coverKey, coverBuffer, {
      httpMetadata: {
        contentType: coverFile.type || 'image/jpeg',
      },
    });

    // Update manuscript record with cover
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(`
      UPDATE manuscripts
      SET cover_image_key = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(coverKey, now, manuscriptId).run();

    return new Response(
      JSON.stringify({
        success: true,
        coverKey: coverKey,
        fileName: coverFile.name,
        fileSize: coverBuffer.length,
        validation: basicValidation,
        note: validationNote,
        platforms: platforms,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error uploading cover:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to upload cover', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get cover image for a manuscript
 * GET /manuscripts/:id/cover
 */
export async function getCover(request, env, manuscriptId) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get manuscript
    const manuscript = await env.DB.prepare(
      'SELECT id, user_id, cover_image_key FROM manuscripts WHERE id = ?'
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

    if (!manuscript.cover_image_key) {
      return new Response(JSON.stringify({ error: 'No cover image uploaded' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get cover from R2
    const coverObject = await env.MARKETING_ASSETS.get(manuscript.cover_image_key);

    if (!coverObject) {
      return new Response(JSON.stringify({ error: 'Cover image not found in storage' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return image
    return new Response(coverObject.body, {
      headers: {
        'Content-Type': coverObject.httpMetadata?.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error getting cover:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get cover' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get cover specifications for platforms
 * GET /cover/specs
 */
export async function getCoverSpecifications(request, env) {
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform');
  const type = url.searchParams.get('type') || 'ebook';

  try {
    if (platform) {
      // Get specs for specific platform
      const specs = getCoverSpecs(platform, type);
      if (!specs) {
        return new Response(
          JSON.stringify({ error: 'Invalid platform or type' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const recommended = getRecommendedDimensions(platform, type);

      return new Response(
        JSON.stringify({
          platform: platform,
          type: type,
          specifications: specs,
          recommendedDimensions: recommended,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // Get all platforms
      const platforms = getSupportedPlatforms();
      const allSpecs = {};

      for (const plat of platforms) {
        allSpecs[plat] = {
          ebook: getCoverSpecs(plat, 'ebook'),
          print: getCoverSpecs(plat, 'print'),
        };
      }

      return new Response(
        JSON.stringify({
          platforms: platforms,
          specifications: allSpecs,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error getting cover specs:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get specifications' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Calculate spine width for print covers
 * POST /cover/spine-calculator
 */
export async function calculateSpine(request, env) {
  try {
    const body = await request.json();
    const { pageCount, paperType = 'cream_60' } = body;

    if (!pageCount || pageCount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid page count is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const spine = calculateSpineWidth(pageCount, paperType);

    return new Response(
      JSON.stringify({
        success: true,
        spine: spine,
        availablePaperTypes: PAPER_TYPES,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error calculating spine:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Delete cover image
 * DELETE /manuscripts/:id/cover
 */
export async function deleteCover(request, env, manuscriptId) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get manuscript
    const manuscript = await env.DB.prepare(
      'SELECT id, user_id, cover_image_key FROM manuscripts WHERE id = ?'
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

    if (!manuscript.cover_image_key) {
      return new Response(JSON.stringify({ error: 'No cover image to delete' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete from R2
    await env.MARKETING_ASSETS.delete(manuscript.cover_image_key);

    // Update manuscript record
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(`
      UPDATE manuscripts
      SET cover_image_key = NULL,
          updated_at = ?
      WHERE id = ?
    `).bind(now, manuscriptId).run();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cover image deleted successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error deleting cover:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete cover' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const coverHandlers = {
  uploadCover,
  getCover,
  getCoverSpecifications,
  calculateSpine,
  deleteCover,
};
