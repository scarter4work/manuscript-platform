# Payment & Subscription System (MAN-8)

## Overview

The Manuscript Platform uses **Stripe** for payment processing and subscription management. The system supports both **subscription-based** and **one-time payment** models, providing flexible pricing options for indie authors at different stages of their publishing journey.

---

## Pricing Tiers

### Subscription Plans

| Plan | Monthly Price | Manuscripts/Month | Storage Duration | Key Features |
|------|---------------|-------------------|------------------|--------------|
| **Free** | $0 | 1 | 30 days | Basic analysis, limited features |
| **Pro** | $29/month | 10 | 1 year | Full analysis, asset generation, priority support |
| **Enterprise** | $99/month | Unlimited | Unlimited | Team features (5 members), API access, custom branding |

### One-Time Purchase

| Product | Price | Features |
|---------|-------|----------|
| **One-Time Analysis** | $10 | Full analysis + assets, 90 days storage |

**Use Case**: Authors who need occasional manuscript analysis without committing to a monthly subscription.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER ACTIONS                             │
│  - Select subscription plan (Pro/Enterprise)                    │
│  - Enter payment details                                        │
│  - Manage subscription (upgrade/downgrade/cancel)               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE WORKER API                         │
│  POST /payments/create-checkout-session                         │
│  POST /payments/create-payment-intent                           │
│  POST /payments/create-portal-session                           │
│  GET  /payments/subscription                                    │
│  GET  /payments/history                                         │
│  GET  /payments/can-upload                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       STRIPE API                                │
│  - Create checkout session (subscription)                       │
│  - Create payment intent (one-time)                             │
│  - Create billing portal session                                │
│  - Manage subscriptions (CRUD)                                  │
│  - Send webhooks to notify of events                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    STRIPE WEBHOOKS                              │
│  POST /webhooks/stripe (public endpoint)                        │
│  - checkout.session.completed                                   │
│  - customer.subscription.created/updated/deleted                │
│  - invoice.payment_succeeded/failed                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE UPDATES                             │
│  - subscriptions table (plan, status, period)                   │
│  - payment_history table (transaction records)                  │
│  - usage_tracking table (manuscript uploads)                    │
│  - users table (subscription_tier)                              │
│  - cost_tracking table (Stripe fees)                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    USAGE ENFORCEMENT                            │
│  - Check monthly limit before manuscript upload                 │
│  - Track usage per billing period                               │
│  - Display upgrade prompts when limit reached                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### 1. Subscriptions Table

Tracks active and historical subscriptions for users.

```sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT NOT NULL,                  -- Foreign key to users
  stripe_subscription_id TEXT UNIQUE,     -- Stripe subscription ID
  stripe_customer_id TEXT NOT NULL,       -- Stripe customer ID
  plan_type TEXT NOT NULL,                -- free/pro/enterprise
  status TEXT NOT NULL,                   -- active/canceled/past_due/incomplete
  current_period_start INTEGER NOT NULL,  -- Unix timestamp
  current_period_end INTEGER NOT NULL,    -- Unix timestamp
  cancel_at_period_end INTEGER DEFAULT 0, -- Boolean: 0=will renew, 1=will cancel
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Indexes**:
- `idx_subscriptions_user`: Fast lookup by user_id
- `idx_subscriptions_stripe_customer`: Stripe customer queries
- `idx_subscriptions_status`: Filter by subscription status

**Status Values**:
- `active`: Subscription is active and in good standing
- `past_due`: Payment failed, retry in progress
- `canceled`: Subscription was canceled
- `incomplete`: Initial payment not yet completed

---

### 2. Payment History Table

Records all payments (subscriptions and one-time purchases).

```sql
CREATE TABLE payment_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_id TEXT,                   -- Null for one-time payments
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,                 -- For subscriptions
  amount INTEGER NOT NULL,                -- Amount in cents
  currency TEXT DEFAULT 'usd',
  payment_type TEXT NOT NULL,             -- subscription/one_time
  status TEXT NOT NULL,                   -- succeeded/pending/failed/refunded
  description TEXT,
  metadata TEXT,                          -- JSON: additional details
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);
```

**Indexes**:
- `idx_payment_history_user`: User's payment history
- `idx_payment_history_created`: Sort by date
- `idx_payment_history_status`: Filter by status

---

### 3. Usage Tracking Table

Tracks manuscript uploads for billing limit enforcement.

```sql
CREATE TABLE usage_tracking (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_id TEXT,
  manuscript_id TEXT NOT NULL,
  analysis_type TEXT NOT NULL,            -- full/basic
  assets_generated INTEGER DEFAULT 0,     -- Boolean
  credits_used INTEGER DEFAULT 1,
  timestamp INTEGER NOT NULL,
  billing_period_start INTEGER NOT NULL,
  billing_period_end INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);
