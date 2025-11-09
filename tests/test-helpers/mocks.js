/**
 * Mock Factories for External Services
 *
 * Provides mock implementations of external services for testing:
 * - Backblaze B2 storage
 * - Redis cache
 * - Claude API
 * - Email service (Resend)
 * - Stripe payments
 */

import { vi } from 'vitest';
import crypto from 'crypto';

/**
 * Mock Backblaze B2 Storage Adapter
 *
 * Provides in-memory storage for testing file uploads/downloads
 */
export function mockStorageAdapter() {
  const storage = new Map();

  const mockBucket = {
    put: vi.fn(async ({ key, body }) => {
      storage.set(key, body);
      return {
        key,
        size: Buffer.isBuffer(body) ? body.length : Buffer.from(body).length,
        etag: crypto.randomBytes(16).toString('hex')
      };
    }),

    get: vi.fn(async ({ key }) => {
      const body = storage.get(key);
      if (!body) {
        const error = new Error('Not Found');
        error.statusCode = 404;
        throw error;
      }
      return {
        Body: body,
        ContentLength: Buffer.isBuffer(body) ? body.length : Buffer.from(body).length,
        ContentType: 'application/octet-stream'
      };
    }),

    delete: vi.fn(async ({ key }) => {
      const existed = storage.has(key);
      storage.delete(key);
      return { deleted: existed };
    }),

    list: vi.fn(async ({ prefix = '' }) => {
      const keys = Array.from(storage.keys())
        .filter(k => k.startsWith(prefix))
        .map(key => ({
          Key: key,
          Size: Buffer.isBuffer(storage.get(key))
            ? storage.get(key).length
            : Buffer.from(storage.get(key)).length,
          LastModified: new Date()
        }));

      return { Contents: keys };
    }),

    // Helper to inspect storage (not part of real API)
    _inspect: () => ({
      size: storage.size,
      keys: Array.from(storage.keys())
    }),

    // Helper to clear storage (not part of real API)
    _clear: () => storage.clear()
  };

  return {
    getBucket: vi.fn(() => mockBucket),
    _storage: storage
  };
}

/**
 * Mock Redis Client
 *
 * Provides in-memory key-value store for testing sessions and caching
 */
