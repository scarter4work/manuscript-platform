// AI Chat Assistant Handlers - Platform-Specific Agents with Self-Updating Knowledge
// Specialized AI agents for KDP, Draft2Digital, IngramSpark, Apple Books, etc.

import crypto from 'crypto';

/**
 * POST /chat/:platform - Send message to platform-specific AI agent
 */
export async function handleChatMessage(request, env) {
  const { platform } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { message, userWorkflowId, currentStepId, manuscriptId } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get agent configuration
    const agentConfig = await env.DB.prepare(`
      SELECT * FROM agent_config WHERE platform = ? AND is_active = 1
    `).bind(platform).first();

    if (!agentConfig) {
      return new Response(JSON.stringify({ error: 'Agent not found for platform' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user workflow context (if provided)
    let workflowContext = null;
    if (userWorkflowId) {
      workflowContext = await env.DB.prepare(`
        SELECT uw.*, w.steps, w.workflow_name
        FROM user_workflows uw
        JOIN workflows w ON uw.workflow_id = w.id
        WHERE uw.id = ? AND uw.user_id = ?
      `).bind(userWorkflowId, userId).first();
    }

    // Get recent conversation history (last 10 messages)
    const conversationHistory = await env.DB.prepare(`
      SELECT role, message, current_step_id
      FROM agent_conversations
      WHERE user_id = ? AND platform = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(userId, platform).all();

    // Build context for Claude API
    const systemPrompt = buildSystemPrompt(agentConfig, workflowContext, currentStepId);
    const conversationMessages = conversationHistory.results?.reverse().map(msg => ({
      role: msg.role,
      content: msg.message
    })) || [];

    // Add current user message
    conversationMessages.push({
      role: 'user',
      content: message
    });

    // Call Claude API
    const claudeResponse = await callClaudeAPI(
      env,
      systemPrompt,
      conversationMessages
    );

    if (!claudeResponse.success) {
      throw new Error(claudeResponse.error || 'Claude API call failed');
    }

    // Save user message
    const userMessageId = `msg-${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO agent_conversations (
        id, user_id, platform, user_workflow_id, role, message,
        current_step_id, context_metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userMessageId,
      userId,
      platform,
      userWorkflowId || null,
      'user',
      message,
      currentStepId || null,
      JSON.stringify({ manuscriptId }),
      Math.floor(Date.now() / 1000)
    ).run();

    // Save assistant response
    const assistantMessageId = `msg-${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO agent_conversations (
        id, user_id, platform, user_workflow_id, role, message,
        current_step_id, response_type, model_used, tokens_used, cost, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      assistantMessageId,
      userId,
      platform,
      userWorkflowId || null,
      'assistant',
      claudeResponse.message,
      currentStepId || null,
      'guidance', // Could be determined by message analysis
      claudeResponse.model,
      claudeResponse.tokensUsed,
      claudeResponse.cost,
      Math.floor(Date.now() / 1000)
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: claudeResponse.message,
      messageId: assistantMessageId,
      tokensUsed: claudeResponse.tokensUsed,
      cost: claudeResponse.cost
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleChatMessage:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process chat message',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /chat/:platform/history - Get conversation history
 */
export async function handleGetChatHistory(request, env) {
  const { platform } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;

    const history = await env.DB.prepare(`
      SELECT * FROM agent_conversations
      WHERE user_id = ? AND platform = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(userId, platform, limit).all();

    return new Response(JSON.stringify({
      success: true,
      history: history.results?.reverse() || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleGetChatHistory:', error);
    return new Response(JSON.stringify({ error: 'Failed to get chat history' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /workflows/:platform/start - Start a workflow for user
 */
export async function handleStartWorkflow(request, env) {
  const { platform } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { manuscriptId } = body;

    // Get active workflow for platform
    const workflow = await env.DB.prepare(`
      SELECT * FROM workflows
      WHERE platform = ? AND is_active = 1
      ORDER BY version DESC
      LIMIT 1
    `).bind(platform).first();

    if (!workflow) {
      return new Response(JSON.stringify({ error: 'No active workflow found for platform' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create user workflow
    const userWorkflowId = `uw-${crypto.randomUUID()}`;
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      INSERT INTO user_workflows (
        id, user_id, manuscript_id, workflow_id, platform,
        current_step_id, steps_completed, status,
        started_at, last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userWorkflowId,
      userId,
      manuscriptId || null,
      workflow.id,
      platform,
      null, // Will be set when first step starts
      '[]', // Empty array of completed steps
      'in_progress',
      now,
      now,
      now,
      now
    ).run();

    return new Response(JSON.stringify({
      success: true,
      userWorkflowId,
      workflow: {
        id: workflow.id,
        name: workflow.workflow_name,
        description: workflow.workflow_description,
        steps: JSON.parse(workflow.steps)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleStartWorkflow:', error);
    return new Response(JSON.stringify({
      error: 'Failed to start workflow',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /workflows/:platform - Get workflow definition for platform
 */
export async function handleGetWorkflow(request, env) {
  const { platform } = request.params;

  try {
    const workflow = await env.DB.prepare(`
      SELECT * FROM workflows
      WHERE platform = ? AND is_active = 1
      ORDER BY version DESC
      LIMIT 1
    `).bind(platform).first();

    if (!workflow) {
      return new Response(JSON.stringify({ error: 'Workflow not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      workflow: {
        id: workflow.id,
        platform: workflow.platform,
        name: workflow.workflow_name,
        description: workflow.workflow_description,
        steps: JSON.parse(workflow.steps),
        version: workflow.version
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleGetWorkflow:', error);
    return new Response(JSON.stringify({ error: 'Failed to get workflow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /workflows/:platform/progress - Update user workflow progress
 */
export async function handleUpdateWorkflowProgress(request, env) {
  const { platform } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { userWorkflowId, currentStepId, completedStepId, status } = body;

    // Get current workflow
    const userWorkflow = await env.DB.prepare(`
      SELECT * FROM user_workflows
      WHERE id = ? AND user_id = ?
    `).bind(userWorkflowId, userId).first();

    if (!userWorkflow) {
      return new Response(JSON.stringify({ error: 'Workflow not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update completed steps if provided
    let stepsCompleted = JSON.parse(userWorkflow.steps_completed || '[]');
    if (completedStepId && !stepsCompleted.includes(completedStepId)) {
      stepsCompleted.push(completedStepId);
    }

    // Determine if workflow is completed
    const workflow = await env.DB.prepare(`
      SELECT steps FROM workflows WHERE id = ?
    `).bind(userWorkflow.workflow_id).first();

    const workflowSteps = JSON.parse(workflow.steps);
    const allStepsCompleted = workflowSteps.every(step =>
      stepsCompleted.includes(step.stepId)
    );

    const newStatus = status || (allStepsCompleted ? 'completed' : userWorkflow.status);
    const completedAt = allStepsCompleted ? Math.floor(Date.now() / 1000) : null;

    // Update workflow
    await env.DB.prepare(`
      UPDATE user_workflows
      SET current_step_id = ?,
          steps_completed = ?,
          status = ?,
          completed_at = ?,
          last_activity_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(
      currentStepId || userWorkflow.current_step_id,
      JSON.stringify(stepsCompleted),
      newStatus,
      completedAt,
      Math.floor(Date.now() / 1000),
      userWorkflowId,
      userId
    ).run();

    return new Response(JSON.stringify({
      success: true,
      workflow: {
        id: userWorkflowId,
        currentStepId: currentStepId || userWorkflow.current_step_id,
        stepsCompleted,
        status: newStatus,
        completedAt
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleUpdateWorkflowProgress:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update workflow progress',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /workflows/user - Get all user workflows
 */
export async function handleGetUserWorkflows(request, env) {
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const workflows = await env.DB.prepare(`
      SELECT uw.*, w.workflow_name, w.platform
      FROM user_workflows uw
      JOIN workflows w ON uw.workflow_id = w.id
      WHERE uw.user_id = ?
      ORDER BY uw.last_activity_at DESC
    `).bind(userId).all();

    return new Response(JSON.stringify({
      success: true,
      workflows: workflows.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleGetUserWorkflows:', error);
    return new Response(JSON.stringify({ error: 'Failed to get user workflows' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /agent/:platform/config - Get agent configuration
 */
export async function handleGetAgentConfig(request, env) {
  const { platform } = request.params;

  try {
    const config = await env.DB.prepare(`
      SELECT * FROM agent_config WHERE platform = ? AND is_active = 1
    `).bind(platform).first();

    if (!config) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      agent: {
        platform: config.platform,
        name: config.agent_name,
        description: config.agent_description,
        tone: config.tone,
        expertiseLevel: config.expertise_level
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleGetAgentConfig:', error);
    return new Response(JSON.stringify({ error: 'Failed to get agent config' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /docs/crawl/:platform - Trigger documentation crawl (for scheduled cron)
 */
export async function handleCrawlPlatformDocs(request, env) {
  const { platform } = request.params;

  try {
    // Get agent config with doc sources
    const config = await env.DB.prepare(`
      SELECT * FROM agent_config WHERE platform = ? AND crawl_enabled = 1
    `).bind(platform).first();

    if (!config) {
      return new Response(JSON.stringify({ error: 'Crawl not enabled for platform' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const docSources = JSON.parse(config.doc_sources);
    const fetchLogId = `log-${crypto.randomUUID()}`;
    const fetchStartTime = Math.floor(Date.now() / 1000);

    let urlsFetched = 0;
    let urlsFailed = 0;
    let changesDetected = 0;
    let newDocsAdded = 0;

    // Fetch each doc source
    for (const source of docSources) {
      try {
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'ManuscriptPlatform-DocCrawler/1.0',
            'Accept': 'text/html,application/xhtml+xml'
          }
        });

        if (!response.ok) {
          urlsFailed++;
          continue;
        }

        const content = await response.text();
        const contentHash = await hashContent(content);

        // Check if doc exists with same hash
        const existingDoc = await env.DB.prepare(`
          SELECT id, content_hash FROM platform_docs
          WHERE platform = ? AND doc_type = ? AND source_url = ?
          ORDER BY version DESC LIMIT 1
        `).bind(platform, source.type, source.url).first();

        if (!existingDoc) {
          // New document
          const docId = `doc-${crypto.randomUUID()}`;
          await env.DB.prepare(`
            INSERT INTO platform_docs (
              id, platform, doc_type, source_url, title, content,
              version, content_hash, change_detected, fetched_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            docId,
            platform,
            source.type,
            source.url,
            `${platform} - ${source.type}`,
            content,
            1,
            contentHash,
            0,
            fetchStartTime,
            fetchStartTime,
            fetchStartTime
          ).run();

          newDocsAdded++;
        } else if (existingDoc.content_hash !== contentHash) {
          // Document changed!
          const newDocId = `doc-${crypto.randomUUID()}`;
          const newVersion = (existingDoc.version || 1) + 1;

          await env.DB.prepare(`
            INSERT INTO platform_docs (
              id, platform, doc_type, source_url, title, content,
              version, previous_version_id, content_hash, change_detected,
              fetched_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            newDocId,
            platform,
            source.type,
            source.url,
            `${platform} - ${source.type}`,
            content,
            newVersion,
            existingDoc.id,
            contentHash,
            1, // Change detected
            fetchStartTime,
            fetchStartTime,
            fetchStartTime
          ).run();

          changesDetected++;

          // TODO: Analyze change significance with Claude API
          // TODO: Update workflows if requirements changed
        }

        urlsFetched++;

      } catch (error) {
        console.error(`Failed to fetch ${source.url}:`, error);
        urlsFailed++;
      }
    }

    // Log fetch results
    const fetchEndTime = Math.floor(Date.now() / 1000);
    await env.DB.prepare(`
      INSERT INTO doc_fetch_log (
        id, platform, fetch_status, urls_fetched, urls_failed,
        changes_detected, new_docs_added, fetch_started_at,
        fetch_completed_at, duration_seconds, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      fetchLogId,
      platform,
      urlsFailed === 0 ? 'success' : (urlsFetched > 0 ? 'partial' : 'failed'),
      urlsFetched,
      urlsFailed,
      changesDetected,
      newDocsAdded,
      fetchStartTime,
      fetchEndTime,
      fetchEndTime - fetchStartTime,
      fetchStartTime
    ).run();

    // Update last crawl time
    await env.DB.prepare(`
      UPDATE agent_config
      SET last_crawl_at = ?, next_crawl_at = ?
      WHERE platform = ?
    `).bind(
      fetchStartTime,
      fetchStartTime + (config.crawl_frequency_hours * 3600),
      platform
    ).run();

    return new Response(JSON.stringify({
      success: true,
      platform,
      urlsFetched,
      urlsFailed,
      changesDetected,
      newDocsAdded
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleCrawlPlatformDocs:', error);
    return new Response(JSON.stringify({
      error: 'Failed to crawl platform docs',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ==================== Helper Functions ====================

/**
 * Build system prompt for Claude API with agent context
 */
function buildSystemPrompt(agentConfig, workflowContext, currentStepId) {
  let prompt = agentConfig.system_prompt;

  if (workflowContext) {
    const steps = JSON.parse(workflowContext.steps);
    const currentStep = steps.find(s => s.stepId === currentStepId);

    prompt += `\n\nUser Context:
- Current Workflow: ${workflowContext.workflow_name}
- Progress: ${JSON.parse(workflowContext.steps_completed).length} of ${steps.length} steps completed`;

    if (currentStep) {
      prompt += `\n- Current Step: ${currentStep.stepName}
- Step Description: ${currentStep.description}
- Substeps: ${currentStep.substeps.join(', ')}`;

      if (currentStep.troubleshooting) {
        prompt += `\n- Common Issues: ${Object.keys(currentStep.troubleshooting).join(', ')}`;
      }
    }
  }

  prompt += `\n\nInstructions:
- Be specific and actionable
- Reference exact field names, button labels, and platform UI elements
- Celebrate user progress
- If user mentions errors, provide troubleshooting steps
- Keep responses concise but complete`;

  return prompt;
}

/**
 * Call Claude API with conversation history
 */
async function callClaudeAPI(env, systemPrompt, messages) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return { success: false, error: 'Claude API request failed' };
    }

    const data = await response.json();

    // Calculate cost (rough estimate)
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const cost = (inputTokens * 0.003 / 1000) + (outputTokens * 0.015 / 1000);

    return {
      success: true,
      message: data.content[0]?.text || '',
      model: data.model,
      tokensUsed: inputTokens + outputTokens,
      cost
    };

  } catch (error) {
    console.error('Error calling Claude API:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Hash content for change detection
 */
async function hashContent(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
