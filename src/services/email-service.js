/**
 * Email Service for Manuscript Platform
 * Uses Resend API (Render-compatible email delivery)
 *
 * Handles:
 * - DMCA notification emails
 * - User verification emails
 * - Password reset emails
 * - Admin alerts
 * - Payment notifications
 * - Team invitations
 */

import { Resend } from 'resend';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Email configuration (defaults, can be overridden by environment variables)
const EMAIL_CONFIG = {
  FROM_EMAIL: 'noreply@selfpubhub.co',
  FROM_NAME: 'ManuscriptHub',
  ADMIN_EMAIL: 'scarter4work@yahoo.com', // Admin email for notifications
  REPLY_TO: 'support@selfpubhub.co',
};

// Get email config from environment or use defaults
function getEmailConfig(env) {
  return {
    FROM_EMAIL: env?.EMAIL_FROM_ADDRESS || EMAIL_CONFIG.FROM_EMAIL,
    FROM_NAME: env?.EMAIL_FROM_NAME || EMAIL_CONFIG.FROM_NAME,
    ADMIN_EMAIL: env?.EMAIL_ADMIN_ADDRESS || EMAIL_CONFIG.ADMIN_EMAIL,
    REPLY_TO: env?.EMAIL_REPLY_TO_ADDRESS || EMAIL_CONFIG.REPLY_TO,
  };
}

// ============================================================================
// EMAIL SENDING
// ============================================================================

/**
 * Send an email using Resend API
 *
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML content
 * @param {string} params.text - Plain text content (optional)
 * @param {string} params.replyTo - Reply-to email (optional)
 * @param {Object} params.env - Environment object (optional, for config)
 * @returns {Promise<boolean>} True if sent successfully
 */
export async function sendEmail({ to, subject, html, text, replyTo, env }) {
  try {
    const config = getEmailConfig(env);

    // Initialize Resend client
    const apiKey = env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[Email] RESEND_API_KEY not configured');
      return false;
    }

    const resend = new Resend(apiKey);

    // Prepare email payload
    const emailPayload = {
      from: `${config.FROM_NAME} <${config.FROM_EMAIL}>`,
      to: to,
      subject: subject,
      html: html,
    };

    // Add plain text version if provided
    if (text) {
      emailPayload.text = text;
    }

    // Add reply-to if provided
    if (replyTo) {
      emailPayload.reply_to = replyTo;
    }

    // Send email via Resend
    const { data, error } = await resend.emails.send(emailPayload);

    if (error) {
      console.error('[Email] Resend error:', error);
      return false;
    }

    console.log(`[Email] Sent email to ${to}: ${subject} (ID: ${data?.id})`);
    return true;
  } catch (error) {
    console.error('[Email] Send error:', error);
    return false;
  }
}

// ============================================================================
// DMCA EMAIL TEMPLATES
// ============================================================================

/**
 * Generate HTML email template
 *
 * @param {string} title - Email title
 * @param {string} content - Email content (HTML)
 * @returns {string} Complete HTML email
 */
