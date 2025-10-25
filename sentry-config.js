/**
 * Sentry Error Tracking Configuration
 *
 * Provides error tracking and monitoring for production environments.
 * Integrates with Sentry.io for error aggregation and alerting.
 *
 * Environment Variables Required:
 * - SENTRY_DSN: Sentry Data Source Name (from Sentry project settings)
 * - ENVIRONMENT: Production, staging, or development
 */

/**
 * Initialize Sentry configuration
 * @param {Object} env - Environment variables
 * @returns {Object|null} Sentry configuration object or null if not configured
 */
export function initSentry(env) {
  if (!env.SENTRY_DSN) {
    console.warn('SENTRY_DSN not set, skipping Sentry initialization');
    return null;
  }

  return {
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT || 'production',
    tracesSampleRate: 0.1, // 10% of requests for performance monitoring
    release: env.RELEASE_VERSION || 'unknown',
  };
}

/**
 * Capture and log an error with context
 * @param {Error|string} error - Error object or error message
 * @param {Object} context - Additional context (userId, path, method, etc.)
 * @param {Object} env - Environment variables (for Sentry DSN)
 */
export function captureError(error, context = {}, env = {}) {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Always log to Cloudflare logs
  console.error('Error captured:', {
    timestamp: new Date().toISOString(),
    error: errorMessage,
    stack: errorStack,
    ...context
  });

  // TODO: Send to Sentry when DSN is configured
  // For now, errors are captured in Cloudflare logs and can be viewed via wrangler tail
  if (env.SENTRY_DSN) {
    // Future: Send to Sentry API
    // This will be implemented once Sentry account is set up
  }
}

/**
 * Capture a warning event
 * @param {string} message - Warning message
 * @param {Object} context - Additional context
 */
export function captureWarning(message, context = {}) {
  console.warn('Warning captured:', {
    timestamp: new Date().toISOString(),
    message,
    ...context
  });
}

/**
 * Capture an info event
 * @param {string} message - Info message
 * @param {Object} context - Additional context
 */
export function captureInfo(message, context = {}) {
  console.log('Info captured:', {
    timestamp: new Date().toISOString(),
    message,
    ...context
  });
}

/**
 * Capture a performance metric
 * @param {string} metricName - Name of the metric
 * @param {number} value - Metric value
 * @param {Object} context - Additional context
 */
export function captureMetric(metricName, value, context = {}) {
  console.log('Metric captured:', {
    timestamp: new Date().toISOString(),
    metric: metricName,
    value,
    ...context
  });
}
