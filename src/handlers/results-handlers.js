/**
 * Results and Report Handlers
 *
 * Handlers for fetching analysis results and generating formatted reports
 */

import { ReportGenerator } from './report-generator.js';
import { AnnotatedManuscriptGenerator } from './annotated-manuscript-generator.js';

/**
 * Generate formatted HTML report
 * GET /report?id={reportId}
 */
export async function handleGenerateReport(request, env, corsHeaders) {
  const url = new URL(request.url);
  const reportId = url.searchParams.get('id');

  if (!reportId) {
    return new Response(JSON.stringify({ error: 'Report ID required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="manuscript-report-${Date.now()}.html"`
      }
    });

  } catch (error) {
    console.error('Error generating report:', error);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Generate annotated manuscript with inline highlights
 * GET /annotated?id={reportId}
 */
export async function handleGenerateAnnotatedManuscript(request, env, corsHeaders) {
  const url = new URL(request.url);
  const reportId = url.searchParams.get('id');

  if (!reportId) {
    return new Response(JSON.stringify({ error: 'Report ID required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();
    console.log('Found manuscript key from mapping:', manuscriptKey);

    // Fetch the original manuscript text
    const manuscript = await env.R2.getBucket('manuscripts_raw').get(manuscriptKey);
    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        ...corsHeaders,
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get analysis results as JSON by reportId
 * GET /results?id={reportId}
 */
export async function handleGetAnalysisResults(request, env, corsHeaders) {
  const url = new URL(request.url);
  const reportId = url.searchParams.get('id');

  if (!reportId) {
    return new Response(JSON.stringify({ error: 'Report ID required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching results:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
