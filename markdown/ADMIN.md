# Admin Management System (MAN-9)

## Overview

The Admin Management System provides comprehensive platform oversight and management tools for administrators. It includes user management, manuscript oversight, analytics, billing management, DMCA request processing, and cost tracking.

**Access Level**: Requires `role = 'admin'` in users table

---

## Security & Access Control

### Role-Based Access

```javascript
// Middleware: Verify admin access
async function verifyAdmin(request, env) {
  const userId = await getUserFromRequest(request, env);

  if (!userId) {
    return { authorized: false, error: 'Unauthorized - please log in' };
  }

  const user = await env.DB.prepare(
    'SELECT role FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user || user.role !== 'admin') {
    return { authorized: false, error: 'Admin access required' };
  }

  return { authorized: true, userId };
}
```

### Protected Routes

All admin endpoints follow the pattern:
- `requireAuth` middleware: Validates session
- `requireAdmin` middleware: Checks `role = 'admin'`

Unauthorized access returns:
- **401**: Not logged in
- **403**: Logged in but not admin

---

## API Endpoints

### 1. User Management

#### List All Users
**GET** `/admin/users`

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 50, max: 200)
- `role`: Filter by role (`author`, `publisher`, `admin`)
- `search`: Search by email or ID
- `sortBy`: Sort field (`created_at`, `last_login`, `email`)
- `sortOrder`: `asc` or `desc` (default: `desc`)

**Response**:
```json
{
  "success": true,
  "users": [
    {
      "id": "user-uuid",
      "email": "user@example.com",
      "role": "author",
      "created_at": 1698969600,
      "last_login": 1701561600,
      "email_verified": 1,
      "manuscript_count": 5,
      "plan_type": "pro",
      "subscription_status": "active"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1234,
    "totalPages": 25
  }
}
```

#### Get User Details
**GET** `/admin/users/:userId`

**Response**:
```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "role": "author",
    "created_at": 1698969600,
    "last_login": 1701561600,
    "email_verified": 1
  },
  "subscription": {
    "plan_type": "pro",
    "manuscripts_this_period": 3,
    "monthly_limit": 10,
    "subscription_status": "active"
  },
  "manuscripts": [
    {
      "id": "manu-uuid",
      "title": "My Novel",
      "status": "complete",
      "genre": "thriller",
      "word_count": 85000,
      "uploaded_at": 1701561600
    }
  ],
  "activity": [
    {
      "action": "manuscript_upload",
      "timestamp": 1701561600
    }
  ],
  "payments": [
    {
      "id": "pay-uuid",
      "amount": 2900,
      "status": "succeeded",
      "created_at": 1698969600
    }
  ]
}
```

---

### 2. Manuscript Oversight

#### List All Manuscripts
**GET** `/admin/manuscripts`

**Query Parameters**:
- `page`: Page number
- `limit`: Results per page
- `status`: Filter by status (`pending`, `analyzing`, `complete`, `failed`)
- `flagged`: Show only flagged manuscripts (`true`/`false`)
- `sortBy`: `uploaded_at`, `word_count`, `status`

**Response**:
```json
{
  "manuscripts": [
    {
      "id": "manu-uuid",
      "user_id": "user-uuid",
      "user_email": "user@example.com",
      "title": "My Novel",
      "genre": "thriller",
      "status": "complete",
      "word_count": 85000,
      "uploaded_at": 1701561600,
      "flagged_for_review": 0,
      "analysis_completed_at": 1701565200
    }
  ],
  "pagination": {
    "page": 1,
    "total": 5678
  }
}
```

**Use Cases**:
- Monitor platform activity
- Review flagged content
- Identify stuck analyses
- Track popular genres

---

### 3. Platform Analytics

#### Analytics Overview
**GET** `/admin/analytics/overview`

**Response**:
```json
{
  "totalUsers": 1234,
  "totalManuscripts": 5678,
  "activeSubscriptions": 456,
  "totalRevenue": 12345.67,
  "breakdown": {
    "free": 778,
    "pro": 400,
    "enterprise": 56
  },
  "thisMonth": {
    "newUsers": 123,
    "newManuscripts": 456,
    "revenue": 13450.00,
    "churnRate": 3.2
  },
  "avgAnalysisTime": "12.5 minutes",
  "platformHealth": "healthy"
}
```

#### Recent Activity
**GET** `/admin/analytics/activity`

