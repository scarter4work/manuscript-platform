/**
 * Claude-Powered Change Analyzer (MAN-50)
 *
 * Uses Claude API to analyze documentation changes and determine their significance
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Build system prompt for change analysis
 *
 * @param {string} platform - Platform name
 * @returns {string} - System prompt
 */
function buildAnalysisPrompt(platform) {
  return `You are a publishing platform documentation analyst for ${platform}. Your role is to analyze changes in platform documentation and determine their impact on author workflows.

CRITICALITY LEVELS:
- CRITICAL: Changes that break existing workflows or require immediate user action (e.g., new required fields, removed features, changed file format requirements)
- IMPORTANT: Changes that affect user experience or require workflow updates (e.g., new optional features, pricing changes, updated best practices)
- MINOR: Changes that don't affect workflows (e.g., typo fixes, clarifications, formatting improvements)

CATEGORIES:
- file_format: File format requirements, specifications, validation rules
- account_setup: Account creation, tax forms, payment methods, verification
- pricing: Royalty rates, pricing rules, discount requirements
- workflow: Process steps, required actions, submission procedures
- error_handling: Error messages, troubleshooting, common issues
- general: Other changes

Analyze each change and provide:
1. Criticality (CRITICAL, IMPORTANT, or MINOR)
2. Category
3. Impact description (what changed and why it matters)
4. Required workflow updates (if any)
5. User-facing explanation (clear message for authors)`;
}

/**
 * Format changes for Claude analysis
 *
 * @param {Array<Object>} changes - Change excerpts from change detector
 * @returns {string} - Formatted changes
 */
function formatChangesForAnalysis(changes) {
  return changes.map((change, idx) => `
=== Change ${idx + 1} ===
Category: ${change.category}
Section: ${change.chunkIndex}
Change Count: ${change.changeCount}

Previous Content:
${change.oldText}

New Content:
${change.newText}
`).join('\n---\n');
}

/**
 * Analyze documentation changes using Claude API
 *
 * @param {string} platformId - Platform identifier
 * @param {string} platformName - Platform display name
 * @param {Array<Object>} changeExcerpts - Change excerpts to analyze
 * @param {string} apiKey - Claude API key
 * @returns {Promise<Object>} - Analysis results
 */
export async function analyzeChanges(platformId, platformName, changeExcerpts, apiKey) {
  if (!changeExcerpts || changeExcerpts.length === 0) {
    return {
      overallCriticality: 'MINOR',
      changes: [],
      summary: 'No significant changes detected',
    };
  }

  const anthropic = new Anthropic({ apiKey });

  const systemPrompt = buildAnalysisPrompt(platformName);
  const changesText = formatChangesForAnalysis(changeExcerpts);

  const userPrompt = `Analyze these documentation changes and determine their impact:

${changesText}

Respond in JSON format:
{
  "overall_criticality": "CRITICAL|IMPORTANT|MINOR",
  "changes": [
    {
      "change_number": number,
      "criticality": "CRITICAL|IMPORTANT|MINOR",
      "category": "file_format|account_setup|pricing|workflow|error_handling|general",
      "impact": "description of what changed and why it matters",
      "workflow_updates": ["list of required updates to checklist/workflow"],
      "user_message": "clear explanation for users"
    }
  ],
  "summary": "overall summary of changes"
}`;

  try {
    console.log(`[ChangeAnalyzer] Analyzing ${changeExcerpts.length} changes for ${platformName}...`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    });

    // Extract JSON from response
    const content = response.content[0].text;

    // Try to parse JSON (might be wrapped in markdown code blocks)
    let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      jsonMatch = content.match(/\{[\s\S]*\}/);
    }

    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Claude response');
    }

    const analysis = JSON.parse(jsonMatch[0] || jsonMatch[1]);

    console.log(`[ChangeAnalyzer] Analysis complete: ${analysis.overall_criticality} - ${analysis.summary}`);

    return {
      overallCriticality: analysis.overall_criticality,
      changes: analysis.changes || [],
      summary: analysis.summary,
      rawResponse: content,
    };
  } catch (error) {
    console.error(`[ChangeAnalyzer] Error analyzing changes:`, error);

    // Return fallback analysis
    return {
      overallCriticality: 'IMPORTANT',
      changes: changeExcerpts.map((change, idx) => ({
        change_number: idx + 1,
        criticality: 'IMPORTANT',
        category: change.category,
        impact: 'Unable to analyze automatically - manual review recommended',
        workflow_updates: [],
        user_message: `Changes detected in ${change.category} documentation. Please review manually.`,
      })),
      summary: 'Automatic analysis failed - manual review recommended',
      error: error.message,
    };
  }
}

/**
 * Determine if workflow updates are needed based on analysis
 *
 * @param {Object} analysis - Analysis results from analyzeChanges
 * @returns {boolean} - True if workflow updates needed
 */
export function requiresWorkflowUpdate(analysis) {
  if (analysis.overallCriticality === 'CRITICAL') {
    return true;
  }

  // Check if any individual change requires workflow updates
  return analysis.changes.some(
    change => change.workflow_updates && change.workflow_updates.length > 0
  );
}

/**
 * Extract workflow update instructions from analysis
 *
 * @param {Object} analysis - Analysis results from analyzeChanges
 * @returns {Array<string>} - List of workflow update instructions
 */
export function extractWorkflowUpdates(analysis) {
  const updates = [];

  for (const change of analysis.changes) {
    if (change.workflow_updates && change.workflow_updates.length > 0) {
      updates.push(...change.workflow_updates.map(update => ({
        category: change.category,
        criticality: change.criticality,
        update: update,
      })));
    }
  }

  return updates;
}

/**
 * Generate user notifications from analysis
 *
 * @param {string} platformName - Platform display name
 * @param {Object} analysis - Analysis results from analyzeChanges
 * @returns {Array<Object>} - List of notifications to send
 */
export function generateNotifications(platformName, analysis) {
  const notifications = [];

  // Overall notification if changes are significant
  if (analysis.overallCriticality === 'CRITICAL' || analysis.overallCriticality === 'IMPORTANT') {
    notifications.push({
      type: 'platform_update',
      criticality: analysis.overallCriticality,
      title: `${platformName} Documentation Updated`,
      message: analysis.summary,
      details: analysis.changes.map(c => c.user_message).join('\n\n'),
    });
  }

  // Individual notifications for critical changes
  for (const change of analysis.changes) {
    if (change.criticality === 'CRITICAL') {
      notifications.push({
        type: 'critical_change',
        criticality: 'CRITICAL',
        title: `Critical ${platformName} Update: ${change.category.replace('_', ' ')}`,
        message: change.user_message,
        impact: change.impact,
      });
    }
  }

  return notifications;
}

export default {
  analyzeChanges,
  requiresWorkflowUpdate,
  extractWorkflowUpdates,
  generateNotifications,
};
