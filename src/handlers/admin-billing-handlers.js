/**
 * Phase G: Admin Billing Management Handlers
 * API endpoints for managing payments, subscriptions, and revenue
 */

/**
 * Verify admin authorization (shared utility)
 */
async function verifyAdmin(request, env) {
  const { getUserFromRequest } = await import('./auth-utils.js');

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

/**
 * Get payment transactions with filtering
 * GET /admin/billing/transactions?status=succeeded&page=1&limit=50
 */
export async function listPaymentTransactions(request, env, corsHeaders) {
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
    const status = url.searchParams.get('status'); // succeeded, pending, failed, refunded
    const search = url.searchParams.get('search'); // Search by user email or transaction ID

    // Build query
    let query = `
      SELECT
        t.id,
        t.user_id,
        t.stripe_payment_intent_id,
        t.amount,
        t.currency,
        t.status,
        t.plan_type,
        t.created_at,
        t.metadata,
        u.email as user_email
      FROM payment_transactions t
      LEFT JOIN users u ON t.user_id = u.id
    `;

    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(u.email LIKE ? OR t.id LIKE ? OR t.stripe_payment_intent_id LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM payment_transactions t LEFT JOIN users u ON t.user_id = u.id';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    const [result, countResult] = await Promise.all([
      env.DB.prepare(query).bind(...params).all(),
      env.DB.prepare(countQuery).bind(...params.slice(0, -2)).first()
    ]);

    return new Response(JSON.stringify({
      success: true,
      transactions: result.results,
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
    console.error('[Admin Billing] List transactions error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch transactions',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get subscription statistics and breakdown
 * GET /admin/billing/subscriptions/stats
 */
export async function getSubscriptionStats(request, env, corsHeaders) {
  try {
    const auth = await verifyAdmin(request, env);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.userId ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get subscription breakdown by plan type
    const planBreakdown = await env.DB.prepare(`
      SELECT
        plan_type,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled,
        SUM(CASE WHEN status = 'past_due' THEN 1 ELSE 0 END) as past_due
      FROM user_subscriptions
      GROUP BY plan_type
    `).all();

    // Get subscription status breakdown
    const statusBreakdown = await env.DB.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM user_subscriptions
      GROUP BY status
    `).all();

    // Get subscription trends (last 30 days)
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    const trends = await env.DB.prepare(`
      SELECT
        plan_type,
        COUNT(*) as new_subscriptions
      FROM user_subscriptions
      WHERE created_at >= ?
      GROUP BY plan_type
    `).bind(thirtyDaysAgo).all();

    // Get churn data (cancellations in last 30 days)
    const churnData = await env.DB.prepare(`
      SELECT
        plan_type,
        COUNT(*) as cancellations
      FROM user_subscriptions
      WHERE status = 'canceled' AND updated_at >= ?
      GROUP BY plan_type
    `).bind(thirtyDaysAgo).all();

    return new Response(JSON.stringify({
      success: true,
      planBreakdown: planBreakdown.results,
      statusBreakdown: statusBreakdown.results,
      trends: {
        newSubscriptions: trends.results,
        churn: churnData.results,
        periodDays: 30
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Admin Billing] Subscription stats error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch subscription statistics',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get revenue analytics
 * GET /admin/billing/revenue?period=30
 */
export async function getRevenueAnalytics(request, env, corsHeaders) {
  try {
    const auth = await verifyAdmin(request, env);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.userId ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const period = parseInt(url.searchParams.get('period') || '30'); // Days
    const startTime = Math.floor(Date.now() / 1000) - (period * 24 * 60 * 60);

    // Total revenue by status
    const revenueByStatus = await env.DB.prepare(`
      SELECT
        status,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count,
        currency
      FROM payment_transactions
      WHERE created_at >= ?
      GROUP BY status, currency
    `).bind(startTime).all();

    // Revenue by plan type
    const revenueByPlan = await env.DB.prepare(`
      SELECT
        plan_type,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count,
        AVG(amount) as avg_amount
      FROM payment_transactions
      WHERE created_at >= ? AND status = 'succeeded'
      GROUP BY plan_type
    `).bind(startTime).all();

    // Daily revenue breakdown (for charting)
    const dailyRevenue = await env.DB.prepare(`
      SELECT
        DATE(created_at, 'unixepoch') as date,
        SUM(amount) as revenue,
        COUNT(*) as transactions
      FROM payment_transactions
      WHERE created_at >= ? AND status = 'succeeded'
      GROUP BY DATE(created_at, 'unixepoch')
      ORDER BY date ASC
    `).bind(startTime).all();

    // Overall metrics
    const metrics = await env.DB.prepare(`
      SELECT
        SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END) as total_refunded,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_transactions,
        COUNT(*) as total_transactions,
        AVG(CASE WHEN status = 'succeeded' THEN amount ELSE NULL END) as avg_transaction_value
      FROM payment_transactions
      WHERE created_at >= ?
    `).bind(startTime).first();

    return new Response(JSON.stringify({
      success: true,
      period: period,
      metrics: {
        totalRevenue: metrics.total_revenue || 0,
        totalRefunded: metrics.total_refunded || 0,
        failedTransactions: metrics.failed_transactions || 0,
        totalTransactions: metrics.total_transactions || 0,
        avgTransactionValue: metrics.avg_transaction_value || 0
      },
      revenueByStatus: revenueByStatus.results,
      revenueByPlan: revenueByPlan.results,
      dailyRevenue: dailyRevenue.results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Admin Billing] Revenue analytics error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch revenue analytics',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get failed payments for admin review
 * GET /admin/billing/failed-payments
 */
export async function getFailedPayments(request, env, corsHeaders) {
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

    const result = await env.DB.prepare(`
      SELECT
        t.id,
        t.user_id,
        t.stripe_payment_intent_id,
        t.amount,
        t.currency,
        t.plan_type,
        t.created_at,
        t.metadata,
        u.email as user_email,
        s.status as subscription_status
      FROM payment_transactions t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN user_subscriptions s ON t.user_id = s.user_id
      WHERE t.status = 'failed'
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as total
      FROM payment_transactions
      WHERE status = 'failed'
    `).first();

    return new Response(JSON.stringify({
      success: true,
      failedPayments: result.results,
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
    console.error('[Admin Billing] Failed payments error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch failed payments',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Issue refund for a payment
 * POST /admin/billing/refund
 * Body: { transactionId, reason }
 */
export async function issueRefund(request, env, corsHeaders) {
  try {
    const auth = await verifyAdmin(request, env);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.userId ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { transactionId, reason } = body;

    if (!transactionId || !reason) {
      return new Response(JSON.stringify({ error: 'transactionId and reason are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get transaction details
    const transaction = await env.DB.prepare(`
      SELECT * FROM payment_transactions WHERE id = ?
    `).bind(transactionId).first();

    if (!transaction) {
      return new Response(JSON.stringify({ error: 'Transaction not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (transaction.status !== 'succeeded') {
      return new Response(JSON.stringify({ error: 'Can only refund succeeded payments' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if STRIPE_SECRET_KEY is available
    if (!env.STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Stripe is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Issue refund via Stripe API
    const refundResponse = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        payment_intent: transaction.stripe_payment_intent_id,
        reason: 'requested_by_customer',
        metadata: JSON.stringify({ admin_reason: reason })
      })
    });

    if (!refundResponse.ok) {
      const error = await refundResponse.json();
      console.error('[Admin Billing] Stripe refund error:', error);
      return new Response(JSON.stringify({
        error: 'Failed to issue refund via Stripe',
        details: error.error?.message || 'Unknown error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const refundData = await refundResponse.json();

    // Update transaction status
    const timestamp = Math.floor(Date.now() / 1000);
    await env.DB.prepare(`
      UPDATE payment_transactions
      SET status = 'refunded', metadata = ?
      WHERE id = ?
    `).bind(
      JSON.stringify({
        ...JSON.parse(transaction.metadata || '{}'),
        refund_id: refundData.id,
        refund_reason: reason,
        refunded_at: timestamp
      }),
      transactionId
    ).run();

    // Log audit event
    await env.DB.prepare(`
      INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      auth.userId,
      'refund_issued',
      'payment_transaction',
      transactionId,
      timestamp,
      JSON.stringify({
        amount: transaction.amount,
        currency: transaction.currency,
        reason: reason,
        refund_id: refundData.id
      })
    ).run();

    console.log(`[Admin Billing] Issued refund for transaction ${transactionId}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Refund issued successfully',
      refundId: refundData.id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Admin Billing] Refund error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to issue refund',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Manually cancel user subscription
 * POST /admin/billing/cancel-subscription
 * Body: { userId, reason }
 */
export async function cancelSubscription(request, env, corsHeaders) {
  try {
    const auth = await verifyAdmin(request, env);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.userId ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { userId, reason } = body;

    if (!userId || !reason) {
      return new Response(JSON.stringify({ error: 'userId and reason are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get subscription details
    const subscription = await env.DB.prepare(`
      SELECT * FROM user_subscriptions WHERE user_id = ?
    `).bind(userId).first();

    if (!subscription) {
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (subscription.status === 'canceled') {
      return new Response(JSON.stringify({ error: 'Subscription is already canceled' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If there's a Stripe subscription, cancel it
    if (subscription.stripe_subscription_id && env.STRIPE_SECRET_KEY) {
      try {
        const cancelResponse = await fetch(
          `https://api.stripe.com/v1/subscriptions/${subscription.stripe_subscription_id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
            }
          }
        );

        if (!cancelResponse.ok) {
          console.error('[Admin Billing] Stripe cancel error:', await cancelResponse.text());
          // Continue with local cancellation even if Stripe fails
        }
      } catch (stripeError) {
        console.error('[Admin Billing] Stripe API error:', stripeError);
        // Continue with local cancellation even if Stripe fails
      }
    }

    // Update subscription status
    const timestamp = Math.floor(Date.now() / 1000);
    await env.DB.prepare(`
      UPDATE user_subscriptions
      SET status = 'canceled', updated_at = ?
      WHERE user_id = ?
    `).bind(timestamp, userId).run();

    // Log audit event
    await env.DB.prepare(`
      INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      auth.userId,
      'subscription_canceled',
      'subscription',
      subscription.id,
      timestamp,
      JSON.stringify({
        target_user_id: userId,
        plan_type: subscription.plan_type,
        reason: reason
      })
    ).run();

    console.log(`[Admin Billing] Canceled subscription for user ${userId}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Subscription canceled successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Admin Billing] Cancel subscription error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to cancel subscription',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get transaction details
 * GET /admin/billing/transactions/:transactionId
 */
export async function getTransactionDetails(request, env, corsHeaders, transactionId) {
  try {
    const auth = await verifyAdmin(request, env);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.userId ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const transaction = await env.DB.prepare(`
      SELECT
        t.*,
        u.email as user_email,
        u.role as user_role,
        s.plan_type as current_plan,
        s.status as subscription_status
      FROM payment_transactions t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN user_subscriptions s ON t.user_id = s.user_id
      WHERE t.id = ?
    `).bind(transactionId).first();

    if (!transaction) {
      return new Response(JSON.stringify({ error: 'Transaction not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get related audit log entries
    const auditLogs = await env.DB.prepare(`
      SELECT * FROM audit_log
      WHERE resource_type = 'payment_transaction' AND resource_id = ?
      ORDER BY timestamp DESC
      LIMIT 20
    `).bind(transactionId).all();

    return new Response(JSON.stringify({
      success: true,
      transaction,
      auditLogs: auditLogs.results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Admin Billing] Get transaction details error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch transaction details',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
