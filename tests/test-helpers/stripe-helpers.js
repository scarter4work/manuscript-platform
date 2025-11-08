/**
 * Stripe Test Helpers
 *
 * Utilities for testing Stripe webhooks and payment flows:
 * - HMAC-SHA256 signature generation (matches Stripe's algorithm)
 * - Webhook event factories
 * - Enhanced Stripe mock with signature verification
 */

import crypto from 'crypto';

/**
 * Generate Stripe webhook signature
 *
 * Matches Stripe's signature algorithm:
 * 1. Concatenate timestamp and raw JSON payload with "."
 * 2. Compute HMAC-SHA256 hash using webhook secret
 * 3. Format as: "t={timestamp},v1={signature}"
 *
 * @param {string|object} payload - Webhook payload (string or object to stringify)
 * @param {string} secret - Stripe webhook secret
 * @param {number} [timestamp] - Unix timestamp (defaults to current time)
 * @returns {string} Signature header value
 */
export function generateStripeSignature(payload, secret, timestamp = null) {
  // Convert payload to string if needed
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

  // Use provided timestamp or generate current time
  const ts = timestamp || Math.floor(Date.now() / 1000);

  // Stripe's signature algorithm: HMAC-SHA256(timestamp.payload, secret)
  const signedPayload = `${ts}.${payloadStr}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  // Format: "t={timestamp},v1={signature}"
  return `t=${ts},v1=${signature}`;
}

/**
 * Create Stripe webhook event payload
 *
 * @param {string} type - Event type (e.g., 'checkout.session.completed')
 * @param {object} data - Event data object
 * @param {object} [options] - Additional event properties
 * @returns {object} Webhook event object
 */
export function createStripeWebhookEvent(type, data, options = {}) {
  return {
    id: options.id || `evt_test_${crypto.randomBytes(12).toString('hex')}`,
    object: 'event',
    api_version: options.api_version || '2024-10-28.acacia',
    created: options.created || Math.floor(Date.now() / 1000),
    type,
    data: {
      object: data,
      previous_attributes: options.previous_attributes || undefined,
    },
    livemode: options.livemode || false,
    pending_webhooks: options.pending_webhooks || 1,
    request: options.request || null,
  };
}

/**
 * Create checkout.session.completed event
 *
 * @param {object} session - Checkout session data
 * @returns {object} Webhook event
 */
export function createCheckoutSessionCompletedEvent(session) {
  return createStripeWebhookEvent('checkout.session.completed', {
    id: session.id || `cs_test_${crypto.randomBytes(12).toString('hex')}`,
    object: 'checkout.session',
    amount_total: session.amount_total || 2999,
    currency: session.currency || 'usd',
    customer: session.customer || `cus_test_${crypto.randomBytes(8).toString('hex')}`,
    customer_email: session.customer_email || 'test@example.com',
    metadata: session.metadata || {},
    mode: session.mode || 'payment',
    payment_status: session.payment_status || 'paid',
    status: session.status || 'complete',
    subscription: session.subscription || null,
  });
}

/**
 * Create invoice.payment_failed event
 *
 * @param {object} invoice - Invoice data
 * @returns {object} Webhook event
 */
export function createInvoicePaymentFailedEvent(invoice) {
  return createStripeWebhookEvent('invoice.payment_failed', {
    id: invoice.id || `in_test_${crypto.randomBytes(12).toString('hex')}`,
    object: 'invoice',
    amount_due: invoice.amount_due || 2999,
    amount_paid: 0,
    currency: invoice.currency || 'usd',
    customer: invoice.customer || `cus_test_${crypto.randomBytes(8).toString('hex')}`,
    customer_email: invoice.customer_email || 'test@example.com',
    metadata: invoice.metadata || {},
    status: 'open',
    attempt_count: invoice.attempt_count || 1,
    billing_reason: invoice.billing_reason || 'subscription_cycle',
    subscription: invoice.subscription || `sub_test_${crypto.randomBytes(8).toString('hex')}`,
  });
}

/**
 * Create customer.subscription.deleted event
 *
 * @param {object} subscription - Subscription data
 * @returns {object} Webhook event
 */
export function createSubscriptionDeletedEvent(subscription) {
  return createStripeWebhookEvent('customer.subscription.deleted', {
    id: subscription.id || `sub_test_${crypto.randomBytes(8).toString('hex')}`,
    object: 'subscription',
    customer: subscription.customer || `cus_test_${crypto.randomBytes(8).toString('hex')}`,
    status: 'canceled',
    canceled_at: Math.floor(Date.now() / 1000),
    metadata: subscription.metadata || {},
    items: {
      object: 'list',
      data: subscription.items || [
        {
          id: `si_test_${crypto.randomBytes(8).toString('hex')}`,
          price: {
            id: subscription.priceId || 'price_test_pro',
            unit_amount: 2999,
            currency: 'usd',
          },
        },
      ],
    },
  });
}

/**
 * Enhanced Stripe mock with signature verification
 *
 * Extends the basic mockStripe() with real signature verification logic.
 * This mock will THROW errors for invalid signatures, just like Stripe's SDK.
 *
 * @param {object} [options] - Mock configuration
 * @param {string} [options.webhookSecret] - Webhook secret for signature verification
 * @returns {object} Stripe mock with signature verification
 */
export function mockStripeWithSignatureVerification(options = {}) {
  const webhookSecret = options.webhookSecret || 'whsec_test_secret';
  const sessions = new Map();
  const paymentIntents = new Map();
  const customers = new Map();

  return {
    checkout: {
      sessions: {
        async create(params) {
          const session = {
            id: `cs_test_${crypto.randomBytes(12).toString('hex')}`,
            object: 'checkout.session',
            url: `https://checkout.stripe.com/pay/${crypto.randomBytes(16).toString('hex')}`,
            mode: params.mode || 'payment',
            customer_email: params.customer_email,
            customer: params.customer,
            metadata: params.metadata || {},
            amount_total: params.line_items?.[0]?.amount || null,
            currency: params.currency || 'usd',
            payment_status: 'unpaid',
            status: 'open',
            subscription: params.mode === 'subscription' ? `sub_test_${crypto.randomBytes(8).toString('hex')}` : null,
          };
          sessions.set(session.id, session);
          return session;
        },
        async retrieve(sessionId) {
          const session = sessions.get(sessionId);
          if (!session) {
            throw new Error(`No such checkout session: ${sessionId}`);
          }
          return session;
        },
      },
    },

    paymentIntents: {
      async create(params) {
        const pi = {
          id: `pi_test_${crypto.randomBytes(12).toString('hex')}`,
          object: 'payment_intent',
          amount: params.amount,
          currency: params.currency || 'usd',
          status: 'requires_payment_method',
          metadata: params.metadata || {},
        };
        paymentIntents.set(pi.id, pi);
        return pi;
      },
      async retrieve(paymentIntentId) {
        const pi = paymentIntents.get(paymentIntentId);
        if (!pi) {
          throw new Error(`No such payment intent: ${paymentIntentId}`);
        }
        return pi;
      },
    },

    customers: {
      async create(params) {
        const customer = {
          id: `cus_test_${crypto.randomBytes(8).toString('hex')}`,
          object: 'customer',
          email: params.email,
          metadata: params.metadata || {},
        };
        customers.set(customer.id, customer);
        return customer;
      },
      async retrieve(customerId) {
        const customer = customers.get(customerId);
        if (!customer) {
          throw new Error(`No such customer: ${customerId}`);
        }
        return customer;
      },
    },

    webhooks: {
      /**
       * Construct webhook event from signature
       *
       * This matches Stripe's SDK behavior:
       * - Validates signature format
       * - Verifies HMAC-SHA256 signature
       * - Throws error for invalid signatures
       * - Checks timestamp freshness (5 min tolerance)
       *
       * @param {string} payload - Raw JSON payload string
       * @param {string} signature - Stripe-Signature header value
       * @param {string} secret - Webhook secret
       * @param {number} [tolerance] - Timestamp tolerance in seconds (default: 300)
       * @returns {object} Parsed webhook event
       * @throws {Error} If signature is invalid
       */
      constructEvent(payload, signature, secret, tolerance = 300) {
        // Validate inputs
        if (!payload || typeof payload !== 'string') {
          throw new Error('Webhook payload must be a string');
        }
        if (!signature || typeof signature !== 'string') {
          throw new Error('No signatures found matching the expected signature for payload');
        }
        if (!secret || typeof secret !== 'string') {
          throw new Error('Webhook secret must be provided');
        }

        // Parse signature header: "t={timestamp},v1={signature}"
        const signatureParts = signature.split(',').reduce((acc, part) => {
          const [key, value] = part.split('=');
          acc[key] = value;
          return acc;
        }, {});

        if (!signatureParts.t || !signatureParts.v1) {
          throw new Error('Unable to extract timestamp and signature from header');
        }

        const timestamp = parseInt(signatureParts.t, 10);
        const expectedSignature = signatureParts.v1;

        // Check timestamp freshness (prevent replay attacks)
        const currentTime = Math.floor(Date.now() / 1000);
        if (Math.abs(currentTime - timestamp) > tolerance) {
          throw new Error('Timestamp outside the tolerance zone');
        }

        // Compute expected signature
        const signedPayload = `${timestamp}.${payload}`;
        const computedSignature = crypto
          .createHmac('sha256', secret)
          .update(signedPayload, 'utf8')
          .digest('hex');

        // Constant-time comparison (prevent timing attacks)
        if (!crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(expectedSignature))) {
          throw new Error('No signatures found matching the expected signature for payload');
        }

        // Signature valid - parse and return event
        try {
          return JSON.parse(payload);
        } catch (err) {
          throw new Error('Invalid JSON payload');
        }
      },
    },

    // Helper methods for testing
    _helpers: {
      /**
       * Get the webhook secret used by this mock
       */
      getWebhookSecret() {
        return webhookSecret;
      },

      /**
       * Mark a session as completed (for testing webhook flows)
       */
      async completeSession(sessionId) {
        const session = sessions.get(sessionId);
        if (session) {
          session.payment_status = 'paid';
          session.status = 'complete';
        }
        return session;
      },

      /**
       * Clear all mock data
       */
      reset() {
        sessions.clear();
        paymentIntents.clear();
        customers.clear();
      },
    },
  };
}
