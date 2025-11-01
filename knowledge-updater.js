/**
 * Knowledge Base Updater (MAN-50)
 *
 * Updates agent knowledge base and workflows based on documentation changes
 */

/**
 * Store new documentation version in database
 *
 * @param {string} platformId - Platform identifier
 * @param {Object} docs - Documentation from crawler
 * @param {Object} analysis - Analysis results (or null if no changes)
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<number>} - New version number
 */
export async function storeDocumentationVersion(platformId, docs, analysis, env) {
  // Get latest version number
  const latestResult = await env.DB.prepare(
    'SELECT MAX(version) as max_version FROM platform_docs WHERE platform = ?'
  ).bind(platformId).first();

  const newVersion = (latestResult?.max_version || 0) + 1;

  // Store new version
  await env.DB.prepare(`
    INSERT INTO platform_docs (
      platform, version, content, content_hash,
      analyzed_at, changes_summary, criticality
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    platformId,
    newVersion,
    docs.content,
    docs.hash,
    docs.fetchedAt,
    analysis?.summary || 'Initial version',
    analysis?.overallCriticality || null
  ).run();

  console.log(`[KnowledgeUpdater] Stored ${platformId} documentation version ${newVersion}`);

  return newVersion;
}

/**
 * Update agent knowledge base with analyzed changes
 *
 * @param {string} platformId - Platform identifier
 * @param {number} docVersion - Documentation version number
 * @param {Object} analysis - Analysis results from change-analyzer
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<number>} - Number of knowledge entries updated
 */
export async function updateAgentKnowledge(platformId, docVersion, analysis, env) {
  if (!analysis || !analysis.changes || analysis.changes.length === 0) {
    return 0;
  }

  let updateCount = 0;

  for (const change of analysis.changes) {
    // Create or update knowledge entry for this change
    const topic = `${change.category} update v${docVersion}`;

    await env.DB.prepare(`
      INSERT INTO agent_knowledge (
        platform, category, topic, content,
        last_updated, doc_version
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      platformId,
      change.category,
      topic,
      JSON.stringify({
        criticality: change.criticality,
        impact: change.impact,
        user_message: change.user_message,
        workflow_updates: change.workflow_updates || [],
      }),
      Date.now(),
      docVersion
    ).run();

    updateCount++;
  }

  console.log(`[KnowledgeUpdater] Updated ${updateCount} knowledge entries for ${platformId}`);

  return updateCount;
}

/**
 * Generate updated agent system prompt based on latest knowledge
 *
 * @param {string} platformId - Platform identifier
 * @param {string} platformName - Platform display name
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<string>} - Updated system prompt
 */
export async function generateAgentPrompt(platformId, platformName, env) {
  // Get latest workflow
  const workflow = await env.DB.prepare(`
    SELECT workflow_json FROM workflows
    WHERE platform = ? AND deprecated_at IS NULL
    ORDER BY version DESC
    LIMIT 1
  `).bind(platformId).first();

  // Get recent knowledge (last 30 days)
  const recentKnowledge = await env.DB.prepare(`
    SELECT category, topic, content, last_updated
    FROM agent_knowledge
    WHERE platform = ? AND last_updated > ?
    ORDER BY last_updated DESC
    LIMIT 10
  `).bind(platformId, Date.now() - (30 * 24 * 60 * 60 * 1000)).all();

  // Build dynamic sections
  const workflowSection = workflow ? JSON.parse(workflow.workflow_json) : null;
  const recentUpdates = recentKnowledge.results.map(k => {
    const content = JSON.parse(k.content);
    return `- ${k.topic}: ${content.user_message}`;
  }).join('\n');

  // Generate system prompt
  const prompt = `You are the ${platformName} Publishing Assistant, a specialized AI agent that helps authors navigate the ${platformName} publishing process.

# Your Role
You guide authors through the complete ${platformName} workflow, from account setup to final publication. You are an expert ONLY in ${platformName} - do not provide guidance about other platforms.

# Current Platform Requirements (Last Updated: ${new Date().toISOString()})
${recentUpdates || 'No recent updates'}

# Workflow Steps
${workflowSection ? JSON.stringify(workflowSection.steps, null, 2) : 'Workflow not yet configured'}

# Your Behavior
1. Always check user's current step before answering
2. Provide specific, actionable guidance
3. Reference exact field names, button labels, and screen locations from ${platformName}
4. If requirements changed recently (within 7 days), proactively mention the update
5. When user encounters an error, ask for the exact error message
6. Keep responses concise but complete
7. Use checklists and numbered steps for complex procedures

# Conversation Style
- Professional but friendly
- Patient and encouraging
- Never assume the user knows publishing jargon
- Celebrate progress
- Clarify ambiguity

# Out of Scope
- Do NOT provide guidance about other platforms
- Do NOT give legal advice about contracts or copyright
- Do NOT provide editing or writing advice
- If asked about other platforms, say: "I specialize in ${platformName}. For [other platform], please use that platform's dedicated assistant."

Now, help the user with their current question.`;

  return prompt;
}

