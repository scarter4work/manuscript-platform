/**
 * Admin Management Handlers
 * Comprehensive admin API for platform management
 *
 * Features:
 * - User management (list, view, update, ban/unban)
 * - Manuscript oversight (view all, analytics)
 * - Platform analytics and stats
 * - Billing and subscription management
 */

import { getUserFromRequest } from '../utils/auth-utils.js';

// ============================================================================
// MIDDLEWARE: ADMIN AUTHORIZATION
// ============================================================================

/**
 * Verify user is admin before allowing access to admin endpoints
 * @param {Request} request - HTTP request
 * @param {Object} env - Cloudflare environment
 * @returns {Promise<Object>} { authorized: boolean, userId: string|null, error: string|null }
 */
async function verifyAdmin(request, env) {
  const userId = await getUserFromRequest(request, env);

  if (!userId) {
    return { authorized: false, userId: null, error: 'Unauthorized - please log in' };
  }

  const user = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first();

  if (!user || user.role !== 'admin') {
    return { authorized: false, userId, error: 'Admin access required' };
  }

  return { authorized: true, userId, error: null };
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * GET /admin/users - List all users with filtering and pagination
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 50, max: 200)
 * - role: Filter by role (author, publisher, admin)
 * - status: Filter by status (active, banned)
 * - search: Search by email or ID
 * - sortBy: Sort field (created_at, last_login, email)
 * - sortOrder: asc or desc (default: desc)
 */
