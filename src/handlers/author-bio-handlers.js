/**
 * Author Bio API Handlers
 * Endpoints for generating and managing author bios
 */

import { generateAuthorBio, generateCompleteBioPackage, validateBio, BIO_LENGTHS } from '../generators/author-bio-generator.js';
import { getUserFromRequest } from '../utils/auth-utils.js';
import crypto from 'crypto';

/**
 * POST /manuscripts/:id/author-bio/generate
 * Generate author bio variations
 */
export async function handleGenerateBio(request, env) {
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

    // Get author profile
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(userId).first();

    const authorProfile = {
      previousWorks: body.previousWorks || [],
      awards: body.awards || [],
      credentials: body.credentials || '',
      location: body.location || user.location || '',
      website: body.website || '',
      socialMedia: body.socialMedia || {},
      newsletter: body.newsletter || '',
      bio: body.existingBio || ''
    };

    const options = {
      authorName: body.authorName || user.full_name || 'Unknown Author',
      genre: body.genre || manuscript.genre || 'general',
      length: body.length || 'medium',
      authorProfile
    };

    // Generate bio variations
    const result = await generateAuthorBio(options, env);

    // Store in database
    await env.DB.prepare(`
      INSERT INTO author_bios (
        id, user_id, manuscript_id, author_name, genre, length,
        variations, generated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      manuscriptId,
      result.authorName,
      result.genre,
      result.length,
      JSON.stringify(result.variations),
      result.generatedAt,
      Date.now()
    ).run();

    return new Response(JSON.stringify({
      success: true,
      bio: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating author bio:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate author bio',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /manuscripts/:id/author-bio/generate-all
 * Generate complete bio package (all lengths)
 */
export async function handleGenerateCompleteBioPackage(request, env) {
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

    // Get author profile
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(userId).first();

    const authorProfile = {
      previousWorks: body.previousWorks || [],
      awards: body.awards || [],
      credentials: body.credentials || '',
      location: body.location || user.location || '',
      website: body.website || '',
      socialMedia: body.socialMedia || {},
      newsletter: body.newsletter || '',
      bio: body.existingBio || ''
    };

    const options = {
      authorName: body.authorName || user.full_name || 'Unknown Author',
      genre: body.genre || manuscript.genre || 'general',
      authorProfile
    };

    // Generate complete package (short, medium, long)
    const result = await generateCompleteBioPackage(options, env);

    // Store all lengths in database
    for (const length of ['short', 'medium', 'long']) {
      const bioData = result[length];
      await env.DB.prepare(`
        INSERT INTO author_bios (
          id, user_id, manuscript_id, author_name, genre, length,
          variations, generated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        userId,
        manuscriptId,
        bioData.authorName,
        bioData.genre,
        bioData.length,
        JSON.stringify(bioData.variations),
        bioData.generatedAt,
        Date.now()
      ).run();
    }

    return new Response(JSON.stringify({
      success: true,
      package: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating complete bio package:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate complete bio package',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /manuscripts/:id/author-bio
 * Retrieve generated author bios
 */
export async function handleGetAuthorBios(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { manuscriptId } = request.params;
    const url = new URL(request.url);
    const length = url.searchParams.get('length'); // Optional filter

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

    // Retrieve bios
    let query = `
      SELECT * FROM author_bios
      WHERE user_id = ? AND manuscript_id = ?
    `;
    const params = [userId, manuscriptId];

    if (length) {
      query += ' AND length = ?';
      params.push(length);
    }

    query += ' ORDER BY created_at DESC';

    const { results } = await env.DB.prepare(query).bind(...params).all();

    // Parse JSON variations
    const bios = results.map(bio => ({
      ...bio,
      variations: JSON.parse(bio.variations)
    }));

    return new Response(JSON.stringify({
      success: true,
      bios,
      count: bios.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving author bios:', error);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve author bios',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /author/profile
 * Update author profile for bio generation
 */
export async function handleUpdateAuthorProfile(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();

    // Update user profile fields
    const updates = [];
    const params = [];

    if (body.fullName) {
      updates.push('full_name = ?');
      params.push(body.fullName);
    }

    if (body.location) {
      updates.push('location = ?');
      params.push(body.location);
    }

    if (body.bio) {
      updates.push('bio = ?');
      params.push(body.bio);
    }

    if (body.website) {
      updates.push('website = ?');
      params.push(body.website);
    }

    if (body.socialMedia) {
      updates.push('social_media = ?');
      params.push(JSON.stringify(body.socialMedia));
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        error: 'No fields to update'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    updates.push('updated_at = ?');
    params.push(Date.now());
    params.push(userId);

    await env.DB.prepare(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...params).run();

    // Retrieve updated profile
    const user = await env.DB.prepare(
      'SELECT id, email, full_name, location, bio, website, social_media FROM users WHERE id = ?'
    ).bind(userId).first();

    return new Response(JSON.stringify({
      success: true,
      profile: {
        ...user,
        social_media: user.social_media ? JSON.parse(user.social_media) : {}
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating author profile:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update author profile',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /author/profile
 * Get author profile
 */
export async function handleGetAuthorProfile(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await env.DB.prepare(
      'SELECT id, email, full_name, location, bio, website, social_media FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      profile: {
        ...user,
        social_media: user.social_media ? JSON.parse(user.social_media) : {}
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving author profile:', error);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve author profile',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Export handlers
 */
export const authorBioHandlers = {
  generateBio: handleGenerateBio,
  generateCompleteBioPackage: handleGenerateCompleteBioPackage,
  getAuthorBios: handleGetAuthorBios,
  updateAuthorProfile: handleUpdateAuthorProfile,
  getAuthorProfile: handleGetAuthorProfile
};
