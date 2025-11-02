# Phase F: Payment Processing - Design Document

## Overview
Implement Stripe-based payment processing with subscription tiers and pay-per-analysis options.

## Pricing Tiers

### Free Tier
- **Price**: $0/month
- **Manuscripts**: 1 per month
- **Features**: Basic analysis (dev + line + copy editing)
- **Asset Generation**: Not included
- **Storage**: 30 days
- **Target**: Trial users, hobbyists

### Pro Tier
- **Price**: $29/month
- **Manuscripts**: 10 per month
- **Features**: Full analysis + asset generation
- **Asset Generation**: All 7 agents included
- **Storage**: 1 year
- **Priority Support**: Yes
- **Target**: Serious authors, small publishers

### Enterprise Tier
- **Price**: $99/month
- **Manuscripts**: Unlimited
- **Features**: Everything + team features
- **Team Members**: Up to 5
- **API Access**: Yes
- **Custom Branding**: Optional
- **Dedicated Support**: Yes
- **Target**: Publishers, agencies

### Pay-Per-Analysis
- **Price**: $10 per manuscript (one-time)
- **Features**: Full analysis + assets
- **Storage**: 90 days
- **Target**: Occasional users

## Database Schema

### subscriptions table
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
  cancel_at_period_end INTEGER DEFAULT 0, -- Boolean
  created_at INTEGER NOT NULL,            -- Unix timestamp
  updated_at INTEGER NOT NULL,            -- Unix timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### payment_history table
```sql
CREATE TABLE payment_history (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT NOT NULL,                  -- Foreign key to users
  stripe_payment_intent_id TEXT,          -- Stripe payment intent ID
  stripe_invoice_id TEXT,                 -- Stripe invoice ID (for subscriptions)
  amount INTEGER NOT NULL,                -- Amount in cents
  currency TEXT DEFAULT 'usd',            -- Currency code
  payment_type TEXT NOT NULL,             -- subscription/one_time
  status TEXT NOT NULL,                   -- succeeded/pending/failed/refunded
  description TEXT,                       -- Human-readable description
  created_at INTEGER NOT NULL,            -- Unix timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### usage_tracking table
```sql
CREATE TABLE usage_tracking (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT NOT NULL,                  -- Foreign key to users
  subscription_id TEXT,                   -- Foreign key to subscriptions (null for pay-per)
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  analysis_type TEXT NOT NULL,            -- full/basic
  assets_generated INTEGER DEFAULT 0,     -- Boolean
  credits_used INTEGER DEFAULT 1,         -- Credits consumed (usually 1)
  timestamp INTEGER NOT NULL,             -- Unix timestamp
  billing_period_start INTEGER NOT NULL,  -- For monthly limit tracking
  billing_period_end INTEGER NOT NULL,    -- For monthly limit tracking
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);
```

## API Endpoints

### Payment & Subscription
- `POST /payments/create-checkout-session` - Create Stripe checkout for subscription
- `POST /payments/create-payment-intent` - Create payment intent for one-time purchase
- `POST /payments/create-portal-session` - Customer portal for managing subscription
- `POST /payments/webhook` - Stripe webhook handler
- `GET /payments/subscription` - Get current subscription details
- `GET /payments/usage` - Get current usage and limits
- `GET /payments/history` - Get payment history

## Implementation Flow

### 1. Subscription Flow
```
User clicks "Upgrade to Pro"
  → Frontend: POST /payments/create-checkout-session {plan: 'pro'}
  → Backend: Create Stripe Checkout Session
  → Redirect to Stripe Checkout
  → User completes payment
  → Stripe webhook: checkout.session.completed
  → Backend: Create subscription record
  → Redirect to success page
```

### 2. One-Time Purchase Flow
```
User uploads manuscript (no credits left)
  → Frontend: Show "Buy Credits" modal
  → User clicks "Purchase Analysis ($10)"
  → POST /payments/create-payment-intent {manuscript_id}
  → Display Stripe Payment Element
  → User completes payment
  → Frontend: Confirm payment
  → Backend: Grant credits, start analysis
```

### 3. Usage Enforcement
```
On manuscript upload:
  1. Check user's subscription tier
  2. Check usage for current billing period
  3. If over limit:
     - Show upgrade modal (free → pro)
     - OR show pay-per-analysis option
  4. If within limit:
     - Proceed with upload
     - Increment usage_tracking
```

## Stripe Products Setup

### In Stripe Dashboard:
1. Create Products:
   - "Pro Monthly" - $29/month
   - "Enterprise Monthly" - $99/month
   - "One-Time Analysis" - $10 one-time

2. Enable Customer Portal:
   - Allow subscription cancellation
   - Allow plan upgrades/downgrades
   - Show payment history

3. Configure Webhooks:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

## Environment Variables

```toml
[vars]
STRIPE_PUBLISHABLE_KEY = "pk_test_..."
STRIPE_WEBHOOK_SECRET = "whsec_..."

[secrets]
STRIPE_SECRET_KEY = "sk_test_..."
```

## Security Considerations

1. **Webhook Verification**: Always verify Stripe signature
2. **Idempotency**: Handle duplicate webhook events
3. **Amount Validation**: Verify amounts server-side
4. **User Authorization**: Ensure users can only access their own payment data
5. **PCI Compliance**: Never handle raw card data (Stripe handles it)

## UI Components

### Pricing Page
- Display all tiers with features
- "Current Plan" badge for active subscription
- "Upgrade" / "Downgrade" buttons
- FAQ section

### Billing Dashboard
- Current plan and usage
- Progress bar for monthly limit
- Payment method on file
- Payment history table
- "Manage Subscription" button (→ Stripe Portal)
- Invoices download

### Upload Gate
- Display when user hits limit
- "Upgrade to continue" CTA
- OR "Pay $10 for this analysis" option
- Clear pricing comparison

## Testing Strategy

1. **Stripe Test Mode**: Use test cards
2. **Test Scenarios**:
   - Subscribe to Pro plan
   - Cancel subscription
   - Hit monthly limit
   - One-time purchase
   - Webhook failure handling
   - Refund processing

3. **Test Cards**:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - 3D Secure: `4000 0025 0000 3155`

## Migration Plan

1. Create new database tables
2. Add Stripe SDK to worker
3. Implement payment endpoints
4. Create pricing page UI
5. Add usage tracking to upload flow
6. Implement webhook handler
7. Test in Stripe test mode
8. Deploy to production
9. Switch to Stripe live mode

## Rollout Strategy

1. **Soft Launch**: Keep everything free initially
2. **Add UI Elements**: Show pricing, but don't enforce
3. **Grace Period**: Announce pricing 2 weeks in advance
4. **Grandfather Existing Users**: Give current users Pro plan free for 3 months
5. **Enable Enforcement**: Start requiring payment for new users
6. **Monitor**: Watch for conversion rates and drop-off

## Success Metrics

- Conversion rate (free → paid)
- Monthly Recurring Revenue (MRR)
- Churn rate
- Average revenue per user (ARPU)
- Payment success rate
- Webhook processing latency
