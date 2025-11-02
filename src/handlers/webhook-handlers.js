/**
 * Stripe Webhook Handlers (Phase F)
 * Processes Stripe webhook events for subscription management
 */

import Stripe from 'stripe';
import { calculateStripeFee, logCost } from '../utils/cost-utils.js';
import { sendPaymentConfirmationEmail, sendPaymentFailedEmail } from '../services/email-service.js';

/**
 * Main webhook handler
 * Verifies Stripe signature and routes events to appropriate handlers
 */
export async function handleStripeWebhook(request, env, corsHeaders) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return new Response(JSON.stringify({ error: 'No signature provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-10-28.acacia',
    });

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('[Webhook] Signature verification failed:', err.message);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[Webhook] Processing event:', event.type, event.id);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutCompleted(env, session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionUpdate(env, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(env, subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        await handlePaymentSucceeded(env, invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await handlePaymentFailed(env, invoice);
        break;
      }

      default:
        console.log('[Webhook] Unhandled event type:', event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle checkout.session.completed event
 * Creates or updates subscription record
 */
async function handleCheckoutCompleted(env, session) {
  const userId = session.metadata.userId;
  const planType = session.metadata.planType;
  const stripeCustomerId = session.customer;

  console.log('[Webhook] Checkout completed for user:', userId, 'plan:', planType);

  if (session.mode === 'subscription') {
    // Subscription checkout
    const stripeSubscriptionId = session.subscription;

    // Fetch full subscription details from Stripe
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-10-28.acacia',
    });
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    // Create subscription record
    const subscriptionId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      INSERT INTO subscriptions (
        id, user_id, stripe_subscription_id, stripe_customer_id, plan_type,
        status, current_period_start, current_period_end, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(stripe_subscription_id) DO UPDATE SET
        status = excluded.status,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        updated_at = excluded.updated_at
    `).bind(
      subscriptionId,
      userId,
      stripeSubscriptionId,
      stripeCustomerId,
      planType,
      subscription.status,
      subscription.current_period_start,
      subscription.current_period_end,
      timestamp,
      timestamp
    ).run();

    // Update user's subscription tier
    await env.DB.prepare(`
      UPDATE users SET subscription_tier = ? WHERE id = ?
    `).bind(planType, userId).run();

    console.log('[Webhook] Subscription created:', subscriptionId);

  } else if (session.mode === 'payment') {
    // One-time payment - record in payment history
    const paymentId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);
    const amountUSD = session.amount_total / 100; // Convert cents to dollars

    await env.DB.prepare(`
      INSERT INTO payment_history (
        id, user_id, stripe_payment_intent_id, amount, currency,
        payment_type, status, description, created_at
      ) VALUES (?, ?, ?, ?, ?, 'one_time', 'succeeded', 'One-time manuscript analysis', ?)
    `).bind(
      paymentId,
      userId,
      session.payment_intent,
      session.amount_total,
      session.currency,
      timestamp
    ).run();

    console.log('[Webhook] One-time payment recorded:', paymentId);

    // Log Stripe fee cost
    try {
      const stripeFee = calculateStripeFee(amountUSD);
      await logCost(env, {
        userId,
        costCenter: 'stripe_fees',
        featureName: 'payment_processing',
        operation: 'one_time_payment',
        costUSD: stripeFee,
        metadata: {
          paymentId,
          amountUSD,
          currency: session.currency,
        },
      });
    } catch (costError) {
      console.error('[Webhook] Failed to log Stripe fee:', costError);
    }
  }
}

/**
 * Handle subscription update event
 */
async function handleSubscriptionUpdate(env, subscription) {
  const timestamp = Math.floor(Date.now() / 1000);

  await env.DB.prepare(`
    UPDATE subscriptions
    SET status = ?,
        current_period_start = ?,
        current_period_end = ?,
        cancel_at_period_end = ?,
        updated_at = ?
    WHERE stripe_subscription_id = ?
  `).bind(
    subscription.status,
    subscription.current_period_start,
    subscription.current_period_end,
    subscription.cancel_at_period_end ? 1 : 0,
    timestamp,
    subscription.id
  ).run();

  console.log('[Webhook] Subscription updated:', subscription.id);
}

/**
 * Handle subscription deletion event
 */
async function handleSubscriptionDeleted(env, subscription) {
  const timestamp = Math.floor(Date.now() / 1000);

  // Mark subscription as canceled
  await env.DB.prepare(`
    UPDATE subscriptions
    SET status = 'canceled',
        updated_at = ?
    WHERE stripe_subscription_id = ?
  `).bind(timestamp, subscription.id).run();

  // Downgrade user to free tier
  const sub = await env.DB.prepare(`
    SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ?
  `).bind(subscription.id).first();

  if (sub) {
    await env.DB.prepare(`
      UPDATE users SET subscription_tier = 'free' WHERE id = ?
    `).bind(sub.user_id).run();
  }

  console.log('[Webhook] Subscription deleted:', subscription.id);
}

/**
 * Handle successful payment event
 */
async function handlePaymentSucceeded(env, invoice) {
  // Record payment in history
  const paymentId = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);

  // Find subscription
  const subscription = await env.DB.prepare(`
    SELECT id, user_id FROM subscriptions WHERE stripe_subscription_id = ?
  `).bind(invoice.subscription).first();

  if (subscription) {
    const amountUSD = invoice.amount_paid / 100; // Convert cents to dollars

    await env.DB.prepare(`
      INSERT INTO payment_history (
        id, user_id, subscription_id, stripe_invoice_id, amount, currency,
        payment_type, status, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'subscription', 'succeeded', ?, ?)
    `).bind(
      paymentId,
      subscription.user_id,
      subscription.id,
      invoice.id,
      invoice.amount_paid,
      invoice.currency,
      `Subscription payment - ${new Date(invoice.period_start * 1000).toLocaleDateString()}`,
      timestamp
    ).run();

    console.log('[Webhook] Payment succeeded:', paymentId);

    // Send payment confirmation email
    try {
      const user = await env.DB.prepare(
        'SELECT email, full_name FROM users WHERE id = ?'
      ).bind(subscription.user_id).first();

      if (user) {
        await sendPaymentConfirmationEmail({
          to: user.email,
          userName: user.full_name || 'Subscriber',
          amount: amountUSD,
          currency: invoice.currency.toUpperCase(),
          invoiceId: invoice.id,
          periodStart: new Date(invoice.period_start * 1000).toLocaleDateString(),
          periodEnd: new Date(invoice.period_end * 1000).toLocaleDateString(),
          env
        });
        console.log(`[Webhook] Payment confirmation email sent to ${user.email}`);
      }
    } catch (emailError) {
      console.error('[Webhook] Failed to send payment confirmation email:', emailError);
      // Don't fail the payment if email fails
    }

    // Log Stripe fee cost
    try {
      const stripeFee = calculateStripeFee(amountUSD);
      await logCost(env, {
        userId: subscription.user_id,
        costCenter: 'stripe_fees',
        featureName: 'payment_processing',
        operation: 'subscription_payment',
        costUSD: stripeFee,
        metadata: {
          paymentId,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          amountUSD,
          currency: invoice.currency,
        },
      });
    } catch (costError) {
      console.error('[Webhook] Failed to log Stripe fee:', costError);
    }
  }
}

/**
 * Handle failed payment event
 */
async function handlePaymentFailed(env, invoice) {
  // Record failed payment
  const paymentId = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);

  const subscription = await env.DB.prepare(`
    SELECT id, user_id FROM subscriptions WHERE stripe_subscription_id = ?
  `).bind(invoice.subscription).first();

  if (subscription) {
    await env.DB.prepare(`
      INSERT INTO payment_history (
        id, user_id, subscription_id, stripe_invoice_id, amount, currency,
        payment_type, status, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'subscription', 'failed', 'Payment failed', ?)
    `).bind(
      paymentId,
      subscription.user_id,
      subscription.id,
      invoice.id,
      invoice.amount_due,
      invoice.currency,
      timestamp
    ).run();

    // Update subscription status
    await env.DB.prepare(`
      UPDATE subscriptions SET status = 'past_due', updated_at = ? WHERE id = ?
    `).bind(timestamp, subscription.id).run();

    console.log('[Webhook] Payment failed:', invoice.id);

    // Send payment failed email (critical - always sent)
    try {
      const user = await env.DB.prepare(
        'SELECT email, full_name, subscription_tier FROM users WHERE id = ?'
      ).bind(subscription.user_id).first();

      if (user) {
        const amountUSD = invoice.amount_due / 100;
        await sendPaymentFailedEmail({
          to: user.email,
          userName: user.full_name || 'Subscriber',
          amount: amountUSD,
          currency: invoice.currency.toUpperCase(),
          failureReason: invoice.status_transitions?.finalized_at ? 'Card declined' : 'Payment processing error',
          retryDate: invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString() : 'N/A',
          planName: user.subscription_tier || 'Unknown',
          env
        });
        console.log(`[Webhook] Payment failed email sent to ${user.email}`);
      }
    } catch (emailError) {
      console.error('[Webhook] Failed to send payment failed email:', emailError);
      // Don't fail the webhook if email fails
    }
  }
}