```

**Indexes**:
- `idx_usage_tracking_user`: User's usage history
- `idx_usage_tracking_period`: Query by billing period
- `idx_usage_tracking_timestamp`: Sort by date

---

### 4. View: User Subscriptions with Usage

Optimized view for checking limits and displaying billing info.

```sql
CREATE VIEW user_subscriptions_with_usage AS
SELECT
  u.id as user_id,
  u.email,
  u.subscription_tier,
  s.id as subscription_id,
  s.stripe_subscription_id,
  s.plan_type,
  s.status as subscription_status,
  s.current_period_start,
  s.current_period_end,
  COUNT(ut.id) as manuscripts_this_period,
  CASE
    WHEN s.plan_type = 'free' THEN 1
    WHEN s.plan_type = 'pro' THEN 10
    WHEN s.plan_type = 'enterprise' THEN 999999
  END as monthly_limit
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
LEFT JOIN usage_tracking ut ON u.id = ut.user_id
  AND ut.billing_period_start = s.current_period_start
GROUP BY u.id, s.id;
```

**Usage**:
```javascript
const subscription = await env.DB.prepare(`
  SELECT * FROM user_subscriptions_with_usage WHERE user_id = ?
`).bind(userId).first();

const canUpload = subscription.manuscripts_this_period < subscription.monthly_limit;
```

---

## API Endpoints

### 1. Create Checkout Session (Subscriptions)

**Endpoint**: `POST /payments/create-checkout-session`

**Authentication**: Required

**Request Body**:
```json
{
  "plan": "pro"  // or "enterprise"
}
```

**Response**:
```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

