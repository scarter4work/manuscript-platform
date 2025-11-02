/**
 * Audiobook Asset Handlers
 *
 * Provides endpoints for accessing and managing audiobook-specific assets:
 * - Get all audiobook assets for a manuscript
 * - Get specific audiobook asset types
 * - Regenerate audiobook assets
 *
 * All endpoints require authentication and manuscript access.
 */

import { getUserFromRequest } from './auth-utils.js';
import { initCache } from './db-cache.js';

/**
 * Helper: Check if user can access a manuscript
 * Checks: direct ownership, team sharing, or individual sharing
 */
async function checkManuscriptAccess(manuscriptId, userId, env) {
  // Check ownership first
  const manuscript = await env.DB.prepare(
    'SELECT user_id FROM manuscripts WHERE id = ?'
  ).bind(manuscriptId).first();

  if (!manuscript) {
    return { hasAccess: false, permissionLevel: null, isOwner: false };
  }

  const isOwner = manuscript.user_id === userId;
  if (isOwner) {
    return { hasAccess: true, permissionLevel: 'owner', isOwner: true };
  }

  // Check team or individual permissions
  const permission = await env.DB.prepare(`
    SELECT permission_level FROM manuscript_permissions
    WHERE manuscript_id = ?
      AND (
        user_id = ?
        OR team_id IN (
          SELECT team_id FROM team_members WHERE user_id = ?
        )
      )
    ORDER BY
      CASE permission_level
        WHEN 'edit' THEN 1
        WHEN 'comment' THEN 2
        WHEN 'view' THEN 3
      END
    LIMIT 1
  `).bind(manuscriptId, userId, userId).first();

  if (permission) {
    return {
      hasAccess: true,
      permissionLevel: permission.permission_level,
      isOwner: false
    };
  }

  return { hasAccess: false, permissionLevel: null, isOwner: false };
}

