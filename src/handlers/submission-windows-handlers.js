// Submission Windows & Deadline Tracking Handlers (Issue #53)
// Publisher submission windows, deadlines, alerts

import { getUserFromRequest } from '../utils/auth-utils.js';
import crypto from 'crypto';

// ========================================================================
// PUBLISHER MANAGEMENT
// ========================================================================

/**
 * GET /publishers
 * List all publishers
 */
export async function handleGetPublishers(request, env) {
  try {
    const url = new URL(request.url);
    const isActive = url.searchParams.get('is_active');
    const publisherType = url.searchParams.get('type');

    let query = 'SELECT * FROM publishers WHERE 1=1';
    const bindings = [];

    if (isActive !== null) {
      query += ' AND is_active = ?';
      bindings.push(isActive === 'true' ? 1 : 0);
    }

    if (publisherType) {
      query += ' AND publisher_type = ?';
      bindings.push(publisherType);
    }

    query += ' ORDER BY name ASC';

    const publishers = await env.DB.prepare(query).bind(...bindings).all();

    return new Response(JSON.stringify({
      success: true,
      publishers: publishers.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting publishers:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get publishers',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /publishers
 * Create publisher (admin only)
 */
export async function handleCreatePublisher(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();

    if (!body.name || !body.publisherType) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: name, publisherType'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const publisherId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO publishers (
        id, name, publisher_type, website, submission_guidelines_url,
        email, avg_response_time_days, acceptance_rate,
        genres_accepted, accepts_simultaneous, requires_exclusive,
        notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).bind(
      publisherId,
      body.name,
      body.publisherType,
      body.website || null,
      body.submissionGuidelinesUrl || null,
      body.email || null,
      body.avgResponseTimeDays || null,
      body.acceptanceRate || null,
      body.genresAccepted ? JSON.stringify(body.genresAccepted) : null,
      body.acceptsSimultaneous !== undefined ? body.acceptsSimultaneous : 1,
      body.requiresExclusive !== undefined ? body.requiresExclusive : 0,
      body.notes || null,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();

    const publisher = await env.DB.prepare(
      'SELECT * FROM publishers WHERE id = ?'
    ).bind(publisherId).first();

    return new Response(JSON.stringify({
      success: true,
      publisher
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating publisher:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create publisher',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ========================================================================
// SUBMISSION WINDOW MANAGEMENT
// ========================================================================

/**
 * GET /publishers/:id/windows
 * Get publisher's submission windows
 */
export async function handleGetPublisherWindows(request, env) {
  try {
    const { publisherId } = request.params;

    const windows = await env.DB.prepare(`
      SELECT * FROM publisher_submission_windows
      WHERE publisher_id = ?
      ORDER BY opens_at DESC, created_at DESC
    `).bind(publisherId).all();

    return new Response(JSON.stringify({
      success: true,
      windows: windows.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting publisher windows:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get publisher windows',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /publishers/:id/windows/current
 * Get currently open window
 */
export async function handleGetCurrentWindow(request, env) {
  try {
    const { publisherId } = request.params;

    const window = await env.DB.prepare(`
      SELECT * FROM publisher_submission_windows
      WHERE publisher_id = ?
        AND is_open = 1
        AND (closes_at IS NULL OR closes_at > ?)
        AND (capacity_limit IS NULL OR current_submissions < capacity_limit)
      ORDER BY opens_at DESC
      LIMIT 1
    `).bind(publisherId, Math.floor(Date.now() / 1000)).first();

    if (!window) {
      return new Response(JSON.stringify({
        success: true,
        window: null,
        message: 'No open windows'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      window
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting current window:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get current window',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /publishers/:id/windows
 * Create new window (admin)
 */
export async function handleCreateWindow(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { publisherId } = request.params;
    const body = await request.json();

    if (!body.windowType) {
      return new Response(JSON.stringify({
        error: 'Missing required field: windowType'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const windowId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO publisher_submission_windows (
        id, publisher_id, window_type, is_open, opens_at, closes_at,
        capacity_limit, current_submissions, genres_accepted,
        window_name, description, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `).bind(
      windowId,
      publisherId,
      body.windowType,
      body.isOpen !== undefined ? body.isOpen : 1,
      body.opensAt || null,
      body.closesAt || null,
      body.capacityLimit || null,
      body.genresAccepted ? JSON.stringify(body.genresAccepted) : null,
      body.windowName || null,
      body.description || null,
      body.notes || null,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();

    const window = await env.DB.prepare(
      'SELECT * FROM publisher_submission_windows WHERE id = ?'
    ).bind(windowId).first();

    return new Response(JSON.stringify({
      success: true,
      window
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating window:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create window',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /publishers/:publisherId/windows/:windowId
 * Update window status (admin)
 */
export async function handleUpdateWindow(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { publisherId, windowId } = request.params;
    const body = await request.json();

    // Verify window exists
    const window = await env.DB.prepare(
      'SELECT * FROM publisher_submission_windows WHERE id = ? AND publisher_id = ?'
    ).bind(windowId, publisherId).first();

    if (!window) {
      return new Response(JSON.stringify({
        error: 'Window not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build update query
    const updates = [];
    const bindings = [];

    if (body.isOpen !== undefined) {
      updates.push('is_open = ?');
      bindings.push(body.isOpen ? 1 : 0);
    }

    if (body.opensAt !== undefined) {
      updates.push('opens_at = ?');
      bindings.push(body.opensAt);
    }

    if (body.closesAt !== undefined) {
      updates.push('closes_at = ?');
      bindings.push(body.closesAt);
    }

    if (body.capacityLimit !== undefined) {
      updates.push('capacity_limit = ?');
      bindings.push(body.capacityLimit);
    }

    if (body.currentSubmissions !== undefined) {
      updates.push('current_submissions = ?');
      bindings.push(body.currentSubmissions);
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
      UPDATE publisher_submission_windows
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...bindings, windowId).run();

    const updated = await env.DB.prepare(
      'SELECT * FROM publisher_submission_windows WHERE id = ?'
    ).bind(windowId).first();

    return new Response(JSON.stringify({
      success: true,
      window: updated
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating window:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update window',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /publishers/open-now
 * List all publishers currently accepting submissions
 */
export async function handleGetOpenPublishers(request, env) {
  try {
    const url = new URL(request.url);
    const genre = url.searchParams.get('genre');

    const windows = await env.DB.prepare(
      'SELECT * FROM open_submission_windows ORDER BY days_until_close ASC'
    ).all();

    // Filter by genre if specified
    let results = windows.results;
    if (genre) {
      results = results.filter(window => {
        if (!window.genres_accepted) return true; // NULL means all genres
        const genres = JSON.parse(window.genres_accepted);
        return genres.includes(genre);
      });
    }

    return new Response(JSON.stringify({
      success: true,
      windows: results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting open publishers:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get open publishers',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /publishers/opening-soon
 * List publishers opening within 30 days
 */
export async function handleGetOpeningSoonPublishers(request, env) {
  try {
    const windows = await env.DB.prepare(
      'SELECT * FROM windows_opening_soon'
    ).all();

    return new Response(JSON.stringify({
      success: true,
      windows: windows.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting opening soon publishers:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get opening soon publishers',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ========================================================================
// DEADLINE MANAGEMENT
// ========================================================================

/**
 * POST /submissions/:id/deadlines
 * Add deadline
 */
export async function handleAddDeadline(request, env) {
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

    if (!body.deadlineType || !body.deadlineDate) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: deadlineType, deadlineDate'
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

    const deadlineId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO submission_deadlines (
        id, submission_id, deadline_type, deadline_date,
        reminder_days_before, reminder_sent, deadline_name,
        description, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `).bind(
      deadlineId,
      submissionId,
      body.deadlineType,
      body.deadlineDate,
      body.reminderDaysBefore || 7,
      body.deadlineName || null,
      body.description || null,
      body.notes || null,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();

    const deadline = await env.DB.prepare(
      'SELECT * FROM submission_deadlines WHERE id = ?'
    ).bind(deadlineId).first();

    return new Response(JSON.stringify({
      success: true,
      deadline
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error adding deadline:', error);
    return new Response(JSON.stringify({
      error: 'Failed to add deadline',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /submissions/:id/deadlines
 * Get all deadlines for submission
 */
export async function handleGetDeadlines(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { submissionId } = request.params;

    const deadlines = await env.DB.prepare(`
      SELECT * FROM submission_deadlines
      WHERE submission_id = ?
      ORDER BY deadline_date ASC
    `).bind(submissionId).all();

    return new Response(JSON.stringify({
      success: true,
      deadlines: deadlines.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting deadlines:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get deadlines',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /deadlines/upcoming
 * Get user's upcoming deadlines
 */
export async function handleGetUpcomingDeadlines(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');

    const deadlines = await env.DB.prepare(`
      SELECT
        sd.*,
        m.title as manuscript_title,
        m.author,
        m.genre,
        CAST((sd.deadline_date - unixepoch()) / 86400.0 AS INTEGER) as days_until_deadline
      FROM submission_deadlines sd
      JOIN manuscripts m ON sd.submission_id = m.id
      WHERE m.user_id = ?
        AND sd.deadline_date >= unixepoch()
        AND sd.deadline_date <= (unixepoch() + ?)
      ORDER BY sd.deadline_date ASC
    `).bind(userId, days * 86400).all();

    return new Response(JSON.stringify({
      success: true,
      deadlines: deadlines.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting upcoming deadlines:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get upcoming deadlines',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ========================================================================
// WINDOW ALERTS
// ========================================================================

/**
 * POST /publishers/:id/alerts
 * Subscribe to window alerts for publisher
 */
export async function handleSubscribeToAlerts(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { publisherId } = request.params;
    const body = await request.json();

    const alertId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT OR REPLACE INTO window_alerts (
        id, user_id, publisher_id,
        alert_on_open, alert_on_closing_soon, alert_on_capacity_warning,
        alerts_sent_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(
      alertId,
      userId,
      publisherId,
      body.alertOnOpen !== undefined ? body.alertOnOpen : 1,
      body.alertOnClosingSoon !== undefined ? body.alertOnClosingSoon : 1,
      body.alertOnCapacityWarning !== undefined ? body.alertOnCapacityWarning : 1,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();

    const alert = await env.DB.prepare(
      'SELECT * FROM window_alerts WHERE user_id = ? AND publisher_id = ?'
    ).bind(userId, publisherId).first();

    return new Response(JSON.stringify({
      success: true,
      alert
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error subscribing to alerts:', error);
    return new Response(JSON.stringify({
      error: 'Failed to subscribe to alerts',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /alerts
 * Get user's window alert subscriptions
 */
export async function handleGetAlerts(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const alerts = await env.DB.prepare(`
      SELECT
        wa.*,
        p.name as publisher_name,
        p.publisher_type
      FROM window_alerts wa
      JOIN publishers p ON wa.publisher_id = p.id
      WHERE wa.user_id = ?
      ORDER BY wa.created_at DESC
    `).bind(userId).all();

    return new Response(JSON.stringify({
      success: true,
      alerts: alerts.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting alerts:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get alerts',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
