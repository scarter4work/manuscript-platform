// Cloudflare Worker for handling manuscript uploads
// Deploy this via Cloudflare Dashboard > Workers & Pages

import { DevelopmentalAgent } from './developmental-agent.js';
import { LineEditingAgent } from './line-editing-agent.js';
import { CopyEditingAgent } from './copy-editing-agent.js';
import { ReportGenerator } from './report-generator.js';
import { AnnotatedManuscriptGenerator } from './annotated-manuscript-generator.js';

export default {
  async fetch(request, env, ctx) {
    console.log('Incoming request:', request.method, request.url);
    
    // CORS headers - Update with your actual domain
    const allowedOrigins = [
      'https://scarter4workmanuscripthub.com',
      'https://www.scarter4workmanuscripthub.com',
      'https://api.scarter4workmanuscripthub.com',
      'http://localhost:8000', // for local testing
      'http://localhost:3000', // for local React dev
    ];
    
    const origin = request.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : '*', // Allow all for dev
      'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Filename, X-Author-Id, X-File-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    console.log('Request path:', path);

    try {
      // Route: Upload raw manuscript
      if (path === '/upload/manuscript' && request.method === 'POST') {
        return await handleManuscriptUpload(request, env, corsHeaders);
      }

      // Route: Upload marketing asset
      if (path === '/upload/marketing' && request.method === 'POST') {
        return await handleMarketingUpload(request, env, corsHeaders);
      }

      // Route: Get file (with signed URL generation)
      if (path.startsWith('/get/') && request.method === 'GET') {
        return await handleFileGet(request, env, corsHeaders);
      }

      // Route: List files for an author
      if (path.startsWith('/list/') && request.method === 'GET') {
        return await handleFileList(request, env, corsHeaders);
      }

      // Route: Delete file
      if (path.startsWith('/delete/') && request.method === 'DELETE') {
        return await handleFileDelete(request, env, corsHeaders);
      }

      // Route: Analyze manuscript (Developmental Agent)
      if (path === '/analyze/developmental' && request.method === 'POST') {
        return await handleDevelopmentalAnalysis(request, env, corsHeaders);
      }

      // Route: Analyze manuscript (Line Editing Agent)
      if (path === '/analyze/line-editing' && request.method === 'POST') {
        return await handleLineEditingAnalysis(request, env, corsHeaders);
      }

      // Route: Analyze manuscript (Copy Editing Agent)
      if (path === '/analyze/copy-editing' && request.method === 'POST') {
        return await handleCopyEditingAnalysis(request, env, corsHeaders);
      }

      // Route: Get analysis results
      if (path.startsWith('/analysis/') && request.method === 'GET') {
        return await handleGetAnalysis(request, env, corsHeaders);
      }

      // Route: Generate formatted report
      if (path === '/report' && request.method === 'GET') {
        return await handleGenerateReport(request, env, corsHeaders);
      }

      // Route: Generate annotated manuscript
      if (path === '/annotated' && request.method === 'GET') {
        return await handleGenerateAnnotatedManuscript(request, env, corsHeaders);
      }

      // Add a root route for testing
      if (path === '/' && request.method === 'GET') {
        return new Response(JSON.stringify({
          message: 'Manuscript Upload API is running!',
          version: '1.0.0',
          endpoints: [
            'POST /upload/manuscript',
            'POST /upload/marketing',
            'GET /list/{authorId}',
            'GET /get/{key}',
            'DELETE /delete/{key}',
            'POST /analyze/developmental',
            'POST /analyze/line-editing',
            'POST /analyze/copy-editing'
          ],
          dashboard: 'Visit https://scarter4workmanuscripthub.com for the dashboard'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// Handle manuscript uploads
async function handleManuscriptUpload(request, env, corsHeaders) {
  try {
    console.log('Processing manuscript upload...');
    const formData = await request.formData();
    const file = formData.get('file');
    const authorId = formData.get('authorId') || 'anonymous';
    const manuscriptId = formData.get('manuscriptId') || crypto.randomUUID();
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate file size (e.g., 50MB limit for manuscripts)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ error: 'File too large. Maximum size is 50MB' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'text/plain',
      'application/epub+zip'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Invalid file type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate storage key with metadata
    const timestamp = new Date().toISOString();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${authorId}/${manuscriptId}/${timestamp}_${sanitizedFilename}`;

    // Create metadata object
    const metadata = {
      authorId: authorId,
      manuscriptId: manuscriptId,
      originalName: file.name,
      uploadTime: timestamp,
      fileType: file.type,
      fileSize: file.size,
      version: formData.get('version') || '1.0'
    };

    console.log('Uploading to R2:', key);
    
    // Generate a short report ID (8 characters)
    const reportId = crypto.randomUUID().substring(0, 8);
    
    // Upload to R2 with metadata
    await env.MANUSCRIPTS_RAW.put(key, file.stream(), {
      customMetadata: metadata,
      httpMetadata: {
        contentType: file.type,
      }
    });
    
    // Store report ID mapping (for clean URLs)
    await env.MANUSCRIPTS_RAW.put(`report-id:${reportId}`, key, {
      expirationTtl: 60 * 60 * 24 * 30 // 30 days
    });

    // Return success response with file details
    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      key: key,
      reportId: reportId,
      metadata: metadata
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle marketing asset uploads (covers, author photos, etc.)
async function handleMarketingUpload(request, env, corsHeaders) {
  const formData = await request.formData();
  const file = formData.get('file');
  const authorId = formData.get('authorId') || 'anonymous';
  const assetType = formData.get('assetType') || 'general'; // cover, author-photo, banner, etc.
  
  if (!file) {
    return new Response(JSON.stringify({ error: 'No file provided' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Validate image file
  const allowedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ];
  
  if (!allowedImageTypes.includes(file.type)) {
    return new Response(JSON.stringify({ error: 'Invalid image type' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Max 10MB for images
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return new Response(JSON.stringify({ error: 'Image too large. Maximum size is 10MB' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const timestamp = new Date().toISOString();
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `${authorId}/${assetType}/${timestamp}_${sanitizedFilename}`;

  // Upload to marketing assets bucket
  await env.MARKETING_ASSETS.put(key, file.stream(), {
    customMetadata: {
      authorId: authorId,
      assetType: assetType,
      originalName: file.name,
      uploadTime: timestamp
    },
    httpMetadata: {
      contentType: file.type,
    }
  });

  // Generate a public URL (if bucket is configured for public access)
  const publicUrl = `https://your-domain.com/marketing/${key}`;

  return new Response(JSON.stringify({
    success: true,
    key: key,
    url: publicUrl,
    assetType: assetType
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Get file with signed URL generation
async function handleFileGet(request, env, corsHeaders) {
  const url = new URL(request.url);
  const key = url.pathname.replace('/get/', '');
  
  // Determine which bucket based on key prefix or parameter
  const bucket = url.searchParams.get('bucket') || 'raw';
  let r2Bucket;
  
  switch(bucket) {
    case 'raw':
      r2Bucket = env.MANUSCRIPTS_RAW;
      break;
    case 'processed':
      r2Bucket = env.MANUSCRIPTS_PROCESSED;
      break;
    case 'marketing':
      r2Bucket = env.MARKETING_ASSETS;
      break;
    default:
      return new Response(JSON.stringify({ error: 'Invalid bucket' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
  }

  const object = await r2Bucket.get(key);
  
  if (!object) {
    return new Response(JSON.stringify({ error: 'File not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Return file directly or generate signed URL
  const returnUrl = url.searchParams.get('url') === 'true';
  
  if (returnUrl) {
    // In production, you'd generate a signed URL here
    // For now, return the key and metadata
    return new Response(JSON.stringify({
      key: key,
      metadata: object.customMetadata,
      size: object.size,
      uploaded: object.uploaded
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Return the file directly
  return new Response(object.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
    }
  });
}

// List files for an author
async function handleFileList(request, env, corsHeaders) {
  const url = new URL(request.url);
  const authorId = url.pathname.replace('/list/', '');
  const bucket = url.searchParams.get('bucket') || 'raw';
  
  console.log('List files for author:', authorId, 'in bucket:', bucket);
  
  let r2Bucket;
  switch(bucket) {
    case 'raw':
      r2Bucket = env.MANUSCRIPTS_RAW;
      break;
    case 'processed':
      r2Bucket = env.MANUSCRIPTS_PROCESSED;
      break;
    case 'marketing':
      r2Bucket = env.MARKETING_ASSETS;
      break;
    default:
      return new Response(JSON.stringify({ error: 'Invalid bucket' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
  }

  // List objects with prefix
  const listed = await r2Bucket.list({
    prefix: `${authorId}/`,
    limit: 100
  });

  const files = listed.objects.map(obj => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded,
    metadata: obj.customMetadata
  }));

  return new Response(JSON.stringify({
    files: files,
    truncated: listed.truncated,
    cursor: listed.cursor
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Delete file
async function handleFileDelete(request, env, corsHeaders) {
  const url = new URL(request.url);
  const key = url.pathname.replace('/delete/', '');
  const bucket = url.searchParams.get('bucket') || 'raw';
  
  // Add authentication check here in production
  // const authHeader = request.headers.get('Authorization');
  // if (!isAuthorized(authHeader)) { ... }
  
  let r2Bucket;
  switch(bucket) {
    case 'raw':
      r2Bucket = env.MANUSCRIPTS_RAW;
      break;
    case 'processed':
      r2Bucket = env.MANUSCRIPTS_PROCESSED;
      break;
    case 'marketing':
      r2Bucket = env.MARKETING_ASSETS;
      break;
    default:
      return new Response(JSON.stringify({ error: 'Invalid bucket' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
  }

  await r2Bucket.delete(key);

  return new Response(JSON.stringify({
    success: true,
    deleted: key
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Helper function for authentication (implement based on your needs)
function isAuthorized(authHeader) {
  // Implement your auth logic here
  // For now, returning true for development
  return true;
}

// Handle developmental analysis request
async function handleDevelopmentalAnalysis(request, env, corsHeaders) {
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
async function handleLineEditingAnalysis(request, env, corsHeaders) {
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
async function handleCopyEditingAnalysis(request, env, corsHeaders) {
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

// Get stored analysis results
async function handleGetAnalysis(request, env, corsHeaders) {
  const url = new URL(request.url);
  const manuscriptKey = url.pathname.replace('/analysis/', '');
  const processedKey = `${manuscriptKey}-analysis.json`;

  try {
    const analysis = await env.MANUSCRIPTS_PROCESSED.get(processedKey);
    
    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const analysisData = await analysis.json();

    return new Response(JSON.stringify(analysisData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving analysis:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  console.log('Generating report for ID:', reportId);
  
  try {
    // Get manuscript key from KV mapping
    const manuscriptKey = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`, { type: 'text' });
    
    if (!manuscriptKey) {
      return new Response(JSON.stringify({ error: 'Report not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Found manuscript key:', manuscriptKey);
    // Fetch all three analyses
    console.log('Fetching analyses from R2...');
    const [devAnalysis, lineAnalysis, copyAnalysis] = await Promise.all([
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-analysis.json`).then(r => r?.json()).catch(e => { console.error('Dev analysis error:', e); return null; }),
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-line-analysis.json`).then(r => r?.json()).catch(e => { console.error('Line analysis error:', e); return null; }),
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-copy-analysis.json`).then(r => r?.json()).catch(e => { console.error('Copy analysis error:', e); return null; })
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
    const rawManuscript = await env.MANUSCRIPTS_RAW.get(manuscriptKey);
    const metadata = rawManuscript?.customMetadata || { originalName: 'Unknown', authorId: 'Unknown' };
    console.log('Metadata:', metadata);
    
    // Generate HTML report
    console.log('Generating HTML report...');
    const reportHtml = ReportGenerator.generateFullReport(
      manuscriptKey,
      devAnalysis,
      lineAnalysis,
      copyAnalysis,
      metadata
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
      stack: error.stack,
      manuscriptKey: manuscriptKey
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  console.log('Generating annotated manuscript for ID:', reportId);
  
  try {
    // Get manuscript key from KV mapping
    const manuscriptKey = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`, { type: 'text' });
    
    if (!manuscriptKey) {
      return new Response(JSON.stringify({ error: 'Report not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Found manuscript key:', manuscriptKey);
    // Fetch the original manuscript text
    const manuscript = await env.MANUSCRIPTS_RAW.get(manuscriptKey);
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
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-line-analysis.json`).then(r => r?.json()).catch(() => null),
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-copy-analysis.json`).then(r => r?.json()).catch(() => null)
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
      env
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