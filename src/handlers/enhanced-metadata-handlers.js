/**
 * Enhanced Metadata Handlers (Issue #51)
 *
 * Provides endpoints for enhanced manuscript metadata management:
 * - Genre taxonomy (primary genre, sub-genres)
 * - Age category selection
 * - Content warnings
 * - Word count validation
 * - Completion status tracking
 * - Target audience profiling
 * - Series information
 *
 * All endpoints require authentication.
 */

import { getUserFromRequest } from '../utils/auth-utils.js';

/**
 * GET /genres
 * Get complete genre taxonomy (hierarchical structure)
 *
 * Query parameters:
 * - parent: Filter by parent genre ID (optional)
 * - active_only: Show only active genres (default: true)
 */
export async function getGenres(request, env) {
  try {
    const url = new URL(request.url);
    const parentId = url.searchParams.get('parent');
    const activeOnly = url.searchParams.get('active_only') !== 'false';

    let query = 'SELECT * FROM genres';
    const conditions = [];
    const bindings = [];

    if (parentId !== null) {
      conditions.push(parentId === '' ? 'parent_genre_id IS NULL' : 'parent_genre_id = ?');
      if (parentId !== '') bindings.push(parentId);
    }

    if (activeOnly) {
      conditions.push('is_active = 1');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY display_order ASC, name ASC';

    const result = await env.DB.prepare(query).bind(...bindings).all();

    // Build hierarchical structure if no parent filter
    const genres = result.results || [];

    if (parentId === null) {
      // Group into hierarchy
      const genreMap = new Map();
      const topLevel = [];

      genres.forEach(genre => {
        genreMap.set(genre.id, { ...genre, subgenres: [] });
      });

      genres.forEach(genre => {
        if (genre.parent_genre_id === null) {
          topLevel.push(genreMap.get(genre.id));
        } else if (genreMap.has(genre.parent_genre_id)) {
          genreMap.get(genre.parent_genre_id).subgenres.push(genreMap.get(genre.id));
        }
      });

      return new Response(JSON.stringify({
        success: true,
        count: genres.length,
        topLevelCount: topLevel.length,
        genres: topLevel,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      count: genres.length,
      parentId: parentId,
      genres: genres,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching genres:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch genres',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /genres/:id
 * Get specific genre with its subgenres
 */
export async function getGenreById(request, env, genreId) {
  try {
    const genre = await env.DB.prepare(
      'SELECT * FROM genres WHERE id = ?'
    ).bind(genreId).first();

    if (!genre) {
      return new Response(JSON.stringify({ error: 'Genre not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get subgenres
    const subgenres = await env.DB.prepare(
      'SELECT * FROM genres WHERE parent_genre_id = ? AND is_active = 1 ORDER BY display_order ASC, name ASC'
    ).bind(genreId).all();

    // Get usage stats
    const stats = await env.DB.prepare(
      'SELECT * FROM genre_usage_stats WHERE id = ?'
    ).bind(genreId).first();

    return new Response(JSON.stringify({
      success: true,
      genre: {
        ...genre,
        subgenres: subgenres.results || [],
        stats: stats || {
          manuscript_count: 0,
          avg_word_count: null,
          min_word_count: null,
          max_word_count: null,
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching genre:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch genre',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /genres/:id/subgenres
 * Get all subgenres for a parent genre
 */
export async function getSubgenres(request, env, parentId) {
  try {
    const subgenres = await env.DB.prepare(
      'SELECT * FROM genres WHERE parent_genre_id = ? AND is_active = 1 ORDER BY display_order ASC, name ASC'
    ).bind(parentId).all();

    return new Response(JSON.stringify({
      success: true,
      parentId: parentId,
      count: subgenres.results?.length || 0,
      subgenres: subgenres.results || [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching subgenres:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch subgenres',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /content-warnings
 * Get all content warning types
 *
 * Query parameters:
 * - category: Filter by category (optional)
 * - active_only: Show only active warnings (default: true)
 */
export async function getContentWarnings(request, env) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const activeOnly = url.searchParams.get('active_only') !== 'false';

    let query = 'SELECT * FROM content_warning_types';
    const conditions = [];
    const bindings = [];

    if (category) {
      conditions.push('category = ?');
      bindings.push(category);
    }

    if (activeOnly) {
      conditions.push('is_active = 1');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY category ASC, display_order ASC, name ASC';

    const result = await env.DB.prepare(query).bind(...bindings).all();
    const warnings = result.results || [];

    // Group by category
    const categorized = {};
    warnings.forEach(warning => {
      if (!categorized[warning.category]) {
        categorized[warning.category] = [];
      }
      categorized[warning.category].push(warning);
    });

    return new Response(JSON.stringify({
      success: true,
      count: warnings.length,
      categoryCount: Object.keys(categorized).length,
      warnings: warnings,
      categorized: categorized,
      categories: [
        'violence',
        'sexual',
        'substance',
        'mental_health',
        'discrimination',
        'other'
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching content warnings:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch content warnings',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * PATCH /manuscripts/:id/enhanced-metadata
 * Update enhanced manuscript metadata
 *
 * Body fields:
 * - primary_genre: Genre ID
 * - sub_genres: Array of genre IDs
 * - age_category: adult|young_adult|middle_grade|childrens|all_ages
 * - content_warnings: Array of warning IDs
 * - completion_status: complete|in_progress|revision|outline
 * - completion_percentage: 0-100
 * - target_audience: JSON object with demographics/psychographics
 * - series_info: JSON object with series data
 * - word_count: Integer
 * - publication_status: unpublished|self_published|traditionally_published|previously_published
 * - rights_status: JSON object with rights data
 */
export async function updateEnhancedMetadata(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Get manuscript and verify ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse update data
    const updates = await request.json();

    const allowedFields = [
      'primary_genre',
      'sub_genres',
      'age_category',
      'content_warnings',
      'completion_status',
      'completion_percentage',
      'target_audience',
      'series_info',
      'word_count',
      'publication_status',
      'rights_status'
    ];

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    const history = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);

        // JSON fields need to be stringified
        if (['sub_genres', 'content_warnings', 'target_audience', 'series_info', 'rights_status'].includes(key)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }

        // Track change for history
        history.push({
          field: key,
          oldValue: manuscript[key],
          newValue: value
        });
      }
    }

    if (updateFields.length === 0) {
      return new Response(JSON.stringify({
        error: 'No valid fields to update',
        allowedFields: allowedFields,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate genre exists if provided
    if (updates.primary_genre) {
      const genreExists = await env.DB.prepare(
        'SELECT id FROM genres WHERE id = ? AND is_active = 1'
      ).bind(updates.primary_genre).first();

      if (!genreExists) {
        return new Response(JSON.stringify({
          error: 'Invalid primary_genre: genre not found or inactive',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Validate age category
    const validAgeCategories = ['adult', 'young_adult', 'middle_grade', 'childrens', 'all_ages'];
    if (updates.age_category && !validAgeCategories.includes(updates.age_category)) {
      return new Response(JSON.stringify({
        error: 'Invalid age_category',
        validValues: validAgeCategories,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate completion percentage
    if (updates.completion_percentage !== undefined) {
      const pct = parseInt(updates.completion_percentage);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return new Response(JSON.stringify({
          error: 'Invalid completion_percentage: must be 0-100',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Update manuscript
    values.push(manuscriptId, user.id);
    const query = `UPDATE manuscripts SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;

    await env.DB.prepare(query).bind(...values).run();

    // Record metadata history
    for (const change of history) {
      await env.DB.prepare(`
        INSERT INTO manuscript_metadata_history (id, manuscript_id, field_name, old_value, new_value, changed_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        manuscriptId,
        change.field,
        JSON.stringify(change.oldValue),
        JSON.stringify(change.newValue),
        user.id
      ).run();
    }

    // Get updated manuscript with validation
    const updatedManuscript = await env.DB.prepare(
      'SELECT * FROM manuscript_metadata_validation WHERE id = ?'
    ).bind(manuscriptId).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'Manuscript metadata updated successfully',
      updatedFields: Object.keys(updates).filter(k => allowedFields.includes(k)),
      manuscript: updatedManuscript,
      validation: {
        status: updatedManuscript.validation_status,
        completeness: updatedManuscript.metadata_completeness,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error updating enhanced metadata:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update manuscript metadata',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /manuscripts/:id/validate-genre
 * Validate manuscript word count against genre norms
 */
export async function validateGenre(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Get manuscript with validation view
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscript_metadata_validation WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check ownership
    const ownerCheck = await env.DB.prepare(
      'SELECT user_id FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!ownerCheck || ownerCheck.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const validation = {
      manuscriptId: manuscript.id,
      title: manuscript.title,
      primaryGenre: manuscript.primary_genre,
      wordCount: manuscript.word_count,
      ageCategory: manuscript.age_category,
      status: manuscript.validation_status,
      completeness: manuscript.metadata_completeness,
      genreExpectations: {
        min: manuscript.typical_word_count_min,
        max: manuscript.typical_word_count_max,
      },
      warnings: [],
      recommendations: [],
    };

    // Generate warnings
    if (manuscript.validation_status === 'missing_word_count') {
      validation.warnings.push('Word count is missing. Please provide word count for validation.');
    } else if (manuscript.validation_status === 'word_count_too_low') {
      validation.warnings.push(`Word count (${manuscript.word_count}) is below typical range for ${manuscript.primary_genre} (${manuscript.typical_word_count_min}+)`);
      validation.recommendations.push('Consider expanding the manuscript or changing the genre classification');
    } else if (manuscript.validation_status === 'word_count_too_high') {
      validation.warnings.push(`Word count (${manuscript.word_count}) is above typical range for ${manuscript.primary_genre} (up to ${manuscript.typical_word_count_max})`);
      validation.recommendations.push('Consider trimming the manuscript or splitting into multiple books');
    }

    if (manuscript.metadata_completeness === 'missing_genre') {
      validation.warnings.push('Primary genre is not set');
      validation.recommendations.push('Select a primary genre to get accurate word count validation');
    }

    if (manuscript.metadata_completeness === 'missing_age_category') {
      validation.warnings.push('Age category is not set');
      validation.recommendations.push('Specify age category (Adult, YA, Middle Grade, etc.)');
    }

    return new Response(JSON.stringify({
      success: true,
      validation: validation,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error validating genre:', error);
    return new Response(JSON.stringify({
      error: 'Failed to validate genre',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /manuscripts/:id/metadata-history
 * Get metadata change history for a manuscript
 */
export async function getMetadataHistory(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Verify ownership
    const manuscript = await env.DB.prepare(
      'SELECT user_id FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript || manuscript.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get history
    const history = await env.DB.prepare(`
      SELECT
        h.*,
        u.full_name as changed_by_name,
        u.email as changed_by_email
      FROM manuscript_metadata_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.manuscript_id = ?
      ORDER BY h.changed_at DESC
      LIMIT 100
    `).bind(manuscriptId).all();

    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      count: history.results?.length || 0,
      history: history.results || [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching metadata history:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch metadata history',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Export handlers
export const enhancedMetadataHandlers = {
  getGenres,
  getGenreById,
  getSubgenres,
  getContentWarnings,
  updateEnhancedMetadata,
  validateGenre,
  getMetadataHistory,
};

export default enhancedMetadataHandlers;