**Flow**:
1. User selects plan (Pro or Enterprise)
2. Worker creates Stripe customer (if doesn't exist)
3. Worker creates Stripe checkout session
4. User redirected to Stripe-hosted checkout page
5. After payment, user redirected to success URL
6. Stripe webhook updates database

**Implementation** (`payment-handlers.js:52`):
```javascript
export async function createCheckoutSession(request, env, corsHeaders) {
  const userId = await getUserFromRequest(request, env);
  const { plan } = await request.json();

  const stripe = getStripeClient(env);
  const pricing = PRICING[plan];

  // Get or create Stripe customer
  const stripeCustomerId = await getOrCreateCustomer(userId, env, stripe);

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{
      price: pricing.priceId,
      quantity: 1
    }],
    success_url: `${env.FRONTEND_URL}/billing?success=true`,
    cancel_url: `${env.FRONTEND_URL}/pricing?canceled=true`,
    metadata: { userId, planType: plan }
  });

  return Response.json({ success: true, url: session.url });
}
```

---

### 2. Create Payment Intent (One-Time)

**Endpoint**: `POST /payments/create-payment-intent`

**Authentication**: Required

**Request Body**:
```json
{
  "manuscriptId": "uuid-of-manuscript"
}
```

**Response**:
```json
{
  "success": true,
  "clientSecret": "pi_..._secret_...",
  "amount": 1000  // $10.00 in cents
}
```

**Flow**:
1. User requests one-time analysis
2. Worker creates Stripe PaymentIntent
3. Frontend uses Stripe.js with client secret
4. User enters card details on frontend (Stripe Elements)
5. Payment processed client-side
6. Stripe webhook confirms payment
7. Worker grants access to analysis

**Implementation** (`payment-handlers.js:149`):
```javascript
export async function createPaymentIntent(request, env, corsHeaders) {
  const userId = await getUserFromRequest(request, env);
  const { manuscriptId } = await request.json();

  const stripe = getStripeClient(env);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: PRICING.oneTime.price, // 1000 cents = $10
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: { userId, manuscriptId, type: 'one_time_analysis' }
  });

  return Response.json({
    success: true,
    clientSecret: paymentIntent.client_secret
  });
}
```

---

### 3. Create Customer Portal Session

**Endpoint**: `POST /payments/create-portal-session`

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "url": "https://billing.stripe.com/session/..."
}
```

**Purpose**: Allow users to self-manage their subscription:
- Update payment method
- Upgrade/downgrade plan
- Cancel subscription
- View billing history
- Download invoices

**Flow**:
1. User clicks "Manage Billing" in dashboard
2. Worker creates Stripe billing portal session
3. User redirected to Stripe-hosted portal
4. User makes changes (update card, cancel, etc.)
5. Stripe webhooks notify changes
6. Worker updates database

**Implementation** (`payment-handlers.js:212`):
```javascript
export async function createPortalSession(request, env, corsHeaders) {
  const userId = await getUserFromRequest(request, env);

  const subscription = await env.DB.prepare(`
    SELECT stripe_customer_id FROM subscriptions
    WHERE user_id = ? AND status = 'active'
  `).bind(userId).first();

  const stripe = getStripeClient(env);

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${env.FRONTEND_URL}/billing`
  });

  return Response.json({ success: true, url: session.url });
}
```

---

### 4. Get Subscription Details

**Endpoint**: `GET /payments/subscription`

**Authentication**: Required

**Response**:
```json
{
  "planType": "pro",
  "status": "active",
  "manuscriptsThisPeriod": 3,
  "monthlyLimit": 10,
  "periodStart": 1698969600000,
  "periodEnd": 1701561600000,
  "cancelAtPeriodEnd": false
}
```

**Usage**: Display current plan and usage in dashboard

**Implementation** (`payment-handlers.js:269`):
```javascript
export async function getSubscription(request, env, corsHeaders) {
  const userId = await getUserFromRequest(request, env);

  const subscription = await env.DB.prepare(`
    SELECT * FROM user_subscriptions_with_usage WHERE user_id = ?
  `).bind(userId).first();

  return Response.json({
    planType: subscription.plan_type,
    status: subscription.subscription_status,
    manuscriptsThisPeriod: subscription.manuscripts_this_period,
    monthlyLimit: subscription.monthly_limit,
    periodStart: subscription.current_period_start * 1000,
    periodEnd: subscription.current_period_end * 1000
  });
}
```

---

### 5. Get Payment History

**Endpoint**: `GET /payments/history`

**Authentication**: Required

**Response**:
```json
{
  "payments": [
    {
      "id": "pay_...",
      "amount": 29.00,
      "currency": "usd",
      "payment_type": "subscription",
      "status": "succeeded",
      "description": "Subscription payment - 10/28/2025",
      "createdAt": 1698969600000
    }
  ]
}
```

**Usage**: Display billing history in user dashboard

**Implementation** (`payment-handlers.js:327`):
```javascript
export async function getPaymentHistory(request, env, corsHeaders) {
  const userId = await getUserFromRequest(request, env);

  const payments = await env.DB.prepare(`
    SELECT * FROM payment_history
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(userId).all();

  return Response.json({
    payments: payments.results.map(p => ({
      ...p,
      amount: p.amount / 100  // Convert cents to dollars
    }))
  });
}
```

---

### 6. Check Upload Permission

**Endpoint**: `GET /payments/can-upload`

**Authentication**: Required

**Response**:
```json
{
  "canUpload": true,
  "planType": "pro",
  "manuscriptsUsed": 3,
  "monthlyLimit": 10,
  "upgradeRequired": false
}
```

**Usage**: Pre-flight check before manuscript upload

**Flow**:
```
User clicks "Upload Manuscript"
  ↓
Frontend calls GET /payments/can-upload
  ↓
Response: canUpload = true/false
  ↓
