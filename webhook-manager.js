// Webhook Manager
// Handles webhook delivery, retries, and event management

import { createHmac } from 'crypto';

export class WebhookManager {
  constructor(env) {
    this.env = env;
  }

  /**
   * Create a new webhook subscription
   * @param {string} userId - User ID
   * @param {string} url - Webhook URL
   * @param {Array} events - Event types to subscribe to
   * @param {string} secret - Optional secret for HMAC signing
   * @returns {Object} Webhook details
   */
  async create(userId, url, events, secret = null) {
    const webhookId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Generate secret if not provided
    if (!secret) {
      secret = this.generateSecret();
    }

    await this.env.DB.prepare(`
      INSERT INTO webhooks (
        id, user_id, url, events, secret, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?)
    `).bind(
      webhookId,
      userId,
      url,
      JSON.stringify(events),
      secret,
      now
    ).run();

    return {
      webhookId,
      url,
      events,
      secret, // Only shown once
      isActive: true,
      createdAt: now
    };
  }

  /**
   * Trigger a webhook event
   * @param {string} userId - User ID
   * @param {string} eventType - Event type (e.g., 'manuscript.uploaded', 'analysis.complete')
   * @param {Object} data - Event data
   */
  async trigger(userId, eventType, data) {
    // Find all active webhooks for this user subscribed to this event
    const webhooks = await this.env.DB.prepare(`
      SELECT * FROM webhooks
      WHERE user_id = ? AND is_active = 1
    `).bind(userId).all();

    for (const webhook of webhooks.results) {
      const subscribedEvents = JSON.parse(webhook.events || '[]');

      // Check if webhook is subscribed to this event
      if (subscribedEvents.includes(eventType) || subscribedEvents.includes('*')) {
        await this.deliver(webhook, eventType, data);
      }
    }
  }

