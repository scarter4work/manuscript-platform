// Legacy analysis handler functions extracted from worker.js
// These handlers manage AI analysis, report generation, and status tracking

import { DevelopmentalAgent } from '../agents/developmental-agent.js';
import { LineEditingAgent } from '../agents/line-editing-agent.js';
import { CopyEditingAgent } from '../agents/copy-editing-agent.js';
import { ReportGenerator } from '../generators/report-generator.js';
import { AnnotatedManuscriptGenerator } from '../generators/annotated-manuscript-generator.js';

// Handle developmental analysis request
async function handleDevelopmentalAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { manuscriptKey, genre } = body;

    if (!manuscriptKey) {
      return new Response(JSON.stringify({ error: 'manuscriptKey is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
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
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle line editing analysis request
async function handleLineEditingAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { manuscriptKey, genre } = body;

    if (!manuscriptKey) {
      return new Response(JSON.stringify({ error: 'manuscriptKey is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
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
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Line editing analysis error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle copy editing analysis request
async function handleCopyEditingAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { manuscriptKey, styleGuide } = body;

    if (!manuscriptKey) {
      return new Response(JSON.stringify({ error: 'manuscriptKey is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
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
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Copy editing analysis error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Get stored analysis results
async function handleGetAnalysis(request, env, corsHeaders) {
  const url = new URL(request.url);
  const manuscriptKey = url.pathname.replace('/analysis/', '');
  const processedKey = `${manuscriptKey}-analysis.json`;

  try {
    const analysis = await env.R2.getBucket('manuscripts_processed').get(processedKey);

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const analysisData = await analysis.json();

    return new Response(JSON.stringify(analysisData), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving analysis:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Generate formatted HTML report
async function handleGenerateReport(request, env, corsHeaders) {
  const url = new URL(request.url);
  const reportId = url.searchParams.get('id');

  if (!reportId) {
    return new Response(JSON.stringify({ error: 'Report ID required' }), {
      status: 400,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log('Generating report for ID:', reportId);

  try {
    // Get manuscript key from mapping
    console.log('Looking up report-id:', `report-id:${reportId}`);
    const mappingObject = await env.R2.getBucket('manuscripts_raw').get(`report-id:${reportId}`);

    if (!mappingObject) {
      console.error('No mapping found for report ID:', reportId);
      return new Response(JSON.stringify({
        error: 'Report not found',
        reportId: reportId,
        hint: 'The report ID may have expired or is invalid'
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();
    console.log('Found manuscript key from mapping:', manuscriptKey);
    // Fetch all three analyses
    console.log('Fetching analyses from R2...');
    const [devAnalysis, lineAnalysis, copyAnalysis] = await Promise.all([
      env.R2.getBucket('manuscripts_processed').get(`${manuscriptKey}-analysis.json`).then(r => r?.json()).catch(e => { console.error('Dev analysis error:', e); return null; }),
      env.R2.getBucket('manuscripts_processed').get(`${manuscriptKey}-line-analysis.json`).then(r => r?.json()).catch(e => { console.error('Line analysis error:', e); return null; }),
      env.R2.getBucket('manuscripts_processed').get(`${manuscriptKey}-copy-analysis.json`).then(r => r?.json()).catch(e => { console.error('Copy analysis error:', e); return null; })
    ]);

    console.log('Analyses fetched:', {
      hasDev: !!devAnalysis,
      hasLine: !!lineAnalysis,
      hasCopy: !!copyAnalysis
    });

    if (!devAnalysis && !lineAnalysis && !copyAnalysis) {
      return new Response(JSON.stringify({ error: 'No analysis found for this manuscript' }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get manuscript metadata
    console.log('Fetching manuscript metadata...');
    const rawManuscript = await env.R2.getBucket('manuscripts_raw').get(manuscriptKey);
    const metadata = rawManuscript?.customMetadata || { originalName: 'Unknown', authorId: 'Unknown' };
    console.log('Metadata:', metadata);

    // Generate HTML report
    console.log('Generating HTML report...');
    const reportHtml = ReportGenerator.generateFullReport(
      manuscriptKey,
      devAnalysis,
      lineAnalysis,
      copyAnalysis,
      metadata,
      reportId
    );

    console.log('Report generated, length:', reportHtml.length);

    return new Response(reportHtml, {
      status: 200,
      headers: {
        ...allHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="manuscript-report-${Date.now()}.html"`
      }
    });

  } catch (error) {
    console.error('Error generating report:', error);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack,
      manuscriptKey: manuscriptKey
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Generate annotated manuscript with inline highlights
async function handleGenerateAnnotatedManuscript(request, env, corsHeaders) {
  const url = new URL(request.url);
  const reportId = url.searchParams.get('id');

  if (!reportId) {
    return new Response(JSON.stringify({ error: 'Report ID required' }), {
      status: 400,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log('Generating annotated manuscript for ID:', reportId);

  try {
    // Get manuscript key from mapping
    console.log('Looking up report-id:', `report-id:${reportId}`);
    const mappingObject = await env.R2.getBucket('manuscripts_raw').get(`report-id:${reportId}`);

    if (!mappingObject) {
      console.error('No mapping found for report ID:', reportId);
      return new Response(JSON.stringify({
        error: 'Report not found',
        reportId: reportId,
        hint: 'The report ID may have expired or is invalid'
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();
    console.log('Found manuscript key from mapping:', manuscriptKey);
    // Fetch the original manuscript text
    const manuscript = await env.R2.getBucket('manuscripts_raw').get(manuscriptKey);
    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract text
    const buffer = await manuscript.arrayBuffer();
    const manuscriptText = new TextDecoder().decode(buffer);

    // Fetch all analyses
    const [lineAnalysis, copyAnalysis] = await Promise.all([
      env.R2.getBucket('manuscripts_processed').get(`${manuscriptKey}-line-analysis.json`).then(r => r?.json()).catch(() => null),
      env.R2.getBucket('manuscripts_processed').get(`${manuscriptKey}-copy-analysis.json`).then(r => r?.json()).catch(() => null)
    ]);

    // Combine all issues from both analyses
    const allIssues = [];

    if (lineAnalysis?.topSuggestions) {
      allIssues.push(...lineAnalysis.topSuggestions.map(issue => ({
        ...issue,
        category: 'line-editing'
      })));
    }

    if (copyAnalysis?.topIssues) {
      allIssues.push(...copyAnalysis.topIssues.map(issue => ({
        ...issue,
        category: 'copy-editing',
        original: issue.original,
        suggestion: issue.correction
      })));
    }

    console.log(`Found ${allIssues.length} total issues to annotate`);

    // Get metadata
    const metadata = manuscript.customMetadata || { originalName: 'Unknown', authorId: 'Unknown' };

    // Generate annotated HTML
    const annotatedHtml = AnnotatedManuscriptGenerator.generateAnnotatedManuscript(
      manuscriptKey,
      manuscriptText,
      allIssues,
      metadata,
      reportId
    );

    return new Response(annotatedHtml, {
      status: 200,
      headers: {
        ...allHeaders,
        'Content-Type': 'text/html; charset=utf-8'
      }
    });

  } catch (error) {
    console.error('Error generating annotated manuscript:', error);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Get analysis results as JSON by reportId
async function handleGetAnalysisResults(request, env, corsHeaders) {
  const url = new URL(request.url);
  const reportId = url.searchParams.get('id');

  if (!reportId) {
    return new Response(JSON.stringify({ error: 'Report ID required' }), {
      status: 400,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get manuscript key from mapping
    const mappingObject = await env.R2.getBucket('manuscripts_raw').get(`report-id:${reportId}`);

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

    // Fetch all three analyses
    const [devAnalysis, lineAnalysis, copyAnalysis] = await Promise.all([
      env.R2.getBucket('manuscripts_processed').get(`${manuscriptKey}-analysis.json`).then(r => r?.json()).catch(() => null),
      env.R2.getBucket('manuscripts_processed').get(`${manuscriptKey}-line-analysis.json`).then(r => r?.json()).catch(() => null),
      env.R2.getBucket('manuscripts_processed').get(`${manuscriptKey}-copy-analysis.json`).then(r => r?.json()).catch(() => null)
    ]);

    return new Response(JSON.stringify({
      success: true,
      results: {
        developmental: devAnalysis,
        lineEditing: lineAnalysis,
        copyEditing: copyAnalysis
      }
    }), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching results:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// NEW ASYNC HANDLERS

// Start async analysis (queues the job)
async function handleStartAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { manuscriptKey, genre, styleGuide, reportId } = body;

    if (!manuscriptKey || !reportId) {
      return new Response(JSON.stringify({ error: 'manuscriptKey and reportId are required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
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
    await env.QUEUE.send('analysis', {
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
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error starting analysis:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Check analysis status
async function handleAnalysisStatus(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const statusObj = await env.R2.getBucket('manuscripts_raw').get(`status:${reportId}`);

    if (!statusObj) {
      return new Response(JSON.stringify({
        error: 'Status not found',
        status: 'unknown'
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const status = await statusObj.json();

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error checking status:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export {
  handleDevelopmentalAnalysis,
  handleLineEditingAnalysis,
  handleCopyEditingAnalysis,
  handleGetAnalysis,
  handleGenerateReport,
  handleGenerateAnnotatedManuscript,
  handleGetAnalysisResults,
  handleStartAnalysis,
  handleAnalysisStatus
};