IF TRUE: Show upload form
IF FALSE: Show upgrade prompt
```

**Implementation** (`payment-handlers.js:374`):
```javascript
export async function checkCanUpload(request, env, corsHeaders) {
  const userId = await getUserFromRequest(request, env);

  const subscription = await env.DB.prepare(`
    SELECT * FROM user_subscriptions_with_usage WHERE user_id = ?
  `).bind(userId).first();

  const canUpload = subscription.manuscripts_this_period < subscription.monthly_limit;

  return Response.json({
    canUpload,
    planType: subscription.plan_type,
    manuscriptsUsed: subscription.manuscripts_this_period,
    monthlyLimit: subscription.monthly_limit,
    upgradeRequired: !canUpload
  });
}
```

---

## Stripe Webhooks

### Webhook Endpoint

**URL**: `POST /webhooks/stripe`

**Authentication**: Stripe signature verification (HMAC)

**Purpose**: Receive real-time notifications from Stripe about subscription and payment events.

**Security**:
- Webhook signature verified using `STRIPE_WEBHOOK_SECRET`
- Invalid signatures rejected with 400 error
- Prevents replay attacks and unauthorized requests

### Supported Events

#### 1. checkout.session.completed

**Triggered**: When user completes checkout (subscription or one-time payment)

**Handler** (`webhook-handlers.js:104`):
```javascript
async function handleCheckoutCompleted(env, session) {
  const userId = session.metadata.userId;
  const planType = session.metadata.planType;

  if (session.mode === 'subscription') {
    // Create subscription record
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const subscription = await stripe.subscriptions.retrieve(session.subscription);

    await env.DB.prepare(`
      INSERT INTO subscriptions (
        id, user_id, stripe_subscription_id, plan_type, status,
        current_period_start, current_period_end, ...
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ...)
    `).bind(...).run();

    // Update user's tier
    await env.DB.prepare(`
      UPDATE users SET subscription_tier = ? WHERE id = ?
    `).bind(planType, userId).run();

  } else if (session.mode === 'payment') {
    // Record one-time payment
    await env.DB.prepare(`
      INSERT INTO payment_history (...)
      VALUES (...)
    `).bind(...).run();
  }
}
```

**Actions**:
- Create subscription record in database
- Update user's subscription tier
- Record payment in payment_history

---

#### 2. customer.subscription.updated

**Triggered**: When subscription is modified (plan change, renewal, etc.)

**Handler** (`webhook-handlers.js:201`):
```javascript
async function handleSubscriptionUpdate(env, subscription) {
  await env.DB.prepare(`
    UPDATE subscriptions
    SET status = ?,
        current_period_start = ?,
        current_period_end = ?,
        cancel_at_period_end = ?
    WHERE stripe_subscription_id = ?
  `).bind(
    subscription.status,
    subscription.current_period_start,
    subscription.current_period_end,
    subscription.cancel_at_period_end ? 1 : 0,
    subscription.id
  ).run();
}
```

**Actions**:
- Update subscription status
- Update billing period dates
- Update cancellation status

---

#### 3. customer.subscription.deleted

**Triggered**: When subscription is canceled and period ends

**Handler** (`webhook-handlers.js:227`):
```javascript
async function handleSubscriptionDeleted(env, subscription) {
  // Mark subscription as canceled
  await env.DB.prepare(`
    UPDATE subscriptions SET status = 'canceled' WHERE stripe_subscription_id = ?
  `).bind(subscription.id).run();

  // Downgrade user to free tier
  const sub = await env.DB.prepare(`
    SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ?
  `).bind(subscription.id).first();

  if (sub) {
    await env.DB.prepare(`
      UPDATE users SET subscription_tier = 'free' WHERE id = ?
    `).bind(sub.user_id).run();
  }
}
```

**Actions**:
- Mark subscription as canceled
- Downgrade user to free tier

---

#### 4. invoice.payment_succeeded

**Triggered**: When recurring subscription payment succeeds

**Handler** (`webhook-handlers.js:255`):
```javascript
async function handlePaymentSucceeded(env, invoice) {
  const subscription = await env.DB.prepare(`
    SELECT id, user_id FROM subscriptions WHERE stripe_subscription_id = ?
  `).bind(invoice.subscription).first();

  // Record payment
  await env.DB.prepare(`
    INSERT INTO payment_history (
      id, user_id, subscription_id, amount, status, description, ...
    ) VALUES (?, ?, ?, ?, 'succeeded', ?, ...)
  `).bind(...).run();

  // Log Stripe fee cost
  const stripeFee = calculateStripeFee(invoice.amount_paid / 100);
  await logCost(env, {
    userId: subscription.user_id,
    costCenter: 'stripe_fees',
    costUSD: stripeFee
  });
}
```

**Actions**:
- Record successful payment
- Track Stripe fees in cost tracking

---

#### 5. invoice.payment_failed

**Triggered**: When recurring payment fails (card declined, etc.)

**Handler** (`webhook-handlers.js:312`):
```javascript
async function handlePaymentFailed(env, invoice) {
  const subscription = await env.DB.prepare(`
    SELECT id FROM subscriptions WHERE stripe_subscription_id = ?
  `).bind(invoice.subscription).first();

  // Record failed payment
  await env.DB.prepare(`
    INSERT INTO payment_history (
      ..., status, description, ...
    ) VALUES (..., 'failed', 'Payment failed', ...)
  `).bind(...).run();

  // Update subscription status to past_due
  await env.DB.prepare(`
    UPDATE subscriptions SET status = 'past_due' WHERE id = ?
  `).bind(subscription.id).run();
}
```

**Actions**:
- Record failed payment
- Mark subscription as past_due
- Stripe retries payment automatically

---

## Usage Enforcement

### Upload Limit Check

**When**: Before manuscript upload

**Logic** (`payment-handlers.js:374`):
```javascript
// Check usage against limit
const subscription = await env.DB.prepare(`
  SELECT * FROM user_subscriptions_with_usage WHERE user_id = ?
`).bind(userId).first();

