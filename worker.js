// Cloudflare Worker for handling manuscript uploads
// Deploy this via Cloudflare Dashboard > Workers & Pages

export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // Replace with your domain in production
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
            'DELETE /delete/{key}'
          ]
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

  // Upload to R2 with metadata
  await env.MANUSCRIPTS_RAW.put(key, file.stream(), {
    customMetadata: metadata,
    httpMetadata: {
      contentType: file.type,
    }
  });

  // Return success response with file details
  return new Response(JSON.stringify({
    success: true,
    manuscriptId: manuscriptId,
    key: key,
    metadata: metadata
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
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