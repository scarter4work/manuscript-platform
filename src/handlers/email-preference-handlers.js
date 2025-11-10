// ============================================================================
// EMAIL PREFERENCE MANAGEMENT HANDLERS
// Manages user notification preferences and unsubscribe functionality
// Related: MAN-17
// ============================================================================

import { jwtVerify, SignJWT } from 'jose';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get or create email preferences for a user
 */
async function getOrCreatePreferences(userId, env) {
  let prefs = await env.DB.prepare(
    'SELECT * FROM email_preferences WHERE user_id = ?'
  ).bind(userId).first();

  if (!prefs) {
    // Create default preferences
    const id = crypto.randomUUID();
    const unsubscribeToken = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      INSERT INTO email_preferences (
        id, user_id, unsubscribe_token, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(id, userId, unsubscribeToken, now, now).run();

    prefs = await env.DB.prepare(
      'SELECT * FROM email_preferences WHERE user_id = ?'
    ).bind(userId).first();
  }

  return prefs;
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * GET /user/email-preferences
 * Get current user's email notification preferences
 */
export async function getEmailPreferences(request, env) {
  try {
    // Verify authentication
    const authHeader = request?.headers?.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    let userId;

    try {
      const secret = new TextEncoder().encode(env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      userId = payload.userId;
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get or create preferences
    const prefs = await getOrCreatePreferences(userId, env);

    // Format response
    const response = {
      analysis_complete: prefs.analysis_complete === 1,
      asset_generation_complete: prefs.asset_generation_complete === 1,
      payment_confirmation: prefs.payment_confirmation === 1,
      payment_failed: prefs.payment_failed === 1,
      usage_warning: prefs.usage_warning === 1,
      dmca_notification: prefs.dmca_notification === 1,
      team_invitation: prefs.team_invitation === 1,
      team_activity: prefs.team_activity === 1,
      weekly_digest: prefs.weekly_digest === 1,
      admin_alerts: prefs.admin_alerts === 1,
      unsubscribe_token: prefs.unsubscribe_token
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Email Prefs] Error getting preferences:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PUT /user/email-preferences
 * Update current user's email notification preferences
 */
export async function updateEmailPreferences(request, env) {
  try {
    // Verify authentication
    const authHeader = request?.headers?.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    let userId;

    try {
      const secret = new TextEncoder().encode(env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      userId = payload.userId;
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body = await request.json();

    // Validate preferences (all should be boolean)
    const validPrefs = [
      'analysis_complete',
      'asset_generation_complete',
      'payment_confirmation',
      'payment_failed',
      'usage_warning',
      'dmca_notification',
      'team_invitation',
      'team_activity',
      'weekly_digest',
      'admin_alerts'
    ];

    // Build update query
    const updates = [];
    const values = [];

    for (const pref of validPrefs) {
      if (pref in body) {
        if (typeof body[pref] !== 'boolean') {
          return new Response(JSON.stringify({ error: `${pref} must be a boolean` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        updates.push(`${pref} = ?`);
        values.push(body[pref] ? 1 : 0);
      }
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No preferences to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Ensure preferences exist first
    await getOrCreatePreferences(userId, env);

    // Update preferences
    const now = Math.floor(Date.now() / 1000);
    updates.push('updated_at = ?');
    values.push(now);
    values.push(userId);

    await env.DB.prepare(`
      UPDATE email_preferences
      SET ${updates.join(', ')}
      WHERE user_id = ?
    `).bind(...values).run();

    // Get updated preferences
    const prefs = await env.DB.prepare(
      'SELECT * FROM email_preferences WHERE user_id = ?'
    ).bind(userId).first();

    const response = {
      analysis_complete: prefs.analysis_complete === 1,
      asset_generation_complete: prefs.asset_generation_complete === 1,
      payment_confirmation: prefs.payment_confirmation === 1,
      payment_failed: prefs.payment_failed === 1,
      usage_warning: prefs.usage_warning === 1,
      dmca_notification: prefs.dmca_notification === 1,
      team_invitation: prefs.team_invitation === 1,
      team_activity: prefs.team_activity === 1,
      weekly_digest: prefs.weekly_digest === 1,
      admin_alerts: prefs.admin_alerts === 1
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Email Prefs] Error updating preferences:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /unsubscribe/:token
 * One-click unsubscribe from all non-critical emails
 */
export async function unsubscribeByToken(request, env) {
  try {
    const url = new URL(request.url);
    const token = url.pathname.split('/').pop();

    if (!token) {
      return new Response('Invalid unsubscribe link', {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Find user by unsubscribe token
    const prefs = await env.DB.prepare(
      'SELECT user_id FROM email_preferences WHERE unsubscribe_token = ?'
    ).bind(token).first();

    if (!prefs) {
      return new Response('Invalid or expired unsubscribe link', {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Disable all non-critical emails
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(`
      UPDATE email_preferences
      SET analysis_complete = 0,
          asset_generation_complete = 0,
          payment_confirmation = 0,
          usage_warning = 0,
          team_invitation = 0,
          team_activity = 0,
          weekly_digest = 0,
          admin_alerts = 0,
          updated_at = ?
      WHERE unsubscribe_token = ?
    `).bind(now, token).run();

    // Return success page
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed - Manuscript Hub</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .icon {
      font-size: 64px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 32px;
      color: #1a202c;
      margin-bottom: 16px;
    }
    p {
      font-size: 18px;
      color: #4a5568;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .note {
      font-size: 14px;
      color: #718096;
      background: #f7fafc;
      padding: 16px;
      border-radius: 8px;
      margin-top: 24px;
    }
    a {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: transform 0.2s;
    }
    a:hover {
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✅</div>
    <h1>Unsubscribed Successfully</h1>
    <p>You've been unsubscribed from all non-critical email notifications from Manuscript Hub.</p>
    <a href="https://selfpubhub.co/email-preferences.html">Manage Email Preferences</a>
    <div class="note">
      <strong>Note:</strong> You will still receive important emails about payment issues and DMCA notifications.
      You can manage individual notification preferences from your account settings.
    </div>
  </div>
</body>
</html>
    `;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('[Email Prefs] Error unsubscribing:', error);
    return new Response('An error occurred. Please try again later.', {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

/**
 * POST /user/resubscribe
 * Re-enable all email notifications
 */
export async function resubscribe(request, env) {
  try {
    // Verify authentication
    const authHeader = request?.headers?.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    let userId;

    try {
      const secret = new TextEncoder().encode(env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      userId = payload.userId;
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Re-enable all emails
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(`
      UPDATE email_preferences
      SET analysis_complete = 1,
          asset_generation_complete = 1,
          payment_confirmation = 1,
          payment_failed = 1,
          usage_warning = 1,
          dmca_notification = 1,
          team_invitation = 1,
          team_activity = 1,
          weekly_digest = 1,
          admin_alerts = 1,
          updated_at = ?
      WHERE user_id = ?
    `).bind(now, userId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Email Prefs] Error resubscribing:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const emailPreferenceHandlers = {
  getEmailPreferences,
  updateEmailPreferences,
  unsubscribeByToken,
  resubscribe
};
