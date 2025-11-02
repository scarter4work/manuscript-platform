// Public API Handlers
// RESTful API endpoints for Enterprise tier programmatic access

import { authenticateAPIKey, APIKeyManager } from '../managers/api-key-manager.js';
import { WebhookManager } from '../managers/webhook-manager.js';

/**
 * POST /api/v1/manuscripts
 * Upload a new manuscript
 */
export async function apiUploadManuscript(request, env) {
  const startTime = Date.now();

  try {
    // Authenticate
    const auth = await authenticateAPIKey(request, env);
    if (!auth.authenticated) {
      return apiErrorResponse(auth.error, 401);
    }

    const { keyDetails } = auth;

    // Check scope
    const manager = new APIKeyManager(env);
    if (!manager.hasScope(keyDetails.scopes, 'manuscripts:write')) {
      return apiErrorResponse('Insufficient permissions', 403);
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');
    const title = formData.get('title');
    const author = formData.get('author') || keyDetails.fullName;
    const genre = formData.get('genre');

    if (!file || !title) {
      return apiErrorResponse('Missing required fields: file, title', 400);
    }

    // Validate file
    const filename = file.name;
    const fileExtension = filename.split('.').pop().toLowerCase();

    if (!['docx', 'doc', 'txt', 'pdf'].includes(fileExtension)) {
      return apiErrorResponse('Invalid file type. Supported: docx, doc, txt, pdf', 400);
    }

    // Store in R2
    const manuscriptId = crypto.randomUUID();
    const r2Key = `${keyDetails.userId}/${manuscriptId}/${filename}`;

    const fileBuffer = await file.arrayBuffer();
    await env.MANUSCRIPTS.put(r2Key, fileBuffer, {
      httpMetadata: {
        contentType: file.type
      }
    });

    // Store manuscript record
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(`
      INSERT INTO manuscripts (
        id, user_id, title, author_name, genre, filename,
        file_size, word_count, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'uploaded', ?, ?)
    `).bind(
      manuscriptId,
      keyDetails.userId,
      title,
      author,
      genre || null,
      filename,
      fileBuffer.byteLength,
      now,
      now
    ).run();

    // Log API usage
    await manager.logUsage(
      keyDetails.keyId,
      '/api/v1/manuscripts',
      'POST',
      201,
      Date.now() - startTime
    );

    // Trigger webhook
    const webhookMgr = new WebhookManager(env);
    await webhookMgr.trigger(keyDetails.userId, 'manuscript.uploaded', {
      manuscriptId,
      title,
      filename
    });

    return apiSuccessResponse({
      manuscriptId,
      title,
      author,
      genre,
      filename,
      fileSize: fileBuffer.byteLength,
      status: 'uploaded',
      createdAt: now
    }, 201);

  } catch (error) {
    console.error('API upload error:', error);
    return apiErrorResponse(error.message, 500);
  }
}

/**
 * POST /api/v1/manuscripts/:id/analyze
 * Trigger analysis for a manuscript
 */
export async function apiAnalyzeManuscript(request, env, manuscriptId) {
  const startTime = Date.now();

  try {
    // Authenticate
    const auth = await authenticateAPIKey(request, env);
    if (!auth.authenticated) {
      return apiErrorResponse(auth.error, 401);
    }

    const { keyDetails } = auth;

    // Check scope
    const manager = new APIKeyManager(env);
    if (!manager.hasScope(keyDetails.scopes, 'manuscripts:write')) {
      return apiErrorResponse('Insufficient permissions', 403);
    }

    // Verify ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, keyDetails.userId).first();

    if (!manuscript) {
      return apiErrorResponse('Manuscript not found', 404);
    }

    // Parse options
    const body = await request.json().catch(() => ({}));
    const {
      developmental = true,
      lineEditing = false,
      copyEditing = false,
      generateAssets = false
    } = body;

    // Queue analysis job
    const jobId = crypto.randomUUID();
    await env.ANALYSIS_QUEUE.send({
      type: 'full_analysis',
      manuscriptId,
      userId: keyDetails.userId,
      filename: manuscript.filename,
      genre: manuscript.genre,
      options: {
        developmental,
        lineEditing,
        copyEditing
      },
      jobId,
      triggeredVia: 'api',
      timestamp: Date.now()
    });

    // Update manuscript status
    await env.DB.prepare(`
      UPDATE manuscripts
      SET status = 'analyzing', updated_at = ?
      WHERE id = ?
    `).bind(Math.floor(Date.now() / 1000), manuscriptId).run();

    // Log API usage
    await manager.logUsage(
      keyDetails.keyId,
      `/api/v1/manuscripts/${manuscriptId}/analyze`,
      'POST',
      202,
      Date.now() - startTime
    );

    // Trigger webhook
    const webhookMgr = new WebhookManager(env);
    await webhookMgr.trigger(keyDetails.userId, 'analysis.started', {
      manuscriptId,
      jobId,
      options: { developmental, lineEditing, copyEditing }
    });

    return apiSuccessResponse({
      manuscriptId,
      jobId,
      status: 'analyzing',
      statusUrl: `/api/v1/manuscripts/${manuscriptId}/status`,
      resultsUrl: `/api/v1/manuscripts/${manuscriptId}/results`,
      estimatedTime: '5-10 minutes'
    }, 202);

  } catch (error) {
    console.error('API analyze error:', error);
    return apiErrorResponse(error.message, 500);
  }
}

/**
 * GET /api/v1/manuscripts/:id/status
 * Check analysis status
 */
export async function apiGetManuscriptStatus(request, env, manuscriptId) {
  const startTime = Date.now();

  try {
    // Authenticate
    const auth = await authenticateAPIKey(request, env);
    if (!auth.authenticated) {
      return apiErrorResponse(auth.error, 401);
    }

    const { keyDetails } = auth;

    // Check scope
    const manager = new APIKeyManager(env);
    if (!manager.hasScope(keyDetails.scopes, 'manuscripts:read')) {
      return apiErrorResponse('Insufficient permissions', 403);
    }

    // Get manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, keyDetails.userId).first();

    if (!manuscript) {
      return apiErrorResponse('Manuscript not found', 404);
    }

    // Log API usage
    await manager.logUsage(
      keyDetails.keyId,
      `/api/v1/manuscripts/${manuscriptId}/status`,
      'GET',
      200,
      Date.now() - startTime
    );

    return apiSuccessResponse({
      manuscriptId,
      title: manuscript.title,
      status: manuscript.status,
      createdAt: manuscript.created_at,
      updatedAt: manuscript.updated_at,
      analysisComplete: manuscript.status === 'analyzed'
    });

  } catch (error) {
    console.error('API status error:', error);
    return apiErrorResponse(error.message, 500);
  }
}

/**
 * GET /api/v1/manuscripts/:id/results
 * Get analysis results
 */
export async function apiGetManuscriptResults(request, env, manuscriptId) {
  const startTime = Date.now();

  try {
    // Authenticate
    const auth = await authenticateAPIKey(request, env);
    if (!auth.authenticated) {
      return apiErrorResponse(auth.error, 401);
    }

    const { keyDetails } = auth;

    // Check scope
    const manager = new APIKeyManager(env);
    if (!manager.hasScope(keyDetails.scopes, 'manuscripts:read')) {
      return apiErrorResponse('Insufficient permissions', 403);
    }

    // Get manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, keyDetails.userId).first();

    if (!manuscript) {
      return apiErrorResponse('Manuscript not found', 404);
    }

    if (manuscript.status !== 'analyzed') {
      return apiErrorResponse('Analysis not complete', 400);
    }

    // Fetch results from R2
    const r2KeyPrefix = `${keyDetails.userId}/${manuscriptId}/`;

    // Get developmental analysis
    const devKey = `${r2KeyPrefix}developmental-analysis-${manuscriptId}.json`;
    const devObj = await env.MANUSCRIPTS_PROCESSED.get(devKey);
    const developmental = devObj ? JSON.parse(await devObj.text()) : null;

    // Get report
    const reportKey = `${r2KeyPrefix}report-${manuscriptId}.json`;
    const reportObj = await env.MANUSCRIPTS_PROCESSED.get(reportKey);
    const report = reportObj ? JSON.parse(await reportObj.text()) : null;

    // Log API usage
    await manager.logUsage(
      keyDetails.keyId,
      `/api/v1/manuscripts/${manuscriptId}/results`,
      'GET',
      200,
      Date.now() - startTime
    );

    return apiSuccessResponse({
      manuscriptId,
      title: manuscript.title,
      status: manuscript.status,
      results: {
        developmental,
        report,
        // Add other analysis types if available
      },
      analyzedAt: manuscript.updated_at
    });

  } catch (error) {
    console.error('API results error:', error);
    return apiErrorResponse(error.message, 500);
  }
}

/**
 * GET /api/v1/manuscripts
 * List all manuscripts
 */
export async function apiListManuscripts(request, env) {
  const startTime = Date.now();

  try {
    // Authenticate
    const auth = await authenticateAPIKey(request, env);
    if (!auth.authenticated) {
      return apiErrorResponse(auth.error, 401);
    }

    const { keyDetails } = auth;

    // Check scope
    const manager = new APIKeyManager(env);
    if (!manager.hasScope(keyDetails.scopes, 'manuscripts:read')) {
      return apiErrorResponse('Insufficient permissions', 403);
    }

    // Parse query params
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status'); // Optional filter

    // Build query
    let query = 'SELECT * FROM manuscripts WHERE user_id = ?';
    const params = [keyDetails.userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const manuscripts = await env.DB.prepare(query).bind(...params).all();

    // Log API usage
    await manager.logUsage(
      keyDetails.keyId,
      '/api/v1/manuscripts',
      'GET',
      200,
      Date.now() - startTime
    );

    return apiSuccessResponse({
      manuscripts: manuscripts.results.map(m => ({
        manuscriptId: m.id,
        title: m.title,
        author: m.author_name,
        genre: m.genre,
        status: m.status,
        wordCount: m.word_count,
        createdAt: m.created_at,
        updatedAt: m.updated_at
      })),
      pagination: {
        limit,
        offset,
        total: manuscripts.results.length
      }
    });

  } catch (error) {
    console.error('API list error:', error);
    return apiErrorResponse(error.message, 500);
  }
}

/**
 * POST /api/v1/webhooks
 * Configure webhooks
 */
export async function apiConfigureWebhook(request, env) {
  const startTime = Date.now();

  try {
    // Authenticate
    const auth = await authenticateAPIKey(request, env);
    if (!auth.authenticated) {
      return apiErrorResponse(auth.error, 401);
    }

    const { keyDetails } = auth;

    // Parse request
    const body = await request.json();
    const { url: webhookUrl, events, secret } = body;

    if (!webhookUrl || !events || !Array.isArray(events)) {
      return apiErrorResponse('Missing required fields: url, events', 400);
    }

    // Validate webhook URL
    try {
      new URL(webhookUrl);
    } catch {
      return apiErrorResponse('Invalid webhook URL', 400);
    }

    // Create webhook
    const webhookMgr = new WebhookManager(env);
    const webhook = await webhookMgr.create(keyDetails.userId, webhookUrl, events, secret);

    // Log API usage
    const manager = new APIKeyManager(env);
    await manager.logUsage(
      keyDetails.keyId,
      '/api/v1/webhooks',
      'POST',
      201,
      Date.now() - startTime
    );

    return apiSuccessResponse(webhook, 201);

  } catch (error) {
    console.error('API webhook error:', error);
    return apiErrorResponse(error.message, 500);
  }
}

/**
 * GET /api/v1/usage
 * Get API usage statistics
 */
export async function apiGetUsage(request, env) {
  const startTime = Date.now();

  try {
    // Authenticate
    const auth = await authenticateAPIKey(request, env);
    if (!auth.authenticated) {
      return apiErrorResponse(auth.error, 401);
    }

    const { keyDetails } = auth;

    // Get usage stats
    const manager = new APIKeyManager(env);
    const stats = await manager.getUsageStats(keyDetails.userId, keyDetails.keyId, 30);

    // Log API usage
    await manager.logUsage(
      keyDetails.keyId,
      '/api/v1/usage',
      'GET',
      200,
      Date.now() - startTime
    );

    return apiSuccessResponse(stats);

  } catch (error) {
    console.error('API usage error:', error);
    return apiErrorResponse(error.message, 500);
  }
}

/**
 * Helper: Create success response
 */
function apiSuccessResponse(data, status = 200) {
  return new Response(JSON.stringify({
    success: true,
    data
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Version': 'v1'
    }
  });
}

/**
 * Helper: Create error response
 */
function apiErrorResponse(message, status = 400) {
  return new Response(JSON.stringify({
    success: false,
    error: {
      message,
      code: status
    }
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Version': 'v1'
    }
  });
}

// Export handlers
export const publicAPIHandlers = {
  apiUploadManuscript,
  apiAnalyzeManuscript,
  apiGetManuscriptStatus,
  apiGetManuscriptResults,
  apiListManuscripts,
  apiConfigureWebhook,
  apiGetUsage
};
