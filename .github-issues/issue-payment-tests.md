# 🧪🔒 CRITICAL: Test Coverage for Payment & Webhook Handlers

## Priority: CRITICAL (Security + Revenue)
**Impact**: Unsigned webhooks could trigger unauthorized charges
**Effort**: 16-20 hours
**Risk**: Financial loss, fraud, payment state corruption

## Problem

Payment handlers have **ZERO test coverage** despite handling:
1. Stripe checkout sessions (revenue)
2. Webhook signature verification (security-critical)
3. Payment state transitions (database integrity)
4. Subscription management (recurring revenue)
5. Usage tracking (billing)

**Files with 0% Coverage**:
- `src/handlers/payment-handlers.js` (600+ lines, 8 endpoints)
- `routes/payments.js` (webhook endpoint)

## Critical Untested Paths

### 1. Webhook Signature Verification

**Code**: `routes/payments.js:86-100`

```javascript
// PUBLIC ENDPOINT - Security depends on signature verification
const signature = request.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
```

**Risk**: If signature verification fails silently, attackers could send fake webhooks:
- Upgrade accounts without payment
- Mark unpaid invoices as paid
- Trigger refunds
- Cancel subscriptions

**Required Tests**:
```javascript
it('should reject webhook with invalid signature', async () => {
  const response = await apiClient.post('/webhooks/stripe')
    .set('stripe-signature', 'invalid_signature')
    .send({ type: 'checkout.session.completed' });

  expect(response.status).toBe(400);
  expect(response.body.error).toMatch(/Invalid signature/i);
});

it('should reject webhook with missing signature', async () => {
  const response = await apiClient.post('/webhooks/stripe')
    .send({ type: 'checkout.session.completed' });

  expect(response.status).toBe(400);
});

it('should accept webhook with valid signature', async () => {
  const payload = JSON.stringify({ type: 'checkout.session.completed' });
  const signature = generateStripeSignature(payload, STRIPE_WEBHOOK_SECRET);

  const response = await apiClient.post('/webhooks/stripe')
    .set('stripe-signature', signature)
    .send(payload);

  expect(response.status).toBe(200);
});
```

### 2. Checkout Session Creation

**Code**: `src/handlers/payment-handlers.js:50-120`

```javascript
const session = await stripe.checkout.sessions.create({
  customer: stripeCustomerId,
  line_items: [{ price: priceId, quantity: 1 }],
  mode: 'subscription',
  // ...
});
```

**Required Tests**:
```javascript
it('should create checkout session for valid subscription', async () => {
  const { sessionCookie } = await createAuthenticatedUser('test@example.com', 'TestPass123!');

  const response = await apiClient.post('/create-checkout-session')
    .set('Cookie', sessionCookie)
    .send({ priceId: 'price_freelancer_monthly' });

  expect(response.status).toBe(200);
  expect(response.body.sessionId).toBeDefined();
  expect(response.body.url).toMatch(/https:\/\/checkout\.stripe\.com/);

  // Verify Stripe API was called correctly
  expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
    expect.objectContaining({
      mode: 'subscription',
      line_items: expect.arrayContaining([
        expect.objectContaining({ price: 'price_freelancer_monthly' })
      ])
    })
  );
});

it('should require authentication for checkout', async () => {
  const response = await apiClient.post('/create-checkout-session')
    .send({ priceId: 'price_freelancer_monthly' });

  expect(response.status).toBe(401);
});

it('should reject invalid price IDs', async () => {
  const { sessionCookie } = await createAuthenticatedUser('test@example.com', 'TestPass123!');

  const response = await apiClient.post('/create-checkout-session')
    .set('Cookie', sessionCookie)
    .send({ priceId: 'invalid_price' });

  expect(response.status).toBe(400);
});
```

### 3. Webhook Event Handling

**Critical Events**:
- `checkout.session.completed` - Activate subscription
- `customer.subscription.deleted` - Cancel subscription
- `invoice.payment_failed` - Handle failed payment
- `invoice.payment_succeeded` - Record payment