const canUpload = subscription.manuscripts_this_period < subscription.monthly_limit;

if (!canUpload) {
  return Response.json({
    error: 'Monthly limit reached',
    upgradeUrl: '/pricing'
  }, { status: 403 });
}
```

**Frontend UX**:
- Display usage meter: "3 / 10 manuscripts this month"
- Show upgrade prompt when limit reached
- Link to pricing page

---

### Usage Tracking

**When**: After successful manuscript upload

**Function** (`payment-handlers.js:418`):
```javascript
export async function trackUsage(env, userId, manuscriptId, analysisType, assetsGenerated) {
  const subscription = await env.DB.prepare(`
    SELECT id, current_period_start, current_period_end
    FROM subscriptions
    WHERE user_id = ? AND status = 'active'
  `).bind(userId).first();

  await env.DB.prepare(`
    INSERT INTO usage_tracking (
      id, user_id, subscription_id, manuscript_id,
      analysis_type, assets_generated, credits_used,
      billing_period_start, billing_period_end, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    userId,
    subscription?.id || null,
    manuscriptId,
    analysisType,
    assetsGenerated ? 1 : 0,
    subscription?.current_period_start || timestamp,
    subscription?.current_period_end || timestamp + 30*24*60*60,
    timestamp
  ).run();
}
```

**Called From**: `manuscript-handlers.js` after upload

---

## Cost Tracking

### Stripe Fee Calculation

**Function** (`cost-utils.js`):
```javascript
export function calculateStripeFee(amountUSD) {
  // Stripe charges: 2.9% + $0.30 per transaction
  const percentageFee = amountUSD * 0.029;
  const fixedFee = 0.30;
  return percentageFee + fixedFee;
}
```

**Example**:
- $29.00 Pro subscription
- Stripe fee: ($29.00 × 0.029) + $0.30 = $1.141
- Platform receives: $27.859

### Cost Logging

**When**: After successful payment

**Implementation** (`webhook-handlers.js:178`):
```javascript
const stripeFee = calculateStripeFee(amountUSD);
await logCost(env, {
  userId,
  costCenter: 'stripe_fees',
  featureName: 'payment_processing',
  operation: 'subscription_payment',
  costUSD: stripeFee,
  metadata: {
    paymentId,
    subscriptionId,
    amountUSD,
    currency: 'usd'
  }
});
```

**Purpose**: Track platform costs for profitability analysis

---

## Configuration

### Environment Variables

Required in `wrangler.toml` and Cloudflare Dashboard:

```toml
[vars]
STRIPE_PUBLISHABLE_KEY = "pk_live_..."  # Public key for frontend
FRONTEND_URL = "https://scarter4workmanuscripthub.com"

# Secrets (set via dashboard):
# STRIPE_SECRET_KEY = "sk_live_..."
# STRIPE_WEBHOOK_SECRET = "whsec_..."
```

### Stripe Price IDs

Update in `payment-handlers.js:20`:
```javascript
const PRICING = {
  pro: {
    priceId: 'price_1ABC123...',  // Replace with actual Stripe Price ID
  },
  enterprise: {
    priceId: 'price_1DEF456...',  // Replace with actual Stripe Price ID
  }
};
```

**Setup Steps**:
1. Create products in Stripe Dashboard
2. Create prices for each product
3. Copy price IDs to `PRICING` config
4. Deploy updated code

---

## Deployment Checklist

### 1. Stripe Setup

- [ ] Create Stripe account
- [ ] Set up products (Pro, Enterprise)
- [ ] Create recurring prices for each plan
- [ ] Configure billing portal settings
- [ ] Get API keys (publishable + secret)
- [ ] Generate webhook secret

### 2. Cloudflare Configuration

- [ ] Add `STRIPE_SECRET_KEY` to secrets
- [ ] Add `STRIPE_WEBHOOK_SECRET` to secrets
- [ ] Update `STRIPE_PUBLISHABLE_KEY` in wrangler.toml
- [ ] Update `FRONTEND_URL` in wrangler.toml

### 3. Database Migration

- [ ] Run migration: `migration_003_payment_tables.sql`
- [ ] Verify tables created: `subscriptions`, `payment_history`, `usage_tracking`
- [ ] Verify view created: `user_subscriptions_with_usage`
- [ ] Check indexes exist

### 4. Webhook Configuration

- [ ] Add webhook endpoint: `https://api.scarter4workmanuscripthub.com/webhooks/stripe`
- [ ] Subscribe to events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

### 5. Testing

- [ ] Test Pro subscription checkout
- [ ] Test Enterprise subscription checkout
- [ ] Test one-time payment
- [ ] Test billing portal (cancel, update card)
- [ ] Test usage limits (upload until limit reached)
- [ ] Test webhook delivery
- [ ] Verify database updates after payment

---

## User Flows

### Flow 1: New User Signs Up (Free)

```
1. User registers account
   ↓
2. auth-handlers.js calls createFreeSubscription()
   ↓
3. Free subscription created in DB
   - plan_type: 'free'
   - monthly_limit: 1
   - status: 'active'
   ↓
4. User can upload 1 manuscript/month
```

---

### Flow 2: User Upgrades to Pro

```
1. User clicks "Upgrade to Pro" on pricing page
   ↓
2. Frontend calls POST /payments/create-checkout-session
   body: { plan: 'pro' }
   ↓
3. Worker creates Stripe checkout session
   ↓
4. User redirected to Stripe checkout
   ↓
5. User enters card details
   ↓
6. Payment processed by Stripe
   ↓
7. Stripe sends checkout.session.completed webhook
   ↓
8. Webhook handler creates subscription record
   - plan_type: 'pro'
   - monthly_limit: 10
   - status: 'active'
   ↓
9. User redirected to /billing?success=true
   ↓
10. User can now upload 10 manuscripts/month
```

---

### Flow 3: User Cancels Subscription

```
1. User clicks "Manage Billing" in dashboard
   ↓
2. Frontend calls POST /payments/create-portal-session
   ↓
3. User redirected to Stripe billing portal
   ↓
4. User clicks "Cancel subscription"
   ↓
5. Stripe updates subscription.cancel_at_period_end = true
   ↓
6. Stripe sends customer.subscription.updated webhook
   ↓
7. Webhook handler updates DB: cancel_at_period_end = 1
   ↓
8. User can continue using Pro features until period ends
   ↓
9. At period end, Stripe sends customer.subscription.deleted
   ↓
10. Webhook handler:
    - Sets subscription status = 'canceled'
    - Updates user subscription_tier = 'free'
   ↓
11. User downgraded to free tier (1 manuscript/month)
```

---

### Flow 4: One-Time Payment

```
1. User uploads manuscript (free tier limit reached)
   ↓
2. System prompts: "Upgrade to Pro or Pay $10 for this analysis"
   ↓
3. User clicks "Pay $10"
   ↓
4. Frontend calls POST /payments/create-payment-intent
   body: { manuscriptId: '...' }
   ↓
5. Worker creates Stripe PaymentIntent
   ↓
6. Frontend displays Stripe Elements (card form)
   ↓
7. User enters card details
   ↓
8. Stripe confirms payment client-side
   ↓
9. Stripe sends checkout.session.completed webhook
   ↓
10. Webhook handler records payment in payment_history
   ↓
11. Worker grants access to analysis for this manuscript
   ↓
12. Analysis runs, results stored for 90 days
```

---

## Security

### Payment Security

- **PCI Compliance**: No card data touches our servers (Stripe.js handles all card input)
- **Webhook Verification**: HMAC signature verification prevents unauthorized webhook calls
- **HTTPS Only**: All payment endpoints require HTTPS
- **CORS**: Strict CORS policy limits cross-origin requests

### Subscription Security

- **Authentication Required**: All payment endpoints require valid session
- **User Isolation**: Users can only access their own subscription/payment data
- **Rate Limiting**: Payment endpoints have rate limits to prevent abuse

---

## Monitoring

### Key Metrics

1. **Monthly Recurring Revenue (MRR)**:
   ```sql
   SELECT plan_type, COUNT(*) as subscribers,
          SUM(CASE
            WHEN plan_type = 'pro' THEN 29
            WHEN plan_type = 'enterprise' THEN 99
            ELSE 0
          END) as mrr
   FROM subscriptions
   WHERE status = 'active'
   GROUP BY plan_type;
   ```

2. **Churn Rate**:
   ```sql
   SELECT
     COUNT(*) FILTER (WHERE status = 'canceled') * 100.0 /
     COUNT(*) as churn_rate_percent
   FROM subscriptions
   WHERE created_at > strftime('%s', 'now', '-30 days');
   ```

3. **Upgrade Conversion Rate**:
   ```sql
   SELECT
     COUNT(*) FILTER (WHERE plan_type != 'free') * 100.0 /
     COUNT(*) as upgrade_rate_percent
   FROM subscriptions;
   ```

---

## Troubleshooting

### Issue: Webhook not received

**Symptoms**: Payment succeeds, but database not updated

**Diagnosis**:
```bash
# Check Stripe webhook logs
# Dashboard → Developers → Webhooks → [Your endpoint] → Logs
```

**Solutions**:
- Verify webhook URL is correct
- Check webhook secret matches environment variable
- Ensure endpoint is publicly accessible (not localhost)
- Check worker logs for signature verification errors

---

### Issue: User charged but subscription not created

**Symptoms**: Stripe shows successful payment, user still on free tier

**Diagnosis**:
```javascript
// Check payment_history for the transaction
SELECT * FROM payment_history WHERE user_id = ? ORDER BY created_at DESC;

// Check subscriptions table
SELECT * FROM subscriptions WHERE user_id = ?;
```

**Solutions**:
- Check webhook handler logs for errors
- Manually create subscription record if webhook failed
- Refund payment if subscription cannot be created

---

### Issue: Usage limit not enforced

**Symptoms**: User can upload more manuscripts than limit allows

**Diagnosis**:
```javascript
// Check usage tracking
SELECT * FROM user_subscriptions_with_usage WHERE user_id = ?;

// Count manuscripts in current period
SELECT COUNT(*) FROM usage_tracking
WHERE user_id = ? AND billing_period_start = ?;
```

**Solutions**:
- Verify usage tracking is called after upload
- Check billing period dates are correct
- Ensure view `user_subscriptions_with_usage` is working

---

## Future Enhancements

### Planned Features

1. **Team Billing** (MAN-45)
   - Shared subscription for multiple users
   - Seat-based pricing
   - Team admin dashboard

2. **Usage-Based Pricing** (MAN-46)
   - Pay per manuscript (bulk discounts)
   - Rollover unused credits
   - Prepaid credit packs

3. **Promotional Codes** (MAN-47)
   - Discount codes for marketing campaigns
   - Free trial extensions
   - Referral credits

4. **Annual Billing** (MAN-48)
   - 15% discount for annual vs monthly
   - Better LTV metrics
   - Reduced churn

---

## References

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Stripe Billing Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)
- [PCI Compliance](https://stripe.com/docs/security/guide)

---

**Last Updated**: 2025-10-28
**Author**: System Documentation (MAN-8)
**Version**: 1.0