/**
 * Update workflow definition based on change analysis
 *
 * @param {string} platformId - Platform identifier
 * @param {Object} analysis - Analysis results from change-analyzer
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<number|null>} - New workflow version or null if no update needed
 */
export async function updateWorkflow(platformId, analysis, env) {
  // Check if workflow update is needed
  const workflowUpdates = analysis.changes
    .filter(c => c.workflow_updates && c.workflow_updates.length > 0)
    .flatMap(c => c.workflow_updates);

  if (workflowUpdates.length === 0) {
    console.log(`[KnowledgeUpdater] No workflow updates needed for ${platformId}`);
    return null;
  }

  // Get current workflow
  const currentWorkflow = await env.DB.prepare(`
    SELECT * FROM workflows
    WHERE platform = ? AND deprecated_at IS NULL
    ORDER BY version DESC
    LIMIT 1
  `).bind(platformId).first();

  if (!currentWorkflow) {
    console.log(`[KnowledgeUpdater] No existing workflow found for ${platformId}, skipping update`);
    return null;
  }

  const workflowData = JSON.parse(currentWorkflow.workflow_json);

  // Add update notes to workflow
  workflowData.last_updated = new Date().toISOString();
  workflowData.update_notes = workflowUpdates.join('; ');

  // Create new workflow version
  const newVersion = currentWorkflow.version + 1;

  await env.DB.prepare(`
    INSERT INTO workflows (platform, version, workflow_json, estimated_duration_minutes)
    VALUES (?, ?, ?, ?)
  `).bind(
    platformId,
    newVersion,
    JSON.stringify(workflowData),
    workflowData.steps.reduce((sum, s) => sum + (s.estimated_time_minutes || 0), 0)
  ).run();

  // Deprecate old workflow
  await env.DB.prepare(`
    UPDATE workflows
    SET deprecated_at = ?
    WHERE id = ?
  `).bind(Date.now(), currentWorkflow.id).run();

  console.log(`[KnowledgeUpdater] Created workflow version ${newVersion} for ${platformId}`);

  return newVersion;
}

/**
 * Complete knowledge base update process
 *
 * @param {string} platformId - Platform identifier
 * @param {string} platformName - Platform display name
 * @param {Object} docs - Documentation from crawler
 * @param {Object} analysis - Analysis results from change-analyzer
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<Object>} - Update summary
 */
export async function performKnowledgeUpdate(platformId, platformName, docs, analysis, env) {
  const summary = {
    platformId,
    platformName,
    timestamp: Date.now(),
    docVersion: null,
    knowledgeEntriesUpdated: 0,
    workflowVersion: null,
    agentPromptGenerated: false,
  };

  try {
    // Store documentation version
    summary.docVersion = await storeDocumentationVersion(platformId, docs, analysis, env);

    // Update knowledge base
    if (analysis) {
      summary.knowledgeEntriesUpdated = await updateAgentKnowledge(platformId, summary.docVersion, analysis, env);

      // Update workflow if needed
      summary.workflowVersion = await updateWorkflow(platformId, analysis, env);
    }

    // Generate updated agent prompt
    const agentPrompt = await generateAgentPrompt(platformId, platformName, env);
    summary.agentPrompt = agentPrompt;
    summary.agentPromptGenerated = true;

    // Update platform last_crawled_at
    await env.DB.prepare(`
      UPDATE monitored_platforms
      SET last_crawled_at = ?
      WHERE id = ?
    `).bind(Date.now(), platformId).run();

    console.log(`[KnowledgeUpdater] Knowledge update complete for ${platformName}:`, {
      docVersion: summary.docVersion,
      knowledgeEntries: summary.knowledgeEntriesUpdated,
      workflowVersion: summary.workflowVersion,
    });

    return summary;
  } catch (error) {
    console.error(`[KnowledgeUpdater] Error updating knowledge for ${platformName}:`, error);
    summary.error = error.message;
    return summary;
  }
}

export default {
  storeDocumentationVersion,
  updateAgentKnowledge,
  generateAgentPrompt,
  updateWorkflow,
  performKnowledgeUpdate,
};