export const audiobookHandlers = {
  /**
   * GET /manuscripts/:id/audiobook
   * Get all audiobook assets for a manuscript
   *
   * Returns:
   * {
   *   narration: { ... },
   *   pronunciation: { ... },
   *   timing: { ... },
   *   samples: { ... },
   *   metadata: { ... }
   * }
   */
  async getAudiobookAssets(request, env, manuscriptId) {
    try {
      // Authenticate user
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check manuscript access
      const access = await checkManuscriptAccess(manuscriptId, userId, env);
      if (!access.hasAccess) {
        return new Response(JSON.stringify({ error: 'Manuscript not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get manuscript R2 key
      const manuscript = await env.DB.prepare(
        'SELECT r2_key, title FROM manuscripts WHERE id = ?'
      ).bind(manuscriptId).first();

      if (!manuscript) {
        return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Try to load all audiobook assets from R2
      const manuscriptKey = manuscript.r2_key;
      const audiobook = {
        manuscriptId,
        manuscriptTitle: manuscript.title,
        narration: null,
        pronunciation: null,
        timing: null,
        samples: null,
        metadata: null,
        hasAssets: false
      };

      try {
        const narrationObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-audiobook-narration.json`);
        if (narrationObj) audiobook.narration = await narrationObj.json();
      } catch (e) { console.error('Error loading narration:', e); }

      try {
        const pronunciationObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-audiobook-pronunciation.json`);
        if (pronunciationObj) audiobook.pronunciation = await pronunciationObj.json();
      } catch (e) { console.error('Error loading pronunciation:', e); }

      try {
        const timingObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-audiobook-timing.json`);
        if (timingObj) audiobook.timing = await timingObj.json();
      } catch (e) { console.error('Error loading timing:', e); }

      try {
        const samplesObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-audiobook-samples.json`);
        if (samplesObj) audiobook.samples = await samplesObj.json();
      } catch (e) { console.error('Error loading samples:', e); }

      try {
        const metadataObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-audiobook-metadata.json`);
        if (metadataObj) audiobook.metadata = await metadataObj.json();
      } catch (e) { console.error('Error loading metadata:', e); }

      // Check if any assets were found
      audiobook.hasAssets = !!(
        audiobook.narration || audiobook.pronunciation ||
        audiobook.timing || audiobook.samples || audiobook.metadata
      );

      return new Response(JSON.stringify(audiobook), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error fetching audiobook assets:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * GET /manuscripts/:id/audiobook/:assetType
   * Get a specific audiobook asset type
   *
   * Asset types: narration, pronunciation, timing, samples, metadata
   */
  async getAudiobookAsset(request, env, manuscriptId, assetType) {
    try {
      // Authenticate user
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate asset type
      const validTypes = ['narration', 'pronunciation', 'timing', 'samples', 'metadata'];
      if (!validTypes.includes(assetType)) {
        return new Response(JSON.stringify({ error: `Invalid asset type. Must be one of: ${validTypes.join(', ')}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check manuscript access
      const access = await checkManuscriptAccess(manuscriptId, userId, env);
      if (!access.hasAccess) {
        return new Response(JSON.stringify({ error: 'Manuscript not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get manuscript R2 key
      const manuscript = await env.DB.prepare(
        'SELECT r2_key FROM manuscripts WHERE id = ?'
      ).bind(manuscriptId).first();

      if (!manuscript) {
        return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Load the specific asset from R2
      const manuscriptKey = manuscript.r2_key;
      const assetObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-audiobook-${assetType}.json`);

      if (!assetObj) {
        return new Response(JSON.stringify({
          error: `Audiobook ${assetType} asset not found. Asset generation may not be complete.`
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const asset = await assetObj.json();

      return new Response(JSON.stringify({
        manuscriptId,
        assetType,
        data: asset
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error(`Error fetching audiobook ${assetType} asset:`, error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * POST /manuscripts/:id/audiobook/regenerate
   * Regenerate audiobook assets for a manuscript
   *
   * This triggers the asset generation queue specifically for audiobook assets.
   * Requires that the manuscript has already been analyzed (developmental analysis exists).
   *
   * Body (optional):
   * {
   *   assetTypes: ['narration', 'pronunciation', 'timing', 'samples', 'metadata']
   * }
   *
   * If assetTypes is not provided, all audiobook assets will be regenerated.
   */
  async regenerateAudiobookAssets(request, env, manuscriptId) {
    try {
      // Authenticate user
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check manuscript access - must be owner or have edit permission
      const access = await checkManuscriptAccess(manuscriptId, userId, env);
      if (!access.hasAccess) {
        return new Response(JSON.stringify({ error: 'Manuscript not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!access.isOwner && access.permissionLevel !== 'edit') {
        return new Response(JSON.stringify({ error: 'You must have edit permission to regenerate assets' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get manuscript details
      const manuscript = await env.DB.prepare(
        'SELECT r2_key, genre, status FROM manuscripts WHERE id = ?'
      ).bind(manuscriptId).first();

      if (!manuscript) {
        return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check that manuscript has been analyzed
      const manuscriptKey = manuscript.r2_key;
      const devAnalysisObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-analysis.json`);

      if (!devAnalysisObj) {
        return new Response(JSON.stringify({
          error: 'Manuscript must be analyzed before generating audiobook assets. Please run analysis first.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Parse request body (optional)
      let assetTypes = ['all'];
      try {
        const body = await request.json();
        if (body.assetTypes && Array.isArray(body.assetTypes)) {
          assetTypes = body.assetTypes;
        }
      } catch (e) {
        // No body or invalid JSON - use default (all assets)
      }

      // Generate a short report ID for status tracking
      const reportId = Math.random().toString(36).substring(2, 10);

      // Queue the asset generation
      // Note: Currently this will regenerate ALL assets including marketing assets
      // In a production system, you might want a separate audiobook-specific queue
      await env.ASSET_QUEUE.send({
        manuscriptKey: manuscript.r2_key,
        reportId: reportId,
        genre: manuscript.genre || 'general',
        regenerateAudiobookOnly: true, // Flag for future selective regeneration
        assetTypes: assetTypes
      });

      return new Response(JSON.stringify({
        message: 'Audiobook asset regeneration queued',
        reportId: reportId,
        manuscriptId: manuscriptId,
        assetTypes: assetTypes,
        statusUrl: `/manuscripts/${manuscriptId}/status/${reportId}`
      }), {
        status: 202, // Accepted
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error regenerating audiobook assets:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
