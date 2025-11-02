// Shared utilities for AI agents
// This file contains common functions used by multiple agent classes

import { logClaudeAPICost } from './cost-utils.js';

/**
 * Configuration constants for AI agents
 * Centralized so they can be easily changed across all agents
 */
export const AGENT_CONFIG = {
  // Claude API configuration
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
  ANTHROPIC_VERSION: '2023-06-01',

  // Cloudflare AI Gateway URL (shared across all agents)
  GATEWAY_URL: 'https://gateway.ai.cloudflare.com/v1/8cd795daa8ce3c17078fe6cf3a2de8e3/manuscript-ai-gateway/anthropic/v1/messages',

  // Token limits
  MAX_TOKENS: 4096, // Maximum tokens for Claude responses

  // Manuscript processing
  EXCERPT_LENGTH: 5000, // Characters to extract from manuscript for context

  // Retry configuration
  MAX_RETRIES: 5, // Number of retry attempts
  BASE_WAIT_TIME: 1000, // Base wait time in ms for exponential backoff

  // Temperature settings (higher = more creative)
  TEMPERATURE: {
    CREATIVE: 0.8, // For cover design, series planning, creative writing
    BALANCED: 0.7, // For author bios, marketing copy
    PRECISE: 0.5   // For technical analysis, categories
  }
};

/**
 * Extract text content from a manuscript stored in R2
 * Handles different file formats (currently supports text/plain)
 *
 * @param {R2Object} manuscript - The manuscript object from R2
 * @param {number} maxLength - Maximum number of characters to extract (default: EXCERPT_LENGTH)
 * @returns {Promise<string>} The extracted text content
 * @throws {Error} If file type is unsupported
 */
export async function extractManuscriptText(manuscript, maxLength = AGENT_CONFIG.EXCERPT_LENGTH) {
  // Get the content type from the manuscript metadata
  const contentType = manuscript.httpMetadata?.contentType;
  const buffer = await manuscript.arrayBuffer();

  // Currently only text/plain is supported
  // Future: Add support for PDF, DOCX, etc.
  if (contentType === 'text/plain') {
    const fullText = new TextDecoder().decode(buffer);
    // Return only the first N characters to stay within token limits
    return fullText.substring(0, maxLength);
  }

  throw new Error(`Unsupported file type: ${contentType}. Currently only text/plain is supported.`);
}

/**
 * Call Claude API with automatic retry logic
 * Handles rate limiting and transient errors with exponential backoff
 *
 * @param {string} apiKey - Anthropic API key
 * @param {string} prompt - The prompt to send to Claude
 * @param {number} temperature - Temperature setting (0-1, higher = more creative)
 * @param {string} agentName - Name of the agent (for logging)
 * @returns {Promise<Object>} Parsed JSON response from Claude
 * @throws {Error} If all retry attempts fail
 */
export async function callClaudeWithRetry(apiKey, prompt, temperature, agentName) {
  let lastError;

  // Try up to MAX_RETRIES times with exponential backoff
  for (let attempt = 1; attempt <= AGENT_CONFIG.MAX_RETRIES; attempt++) {
    try {
      console.log(`${agentName} - API call attempt ${attempt}/${AGENT_CONFIG.MAX_RETRIES}`);

      const response = await fetch(AGENT_CONFIG.GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': AGENT_CONFIG.ANTHROPIC_VERSION
        },
        body: JSON.stringify({
          model: AGENT_CONFIG.CLAUDE_MODEL,
          max_tokens: AGENT_CONFIG.MAX_TOKENS,
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: temperature
        })
      });

      console.log(`${agentName} - Response status: ${response.status}`);

      // Handle non-OK responses
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`${agentName} - Claude API error:`, errorBody);

        // Retry on rate limits (429) or server errors (500+)
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Retryable error: ${response.status} - ${errorBody}`);
        }

        // Don't retry on client errors (400-499 except 429)
        throw new Error(`Claude API error: ${response.status} - ${errorBody}`);
      }

      // Parse the successful response
      const data = await response.json();
      const responseText = data.content[0].text;

      // Extract JSON from the response (Claude sometimes adds extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);
      console.log(`${agentName} - Successfully generated response`);

      // Extract usage data for cost tracking
      const usage = {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        model: AGENT_CONFIG.CLAUDE_MODEL,
      };

      return { response: parsedResponse, usage };

    } catch (error) {
      console.error(`${agentName} - Attempt ${attempt} failed:`, error.message);
      lastError = error;

      // If we have retries left, wait before trying again
      if (attempt < AGENT_CONFIG.MAX_RETRIES) {
        // Exponential backoff: 2^attempt * BASE_WAIT_TIME
        // Attempt 1: 2s, Attempt 2: 4s, Attempt 3: 8s, etc.
        const waitTime = Math.pow(2, attempt) * AGENT_CONFIG.BASE_WAIT_TIME;
        console.log(`${agentName} - Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `${agentName} - Failed after ${AGENT_CONFIG.MAX_RETRIES} attempts. Last error: ${lastError.message}`
  );
}

