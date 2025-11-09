/**
 * Analysis Handlers
 *
 * Handlers for manuscript analysis endpoints (developmental, line editing, copy editing)
 * Includes both synchronous and asynchronous (queue-based) analysis
 */

import { DevelopmentalAgent } from './developmental-agent.js';
import { LineEditingAgent } from './line-editing-agent.js';
import { CopyEditingAgent } from './copy-editing-agent.js';

// Handle developmental analysis request
export async function handleDevelopmentalAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { manuscriptKey, genre } = body;

    if (!manuscriptKey) {
      return new Response(JSON.stringify({ error: 'manuscriptKey is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize the developmental agent
    const agent = new DevelopmentalAgent(env);

    // Run analysis (this may take a while)
    console.log(`Starting developmental analysis for ${manuscriptKey}`);
    const analysis = await agent.analyze(manuscriptKey, genre || 'general');

    return new Response(JSON.stringify({
      success: true,
      analysis: analysis
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle line editing analysis request
export async function handleLineEditingAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { manuscriptKey, genre } = body;

    if (!manuscriptKey) {
      return new Response(JSON.stringify({ error: 'manuscriptKey is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize the line editing agent
    const agent = new LineEditingAgent(env);

    // Run analysis (this will take longer as it processes sections)
    console.log(`Starting line editing analysis for ${manuscriptKey}`);
    const analysis = await agent.analyze(manuscriptKey, genre || 'general');

    return new Response(JSON.stringify({
      success: true,
      analysis: analysis
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Line editing analysis error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle copy editing analysis request
export async function handleCopyEditingAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { manuscriptKey, styleGuide } = body;

    if (!manuscriptKey) {
      return new Response(JSON.stringify({ error: 'manuscriptKey is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize the copy editing agent
    const agent = new CopyEditingAgent(env);

    // Run analysis
    console.log(`Starting copy editing analysis for ${manuscriptKey}`);
    const analysis = await agent.analyze(manuscriptKey, styleGuide || 'chicago');

    return new Response(JSON.stringify({
      success: true,
      analysis: analysis
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Copy editing analysis error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Start async analysis (queues the job)
export async function handleStartAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { manuscriptKey, genre, styleGuide, reportId } = body;

    if (!manuscriptKey || !reportId) {
      return new Response(JSON.stringify({ error: 'manuscriptKey and reportId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize status
    await env.R2.getBucket('manuscripts_raw').put(
      `status:${reportId}`,
      JSON.stringify({
        status: 'queued',
        progress: 0,
        message: 'Analysis queued',
        timestamp: new Date().toISOString()
      }),
      { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
    );

    // Queue the analysis job
    await env.ANALYSIS_QUEUE.send({
      manuscriptKey,
      genre: genre || 'general',
      styleGuide: styleGuide || 'chicago',
      reportId
    });

    console.log(`Analysis queued for ${manuscriptKey}`);

    return new Response(JSON.stringify({
      success: true,
      reportId: reportId,
      message: 'Analysis started'
    }), {
      status: 202, // Accepted
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error starting analysis:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Check analysis status
export async function handleAnalysisStatus(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const statusObj = await env.R2.getBucket('manuscripts_raw').get(`status:${reportId}`);

    if (!statusObj) {
      return new Response(JSON.stringify({
        error: 'Status not found',
        status: 'unknown'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const status = await statusObj.json();

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error checking status:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