**Required Tests**:
```javascript
describe('checkout.session.completed webhook', () => {
  it('should activate subscription and update database', async () => {
    const user = await createTestUser({ email: 'webhook-test@example.com' });
    const event = createStripeWebhookEvent('checkout.session.completed', {
      customer: user.stripe_customer_id,
      subscription: 'sub_123',
      metadata: { userId: user.id, priceId: 'price_freelancer_monthly' }
    });

    await handleStripeWebhook(event, env);

    // Verify subscription updated
    const subscription = await testDb.query('SELECT * FROM subscriptions WHERE user_id = $1', [user.id]);
    expect(subscription.rows[0].plan).toBe('freelancer');
    expect(subscription.rows[0].status).toBe('active');
    expect(subscription.rows[0].stripe_subscription_id).toBe('sub_123');

    // Verify payment recorded
    const payment = await testDb.query('SELECT * FROM payment_history WHERE user_id = $1', [user.id]);
    expect(payment.rows[0].status).toBe('succeeded');
  });

  it('should send confirmation email', async () => {
    const mockEmail = vi.spyOn(emailService, 'sendPaymentConfirmationEmail');
    // ... webhook handling ...

    expect(mockEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: 'webhook-test@example.com',
        planName: 'Freelancer',
        amount: 29.99
      }),
      expect.any(Object)
    );
  });
});

describe('invoice.payment_failed webhook', () => {
  it('should mark subscription as past_due', async () => {
    // ... test implementation ...
  });

  it('should send payment failed email', async () => {
    // ... test implementation ...
  });

  it('should cancel subscription after 3 failures', async () => {
    // ... test implementation ...
  });
});

describe('customer.subscription.deleted webhook', () => {
  it('should downgrade to free plan', async () => {
    // ... test implementation ...
  });

  it('should preserve data but restrict access', async () => {
    // ... test implementation ...
  });
});
```

### 4. Usage Tracking

**Code**: `src/handlers/payment-handlers.js:250-300`

```javascript
async function trackUsage(userId, manuscriptId, usageType, env) {
  // Update usage counters
  // Check limits
  // Send warnings
}
```

**Required Tests**:
```javascript
it('should track manuscript analysis usage', async () => {
  const user = await createTestUser({ plan: 'freelancer' });
  await trackUsage(user.id, 'manuscript-123', 'analysis', env);

  const usage = await testDb.query('SELECT * FROM usage_tracking WHERE user_id = $1', [user.id]);
  expect(usage.rows[0].manuscripts_analyzed).toBe(1);
});

it('should send warning at 80% usage', async () => {
  const user = await createTestUser({ plan: 'freelancer' }); // 10 manuscripts/month
  const mockEmail = vi.spyOn(emailService, 'sendUsageWarningEmail');

  // Use 8 manuscripts (80%)
  for (let i = 0; i < 8; i++) {
    await trackUsage(user.id, `manuscript-${i}`, 'analysis', env);
  }

  expect(mockEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      manuscriptsUsed: 8,
      manuscriptsLimit: 10,
      percentageUsed: 80
    }),
    expect.any(Object)
  );
});

it('should block usage when limit reached', async () => {
  const user = await createTestUser({ plan: 'freelancer' });

  // Use all 10 manuscripts
  for (let i = 0; i < 10; i++) {
    await trackUsage(user.id, `manuscript-${i}`, 'analysis', env);
  }

  // 11th should be blocked
  const canAnalyze = await checkUsageLimit(user.id, 'analysis', env);
  expect(canAnalyze).toBe(false);
});
```

## Test Data Helpers

```javascript
// tests/test-helpers/stripe-helpers.js
import crypto from 'crypto';

export function generateStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
}

export function createStripeWebhookEvent(type, data) {
  return {
    id: `evt_${crypto.randomBytes(12).toString('hex')}`,
    object: 'event',
    type: type,
    data: {
      object: {
        id: `obj_${crypto.randomBytes(12).toString('hex')}`,
        ...data
      }
    },
    created: Math.floor(Date.now() / 1000)
  };
}

export function mockStripeAPI() {
  return {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/test',
          customer: 'cus_test',
          mode: 'subscription'
        })
      }
    },
    customers: {
      create: vi.fn().mockResolvedValue({
        id: 'cus_test_new',
        email: 'test@example.com'
      }),
      retrieve: vi.fn().mockResolvedValue({
        id: 'cus_test',
        email: 'test@example.com'
      })
    },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({
        id: 'sub_test',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 2592000
      })
    },
    webhooks: {
      constructEvent: vi.fn((body, sig, secret) => {
        // Verify signature format
        if (!sig || !sig.includes('t=') || !sig.includes('v1=')) {
          throw new Error('Invalid signature');
        }
        return JSON.parse(body);
      })
    }
  };
}
```