export async function listUsers(request, env, corsHeaders) {
  try {
    const auth = await verifyAdmin(request, env);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.userId ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = (page - 1) * limit;
    const role = url.searchParams.get('role');
    const search = url.searchParams.get('search');
    const sortBy = url.searchParams.get('sortBy') || 'created_at';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    // Build query with filters
    let query = `
      SELECT
        u.id, u.email, u.role, u.created_at, u.last_login, u.email_verified,
        COUNT(DISTINCT m.id) as manuscript_count,
        s.plan_type, s.stripe_subscription_id, s.status as subscription_status
      FROM users u
      LEFT JOIN manuscripts m ON u.id = m.user_id
      LEFT JOIN user_subscriptions s ON u.id = s.user_id
    `;

    const conditions = [];
    const params = [];

    if (role) {
      conditions.push('u.role = ?');
      params.push(role);
    }

    if (search) {
      conditions.push('(u.email LIKE ? OR u.id LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY u.id';

    // Add sorting
    const validSortFields = ['created_at', 'last_login', 'email'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    query += ` ORDER BY u.${sortField} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;

    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM users u';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    const countResult = await env.DB.prepare(countQuery)
      .bind(...params.slice(0, params.length - 2))
      .first();

    // Execute main query
    const result = await env.DB.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({
      success: true,
      users: result.results,
      pagination: {
        page,
        limit,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit)
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Admin] List users error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch users',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /admin/users/:userId - Get detailed user information
 */
export async function getUserDetails(request, env, corsHeaders, userId) {
  try {
    const auth = await verifyAdmin(request, env);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.userId ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user details
    const user = await env.DB.prepare(`
      SELECT id, email, role, created_at, last_login, email_verified
      FROM users WHERE id = ?
    `).bind(userId).first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get subscription info
    const subscription = await env.DB.prepare(`
      SELECT * FROM user_subscriptions_with_usage WHERE user_id = ?
    `).bind(userId).first();

    // Get manuscripts
    const manuscripts = await env.DB.prepare(`
      SELECT id, title, status, genre, word_count, uploaded_at, flagged_for_review
      FROM manuscripts WHERE user_id = ?
      ORDER BY uploaded_at DESC
      LIMIT 20
    `).bind(userId).all();

    // Get recent activity from audit log
    const activity = await env.DB.prepare(`
      SELECT action, resource_type, timestamp, metadata
      FROM audit_log WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT 50
    `).bind(userId).all();

    // Get payment history
    const payments = await env.DB.prepare(`
      SELECT payment_id, amount, currency, status, created_at, metadata
      FROM payment_transactions WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(userId).all();

    return new Response(JSON.stringify({
      success: true,
      user,
      subscription,
      manuscripts: manuscripts.results,
      activity: activity.results,
      payments: payments.results,
      stats: {
        manuscriptCount: manuscripts.results.length,
        totalActivity: activity.results.length
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Admin] Get user details error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch user details',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /admin/users/:userId - Update user (change role, adjust limits)
 *
 * Body:
 * - role: Change user role (author, publisher, admin)
 * - email_verified: Update verification status
 */
export async function updateUser(request, env, corsHeaders, userId) {
  try {
    const auth = await verifyAdmin(request, env);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.userId ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { role, email_verified } = body;

    // Validate role if provided
    if (role && !['author', 'publisher', 'admin'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (role !== undefined) {
      updates.push('role = ?');
      params.push(role);
    }

    if (email_verified !== undefined) {
      updates.push('email_verified = ?');
      params.push(email_verified ? 1 : 0);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No updates provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Always update updated_at timestamp
    updates.push('updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT');

    params.push(userId);

    await env.DB.prepare(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();

    // Log the update
    await env.DB.prepare(`
      INSERT INTO audit_log (id, user_id, event_type, resource_type, resource_id, created_at, event_details)
      VALUES (?, ?, 'admin_update_user', 'user', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      auth.userId,
      userId,
      Math.floor(Date.now() / 1000),
      JSON.stringify({ updates: body })
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'User updated successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Admin] Update user error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update user',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/users/:userId/subscription - Adjust user subscription
 *
 * Body:
 * - plan_type: Change plan (free, basic, professional, enterprise)
 * - monthly_limit: Override manuscript limit
 */
export async function adjustUserSubscription(request, env, corsHeaders, userId) {
  try {
    const auth = await verifyAdmin(request, env);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.userId ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { plan_type, monthly_limit } = body;

    if (!plan_type) {
      return new Response(JSON.stringify({ error: 'plan_type is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const validPlans = ['free', 'basic', 'professional', 'enterprise'];
    if (!validPlans.includes(plan_type)) {
      return new Response(JSON.stringify({ error: 'Invalid plan type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if subscription exists
    const existing = await env.DB.prepare(
      'SELECT id FROM user_subscriptions WHERE user_id = ?'
    ).bind(userId).first();

    if (existing) {
      // Update existing subscription
      await env.DB.prepare(`
        UPDATE user_subscriptions
        SET plan_type = ?, monthly_limit = ?, updated_at = ?
        WHERE user_id = ?
      `).bind(
        plan_type,
        monthly_limit || null,
        Math.floor(Date.now() / 1000),
        userId
      ).run();
    } else {
      // Create new subscription
      await env.DB.prepare(`
        INSERT INTO user_subscriptions (id, user_id, plan_type, status, monthly_limit, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        userId,
        plan_type,
        monthly_limit || null,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      ).run();
    }

    // Log the adjustment
    await env.DB.prepare(`
      INSERT INTO audit_log (id, user_id, event_type, resource_type, resource_id, created_at, event_details)
      VALUES (?, ?, 'admin_adjust_subscription', 'subscription', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      auth.userId,
      userId,
      Math.floor(Date.now() / 1000),
      JSON.stringify({ plan_type, monthly_limit })
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Subscription adjusted successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Admin] Adjust subscription error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to adjust subscription',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// MANUSCRIPT OVERSIGHT
// ============================================================================

/**
 * GET /admin/manuscripts - List all manuscripts with filtering
 */
export async function listAllManuscripts(request, env, corsHeaders) {
  try {
    const auth = await verifyAdmin(request, env);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.userId ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = (page - 1) * limit;
    const status = url.searchParams.get('status');
    const flagged = url.searchParams.get('flagged');
    const genre = url.searchParams.get('genre');

    let query = `
      SELECT
        m.id, m.title, m.status, m.genre, m.word_count, m.uploaded_at, m.flagged_for_review,
        u.email as owner_email, u.role as owner_role
      FROM manuscripts m
      LEFT JOIN users u ON m.user_id = u.id
    `;

    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('m.status = ?');
      params.push(status);
    }

    if (flagged === 'true') {
      conditions.push('m.flagged_for_review = 1');
    }

    if (genre) {
      conditions.push('m.genre = ?');
      params.push(genre);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY m.uploaded_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM manuscripts m';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    const countResult = await env.DB.prepare(countQuery)
      .bind(...params.slice(0, params.length - 2))
      .first();

    const result = await env.DB.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({
      success: true,
      manuscripts: result.results,
      pagination: {
        page,
        limit,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit)
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Admin] List manuscripts error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch manuscripts',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /admin/manuscripts/:manuscriptId - Admin delete manuscript
 */
export async function adminDeleteManuscript(request, env, corsHeaders, manuscriptId) {
  try {
    const auth = await verifyAdmin(request, env);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.userId ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get manuscript info before deletion
    const manuscript = await env.DB.prepare(
      'SELECT user_id, r2_key, title FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Delete from R2
    await env.R2.getBucket('manuscripts_raw').delete(manuscript.r2_key);

    // Delete from database
    await env.DB.prepare('DELETE FROM manuscripts WHERE id = ?').bind(manuscriptId).run();

    // Log deletion
    await env.DB.prepare(`
      INSERT INTO audit_log (id, user_id, event_type, resource_type, resource_id, created_at, event_details)
      VALUES (?, ?, 'admin_delete_manuscript', 'manuscript', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      auth.userId,
      manuscriptId,
      Math.floor(Date.now() / 1000),
      JSON.stringify({ title: manuscript.title, owner_id: manuscript.user_id })
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Manuscript deleted successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Admin] Delete manuscript error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete manuscript',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// PLATFORM ANALYTICS
// ============================================================================

/**
 * GET /admin/analytics/overview - Platform overview stats
 */
export async function getAnalyticsOverview(request, env, corsHeaders) {
  try {
    const auth = await verifyAdmin(request, env);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.userId ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get various platform stats in parallel
    const [
      userStats,
      manuscriptStats,
      subscriptionStats,
      revenueStats,
      activityStats
    ] = await Promise.all([
      // User stats
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END) as verified,
          SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) as new_last_30_days
        FROM users
      `).bind(Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)).first(),

      // Manuscript stats
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN flagged_for_review = 1 THEN 1 ELSE 0 END) as flagged,
          SUM(CASE WHEN uploaded_at > ? THEN 1 ELSE 0 END) as uploaded_last_30_days
        FROM manuscripts
      `).bind(Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)).first(),

      // Subscription stats
      env.DB.prepare(`
        SELECT
          plan_type,
          COUNT(*) as count
        FROM user_subscriptions
        WHERE status = 'active'
        GROUP BY plan_type
      `).all(),

      // Revenue stats (last 30 days)
      env.DB.prepare(`
        SELECT
          SUM(amount) as total_revenue,
          COUNT(*) as transaction_count
        FROM payment_transactions
        WHERE status = 'completed' AND created_at > ?
      `).bind(Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)).first(),

      // Recent activity
      env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM audit_log
        WHERE timestamp > ?
      `).bind(Math.floor(Date.now() / 1000) - (24 * 60 * 60)).first()
    ]);

    return new Response(JSON.stringify({
      success: true,
      stats: {
        users: userStats,
        manuscripts: manuscriptStats,
        subscriptions: subscriptionStats.results,
        revenue: revenueStats,
        activity: activityStats
      },
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Admin] Analytics overview error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch analytics',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /admin/analytics/activity - Recent platform activity
 */
export async function getRecentActivity(request, env, corsHeaders) {
  try {
    const auth = await verifyAdmin(request, env);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.userId ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

    const activity = await env.DB.prepare(`
      SELECT
        a.id, a.user_id, a.action, a.resource_type, a.resource_id, a.timestamp, a.metadata,
        u.email as user_email
      FROM audit_log a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.timestamp DESC
      LIMIT ?
    `).bind(limit).all();

    return new Response(JSON.stringify({
      success: true,
      activity: activity.results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Admin] Recent activity error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch activity',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const adminHandlers = {
  listUsers,
  getUserDetails,
  updateUser,
  adjustUserSubscription,
  listAllManuscripts,
  adminDeleteManuscript,
  getAnalyticsOverview,
  getRecentActivity
};
