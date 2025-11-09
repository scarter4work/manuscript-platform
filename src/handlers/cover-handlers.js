// Cover Handlers
// API endpoints for cover image upload, validation, and processing

import { getUserFromRequest } from '../utils/auth-utils.js';
import { validateCoverImage, calculateSpineWidth, PAPER_TYPES } from '../processors/cover-processor.js';
import {
  validateCover,
  validateCoverMultiPlatform,
  getCoverSpecs,
  getRecommendedDimensions,
  getSupportedPlatforms,
  getValidationSummary,
} from '../validators/cover-validator.js';
import { CoverDesignAgent } from '../agents/cover-design-agent.js';

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
    await env.R2.getBucket('marketing_assets').put(coverKey, coverBuffer, {
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
    const coverObject = await env.R2.getBucket('marketing_assets').get(manuscript.cover_image_key);

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
    await env.R2.getBucket('marketing_assets').delete(manuscript.cover_image_key);

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

/**
 * Generate cover design brief using AI
 * POST /manuscripts/:id/cover/generate-brief
 */
export async function generateCoverBrief(request, env, manuscriptId) {
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
      'SELECT id, user_id, title, genre, r2_key FROM manuscripts WHERE id = ?'
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

    // Parse request body for optional parameters
    const body = await request.json().catch(() => ({}));
    const genre = body.genre || manuscript.genre || 'general';

    // Get developmental analysis if it exists (for better brief quality)
    let developmentalAnalysis = null;
    try {
      const analysisKey = `${manuscript.r2_key.replace('.pdf', '')}-developmental-analysis.json`;
      const analysisObject = await env.R2.getBucket('manuscripts_processed').get(analysisKey);
      if (analysisObject) {
        developmentalAnalysis = JSON.parse(await analysisObject.text());
      }
    } catch (error) {
      console.log('No developmental analysis found, generating brief without it');
    }

    // If no analysis, create a basic structure
    if (!developmentalAnalysis) {
      developmentalAnalysis = {
        analysis: {
          overallScore: 7,
          plot: { strengths: ['Engaging premise'] },
          characters: { strengths: ['Well-developed'] },
          topPriorities: ['Strong storytelling'],
          pacing: { overallTone: 'Varies' },
          setting: { mainSetting: 'Contemporary' },
        },
        structure: {
          totalWords: 75000,
        },
      };
    }

    // Generate cover brief using the agent
    const agent = new CoverDesignAgent(env);
    const result = await agent.generate(manuscript.r2_key, developmentalAnalysis, genre);

    // Store in database
    const briefId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      INSERT INTO cover_design_briefs (
        id, user_id, manuscript_id, genre, brief_data,
        generated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      briefId,
      user.id,
      manuscriptId,
      genre,
      JSON.stringify(result.coverBrief),
      result.timestamp,
      now,
      now
    ).run();

    return new Response(
      JSON.stringify({
        success: true,
        briefId: briefId,
        brief: result.coverBrief,
        generatedAt: result.timestamp,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating cover brief:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate cover brief', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get cover design brief for a manuscript
 * GET /manuscripts/:id/cover/brief
 */
export async function getCoverBrief(request, env, manuscriptId) {
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

    // Get all briefs for this manuscript (ordered by most recent)
    const briefs = await env.DB.prepare(`
      SELECT id, genre, brief_data, generated_at, created_at
      FROM cover_design_briefs
      WHERE manuscript_id = ?
      ORDER BY created_at DESC
    `).bind(manuscriptId).all();

    if (!briefs.results || briefs.results.length === 0) {
      return new Response(JSON.stringify({ error: 'No cover brief found. Generate one first.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse brief_data JSON
    const briefsWithParsedData = briefs.results.map(brief => ({
      ...brief,
      brief_data: JSON.parse(brief.brief_data),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        count: briefsWithParsedData.length,
        briefs: briefsWithParsedData,
        latest: briefsWithParsedData[0],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting cover brief:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get cover brief' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Generate Midjourney prompt from existing brief
 * POST /manuscripts/:id/cover/midjourney-prompt
 */
export async function generateMidjourneyPrompt(request, env, manuscriptId) {
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

    // Get the latest brief
    const brief = await env.DB.prepare(`
      SELECT brief_data FROM cover_design_briefs
      WHERE manuscript_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(manuscriptId).first();

    if (!brief) {
      return new Response(JSON.stringify({ error: 'No cover brief found. Generate one first.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const briefData = JSON.parse(brief.brief_data);

    return new Response(
      JSON.stringify({
        success: true,
        prompts: briefData.aiArtPrompts || {},
        midjourney: briefData.aiArtPrompts?.midjourney || 'No Midjourney prompt available',
        dalle: briefData.aiArtPrompts?.dalle || 'No DALL-E prompt available',
        stableDiffusion: briefData.aiArtPrompts?.stableDiffusion || 'No Stable Diffusion prompt available',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating Midjourney prompt:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate prompt' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get genre-specific cover design templates/guidelines
 * GET /cover/templates/:genre
 */
export async function getGenreTemplates(request, env, genre) {
  const genreTemplates = {
    thriller: {
      colorPalette: ['#1a1a1a', '#8B0000', '#2F4F4F', '#C0C0C0'],
      typography: 'Bold, sans-serif fonts for title. Sharp, edgy aesthetic.',
      imagery: 'Dark atmospheres, silhouettes, urban landscapes, weapons, shadows',
      mood: 'Suspenseful, mysterious, tense',
      conventions: ['Dark color schemes', 'Bold typography', 'High contrast', 'Atmospheric imagery'],
    },
    romance: {
      colorPalette: ['#FFB6C1', '#FF69B4', '#FFC0CB', '#DDA0DD'],
      typography: 'Script or elegant serif fonts. Soft, flowing aesthetic.',
      imagery: 'Couples, romantic settings, flowers, soft lighting',
      mood: 'Warm, emotional, heartfelt, dreamy',
      conventions: ['Soft pastels or rich jewel tones', 'Couples on cover', 'Elegant typography', 'Emotional imagery'],
    },
    fantasy: {
      colorPalette: ['#4B0082', '#FFD700', '#8B4513', '#2F4F4F'],
      typography: 'Ornate, decorative fonts with medieval or magical feel.',
      imagery: 'Epic landscapes, magical elements, mythical creatures, castles',
      mood: 'Epic, imaginative, wondrous',
      conventions: ['Rich, saturated colors', 'Metallic accents', 'Ornate typography', 'Grand imagery'],
    },
    'sci-fi': {
      colorPalette: ['#00BFFF', '#4169E1', '#1C1C1C', '#C0C0C0'],
      typography: 'Bold, futuristic sans-serif fonts. Clean, tech aesthetic.',
      imagery: 'Spaceships, technology, futuristic cities, stars, planets',
      mood: 'Innovative, thought-provoking, futuristic',
      conventions: ['Cool blues and metallic tones', 'Tech elements', 'Bold san-serif fonts', 'Sleek design'],
    },
    literary: {
      colorPalette: ['#F5F5DC', '#8B7355', '#2F4F4F', '#FFFFFF'],
      typography: 'Sophisticated serif fonts. Minimalist, elegant design.',
      imagery: 'Abstract art, minimalist symbols, subtle imagery',
      mood: 'Sophisticated, introspective, artistic',
      conventions: ['Minimalist design', 'Sophisticated typography', 'Muted colors', 'Artistic imagery'],
    },
    horror: {
      colorPalette: ['#000000', '#8B0000', '#2F4F4F', '#A9A9A9'],
      typography: 'Distressed, bold fonts with unsettling feel.',
      imagery: 'Dark atmospheres, shadows, disturbing imagery, decay',
      mood: 'Dark, atmospheric, unsettling, terrifying',
      conventions: ['Very dark color schemes', 'Visceral imagery', 'Bold, disturbing typography', 'High contrast'],
    },
    mystery: {
      colorPalette: ['#2F4F4F', '#8B4513', '#DAA520', '#F5F5DC'],
      typography: 'Classic serif or bold sans-serif. Clever, sophisticated.',
      imagery: 'Clues, detective elements, foggy scenes, vintage aesthetics',
      mood: 'Clever, analytical, intriguing',
      conventions: ['Muted, sophisticated colors', 'Clever visual clues', 'Classic typography', 'Vintage feel'],
    },
    nonfiction: {
      colorPalette: ['#FFFFFF', '#000000', '#4169E1', '#FFD700'],
      typography: 'Clear, professional sans-serif. Bold, authoritative.',
      imagery: 'Clean, benefit-focused imagery, icons, professional photos',
      mood: 'Professional, authoritative, clear',
      conventions: ['Clean design', 'Clear typography', 'Benefit-focused', 'Professional imagery'],
    },
  };

  const template = genreTemplates[genre.toLowerCase()] || genreTemplates['literary'];

  return new Response(
    JSON.stringify({
      success: true,
      genre: genre,
      template: template,
      allGenres: Object.keys(genreTemplates),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

export const coverHandlers = {
  uploadCover,
  getCover,
  getCoverSpecifications,
  calculateSpine,
  deleteCover,
  generateCoverBrief,
  getCoverBrief,
  generateMidjourneyPrompt,
  getGenreTemplates,
};
