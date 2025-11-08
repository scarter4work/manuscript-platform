/**
 * User Notification System (MAN-50)
 *
 * Notifies users about critical platform documentation changes
 */

/**
 * Get affected users for a platform change
 *
 * @param {string} platformId - Platform identifier
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<Array>} - List of affected users
 */
async function getAffectedUsers(platformId, env) {
  // Get users with active workflows for this platform
  const users = await env.DB.prepare(`
    SELECT DISTINCT
      uw.user_id,
      uw.manuscript_id,
      u.email,
      uw.current_step_id
    FROM user_workflows uw
    INNER JOIN users u ON uw.user_id = u.id
    WHERE uw.platform = ?
    AND uw.last_updated > ?
  `).bind(
    platformId,
    Date.now() - (30 * 24 * 60 * 60 * 1000) // Active in last 30 days
  ).all();

  return users.results || [];
}

/**
 * Create notification record in database
 *
 * @param {string} userId - User ID
 * @param {string} manuscriptId - Manuscript ID (optional)
 * @param {string} platformId - Platform identifier
 * @param {number} docVersion - Documentation version
 * @param {string} criticality - CRITICAL, IMPORTANT, or MINOR
 * @param {string} message - Notification message
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<number>} - Notification ID
 */
async function createNotification(userId, manuscriptId, platformId, docVersion, criticality, message, env) {
  const result = await env.DB.prepare(`
    INSERT INTO platform_change_notifications (
      user_id, manuscript_id, platform, doc_version,
      criticality, notification_type, message
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    userId,
    manuscriptId,
    platformId,
    docVersion,
    criticality,
    'dashboard', // Default to dashboard notification
    message
  ).run();

  return result.meta.last_row_id;
}

/**
 * Send email notification (placeholder - integrate with email service)
 *
 * @param {string} email - User email
 * @param {string} subject - Email subject
 * @param {string} message - Email message
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<boolean>} - Success status
 */
async function sendEmailNotification(email, subject, message, env) {
  // TODO: Integrate with email service (Resend, SendGrid, etc.)
  // For now, just log
  console.log(`[UserNotifier] EMAIL to ${email}: ${subject}\n${message}`);

  // In production, send via email service:
  // await fetch('https://api.resend.com/emails', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${env.RESEND_API_KEY}`,
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({
  //     from: 'no-reply@selfpubhub.co',
  //     to: email,
  //     subject,
  //     text: message
  //   })
  // });

  return true;
}

/**
 * Notify users about platform changes
 *
 * @param {string} platformId - Platform identifier
 * @param {string} platformName - Platform display name
 * @param {number} docVersion - Documentation version number
 * @param {Object} analysis - Analysis results from change-analyzer
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<Object>} - Notification summary
 */
export async function notifyUsers(platformId, platformName, docVersion, analysis, env) {
  if (!analysis || analysis.overallCriticality === 'MINOR') {
    console.log(`[UserNotifier] No notifications needed for ${platformName} (criticality: ${analysis?.overallCriticality})`);
    return {
      notificationsSent: 0,
      emailsSent: 0,
    };
  }

  // Get affected users
  const affectedUsers = await getAffectedUsers(platformId, env);

  console.log(`[UserNotifier] Found ${affectedUsers.length} affected users for ${platformName}`);

  if (affectedUsers.length === 0) {
    return {
      notificationsSent: 0,
      emailsSent: 0,
    };
  }

  let notificationCount = 0;
  let emailCount = 0;

  // Create notifications for each affected user
  for (const user of affectedUsers) {
    // Generate user-specific message
    const message = `${platformName} has updated their requirements.\n\n${analysis.summary}\n\nPlease review your workflow to ensure compliance with the latest requirements.`;

    // Create dashboard notification
    await createNotification(
      user.user_id,
      user.manuscript_id,
      platformId,
      docVersion,
      analysis.overallCriticality,
      message,
      env
    );
    notificationCount++;

    // Send email for critical changes
    if (analysis.overallCriticality === 'CRITICAL') {
      const emailSubject = `⚠️ Critical ${platformName} Update`;
      const emailMessage = `Hello,\n\n${platformName} has made critical changes to their publishing requirements that may affect your manuscript upload.\n\n${analysis.summary}\n\nWhat you need to do:\n${analysis.changes.filter(c => c.criticality === 'CRITICAL').map((c, i) => `${i + 1}. ${c.user_message}`).join('\n')}\n\nPlease review these changes in your dashboard.\n\nBest regards,\nManuscriptHub Team`;

      await sendEmailNotification(user.email, emailSubject, emailMessage, env);
      emailCount++;
    }
  }

  console.log(`[UserNotifier] Sent ${notificationCount} notifications and ${emailCount} emails for ${platformName}`);

  return {
    notificationsSent: notificationCount,
    emailsSent: emailCount,
    affectedUsers: affectedUsers.length,
  };
}

/**
 * Get unread notifications for a user
 *
 * @param {string} userId - User ID
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<Array>} - List of unread notifications
 */
export async function getUnreadNotifications(userId, env) {
  const notifications = await env.DB.prepare(`
    SELECT
      n.*,
      m.name as platform_name
    FROM platform_change_notifications n
    INNER JOIN monitored_platforms m ON n.platform = m.id
    WHERE n.user_id = ?
    AND n.read_at IS NULL
    ORDER BY n.sent_at DESC
  `).bind(userId).all();

  return notifications.results || [];
}

/**
 * Mark notification as read
 *
 * @param {number} notificationId - Notification ID
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<boolean>} - Success status
 */
export async function markNotificationRead(notificationId, env) {
  await env.DB.prepare(`
    UPDATE platform_change_notifications
    SET read_at = ?
    WHERE id = ?
  `).bind(Date.now(), notificationId).run();

  return true;
}

export default {
  notifyUsers,
  getUnreadNotifications,
  markNotificationRead,
};