## Required Test Cases (60+)

### Checkout Session (10 tests)
- [ ] Create session with valid priceId
- [ ] Require authentication
- [ ] Reject invalid priceId
- [ ] Include metadata (userId, priceId)
- [ ] Set correct success/cancel URLs
- [ ] Create Stripe customer if missing
- [ ] Link existing Stripe customer
- [ ] Handle Stripe API errors
- [ ] Set trial period for annual plans
- [ ] Apply discount codes

### Webhook Signature (8 tests)
- [ ] Accept valid signature
- [ ] Reject invalid signature
- [ ] Reject missing signature
- [ ] Reject expired signature (>5 minutes old)
- [ ] Reject replay attacks (duplicate event ID)
- [ ] Handle malformed signature header
- [ ] Log signature verification failures
- [ ] Return 400 for invalid signatures

### Webhook Events (25 tests)
- [ ] `checkout.session.completed` - Activate subscription
- [ ] `checkout.session.completed` - Record payment
- [ ] `checkout.session.completed` - Send confirmation email
- [ ] `checkout.session.completed` - Update Stripe customer ID
- [ ] `customer.subscription.updated` - Sync status
- [ ] `customer.subscription.deleted` - Downgrade to free
- [ ] `customer.subscription.deleted` - Preserve data
- [ ] `invoice.payment_succeeded` - Record payment
- [ ] `invoice.payment_succeeded` - Extend billing period
- [ ] `invoice.payment_failed` - Mark past_due
- [ ] `invoice.payment_failed` - Send alert email
- [ ] `invoice.payment_failed` - Cancel after 3 failures
- [ ] `customer.subscription.trial_will_end` - Send reminder
- [ ] `charge.refunded` - Record refund
- [ ] `charge.refunded` - Update subscription status
- [ ] Ignore unhandled event types
- [ ] Handle duplicate webhook deliveries (idempotency)
- [ ] Handle out-of-order webhook delivery
- [ ] Handle webhook for deleted user
- [ ] Handle webhook for non-existent subscription
- [ ] Handle malformed webhook data
- [ ] Log all webhook events
- [ ] Return 200 for all webhooks (even errors)
- [ ] Retry failed webhook processing
- [ ] Webhook processing under 5 seconds

### Usage Tracking (10 tests)
- [ ] Track manuscript analysis
- [ ] Track asset generation
- [ ] Track marketing content
- [ ] Check usage limits
- [ ] Block when limit reached
- [ ] Send warning at 80%
- [ ] Send alert at 100%
- [ ] Reset usage on billing cycle
- [ ] Handle free plan limits
- [ ] Handle enterprise unlimited

### Subscription Management (7 tests)
- [ ] Get current subscription
- [ ] Get billing history
- [ ] Cancel subscription
- [ ] Update payment method
- [ ] Apply promo codes
- [ ] Handle subscription paused
- [ ] Handle subscription resumed

## Files to Create/Modify

1. `tests/integration/handlers/payment-handlers.test.js` (NEW, 1000+ lines)
2. `tests/integration/routes/payments.test.js` (NEW, 300+ lines)
3. `tests/test-helpers/stripe-helpers.js` (NEW, 200+ lines)
4. `tests/fixtures/stripe-events.json` (NEW, sample webhook payloads)

## Acceptance Criteria

- [ ] 60+ test cases covering all payment scenarios
- [ ] 80%+ branch coverage on payment-handlers.js
- [ ] 100% coverage on webhook signature verification
- [ ] All webhook event types tested
- [ ] Usage tracking fully tested
- [ ] Mock Stripe API for all tests (no real API calls)
- [ ] Tests run in <15 seconds
- [ ] Idempotency tests (duplicate webhooks)
- [ ] Race condition tests (concurrent webhooks)
- [ ] Error handling tests (Stripe API failures)

## Priority Justification

This is **CRITICAL** because:
1. Webhook signature bypass = free subscriptions for attackers
2. Payment state corruption = revenue loss
3. Untested webhooks = financial liability
4. Usage tracking bugs = billing disputes
5. Failed payments not handled = churned customers

## Related Issues

- Requires: #66 (Test Infrastructure Setup)
- Part of: 100% branch coverage goal
- Security-critical: Webhook vulnerabilities

## References

- Payment handlers: `src/handlers/payment-handlers.js`
- Webhook endpoint: `routes/payments.js`
- Stripe docs: https://stripe.com/docs/webhooks/test