**Response**:
```json
{
  "activity": [
    {
      "timestamp": 1701561600,
      "user_email": "user@example.com",
      "action": "manuscript_upload",
      "resource_type": "manuscript",
      "metadata": {
        "manuscript_title": "My Novel",
        "word_count": 85000
      }
    }
  ]
}
```

**Activity Types**:
- `manuscript_upload`
- `analysis_start`
- `analysis_complete`
- `subscription_upgrade`
- `subscription_cancel`
- `payment_succeeded`
- `payment_failed`

---

### 4. Billing Management

#### Payment Transactions
**GET** `/admin/billing/transactions`

**Query Parameters**:
- `status`: `succeeded`, `pending`, `failed`, `refunded`
- `payment_type`: `subscription`, `one_time`
- `start_date`: Unix timestamp
- `end_date`: Unix timestamp
- `user_id`: Filter by specific user

**Response**:
```json
{
  "transactions": [
    {
      "id": "pay-uuid",
      "user_id": "user-uuid",
      "user_email": "user@example.com",
      "amount": 2900,
      "currency": "usd",
      "payment_type": "subscription",
      "status": "succeeded",
      "description": "Pro subscription payment",
      "created_at": 1701561600,
      "stripe_invoice_id": "in_..."
    }
  ],
  "summary": {
    "total_amount": 123456.78,
    "total_count": 456
  }
}
```

#### Subscription Stats
**GET** `/admin/billing/subscriptions/stats`

**Response**:
```json
{
  "totalSubscriptions": 456,
  "breakdown": {
    "free": 778,
    "pro": 400,
    "enterprise": 56
  },
  "status": {
    "active": 450,
    "past_due": 4,
    "canceled": 2
  },
  "mrr": 13450.00,
  "churnRate": 3.2,
  "avgLifetimeValue": 348.00
}
```

#### Revenue Analytics
**GET** `/admin/billing/revenue`

**Query Parameters**:
- `period`: `day`, `week`, `month`, `year`
- `start_date`: Unix timestamp
- `end_date`: Unix timestamp

**Response**:
```json
{
  "totalRevenue": 123456.78,
  "period": "month",
  "breakdown": {
    "subscriptions": 110000.00,
    "one_time": 13456.78
  },
  "dailyRevenue": [
    {
      "date": "2025-10-01",
      "revenue": 4567.89,
      "transactions": 23
    }
  ],
  "mrr": 13450.00,
  "projectedAnnualRevenue": 161400.00
}
```

#### Failed Payments
**GET** `/admin/billing/failed-payments`

**Response**:
```json
{
  "failedPayments": [
    {
      "id": "pay-uuid",
      "user_id": "user-uuid",
      "user_email": "user@example.com",
      "amount": 2900,
      "failed_at": 1701561600,
      "failure_reason": "card_declined",
      "retry_count": 2,
      "next_retry": 1701648000,
      "subscription_id": "sub-uuid"
    }
  ]
}
```

**Actions**:
- Contact user about payment failure
- Cancel subscription if retries exhausted
- Offer payment plan or grace period

#### Issue Refund
**POST** `/admin/billing/refund`

**Request Body**:
```json
{
  "payment_id": "pay-uuid",
  "amount": 2900,
  "reason": "requested_by_customer"
}
```

**Response**:
```json
{
  "success": true,
  "refund_id": "re_...",
  "amount": 29.00,
  "status": "succeeded"
}
```

#### Cancel Subscription
**POST** `/admin/billing/cancel-subscription`

**Request Body**:
```json
{
  "user_id": "user-uuid",
  "reason": "admin_action",
  "immediate": false
}
```

**Response**:
```json
{
  "success": true,
  "canceled_at_period_end": true,
  "period_end": 1704153600
}
```

**Options**:
- `immediate: true`: Cancel immediately, issue prorated refund
- `immediate: false`: Cancel at period end (default)

---

### 5. DMCA Management

#### Get DMCA Requests
**GET** `/admin/dmca/requests`

**Query Parameters**:
- `status`: `pending`, `reviewing`, `resolved`, `rejected`

**Response**:
```json
{
  "requests": [
    {
      "id": "dmca-uuid",
      "manuscript_id": "manu-uuid",
      "manuscript_title": "My Novel",
      "manuscript_owner_email": "author@example.com",
      "complainant_name": "John Doe",
      "complainant_email": "john@example.com",
      "claim_details": "This work infringes my copyright...",
      "status": "pending",
      "submitted_at": 1701561600,
      "reviewed_by": null,
      "resolved_at": null
    }
  ]
}
```

