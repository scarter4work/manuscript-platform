/**
 * Configuration constants (Originally for Cloudflare Worker)
 *
 * NOTE: R2Bucket and Cloudflare-specific references are deprecated.
 * The platform now uses Backblaze B2 via storage adapters.
 * See: src/adapters/storage-adapter.js
 *
 * Centralizes all magic numbers and configuration values for easier maintenance
 */

/**
 * File size limits for uploads
 */
export const FILE_SIZE_LIMITS = {
  MANUSCRIPT: 50 * 1024 * 1024,  // 50MB - Maximum size for manuscript files
  MARKETING_IMAGE: 10 * 1024 * 1024  // 10MB - Maximum size for marketing images
};

/**
 * Time-to-live (TTL) values for R2 storage expiration
 * All values are in seconds
 */
export const STORAGE_TTL = {
  REPORT_ID_MAPPING: 60 * 60 * 24 * 30,  // 30 days - Report ID to manuscript key mapping
  ANALYSIS_STATUS: 60 * 60 * 24 * 7       // 7 days - Analysis job status tracking
};

/**
 * Pagination and listing limits
 */
export const LIMITS = {
  FILE_LIST: 100  // Maximum number of files to return in a single list request
};

/**
 * Allowed file types for uploads
 */
export const ALLOWED_FILE_TYPES = {
  MANUSCRIPTS: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'text/plain',
    'application/epub+zip'
  ],
  IMAGES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
};

/**
 * CORS allowed origins
 * Add your production and development domains here
 */
export const ALLOWED_ORIGINS = [
  'https://selfpubhub.co',
  'https://www.selfpubhub.co',
  'https://api.selfpubhub.co',
  'http://localhost:8000', // for local testing
  'http://localhost:3000', // for local React dev
];

/**
 * Generate CORS headers based on request origin
 * @param {string} requestOrigin - Origin header from the request
 * @returns {Object} CORS headers object
 */
export function getCorsHeaders(requestOrigin) {
  return {
    'Access-Control-Allow-Origin': requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Filename, X-Author-Id, X-File-Type',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Helper function to get manuscript key from report ID
 * This is used throughout the worker to convert short report IDs to full manuscript keys
 *
 * @deprecated Use storage adapter instead of direct R2 access
 * @param {Object} bucket - Storage bucket (R2Bucket on Cloudflare, B2 adapter on Render)
 * @param {string} reportId - Short report ID (8 characters)
 * @returns {Promise<string|null>} The manuscript key or null if not found
 */
export async function getManuscriptKeyFromReportId(bucket, reportId) {
  const mappingObject = await bucket.get(`report-id:${reportId}`);
  if (!mappingObject) {
    return null;
  }
  return await mappingObject.text();
}

/**
 * Helper function to create standardized error responses
 *
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {Object} corsHeaders - CORS headers to include
 * @param {Object} additionalData - Additional data to include in the response
 * @returns {Response} JSON error response
 */
export function createErrorResponse(message, status, corsHeaders, additionalData = {}) {
  return new Response(JSON.stringify({
    error: message,
    ...additionalData
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Helper function to create standardized success responses
 *
 * @param {Object} data - Data to return
 * @param {Object} corsHeaders - CORS headers to include
 * @returns {Response} JSON success response
 */
export function createSuccessResponse(data, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
