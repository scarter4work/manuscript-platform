/**
 * Structured Logging Module
 *
 * Provides consistent, structured logging across the application.
 * Logs are formatted as JSON for easy parsing and analysis.
 * Integrates with Cloudflare Logs (viewable via wrangler tail).
 *
 * Log Levels:
 * - error: Critical errors requiring immediate attention
 * - warn: Warning conditions that should be reviewed
 * - info: Informational messages about normal operations
 * - debug: Detailed information for debugging
 */

/**
 * Log levels with priority
 */
export const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * Base logging function
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {string} event - Event name/identifier
 * @param {Object} data - Additional data to log
 */
function logEvent(level, event, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data
  };

  const logString = JSON.stringify(logEntry);

  switch (level) {
    case LogLevel.ERROR:
      console.error(logString);
      break;
    case LogLevel.WARN:
      console.warn(logString);
      break;
    case LogLevel.INFO:
      console.log(logString);
      break;
    case LogLevel.DEBUG:
      console.debug(logString);
      break;
    default:
      console.log(logString);
  }
}

/**
 * Log an error event
 * @param {string} event - Event name
 * @param {Error|string} error - Error object or message
 * @param {Object} context - Additional context
 */
export function logError(event, error, context = {}) {
  const errorData = {
    message: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    ...context
  };
  logEvent(LogLevel.ERROR, event, errorData);
}

/**
 * Log a warning event
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export function logWarning(event, data = {}) {
  logEvent(LogLevel.WARN, event, data);
}

/**
 * Log an info event
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export function logInfo(event, data = {}) {
  logEvent(LogLevel.INFO, event, data);
}

/**
 * Log a debug event
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export function logDebug(event, data = {}) {
  logEvent(LogLevel.DEBUG, event, data);
}

/**
 * Log an authentication event
 * @param {string} action - Auth action (login, logout, register, etc.)
 * @param {Object} data - Auth data (userId, email, success, etc.)
 */
export function logAuth(action, data = {}) {
  logEvent(LogLevel.INFO, `auth_${action}`, data);
}

/**
 * Log a database operation
 * @param {string} operation - DB operation (query, insert, update, delete)
 * @param {Object} data - Operation data
 */
export function logDatabase(operation, data = {}) {
  logEvent(LogLevel.DEBUG, `db_${operation}`, data);
}

/**
 * Log a payment event
 * @param {string} action - Payment action (created, succeeded, failed, etc.)
 * @param {Object} data - Payment data
 */
export function logPayment(action, data = {}) {
  logEvent(LogLevel.INFO, `payment_${action}`, data);
}

/**
 * Log a file operation
 * @param {string} action - File action (upload, download, delete, etc.)
 * @param {Object} data - File data
 */
export function logFile(action, data = {}) {
  logEvent(LogLevel.INFO, `file_${action}`, data);
}

/**
 * Log a queue operation
 * @param {string} action - Queue action (sent, received, processed, failed)
 * @param {Object} data - Queue data
 */
export function logQueue(action, data = {}) {
  logEvent(LogLevel.INFO, `queue_${action}`, data);
}

/**
 * Log an API request
 * @param {Request} request - Request object
 * @param {Response} response - Response object
 * @param {number} duration - Request duration in ms
 */
export function logRequest(request, response, duration) {
  const url = new URL(request.url);
  logEvent(LogLevel.INFO, 'api_request', {
    method: request.method,
    path: url.pathname,
    status: response?.status,
    duration_ms: duration,
    user_agent: request.headers.get('user-agent'),
    cf_ray: request.headers.get('cf-ray')
  });
}

/**
 * Log a security event
 * @param {string} event - Security event (unauthorized_access, rate_limit, etc.)
 * @param {Object} data - Event data
 */
export function logSecurity(event, data = {}) {
  logEvent(LogLevel.WARN, `security_${event}`, data);
}

/**
 * Log a performance metric
 * @param {string} metric - Metric name
 * @param {number} value - Metric value
 * @param {Object} context - Additional context
 */
export function logMetric(metric, value, context = {}) {
  logEvent(LogLevel.INFO, `metric_${metric}`, {
    value,
    ...context
  });
}
