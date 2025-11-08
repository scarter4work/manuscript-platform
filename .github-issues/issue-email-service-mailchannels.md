# 🚨 CRITICAL: Replace MailChannels with Render-Compatible Email Service

## Priority: CRITICAL
**Impact**: ALL email notifications fail (verification, password reset, payments, DMCA, teams)
**Effort**: 4-6 hours
**Risk**: User account lockout, failed payments, no notifications

## Problem

The email service at `src/services/email-service.js` is hardcoded to use **MailChannels API**, which is Cloudflare Workers-specific and will NOT work on Render.

**Affected Email Types** (12+):
1. Email verification (registration)
2. Password reset emails
3. Password reset confirmation
4. Payment confirmation
5. Payment failed alerts
6. Usage warnings (limit reached)
7. Analysis complete notifications
8. Asset generation complete
9. Team invitations
10. Team activity updates
11. DMCA takedown notices
12. DMCA status updates

## Current Code (BROKEN on Render)

```javascript
// src/services/email-service.js:16
const MAILCHANNELS_API = 'https://api.mailchannels.net/tx/v1/send';

// src/services/email-service.js:90-96
const response = await fetch(MAILCHANNELS_API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

**Problem**: MailChannels requires Cloudflare Workers runtime. Fails on generic Node.js/Express.

## Recommended Solutions

### Option 1: Resend (Recommended)
**Pros**: Simple API, generous free tier (3,000 emails/month), Node.js SDK
**Cost**: Free tier → $20/month (50k emails)
**Setup**: 15 minutes

```javascript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'noreply@selfpubhub.co',
  to: userEmail,
  subject: subject,
  html: htmlContent
});
```

### Option 2: SendGrid
**Pros**: Industry standard, robust, Render-recommended
**Cost**: Free tier (100 emails/day) → $19.95/month (50k emails)
**Setup**: 20 minutes

### Option 3: AWS SES
**Pros**: Most cost-effective at scale ($0.10 per 1,000 emails)
**Cost**: $0-10/month for MVP scale
**Setup**: 30 minutes (requires AWS account, domain verification)

## Implementation Plan

### 1. Install Email Provider SDK

```bash
npm install resend
# OR
npm install @sendgrid/mail
# OR
npm install @aws-sdk/client-ses
```

### 2. Add Environment Variables

```bash
# .env.local
EMAIL_PROVIDER=resend  # or 'sendgrid', 'ses'
RESEND_API_KEY=re_xxx
# OR
SENDGRID_API_KEY=SG.xxx
# OR
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=xxx
```

### 3. Update sendEmail() Function

```javascript
// src/services/email-service.js:52
export async function sendEmail({ to, subject, html, text, replyTo, env }) {
  try {
    const config = getEmailConfig(env);

    // Use configured provider
    switch (env.EMAIL_PROVIDER || 'resend') {
      case 'resend':
        return await sendViaResend({ to, subject, html, config });
      case 'sendgrid':
        return await sendViaSendGrid({ to, subject, html, config });
      case 'ses':
        return await sendViaSES({ to, subject, html, config });
      default:
        throw new Error(`Unknown email provider: ${env.EMAIL_PROVIDER}`);
    }
  } catch (error) {
    console.error('[Email] Send error:', error);
    return false;
  }
}
```

### 4. Implement Provider Functions

```javascript
async function sendViaResend({ to, subject, html, config }) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: `${config.FROM_NAME} <${config.FROM_EMAIL}>`,
    to: to,
    subject: subject,
    html: html
  });

  return true;
}
```

## Testing Checklist

- [ ] Test email verification (registration)
- [ ] Test password reset email
- [ ] Test payment confirmation email
- [ ] Test team invitation email
- [ ] Test DMCA notification email
- [ ] Verify HTML template rendering
- [ ] Test email delivery to multiple providers (Gmail, Yahoo, Outlook)
- [ ] Check spam score (mail-tester.com)
- [ ] Test email preferences (user can opt out)
- [ ] Verify sender domain authentication (SPF, DKIM, DMARC)

## Domain Setup Required

Before emails work in production:

1. **Add DNS Records** (for selfpubhub.co):
   - SPF: `v=spf1 include:_spf.resend.com ~all`
   - DKIM: Provided by Resend after domain verification
   - DMARC: `v=DMARC1; p=none; rua=mailto:admin@selfpubhub.co`

2. **Verify Domain** in email provider dashboard
3. **Test from** address: `noreply@selfpubhub.co`

## Files to Modify

1. `src/services/email-service.js` (refactor sendEmail function)
2. `package.json` (add email provider dependency)
3. `.env.local` (add API keys)
4. `server.js` (add EMAIL_PROVIDER to env object if needed)

## Acceptance Criteria

- [ ] All 12 email types send successfully
- [ ] HTML templates render correctly in major email clients
- [ ] Emails land in inbox (not spam)
- [ ] From address shows "ManuscriptHub <noreply@selfpubhub.co>"
- [ ] No references to MailChannels API remain
- [ ] Email logging works (email_log table)
- [ ] User email preferences respected
- [ ] Tests pass with email provider mock

## Rollout Strategy

1. **Week 1**: Set up Resend, verify domain, test in development
2. **Week 1**: Deploy to Render staging
3. **Week 1**: Test all 12 email types
4. **Week 2**: Production deployment
5. **Monitor**: Email delivery rate, bounce rate, spam complaints

## Cost Estimates

**Resend** (Recommended):
- Free: 3,000 emails/month → Covers ~100 active users
- $20/month: 50,000 emails/month → Covers ~1,600 active users
- Current stage: Free tier sufficient for MVP

## Related Issues

- Part of Render migration (see CLOUDFLARE-MIGRATION-AUDIT.md)
- Blocks user onboarding (email verification)
- Blocks password resets
- Blocks payment notifications
- Blocks team collaboration features

## References

- Audit report: `CLOUDFLARE-MIGRATION-AUDIT.md` (Issue #1)
- Email service: `src/services/email-service.js`
- Resend docs: https://resend.com/docs/send-with-nodejs
- SendGrid docs: https://docs.sendgrid.com/for-developers/sending-email/api-getting-started