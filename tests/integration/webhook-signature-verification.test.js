/**
 * Webhook Signature Verification Tests
 *
 * CRITICAL SECURITY TESTS - These tests verify that the webhook endpoint
 * properly validates Stripe signatures to prevent unauthorized payment events.
 *
 * Attack vectors tested:
 * - Missing signature header
 * - Invalid HMAC signature
 * - Expired timestamps (replay attacks)
 * - Malformed signature format
 * - Wrong webhook secret
 * - Tampered payload
 *
 * Success criteria: ALL signature validation failures return 400 Bad Request
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import {
  generateStripeSignature,
  createStripeWebhookEvent,
  createCheckoutSessionCompletedEvent,
} from '../test-helpers/stripe-helpers.js';
import { handleStripeWebhook } from '../../src/handlers/webhook-handlers.js';
import { mockRedis } from '../test-helpers/mocks.js';

// Mock environment for testing
const TEST_WEBHOOK_SECRET = 'whsec_test_secret_for_signature_verification';
const TEST_STRIPE_SECRET = 'sk_test_mock_key';

/**
 * Helper to send webhook request with custom signature
 */
async function sendWebhook(app, payload, signature) {
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

  const headers = {
    'Content-Type': 'application/json',
  };

  if (signature !== null) {
    headers['stripe-signature'] = signature;
  }

  return request(app)
    .post('/webhooks/stripe')
    .set(headers)
    .send(payloadStr);
}

describe('Webhook Signature Verification', () => {
  let app;
  let mockEnv;
  let redis;

  beforeEach(async () => {
    // Set up Express app with webhook route
    app = express();

    // Create mock Redis
    redis = mockRedis();

    // Mock database adapter
    // We only need this for tests that pass signature verification
    const mockDatabase = {
      prepare: () => ({
        bind: () => ({
          run: async () => ({ success: true }),
          first: async () => null,
          all: async () => ({ results: [] }),
        }),
      }),
    };

    // Mock environment
    mockEnv = {
      STRIPE_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
      STRIPE_SECRET_KEY: TEST_STRIPE_SECRET,
      DB: mockDatabase, // Webhook handlers use env.DB
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
      REDIS: redis,
    };

    // IMPORTANT: Use text() parser, not json() parser
    // Webhooks need raw body for signature verification
    app.use(express.text({ type: 'application/json' }));

    // Register webhook route with actual handler
    app.post('/webhooks/stripe', async (req, res) => {
      try {
        // Convert Express request to Web API Request format
        const request = {
          text: async () => req.body, // Body is already text from parser
          headers: {
            get: (name) => req.get(name) || null,
          },
        };

        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
        };

        // Call actual webhook handler
        const response = await handleStripeWebhook(request, mockEnv, corsHeaders);

        // Convert Web API Response to Express response
        const body = await response.text();
        const responseData = body ? JSON.parse(body) : {};

        res.status(response.status).json(responseData);
      } catch (error) {
        console.error('Test webhook error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  });

  describe('Valid Signatures', () => {
    it('should accept webhook with valid signature', async () => {
      const event = createCheckoutSessionCompletedEvent({
        customer_email: 'test@example.com',
        metadata: { userId: 'user-123' },
      });

      const payload = JSON.stringify(event);
      const signature = generateStripeSignature(payload, TEST_WEBHOOK_SECRET);

      const response = await sendWebhook(app, payload, signature);

      expect(response.status).toBe(200);
    });

    it('should accept webhook with recent timestamp (within 5 min)', async () => {
      const event = createCheckoutSessionCompletedEvent({
        customer_email: 'test@example.com',
      });

      const payload = JSON.stringify(event);
      // Timestamp 4 minutes ago (within tolerance)
      const timestamp = Math.floor(Date.now() / 1000) - 240;
      const signature = generateStripeSignature(payload, TEST_WEBHOOK_SECRET, timestamp);

      const response = await sendWebhook(app, payload, signature);

      expect(response.status).toBe(200);
    });
  });

  describe('Missing Signature', () => {
    it('should reject webhook with no signature header', async () => {
      const event = createCheckoutSessionCompletedEvent({
        customer_email: 'test@example.com',
      });

      const payload = JSON.stringify(event);
      const response = await sendWebhook(app, payload, null); // No signature

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/signature/i);
    });

    it('should reject webhook with empty signature', async () => {
      const event = createCheckoutSessionCompletedEvent({
        customer_email: 'test@example.com',
      });

      const payload = JSON.stringify(event);
      const response = await sendWebhook(app, payload, ''); // Empty signature

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/signature/i);
    });
  });

  describe('Invalid Signatures', () => {
    it('should reject webhook with incorrect signature', async () => {
      const event = createCheckoutSessionCompletedEvent({
        customer_email: 'test@example.com',
      });

      const payload = JSON.stringify(event);
      // Generate signature with wrong secret
      const wrongSecret = 'whsec_wrong_secret';
      const signature = generateStripeSignature(payload, wrongSecret);

      const response = await sendWebhook(app, payload, signature);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/signature|invalid/i);
    });

    it('should reject webhook with malformed signature format', async () => {
      const event = createCheckoutSessionCompletedEvent({
        customer_email: 'test@example.com',
      });

      const payload = JSON.stringify(event);
      // Malformed signature (missing v1 part)
      const signature = 't=1234567890';

      const response = await sendWebhook(app, payload, signature);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/signature/i);
    });

    it('should reject webhook with tampered payload', async () => {
      const event = createCheckoutSessionCompletedEvent({
        customer_email: 'test@example.com',
        amount_total: 2999, // $29.99
      });

      // Generate valid signature for original payload
      const originalPayload = JSON.stringify(event);
      const signature = generateStripeSignature(originalPayload, TEST_WEBHOOK_SECRET);

      // Tamper with payload after signing (attacker trying to change amount)
      const tamperedEvent = { ...event };
      tamperedEvent.data.object.amount_total = 99; // Changed to $0.99
      const tamperedPayload = JSON.stringify(tamperedEvent);

      const response = await sendWebhook(app, tamperedPayload, signature);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/signature|invalid/i);
    });
  });

  describe('Replay Attack Prevention', () => {
    it('should reject webhook with expired timestamp (>5 min old)', async () => {
      const event = createCheckoutSessionCompletedEvent({
        customer_email: 'test@example.com',
      });

      const payload = JSON.stringify(event);
      // Timestamp 10 minutes ago (outside tolerance)
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 600;
      const signature = generateStripeSignature(payload, TEST_WEBHOOK_SECRET, expiredTimestamp);

      const response = await sendWebhook(app, payload, signature);

      expect(response.status).toBe(400);
      // Stripe SDK returns generic "Invalid signature" for timestamp issues
      expect(response.body.error).toMatch(/signature|invalid/i);
    });

    it('should accept webhook with future timestamp (Stripe allows clock skew)', async () => {
      const event = createCheckoutSessionCompletedEvent({
        customer_email: 'test@example.com',
      });

      const payload = JSON.stringify(event);
      // Timestamp 1 hour in the future
      // NOTE: Stripe SDK does NOT reject future timestamps, only expired ones
      // This is intentional - replay attacks use old webhooks, not future ones
      // Future timestamps can occur due to clock skew and aren't a security threat
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const signature = generateStripeSignature(payload, TEST_WEBHOOK_SECRET, futureTimestamp);

      const response = await sendWebhook(app, payload, signature);

      // Stripe accepts future timestamps (prevents false positives from clock skew)
      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });
  });
});
