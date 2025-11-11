/**
 * Phase F: Payment Processing Handlers
 * Stripe integration for subscriptions and one-time purchases
 */

import Stripe from 'stripe';

// Pricing configuration
const PRICING = {
  free: {
    name: 'Free',
    monthlyLimit: 1,
    price: 0,
    features: ['Basic analysis', '1 manuscript/month', '30 days storage']
  },
  pro: {
    name: 'Pro',
    monthlyLimit: 10,
    price: 2900, // $29.00 in cents
    priceId: 'price_pro_monthly', // Replace with actual Stripe Price ID
    features: ['Full analysis', '10 manuscripts/month', '1 year storage', 'Asset generation', 'Priority support']
  },
  enterprise: {
    name: 'Enterprise',
    monthlyLimit: 999999,
    price: 9900, // $99.00 in cents
    priceId: 'price_enterprise_monthly', // Replace with actual Stripe Price ID
    features: ['Unlimited manuscripts', 'Team features (5 members)', 'API access', 'Dedicated support', 'Custom branding']
  },
  oneTime: {
    name: 'One-Time Analysis',
    price: 1000, // $10.00 in cents
    features: ['Full analysis + assets', '90 days storage']
  }
};

/**
 * Initialize Stripe client
 */
function getStripeClient(env) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-10-28.acacia',
  });
}

/**
 * Create Stripe Checkout Session for subscription
 * POST /payments/create-checkout-session
 */
