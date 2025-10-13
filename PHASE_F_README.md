# Phase F: Payment Processing & Subscription Management

## Overview

Phase F implements a complete Stripe-based payment processing system with subscription tiers, usage tracking, and one-time purchases. Users can subscribe to paid plans or pay per manuscript analysis.

## Features Implemented

### ✅ Backend (Complete)

1. **Payment Handlers** (`payment-handlers.js`)
   - Subscription checkout sessions
   - One-time payment intents
   - Customer portal access
   - Subscription details with usage
   - Payment history retrieval
   - Usage limit checking
   - Usage tracking for billing

2. **Webhook Handlers** (`webhook-handlers.js`)
   - Stripe signature verification
   - Subscription lifecycle events
   - Payment success/failure handling
   - Automatic user tier updates
   - Idempotent event processing

3. **Database Schema** (`migration_003_payment_tables.sql`)
   - `subscriptions` - User subscriptions with Stripe IDs
   - `payment_history` - All payment records
   - `usage_tracking` - Manuscript analysis usage
   - `user_subscriptions_with_usage` - Convenient view for limits

4. **API Endpoints**
   - `POST /payments/create-checkout-session` - Start subscription
   - `POST /payments/create-payment-intent` - One-time purchase
   - `POST /payments/create-portal-session` - Billing management
   - `GET /payments/subscription` - Current subscription
   - `GET /payments/history` - Payment history
   - `GET /payments/can-upload` - Check upload limits
   - `POST /payments/webhook` - Stripe webhooks

5. **Usage Enforcement** (in `worker.js`)
   - Checks limits before manuscript upload
   - Returns 403 with upgrade prompt when limit reached
   - Tracks usage after successful upload

### ✅ Frontend (Complete)

1. **Billing Dashboard** (`frontend/billing.html`)
   - Current subscription display with usage bar
   - Upgrade/downgrade plan cards
   - Payment history table
   - Customer portal access
   - Success/error messages

2. **Pricing Page** (`frontend/pricing.html`)
   - All plan tiers with features
   - Feature comparison table
   - FAQ section
   - One-time purchase option
   - Responsive design

3. **Billing Integration** (`frontend/js/billing-integration.js`)
   - Automatic subscription loading
   - Subscription badge in header
   - Upload limit checking
   - Upgrade modal when limit reached
   - Seamless integration with existing UI

## Pricing Structure

| Tier | Price | Manuscripts/Month | Features |
|------|-------|-------------------|----------|
| **Free** | $0 | 1 | Basic analysis (3 agents), 30 days storage |
| **Pro** | $29 | 10 | Full analysis + 7 asset agents, 1 year storage, priority support |
| **Enterprise** | $99 | Unlimited | Everything + team features (5 members), API access, custom branding |
| **One-Time** | $10 | Pay-per-use | Full analysis + assets, 90 days storage |

## Setup Instructions

### 1. Environment Variables

Create a `.dev.vars` file (for local development):

```bash
# Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Stripe Test Keys (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

Update `wrangler.toml` (already configured):
```toml
[vars]
STRIPE_PUBLISHABLE_KEY = "pk_test_xxxxx"  # Safe to commit
FRONTEND_URL = "https://scarter4workmanuscripthub.com"
```

### 2. Stripe Dashboard Setup

#### Create Products

1. Go to https://dashboard.stripe.com/test/products
2. Click "Add product"

**Pro Monthly:**
- Name: "Pro Monthly"
- Description: "10 manuscripts per month with full analysis and asset generation"
- Pricing: $29.00 / month
- Copy the Price ID (e.g., `price_xxxxx`) and update in `payment-handlers.js` line 20

**Enterprise Monthly:**
- Name: "Enterprise Monthly"
- Description: "Unlimited manuscripts with team features and API access"
- Pricing: $99.00 / month
- Copy the Price ID and update in `payment-handlers.js` line 27

#### Configure Customer Portal

1. Go to https://dashboard.stripe.com/test/settings/billing/portal
2. Enable these features:
   - ✅ Cancel subscriptions
   - ✅ Update subscriptions (plan changes)
   - ✅ Update payment method
   - ✅ View invoice history
3. Save changes

#### Set Up Webhooks

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://api.scarter4workmanuscripthub.com/payments/webhook`
4. Select events to listen to:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
5. Copy the webhook signing secret (starts with `whsec_`)
6. Add to Cloudflare Dashboard > Workers > manuscript-upload-api > Settings > Variables
   - Variable name: `STRIPE_WEBHOOK_SECRET`
   - Value: `whsec_xxxxx`