  /**
   * Deliver a webhook
   * @param {Object} webhook - Webhook record
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
  async deliver(webhook, eventType, data) {
    const deliveryId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);

    const payload = {
      id: deliveryId,
      event: eventType,
      timestamp,
      data
    };

    // Create HMAC signature
    const signature = this.sign(JSON.stringify(payload), webhook.secret);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': eventType,
          'X-Webhook-Delivery-ID': deliveryId,
          'User-Agent': 'ManuscriptHub-Webhooks/1.0'
        },
        body: JSON.stringify(payload)
      });

      // Log delivery
      await this.logDelivery(webhook.id, deliveryId, eventType, response.status, null);

      // If failed, schedule retry
      if (!response.ok) {
        await this.scheduleRetry(webhook.id, deliveryId, payload, 1);
      }

    } catch (error) {
      console.error('Webhook delivery error:', error);

      // Log failed delivery
      await this.logDelivery(webhook.id, deliveryId, eventType, 0, error.message);

      // Schedule retry
      await this.scheduleRetry(webhook.id, deliveryId, payload, 1);
    }
  }

  /**
   * Schedule a webhook retry
   */
  async scheduleRetry(webhookId, deliveryId, payload, attempt) {
    const maxAttempts = 5;

    if (attempt > maxAttempts) {
      console.log(`Webhook delivery ${deliveryId} failed after ${maxAttempts} attempts`);
      return;
    }

    // Exponential backoff: 1min, 5min, 25min, 2hr, 10hr
    const delays = [60, 300, 1500, 7200, 36000];
    const delaySeconds = delays[attempt - 1] || 36000;

    // In production, use Durable Objects or Cloudflare Queues for retry scheduling
    // For now, we'll just log the retry schedule
    console.log(`Scheduling webhook retry ${attempt}/${maxAttempts} in ${delaySeconds}s for delivery ${deliveryId}`);

    // Store retry information
    await this.env.DB.prepare(`
      INSERT INTO webhook_retries (
        id, webhook_id, delivery_id, attempt, scheduled_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      webhookId,
      deliveryId,
      attempt,
      Math.floor(Date.now() / 1000) + delaySeconds,
      JSON.stringify(payload)
    ).run();
  }

  /**
   * Log webhook delivery
   */
  async logDelivery(webhookId, deliveryId, eventType, statusCode, error) {
    await this.env.DB.prepare(`
      INSERT INTO webhook_deliveries (
        id, webhook_id, delivery_id, event_type, status_code,
        error_message, delivered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      webhookId,
      deliveryId,
      eventType,
      statusCode,
      error,
      Math.floor(Date.now() / 1000)
    ).run();
  }

  /**
   * List webhooks for a user
   */
  async list(userId) {
    const webhooks = await this.env.DB.prepare(`
      SELECT id, url, events, is_active, created_at, last_delivery_at
      FROM webhooks
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(userId).all();

    return webhooks.results.map(w => ({
      webhookId: w.id,
      url: w.url,
      events: JSON.parse(w.events || '[]'),
      isActive: Boolean(w.is_active),
      createdAt: w.created_at,
      lastDeliveryAt: w.last_delivery_at
    }));
  }

  /**
   * Get webhook delivery logs
   */
  async getDeliveries(userId, webhookId, limit = 50) {
    const deliveries = await this.env.DB.prepare(`
      SELECT wd.*
      FROM webhook_deliveries wd
      JOIN webhooks w ON wd.webhook_id = w.id
      WHERE w.user_id = ? AND w.id = ?
      ORDER BY wd.delivered_at DESC
      LIMIT ?
    `).bind(userId, webhookId, limit).all();

    return deliveries.results.map(d => ({
      deliveryId: d.delivery_id,
      eventType: d.event_type,
      statusCode: d.status_code,
      success: d.status_code >= 200 && d.status_code < 300,
      errorMessage: d.error_message,
      deliveredAt: d.delivered_at
    }));
  }

  /**
   * Delete a webhook
   */
  async delete(userId, webhookId) {
    const result = await this.env.DB.prepare(`
      DELETE FROM webhooks
      WHERE id = ? AND user_id = ?
    `).bind(webhookId, userId).run();

    return result.success;
  }

  /**
   * Update webhook (enable/disable)
   */
  async update(userId, webhookId, updates) {
    const { isActive, events } = updates;

    const fields = [];
    const values = [];

    if (typeof isActive !== 'undefined') {
      fields.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }

    if (events) {
      fields.push('events = ?');
      values.push(JSON.stringify(events));
    }

    if (fields.length === 0) {
      return false;
    }

    values.push(webhookId, userId);

    const result = await this.env.DB.prepare(`
      UPDATE webhooks
      SET ${fields.join(', ')}
      WHERE id = ? AND user_id = ?
    `).bind(...values).run();

    return result.success;
  }

  /**
   * Generate webhook secret
   */
  generateSecret() {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Sign webhook payload with HMAC
   */
  sign(payload, secret) {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify webhook signature
   */
  verify(payload, signature, secret) {
    const expectedSignature = this.sign(payload, secret);
    return signature === expectedSignature;
  }
}

/**
 * Available webhook event types
 */
export const WEBHOOK_EVENTS = {
  // Manuscript events
  MANUSCRIPT_UPLOADED: 'manuscript.uploaded',
  MANUSCRIPT_UPDATED: 'manuscript.updated',
  MANUSCRIPT_DELETED: 'manuscript.deleted',

  // Analysis events
  ANALYSIS_STARTED: 'analysis.started',
  ANALYSIS_COMPLETE: 'analysis.complete',
  ANALYSIS_FAILED: 'analysis.failed',

  // Asset generation events
  ASSETS_STARTED: 'assets.started',
  ASSETS_COMPLETE: 'assets.complete',
  ASSETS_FAILED: 'assets.failed',

  // Audiobook events
  AUDIOBOOK_GENERATED: 'audiobook.generated',

  // Review events
  REVIEW_NEW: 'review.new',
  REVIEW_NEGATIVE: 'review.negative',

  // Publishing events
  PUBLISHING_STARTED: 'publishing.started',
  PUBLISHING_COMPLETE: 'publishing.complete',

  // All events
  ALL: '*'
};
