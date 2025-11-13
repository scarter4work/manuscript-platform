/**
 * Cost Tracking Utilities
 *
 * Utilities for tracking and managing operational costs across the platform.
 * Supports Claude API, Cloudflare services, Stripe fees, and email costs.
 */

import { sendEmail } from '../services/email-service.js';

// ============================================================================
// COST CONSTANTS
// ============================================================================

/**
 * Claude API Pricing (as of 2025)
 * Source: https://www.anthropic.com/pricing
 */
const CLAUDE_PRICING = {
  // Claude 3.5 Sonnet (current model)
  'claude-3-5-sonnet-20241022': {
    input: 3.00 / 1_000_000,   // $3 per million input tokens
    output: 15.00 / 1_000_000,  // $15 per million output tokens
  },
  // Claude 3 Opus (most powerful)
  'claude-3-opus-20240229': {
    input: 15.00 / 1_000_000,
    output: 75.00 / 1_000_000,
  },
  // Claude 3 Haiku (fastest, cheapest)
  'claude-3-haiku-20240307': {
    input: 0.25 / 1_000_000,
    output: 1.25 / 1_000_000,
  },
};

/**
 * Cloudflare Pricing (estimates based on typical usage)
 */
const CLOUDFLARE_COSTS = {
  workers_cpu_ms: 0.000002,     // $0.02 per 10 million CPU ms
  d1_read: 0.000001,            // $0.001 per 1000 reads
  d1_write: 0.000001,           // $0.001 per 1000 writes
  r2_storage_gb_month: 0.015,   // $0.015 per GB per month
  r2_class_a: 0.0000045,        // $4.50 per million operations
  r2_class_b: 0.00000036,       // $0.36 per million operations
  kv_read: 0.0000005,           // $0.50 per million reads
  kv_write: 0.000005,           // $5.00 per million writes
  queue_operation: 0.0000004,   // $0.40 per million operations
};

/**
 * Stripe Pricing
 */
const STRIPE_FEE_RATE = 0.029;  // 2.9%
const STRIPE_FEE_FIXED = 0.30;   // $0.30 per transaction

/**
 * Email Pricing (MailChannels)
 */
const EMAIL_COST = 0.0005;       // $0.50 per 1000 emails

// ============================================================================
// COST CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate cost for Claude API call
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @param {string} model - Model name (default: claude-3-5-sonnet-20241022)
 * @returns {number} Cost in USD
 */
export function calculateClaudeAPICost(inputTokens, outputTokens, model = 'claude-3-5-sonnet-20241022') {
  const pricing = CLAUDE_PRICING[model] || CLAUDE_PRICING['claude-3-5-sonnet-20241022'];
  const inputCost = inputTokens * pricing.input;
  const outputCost = outputTokens * pricing.output;
  return inputCost + outputCost;
}

/**
 * Calculate Stripe fees for a transaction
 * @param {number} amount - Transaction amount in USD
 * @returns {number} Stripe fee in USD
 */
export function calculateStripeFee(amount) {
  return (amount * STRIPE_FEE_RATE) + STRIPE_FEE_FIXED;
}

/**
 * Calculate email cost
 * @param {number} emailCount - Number of emails sent
 * @returns {number} Cost in USD
 */
export function calculateEmailCost(emailCount) {
  return emailCount * EMAIL_COST;
}

/**
 * Estimate manuscript analysis cost (based on word count)
 * @param {number} wordCount - Manuscript word count
 * @returns {number} Estimated cost in USD
 */
export function estimateAnalysisCost(wordCount) {
  // Rough estimate: ~1.3 tokens per word
  // Analysis uses ~3 agents (dev, line, copy) each processing the full manuscript
  // Average output ~5000 tokens per agent
  const inputTokensPerAgent = wordCount * 1.3;
  const outputTokensPerAgent = 5000;
  const numAgents = 3;

  const totalInputTokens = inputTokensPerAgent * numAgents;
  const totalOutputTokens = outputTokensPerAgent * numAgents;

  return calculateClaudeAPICost(totalInputTokens, totalOutputTokens);
}

