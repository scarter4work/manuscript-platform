# Stripe Production Configuration Guide

**Last Updated:** October 25, 2025
**Issue:** MAN-30
**Status:** Ready for Production

---

## Overview

This guide covers the complete setup of Stripe for production, including obtaining live API keys, configuring webhook endpoints, setting secrets in Cloudflare Workers, and testing the integration.

---

## Prerequisites

- [ ] Stripe account verified and activated for live mode
- [ ] Business information completed in Stripe dashboard
- [ ] Bank account connected for payouts
- [ ] Tax information submitted (if applicable)
- [ ] Payment methods enabled (cards, ACH, etc.)

---

## Step 1: Obtain Stripe Live API Keys

### 1.1 Access Stripe Dashboard

1. Go to https://dashboard.stripe.com
2. **Switch to Live Mode** (toggle in top-right corner)
3. Navigate to **Developers → API keys**

### 1.2 Copy Secret Key

1. Find **Secret key** (starts with `sk_live_`)
2. Click **Reveal live key token**
3. Copy the full key (you'll need it in Step 3)

⚠️ **IMPORTANT:** Never commit this key to version control!

### 1.3 Copy Publishable Key

1. Find **Publishable key** (starts with `pk_live_`)
2. This is NOT a secret - it's used in frontend JavaScript
3. Copy the full key (you'll need it for frontend configuration)

---

## Step 2: Configure Stripe Webhook Endpoint

### 2.1 Create Webhook Endpoint

1. In Stripe Dashboard (Live Mode): **Developers → Webhooks**
2. Click **+ Add endpoint**
3. Enter endpoint URL:
   ```
   https://api.selfpubhub.co/webhooks/stripe
   ```
4. Click **Select events**

### 2.2 Select Events to Listen For

Select these events (required for subscription management):

**Checkout:**
- ✅ `checkout.session.completed` - When customer completes payment

**Customer Subscriptions:**
- ✅ `customer.subscription.created` - New subscription created
- ✅ `customer.subscription.updated` - Subscription changed (plan, status)
- ✅ `customer.subscription.deleted` - Subscription canceled

**Invoices:**
- ✅ `invoice.payment_succeeded` - Successful recurring payment
- ✅ `invoice.payment_failed` - Failed recurring payment

### 2.3 Save and Copy Webhook Secret

1. Click **Add endpoint**
2. After creation, click on the webhook endpoint
3. Find **Signing secret** (starts with `whsec_`)
4. Click **Reveal** and copy the full secret
5. You'll need this in Step 3

---

## Step 3: Configure Cloudflare Workers Secrets

### 3.1 Set Stripe Secret Key

```bash
# Run from project directory
echo "sk_live_YOUR_ACTUAL_KEY_HERE" | npx wrangler secret put STRIPE_SECRET_KEY
```

**Verify:**
```bash
npx wrangler secret list | grep STRIPE_SECRET_KEY
# Should show: STRIPE_SECRET_KEY
```

### 3.2 Set Stripe Webhook Secret

```bash
echo "whsec_YOUR_ACTUAL_SECRET_HERE" | npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

**Verify:**
```bash
npx wrangler secret list | grep STRIPE_WEBHOOK_SECRET
# Should show: STRIPE_WEBHOOK_SECRET
```

### 3.3 Verify All Secrets Are Set

```bash
npx wrangler secret list
```

**Expected output:**
```
ANTHROPIC_API_KEY
JWT_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

---

## Step 4: Update Frontend Configuration

### 4.1 Update wrangler.toml

The `STRIPE_PUBLISHABLE_KEY` is set in `wrangler.toml` (not secret):

```toml
[vars]
STRIPE_PUBLISHABLE_KEY = "pk_live_YOUR_ACTUAL_KEY_HERE"
FRONTEND_URL = "https://selfpubhub.co"
```

### 4.2 Deploy Updated Configuration

```bash
# Commit wrangler.toml changes
git add wrangler.toml
git commit -m "Configure Stripe live publishable key"
git push origin main

# Deploy to production
npx wrangler deploy
```

---

## Step 5: Test Stripe Integration

### 5.1 Test Webhook Endpoint Health

```bash
# Should return 405 Method Not Allowed (webhooks only accept POST)
curl -I https://api.selfpubhub.co/webhooks/stripe

# Expected response:
# HTTP/2 405
# content-type: application/json
```

### 5.2 Send Test Webhook from Stripe Dashboard

1. In Stripe Dashboard: **Developers → Webhooks**
2. Click on your webhook endpoint
3. Click **Send test webhook**
4. Select event: `checkout.session.completed`
5. Click **Send test webhook**

**Expected result:**
- Status: **Success** (200 OK)
- Response: `{"received":true}`

### 5.3 Monitor Worker Logs

```bash
# Watch live logs while testing
npx wrangler tail --format pretty
```

**Look for:**
```
[Webhook] Processing event: checkout.session.completed evt_xxxxx
[Webhook] Checkout completed for session cs_test_xxxxx
```

### 5.4 Test Real Payment Flow (Small Amount)

1. Create a test subscription using live keys
2. Use a real card (charge $1 for basic plan)
3. Complete checkout
4. Verify webhook received
5. Check database for subscription record:

```bash
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 1"
```

6. Refund the test transaction in Stripe dashboard

---

## Step 6: Verify Database Schema

### 6.1 Check Subscriptions Table

```bash
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='subscriptions'"
```

**Expected columns:**
- `id` (TEXT PRIMARY KEY)
- `user_id` (TEXT)
- `stripe_subscription_id` (TEXT UNIQUE)
- `stripe_customer_id` (TEXT)
- `plan_id` (TEXT)
- `status` (TEXT)
- `current_period_start` (INTEGER)
- `current_period_end` (INTEGER)
- `cancel_at_period_end` (INTEGER)
- `created_at` (INTEGER)
- `updated_at` (INTEGER)

### 6.2 Check Transactions Table

```bash
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'"
```

**Expected columns:**
- `id` (TEXT PRIMARY KEY)
- `user_id` (TEXT)
- `subscription_id` (TEXT)
- `stripe_payment_intent_id` (TEXT)
- `amount` (INTEGER)
- `currency` (TEXT)
- `status` (TEXT)
- `created_at` (INTEGER)

---

## Security Best Practices

### 7.1 Webhook Signature Verification

✅ **Already implemented** in `webhook-handlers.js:32-44`

Our code verifies webhook signatures using:
```javascript
event = stripe.webhooks.constructEvent(
  body,
  signature,
  env.STRIPE_WEBHOOK_SECRET
);
```

This ensures webhooks are genuinely from Stripe and haven't been tampered with.

### 7.2 HTTPS Only

✅ **Enforced by Cloudflare** - All traffic is HTTPS

### 7.3 Environment Variable Security

✅ **Secrets stored securely:**
- Never in version control
- Set via `wrangler secret put`
- Encrypted at rest in Cloudflare Workers

### 7.4 Restrict API Keys

In Stripe Dashboard, restrict API keys to specific IP ranges (optional):

1. **Developers → API keys**
2. Click on key → **Restrict key**
3. Add Cloudflare Worker IPs (if known)

---

## Monitoring & Alerts

### 8.1 Stripe Dashboard

Monitor in **Stripe Dashboard → Developers → Webhooks**:
- Webhook delivery success rate
- Failed webhook deliveries
- Recent webhook events

### 8.2 Worker Logs

```bash
# Monitor live webhook processing
npx wrangler tail --format pretty | grep "\[Webhook\]"
```

### 8.3 Database Checks

```bash
# Check subscription count
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT COUNT(*) as total_subscriptions, \
   SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active \
   FROM subscriptions"

# Check recent transactions
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10"
```

---

## Troubleshooting

### Issue: Webhook Signature Verification Fails

**Symptoms:**
- Stripe webhooks return 400 errors
- Logs show: "Signature verification failed"

**Causes:**
1. Wrong `STRIPE_WEBHOOK_SECRET`
2. Using test secret with live webhooks (or vice versa)
3. Body parsing issue

**Solution:**
```bash
# 1. Verify webhook secret is set
npx wrangler secret list | grep STRIPE_WEBHOOK_SECRET

# 2. Re-copy webhook secret from Stripe Dashboard
# Developers → Webhooks → Click endpoint → Reveal signing secret

# 3. Update secret
echo "whsec_NEW_SECRET_HERE" | npx wrangler secret put STRIPE_WEBHOOK_SECRET

# 4. Redeploy
npx wrangler deploy
```

### Issue: Subscriptions Not Creating in Database

**Symptoms:**
- Webhook receives event successfully
- No subscription record in database

**Diagnosis:**
```bash
# Check worker logs
npx wrangler tail --format pretty

# Look for error messages in subscription handler
```

**Common Causes:**
1. Database schema missing
2. User doesn't exist in database
3. Metadata missing from Stripe session

**Solution:**
```bash
# Verify subscriptions table exists
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='subscriptions'"

# Check user_id in Stripe metadata
# In Stripe Dashboard → Payments → Find session
# Check metadata.user_id is set
```

### Issue: Payment Succeeded but Subscription Shows Incomplete

**Symptoms:**
- Payment successful in Stripe
- Subscription status: "incomplete"

**Cause:**
First payment failed after checkout completed.

**Solution:**
1. Check Stripe Dashboard → Subscriptions → Find subscription
2. Verify payment method is valid
3. Retry payment manually if needed
4. Subscription will auto-update via webhook

---

## Rollback Procedure

### If Stripe Integration Causes Issues

**Option 1: Disable Webhooks Temporarily**

In Stripe Dashboard:
1. **Developers → Webhooks**
2. Click on endpoint
3. Toggle **Enabled** to OFF
4. This stops webhook processing while you debug

**Option 2: Rollback Deployment**

```bash
# Rollback to previous version
npx wrangler rollback --message "Stripe integration issues"

# Or deploy specific commit
git checkout <previous-commit>
npx wrangler deploy
git checkout main
```

**Option 3: Switch to Test Mode Temporarily**

⚠️ **Last resort only!**

```bash
# Revert to test keys
echo "sk_test_YOUR_TEST_KEY" | npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler deploy
```

---

## Post-Setup Checklist

After completing Stripe production setup:

- [ ] Live API keys configured in Cloudflare Workers
- [ ] Webhook endpoint created and verified in Stripe Dashboard
- [ ] All webhook events selected and tested
- [ ] Test webhook sent successfully (200 OK response)
- [ ] Real payment test completed (and refunded)
- [ ] Database subscription record created correctly
- [ ] Worker logs show successful webhook processing
- [ ] Frontend shows correct publishable key
- [ ] Documentation updated in production runbook
- [ ] MAN-30 marked as complete in Linear

---

## Related Documentation

- **Production Runbook:** `PRODUCTION-RUNBOOK.md` - Daily operations
- **Environment Status:** `PRODUCTION-ENVIRONMENT-STATUS.md` - Current config
- **Payment Design:** `phase-f-payment-design.md` - Technical architecture
- **Test Results:** `PRODUCTION-TEST-RESULTS.md` - Previous test outcomes

---

## Support Resources

**Stripe Documentation:**
- Webhooks: https://stripe.com/docs/webhooks
- API Keys: https://stripe.com/docs/keys
- Testing: https://stripe.com/docs/testing

**Internal Contacts:**
- **Developer:** scarter4work@yahoo.com
- **Stripe Support:** https://support.stripe.com

---

**Last Updated:** October 25, 2025
**Next Review:** After first production subscription payment
