// Slush Pile Management Handlers (Issue #54)
// Publisher inbox, assignments, ratings, consensus, decision workflow

import { getUserFromRequest } from '../utils/auth-utils.js';
import crypto from 'crypto';

// ========================================================================
// PUBLISHER INBOX
// ========================================================================

/**
 * GET /publisher/inbox
 * Get submission inbox with filtering
 */
export async function handleGetPublisherInbox(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const genre = url.searchParams.get('genre');
    const status = url.searchParams.get('status');
    const sortBy = url.searchParams.get('sortBy') || 'date_desc'; // date_desc, date_asc, title
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build WHERE clause
    let whereConditions = ['m.user_id = ?'];
    const bindings = [userId];

    if (genre) {
      whereConditions.push('m.genre = ?');
      bindings.push(genre);
    }

    if (status) {
      whereConditions.push('m.status = ?');
      bindings.push(status);
    }

    const whereClause = whereConditions.join(' AND ');

    // Build ORDER BY clause
    let orderByClause = 'ORDER BY m.created_at DESC';
    if (sortBy === 'date_asc') orderByClause = 'ORDER BY m.created_at ASC';
    if (sortBy === 'title') orderByClause = 'ORDER BY m.title ASC';

    // Query submissions
    const submissions = await env.DB.prepare(`
      SELECT
        m.*,
        COUNT(DISTINCT sa.id) as assignment_count,
        COUNT(DISTINCT sr.id) as rating_count,
        COUNT(DISTINCT sd.id) as discussion_count,
        AVG(sr.overall_score) as avg_score
      FROM manuscripts m
      LEFT JOIN submission_assignments sa ON m.id = sa.submission_id
      LEFT JOIN submission_ratings sr ON m.id = sr.submission_id
      LEFT JOIN submission_discussions sd ON m.id = sd.submission_id
      WHERE ${whereClause}
      GROUP BY m.id
      ${orderByClause}
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all();

    // Get total count
    const countResult = await env.DB.prepare(`
      SELECT COUNT(DISTINCT m.id) as total
      FROM manuscripts m
      WHERE ${whereClause}
    `).bind(...bindings).first();

    return new Response(JSON.stringify({
      success: true,
      submissions: submissions.results,
      total: countResult.total,
      limit,
      offset
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting publisher inbox:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get publisher inbox',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ========================================================================
// ASSIGNMENT MANAGEMENT
// ========================================================================

/**
 * POST /submissions/:id/assign
 * Assign submission to reader
 */
export async function handleAssignSubmission(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    const { submissionId } = request.params;
    const body = await request.json();

    if (!body.assignedToUserId) {
      return new Response(JSON.stringify({
        error: 'Missing required field: assignedToUserId'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify submission exists and user owns it
    const submission = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(submissionId, userId).first();

    if (!submission) {
      return new Response(JSON.stringify({
        error: 'Submission not found or unauthorized'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const assignmentId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO submission_assignments (
        id, submission_id, assigned_to_user_id, assigned_by_user_id,
        assignment_date, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).bind(
      assignmentId,
      submissionId,
      body.assignedToUserId,
      userId,
      Math.floor(Date.now() / 1000),
      body.notes || null,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();

    const assignment = await env.DB.prepare(
      'SELECT * FROM submission_assignments WHERE id = ?'
    ).bind(assignmentId).first();

    return new Response(JSON.stringify({
      success: true,
      assignment
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error assigning submission:', error);
    return new Response(JSON.stringify({
      error: 'Failed to assign submission',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /submissions/:id/assignments
 * Get assignment history for submission
 */
export async function handleGetAssignments(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    const { submissionId } = request.params;

    // Verify access
    const submission = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(submissionId, userId).first();

    if (!submission) {
      return new Response(JSON.stringify({
        error: 'Submission not found or unauthorized'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const assignments = await env.DB.prepare(`
      SELECT
        sa.*,
        u1.email as assigned_to_email,
        u1.display_name as assigned_to_name,
        u2.email as assigned_by_email,
        u2.display_name as assigned_by_name
      FROM submission_assignments sa
      JOIN users u1 ON sa.assigned_to_user_id = u1.id
      JOIN users u2 ON sa.assigned_by_user_id = u2.id
      WHERE sa.submission_id = ?
      ORDER BY sa.assignment_date DESC
    `).bind(submissionId).all();

    return new Response(JSON.stringify({
      success: true,
      assignments: assignments.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting assignments:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get assignments',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /submissions/:submissionId/assignments/:assignmentId
 * Update assignment status
 */
export async function handleUpdateAssignment(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    const { submissionId, assignmentId } = request.params;
    const body = await request.json();

    // Verify assignment exists
    const assignment = await env.DB.prepare(`
      SELECT sa.*, m.user_id as manuscript_owner_id
      FROM submission_assignments sa
      JOIN manuscripts m ON sa.submission_id = m.id
      WHERE sa.id = ? AND sa.submission_id = ?
    `).bind(assignmentId, submissionId).first();

    if (!assignment) {
      return new Response(JSON.stringify({
        error: 'Assignment not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify user is assigned reader or manuscript owner
    if (assignment.assigned_to_user_id !== userId && assignment.manuscript_owner_id !== userId) {
      return new Response(JSON.stringify({
        error: 'Unauthorized to update this assignment'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build update query
    const updates = [];
    const bindings = [];

    if (body.status) {
      updates.push('status = ?');
      bindings.push(body.status);
    }

    if (body.notes !== undefined) {
      updates.push('notes = ?');
      bindings.push(body.notes);
    }

    if (body.status === 'completed' && !assignment.completion_date) {
      updates.push('completion_date = ?');
      bindings.push(Math.floor(Date.now() / 1000));
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        error: 'No valid fields to update'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await env.DB.prepare(`
      UPDATE submission_assignments
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...bindings, assignmentId).run();

    const updated = await env.DB.prepare(
      'SELECT * FROM submission_assignments WHERE id = ?'
    ).bind(assignmentId).first();

    return new Response(JSON.stringify({
      success: true,
      assignment: updated
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating assignment:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update assignment',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ========================================================================
// RATING SYSTEM
// ========================================================================

/**
 * POST /submissions/:id/rate
 * Submit rating/review for submission
 */
export async function handleRateSubmission(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    const { submissionId } = request.params;
    const body = await request.json();

    if (!body.overallScore || !body.recommendation) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: overallScore, recommendation'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify submission exists
    const submission = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ?'
    ).bind(submissionId).first();

    if (!submission) {
      return new Response(JSON.stringify({
        error: 'Submission not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ratingId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO submission_ratings (
        id, submission_id, rater_user_id, assignment_id,
        overall_score, plot_score, writing_quality_score,
        marketability_score, voice_score, recommendation,
        strengths, weaknesses, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      ratingId,
      submissionId,
      userId,
      body.assignmentId || null,
      body.overallScore,
      body.plotScore || null,
      body.writingQualityScore || null,
      body.marketabilityScore || null,
      body.voiceScore || null,
      body.recommendation,
      body.strengths || null,
      body.weaknesses || null,
      body.notes || null,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();

    const rating = await env.DB.prepare(
      'SELECT * FROM submission_ratings WHERE id = ?'
    ).bind(ratingId).first();

    return new Response(JSON.stringify({
      success: true,
      rating
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error rating submission:', error);
    return new Response(JSON.stringify({
      error: 'Failed to rate submission',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /submissions/:id/ratings
 * Get all ratings for submission
 */
export async function handleGetRatings(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    const { submissionId } = request.params;

    const ratings = await env.DB.prepare(`
      SELECT
        sr.*,
        u.email as rater_email,
        u.display_name as rater_name
      FROM submission_ratings sr
      JOIN users u ON sr.rater_user_id = u.id
      WHERE sr.submission_id = ?
      ORDER BY sr.created_at DESC
    `).bind(submissionId).all();

    return new Response(JSON.stringify({
      success: true,
      ratings: ratings.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting ratings:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get ratings',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /submissions/:id/consensus
 * Get consensus score (aggregate ratings)
 */
export async function handleGetConsensus(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    const { submissionId } = request.params;

    const consensus = await env.DB.prepare(
      'SELECT * FROM submission_consensus WHERE submission_id = ?'
    ).bind(submissionId).first();

    if (!consensus) {
      return new Response(JSON.stringify({
        success: true,
        consensus: null,
        message: 'No ratings yet'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      consensus
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting consensus:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get consensus',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ========================================================================
// DISCUSSION THREADS
// ========================================================================

/**
 * POST /submissions/:id/discuss
 * Add discussion comment
 */
export async function handleAddDiscussion(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    const { submissionId } = request.params;
    const body = await request.json();

    if (!body.commentText) {
      return new Response(JSON.stringify({
        error: 'Missing required field: commentText'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const commentId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO submission_discussions (
        id, submission_id, user_id, comment_text,
        is_internal, parent_comment_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      commentId,
      submissionId,
      userId,
      body.commentText,
      body.isInternal !== undefined ? body.isInternal : 1,
      body.parentCommentId || null,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();

    const comment = await env.DB.prepare(
      'SELECT * FROM submission_discussions WHERE id = ?'
    ).bind(commentId).first();

    return new Response(JSON.stringify({
      success: true,
      comment
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error adding discussion comment:', error);
    return new Response(JSON.stringify({
      error: 'Failed to add discussion comment',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /submissions/:id/discussion
 * Get discussion thread
 */
export async function handleGetDiscussion(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    const { submissionId } = request.params;

    const comments = await env.DB.prepare(`
      SELECT
        sd.*,
        u.email as user_email,
        u.display_name as user_name
      FROM submission_discussions sd
      JOIN users u ON sd.user_id = u.id
      WHERE sd.submission_id = ?
      ORDER BY sd.created_at ASC
    `).bind(submissionId).all();

    return new Response(JSON.stringify({
      success: true,
      comments: comments.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting discussion:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get discussion',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ========================================================================
// BATCH OPERATIONS
// ========================================================================

/**
 * POST /publisher/batch-reject
 * Reject multiple submissions
 */
export async function handleBatchReject(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    const body = await request.json();

    if (!body.submissionIds || !Array.isArray(body.submissionIds)) {
      return new Response(JSON.stringify({
        error: 'Missing required field: submissionIds (array)'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const results = [];

    for (const submissionId of body.submissionIds) {
      try {
        // Verify ownership
        const submission = await env.DB.prepare(
          'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
        ).bind(submissionId, userId).first();

        if (!submission) {
          results.push({ submissionId, success: false, error: 'Not found or unauthorized' });
          continue;
        }

        // Update status to rejected
        await env.DB.prepare(
          'UPDATE manuscripts SET status = ?, updated_at = ? WHERE id = ?'
        ).bind('rejected', Math.floor(Date.now() / 1000), submissionId).run();

        results.push({ submissionId, success: true });

      } catch (error) {
        results.push({ submissionId, success: false, error: error.message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error batch rejecting:', error);
    return new Response(JSON.stringify({
      error: 'Failed to batch reject',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ========================================================================
// STATISTICS
// ========================================================================

/**
 * GET /publisher/stats
 * Get publisher slush pile statistics
 */
export async function handleGetPublisherStats(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);

    const stats = await env.DB.prepare(
      'SELECT * FROM publisher_slush_stats WHERE publisher_id = ?'
    ).bind(userId).first();

    // Get additional submission stats
    const submissionStats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_submissions,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'in_review' THEN 1 END) as in_review_count,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
      FROM manuscripts
      WHERE user_id = ?
    `).bind(userId).first();

    return new Response(JSON.stringify({
      success: true,
      stats: {
        ...stats,
        ...submissionStats
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting publisher stats:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get publisher stats',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
