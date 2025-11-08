/**
 * Documentation Crawler for Platform Sources (MAN-50)
 *
 * Fetches current documentation from publishing platform help pages
 */

import crypto from 'crypto';

/**
 * Platform documentation sources configuration
 */
const PLATFORM_SOURCES = {
  kdp: {
    name: 'Amazon KDP',
    urls: [
      'https://kdp.amazon.com/help',
      'https://kdp.amazon.com/help/topic/G200635650', // Getting Started
      'https://kdp.amazon.com/help/topic/G200634390', // File Format
      'https://kdp.amazon.com/help/topic/G200644210', // Tax Information
      'https://kdp.amazon.com/help/topic/G200634560', // Pricing
    ],
    timeout: 30000,
  },
  d2d: {
    name: 'Draft2Digital',
    urls: [
      'https://draft2digital.com/knowledge-base/',
      'https://draft2digital.com/faq/',
    ],
    timeout: 30000,
  },
  ingramspark: {
    name: 'IngramSpark',
    urls: [
      'https://www.ingramspark.com/hub/support',
      'https://www.ingramspark.com/hub/create-a-book',
      'https://www.ingramspark.com/hub/distribution-101',
    ],
    timeout: 30000,
  },
  apple_books: {
    name: 'Apple Books',
    urls: [
      'https://itunespartner.apple.com/books/support',
    ],
    timeout: 30000,
  },
};

/**
 * Fetch documentation from a single URL
 *
 * @param {string} url - URL to fetch
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Promise<{success: boolean, content: string, error?: string, statusCode?: number}>}
 */
async function fetchURL(url, timeout = 30000) {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ManuscriptHub-DocMonitor/1.0 (Documentation monitoring system; +https://selfpubhub.co)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        content: '',
        error: `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
        duration: Date.now() - startTime,
      };
    }

    const content = await response.text();

    return {
      success: true,
      content,
      statusCode: response.status,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      content: '',
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Extract main content from HTML (strip navigation, ads, etc.)
 *
 * @param {string} html - Raw HTML content
 * @returns {string} - Cleaned text content
 */
function extractMainContent(html) {
  // Simple content extraction - remove scripts, styles, navigation
  // In production, use a proper HTML parser like cheerio/linkedom

  let content = html;

  // Remove script tags and content
  content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and content
  content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML comments
  content = content.replace(/<!--[\s\S]*?-->/g, '');

  // Remove common navigation/footer elements by id/class
  content = content.replace(/<(nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  content = content.replace(/<div[^>]*class="(navigation|nav|sidebar|footer|header|ads|advertisement)"[^>]*>[\s\S]*?<\/div>/gi, '');

  // Remove HTML tags but keep content
  content = content.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities (basic)
  content = content.replace(/&nbsp;/g, ' ');
  content = content.replace(/&amp;/g, '&');
  content = content.replace(/&lt;/g, '<');
  content = content.replace(/&gt;/g, '>');
  content = content.replace(/&quot;/g, '"');
  content = content.replace(/&#39;/g, "'");

  // Normalize whitespace
  content = content.replace(/\s+/g, ' ');
  content = content.trim();

  return content;
}

/**
 * Calculate content hash for change detection
 *
 * @param {string} content - Content to hash
 * @returns {string} - SHA-256 hash
 */
function calculateContentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Fetch all documentation for a platform
 *
 * @param {string} platformId - Platform identifier (kdp, d2d, etc.)
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<{content: string, sources: Array, hash: string}>}
 */
export async function fetchPlatformDocs(platformId, env) {
  const platform = PLATFORM_SOURCES[platformId];

  if (!platform) {
    throw new Error(`Unknown platform: ${platformId}`);
  }

  console.log(`[DocCrawler] Fetching documentation for ${platform.name}...`);

  const results = [];
  const combinedContent = [];

  // Fetch all URLs for this platform
  for (const url of platform.urls) {
    console.log(`[DocCrawler] Fetching ${url}...`);

    const result = await fetchURL(url, platform.timeout);

    // Log fetch attempt
    await env.DB.prepare(`
      INSERT INTO doc_fetch_logs (platform, source_url, status, http_status, error_message, content_length, fetch_duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      platformId,
      url,
      result.success ? 'success' : 'failed',
      result.statusCode || null,
      result.error || null,
      result.content?.length || 0,
      result.duration
    ).run();

    if (result.success) {
      const extracted = extractMainContent(result.content);
      combinedContent.push(`\n\n=== SOURCE: ${url} ===\n\n${extracted}`);
      results.push({
        url,
        success: true,
        contentLength: extracted.length,
      });
    } else {
      console.error(`[DocCrawler] Failed to fetch ${url}:`, result.error);
      results.push({
        url,
        success: false,
        error: result.error,
      });
    }
  }

  // Combine all content
  const fullContent = combinedContent.join('\n\n');
  const contentHash = calculateContentHash(fullContent);

  console.log(`[DocCrawler] Fetched ${platform.name} docs: ${fullContent.length} characters, ${results.filter(r => r.success).length}/${results.length} sources`);

  return {
    content: fullContent,
    sources: results,
    hash: contentHash,
    fetchedAt: Date.now(),
  };
}

/**
 * Fetch documentation for all enabled platforms
 *
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<Map<string, Object>>} - Map of platformId -> docs
 */
export async function fetchAllPlatformDocs(env) {
  console.log('[DocCrawler] Fetching documentation for all platforms...');

  // Get list of enabled platforms from database
  const enabledPlatforms = await env.DB.prepare(
    'SELECT id FROM monitored_platforms WHERE crawler_enabled = 1'
  ).all();

  const results = new Map();

  // Fetch docs for each platform
  for (const { id } of enabledPlatforms.results) {
    try {
      const docs = await fetchPlatformDocs(id, env);
      results.set(id, docs);
    } catch (error) {
      console.error(`[DocCrawler] Error fetching ${id}:`, error);
      results.set(id, {
        error: error.message,
        fetchedAt: Date.now(),
      });
    }
  }

  console.log(`[DocCrawler] Completed fetching ${results.size} platforms`);

  return results;
}

/**
 * Get the latest documented version for a platform
 *
 * @param {string} platformId - Platform identifier
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<Object|null>} - Latest doc record or null
 */
export async function getLatestDocs(platformId, env) {
  const result = await env.DB.prepare(`
    SELECT * FROM platform_docs
    WHERE platform = ?
    ORDER BY version DESC
    LIMIT 1
  `).bind(platformId).first();

  return result;
}

export default {
  fetchPlatformDocs,
  fetchAllPlatformDocs,
  getLatestDocs,
  calculateContentHash,
};