### 3. Deploy Database Migration

**Local:**
```bash
npx wrangler d1 execute manuscript-platform --local --file=migration_003_payment_tables.sql
```

**Production:**
```bash
npx wrangler d1 execute manuscript-platform --file=migration_003_payment_tables.sql
```

This will:
- Create `subscriptions`, `payment_history`, and `usage_tracking` tables
- Add `subscription_tier` column to `users` table
- Create the `user_subscriptions_with_usage` view
- Give all existing users a free subscription

### 4. Deploy Frontend

Upload these files to your frontend hosting:

```bash
# Upload to Cloudflare Pages or your hosting
frontend/billing.html
frontend/pricing.html
frontend/js/billing-integration.js
```

Update links in `dashboard-spa.html`:
```html
<!-- Add to navigation -->
<a href="billing.html">💳 Billing</a>
<a href="pricing.html">💎 Pricing</a>

<!-- Add billing integration script -->
<script src="js/billing-integration.js"></script>
```

### 5. Deploy Worker

```bash
# Deploy with updated payment handlers
npx wrangler deploy
```

### 6. Configure Production Secrets

In Cloudflare Dashboard:

1. Go to Workers & Pages > manuscript-upload-api > Settings > Variables
2. Add these secrets:
   - `STRIPE_SECRET_KEY` = `sk_live_xxxxx` (use live key for production)
   - `STRIPE_WEBHOOK_SECRET` = `whsec_xxxxx`
   - `ANTHROPIC_API_KEY` = `sk-ant-xxxxx`

## Testing

### Run Test Script

```bash
node test-phase-f-payments.js
```

This will:
1. Create a test user
2. Verify free tier subscription
3. Upload 1 manuscript (uses quota)
4. Try to upload 2nd manuscript (should fail with 403)
5. Check usage tracking
6. Test Stripe checkout session creation
7. Verify all API endpoints

### Manual Testing

1. **Free Tier Limits:**
   - Register a new account
   - Upload 1 manuscript successfully
   - Try to upload 2nd manuscript → should see upgrade modal

2. **Subscription Upgrade:**
   - Go to `/pricing.html`
   - Click "Upgrade to Pro"
   - Complete checkout in Stripe (use test card: `4242 4242 4242 4242`)
   - Verify subscription updated in `/billing.html`
   - Upload 10 manuscripts successfully

3. **Webhook Processing:**
   - Subscribe to a plan
   - Check database: `SELECT * FROM subscriptions WHERE user_id = 'your_user_id'`
   - Cancel subscription via customer portal
   - Verify status updated to `canceled`

4. **Customer Portal:**
   - Subscribe to Pro plan
   - Click "Manage Subscription" in `/billing.html`
   - Verify portal opens with update/cancel options

## API Usage Examples

### Check Upload Permission

```javascript
const response = await fetch('https://api.scarter4workmanuscripthub.com/payments/can-upload', {
  credentials: 'include'
});

const data = await response.json();
// { canUpload: true/false, planType: 'free', manuscriptsUsed: 0, monthlyLimit: 1 }
```

### Get Subscription Details

```javascript
const response = await fetch('https://api.scarter4workmanuscripthub.com/payments/subscription', {
  credentials: 'include'
});

const data = await response.json();
// {
//   planType: 'pro',
//   status: 'active',
//   manuscriptsThisPeriod: 3,
//   monthlyLimit: 10,
//   periodStart: 1234567890000,
//   periodEnd: 1237159890000,
//   cancelAtPeriodEnd: false
// }
```

### Create Checkout Session

```javascript
const response = await fetch('https://api.scarter4workmanuscripthub.com/payments/create-checkout-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ plan: 'pro' })  // or 'enterprise'
});

const data = await response.json();
// { success: true, sessionId: 'cs_...', url: 'https://checkout.stripe.com/...' }

// Redirect user to checkout
window.location.href = data.url;
```

### Open Customer Portal

