// Legacy market handler functions extracted from worker.js
// These handlers manage market analysis for manuscripts

import { MarketAnalysisAgent } from '../agents/market-analysis-agent.js';

/**
 * Handle market analysis request
 */
async function handleMarketAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { reportId, metadata = {} } = body;

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Market analysis for report:', reportId);

    // Get manuscript key from mapping
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

    if (!mappingObject) {
      return new Response(JSON.stringify({
        error: 'Report not found',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();
    console.log('Found manuscript key:', manuscriptKey);

    // Fetch the original manuscript text
    const manuscriptObj = await env.MANUSCRIPTS_RAW.get(manuscriptKey);
    if (!manuscriptObj) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract text
    const buffer = await manuscriptObj.arrayBuffer();
    const manuscriptText = new TextDecoder().decode(buffer);

    // Add word count to metadata
    metadata.wordCount = manuscriptText.split(/\s+/).length;

    // Initialize market analysis agent
    const agent = new MarketAnalysisAgent(env.ANTHROPIC_API_KEY);

    // Perform analysis
    const result = await agent.analyzeMarket(manuscriptText, metadata);

    // Generate formatted report
    const report = agent.generateReport(result.analysis);

    // Store analysis results in R2
    await env.MANUSCRIPTS_PROCESSED.put(
      `${manuscriptKey}-market-analysis.json`,
      JSON.stringify({
        reportId,
        analysis: result.analysis,
        report,
        metadata: result.metadata,
        timestamp: new Date().toISOString()
      }),
      {
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );

    console.log('Market analysis completed and stored');

    return new Response(JSON.stringify({
      success: true,
      reportId,
      summary: report.summary,
      duration: result.metadata.duration
    }), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Market analysis error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get market analysis results
 */
async function handleGetMarketAnalysis(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId') || url.searchParams.get('id');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get manuscript key from mapping
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

    if (!mappingObject) {
      return new Response(JSON.stringify({
        error: 'Report not found',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();

    // Fetch market analysis results
    const analysisObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-market-analysis.json`);

    if (!analysisObj) {
      return new Response(JSON.stringify({
        error: 'Market analysis not found. Run /analyze-market first.',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const analysisData = await analysisObj.json();

    return new Response(JSON.stringify(analysisData), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching market analysis:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export {
  handleMarketAnalysis,
  handleGetMarketAnalysis
};