export async function createCheckoutSession(request, env, corsHeaders) {
  try {
    const { getUserFromRequest } = await import('../utils/auth-utils.js');
    const userId = await getUserFromRequest(request, env);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { plan } = body; // 'pro' or 'enterprise'

    if (!plan || !['pro', 'enterprise'].includes(plan)) {
      return new Response(JSON.stringify({ error: 'Invalid plan type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const stripe = getStripeClient(env);
    const pricing = PRICING[plan];

    // Get user details
    const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first();

    // Get or create Stripe customer
    let stripeCustomerId;
    const existingSubscription = await env.DB.prepare(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(userId).first();

    if (existingSubscription && existingSubscription.stripe_customer_id && !existingSubscription.stripe_customer_id.startsWith('default_')) {
      stripeCustomerId = existingSubscription.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: userId
        }
      });
      stripeCustomerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [
        {
          price: pricing.priceId,
          quantity: 1,
        },
      ],
      success_url: `${env.FRONTEND_URL || 'http://localhost:8787'}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL || 'http://localhost:8787'}/pricing?canceled=true`,
      metadata: {
        userId: userId,
        planType: plan
      },
      subscription_data: {
        metadata: {
          userId: userId,
          planType: plan
        }
      }
    });

    return new Response(JSON.stringify({
      success: true,
      sessionId: session.id,
      url: session.url
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Payment] Checkout session error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create checkout session',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Create Payment Intent for one-time purchase
 * POST /payments/create-payment-intent
 */
export async function createPaymentIntent(request, env, corsHeaders) {
  try {
    const { getUserFromRequest } = await import('../utils/auth-utils.js');
    const userId = await getUserFromRequest(request, env);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { manuscriptId } = body;

    if (!manuscriptId) {
      return new Response(JSON.stringify({ error: 'Manuscript ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const stripe = getStripeClient(env);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: PRICING.oneTime.price,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: userId,
        manuscriptId: manuscriptId,
        type: 'one_time_analysis'
      }
    });

    return new Response(JSON.stringify({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Payment] Payment intent error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create payment intent',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Create Customer Portal Session
 * POST /payments/create-portal-session
 */
export async function createPortalSession(request, env, corsHeaders) {
  try {
    const { getUserFromRequest } = await import('../utils/auth-utils.js');
    const userId = await getUserFromRequest(request, env);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's Stripe customer ID
    const subscription = await env.DB.prepare(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(userId, 'active').first();

    if (!subscription || !subscription.stripe_customer_id || subscription.stripe_customer_id.startsWith('default_')) {
      return new Response(JSON.stringify({
        error: 'No active subscription found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const stripe = getStripeClient(env);

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${env.FRONTEND_URL || 'http://localhost:8787'}/billing`,
    });

    return new Response(JSON.stringify({
      success: true,
      url: session.url
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Payment] Portal session error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create portal session',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get current subscription details
 * GET /payments/subscription
 */
export async function getSubscription(request, env, corsHeaders) {
  try {
    const { getUserFromRequest } = await import('../utils/auth-utils.js');
    const userId = await getUserFromRequest(request, env);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const subscription = await env.DB.prepare(`
      SELECT * FROM user_subscriptions_with_usage WHERE user_id = ?
    `).bind(userId).first();

    if (!subscription || !subscription.plan_type) {
      return new Response(JSON.stringify({
        plan_type: 'free',
        status: 'active',
        manuscriptsThisPeriod: 0,
        monthlyLimit: 1,
        currentPeriodEnd: Date.now() + (30 * 24 * 60 * 60 * 1000)
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      plan_type: subscription.plan_type,
      status: subscription.subscription_status,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      manuscriptsThisPeriod: subscription.manuscripts_this_period,
      monthlyLimit: subscription.monthly_limit,
      currentPeriodStart: subscription.current_period_start * 1000,
      currentPeriodEnd: subscription.current_period_end * 1000,
      cancelAtPeriodEnd: subscription.cancel_at_period_end === 1
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Payment] Get subscription error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get subscription',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get payment history
 * GET /payments/history
 */
export async function getPaymentHistory(request, env, corsHeaders) {
  try {
    const { getUserFromRequest } = await import('../utils/auth-utils.js');
    const userId = await getUserFromRequest(request, env);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payments = await env.DB.prepare(`
      SELECT id, user_id, amount, currency, payment_type, status, description, created_at
      FROM payment_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).bind(userId).all();

    return new Response(JSON.stringify({
      payments: payments.results.map(p => ({
        ...p,
        amount: p.amount / 100, // Convert cents to dollars
        created_at: parseInt(p.created_at) * 1000 // Convert to milliseconds
      }))
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Payment] Get history error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get payment history',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Check if user can upload manuscript (usage limits)
 * GET /payments/can-upload
 */
export async function checkCanUpload(request, env, corsHeaders) {
  try {
    const { getUserFromRequest } = await import('../utils/auth-utils.js');
    const userId = await getUserFromRequest(request, env);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const subscription = await env.DB.prepare(`
      SELECT * FROM user_subscriptions_with_usage WHERE user_id = ?
    `).bind(userId).first();

    const canUpload = !subscription || subscription.manuscripts_this_period < subscription.monthly_limit;

    return new Response(JSON.stringify({
      canUpload,
      planType: subscription?.plan_type || 'free',
      manuscriptsUsed: subscription?.manuscripts_this_period || 0,
      monthlyLimit: subscription?.monthly_limit || 1,
      upgradeRequired: !canUpload
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Payment] Check upload error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to check upload status',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Track usage after successful manuscript upload
 */
export async function trackUsage(env, userId, manuscriptId, analysisType = 'full', assetsGenerated = false) {
  try {
    // Get current subscription
    const subscription = await env.DB.prepare(`
      SELECT id, current_period_start, current_period_end
      FROM subscriptions
      WHERE user_id = ? AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(userId).first();

    const usageId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      INSERT INTO usage_tracking (
        id, user_id, subscription_id, manuscript_id, analysis_type,
        assets_generated, credits_used, timestamp, billing_period_start, billing_period_end
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      usageId,
      userId,
      subscription?.id || null,
      manuscriptId,
      analysisType,
      assetsGenerated ? 1 : 0,
      1, // credits_used
      timestamp,
      subscription?.current_period_start || timestamp,
      subscription?.current_period_end || timestamp + (30 * 24 * 60 * 60) // +30 days
    ).run();

    console.log(`[Payment] Usage tracked: ${usageId}`);
    return true;
  } catch (error) {
    console.error('[Payment] Track usage error:', error);
    return false;
  }
}

/**
 * Create free subscription for new users
 */
export async function createFreeSubscription(env, userId) {
  try {
    const subscriptionId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);
    const periodEnd = timestamp + (30 * 24 * 60 * 60); // +30 days

    await env.DB.prepare(`
      INSERT INTO subscriptions (
        id, user_id, stripe_customer_id, plan_type, status,
        current_period_start, current_period_end, cancel_at_period_end,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      subscriptionId,
      userId,
      `default_${userId}`,
      'free',
      'active',
      timestamp,
      periodEnd,
      0,
      timestamp,
      timestamp
    ).run();

    console.log(`[Payment] Free subscription created for user ${userId}`);
    return subscriptionId;
  } catch (error) {
    console.error('[Payment] Create free subscription error:', error);
    throw error;
  }
}

export { PRICING };
