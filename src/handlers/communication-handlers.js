/**
 * Communication & Feedback System API Handlers
 * Publisher-author messaging, templates, notifications, revision requests
 * Issue #55: https://github.com/scarter4work/manuscript-platform/issues/55
 */

import { getUserFromRequest } from '../utils/auth-utils.js';

/**
 * GET /notifications/preferences
 * Get user's notification preferences
 */
export async function handleGetNotificationPreferences(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get or create preferences
    let prefs = await env.DB.prepare(
      'SELECT * FROM notification_preferences WHERE user_id = ?'
    ).bind(userId).first();

    if (!prefs) {
      // Create default preferences
      const prefsId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO notification_preferences (
          id, user_id, email_on_submission_received, email_on_status_change,
          email_on_decision, email_on_message, email_on_revision_request,
          email_on_revision_submitted, digest_frequency
        ) VALUES (?, ?, 1, 1, 1, 1, 1, 1, 'immediate')
      `).bind(prefsId, userId).run();

      prefs = await env.DB.prepare(
        'SELECT * FROM notification_preferences WHERE id = ?'
      ).bind(prefsId).first();
    }

    return new Response(JSON.stringify({
      success: true,
      preferences: prefs
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get notification preferences',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /notifications/preferences
 * Update user's notification preferences
 */
export async function handleUpdateNotificationPreferences(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();

    // Get existing preferences
    const prefs = await env.DB.prepare(
      'SELECT * FROM notification_preferences WHERE user_id = ?'
    ).bind(userId).first();

    if (!prefs) {
      return new Response(JSON.stringify({ error: 'Preferences not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update preferences
    await env.DB.prepare(`
      UPDATE notification_preferences SET
        email_on_submission_received = ?,
        email_on_status_change = ?,
        email_on_decision = ?,
        email_on_message = ?,
        email_on_revision_request = ?,
        email_on_revision_submitted = ?,
        digest_frequency = ?
      WHERE user_id = ?
    `).bind(
      body.emailOnSubmissionReceived !== undefined ? (body.emailOnSubmissionReceived ? 1 : 0) : prefs.email_on_submission_received,
      body.emailOnStatusChange !== undefined ? (body.emailOnStatusChange ? 1 : 0) : prefs.email_on_status_change,
      body.emailOnDecision !== undefined ? (body.emailOnDecision ? 1 : 0) : prefs.email_on_decision,
      body.emailOnMessage !== undefined ? (body.emailOnMessage ? 1 : 0) : prefs.email_on_message,
      body.emailOnRevisionRequest !== undefined ? (body.emailOnRevisionRequest ? 1 : 0) : prefs.email_on_revision_request,
      body.emailOnRevisionSubmitted !== undefined ? (body.emailOnRevisionSubmitted ? 1 : 0) : prefs.email_on_revision_submitted,
      body.digestFrequency || prefs.digest_frequency,
      userId
    ).run();

    const updated = await env.DB.prepare(
      'SELECT * FROM notification_preferences WHERE user_id = ?'
    ).bind(userId).first();

    return new Response(JSON.stringify({
      success: true,
      preferences: updated
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update notification preferences',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /templates
 * Get message templates (user's + system templates)
 */
export async function handleGetTemplates(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type');

    let query = `
      SELECT * FROM message_templates
      WHERE (publisher_id = ? OR is_system_template = 1)
    `;
    const params = [userId];

    if (type) {
      query += ' AND template_type = ?';
      params.push(type);
    }

    query += ' ORDER BY is_system_template DESC, created_at DESC';

    const templates = await env.DB.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({
      success: true,
      templates: templates.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting templates:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get templates',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /templates
 * Create new message template
 */
export async function handleCreateTemplate(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();

    if (!body.templateName || !body.templateType || !body.subjectLine || !body.bodyText) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: templateName, templateType, subjectLine, bodyText'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const templateId = crypto.randomUUID();
    const mergeFields = JSON.stringify([
      '{{author_name}}',
      '{{manuscript_title}}',
      '{{submission_date}}',
      '{{publisher_name}}',
      '{{current_date}}'
    ]);

    await env.DB.prepare(`
      INSERT INTO message_templates (
        id, publisher_id, template_name, template_type, is_system_template,
        subject_line, body_text, merge_fields, times_used,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?)
    `).bind(
      templateId,
      userId,
      body.templateName,
      body.templateType,
      body.subjectLine,
      body.bodyText,
      mergeFields,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();

    const template = await env.DB.prepare(
      'SELECT * FROM message_templates WHERE id = ?'
    ).bind(templateId).first();

    return new Response(JSON.stringify({
      success: true,
      template
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating template:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create template',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /templates/:id
 * Update message template
 */
export async function handleUpdateTemplate(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { templateId } = request.params;
    const body = await request.json();

    // Verify ownership
    const template = await env.DB.prepare(
      'SELECT * FROM message_templates WHERE id = ? AND publisher_id = ?'
    ).bind(templateId, userId).first();

    if (!template) {
      return new Response(JSON.stringify({ error: 'Template not found or not authorized' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update template
    await env.DB.prepare(`
      UPDATE message_templates SET
        template_name = ?,
        template_type = ?,
        subject_line = ?,
        body_text = ?
      WHERE id = ?
    `).bind(
      body.templateName || template.template_name,
      body.templateType || template.template_type,
      body.subjectLine || template.subject_line,
      body.bodyText || template.body_text,
      templateId
    ).run();

    const updated = await env.DB.prepare(
      'SELECT * FROM message_templates WHERE id = ?'
    ).bind(templateId).first();

    return new Response(JSON.stringify({
      success: true,
      template: updated
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating template:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update template',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /templates/:id
 * Delete message template
 */
export async function handleDeleteTemplate(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { templateId } = request.params;

    // Verify ownership (can't delete system templates)
    const template = await env.DB.prepare(
      'SELECT * FROM message_templates WHERE id = ? AND publisher_id = ? AND is_system_template = 0'
    ).bind(templateId, userId).first();

    if (!template) {
      return new Response(JSON.stringify({ error: 'Template not found or cannot be deleted' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await env.DB.prepare('DELETE FROM message_templates WHERE id = ?').bind(templateId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Template deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting template:', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete template',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /submissions/:id/messages
 * Get all messages for a submission
 */
export async function handleGetSubmissionMessages(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { submissionId } = request.params;

    // Verify access to submission
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ?'
    ).bind(submissionId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get messages (user must be sender or recipient)
    const messages = await env.DB.prepare(`
      SELECT
        sm.*,
        sender.email as sender_email,
        sender.full_name as sender_name,
        recipient.email as recipient_email,
        recipient.full_name as recipient_name
      FROM submission_messages sm
      LEFT JOIN users sender ON sm.sender_user_id = sender.id
      LEFT JOIN users recipient ON sm.recipient_user_id = recipient.id
      WHERE sm.submission_id = ?
        AND (sm.sender_user_id = ? OR sm.recipient_user_id = ?)
      ORDER BY sm.sent_at DESC
    `).bind(submissionId, userId, userId).all();

    // Mark messages as read if user is recipient
    const unreadIds = messages.results
      .filter(m => m.recipient_user_id === userId && !m.is_read)
      .map(m => m.id);

    if (unreadIds.length > 0) {
      const placeholders = unreadIds.map(() => '?').join(',');
      await env.DB.prepare(
        `UPDATE submission_messages SET is_read = 1, read_at = ? WHERE id IN (${placeholders})`
      ).bind(Math.floor(Date.now() / 1000), ...unreadIds).run();
    }

    return new Response(JSON.stringify({
      success: true,
      messages: messages.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting submission messages:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get submission messages',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /submissions/:id/messages
 * Send a message on a submission
 */
export async function handleSendSubmissionMessage(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { submissionId } = request.params;
    const body = await request.json();

    if (!body.recipientUserId || !body.body) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: recipientUserId, body'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify submission exists
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ?'
    ).bind(submissionId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const messageId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO submission_messages (
        id, submission_id, sender_user_id, recipient_user_id,
        message_type, subject, body, attachments, is_read,
        parent_message_id, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(
      messageId,
      submissionId,
      userId,
      body.recipientUserId,
      body.messageType || 'general',
      body.subject || null,
      body.body,
      body.attachments ? JSON.stringify(body.attachments) : null,
      body.parentMessageId || null,
      Math.floor(Date.now() / 1000)
    ).run();

    // Queue notification email
    await queueNotification(env, {
      userId: body.recipientUserId,
      type: 'message',
      submissionId,
      messageId
    });

    const message = await env.DB.prepare(`
      SELECT
        sm.*,
        sender.email as sender_email,
        sender.full_name as sender_name,
        recipient.email as recipient_email,
        recipient.full_name as recipient_name
      FROM submission_messages sm
      LEFT JOIN users sender ON sm.sender_user_id = sender.id
      LEFT JOIN users recipient ON sm.recipient_user_id = recipient.id
      WHERE sm.id = ?
    `).bind(messageId).first();

    return new Response(JSON.stringify({
      success: true,
      message
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return new Response(JSON.stringify({
      error: 'Failed to send message',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /submissions/:id/revision-request
 * Create a revision request (R&R)
 */
export async function handleCreateRevisionRequest(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { submissionId } = request.params;
    const body = await request.json();

    if (!body.requestedChanges) {
      return new Response(JSON.stringify({
        error: 'Missing required field: requestedChanges'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify submission exists
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ?'
    ).bind(submissionId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const requestId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO revision_requests (
        id, submission_id, requested_by_user_id, requested_changes,
        revision_type, deadline, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).bind(
      requestId,
      submissionId,
      userId,
      body.requestedChanges,
      body.revisionType || null,
      body.deadline ? new Date(body.deadline).getTime() / 1000 : null,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();

    // Queue notification email to author
    await queueNotification(env, {
      userId: manuscript.user_id,
      type: 'revision_request',
      submissionId,
      revisionRequestId: requestId
    });

    // Create a system message
    const messageId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO submission_messages (
        id, submission_id, sender_user_id, recipient_user_id,
        message_type, subject, body, is_read, sent_at
      ) VALUES (?, ?, ?, ?, 'revision_request', ?, ?, 0, ?)
    `).bind(
      messageId,
      submissionId,
      userId,
      manuscript.user_id,
      'Revision Request',
      body.requestedChanges,
      Math.floor(Date.now() / 1000)
    ).run();

    const revisionRequest = await env.DB.prepare(
      'SELECT * FROM revision_requests WHERE id = ?'
    ).bind(requestId).first();

    return new Response(JSON.stringify({
      success: true,
      revisionRequest
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating revision request:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create revision request',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /revision-requests/:id
 * Get revision request details
 */
export async function handleGetRevisionRequest(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { requestId } = request.params;

    const revisionRequest = await env.DB.prepare(`
      SELECT
        rr.*,
        m.title as manuscript_title,
        m.user_id as author_id,
        requester.email as requester_email,
        requester.full_name as requester_name
      FROM revision_requests rr
      LEFT JOIN manuscripts m ON rr.submission_id = m.id
      LEFT JOIN users requester ON rr.requested_by_user_id = requester.id
      WHERE rr.id = ?
    `).bind(requestId).first();

    if (!revisionRequest) {
      return new Response(JSON.stringify({ error: 'Revision request not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify access (must be requester or author)
    if (revisionRequest.requested_by_user_id !== userId && revisionRequest.author_id !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      revisionRequest
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting revision request:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get revision request',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /revision-requests/:id/respond
 * Author responds to revision request
 */
export async function handleRespondToRevisionRequest(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { requestId } = request.params;
    const body = await request.json();

    // Get revision request
    const rr = await env.DB.prepare(`
      SELECT rr.*, m.user_id as author_id
      FROM revision_requests rr
      LEFT JOIN manuscripts m ON rr.submission_id = m.id
      WHERE rr.id = ?
    `).bind(requestId).first();

    if (!rr) {
      return new Response(JSON.stringify({ error: 'Revision request not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify author
    if (rr.author_id !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update revision request
    await env.DB.prepare(`
      UPDATE revision_requests SET
        author_response = ?,
        author_response_at = ?,
        status = ?
      WHERE id = ?
    `).bind(
      body.response,
      Math.floor(Date.now() / 1000),
      body.accept ? 'accepted' : 'declined',
      requestId
    ).run();

    const updated = await env.DB.prepare(
      'SELECT * FROM revision_requests WHERE id = ?'
    ).bind(requestId).first();

    return new Response(JSON.stringify({
      success: true,
      revisionRequest: updated
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error responding to revision request:', error);
    return new Response(JSON.stringify({
      error: 'Failed to respond to revision request',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Helper: Queue notification email
 */
async function queueNotification(env, { userId, type, submissionId, messageId, revisionRequestId }) {
  try {
    // Check user preferences
    const prefs = await env.DB.prepare(
      'SELECT * FROM notification_preferences WHERE user_id = ?'
    ).bind(userId).first();

    if (!prefs) return; // No preferences, skip

    // Check if notification type is enabled
    const typeMap = {
      'message': prefs.email_on_message,
      'revision_request': prefs.email_on_revision_request,
      'revision_submitted': prefs.email_on_revision_submitted,
      'status_change': prefs.email_on_status_change,
      'decision': prefs.email_on_decision,
      'submission_received': prefs.email_on_submission_received
    };

    if (!typeMap[type]) return; // Notification disabled

    const notificationId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO notification_queue (
        id, user_id, notification_type, subject, body,
        submission_id, message_id, revision_request_id,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).bind(
      notificationId,
      userId,
      type,
      `Manuscript Platform: New ${type.replace(/_/g, ' ')}`,
      `You have a new ${type.replace(/_/g, ' ')} notification.`,
      submissionId || null,
      messageId || null,
      revisionRequestId || null,
      Math.floor(Date.now() / 1000)
    ).run();

  } catch (error) {
    console.error('Error queuing notification:', error);
  }
}
