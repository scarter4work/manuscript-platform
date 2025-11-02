// Legacy manuscript handler functions extracted from worker.js
// These handlers manage manuscript uploads, file operations, and marketing assets

// Handle manuscript uploads with authentication and usage limits
async function handleManuscriptUpload(request, env, corsHeaders) {
  try {
    console.log('Processing manuscript upload...');

    // Import auth utilities
    const { getUserFromRequest } = await import('./auth-utils.js');

    // Get authenticated user (REQUIRED)
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized - please log in' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Phase F: Check usage limits before allowing upload
    const subscription = await env.DB.prepare(`
      SELECT * FROM user_subscriptions_with_usage WHERE user_id = ?
    `).bind(userId).first();

    const canUpload = !subscription || subscription.manuscripts_this_period < subscription.monthly_limit;

    if (!canUpload) {
      return new Response(JSON.stringify({
        error: 'Upload limit reached',
        planType: subscription.plan_type,
        manuscriptsUsed: subscription.manuscripts_this_period,
        monthlyLimit: subscription.monthly_limit,
        upgradeRequired: true,
        message: 'You have reached your monthly manuscript limit. Please upgrade your plan or wait for your billing period to reset.'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const title = formData.get('title') || file.name.replace(/\.[^/.]+$/, '');
    const genre = formData.get('genre') || 'general';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ error: 'File too large. Maximum size is 50MB' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'application/epub+zip'
    ];

    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Invalid file type. Allowed: PDF, DOCX, DOC, TXT, EPUB' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate IDs
    const manuscriptId = crypto.randomUUID();
    const reportId = crypto.randomUUID().substring(0, 8);
    const timestamp = new Date().toISOString();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const r2Key = `${userId}/${manuscriptId}/${timestamp}_${sanitizedFilename}`;

    // Calculate file hash for duplicate detection
    const fileBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
    const fileHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Count words (approximate)
    const fileText = new TextDecoder().decode(fileBuffer);
    const wordCount = fileText.split(/\s+/).filter(w => w.length > 0).length;

    // Upload to R2
    await env.MANUSCRIPTS_RAW.put(r2Key, new Uint8Array(fileBuffer), {
      customMetadata: {
        manuscriptId,
        userId: userId,
        originalName: file.name,
        uploadTime: timestamp,
        fileType: file.type,
        fileSize: file.size.toString()
      },
      httpMetadata: {
        contentType: file.type,
      }
    });

    // Store report ID mapping
    await env.MANUSCRIPTS_RAW.put(`report-id:${reportId}`, r2Key, {
      expirationTtl: 60 * 60 * 24 * 30 // 30 days
    });

    // Save to database
    await env.DB.prepare(`
      INSERT INTO manuscripts (id, user_id, title, r2_key, file_hash, status, genre, word_count, file_type, metadata, uploaded_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)
    `).bind(
      manuscriptId,
      userId,
      title,
      r2Key,
      fileHash,
      genre,
      wordCount,
      file.type,
      JSON.stringify({ reportId, originalName: file.name }),
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();

    // Log audit event
    await env.DB.prepare(`
      INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, timestamp, metadata)
      VALUES (?, ?, 'upload', 'manuscript', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      manuscriptId,
      Math.floor(Date.now() / 1000),
      JSON.stringify({ title, fileSize: file.size, wordCount })
    ).run();

    // Phase C: Queue analysis automatically after successful upload
    console.log('[Upload] Queueing analysis for manuscript:', manuscriptId);

    try {
      // Initialize status tracking
      await env.MANUSCRIPTS_RAW.put(
        `status:${reportId}`,
        JSON.stringify({
          status: 'queued',
          progress: 0,
          message: 'Analysis queued',
          currentStep: 'queued',
          timestamp: new Date().toISOString()
        }),
        { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
      );

      // Queue the analysis job
      await env.ANALYSIS_QUEUE.send({
        manuscriptKey: r2Key,
        genre: genre,
        styleGuide: 'chicago', // Default style guide
        reportId: reportId
      });

      // Update manuscript status to 'queued' (will change to 'analyzing' when queue consumer starts)
      await env.DB.prepare(
        'UPDATE manuscripts SET status = ?, updated_at = ? WHERE id = ?'
      ).bind('queued', Math.floor(Date.now() / 1000), manuscriptId).run();

      console.log('[Upload] Analysis queued successfully for report:', reportId);
    } catch (queueError) {
      console.error('[Upload] Failed to queue analysis:', queueError);
      // Don't fail the upload if queueing fails - manuscript is still uploaded
      // The user can manually trigger analysis later
    }

    // Phase F: Track usage for billing
    try {
      const { trackUsage } = await import('./payment-handlers.js');
      await trackUsage(env, userId, manuscriptId, 'full', false);
      console.log('[Upload] Usage tracked for manuscript:', manuscriptId);
    } catch (usageError) {
      console.error('[Upload] Failed to track usage:', usageError);
      // Don't fail the upload if usage tracking fails
    }

    return new Response(JSON.stringify({
      success: true,
      manuscript: {
        id: manuscriptId,
        title,
        reportId,
        wordCount,
        fileSize: file.size,
        status: 'queued'
      }
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
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
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
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Max 10MB for images
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return new Response(JSON.stringify({ error: 'Image too large. Maximum size is 10MB' }), {
      status: 400,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
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
    headers: { ...allHeaders, 'Content-Type': 'application/json' }
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
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
  }

  const object = await r2Bucket.get(key);

  if (!object) {
    return new Response(JSON.stringify({ error: 'File not found' }), {
      status: 404,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
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
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Return the file directly
  return new Response(object.body, {
    headers: {
      ...allHeaders,
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
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
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
    headers: { ...allHeaders, 'Content-Type': 'application/json' }
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
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
  }

  await r2Bucket.delete(key);

  return new Response(JSON.stringify({
    success: true,
    deleted: key
  }), {
    headers: { ...allHeaders, 'Content-Type': 'application/json' }
  });
}

// Helper function for authentication (implement based on your needs)
function isAuthorized(authHeader) {
  // Implement your auth logic here
  // For now, returning true for development
  return true;
}

export {
  handleManuscriptUpload,
  handleMarketingUpload,
  handleFileGet,
  handleFileList,
  handleFileDelete
};