// ============================================================================
// COST TRACKING FUNCTIONS
// ============================================================================

/**
 * Log a cost event to the database
 * @param {Object} env - Cloudflare environment
 * @param {Object} costData - Cost event data
 * @returns {Promise<string>} Cost tracking ID
 */
export async function logCost(env, costData) {
  const {
    userId = null,
    manuscriptId = null,
    costCenter,
    featureName,
    operation,
    costUSD,
    tokensInput = null,
    tokensOutput = null,
    metadata = {},
  } = costData;

  const id = crypto.randomUUID();
  const createdAt = Math.floor(Date.now() / 1000);

  try {
    await env.DB.prepare(`
      INSERT INTO cost_tracking (
        id, user_id, manuscript_id, cost_center, feature_name, operation,
        cost_usd, tokens_input, tokens_output, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      userId,
      manuscriptId,
      costCenter,
      featureName,
      operation,
      costUSD,
      tokensInput,
      tokensOutput,
      JSON.stringify(metadata),
      createdAt
    ).run();

    // Update budget tracking
    await updateBudgetSpend(env, costUSD);

    // Update user cost tracking if userId provided
    if (userId) {
      await updateUserSpend(env, userId, costUSD);
    }

    console.log(`[Cost Tracking] Logged ${costCenter}/${featureName}/${operation}: $${costUSD.toFixed(4)}`);

    return id;
  } catch (error) {
    console.error('[Cost Tracking] Error logging cost:', error);
    throw error;
  }
}

/**
 * Log Claude API call cost
 * @param {Object} env - Cloudflare environment
 * @param {Object} callData - API call data
 * @returns {Promise<string>} Cost tracking ID
 */
export async function logClaudeAPICost(env, callData) {
  const {
    userId,
    manuscriptId,
    featureName,
    operation,
    inputTokens,
    outputTokens,
    model = 'claude-3-5-sonnet-20241022',
  } = callData;

  const costUSD = calculateClaudeAPICost(inputTokens, outputTokens, model);

  return await logCost(env, {
    userId,
    manuscriptId,
    costCenter: 'claude_api',
    featureName,
    operation,
    costUSD,
    tokensInput: inputTokens,
    tokensOutput: outputTokens,
    metadata: { model },
  });
}

// ============================================================================
// BUDGET MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Update platform budget spend
 * @param {Object} env - Cloudflare environment
 * @param {number} costUSD - Cost to add
 */
async function updateBudgetSpend(env, costUSD) {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    // Get current budget config
    const result = await env.DB.prepare('SELECT * FROM budget_config WHERE id = 1').all();
    const config = result.results?.[0];

    if (!config) {
      console.error('[Budget] No budget config found');
      return;
    }

    // Reset if new month
    let currentSpend = config.current_spend_usd;
    if (config.current_month !== currentMonth) {
      currentSpend = 0;
    }

    const newSpend = currentSpend + costUSD;

    // Update budget config
    await env.DB.prepare(`
      UPDATE budget_config
      SET current_spend_usd = ?, current_month = ?, updated_at = ?
      WHERE id = 1
    `).bind(newSpend, currentMonth, Math.floor(Date.now() / 1000)).run();

    // Check if we need to send alerts
    await checkBudgetAlerts(env, config, newSpend, currentMonth);

  } catch (error) {
    console.error('[Budget] Error updating spend:', error);
  }
}

/**
 * Update user cost tracking
 * @param {Object} env - Cloudflare environment
 * @param {string} userId - User ID
 * @param {number} costUSD - Cost to add
 */
async function updateUserSpend(env, userId, costUSD) {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    // Get or create user cost limit
    const userLimitResult = await env.DB.prepare(
      'SELECT * FROM user_cost_limits WHERE user_id = ?'
    ).bind(userId).all();
    let userLimit = userLimitResult.results?.[0];

    if (!userLimit) {
      // Create default limit based on user tier
      const userResult = await env.DB.prepare(
        'SELECT subscription_tier FROM users WHERE id = ?'
      ).bind(userId).all();
      const user = userResult.results?.[0];

      const defaultLimit = user?.subscription_tier === 'PRO' ? 50.00 :
                          user?.subscription_tier === 'ENTERPRISE' ? 500.00 : 5.00;

      await env.DB.prepare(`
        INSERT INTO user_cost_limits (user_id, monthly_limit_usd, current_month, current_spend_usd, updated_at)
        VALUES (?, ?, ?, 0, ?)
      `).bind(userId, defaultLimit, currentMonth, Math.floor(Date.now() / 1000)).run();

      const newUserLimitResult = await env.DB.prepare(
        'SELECT * FROM user_cost_limits WHERE user_id = ?'
      ).bind(userId).all();
      userLimit = newUserLimitResult.results?.[0];
    }

    // Reset if new month
    let currentSpend = userLimit.current_spend_usd;
    let limitExceeded = userLimit.limit_exceeded;
    if (userLimit.current_month !== currentMonth) {
      currentSpend = 0;
      limitExceeded = 0;
    }

    const newSpend = currentSpend + costUSD;
    const newLimitExceeded = newSpend >= userLimit.monthly_limit_usd ? 1 : 0;
    const exceededAt = newLimitExceeded && !limitExceeded ? Math.floor(Date.now() / 1000) : userLimit.exceeded_at;

    // Update user cost limit
    await env.DB.prepare(`
      UPDATE user_cost_limits
      SET current_spend_usd = ?, current_month = ?, limit_exceeded = ?, exceeded_at = ?, updated_at = ?
      WHERE user_id = ?
    `).bind(newSpend, currentMonth, newLimitExceeded, exceededAt, Math.floor(Date.now() / 1000), userId).run();

    if (newLimitExceeded && !limitExceeded) {
      console.warn(`[Budget] User ${userId} exceeded monthly limit: $${newSpend.toFixed(2)} / $${userLimit.monthly_limit_usd}`);
    }

  } catch (error) {
    console.error('[Budget] Error updating user spend:', error);
  }
}

/**
 * Check if budget alerts should be sent
 * @param {Object} env - Cloudflare environment
 * @param {Object} config - Current budget config
 * @param {number} newSpend - New spend amount
 * @param {string} period - Current period (YYYY-MM)
 */
async function checkBudgetAlerts(env, config, newSpend, period) {
  const percentage = (newSpend / config.monthly_limit_usd) * 100;
  const thresholds = [
    { percent: 50, enabled: config.alert_threshold_50, type: '50_percent', severity: 'info' },
    { percent: 75, enabled: config.alert_threshold_75, type: '75_percent', severity: 'warning' },
    { percent: 90, enabled: config.alert_threshold_90, type: '90_percent', severity: 'warning' },
    { percent: 100, enabled: config.alert_threshold_100, type: '100_percent', severity: 'critical' },
  ];

  for (const threshold of thresholds) {
    if (!threshold.enabled) continue;
    if (percentage < threshold.percent) continue;

    // Check if alert already sent for this threshold in this period
    const existingAlertResult = await env.DB.prepare(`
      SELECT id FROM budget_alerts
      WHERE alert_type = ? AND period = ?
    `).bind(threshold.type, period).all();
    const existingAlert = existingAlertResult.results?.[0];

    if (existingAlert) continue;

    // Send alert
    await sendBudgetAlert(env, {
      alertType: threshold.type,
      thresholdAmount: config.monthly_limit_usd * (threshold.percent / 100),
      currentSpend: newSpend,
      period,
      severity: threshold.severity,
      percentage: threshold.percent,
    });
  }
}

/**
 * Send budget alert email and log to database
 * @param {Object} env - Cloudflare environment
 * @param {Object} alertData - Alert data
 */
async function sendBudgetAlert(env, alertData) {
  const { alertType, thresholdAmount, currentSpend, period, severity, percentage } = alertData;

  const message = `
    Budget Alert: ${percentage}% threshold reached

    Current Spend: $${currentSpend.toFixed(2)}
    Monthly Limit: $${thresholdAmount.toFixed(2)}
    Period: ${period}

    ${severity === 'critical' ? '⚠️ CRITICAL: Budget limit reached!' : ''}
    ${percentage >= 100 ? 'Expensive features may be auto-disabled.' : ''}
  `.trim();

  const id = crypto.randomUUID();
  const sentAt = Math.floor(Date.now() / 1000);

  try {
    // Log alert to database
    await env.DB.prepare(`
      INSERT INTO budget_alerts (
        id, alert_type, threshold_amount_usd, current_spend_usd,
        period, message, severity, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      alertType,
      thresholdAmount,
      currentSpend,
      period,
      message,
      severity,
      sentAt
    ).run();

    // Send email to admin
    try {
      await sendEmail(env, {
        to: env.EMAIL_ADMIN_ADDRESS,
        subject: `[${severity.toUpperCase()}] Budget Alert: ${percentage}% Threshold`,
        text: message,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${severity === 'critical' ? '#dc3545' : '#ffc107'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0;">💰 Budget Alert</h1>
            </div>
            <div style="background: white; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
              <h2>${percentage}% Threshold Reached</h2>
              <p><strong>Current Spend:</strong> $${currentSpend.toFixed(2)}</p>
              <p><strong>Monthly Limit:</strong> $${thresholdAmount.toFixed(2)}</p>
              <p><strong>Period:</strong> ${period}</p>
              ${severity === 'critical' ? '<p style="color: #dc3545; font-weight: bold;">⚠️ CRITICAL: Budget limit reached!</p>' : ''}
              ${percentage >= 100 ? '<p>Expensive features may be auto-disabled.</p>' : ''}
              <p><a href="${env.FRONTEND_URL}/admin-costs.html" style="display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">View Cost Dashboard</a></p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('[Budget Alert] Failed to send email:', emailError);
    }

    console.log(`[Budget Alert] ${alertType} alert sent for period ${period}`);

  } catch (error) {
    console.error('[Budget Alert] Error sending alert:', error);
  }
}

/**
 * Check if user has exceeded their cost limit
 * @param {Object} env - Cloudflare environment
 * @param {string} userId - User ID
 * @returns {Promise<{exceeded: boolean, limit: number, spent: number}>}
 */
export async function checkUserCostLimit(env, userId) {
  try {
    const userLimitResult = await env.DB.prepare(
      'SELECT * FROM user_cost_limits WHERE user_id = ?'
    ).bind(userId).all();
    const userLimit = userLimitResult.results?.[0];

    if (!userLimit) {
      return { exceeded: false, limit: 0, spent: 0 };
    }

    return {
      exceeded: userLimit.limit_exceeded === 1,
      limit: userLimit.monthly_limit_usd,
      spent: userLimit.current_spend_usd,
    };
  } catch (error) {
    console.error('[Cost Check] Error checking user limit:', error);
    return { exceeded: false, limit: 0, spent: 0 };
  }
}

/**
 * Check if platform budget has been exceeded
 * @param {Object} env - Cloudflare environment
 * @returns {Promise<{exceeded: boolean, limit: number, spent: number}>}
 */
export async function checkPlatformBudget(env) {
  try {
    const result = await env.DB.prepare('SELECT * FROM budget_config WHERE id = 1').all();
    const config = result.results?.[0];

    if (!config) {
      return { exceeded: false, limit: 0, spent: 0 };
    }

    const exceeded = config.current_spend_usd >= config.monthly_limit_usd;

    return {
      exceeded,
      limit: config.monthly_limit_usd,
      spent: config.current_spend_usd,
      autoDisable: config.auto_disable_at_limit === 1,
    };
  } catch (error) {
    console.error('[Cost Check] Error checking platform budget:', error);
    return { exceeded: false, limit: 0, spent: 0, autoDisable: false };
  }
}
