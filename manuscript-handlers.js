/**
 * Manuscript Management Handlers (Phase B)
 *
 * Provides endpoints for user manuscript library management:
 * - List user's manuscripts
 * - Get manuscript details
 * - Update manuscript metadata
 * - Delete manuscripts
 * - Track manuscript status (draft, analyzing, complete)
 *
 * All endpoints require authentication.
 *
 * MAN-28/MAN-39: Now includes KV caching for improved performance
 */

import { getUserFromRequest } from './auth-utils.js';
import { initCache } from './db-cache.js';

export const manuscriptHandlers = {
  /**
   * GET /manuscripts
   * List all manuscripts for the authenticated user
   *
   * Query parameters:
   * - status: Filter by status (draft, analyzing, complete)
   * - genre: Filter by genre
   * - limit: Number of results (default: 50)
   * - offset: Pagination offset (default: 0)
   *
   * Returns: Array of manuscript objects with metadata
   *
   * MAN-39: Now with KV caching (5 min TTL for first page)
   */
  async listManuscripts(request, env) {
    try {
      // Get authenticated user (returns userId directly)
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const genre = url.searchParams.get('genre');
      const limit = parseInt(url.searchParams.get('limit')) || 50;
      const offset = parseInt(url.searchParams.get('offset')) || 0;

      // Initialize cache
      const cache = initCache(env);

      // Try cache for first page only (offset === 0)
      let cacheHit = false;
      if (offset === 0) {
        const cacheKey = `manuscripts:${userId}:${status || 'all'}:${genre || 'all'}:p1`;
        const cached = await cache.cache.get(cacheKey);

        if (cached) {
          console.log(`Cache HIT: ${cacheKey}`);
          return new Response(JSON.stringify(cached), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Cache': 'HIT'
            }
          });
        }
      }

      // Build query
      let query = 'SELECT * FROM manuscripts WHERE user_id = ?';
      const params = [userId];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      if (genre) {
        query += ' AND genre = ?';
        params.push(genre);
      }

      query += ' ORDER BY uploaded_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const { results } = await env.DB.prepare(query).bind(...params).all();

      // Parse JSON metadata for each manuscript
      const manuscripts = results.map(m => ({
        ...m,
        metadata: m.metadata ? JSON.parse(m.metadata) : {}
      }));

      const response = {
        success: true,
        manuscripts,
        count: manuscripts.length,
        limit,
        offset
      };

      // Cache first page results (5 min TTL)
      if (offset === 0) {
        const cacheKey = `manuscripts:${userId}:${status || 'all'}:${genre || 'all'}:p1`;
        await cache.cache.set(cacheKey, response, 300); // 5 min
        console.log(`Cache SET: ${cacheKey}`);
      }

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'MISS'
        }
      });

    } catch (error) {
      console.error('List manuscripts error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * GET /manuscripts/:id
   * Get details of a specific manuscript
   *
   * Returns: Manuscript object with full metadata
   *
   * MAN-39: Now uses KV caching for metadata (15 min TTL) and analysis status (1 hour TTL)
   * Reduces 4 R2 HEAD requests to 0 on cache hit
   */
  async getManuscript(request, env, manuscriptId) {
    try {
      // Get authenticated user
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Initialize cache
      const cache = initCache(env);

      // Get manuscript from cache or DB
      const manuscript = await cache.manuscript.getMetadata(manuscriptId, userId, env);

      if (!manuscript) {
        return new Response(JSON.stringify({ error: 'Manuscript not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get analysis status from cache (reduces 4 R2 HEAD requests)
      const analysisStatus = await cache.manuscript.getAnalysisStatus(manuscript.r2_key, env);

      return new Response(JSON.stringify({
        success: true,
        manuscript: {
          ...manuscript,
          analysisStatus
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT'  // Both metadata and analysis status can be cached
        }
      });

    } catch (error) {
      console.error('Get manuscript error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * PUT /manuscripts/:id
   * Update manuscript metadata (title, genre, status)
   *
   * Request body: { title?, genre?, status?, metadata? }
   * Returns: Updated manuscript object
   *
   * MAN-39: Now invalidates related caches after update
   */
  async updateManuscript(request, env, manuscriptId) {
    try {
      // Get authenticated user
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body = await request.json();

      // Verify ownership and get r2_key for cache invalidation
      const { results } = await env.DB.prepare(
        'SELECT id, r2_key FROM manuscripts WHERE id = ? AND user_id = ?'
      ).bind(manuscriptId, userId).all();

      if (results.length === 0) {
        return new Response(JSON.stringify({ error: 'Manuscript not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const r2_key = results[0].r2_key;

      // Build update query dynamically based on provided fields
      const updates = [];
      const params = [];

      if (body.title !== undefined) {
        updates.push('title = ?');
        params.push(body.title);
      }

      if (body.genre !== undefined) {
        updates.push('genre = ?');
        params.push(body.genre);
      }

      if (body.status !== undefined) {
        updates.push('status = ?');
        params.push(body.status);
      }

      if (body.metadata !== undefined) {
        updates.push('metadata = ?');
        params.push(JSON.stringify(body.metadata));
      }

      updates.push('updated_at = ?');
      params.push(Math.floor(Date.now() / 1000));

      params.push(manuscriptId);

      const updateQuery = `
        UPDATE manuscripts
        SET ${updates.join(', ')}
        WHERE id = ?
      `;

      await env.DB.prepare(updateQuery).bind(...params).run();

      // Fetch updated manuscript
      const { results: updated } = await env.DB.prepare(
        'SELECT * FROM manuscripts WHERE id = ?'
      ).bind(manuscriptId).all();

      // IMPORTANT: Invalidate caches after update
      const cache = initCache(env);
      await cache.manuscript.invalidate(manuscriptId, userId, r2_key);
      console.log(`Cache INVALIDATED: manuscript ${manuscriptId}`);

      return new Response(JSON.stringify({
        success: true,
        manuscript: {
          ...updated[0],
          metadata: updated[0].metadata ? JSON.parse(updated[0].metadata) : {}
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Update manuscript error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * DELETE /manuscripts/:id
   * Delete a manuscript and all associated data
   *
   * Deletes:
   * - Database record
   * - R2 manuscript file
   * - All analysis results
   * - Generated assets
   *
   * Returns: Success confirmation
   *
   * MAN-39: Now invalidates related caches after deletion
   */
  async deleteManuscript(request, env, manuscriptId) {
    try {
      // Get authenticated user
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Fetch manuscript and verify ownership
      const { results } = await env.DB.prepare(
        'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
      ).bind(manuscriptId, userId).all();

      if (results.length === 0) {
        return new Response(JSON.stringify({ error: 'Manuscript not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const manuscript = results[0];

      // Delete all associated files from R2
      const filesToDelete = [
        manuscript.r2_key,
        `${manuscript.r2_key}-analysis.json`,
        `${manuscript.r2_key}-line-analysis.json`,
        `${manuscript.r2_key}-copy-analysis.json`,
        `${manuscript.r2_key}-assets.json`,
        `${manuscript.r2_key}-market-analysis.json`,
        `${manuscript.r2_key}-social-media.json`,
        `${manuscript.r2_key}-formatted.epub`,
        `${manuscript.r2_key}-formatted.pdf`
      ];

      // Delete from R2 (ignore errors if files don't exist)
      await Promise.all(
        filesToDelete.map(key =>
          env.MANUSCRIPTS_RAW.delete(key).catch(() => {}) &&
          env.MANUSCRIPTS_PROCESSED.delete(key).catch(() => {})
        )
      );

      // Delete report ID mapping if it exists
      const metadata = manuscript.metadata ? JSON.parse(manuscript.metadata) : {};
      if (metadata.reportId) {
        await env.MANUSCRIPTS_RAW.delete(`report-id:${metadata.reportId}`).catch(() => {});
        await env.MANUSCRIPTS_RAW.delete(`status:${metadata.reportId}`).catch(() => {});
      }

      // IMPORTANT: Invalidate caches before database deletion
      const cache = initCache(env);
      await cache.manuscript.invalidate(manuscriptId, userId, manuscript.r2_key);
      console.log(`Cache INVALIDATED: manuscript ${manuscriptId}`);

      // Delete from database
      await env.DB.prepare(
        'DELETE FROM manuscripts WHERE id = ?'
      ).bind(manuscriptId).run();

      // Log audit event
      await env.DB.prepare(`
        INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, timestamp, metadata)
        VALUES (?, ?, 'delete', 'manuscript', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        userId,
        manuscriptId,
        Math.floor(Date.now() / 1000),
        JSON.stringify({ title: manuscript.title })
      ).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Manuscript and all associated data deleted successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Delete manuscript error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * POST /manuscripts/:id/reanalyze
   * Re-run analysis on an existing manuscript
   *
   * Request body: { genre?, styleGuide? }
   * Returns: Analysis job confirmation
   */
  async reanalyzeManuscript(request, env, manuscriptId) {
    try {
      // Get authenticated user
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify ownership
      const { results } = await env.DB.prepare(
        'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
      ).bind(manuscriptId, userId).all();

      if (results.length === 0) {
        return new Response(JSON.stringify({ error: 'Manuscript not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const manuscript = results[0];
      const body = await request.json().catch(() => ({}));
      const metadata = manuscript.metadata ? JSON.parse(manuscript.metadata) : {};

      // Generate new report ID
      const reportId = crypto.randomUUID().substring(0, 8);

      // Update manuscript metadata with new report ID
      metadata.reportId = reportId;
      await env.DB.prepare(
        'UPDATE manuscripts SET metadata = ?, status = ?, updated_at = ? WHERE id = ?'
      ).bind(
        JSON.stringify(metadata),
        'analyzing',
        Math.floor(Date.now() / 1000),
        manuscriptId
      ).run();

      // Create new report ID mapping
      await env.MANUSCRIPTS_RAW.put(`report-id:${reportId}`, manuscript.r2_key, {
        expirationTtl: 60 * 60 * 24 * 30 // 30 days
      });

      // Initialize status
      await env.MANUSCRIPTS_RAW.put(
        `status:${reportId}`,
        JSON.stringify({
          status: 'queued',
          progress: 0,
          message: 'Analysis queued',
          timestamp: new Date().toISOString()
        }),
        { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
      );

      // Queue the analysis job
      await env.ANALYSIS_QUEUE.send({
        manuscriptKey: manuscript.r2_key,
        genre: body.genre || manuscript.genre || 'general',
        styleGuide: body.styleGuide || 'chicago',
        reportId
      });

      return new Response(JSON.stringify({
        success: true,
        reportId,
        message: 'Analysis started',
        manuscriptId
      }), {
        status: 202, // Accepted
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Reanalyze manuscript error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * GET /manuscripts/stats
   * Get user's manuscript statistics
   *
   * Returns: Stats object with counts by status, genre, etc.
   */
  async getManuscriptStats(request, env) {
    try {
      // Get authenticated user
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get total count
      const { results: totalResults } = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM manuscripts WHERE user_id = ?'
      ).bind(userId).all();
      const total = totalResults[0].count;

      // Get count by status
      const { results: byStatus } = await env.DB.prepare(
        'SELECT status, COUNT(*) as count FROM manuscripts WHERE user_id = ? GROUP BY status'
      ).bind(userId).all();

      // Get count by genre
      const { results: byGenre } = await env.DB.prepare(
        'SELECT genre, COUNT(*) as count FROM manuscripts WHERE user_id = ? AND genre IS NOT NULL GROUP BY genre'
      ).bind(userId).all();

      // Get total word count
      const { results: wordCountResults } = await env.DB.prepare(
        'SELECT SUM(word_count) as total FROM manuscripts WHERE user_id = ? AND word_count IS NOT NULL'
      ).bind(userId).all();
      const totalWordCount = wordCountResults[0].total || 0;

      return new Response(JSON.stringify({
        success: true,
        stats: {
          total,
          totalWordCount,
          byStatus: byStatus.reduce((acc, item) => {
            acc[item.status] = item.count;
            return acc;
          }, {}),
          byGenre: byGenre.reduce((acc, item) => {
            acc[item.genre] = item.count;
            return acc;
          }, {})
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Get manuscript stats error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