export function mockRedis() {
  const store = new Map();
  const expirations = new Map();

  const checkExpiration = (key) => {
    if (expirations.has(key) && Date.now() > expirations.get(key)) {
      store.delete(key);
      expirations.delete(key);
      return true;
    }
    return false;
  };

  return {
    get: vi.fn(async (key) => {
      if (checkExpiration(key)) return null;
      return store.get(key) || null;
    }),

    set: vi.fn(async (key, value) => {
      store.set(key, value);
      return 'OK';
    }),

    setEx: vi.fn(async (key, seconds, value) => {
      store.set(key, value);
      expirations.set(key, Date.now() + seconds * 1000);
      return 'OK';
    }),

    del: vi.fn(async (key) => {
      const existed = store.has(key);
      store.delete(key);
      expirations.delete(key);
      return existed ? 1 : 0;
    }),

    exists: vi.fn(async (key) => {
      if (checkExpiration(key)) return 0;
      return store.has(key) ? 1 : 0;
    }),

    expire: vi.fn(async (key, seconds) => {
      if (!store.has(key)) return 0;
      expirations.set(key, Date.now() + seconds * 1000);
      return 1;
    }),

    ttl: vi.fn(async (key) => {
      if (!store.has(key)) return -2;
      if (!expirations.has(key)) return -1;
      const remaining = Math.floor((expirations.get(key) - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    }),

    // Helper to inspect store (not part of real API)
    _inspect: () => ({
      size: store.size,
      keys: Array.from(store.keys())
    }),

    // Helper to clear store (not part of real API)
    _clear: () => {
      store.clear();
      expirations.clear();
    },

    // Public clear method for tests
    clear: () => {
      store.clear();
      expirations.clear();
    }
  };
}

/**
 * Mock Claude API Client
 *
 * Provides predictable AI responses for testing
 */
export function mockClaudeAPI(responses = {}) {
  const defaultResponse = {
    content: [{ text: 'This is a mock AI response for testing.' }],
    usage: { input_tokens: 100, output_tokens: 200 }
  };

  return {
    messages: {
      create: vi.fn(async ({ messages }) => {
        // Try to match a specific response based on prompt content
        const lastMessage = messages[messages.length - 1];
        const prompt = lastMessage.content;

        // Check for custom responses
        for (const [pattern, response] of Object.entries(responses)) {
          if (prompt.includes(pattern)) {
            return response;
          }
        }

        return defaultResponse;
      })
    }
  };
}

/**
 * Mock Email Service (Resend)
 *
 * Provides mock email sending for testing
 */
export function mockEmailService() {
  const sentEmails = [];

  return {
    sendEmail: vi.fn(async ({ to, subject, html }) => {
      sentEmails.push({ to, subject, html, sentAt: new Date() });
      return {
        id: `email_${crypto.randomBytes(8).toString('hex')}`,
        success: true
      };
    }),

    sendEmailVerification: vi.fn(async ({ userEmail, verificationToken }, env) => {
      sentEmails.push({
        to: userEmail,
        subject: 'Verify your email',
        type: 'email_verification',
        token: verificationToken,
        sentAt: new Date()
      });
      return { success: true };
    }),

    sendPasswordResetEmail: vi.fn(async ({ userEmail, resetToken }, env) => {
      sentEmails.push({
        to: userEmail,
        subject: 'Reset your password',
        type: 'password_reset',
        token: resetToken,
        sentAt: new Date()
      });
      return { success: true };
    }),

    sendPaymentConfirmationEmail: vi.fn(async ({ userEmail, planName, amount }, env) => {
      sentEmails.push({
        to: userEmail,
        subject: 'Payment confirmation',
        type: 'payment_confirmation',
        planName,
        amount,
        sentAt: new Date()
      });
      return { success: true };
    }),

    // Helper to inspect sent emails (not part of real API)
    _getSentEmails: () => sentEmails,

    // Helper to clear sent emails (not part of real API)
    _clearSentEmails: () => sentEmails.splice(0, sentEmails.length)
  };
}

/**
 * Mock Stripe Client
 *
 * Provides mock payment processing for testing
 */
export function mockStripe() {
  const customers = new Map();
  const sessions = new Map();
  const subscriptions = new Map();

  return {
    customers: {
      create: vi.fn(async ({ email, metadata }) => {
        const customerId = `cus_test_${crypto.randomBytes(8).toString('hex')}`;
        const customer = {
          id: customerId,
          email,
          metadata,
          created: Math.floor(Date.now() / 1000)
        };
        customers.set(customerId, customer);
        return customer;
      }),

      retrieve: vi.fn(async (customerId) => {
        const customer = customers.get(customerId);
        if (!customer) {
          const error = new Error('No such customer');
          error.statusCode = 404;
          throw error;
        }
        return customer;
      }),

      update: vi.fn(async (customerId, updates) => {
        const customer = customers.get(customerId);
        if (!customer) {
          const error = new Error('No such customer');
          error.statusCode = 404;
          throw error;
        }
        Object.assign(customer, updates);
        return customer;
      })
    },

    checkout: {
      sessions: {
        create: vi.fn(async ({ customer, line_items, mode, success_url, cancel_url, metadata }) => {
          const sessionId = `cs_test_${crypto.randomBytes(12).toString('hex')}`;
          const session = {
            id: sessionId,
            customer,
            line_items,
            mode,
            success_url,
            cancel_url,
            metadata,
            url: `https://checkout.stripe.com/test/${sessionId}`,
            status: 'open',
            payment_status: 'unpaid',
            created: Math.floor(Date.now() / 1000)
          };
          sessions.set(sessionId, session);
          return session;
        }),

        retrieve: vi.fn(async (sessionId) => {
          const session = sessions.get(sessionId);
          if (!session) {
            const error = new Error('No such checkout session');
            error.statusCode = 404;
            throw error;
          }
          return session;
        })
      }
    },

    subscriptions: {
      create: vi.fn(async ({ customer, items }) => {
        const subscriptionId = `sub_test_${crypto.randomBytes(8).toString('hex')}`;
        const subscription = {
          id: subscriptionId,
          customer,
          items,
          status: 'active',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 2592000, // +30 days
          created: Math.floor(Date.now() / 1000)
        };
        subscriptions.set(subscriptionId, subscription);
        return subscription;
      }),

      retrieve: vi.fn(async (subscriptionId) => {
        const subscription = subscriptions.get(subscriptionId);
        if (!subscription) {
          const error = new Error('No such subscription');
          error.statusCode = 404;
          throw error;
        }
        return subscription;
      }),

      update: vi.fn(async (subscriptionId, updates) => {
        const subscription = subscriptions.get(subscriptionId);
        if (!subscription) {
          const error = new Error('No such subscription');
          error.statusCode = 404;
          throw error;
        }
        Object.assign(subscription, updates);
        return subscription;
      }),

      cancel: vi.fn(async (subscriptionId) => {
        const subscription = subscriptions.get(subscriptionId);
        if (!subscription) {
          const error = new Error('No such subscription');
          error.statusCode = 404;
          throw error;
        }
        subscription.status = 'canceled';
        subscription.canceled_at = Math.floor(Date.now() / 1000);
        return subscription;
      })
    },

    webhooks: {
      constructEvent: vi.fn((body, signature, secret) => {
        // Validate signature format
        if (!signature || !signature.includes('t=') || !signature.includes('v1=')) {
          const error = new Error('Invalid signature');
          error.statusCode = 400;
          throw error;
        }

        // Parse body as JSON
        const event = typeof body === 'string' ? JSON.parse(body) : body;

        // Ensure event has required fields
        if (!event.type) {
          const error = new Error('Invalid event');
          error.statusCode = 400;
          throw error;
        }

        return event;
      })
    },

    // Helpers to inspect state (not part of real API)
    _getCustomers: () => Array.from(customers.values()),
    _getSessions: () => Array.from(sessions.values()),
    _getSubscriptions: () => Array.from(subscriptions.values()),
    _clear: () => {
      customers.clear();
      sessions.clear();
      subscriptions.clear();
    }
  };
}

/**
 * Generate a valid Stripe webhook signature for testing
 *
 * @param {string|object} payload - Webhook payload
 * @param {string} secret - Webhook secret
 * @returns {string} Stripe signature header value
 */
export function generateStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signedPayload = `${timestamp}.${payloadString}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
}

/**
 * Create a mock Stripe webhook event
 *
 * @param {string} type - Event type (e.g., 'checkout.session.completed')
 * @param {object} data - Event data
 * @returns {object} Webhook event object
 */
export function createStripeWebhookEvent(type, data) {
  return {
    id: `evt_${crypto.randomBytes(12).toString('hex')}`,
    object: 'event',
    type,
    data: {
      object: {
        id: data.id || `obj_${crypto.randomBytes(12).toString('hex')}`,
        ...data
      }
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false
  };
}