```javascript
const response = await fetch('https://api.scarter4workmanuscripthub.com/payments/create-portal-session', {
  method: 'POST',
  credentials: 'include'
});

const data = await response.json();
// { success: true, url: 'https://billing.stripe.com/...' }

window.location.href = data.url;
```

## Database Schema

### subscriptions
```sql
id                    TEXT PRIMARY KEY
user_id               TEXT NOT NULL
stripe_subscription_id TEXT UNIQUE
stripe_customer_id    TEXT NOT NULL
plan_type             TEXT NOT NULL  -- 'free', 'pro', 'enterprise'
status                TEXT NOT NULL  -- 'active', 'canceled', 'past_due', 'incomplete'
current_period_start  INTEGER NOT NULL
current_period_end    INTEGER NOT NULL
cancel_at_period_end  INTEGER DEFAULT 0
created_at            INTEGER NOT NULL
updated_at            INTEGER NOT NULL
```

### payment_history
```sql
id                        TEXT PRIMARY KEY
user_id                   TEXT NOT NULL
subscription_id           TEXT
stripe_payment_intent_id  TEXT
stripe_invoice_id         TEXT
amount                    INTEGER NOT NULL  -- in cents
currency                  TEXT DEFAULT 'usd'
payment_type              TEXT NOT NULL  -- 'subscription', 'one_time'
status                    TEXT NOT NULL  -- 'succeeded', 'pending', 'failed', 'refunded'
description               TEXT
metadata                  TEXT
created_at                INTEGER NOT NULL
```

### usage_tracking
```sql
id                      TEXT PRIMARY KEY
user_id                 TEXT NOT NULL
subscription_id         TEXT
manuscript_id           TEXT NOT NULL
analysis_type           TEXT NOT NULL  -- 'full', 'basic'
assets_generated        INTEGER DEFAULT 0  -- boolean
credits_used            INTEGER DEFAULT 1
timestamp               INTEGER NOT NULL
billing_period_start    INTEGER NOT NULL
billing_period_end      INTEGER NOT NULL
```

## Security Considerations

✅ **Implemented:**
1. Webhook signature verification (prevents unauthorized events)
2. Server-side amount validation (can't manipulate prices)
3. User authorization checks (users only access their own data)
4. Idempotent webhook processing (prevents duplicate charges)
5. PCI compliance (Stripe handles card data, never touches our servers)
6. Session-based authentication (all payment routes require login)

## Troubleshooting

### Issue: "STRIPE_SECRET_KEY not configured"
- **Solution:** Add `STRIPE_SECRET_KEY` to `.dev.vars` (local) or Cloudflare Dashboard (production)

### Issue: Webhook events not being received
- **Solution:**
  1. Check webhook endpoint is publicly accessible
  2. Verify webhook secret matches in Stripe Dashboard
  3. Check Cloudflare Worker logs for errors

### Issue: User stuck at free tier after successful payment
- **Solution:**
  1. Check webhook is firing: Stripe Dashboard > Developers > Webhooks > Events
  2. Verify `handleCheckoutCompleted` updated database
  3. Check D1 database: `SELECT * FROM subscriptions WHERE stripe_subscription_id = 'sub_xxx'`

### Issue: Upload gate not showing when limit reached
- **Solution:**
  1. Ensure `billing-integration.js` is loaded in HTML
  2. Check browser console for errors
  3. Verify API endpoint returns correct usage data

## Next Steps (Phase G - Email Notifications)

After Phase F is deployed, consider implementing:

1. **Email Notifications:**
   - Payment success confirmation
   - Payment failure alerts
   - Subscription cancellation confirmations
   - Usage limit warnings (e.g., 80% used)
   - Invoice receipts

2. **Team Features (Enterprise):**
   - Multi-user accounts
   - Role-based permissions
   - Shared manuscript libraries
   - Team usage dashboards

3. **Analytics & Reporting:**
   - Monthly Recurring Revenue (MRR) tracking
   - Churn rate analysis
   - Conversion funnel metrics
   - Popular plan analysis

## Support

For issues or questions:
- Check webhook logs in Stripe Dashboard
- Review Cloudflare Worker logs
- Test with Stripe test cards: https://stripe.com/docs/testing
- Contact: [support email]

---

**Phase F Status:** ✅ Complete and ready for testing
**Last Updated:** October 13, 2025