#### DMCA Stats
**GET** `/admin/dmca/stats`

**Response**:
```json
{
  "total": 45,
  "pending": 3,
  "reviewing": 2,
  "resolved": 35,
  "rejected": 5,
  "avgResolutionTime": "3.2 days"
}
```

#### Update DMCA Status
**PATCH** `/admin/dmca/status`

**Request Body**:
```json
{
  "request_id": "dmca-uuid",
  "status": "reviewing",
  "admin_notes": "Investigating copyright claim"
}
```

#### Resolve DMCA Request
**POST** `/admin/dmca/resolve`

**Request Body**:
```json
{
  "request_id": "dmca-uuid",
  "action": "approve",
  "reason": "Valid copyright claim verified",
  "notify_user": true
}
```

**Actions**:
- `approve`: Take down manuscript, notify author
- `reject`: Deny claim, notify complainant

**Response**:
```json
{
  "success": true,
  "action_taken": "manuscript_removed",
  "notifications_sent": 2
}
```

---

### 6. Cost Tracking

#### Cost Overview
**GET** `/admin/costs/overview`

**Response**:
```json
{
  "totalCosts": 12345.67,
  "thisMonth": 1234.56,
  "breakdown": {
    "anthropic_api": 987.65,
    "openai_api": 123.45,
    "stripe_fees": 123.46
  },
  "avgCostPerUser": 10.02,
  "avgCostPerManuscript": 8.50,
  "profitMargin": 78.3
}
```

#### Daily Costs
**GET** `/admin/costs/daily`

**Query Parameters**:
- `start_date`: Unix timestamp
- `end_date`: Unix timestamp

**Response**:
```json
{
  "dailyCosts": [
    {
      "date": "2025-10-28",
      "total": 456.78,
      "anthropic": 345.67,
      "openai": 23.45,
      "stripe": 87.66,
      "manuscripts_processed": 45
    }
  ]
}
```

#### Top Spenders
**GET** `/admin/costs/top-spenders`

**Response**:
```json
{
  "topSpenders": [
    {
      "user_id": "user-uuid",
      "email": "user@example.com",
      "total_cost": 456.78,
      "manuscripts": 45,
      "avg_cost_per_manuscript": 10.15
    }
  ]
}
```

#### Budget Alerts
**GET** `/admin/costs/budget-alerts`

**Response**:
```json
{
  "alerts": [
    {
      "id": "alert-uuid",
      "alert_type": "daily_budget_exceeded",
      "threshold": 500.00,
      "current_value": 567.89,
      "severity": "high",
      "created_at": 1701561600,
      "acknowledged": false
    }
  ]
}
```

#### Update Budget Config
**POST** `/admin/costs/budget-config`

**Request Body**:
```json
{
  "daily_limit": 500.00,
  "monthly_limit": 15000.00,
  "per_manuscript_limit": 15.00,
  "alert_threshold": 0.8
}
```

---

## Admin Dashboard Features

### Real-Time Metrics

**Platform Health Dashboard**:
- Total users (active/inactive)
- Total manuscripts (by status)
- Active subscriptions (breakdown by plan)
- Revenue (MRR, ARR, churn rate)
- Analysis queue depth
- Average analysis time
- API costs (daily/monthly trends)
- Profit margin

**Charts & Visualizations**:
- User growth over time
- Revenue trends
- Analysis success rate
- Genre distribution
- Geographic user distribution
- Subscription conversion funnel

---

## Audit Log

All admin actions are logged in the `audit_log` table:

```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,                    -- Admin who performed action
  action TEXT NOT NULL,            -- Action type
  resource_type TEXT,              -- users, manuscripts, subscriptions, etc.
  resource_id TEXT,                -- ID of affected resource
  metadata TEXT,                   -- JSON: additional details
  ip_address TEXT,
  user_agent TEXT,
  timestamp INTEGER NOT NULL
);
```

**Tracked Actions**:
- `admin_view_user`
- `admin_ban_user`
- `admin_issue_refund`
- `admin_cancel_subscription`
- `admin_resolve_dmca`
- `admin_update_costs`

---

## Security Best Practices

### 1. Role Verification