/**
 * Call Claude API with cost tracking
 * Wrapper around callClaudeWithRetry that automatically logs costs to the database
 *
 * @param {string} apiKey - Anthropic API key
 * @param {string} prompt - The prompt to send to Claude
 * @param {number} temperature - Temperature setting (0-1, higher = more creative)
 * @param {string} agentName - Name of the agent (for logging)
 * @param {Object} env - Cloudflare environment (for database access)
 * @param {string} userId - User ID (optional, for cost attribution)
 * @param {string} manuscriptId - Manuscript ID (optional, for cost attribution)
 * @param {string} featureName - Feature name (e.g., 'analysis', 'asset_generation')
 * @param {string} operation - Operation name (e.g., 'analyze_developmental', 'generate_book_description')
 * @returns {Promise<Object>} Parsed JSON response from Claude (without usage)
 * @throws {Error} If all retry attempts fail
 */
export async function callClaudeWithCostTracking(
  apiKey,
  prompt,
  temperature,
  agentName,
  env,
  userId = null,
  manuscriptId = null,
  featureName,
  operation
) {
  // Call Claude API and get response + usage
  const { response, usage } = await callClaudeWithRetry(apiKey, prompt, temperature, agentName);

  // Log cost to database (fire and forget - don't block on cost tracking)
  try {
    await logClaudeAPICost(env, {
      userId,
      manuscriptId,
      featureName,
      operation,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      model: usage.model,
    });
  } catch (costError) {
    console.error(`${agentName} - Failed to log cost:`, costError);
    // Don't fail the request if cost tracking fails
  }

  // Return just the response (maintains backward compatibility)
  return response;
}

/**
 * Validate that required fields exist in an object
 * Helps catch structural issues early
 *
 * @param {Object} obj - Object to validate
 * @param {string[]} requiredFields - Array of required field names
 * @param {string} objectName - Name of the object (for error messages)
 * @throws {Error} If any required field is missing
 */
export function validateRequiredFields(obj, requiredFields, objectName) {
  const missingFields = requiredFields.filter(field => !obj[field]);

  if (missingFields.length > 0) {
    throw new Error(
      `${objectName} is missing required fields: ${missingFields.join(', ')}`
    );
  }
}

/**
 * Store generated content in R2 with consistent metadata
 *
 * @param {R2Bucket} bucket - R2 bucket to store in
 * @param {string} manuscriptKey - Key for the manuscript
 * @param {string} assetType - Type of asset (e.g., 'cover-brief')
 * @param {Object} content - Content to store
 * @returns {Promise<void>}
 */
export async function storeAsset(bucket, manuscriptKey, assetType, content) {
  const key = `${manuscriptKey}-${assetType}.json`;

  await bucket.put(
    key,
    JSON.stringify(content, null, 2), // Pretty print for readability
    {
      customMetadata: {
        assetType: assetType,
        timestamp: new Date().toISOString(),
        manuscriptKey: manuscriptKey
      },
      httpMetadata: {
        contentType: 'application/json'
      }
    }
  );

  console.log(`Stored ${assetType} in R2: ${key}`);
}
