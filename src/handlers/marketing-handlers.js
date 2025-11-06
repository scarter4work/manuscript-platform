/**
 * Marketing Content API Handlers
 * Endpoints for generating and managing social media marketing content
 * Issue #45: https://github.com/scarter4work/manuscript-platform/issues/45
 */

import {
  generateMarketingKit,
  generateHashtagStrategy,
  PLATFORM_SPECS,
  POST_TYPES
} from '../generators/marketing-content-generator.js';
import { getUserFromRequest } from '../utils/auth-utils.js';

/**
 * POST /manuscripts/:id/marketing/generate
 * Generate complete marketing kit
 */
export async function handleGenerateMarketingKit(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { manuscriptId } = request.params;
    const body = await request.json();

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const options = {
      manuscriptId,
      title: body.title || manuscript.title,
      author: body.author || 'Author Name',
      genre: body.genre || manuscript.genre || 'general',
      synopsis: body.synopsis,
      targetAudience: body.targetAudience || '',
      tone: body.tone || 'professional',
      launchDate: body.launchDate
    };

    if (!options.synopsis) {
      return new Response(JSON.stringify({
        error: 'Synopsis is required for marketing generation'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate complete marketing kit
    const kit = await generateMarketingKit(options, env);

    // Store marketing kit in database
    const kitId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO marketing_kits (
        id, manuscript_id, user_id, kit_name, genre,
        target_audience, tone, generation_cost,
        generated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      kitId,
      manuscriptId,
      userId,
      `${options.title} - Launch Marketing Kit`,
      options.genre,
      options.targetAudience,
      options.tone,
      kit.totalCost || 0,
      Math.floor(new Date(kit.generatedAt).getTime() / 1000),
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();

    // Store social media posts
    for (const [platform, platformData] of Object.entries(kit.socialPosts)) {
      for (let i = 0; i < platformData.posts.length; i++) {
        const post = platformData.posts[i];
        await env.DB.prepare(`
          INSERT INTO social_media_posts (
            id, kit_id, platform, post_type, post_text,
            hashtags, image_suggestion, optimal_posting_time,
            character_count, engagement_hook, post_order, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          kitId,
          platform,
          post.type,
          post.text,
          JSON.stringify(post.hashtags || []),
          post.imageSuggestion || '',
          PLATFORM_SPECS[platform]?.optimalTimes || '',
          post.characterCount || post.text.length,
          post.engagementHook || '',
          i + 1,
          Math.floor(Date.now() / 1000)
        ).run();
      }
    }

    // Store email template
    if (kit.emailTemplate) {
      await env.DB.prepare(`
        INSERT INTO marketing_materials (
          id, kit_id, material_type, title, content,
          format, word_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        kitId,
        'launch_email',
        kit.emailTemplate.subjectLine,
        JSON.stringify({
          subjectLine: kit.emailTemplate.subjectLine,
          previewText: kit.emailTemplate.previewText,
          emailBody: kit.emailTemplate.emailBody
        }),
        'html',
        kit.emailTemplate.wordCount || 0,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      ).run();
    }

    // Store content calendar
    for (const item of kit.contentCalendar) {
      await env.DB.prepare(`
        INSERT INTO content_calendar (
          id, kit_id, day_number, platform, activity_type,
          activity_description, time_of_day, priority, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        kitId,
        item.day,
        item.platform,
        item.activityType,
        item.description,
        item.timeOfDay || 'afternoon',
        item.priority || 'medium',
        Math.floor(Date.now() / 1000)
      ).run();
    }

    // Store trailer script
    if (kit.trailerScript) {
      await env.DB.prepare(`
        INSERT INTO marketing_materials (
          id, kit_id, material_type, title, content,
          format, estimated_duration, additional_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        kitId,
        'trailer_script',
        `Book Trailer Script - ${options.title}`,
        JSON.stringify({
          script: kit.trailerScript.script,
          scenes: kit.trailerScript.scenes
        }),
        'script',
        kit.trailerScript.duration || '90 seconds',
        `Word count: ${kit.trailerScript.wordCount || 0}`,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      ).run();
    }

    // Store reader magnets
    for (const magnet of kit.readerMagnets) {
      await env.DB.prepare(`
        INSERT INTO marketing_materials (
          id, kit_id, material_type, title, content,
          format, additional_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        kitId,
        'reader_magnet',
        magnet.title,
        JSON.stringify(magnet),
        'markdown',
        `Type: ${magnet.type}, Length: ${magnet.length}`,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      ).run();
    }

    return new Response(JSON.stringify({
      success: true,
      kitId,
      kit: {
        ...kit,
        kitId
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating marketing kit:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate marketing kit',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /manuscripts/:id/marketing/kits
 * Get all marketing kits for a manuscript
 */
export async function handleGetMarketingKits(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { manuscriptId } = request.params;

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all kits for this manuscript
    const kits = await env.DB.prepare(`
      SELECT * FROM marketing_kits
      WHERE manuscript_id = ? AND user_id = ?
      ORDER BY created_at DESC
    `).bind(manuscriptId, userId).all();

    return new Response(JSON.stringify({
      success: true,
      kits: kits.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving marketing kits:', error);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve marketing kits',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /marketing/:kitId/social-posts
 * Get social media posts for a kit (optionally filtered by platform)
 */
export async function handleGetSocialPosts(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { kitId } = request.params;
    const url = new URL(request.url);
    const platform = url.searchParams.get('platform');

    // Verify kit ownership
    const kit = await env.DB.prepare(
      'SELECT * FROM marketing_kits WHERE id = ? AND user_id = ?'
    ).bind(kitId, userId).first();

    if (!kit) {
      return new Response(JSON.stringify({ error: 'Marketing kit not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get posts (filtered by platform if specified)
    let query = `
      SELECT * FROM social_media_posts
      WHERE kit_id = ?
    `;
    const params = [kitId];

    if (platform) {
      query += ` AND platform = ?`;
      params.push(platform);
    }

    query += ` ORDER BY post_order ASC`;

    const posts = await env.DB.prepare(query).bind(...params).all();

    // Parse JSON fields
    const parsedPosts = posts.results.map(post => ({
      ...post,
      hashtags: post.hashtags ? JSON.parse(post.hashtags) : [],
      is_used: Boolean(post.is_used)
    }));

    // Group by platform
    const byPlatform = {};
    parsedPosts.forEach(post => {
      if (!byPlatform[post.platform]) {
        byPlatform[post.platform] = [];
      }
      byPlatform[post.platform].push(post);
    });

    return new Response(JSON.stringify({
      success: true,
      posts: parsedPosts,
      byPlatform,
      totalPosts: parsedPosts.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving social posts:', error);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve social posts',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /marketing/:kitId/email-template
 * Get launch email template
 */
export async function handleGetEmailTemplate(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { kitId } = request.params;

    // Verify kit ownership
    const kit = await env.DB.prepare(
      'SELECT * FROM marketing_kits WHERE id = ? AND user_id = ?'
    ).bind(kitId, userId).first();

    if (!kit) {
      return new Response(JSON.stringify({ error: 'Marketing kit not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get email template
    const material = await env.DB.prepare(`
      SELECT * FROM marketing_materials
      WHERE kit_id = ? AND material_type = 'launch_email'
      LIMIT 1
    `).bind(kitId).first();

    if (!material) {
      return new Response(JSON.stringify({ error: 'Email template not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      email: {
        ...material,
        content: JSON.parse(material.content)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving email template:', error);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve email template',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /marketing/:kitId/content-calendar
 * Get 30-day content calendar
 */
export async function handleGetContentCalendar(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { kitId } = request.params;

    // Verify kit ownership
    const kit = await env.DB.prepare(
      'SELECT * FROM marketing_kits WHERE id = ? AND user_id = ?'
    ).bind(kitId, userId).first();

    if (!kit) {
      return new Response(JSON.stringify({ error: 'Marketing kit not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get calendar items
    const calendar = await env.DB.prepare(`
      SELECT * FROM content_calendar
      WHERE kit_id = ?
      ORDER BY day_number ASC
    `).bind(kitId).all();

    // Parse boolean fields
    const parsedCalendar = calendar.results.map(item => ({
      ...item,
      completed: Boolean(item.completed)
    }));

    return new Response(JSON.stringify({
      success: true,
      calendar: parsedCalendar,
      totalDays: parsedCalendar.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving content calendar:', error);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve content calendar',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /marketing/:kitId/trailer-script
 * Get book trailer script
 */
export async function handleGetTrailerScript(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { kitId } = request.params;

    // Verify kit ownership
    const kit = await env.DB.prepare(
      'SELECT * FROM marketing_kits WHERE id = ? AND user_id = ?'
    ).bind(kitId, userId).first();

    if (!kit) {
      return new Response(JSON.stringify({ error: 'Marketing kit not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get trailer script
    const material = await env.DB.prepare(`
      SELECT * FROM marketing_materials
      WHERE kit_id = ? AND material_type = 'trailer_script'
      LIMIT 1
    `).bind(kitId).first();

    if (!material) {
      return new Response(JSON.stringify({ error: 'Trailer script not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      trailer: {
        ...material,
        content: JSON.parse(material.content)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving trailer script:', error);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve trailer script',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /marketing/:kitId/reader-magnets
 * Get reader magnet ideas
 */
export async function handleGetReaderMagnets(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { kitId } = request.params;

    // Verify kit ownership
    const kit = await env.DB.prepare(
      'SELECT * FROM marketing_kits WHERE id = ? AND user_id = ?'
    ).bind(kitId, userId).first();

    if (!kit) {
      return new Response(JSON.stringify({ error: 'Marketing kit not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get reader magnets
    const materials = await env.DB.prepare(`
      SELECT * FROM marketing_materials
      WHERE kit_id = ? AND material_type = 'reader_magnet'
      ORDER BY created_at ASC
    `).bind(kitId).all();

    const magnets = materials.results.map(m => ({
      ...m,
      content: JSON.parse(m.content)
    }));

    return new Response(JSON.stringify({
      success: true,
      magnets,
      totalMagnets: magnets.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving reader magnets:', error);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve reader magnets',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /marketing/posts/:postId/mark-used
 * Mark a social media post as used
 */
export async function handleMarkPostAsUsed(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { postId } = request.params;

    // Get post to verify ownership
    const post = await env.DB.prepare(`
      SELECT p.*, k.user_id
      FROM social_media_posts p
      JOIN marketing_kits k ON p.kit_id = k.id
      WHERE p.id = ?
    `).bind(postId).first();

    if (!post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (post.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mark as used
    await env.DB.prepare(`
      UPDATE social_media_posts SET is_used = 1 WHERE id = ?
    `).bind(postId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Post marked as used'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error marking post as used:', error);
    return new Response(JSON.stringify({
      error: 'Failed to mark post as used',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
