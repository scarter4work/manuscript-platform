/**
 * Phase E: DMCA Admin Handlers
 * API endpoints for reviewing and managing DMCA takedown requests
 */

/**
 * Get all DMCA requests with filtering
 * GET /admin/dmca/requests?status=pending
 */
export async function getDMCARequests(request, env, corsHeaders) {
  try {
    // Import auth utilities
    const { getUserFromRequest } = await import('../utils/auth-utils.js');

    // Get authenticated user
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is admin
    const user = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first();
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status'); // pending, reviewing, resolved, rejected

    // Build query
    let query = `
      SELECT
        d.*,
        m.title as manuscript_title,
        u.email as manuscript_owner_email
      FROM dmca_requests d
      LEFT JOIN manuscripts m ON d.manuscript_id = m.id
      LEFT JOIN users u ON m.user_id = u.id
    `;

    const params = [];
    if (statusFilter && statusFilter !== 'all') {
      query += ' WHERE d.status = ?';
      params.push(statusFilter);
    }

    query += ' ORDER BY d.submitted_at DESC LIMIT 100';

    // Execute query
    const stmt = params.length > 0
      ? env.DB.prepare(query).bind(...params)
      : env.DB.prepare(query);

    const result = await stmt.all();

    return new Response(JSON.stringify({
      success: true,
      requests: result.results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[DMCA Admin] Get requests error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch DMCA requests',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get DMCA request statistics
 * GET /admin/dmca/stats
 */
export async function getDMCAStats(request, env, corsHeaders) {
  try {
    // Import auth utilities
    const { getUserFromRequest } = await import('../utils/auth-utils.js');

    // Get authenticated user
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is admin
    const user = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first();
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get counts by status
    const stats = await env.DB.prepare(`
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as reviewing,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        COUNT(*) as total
      FROM dmca_requests
    `).first();

    return new Response(JSON.stringify({
      success: true,
      stats: {
        pending: stats.pending || 0,
        reviewing: stats.reviewing || 0,
        resolved: stats.resolved || 0,
        rejected: stats.rejected || 0,
        total: stats.total || 0
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[DMCA Admin] Get stats error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch statistics',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Update DMCA request status to "reviewing"
 * PATCH /admin/dmca/status
 */
export async function updateDMCAStatus(request, env, corsHeaders) {
  try {
    // Import auth utilities
    const { getUserFromRequest } = await import('../utils/auth-utils.js');

    // Get authenticated user
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is admin
    const user = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first();
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body = await request.json();
    const { requestId, status } = body;

    if (!requestId || !status) {
      return new Response(JSON.stringify({ error: 'requestId and status are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate status
    if (!['pending', 'reviewing', 'resolved', 'rejected'].includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status value' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get DMCA request details for email notification
    const dmcaRequest = await env.DB.prepare(`
      SELECT d.*, m.title as manuscript_title
      FROM dmca_requests d
      LEFT JOIN manuscripts m ON d.manuscript_id = m.id
      WHERE d.id = ?
    `).bind(requestId).first();

    // Update status
    const timestamp = Math.floor(Date.now() / 1000);
    await env.DB.prepare(`
      UPDATE dmca_requests
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).bind(status, timestamp, requestId).run();

    console.log(`[DMCA Admin] Updated request ${requestId} to status: ${status}`);

    // Send email notification to requester about status change (non-blocking)
    try {
      const { sendDMCAStatusUpdate } = await import('./email-service.js');

      if (dmcaRequest) {
        sendDMCAStatusUpdate({
          requestId,
          requesterEmail: dmcaRequest.requester_email,
          requesterName: dmcaRequest.requester_name,
          status,
          manuscriptTitle: dmcaRequest.manuscript_title
        }, env).catch(err => console.error('[Email] Failed to send status update:', err));
      }
    } catch (emailError) {
      console.error('[Email] Email service error:', emailError);
      // Don't fail the request if email fails
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Status updated successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[DMCA Admin] Update status error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update status',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Resolve DMCA request (approve or reject)
 * POST /admin/dmca/resolve
 */
export async function resolveDMCARequest(request, env, corsHeaders) {
  try {
    // Import auth utilities
    const { getUserFromRequest } = await import('../utils/auth-utils.js');

    // Get authenticated user
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is admin
    const user = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first();
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body = await request.json();
    const { requestId, action, resolutionNotes } = body;

    if (!requestId || !action || !resolutionNotes) {
      return new Response(JSON.stringify({ error: 'requestId, action, and resolutionNotes are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ error: 'action must be "approve" or "reject"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get DMCA request details with manuscript info and owner email
    const dmcaRequest = await env.DB.prepare(`
      SELECT d.*, m.title as manuscript_title, m.user_id as manuscript_owner_id, u.email as owner_email
      FROM dmca_requests d
      LEFT JOIN manuscripts m ON d.manuscript_id = m.id
      LEFT JOIN users u ON m.user_id = u.id
      WHERE d.id = ?
    `).bind(requestId).first();

    if (!dmcaRequest) {
      return new Response(JSON.stringify({ error: 'DMCA request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const newStatus = action === 'approve' ? 'resolved' : 'rejected';

    // Update DMCA request
    await env.DB.prepare(`
      UPDATE dmca_requests
      SET
        status = ?,
        resolution_notes = ?,
        resolved_at = ?,
        resolved_by = ?
      WHERE id = ?
    `).bind(
      newStatus,
      resolutionNotes,
      timestamp,
      userId,
      requestId
    ).run();

    // If approved, remove the manuscript's flagged status OR delete manuscript
    if (action === 'approve') {
      // Option 1: Just unflag (keep manuscript but marked as resolved)
      await env.DB.prepare(`
        UPDATE manuscripts
        SET flagged_for_review = 0, updated_at = ?
        WHERE id = ?
      `).bind(timestamp, dmcaRequest.manuscript_id).run();

      // Option 2: Delete manuscript entirely (commented out - choose based on policy)
      // await env.DB.prepare(`
      //   DELETE FROM manuscripts WHERE id = ?
      // `).bind(dmcaRequest.manuscript_id).run();
    } else {
      // If rejected, unflag the manuscript
      await env.DB.prepare(`
        UPDATE manuscripts
        SET flagged_for_review = 0, updated_at = ?
        WHERE id = ?
      `).bind(timestamp, dmcaRequest.manuscript_id).run();
    }

    // Log audit event
    await env.DB.prepare(`
      INSERT INTO audit_log (id, user_id, event_type, resource_type, resource_id, created_at, event_details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      `dmca_${action}`,
      'dmca_request',
      requestId,
      timestamp,
      JSON.stringify({
        manuscriptId: dmcaRequest.manuscript_id,
        action,
        resolutionNotes: resolutionNotes.substring(0, 100) // Truncate for logging
      })
    ).run();

    console.log(`[DMCA Admin] ${action === 'approve' ? 'Approved' : 'Rejected'} DMCA request ${requestId}`);

    // Send email notifications (non-blocking)
    try {
      const { sendDMCAStatusUpdate, sendDMCAOwnerNotification } = await import('./email-service.js');

      // Send resolution email to copyright holder
      sendDMCAStatusUpdate({
        requestId,
        requesterEmail: dmcaRequest.requester_email,
        requesterName: dmcaRequest.requester_name,
        status: newStatus,
        manuscriptTitle: dmcaRequest.manuscript_title
      }, env).catch(err => console.error('[Email] Failed to send requester resolution email:', err));

      // Send notification to manuscript owner
      if (dmcaRequest.owner_email) {
        const ownerAction = action === 'approve' ? 'removed' : 'cleared';
        sendDMCAOwnerNotification({
          ownerEmail: dmcaRequest.owner_email,
          manuscriptTitle: dmcaRequest.manuscript_title,
          manuscriptId: dmcaRequest.manuscript_id,
          requestId,
          action: ownerAction
        }, env).catch(err => console.error('[Email] Failed to send owner notification:', err));
      }
    } catch (emailError) {
      console.error('[Email] Email service error:', emailError);
      // Don't fail the request if email fails
    }

    return new Response(JSON.stringify({
      success: true,
      message: `DMCA request ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      status: newStatus
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[DMCA Admin] Resolve error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to resolve DMCA request',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