Always verify admin role on every request:
```javascript
const user = await env.DB.prepare(
  'SELECT role FROM users WHERE id = ?'
).bind(userId).first();

if (user.role !== 'admin') {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

### 2. Sensitive Data Access

Log all access to sensitive user data:
```javascript
await env.DB.prepare(`
  INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, timestamp)
  VALUES (?, ?, 'admin_view_user', 'user', ?, ?)
`).bind(crypto.randomUUID(), adminId, targetUserId, timestamp).run();
```

### 3. IP Allowlist (Recommended)

For production, consider IP allowlisting for admin routes:
```javascript
const allowedIPs = ['1.2.3.4', '5.6.7.8'];
const clientIP = request.headers.get('CF-Connecting-IP');

if (!allowedIPs.includes(clientIP)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

### 4. Two-Factor Authentication

Require 2FA for admin accounts:
```sql
ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN two_factor_secret TEXT;
```

---

## Monitoring & Alerts

### Critical Alerts

Set up alerts for:
- **Daily cost exceeds budget** ($500/day threshold)
- **High analysis failure rate** (>5% failures)
- **Payment failure spike** (>10 failed payments/hour)
- **DMCA requests pending** (>7 days old)
- **Suspended admin accounts** (multiple failed logins)

### Dashboard Widgets

**Top Priority**:
1. Revenue today vs. yesterday
2. Active subscriptions (total + net change)
3. Analysis queue depth
4. Failed payments requiring attention
5. Pending DMCA requests
6. Cost vs. revenue (profit margin)

---

## API Integration Examples

### Python Admin Client

```python
import requests

class AdminClient:
    def __init__(self, api_url, session_cookie):
        self.api_url = api_url
        self.headers = {
            'Cookie': f'session={session_cookie}'
        }

    def list_users(self, page=1, limit=50):
        response = requests.get(
            f'{self.api_url}/admin/users',
            headers=self.headers,
            params={'page': page, 'limit': limit}
        )
        return response.json()

    def get_revenue_analytics(self, period='month'):
        response = requests.get(
            f'{self.api_url}/admin/billing/revenue',
            headers=self.headers,
            params={'period': period}
        )
        return response.json()

    def issue_refund(self, payment_id, amount, reason):
        response = requests.post(
            f'{self.api_url}/admin/billing/refund',
            headers=self.headers,
            json={
                'payment_id': payment_id,
                'amount': amount,
                'reason': reason
            }
        )
        return response.json()

# Usage
client = AdminClient('https://api.selfpubhub.co', 'session-cookie-value')
users = client.list_users(page=1)
revenue = client.get_revenue_analytics(period='month')
```

---

## Troubleshooting

### Issue: Admin cannot access dashboard

**Symptoms**: 403 Forbidden on `/admin/*` endpoints

**Diagnosis**:
```sql
SELECT id, email, role FROM users WHERE email = 'admin@example.com';
```

**Solution**:
```sql
UPDATE users SET role = 'admin' WHERE id = 'user-uuid';
```

### Issue: Costs not tracking correctly

**Symptoms**: `/admin/costs/overview` returns $0 or stale data

**Diagnosis**:
```sql
SELECT COUNT(*) FROM cost_tracking WHERE timestamp > strftime('%s', 'now', '-1 day');
```

**Solution**: Verify agents are calling `logCost()` after API calls

### Issue: DMCA requests not showing

**Symptoms**: `/admin/dmca/requests` returns empty array

**Diagnosis**:
```sql
SELECT COUNT(*) FROM dmca_requests;
```

**Solution**: Ensure public DMCA submission endpoint is working

---

## Future Enhancements

1. **Bulk Actions** (MAN-50)
   - Ban multiple users at once
   - Export user data (CSV)
   - Bulk refund processing

2. **Advanced Analytics** (MAN-51)
   - Custom date range reports
   - Cohort analysis
   - Retention metrics
   - Genre performance trends

3. **Automation** (MAN-52)
   - Auto-suspend users with repeated payment failures
   - Auto-resolve DMCA for known false positives
   - Auto-scale budget based on revenue

4. **Admin Roles** (MAN-53)
   - Support agent (limited access)
   - Finance admin (billing only)
   - Super admin (full access)

---

## References

- [Role-Based Access Control Best Practices](https://owasp.org/www-community/Access_Control)
- [Admin Dashboard Design Patterns](https://www.nngroup.com/articles/dashboard-design/)
- [Audit Logging Standards](https://csrc.nist.gov/publications/detail/sp/800-92/final)

---

**Last Updated**: 2025-10-28
**Author**: System Documentation (MAN-9)
**Version**: 1.0
