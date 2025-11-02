/**
 * Admin Cost Tracking Handlers
 *
 * Handlers for cost analytics, budget management, and cost reporting
 *
 * MAN-28/MAN-39: Now includes KV caching for admin stats
 */

import { assertAuthenticated } from './error-handling.js';
import { initCache } from './db-cache.js';

/**
 * Get cost overview statistics
 * GET /admin/costs/overview
 *
 * MAN-39: Now uses KV caching (5 min TTL) for expensive aggregation queries
 */
export async function getCostOverview(request, env, corsHeaders) {
  try {
    // Verify admin authentication
    const userId = await assertAuthenticated(request, env);
    const user = await env.DB.prepare(
      'SELECT role FROM users WHERE id = ?'
    ).bind(userId).first();

    if (user?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Initialize cache
    const cache = initCache(env);
    const cacheKey = `admin:cost-overview:${currentMonth}`;

    // Try to get from cache
    const cached = await cache.cache.get(cacheKey);
    if (cached) {
      console.log(`Cache HIT: ${cacheKey}`);
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          ...corsHeaders
        }
      });
    }

    // Get budget config
    const budgetConfig = await env.DB.prepare(
      'SELECT * FROM budget_config WHERE id = 1'
    ).first();

    // Get total costs for current month
    const monthlyStats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_operations,
        SUM(cost_usd) as total_cost,
        SUM(CASE WHEN cost_center = 'claude_api' THEN cost_usd ELSE 0 END) as claude_cost,
        SUM(CASE WHEN cost_center = 'stripe_fees' THEN cost_usd ELSE 0 END) as stripe_cost,
        SUM(CASE WHEN cost_center LIKE 'cloudflare%' THEN cost_usd ELSE 0 END) as cloudflare_cost,
        SUM(CASE WHEN cost_center = 'email' THEN cost_usd ELSE 0 END) as email_cost,
        SUM(tokens_input) as total_input_tokens,
        SUM(tokens_output) as total_output_tokens
      FROM cost_tracking
      WHERE strftime('%Y-%m', created_at, 'unixepoch') = ?
    `).bind(currentMonth).first();

    // Get cost by feature
    const featureCosts = await env.DB.prepare(`
      SELECT
        feature_name,
        COUNT(*) as operations,
        SUM(cost_usd) as total_cost,
        AVG(cost_usd) as avg_cost
      FROM cost_tracking
      WHERE strftime('%Y-%m', created_at, 'unixepoch') = ?
      GROUP BY feature_name
      ORDER BY total_cost DESC
      LIMIT 10
    `).bind(currentMonth).all();

    // Calculate budget usage percentage
    const budgetUsage = budgetConfig
      ? (budgetConfig.current_spend_usd / budgetConfig.monthly_limit_usd) * 100
      : 0;

    const response = {
      success: true,
      data: {
        budget: {
          monthlyLimit: budgetConfig?.monthly_limit_usd || 0,
          currentSpend: budgetConfig?.current_spend_usd || 0,
          remaining: (budgetConfig?.monthly_limit_usd || 0) - (budgetConfig?.current_spend_usd || 0),
          usagePercent: Math.round(budgetUsage * 100) / 100,
          autoDisableEnabled: budgetConfig?.auto_disable_at_limit === 1,
        },
        monthlyStats: {
          totalOperations: monthlyStats.total_operations || 0,
          totalCost: monthlyStats.total_cost || 0,
          breakdown: {
            claude: monthlyStats.claude_cost || 0,
            stripe: monthlyStats.stripe_cost || 0,
            cloudflare: monthlyStats.cloudflare_cost || 0,
            email: monthlyStats.email_cost || 0,
          },
          tokens: {
            input: monthlyStats.total_input_tokens || 0,
            output: monthlyStats.total_output_tokens || 0,
          },
        },
        topFeatures: featureCosts.results || [],
      }
    };

    // Cache for 5 minutes
    await cache.cache.set(cacheKey, response, 300);
    console.log(`Cache SET: ${cacheKey}`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error fetching cost overview:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Get daily cost breakdown
 * GET /admin/costs/daily?days=30
 */
export async function getDailyCosts(request, env, corsHeaders) {
  try {
    // Verify admin authentication
    const userId = await assertAuthenticated(request, env);
    const user = await env.DB.prepare(
      'SELECT role FROM users WHERE id = ?'
    ).bind(userId).first();

    if (user?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30', 10);

    // Get daily costs from the view
    const dailyCosts = await env.DB.prepare(`
      SELECT
        date,
        cost_center,
        feature_name,
        operation_count,
        total_cost_usd,
        total_input_tokens,
        total_output_tokens
      FROM daily_costs
      WHERE date >= date('now', '-' || ? || ' days')
      ORDER BY date DESC
    `).bind(days).all();

    return new Response(JSON.stringify({
      success: true,
      data: dailyCosts.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error fetching daily costs:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Get top spending users
 * GET /admin/costs/top-users?limit=50
 */
export async function getTopSpenders(request, env, corsHeaders) {
  try {
    // Verify admin authentication
    const userId = await assertAuthenticated(request, env);
    const user = await env.DB.prepare(
      'SELECT role FROM users WHERE id = ?'
    ).bind(userId).first();

    if (user?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    // Get top spenders from the view
    const topSpenders = await env.DB.prepare(`
      SELECT * FROM top_spenders_monthly
      LIMIT ?
    `).bind(limit).all();

    return new Response(JSON.stringify({
      success: true,
      data: topSpenders.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error fetching top spenders:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Get budget alerts
 * GET /admin/costs/alerts?acknowledged=false
 */
export async function getBudgetAlerts(request, env, corsHeaders) {
  try {
    // Verify admin authentication
    const userId = await assertAuthenticated(request, env);
    const user = await env.DB.prepare(
      'SELECT role FROM users WHERE id = ?'
    ).bind(userId).first();

    if (user?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const url = new URL(request.url);
    const acknowledgedParam = url.searchParams.get('acknowledged');
    const acknowledged = acknowledgedParam === 'true' ? 1 : (acknowledgedParam === 'false' ? 0 : null);

    let query = 'SELECT * FROM budget_alerts';
    const params = [];

    if (acknowledged !== null) {
      query += ' WHERE acknowledged = ?';
      params.push(acknowledged);
    }

    query += ' ORDER BY sent_at DESC LIMIT 100';

    const alerts = await env.DB.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({
      success: true,
      data: alerts.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error fetching budget alerts:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Update budget configuration
 * PATCH /admin/costs/budget
 */
export async function updateBudgetConfig(request, env, corsHeaders) {
  try {
    // Verify admin authentication
    const userId = await assertAuthenticated(request, env);
    const user = await env.DB.prepare(
      'SELECT role FROM users WHERE id = ?'
    ).bind(userId).first();

    if (user?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json();
    const {
      monthlyLimit,
      dailyLimit,
      alertThreshold50,
      alertThreshold75,
      alertThreshold90,
      alertThreshold100,
      autoDisableAtLimit,
    } = body;

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (monthlyLimit !== undefined) {
      updates.push('monthly_limit_usd = ?');
      params.push(monthlyLimit);
    }
    if (dailyLimit !== undefined) {
      updates.push('daily_limit_usd = ?');
      params.push(dailyLimit);
    }
    if (alertThreshold50 !== undefined) {
      updates.push('alert_threshold_50 = ?');
      params.push(alertThreshold50 ? 1 : 0);
    }
    if (alertThreshold75 !== undefined) {
      updates.push('alert_threshold_75 = ?');
      params.push(alertThreshold75 ? 1 : 0);
    }
    if (alertThreshold90 !== undefined) {
      updates.push('alert_threshold_90 = ?');
      params.push(alertThreshold90 ? 1 : 0);
    }
    if (alertThreshold100 !== undefined) {
      updates.push('alert_threshold_100 = ?');
      params.push(alertThreshold100 ? 1 : 0);
    }
    if (autoDisableAtLimit !== undefined) {
      updates.push('auto_disable_at_limit = ?');
      params.push(autoDisableAtLimit ? 1 : 0);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    updates.push('updated_at = ?');
    params.push(Math.floor(Date.now() / 1000));

    const query = `UPDATE budget_config SET ${updates.join(', ')} WHERE id = 1`;
    await env.DB.prepare(query).bind(...params).run();

    // Get updated config
    const updatedConfig = await env.DB.prepare(
      'SELECT * FROM budget_config WHERE id = 1'
    ).first();

    return new Response(JSON.stringify({
      success: true,
      data: updatedConfig
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error updating budget config:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Acknowledge a budget alert
 * PATCH /admin/costs/alerts/:id/acknowledge
 */
export async function acknowledgeBudgetAlert(request, env, corsHeaders, alertId) {
  try {
    // Verify admin authentication
    const userId = await assertAuthenticated(request, env);
    const user = await env.DB.prepare(
      'SELECT role FROM users WHERE id = ?'
    ).bind(userId).first();

    if (user?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    await env.DB.prepare(`
      UPDATE budget_alerts
      SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ?
      WHERE id = ?
    `).bind(userId, Math.floor(Date.now() / 1000), alertId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Alert acknowledged'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Get feature cost breakdown
 * GET /admin/costs/features
 */
export async function getFeatureCosts(request, env, corsHeaders) {
  try {
    // Verify admin authentication
    const userId = await assertAuthenticated(request, env);
    const user = await env.DB.prepare(
      'SELECT role FROM users WHERE id = ?'
    ).bind(userId).first();

    if (user?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get feature costs from the view
    const featureCosts = await env.DB.prepare(`
      SELECT * FROM feature_costs_monthly
      ORDER BY total_cost_usd DESC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: featureCosts.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error fetching feature costs:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
