/**
 * Submission Response Handlers (Issue #52)
 *
 * Nuanced submission tracking beyond binary accept/reject.
 *
 * Features:
 * - 8 response types (form rejection, R&R, request full, offer, etc.)
 * - Categorized feedback tracking
 * - Revise & Resubmit (R&R) workflow
 * - Resubmission linking
 * - Feedback addressed tracking
 */

import { getUserFromRequest } from '../utils/auth-utils.js';

/**
 * POST /manuscripts/:id/submissions
 * Create new submission
 *
 * Body: {
 *   packageId: string (optional),
 *   publisherName: string,
 *   publisherType: 'agent' | 'publisher' | 'magazine' | 'contest' | 'other',
 *   submissionType: 'query' | 'partial' | 'full',
 *   submissionDate: number (optional, defaults to now)
 * }
 */
export async function createSubmission(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { packageId, publisherName, publisherType, submissionType, submissionDate } = body;

    if (!publisherName || !publisherType) {
      return new Response(JSON.stringify({
        error: 'publisherName and publisherType are required',
        validTypes: ['agent', 'publisher', 'magazine', 'contest', 'other']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const submissionId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO submissions
      (id, manuscript_id, user_id, package_id, publisher_name, publisher_type,
       submission_type, submission_date, response_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      submissionId,
      manuscriptId,
      user.id,
      packageId || null,
      publisherName,
      publisherType,
      submissionType || 'query',
      submissionDate || Math.floor(Date.now() / 1000)
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Submission created successfully',
      submission: {
        id: submissionId,
        manuscriptId: manuscriptId,
        publisherName: publisherName,
        responseType: 'pending',
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error creating submission:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create submission',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /manuscripts/:id/submissions
 * List all submissions for a manuscript
 */
export async function listSubmissions(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT user_id FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript || manuscript.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const submissions = await env.DB.prepare(`
      SELECT * FROM submission_stats WHERE manuscript_id = ?
      ORDER BY submission_date DESC
    `).bind(manuscriptId).all();

    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      count: submissions.results?.length || 0,
      submissions: submissions.results || [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error listing submissions:', error);
    return new Response(JSON.stringify({
      error: 'Failed to list submissions',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /submissions/:id
 * Get submission details
 */
export async function getSubmission(request, env, submissionId) {
  try {
    const user = await getUserFromRequest(request, env);

    const submission = await env.DB.prepare(
      'SELECT * FROM submissions WHERE id = ? AND user_id = ?'
    ).bind(submissionId, user.id).first();

    if (!submission) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get feedback
    const feedback = await env.DB.prepare(
      'SELECT * FROM submission_feedback WHERE submission_id = ? ORDER BY created_at DESC'
    ).bind(submissionId).all();

    // Parse JSON fields
    const feedbackCategory = submission.feedback_category ? JSON.parse(submission.feedback_category) : [];

    return new Response(JSON.stringify({
      success: true,
      submission: {
        ...submission,
        feedback_category: feedbackCategory,
        feedback: feedback.results || [],
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error getting submission:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get submission',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * PATCH /submissions/:id/response
 * Update submission response
 *
 * Body: {
 *   responseType: 'form_rejection' | 'personal_rejection' | 'revise_resubmit' |
 *                 'request_full' | 'hold' | 'waitlist' | 'offer' | 'withdrawn',
 *   responseDate: number (optional),
 *   feedbackText: string (optional),
 *   feedbackCategory: string[] (optional),
 *   responseNotes: string (optional),
 *   resubmissionDeadline: number (optional, for R&R)
 * }
 */
export async function updateSubmissionResponse(request, env, submissionId) {
  try {
    const user = await getUserFromRequest(request, env);

    const submission = await env.DB.prepare(
      'SELECT * FROM submissions WHERE id = ? AND user_id = ?'
    ).bind(submissionId, user.id).first();

    if (!submission) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { responseType, responseDate, feedbackText, feedbackCategory, responseNotes, resubmissionDeadline } = body;

    const validResponseTypes = [
      'pending', 'form_rejection', 'personal_rejection', 'revise_resubmit',
      'request_full', 'hold', 'waitlist', 'offer', 'withdrawn'
    ];

    if (responseType && !validResponseTypes.includes(responseType)) {
      return new Response(JSON.stringify({
        error: 'Invalid response type',
        validTypes: validResponseTypes
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await env.DB.prepare(`
      UPDATE submissions
      SET response_type = ?,
          response_date = ?,
          feedback_text = ?,
          feedback_category = ?,
          response_notes = ?,
          resubmission_deadline = ?
      WHERE id = ?
    `).bind(
      responseType || submission.response_type,
      responseDate !== undefined ? responseDate : submission.response_date,
      feedbackText !== undefined ? feedbackText : submission.feedback_text,
      feedbackCategory ? JSON.stringify(feedbackCategory) : submission.feedback_category,
      responseNotes !== undefined ? responseNotes : submission.response_notes,
      resubmissionDeadline !== undefined ? resubmissionDeadline : submission.resubmission_deadline,
      submissionId
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Submission response updated successfully',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error updating submission response:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update submission response',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /submissions/:id/feedback
 * Add categorized feedback
 *
 * Body: {
 *   feedbackType: 'plot' | 'character' | 'pacing' | 'voice' | 'dialogue' |
 *                 'worldbuilding' | 'marketability' | 'length' | 'genre_fit' | 'other',
 *   feedbackText: string
 * }
 */
export async function createFeedback(request, env, submissionId) {
  try {
    const user = await getUserFromRequest(request, env);

    const submission = await env.DB.prepare(
      'SELECT * FROM submissions WHERE id = ? AND user_id = ?'
    ).bind(submissionId, user.id).first();

    if (!submission) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { feedbackType, feedbackText } = body;

    const validFeedbackTypes = [
      'plot', 'character', 'pacing', 'voice', 'dialogue', 'worldbuilding',
      'marketability', 'length', 'genre_fit', 'other'
    ];

    if (!feedbackType || !validFeedbackTypes.includes(feedbackType)) {
      return new Response(JSON.stringify({
        error: 'Invalid feedback type',
        validTypes: validFeedbackTypes
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!feedbackText) {
      return new Response(JSON.stringify({ error: 'feedbackText is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const feedbackId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO submission_feedback
      (id, submission_id, feedback_type, feedback_text)
      VALUES (?, ?, ?, ?)
    `).bind(
      feedbackId,
      submissionId,
      feedbackType,
      feedbackText
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Feedback added successfully',
      feedback: {
        id: feedbackId,
        feedbackType: feedbackType,
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error creating feedback:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create feedback',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /submissions/:id/feedback
 * Get all feedback for a submission
 */
export async function listFeedback(request, env, submissionId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Verify submission ownership
    const submission = await env.DB.prepare(
      'SELECT user_id FROM submissions WHERE id = ?'
    ).bind(submissionId).first();

    if (!submission || submission.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const feedback = await env.DB.prepare(
      'SELECT * FROM submission_feedback WHERE submission_id = ? ORDER BY created_at DESC'
    ).bind(submissionId).all();

    return new Response(JSON.stringify({
      success: true,
      submissionId: submissionId,
      count: feedback.results?.length || 0,
      feedback: feedback.results || [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error listing feedback:', error);
    return new Response(JSON.stringify({
      error: 'Failed to list feedback',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * PATCH /submissions/:id/feedback/:fbId
 * Mark feedback as addressed
 *
 * Body: { addressed: boolean, responseNotes: string }
 */
export async function updateFeedback(request, env, submissionId, feedbackId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Verify ownership via submission
    const submission = await env.DB.prepare(
      'SELECT user_id FROM submissions WHERE id = ?'
    ).bind(submissionId).first();

    if (!submission || submission.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const feedback = await env.DB.prepare(
      'SELECT * FROM submission_feedback WHERE id = ? AND submission_id = ?'
    ).bind(feedbackId, submissionId).first();

    if (!feedback) {
      return new Response(JSON.stringify({ error: 'Feedback not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { addressed, responseNotes } = body;

    await env.DB.prepare(`
      UPDATE submission_feedback
      SET addressed = ?, response_notes = ?
      WHERE id = ?
    `).bind(
      addressed !== undefined ? (addressed ? 1 : 0) : feedback.addressed,
      responseNotes !== undefined ? responseNotes : feedback.response_notes,
      feedbackId
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Feedback updated successfully',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error updating feedback:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update feedback',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /submissions/:id/resubmit
 * Create resubmission from R&R
 *
 * Body: {
 *   packageId: string (optional),
 *   revisionNotes: string,
 *   submissionDate: number (optional)
 * }
 */
export async function createResubmission(request, env, originalSubmissionId) {
  try {
    const user = await getUserFromRequest(request, env);

    const originalSubmission = await env.DB.prepare(
      'SELECT * FROM submissions WHERE id = ? AND user_id = ?'
    ).bind(originalSubmissionId, user.id).first();

    if (!originalSubmission) {
      return new Response(JSON.stringify({ error: 'Original submission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (originalSubmission.response_type !== 'revise_resubmit') {
      return new Response(JSON.stringify({
        error: 'Original submission must have response type "revise_resubmit" to create resubmission'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { packageId, revisionNotes, submissionDate } = body;

    if (!revisionNotes) {
      return new Response(JSON.stringify({ error: 'revisionNotes is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resubmissionId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO submissions
      (id, manuscript_id, user_id, package_id, publisher_name, publisher_type,
       submission_type, submission_date, response_type, is_resubmission,
       original_submission_id, revision_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?)
    `).bind(
      resubmissionId,
      originalSubmission.manuscript_id,
      user.id,
      packageId || originalSubmission.package_id,
      originalSubmission.publisher_name,
      originalSubmission.publisher_type,
      originalSubmission.submission_type,
      submissionDate || Math.floor(Date.now() / 1000),
      originalSubmissionId,
      revisionNotes
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Resubmission created successfully',
      submission: {
        id: resubmissionId,
        originalSubmissionId: originalSubmissionId,
        isResubmission: true,
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error creating resubmission:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create resubmission',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /manuscripts/:id/feedback-summary
 * Aggregate feedback across all submissions for a manuscript
 */
export async function getFeedbackSummary(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT user_id FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript || manuscript.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get all feedback for this manuscript's submissions
    const feedback = await env.DB.prepare(`
      SELECT sf.*
      FROM submission_feedback sf
      JOIN submissions s ON sf.submission_id = s.id
      WHERE s.manuscript_id = ?
      ORDER BY sf.feedback_type, sf.created_at DESC
    `).bind(manuscriptId).all();

    // Aggregate by feedback type
    const summary = {};
    const feedbackList = feedback.results || [];

    feedbackList.forEach(fb => {
      if (!summary[fb.feedback_type]) {
        summary[fb.feedback_type] = {
          type: fb.feedback_type,
          count: 0,
          addressed: 0,
          feedback: []
        };
      }
      summary[fb.feedback_type].count++;
      if (fb.addressed) summary[fb.feedback_type].addressed++;
      summary[fb.feedback_type].feedback.push({
        id: fb.id,
        text: fb.feedback_text,
        addressed: fb.addressed === 1,
        responseNotes: fb.response_notes,
      });
    });

    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      totalFeedback: feedbackList.length,
      summary: Object.values(summary),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error getting feedback summary:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get feedback summary',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Export handlers
export const submissionResponseHandlers = {
  createSubmission,
  listSubmissions,
  getSubmission,
  updateSubmissionResponse,
  createFeedback,
  listFeedback,
  updateFeedback,
  createResubmission,
  getFeedbackSummary,
};

export default submissionResponseHandlers;
