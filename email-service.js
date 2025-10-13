/**
 * Email Service for Manuscript Platform
 * Uses MailChannels API (free for Cloudflare Workers)
 *
 * Handles:
 * - DMCA notification emails
 * - User verification emails
 * - Password reset emails
 * - Admin alerts
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAILCHANNELS_API = 'https://api.mailchannels.net/tx/v1/send';

// Email configuration (defaults, can be overridden by environment variables)
const EMAIL_CONFIG = {
  FROM_EMAIL: 'noreply@scarter4workmanuscripthub.com',
  FROM_NAME: 'ManuscriptHub',
  ADMIN_EMAIL: 'scarter4work@yahoo.com', // Admin email for notifications
  REPLY_TO: 'support@scarter4workmanuscripthub.com',
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
 * Send an email using MailChannels API
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

    const payload = {
      personalizations: [
        {
          to: [{ email: to }],
        },
      ],
      from: {
        email: config.FROM_EMAIL,
        name: config.FROM_NAME,
      },
      subject: subject,
      content: [
        {
          type: 'text/html',
          value: html,
        },
      ],
    };

    // Add plain text version if provided
    if (text) {
      payload.content.push({
        type: 'text/plain',
        value: text,
      });
    }

    // Add reply-to if provided
    if (replyTo) {
      payload.reply_to = {
        email: replyTo,
      };
    }

    const response = await fetch(MAILCHANNELS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Email] MailChannels error:', error);
      return false;
    }

    console.log(`[Email] Sent email to ${to}: ${subject}`);
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
        <a href="https://dashboard.scarter4workmanuscripthub.com">Dashboard</a> |
        <a href="https://dashboard.scarter4workmanuscripthub.com/dmca-request.html">Submit DMCA Request</a>
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
      <a href="https://dashboard.scarter4workmanuscripthub.com/admin-dmca.html" class="button">
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
      <a href="https://dashboard.scarter4workmanuscripthub.com/dmca-request.html" class="button">
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
      <a href="https://dashboard.scarter4workmanuscripthub.com" class="button">
        View Dashboard
      </a>
    </p>

    <p><strong>Questions?</strong> Contact us at support@scarter4workmanuscripthub.com</p>
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
// EXPORTS
// ============================================================================

export const emailService = {
  sendEmail,
  sendDMCARequestNotification,
  sendDMCAStatusUpdate,
  sendDMCAOwnerNotification,
};
