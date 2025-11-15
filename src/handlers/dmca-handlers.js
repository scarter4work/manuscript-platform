/**
import crypto from 'crypto';

 * DMCA Takedown Request Handler
 *
 * Public endpoint for copyright holders to submit DMCA takedown requests
 */

/**
 * Handle DMCA takedown request submission (Phase E)
 *
 * POST /dmca/submit
 * Accepts DMCA takedown requests from copyright holders
 */
export async function handleDMCASubmission(request, env, corsHeaders) {
  try {
    const body = await request.json();

    // Extract and validate required fields
    const {
      requesterName,
      requesterEmail,
      requesterCompany,
      manuscriptId,
      claimDetails,
      originalWorkUrl,
      goodFaithAttestation,
      accuracyAttestation,
      digitalSignature
    } = body;

    // Validate required fields
    if (!requesterName || !requesterEmail || !manuscriptId || !claimDetails ||
        !goodFaithAttestation || !accuracyAttestation || !digitalSignature) {
      return new Response(JSON.stringify({
        error: 'Missing required fields. Please complete all required fields including attestations and digital signature.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requesterEmail)) {
      return new Response(JSON.stringify({
        error: 'Invalid email address format'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate attestations are true
    if (goodFaithAttestation !== true || accuracyAttestation !== true) {
      return new Response(JSON.stringify({
        error: 'Both attestations must be confirmed to submit a DMCA request'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[DMCA] Processing takedown request for manuscript:', manuscriptId);

    // Look up manuscript in database
    let actualManuscriptId = manuscriptId;

    // If it's a URL, try to extract the manuscript ID from it
    if (manuscriptId.includes('http') || manuscriptId.includes('/')) {
      const urlMatch = manuscriptId.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
      if (urlMatch) {
        actualManuscriptId = urlMatch[0];
      }
    }

    // Verify manuscript exists in database
    const manuscriptResult = await env.DB.prepare(
      'SELECT id, user_id, title FROM manuscripts WHERE id = ?'
    ).bind(actualManuscriptId).first();

    if (!manuscriptResult) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found. Please verify the manuscript ID or URL.',
        providedId: manuscriptId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate unique DMCA request ID
    const dmcaRequestId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);

    // Insert DMCA request into database
    await env.DB.prepare(`
      INSERT INTO dmca_requests (
        id, manuscript_id, requester_name, requester_email, requester_company,
        claim_details, original_work_url, good_faith_attestation, accuracy_attestation,
        digital_signature, submitted_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      dmcaRequestId,
      actualManuscriptId,
      requesterName,
      requesterEmail,
      requesterCompany || null,
      claimDetails,
      originalWorkUrl || null,
      goodFaithAttestation ? 1 : 0,
      accuracyAttestation ? 1 : 0,
      digitalSignature,
      timestamp
    ).run();

    // Flag the manuscript for review
    await env.DB.prepare(`
      UPDATE manuscripts
      SET flagged_for_review = 1,
          updated_at = ?
      WHERE id = ?
    `).bind(timestamp, actualManuscriptId).run();

    // Log DMCA submission to audit log
    await env.DB.prepare(`
      INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, timestamp, metadata)
      VALUES (?, ?, 'dmca_request', 'manuscript', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      manuscriptResult.user_id, // Log against manuscript owner's user ID
      actualManuscriptId,
      timestamp,
      JSON.stringify({
        dmcaRequestId,
        requesterEmail,
        requesterName,
        manuscriptTitle: manuscriptResult.title
      })
    ).run();

    console.log('[DMCA] Request submitted successfully:', dmcaRequestId);
    console.log('[DMCA] Manuscript flagged for review:', actualManuscriptId);

    // Send email notifications (don't block the response)
    try {
      const { sendDMCARequestNotification, sendDMCAOwnerNotification } = await import('./email-service.js');

      // Get manuscript owner email
      const owner = await env.DB.prepare('SELECT email FROM users WHERE id = ?')
        .bind(manuscriptResult.user_id).first();

      // Send notification to admin
      sendDMCARequestNotification({
        requestId: dmcaRequestId,
        manuscriptId: actualManuscriptId,
        manuscriptTitle: manuscriptResult.title,
        requesterName,
        requesterEmail,
        claimDetails
      }, env).catch(err => console.error('[Email] Failed to send admin notification:', err));

      // Send notification to manuscript owner
      if (owner && owner.email) {
        sendDMCAOwnerNotification({
          ownerEmail: owner.email,
          manuscriptTitle: manuscriptResult.title,
          manuscriptId: actualManuscriptId,
          requestId: dmcaRequestId,
          action: 'flagged'
        }, env).catch(err => console.error('[Email] Failed to send owner notification:', err));
      }
    } catch (emailError) {
      console.error('[Email] Email service error:', emailError);
      // Don't fail the request if email fails
    }

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: 'DMCA takedown request submitted successfully',
      dmcaRequestId,
      manuscriptId: actualManuscriptId,
      status: 'pending',
      reviewInfo: 'Your request will be reviewed within 24 hours. You will receive an email confirmation shortly.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[DMCA] Submission error:', error);
    console.error('[DMCA] Error stack:', error.stack);
    return new Response(JSON.stringify({
      error: 'Failed to submit DMCA request',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