function generateEmailTemplate(title, content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px 8px 0 0;
      margin: -30px -30px 20px -30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      margin: 20px 0;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .info-box {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning-box {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .metadata {
      font-size: 14px;
      color: #666;
    }
    .metadata strong {
      color: #333;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>📚 ${title}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>ManuscriptHub - Professional Manuscript Analysis Platform</p>
      <p>
        <a href="https://dashboard.selfpubhub.co">Dashboard</a> |
        <a href="https://dashboard.selfpubhub.co/dmca-request.html">Submit DMCA Request</a>
      </p>
      <p style="margin-top: 10px;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Email to admin when new DMCA request is submitted
 */
export async function sendDMCARequestNotification(dmcaData, env) {
  const { requestId, manuscriptId, manuscriptTitle, requesterName, requesterEmail, claimDetails } = dmcaData;
  const config = getEmailConfig(env);

  const content = `
    <p>A new DMCA takedown request has been submitted and requires your review.</p>

    <div class="warning-box">
      <strong>⚠️ Action Required:</strong> Please review this request within 24 hours.
    </div>

    <div class="info-box">
      <p class="metadata"><strong>Request ID:</strong> ${requestId}</p>
      <p class="metadata"><strong>Manuscript ID:</strong> ${manuscriptId}</p>
      <p class="metadata"><strong>Manuscript Title:</strong> ${manuscriptTitle || 'Unknown'}</p>
      <p class="metadata"><strong>Requester:</strong> ${requesterName} (${requesterEmail})</p>
      <p class="metadata"><strong>Claim Details:</strong></p>
      <p style="white-space: pre-wrap; font-size: 14px;">${claimDetails}</p>
    </div>

    <p>
      <a href="https://dashboard.selfpubhub.co/admin-dmca.html" class="button">
        Review DMCA Request
      </a>
    </p>

    <p><strong>What to do:</strong></p>
    <ol>
      <li>Review the claim details and verify copyright ownership</li>
      <li>Check the manuscript for potential infringement</li>
      <li>Approve or reject the request with a resolution note</li>
    </ol>
  `;

  const html = generateEmailTemplate('New DMCA Request', content);

  return await sendEmail({
    to: config.ADMIN_EMAIL,
    subject: `🔔 New DMCA Request: ${requestId}`,
    html,
    replyTo: requesterEmail,
    env,
  });
}

/**
 * Email to copyright holder when request status changes
 */
export async function sendDMCAStatusUpdate(dmcaData, env) {
  const { requestId, requesterEmail, requesterName, status, manuscriptTitle } = dmcaData;

  const statusMessages = {
    pending: 'Your DMCA request has been received and is pending review.',
    reviewing: 'Your DMCA request is currently under review by our team.',
    resolved: 'Your DMCA request has been approved and the content has been taken down.',
    rejected: 'Your DMCA request has been rejected after review.',
  };

  const content = `
    <p>Hello ${requesterName},</p>

    <p>${statusMessages[status] || 'Your DMCA request status has been updated.'}</p>

    <div class="info-box">
      <p class="metadata"><strong>Request ID:</strong> ${requestId}</p>
      <p class="metadata"><strong>Manuscript:</strong> ${manuscriptTitle || 'Unknown'}</p>
      <p class="metadata"><strong>Status:</strong> <span style="text-transform: uppercase; color: #667eea;">${status}</span></p>
    </div>

    ${status === 'reviewing' ? `
      <p><strong>Next Steps:</strong></p>
      <p>Our team is reviewing your claim. You will receive another email once a decision is made, typically within 24-48 hours.</p>
    ` : ''}

    ${status === 'resolved' ? `
      <div class="info-box" style="border-left-color: #28a745; background: #d4edda;">
        <p><strong>✓ Content Removed:</strong> The infringing content has been removed from our platform.</p>
      </div>
    ` : ''}

    ${status === 'rejected' ? `
      <div class="warning-box">
        <p><strong>Request Rejected:</strong> After review, we determined that the content does not infringe on your copyright. If you believe this decision is incorrect, you may submit a new request with additional evidence.</p>
      </div>
    ` : ''}

    <p>
      <a href="https://dashboard.selfpubhub.co/dmca-request.html" class="button">
        Submit Another Request
      </a>
    </p>
  `;

  const html = generateEmailTemplate('DMCA Request Update', content);

  return await sendEmail({
    to: requesterEmail,
    subject: `DMCA Request ${requestId} - Status: ${status.toUpperCase()}`,
    html,
    env,
  });
}

/**
 * Email to manuscript owner when their content is flagged
 */
export async function sendDMCAOwnerNotification(ownerData, env) {
  const { ownerEmail, manuscriptTitle, manuscriptId, requestId, action } = ownerData;

  const content = `
    <p>We are writing to inform you that your manuscript has been ${action === 'flagged' ? 'flagged for review' : 'affected by'} a DMCA takedown request.</p>

    <div class="info-box">
      <p class="metadata"><strong>Manuscript:</strong> ${manuscriptTitle}</p>
      <p class="metadata"><strong>Manuscript ID:</strong> ${manuscriptId}</p>
      <p class="metadata"><strong>Request ID:</strong> ${requestId}</p>
    </div>

    ${action === 'flagged' ? `
      <div class="warning-box">
        <p><strong>Under Review:</strong> Your manuscript is currently under review for potential copyright infringement. It remains accessible while we investigate.</p>
      </div>

      <p><strong>What happens next:</strong></p>
      <ol>
        <li>Our team will review the claim within 24-48 hours</li>
        <li>If the claim is valid, the content will be removed</li>
        <li>If the claim is rejected, your content will remain published</li>
        <li>You will be notified of the final decision</li>
      </ol>
    ` : ''}

    ${action === 'removed' ? `
      <div class="warning-box">
        <p><strong>Content Removed:</strong> After reviewing a valid DMCA claim, we have removed your manuscript from our platform.</p>
      </div>

      <p><strong>If you believe this was done in error:</strong></p>
      <ol>
        <li>You may submit a counter-notice if you have permission to use the content</li>
        <li>Provide evidence of copyright ownership or license</li>
        <li>Contact our support team for assistance</li>
      </ol>
    ` : ''}

    ${action === 'cleared' ? `
      <div class="info-box" style="border-left-color: #28a745; background: #d4edda;">
        <p><strong>✓ Claim Rejected:</strong> After review, the DMCA claim against your manuscript was rejected. Your content remains published and accessible.</p>
      </div>
    ` : ''}

    <p>
      <a href="https://dashboard.selfpubhub.co" class="button">
        View Dashboard
      </a>
    </p>

    <p><strong>Questions?</strong> Contact us at support@selfpubhub.co</p>
  `;

  const html = generateEmailTemplate('DMCA Notice - Your Manuscript', content);

  return await sendEmail({
    to: ownerEmail,
    subject: `DMCA Notice: ${manuscriptTitle}`,
    html,
    env,
  });
}

// ============================================================================
// EMAIL PREFERENCE CHECKING & LOGGING
// ============================================================================

/**
 * Check if user has enabled this email type
 */
async function checkEmailPreference(userId, emailType, env) {
  try {
    const prefs = await env.DB.prepare(
      `SELECT ${emailType} FROM email_preferences WHERE user_id = ?`
    ).bind(userId).first();

    // If no preferences found, default to enabled (except for optional ones)
    if (!prefs) return true;

    return prefs[emailType] === 1;
  } catch (error) {
    console.error('[Email] Error checking preferences:', error);
    return true; // Default to sending on error
  }
}

/**
 * Log email send attempt
 */
async function logEmail({ userId, toEmail, subject, emailType, status, errorMessage, env }) {
  try {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(`
      INSERT INTO email_log (id, user_id, to_email, subject, email_type, status, sent_at, created_at, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId || null,
      toEmail,
      subject,
      emailType,
      status,
      status === 'sent' ? now : null,
      now,
      errorMessage || null
    ).run();
  } catch (error) {
    console.error('[Email] Error logging email:', error);
  }
}

/**
 * Send email with preference checking and logging
 */
async function sendNotificationEmail({ userId, to, subject, html, emailType, env }) {
  // Check user preferences (skip for critical emails)
  const criticalTypes = ['payment_failed', 'dmca_notification', 'email_verification', 'password_reset'];
  if (userId && !criticalTypes.includes(emailType)) {
    const enabled = await checkEmailPreference(userId, emailType, env);
    if (!enabled) {
      console.log(`[Email] Skipped ${emailType} for user ${userId} (disabled in preferences)`);
      return true;
    }
  }

  // Send email
  const success = await sendEmail({ to, subject, html, env });

  // Log result
  await logEmail({
    userId,
    toEmail: to,
    subject,
    emailType,
    status: success ? 'sent' : 'failed',
    errorMessage: success ? null : 'MailChannels API error',
    env
  });

  return success;
}

// ============================================================================
// ANALYSIS & ASSET NOTIFICATIONS (MAN-17)
// ============================================================================

/**
 * Email when manuscript analysis is complete
 */
export async function sendAnalysisCompleteEmail(data, env) {
  const { userEmail, manuscriptTitle, manuscriptId, reportId } = data;

  const content = `
    <p>Great news! Your manuscript analysis is complete.</p>

    <div class="info-box" style="border-left-color: #28a745; background: #d4edda;">
      <p><strong>✓ Analysis Complete:</strong> ${manuscriptTitle}</p>
    </div>

    <p>Your comprehensive analysis report includes:</p>
    <ul>
      <li><strong>Developmental Editing</strong> - Plot, character, and pacing analysis</li>
      <li><strong>Line Editing</strong> - Prose quality improvements</li>
      <li><strong>Copy Editing</strong> - Grammar and style corrections</li>
    </ul>

    <p>
      <a href="https://dashboard.selfpubhub.co/dashboard-spa.html#report/${reportId}" class="button">
        View Analysis Report
      </a>
    </p>

    <p><strong>Next Steps:</strong></p>
    <ol>
      <li>Review the detailed analysis and recommendations</li>
      <li>Download the annotated manuscript with inline edits</li>
      <li>Generate marketing assets for your manuscript</li>
    </ol>
  `;

  const html = generateEmailTemplate('Analysis Complete', content);

  return await sendNotificationEmail({
    userId: data.userId,
    to: userEmail,
    subject: `✅ Analysis Complete: ${manuscriptTitle}`,
    html,
    emailType: 'analysis_complete',
    env
  });
}

/**
 * Email when asset generation is complete
 */
export async function sendAssetGenerationCompleteEmail(data, env) {
  const { userEmail, manuscriptTitle, manuscriptId, assetTypes } = data;

  const assetList = assetTypes.map(type => {
    const names = {
      description: 'Book Description',
      keywords: 'Amazon Keywords',
      categories: 'BISAC Categories',
      author_bio: 'Author Biography',
      back_matter: 'Back Matter',
      cover_design: 'Cover Design Brief',
      series_description: 'Series Description'
    };
    return `<li>${names[type] || type}</li>`;
  }).join('');

  const content = `
    <p>Your marketing assets are ready!</p>

    <div class="info-box" style="border-left-color: #28a745; background: #d4edda;">
      <p><strong>✓ Assets Generated:</strong> ${manuscriptTitle}</p>
    </div>

    <p><strong>Generated Assets:</strong></p>
    <ul>
      ${assetList}
    </ul>

    <p>
      <a href="https://dashboard.selfpubhub.co/dashboard-spa.html#assets/${manuscriptId}" class="button">
        View & Download Assets
      </a>
    </p>

    <p><strong>What you can do now:</strong></p>
    <ol>
      <li>Review and customize the generated content</li>
      <li>Download assets for your publishing platform</li>
      <li>Copy keywords and categories for Amazon KDP</li>
    </ol>
  `;

  const html = generateEmailTemplate('Marketing Assets Ready', content);

  return await sendNotificationEmail({
    userId: data.userId,
    to: userEmail,
    subject: `🎨 Marketing Assets Ready: ${manuscriptTitle}`,
    html,
    emailType: 'asset_generation_complete',
    env
  });
}

// ============================================================================
// PAYMENT NOTIFICATIONS (MAN-17)
// ============================================================================

/**
 * Email for successful payment/subscription
 */
export async function sendPaymentConfirmationEmail(data, env) {
  const { userEmail, planName, amount, interval, nextBillingDate } = data;

  const content = `
    <p>Thank you for your subscription!</p>

    <div class="info-box" style="border-left-color: #28a745; background: #d4edda;">
      <p><strong>✓ Payment Confirmed</strong></p>
    </div>

    <div class="info-box">
      <p class="metadata"><strong>Plan:</strong> ${planName}</p>
      <p class="metadata"><strong>Amount:</strong> $${amount}</p>
      <p class="metadata"><strong>Billing:</strong> ${interval}</p>
      ${nextBillingDate ? `<p class="metadata"><strong>Next Billing Date:</strong> ${nextBillingDate}</p>` : ''}
    </div>

    <p>
      <a href="https://dashboard.selfpubhub.co/billing.html" class="button">
        Manage Subscription
      </a>
    </p>

    <p><strong>What's included in your plan:</strong></p>
    <ul>
      <li>AI-powered manuscript analysis</li>
      <li>Marketing asset generation</li>
      <li>Priority support</li>
      ${planName.includes('Enterprise') ? '<li>Team collaboration (5 members)</li>' : ''}
    </ul>
  `;

  const html = generateEmailTemplate('Payment Confirmation', content);

  return await sendNotificationEmail({
    userId: data.userId,
    to: userEmail,
    subject: `✅ Payment Confirmed - ${planName}`,
    html,
    emailType: 'payment_confirmation',
    env
  });
}

/**
 * Email when payment fails (CRITICAL - always send)
 */
export async function sendPaymentFailedEmail(data, env) {
  const { userEmail, planName, amount, reason, retryDate } = data;

  const content = `
    <div class="warning-box">
      <p><strong>⚠️ Payment Failed</strong></p>
    </div>

    <p>We were unable to process your payment for your ${planName} subscription.</p>

    <div class="info-box">
      <p class="metadata"><strong>Plan:</strong> ${planName}</p>
      <p class="metadata"><strong>Amount:</strong> $${amount}</p>
      <p class="metadata"><strong>Reason:</strong> ${reason || 'Payment declined'}</p>
      ${retryDate ? `<p class="metadata"><strong>Retry Date:</strong> ${retryDate}</p>` : ''}
    </div>

    <p><strong>Action Required:</strong></p>
    <ol>
      <li>Update your payment method in the billing portal</li>
      <li>Ensure your card has sufficient funds</li>
      <li>Check that your billing information is correct</li>
    </ol>

    <p>
      <a href="https://dashboard.selfpubhub.co/billing.html" class="button">
        Update Payment Method
      </a>
    </p>

    <div class="warning-box">
      <p><strong>Important:</strong> Your subscription will be cancelled if payment is not received within 7 days.</p>
    </div>
  `;

  const html = generateEmailTemplate('Payment Failed - Action Required', content);

  return await sendNotificationEmail({
    userId: data.userId,
    to: userEmail,
    subject: `⚠️ Payment Failed - Action Required`,
    html,
    emailType: 'payment_failed',
    env
  });
}

/**
 * Email for usage warnings
 */
export async function sendUsageWarningEmail(data, env) {
  const { userEmail, manuscriptsUsed, manuscriptsLimit, percentageUsed, planName } = data;

  const content = `
    <div class="warning-box">
      <p><strong>⚠️ Manuscript Limit Warning</strong></p>
    </div>

    <p>You're approaching your manuscript limit for the ${planName} plan.</p>

    <div class="info-box">
      <p class="metadata"><strong>Usage:</strong> ${manuscriptsUsed} of ${manuscriptsLimit} manuscripts (${percentageUsed}%)</p>
      <p class="metadata"><strong>Current Plan:</strong> ${planName}</p>
    </div>

    ${percentageUsed >= 100 ? `
      <div class="warning-box">
        <p><strong>Limit Reached:</strong> You've reached your manuscript limit. Upgrade to continue analyzing manuscripts.</p>
      </div>
    ` : `
      <p>You have ${manuscriptsLimit - manuscriptsUsed} manuscripts remaining this month.</p>
    `}

    <p><strong>Options:</strong></p>
    <ol>
      <li>Upgrade to a higher plan for more manuscripts</li>
      <li>Wait until your limit resets next billing cycle</li>
      <li>Delete old manuscripts to free up space</li>
    </ol>

    <p>
      <a href="https://dashboard.selfpubhub.co/billing.html" class="button">
        Upgrade Plan
      </a>
    </p>
  `;

  const html = generateEmailTemplate('Usage Warning', content);

  return await sendNotificationEmail({
    userId: data.userId,
    to: userEmail,
    subject: `⚠️ ${percentageUsed >= 100 ? 'Limit Reached' : 'Approaching Limit'} - ${manuscriptsUsed}/${manuscriptsLimit} Manuscripts`,
    html,
    emailType: 'usage_warning',
    env
  });
}

// ============================================================================
// TEAM COLLABORATION EMAILS (MAN-13 + MAN-17)
// ============================================================================

/**
 * Email for team invitations
 */
export async function sendTeamInvitationEmail(data, env) {
  const { toEmail, teamName, inviterName, role, invitationToken } = data;

  const roleDescriptions = {
    admin: 'manage the team and all manuscripts',
    editor: 'view and edit shared manuscripts',
    viewer: 'view shared manuscripts (read-only)'
  };

  const content = `
    <p>${inviterName} has invited you to join their team on ManuscriptHub!</p>

    <div class="info-box">
      <p class="metadata"><strong>Team:</strong> ${teamName}</p>
      <p class="metadata"><strong>Your Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
      <p class="metadata"><strong>Permissions:</strong> You can ${roleDescriptions[role]}</p>
    </div>

    <p><strong>What is team collaboration?</strong></p>
    <p>Collaborate with editors, co-authors, and reviewers. Share manuscripts, get feedback, and work together on your writing projects.</p>

    <p>
      <a href="https://dashboard.selfpubhub.co/teams/accept-invitation/${invitationToken}" class="button">
        Accept Invitation
      </a>
    </p>

    <p><small>This invitation expires in 7 days.</small></p>
  `;

  const html = generateEmailTemplate('Team Invitation', content);

  return await sendNotificationEmail({
    userId: null, // Recipient might not be a user yet
    to: toEmail,
    subject: `👥 You've been invited to join ${teamName}`,
    html,
    emailType: 'team_invitation',
    env
  });
}

/**
 * Email for team activity updates
 */
export async function sendTeamActivityEmail(data, env) {
  const { userEmail, teamName, activityType, actorName, details } = data;

  const activityMessages = {
    member_added: `${actorName} added a new member to ${teamName}`,
    member_removed: `${actorName} removed a member from ${teamName}`,
    manuscript_shared: `${actorName} shared a manuscript with ${teamName}`,
    role_changed: `${actorName} changed your role in ${teamName}`
  };

  const content = `
    <p>${activityMessages[activityType] || 'Team activity update'}</p>

    <div class="info-box">
      <p class="metadata"><strong>Team:</strong> ${teamName}</p>
      <p class="metadata"><strong>Activity:</strong> ${activityType.replace('_', ' ').toUpperCase()}</p>
      ${details ? `<p class="metadata"><strong>Details:</strong> ${details}</p>` : ''}
    </div>

    <p>
      <a href="https://dashboard.selfpubhub.co/teams.html" class="button">
        View Team Dashboard
      </a>
    </p>
  `;

  const html = generateEmailTemplate('Team Activity', content);

  return await sendNotificationEmail({
    userId: data.userId,
    to: userEmail,
    subject: `Team Update: ${teamName}`,
    html,
    emailType: 'team_activity',
    env
  });
}

// ============================================================================
// AUTHENTICATION EMAILS
// ============================================================================

/**
 * Email for email verification (registration)
 */
export async function sendEmailVerification(data, env) {
  const { userEmail, userName, verificationToken } = data;

  const verificationUrl = `${env.FRONTEND_URL || 'https://selfpubhub.co'}/verify-email.html?token=${verificationToken}`;

  const content = `
    <p>Welcome to ManuscriptHub, ${userName || 'Author'}!</p>

    <p>Thank you for registering your account. To get started, please verify your email address by clicking the button below:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" class="button">
        Verify Email Address
      </a>
    </div>

    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #007bff; font-size: 14px;">${verificationUrl}</p>

    <div class="info-box">
      <p><strong>Why verify?</strong></p>
      <ul style="margin: 5px 0;">
        <li>Secure your account</li>
        <li>Receive important notifications</li>
        <li>Enable password reset functionality</li>
      </ul>
    </div>

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px; margin: 5px 0;">
        <strong>Security Notice:</strong> This verification link expires in 24 hours.
      </p>
      <p style="color: #666; font-size: 12px; margin: 5px 0;">
        If you didn't create this account, please ignore this email or contact support.
      </p>
    </div>
  `;

  const html = generateEmailTemplate('Verify Your Email', content);

  return await sendNotificationEmail({
    userId: data.userId,
    to: userEmail,
    subject: `📧 Verify Your Email - ManuscriptHub`,
    html,
    emailType: 'email_verification',
    env
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export const emailService = {
  sendEmail,
  sendNotificationEmail,
  // Authentication
  sendEmailVerification,
  // DMCA
  sendDMCARequestNotification,
  sendDMCAStatusUpdate,
  sendDMCAOwnerNotification,
  // Analysis & Assets
  sendAnalysisCompleteEmail,
  sendAssetGenerationCompleteEmail,
  // Payments
  sendPaymentConfirmationEmail,
  sendPaymentFailedEmail,
  sendUsageWarningEmail,
  // Team Collaboration
  sendTeamInvitationEmail,
  sendTeamActivityEmail,
};
