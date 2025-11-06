/**
 * Human-Style Editor API Handlers
 * Endpoints for generating and managing human-style editorial feedback
 * Issue #60: https://github.com/scarter4work/manuscript-platform/issues/60
 */

import {
  generateChapterFeedback,
  validateAnnotation,
  generateChapterSummary
} from '../generators/human-style-editor.js';
import { getUserFromRequest } from '../utils/auth-utils.js';

/**
 * POST /manuscripts/:id/human-edit/chapter/:chapterNum
 * Generate human-style editorial feedback for a chapter
 */
export async function handleGenerateChapterFeedback(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { manuscriptId, chapterNum } = request.params;
    const chapterNumber = parseInt(chapterNum, 10);

    if (isNaN(chapterNumber) || chapterNumber < 1) {
      return new Response(JSON.stringify({ error: 'Invalid chapter number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

    const body = await request.json();

    // Get chapter text (should be provided in request body)
    const chapterText = body.chapterText;
    if (!chapterText) {
      return new Response(JSON.stringify({
        error: 'Chapter text is required in request body'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get previous chapters context (optional)
    const previousChapters = body.previousChapters || '';

    // Generate feedback
    const result = await generateChapterFeedback({
      manuscriptId,
      chapterNumber,
      chapterText,
      previousChapters,
      genre: manuscript.genre || 'general'
    }, env);

    // Create session record
    const sessionId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO human_edit_sessions (
        id, manuscript_id, user_id, chapter_number,
        analysis_cost, annotation_count,
        question_count, suggestion_count, praise_count,
        issue_count, continuity_count,
        chapter_context, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId,
      manuscriptId,
      userId,
      chapterNumber,
      result.cost || 0,
      result.annotations.length,
      result.stats.typeCounts.question || 0,
      result.stats.typeCounts.suggestion || 0,
      result.stats.typeCounts.praise || 0,
      result.stats.typeCounts.issue || 0,
      result.stats.typeCounts.continuity || 0,
      previousChapters.substring(0, 1000), // Truncate for storage
      Math.floor(Date.now() / 1000)
    ).run();

    // Store annotations in database
    for (const annotation of result.annotations) {
      const annotationId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO human_style_edits (
          id, manuscript_id, user_id, chapter_number,
          paragraph_index, annotation_type, comment_text,
          alternatives, severity, chapter_context,
          addressed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        annotationId,
        manuscriptId,
        userId,
        chapterNumber,
        annotation.paragraphIndex,
        annotation.type,
        annotation.text,
        annotation.alternatives ? JSON.stringify(annotation.alternatives) : null,
        annotation.severity,
        annotation.chapterContext || null,
        0, // Not addressed yet
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      ).run();

      // Add ID to annotation for response
      annotation.id = annotationId;
    }

    return new Response(JSON.stringify({
      success: true,
      sessionId,
      chapterNumber,
      feedback: {
        annotations: result.annotations,
        stats: result.stats,
        paragraphCount: result.paragraphCount,
        cost: result.cost,
        tokensUsed: result.tokensUsed
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating chapter feedback:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate chapter feedback',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /manuscripts/:id/human-edit
 * Retrieve all human-style editorial feedback for a manuscript
 */
export async function handleGetAllFeedback(request, env) {
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

    // Get all annotations for this manuscript
    const annotations = await env.DB.prepare(`
      SELECT
        id, chapter_number, paragraph_index, annotation_type,
        comment_text, alternatives, severity, chapter_context,
        addressed, author_response, created_at, updated_at
      FROM human_style_edits
      WHERE manuscript_id = ? AND user_id = ?
      ORDER BY chapter_number ASC, paragraph_index ASC
    `).bind(manuscriptId, userId).all();

    // Parse JSON fields
    const parsedAnnotations = annotations.results.map(ann => ({
      ...ann,
      alternatives: ann.alternatives ? JSON.parse(ann.alternatives) : null,
      addressed: Boolean(ann.addressed)
    }));

    // Get session statistics
    const stats = await env.DB.prepare(`
      SELECT * FROM human_edit_stats WHERE manuscript_id = ?
    `).bind(manuscriptId).first();

    // Group by chapter
    const byChapter = {};
    parsedAnnotations.forEach(ann => {
      if (!byChapter[ann.chapter_number]) {
        byChapter[ann.chapter_number] = [];
      }
      byChapter[ann.chapter_number].push(ann);
    });

    return new Response(JSON.stringify({
      success: true,
      manuscriptId,
      annotations: parsedAnnotations,
      byChapter,
      stats: stats || null,
      totalAnnotations: parsedAnnotations.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving feedback:', error);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve feedback',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /manuscripts/:id/human-edit/chapter/:chapterNum
 * Retrieve feedback for a specific chapter
 */
export async function handleGetChapterFeedback(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { manuscriptId, chapterNum } = request.params;
    const chapterNumber = parseInt(chapterNum, 10);

    if (isNaN(chapterNumber) || chapterNumber < 1) {
      return new Response(JSON.stringify({ error: 'Invalid chapter number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

    // Get annotations for this chapter
    const annotations = await env.DB.prepare(`
      SELECT
        id, chapter_number, paragraph_index, annotation_type,
        comment_text, alternatives, severity, chapter_context,
        addressed, author_response, created_at, updated_at
      FROM human_style_edits
      WHERE manuscript_id = ? AND user_id = ? AND chapter_number = ?
      ORDER BY paragraph_index ASC
    `).bind(manuscriptId, userId, chapterNumber).all();

    // Parse JSON fields
    const parsedAnnotations = annotations.results.map(ann => ({
      ...ann,
      alternatives: ann.alternatives ? JSON.parse(ann.alternatives) : null,
      addressed: Boolean(ann.addressed)
    }));

    // Get session info
    const session = await env.DB.prepare(`
      SELECT * FROM human_edit_sessions
      WHERE manuscript_id = ? AND chapter_number = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(manuscriptId, chapterNumber).first();

    return new Response(JSON.stringify({
      success: true,
      manuscriptId,
      chapterNumber,
      annotations: parsedAnnotations,
      session: session || null,
      totalAnnotations: parsedAnnotations.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving chapter feedback:', error);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve chapter feedback',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /manuscripts/:id/human-edit/accept/:editId
 * Mark an annotation as addressed
 */
export async function handleAcceptAnnotation(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { manuscriptId, editId } = request.params;
    const body = await request.json();

    // Verify annotation exists and belongs to user
    const annotation = await env.DB.prepare(`
      SELECT * FROM human_style_edits
      WHERE id = ? AND manuscript_id = ? AND user_id = ?
    `).bind(editId, manuscriptId, userId).first();

    if (!annotation) {
      return new Response(JSON.stringify({ error: 'Annotation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update annotation
    await env.DB.prepare(`
      UPDATE human_style_edits
      SET addressed = 1, author_response = ?
      WHERE id = ?
    `).bind(
      body.authorResponse || null,
      editId
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Annotation marked as addressed'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error accepting annotation:', error);
    return new Response(JSON.stringify({
      error: 'Failed to accept annotation',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /manuscripts/:id/human-edit/:editId
 * Dismiss an annotation (soft delete)
 */
export async function handleDismissAnnotation(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { manuscriptId, editId } = request.params;

    // Verify annotation exists and belongs to user
    const annotation = await env.DB.prepare(`
      SELECT * FROM human_style_edits
      WHERE id = ? AND manuscript_id = ? AND user_id = ?
    `).bind(editId, manuscriptId, userId).first();

    if (!annotation) {
      return new Response(JSON.stringify({ error: 'Annotation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete annotation
    await env.DB.prepare(`
      DELETE FROM human_style_edits WHERE id = ?
    `).bind(editId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Annotation dismissed'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error dismissing annotation:', error);
    return new Response(JSON.stringify({
      error: 'Failed to dismiss annotation',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
