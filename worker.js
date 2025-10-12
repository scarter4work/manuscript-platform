// Cloudflare Worker for handling manuscript uploads
// Deploy this via Cloudflare Dashboard > Workers & Pages

import { DevelopmentalAgent } from './developmental-agent.js';
import { LineEditingAgent } from './line-editing-agent.js';
import { CopyEditingAgent } from './copy-editing-agent.js';
import { ReportGenerator } from './report-generator.js';
import { AnnotatedManuscriptGenerator } from './annotated-manuscript-generator.js';
import { Auth } from './auth.js';
import { BookDescriptionAgent } from './book-description-agent.js';
import { KeywordAgent } from './keyword-agent.js';
import { CategoryAgent } from './category-agent.js';
import { AuthorBioAgent } from './author-bio-agent.js';
import { BackMatterAgent } from './back-matter-agent.js';
import { FormattingAgent } from './formatting-agent.js';

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
      // Auth routes (no auth required)
      if (path === '/auth/register' && request.method === 'POST') {
        return await handleRegister(request, env, corsHeaders);
      }

      if (path === '/auth/login' && request.method === 'POST') {
        return await handleLogin(request, env, corsHeaders);
      }

      // Route: Get current user (from Cloudflare Access)
      if (path === '/auth/me' && request.method === 'GET') {
        // Cloudflare Access adds user info to headers
        const userEmail = request.headers.get('Cf-Access-Authenticated-User-Email');
        const userName = request.headers.get('Cf-Access-Authenticated-User-Name') || userEmail;
        
        if (userEmail) {
          return new Response(JSON.stringify({
            authenticated: true,
            email: userEmail,
            name: userName
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({
            authenticated: false
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
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

      // NEW: Start async analysis (queues the job)
      if (path === '/analyze/start' && request.method === 'POST') {
        return await handleStartAnalysis(request, env, corsHeaders);
      }

      // NEW: Check analysis status
      if (path === '/analyze/status' && request.method === 'GET') {
        return await handleAnalysisStatus(request, env, corsHeaders);
      }

      // Route: Generate marketing assets (book description, keywords, categories)
      if (path === '/generate-assets' && request.method === 'POST') {
        return await handleGenerateAssets(request, env, corsHeaders);
      }

      // Route: Get generated assets
      if (path === '/assets' && request.method === 'GET') {
        return await handleGetAssets(request, env, corsHeaders);
      }

      // Route: Format manuscript (generate EPUB and PDF)
      if (path === '/format-manuscript' && request.method === 'POST') {
        return await handleFormatManuscript(request, env, corsHeaders);
      }

      // Route: Download formatted file
      if (path === '/download-formatted' && request.method === 'GET') {
        return await handleDownloadFormatted(request, env, corsHeaders);
      }

      // Route: Get analysis results
      if (path.startsWith('/analysis/') && request.method === 'GET') {
        return await handleGetAnalysis(request, env, corsHeaders);
      }

      // Route: Get analysis results as JSON by reportId
      if (path === '/results' && request.method === 'GET') {
        return await handleGetAnalysisResults(request, env, corsHeaders);
      }

      // Route: Generate formatted report
      if (path === '/report' && request.method === 'GET') {
        return await handleGenerateReport(request, env, corsHeaders);
      }

      // Route: Generate annotated manuscript
      if (path === '/annotated' && request.method === 'GET') {
        return await handleGenerateAnnotatedManuscript(request, env, corsHeaders);
      }

      // Debug endpoint to check report ID mapping
      if (path === '/debug/report-id' && request.method === 'GET') {
        const reportId = url.searchParams.get('id');
        if (!reportId) {
          return new Response(JSON.stringify({ error: 'id parameter required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);
        if (mappingObject) {
          const manuscriptKey = await mappingObject.text();
          
          // Also check if the manuscript file exists
          const manuscript = await env.MANUSCRIPTS_RAW.get(manuscriptKey);
          
          return new Response(JSON.stringify({ 
            found: true,
            reportId: reportId,
            manuscriptKey: manuscriptKey,
            manuscriptExists: !!manuscript,
            manuscriptSize: manuscript?.size || 0
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ 
            found: false,
            reportId: reportId,
            message: 'No mapping found for this report ID'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
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
    
    // Get authenticated user from Cloudflare Access headers
    const userEmail = request.headers.get('Cf-Access-Authenticated-User-Email');
    const authorId = userEmail || 'anonymous'; // Use email as author ID
    
    const formData = await request.formData();
    const file = formData.get('file');
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
    // Get manuscript key from mapping
    console.log('Looking up report-id:', `report-id:${reportId}`);
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);
    
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
    // Get manuscript key from mapping
    console.log('Looking up report-id:', `report-id:${reportId}`);
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);
    
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

// Get analysis results as JSON by reportId
async function handleGetAnalysisResults(request, env, corsHeaders) {
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
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

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
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-analysis.json`).then(r => r?.json()).catch(() => null),
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-line-analysis.json`).then(r => r?.json()).catch(() => null),
      env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-copy-analysis.json`).then(r => r?.json()).catch(() => null)
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

// NEW ASYNC HANDLERS

// Start async analysis (queues the job)
async function handleStartAnalysis(request, env, corsHeaders) {
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
    await env.MANUSCRIPTS_RAW.put(
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
async function handleAnalysisStatus(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const statusObj = await env.MANUSCRIPTS_RAW.get(`status:${reportId}`);
    
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

// ASSET GENERATION HANDLERS

// Generate marketing assets (book description, keywords, categories)
async function handleGenerateAssets(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { reportId } = body;

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Generating assets for report:', reportId);

    // Get manuscript key from mapping
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

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
    console.log('Found manuscript key:', manuscriptKey);

    // Fetch developmental analysis (required for asset generation)
    const devAnalysisObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-analysis.json`);

    if (!devAnalysisObj) {
      return new Response(JSON.stringify({
        error: 'Developmental analysis not found. Please complete manuscript analysis first.',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const devAnalysis = await devAnalysisObj.json();
    const genre = body.genre || 'general';

    // Extract optional author data from request
    const authorData = body.authorData || {};

    // Initialize all 5 agents
    const bookDescAgent = new BookDescriptionAgent(env);
    const keywordAgent = new KeywordAgent(env);
    const categoryAgent = new CategoryAgent(env);
    const authorBioAgent = new AuthorBioAgent(env);
    const backMatterAgent = new BackMatterAgent(env);

    console.log('Running all five asset generation agents in parallel...');

    // Run all agents in parallel
    const [bookDescription, keywords, categories, authorBio, backMatter] = await Promise.all([
      bookDescAgent.generate(manuscriptKey, devAnalysis, genre)
        .catch(e => ({ error: e.message, type: 'bookDescription' })),
      keywordAgent.generate(manuscriptKey, devAnalysis, genre)
        .catch(e => ({ error: e.message, type: 'keywords' })),
      categoryAgent.generate(manuscriptKey, devAnalysis, genre)
        .catch(e => ({ error: e.message, type: 'categories' })),
      authorBioAgent.generate(manuscriptKey, devAnalysis, genre, authorData)
        .catch(e => ({ error: e.message, type: 'authorBio' })),
      backMatterAgent.generate(manuscriptKey, devAnalysis, genre, authorData)
        .catch(e => ({ error: e.message, type: 'backMatter' }))
    ]);

    // Check for errors
    const errors = [];
    if (bookDescription.error) errors.push(bookDescription);
    if (keywords.error) errors.push(keywords);
    if (categories.error) errors.push(categories);
    if (authorBio.error) errors.push(authorBio);
    if (backMatter.error) errors.push(backMatter);

    if (errors.length > 0) {
      console.error('Asset generation errors:', errors);
      return new Response(JSON.stringify({
        success: false,
        partialSuccess: errors.length < 5,
        errors: errors,
        results: {
          bookDescription: bookDescription.error ? null : bookDescription.description,
          keywords: keywords.error ? null : keywords.keywords,
          categories: categories.error ? null : categories.categories,
          authorBio: authorBio.error ? null : authorBio.bio,
          backMatter: backMatter.error ? null : backMatter.backMatter
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Store combined assets
    const combinedAssets = {
      manuscriptKey,
      reportId,
      generated: new Date().toISOString(),
      bookDescription: bookDescription.description,
      keywords: keywords.keywords,
      categories: categories.categories,
      authorBio: authorBio.bio,
      backMatter: backMatter.backMatter
    };

    await env.MANUSCRIPTS_PROCESSED.put(
      `${manuscriptKey}-assets.json`,
      JSON.stringify(combinedAssets, null, 2),
      {
        customMetadata: {
          reportId: reportId,
          timestamp: new Date().toISOString()
        },
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );

    console.log('Assets generated and stored successfully');

    return new Response(JSON.stringify({
      success: true,
      reportId: reportId,
      assets: combinedAssets
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating assets:', error);
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

// Get generated assets by reportId
async function handleGetAssets(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('id');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'id parameter required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Fetching assets for report:', reportId);

    // Get manuscript key from mapping
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

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

    // Fetch combined assets
    const assetsObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-assets.json`);

    if (!assetsObj) {
      return new Response(JSON.stringify({
        error: 'Assets not found. Please generate assets first.',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const assets = await assetsObj.json();

    return new Response(JSON.stringify({
      success: true,
      assets: assets
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching assets:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// FORMATTING HANDLERS (Phase 4)

// Format manuscript to EPUB and PDF
async function handleFormatManuscript(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { reportId, metadata, trimSize, includeBleed } = body;

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Formatting manuscript for report:', reportId);

    // Get manuscript key from mapping
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

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
    console.log('Found manuscript key:', manuscriptKey);

    // Fetch the original manuscript text
    const manuscriptObj = await env.MANUSCRIPTS_RAW.get(manuscriptKey);
    if (!manuscriptObj) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract text
    const buffer = await manuscriptObj.arrayBuffer();
    const manuscriptText = new TextDecoder().decode(buffer);

    // Try to fetch back matter (optional)
    let backMatter = null;
    try {
      const backMatterObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-back-matter.json`);
      if (backMatterObj) {
        backMatter = await backMatterObj.json();
      }
    } catch (e) {
      console.log('No back matter found, continuing without it');
    }

    // Prepare metadata
    const formattingMetadata = {
      title: metadata?.title || manuscriptObj.customMetadata?.originalName?.replace(/\.[^/.]+$/, '') || 'Untitled',
      author: metadata?.author || manuscriptObj.customMetadata?.authorId || 'Unknown Author',
      copyrightYear: metadata?.copyrightYear || new Date().getFullYear(),
      isbn: metadata?.isbn || '',
      publisher: metadata?.publisher || '',
      description: metadata?.description || '',
      language: metadata?.language || 'en'
    };

    console.log('Formatting metadata:', formattingMetadata);

    // Initialize formatting agent
    const formattingAgent = new FormattingAgent();

    // Generate both EPUB and PDF
    const formattingOptions = {
      manuscriptText,
      metadata: formattingMetadata,
      backMatter,
      trimSize: trimSize || '6x9',
      includeBleed: includeBleed || false
    };

    console.log('Starting formatting agent...');
    const result = await formattingAgent.formatManuscript(formattingOptions);

    if (!result.success) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Formatting failed',
        errors: result.errors
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Store formatted files in R2
    const storagePromises = [];

    if (result.results.epub) {
      console.log('Storing EPUB file...');
      storagePromises.push(
        env.MANUSCRIPTS_PROCESSED.put(
          `${manuscriptKey}-formatted.epub`,
          result.results.epub.buffer,
          {
            customMetadata: {
              reportId: reportId,
              format: 'epub',
              size: result.results.epub.size,
              timestamp: new Date().toISOString()
            },
            httpMetadata: {
              contentType: 'application/epub+zip'
            }
          }
        )
      );
    }

    if (result.results.pdf) {
      console.log('Storing PDF file...');
      storagePromises.push(
        env.MANUSCRIPTS_PROCESSED.put(
          `${manuscriptKey}-formatted.pdf`,
          result.results.pdf.buffer,
          {
            customMetadata: {
              reportId: reportId,
              format: 'pdf',
              trimSize: result.results.pdf.trimSize,
              pageCount: result.results.pdf.pageCount,
              size: result.results.pdf.size,
              timestamp: new Date().toISOString()
            },
            httpMetadata: {
              contentType: 'application/pdf'
            }
          }
        )
      );
    }

    await Promise.all(storagePromises);

    console.log('Formatted files stored successfully');

    return new Response(JSON.stringify({
      success: true,
      reportId: reportId,
      formats: {
        epub: result.results.epub ? {
          available: true,
          size: result.results.epub.size,
          sizeKB: Math.round(result.results.epub.size / 1024),
          validation: result.results.epub.validation
        } : null,
        pdf: result.results.pdf ? {
          available: true,
          size: result.results.pdf.size,
          sizeKB: Math.round(result.results.pdf.size / 1024),
          pageCount: result.results.pdf.pageCount,
          trimSize: result.results.pdf.trimSize,
          validation: result.results.pdf.validation
        } : null
      },
      metadata: result.metadata
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error formatting manuscript:', error);
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

// Download formatted file (EPUB or PDF)
async function handleDownloadFormatted(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('id');
    const format = url.searchParams.get('format'); // 'epub' or 'pdf'

    if (!reportId || !format) {
      return new Response(JSON.stringify({ error: 'id and format parameters required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!['epub', 'pdf'].includes(format)) {
      return new Response(JSON.stringify({ error: 'format must be epub or pdf' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Downloading formatted file:', reportId, format);

    // Get manuscript key from mapping
    const mappingObject = await env.MANUSCRIPTS_RAW.get(`report-id:${reportId}`);

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

    // Fetch formatted file
    const fileKey = `${manuscriptKey}-formatted.${format}`;
    const formattedFile = await env.MANUSCRIPTS_PROCESSED.get(fileKey);

    if (!formattedFile) {
      return new Response(JSON.stringify({
        error: 'Formatted file not found. Please format the manuscript first.',
        reportId: reportId,
        format: format
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine content type and filename
    const contentType = format === 'epub' ? 'application/epub+zip' : 'application/pdf';
    const filename = `manuscript-${reportId}.${format}`;

    return new Response(formattedFile.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': formattedFile.size.toString()
      }
    });

  } catch (error) {
    console.error('Error downloading formatted file:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}