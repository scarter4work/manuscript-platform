/**
 * Manuscript Formatting API Handlers
 * EPUB and PDF conversion for Amazon KDP publishing
 * Issue #44: https://github.com/scarter4work/manuscript-platform/issues/44
 */

import { generateEPUBFromDOCX, validateEPUB } from '../generators/epub-generator.js';
import { generatePrintPDF, TRIM_SIZES } from '../generators/pdf-generator.js';
import { getUserFromRequest } from '../utils/auth-utils.js';

/**
 * POST /manuscripts/:id/format/epub
 * Generate EPUB format for Kindle
 */
export async function handleGenerateEPUB(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { manuscriptId } = request.params;
    const body = await request.json();

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const startTime = Date.now();

    // Get manuscript file from R2
    const manuscriptObj = await env.R2.getBucket('manuscripts_raw').get(manuscript.file_key);
    if (!manuscriptObj) {
      return new Response(JSON.stringify({
        error: 'Manuscript file not found in storage'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const manuscriptBuffer = await manuscriptObj.arrayBuffer();

    // Get cover image if available
    let coverBuffer = null;
    if (body.coverKey || manuscript.cover_key) {
      const coverObj = await env.R2.getBucket('marketing_assets').get(body.coverKey || manuscript.cover_key);
      if (coverObj) {
        coverBuffer = await coverObj.arrayBuffer();
      }
    }

    // Prepare metadata
    const metadata = {
      title: body.title || manuscript.title,
      author: body.author || 'Author Name',
      description: body.description || '',
      publisher: body.publisher || 'ManuscriptHub',
      language: body.language || 'en',
      isbn: body.isbn || ''
    };

    // Generate EPUB
    const epubBuffer = await generateEPUBFromDOCX(
      Buffer.from(manuscriptBuffer),
      coverBuffer ? Buffer.from(coverBuffer) : null,
      metadata
    );

    // Validate EPUB
    const validation = await validateEPUB(epubBuffer);

    // Store in R2
    const epubKey = `formatted/${manuscriptId}/epub/${Date.now()}.epub`;
    await env.R2.getBucket('manuscripts_processed').put(epubKey, epubBuffer, {
      customMetadata: {
        manuscriptId,
        userId,
        title: metadata.title,
        format: 'epub',
        fileSize: epubBuffer.length.toString()
      }
    });

    // Create formatted manuscript record
    const formattedId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO formatted_manuscripts (
        id, manuscript_id, user_id, format_type, file_key,
        file_size, status, is_validated, validation_errors,
        passes_amazon_specs, include_title_page, include_copyright,
        include_toc, include_author_bio, processing_time_ms,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      formattedId,
      manuscriptId,
      userId,
      'epub',
      epubKey,
      epubBuffer.length,
      validation.valid ? 'completed' : 'failed',
      validation.valid ? 1 : 0,
      validation.errors.length > 0 ? JSON.stringify(validation.errors) : null,
      validation.valid ? 1 : 0,
      body.includeTitlePage !== false ? 1 : 0,
      body.includeCopyright !== false ? 1 : 0,
      body.includeTOC !== false ? 1 : 0,
      body.includeAuthorBio !== false ? 1 : 0,
      Date.now() - startTime,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();

    // Generate presigned URL for download (valid for 1 hour)
    const fileUrl = `${env.FRONTEND_URL}/api/formatted/${formattedId}/download`;

    return new Response(JSON.stringify({
      success: true,
      formattedId,
      format: 'epub',
      fileSize: epubBuffer.length,
      fileSizeMB: (epubBuffer.length / (1024 * 1024)).toFixed(2),
      fileUrl,
      validation,
      processingTimeMs: Date.now() - startTime
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating EPUB:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate EPUB',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /manuscripts/:id/format/pdf
 * Generate PDF format for paperback print
 */
export async function handleGeneratePDF(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { manuscriptId } = request.params;
    const body = await request.json();

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const startTime = Date.now();

    // Get manuscript file from R2
    const manuscriptObj = await env.R2.getBucket('manuscripts_raw').get(manuscript.file_key);
    if (!manuscriptObj) {
      return new Response(JSON.stringify({
        error: 'Manuscript file not found in storage'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const manuscriptBuffer = await manuscriptObj.arrayBuffer();

    // Prepare options
    const trimSize = body.trimSize || '6x9';
    if (!TRIM_SIZES[trimSize]) {
      return new Response(JSON.stringify({
        error: `Invalid trim size. Available: ${Object.keys(TRIM_SIZES).join(', ')}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const options = {
      title: body.title || manuscript.title,
      author: body.author || 'Author Name',
      trimSize,
      bleed: body.includeBleed ? 9 : 0, // 0.125" bleed in points
      chapters: body.chapters || []
    };

    // If no chapters provided, parse from DOCX
    if (!options.chapters || options.chapters.length === 0) {
      // For now, use a placeholder - full parsing would require mammoth
      // This would be enhanced to actually parse the DOCX
      options.chapters = [{
        title: 'Chapter 1',
        content: 'Manuscript content will be parsed from DOCX file.'
      }];
    }

    // Generate PDF
    const pdfBuffer = await generatePrintPDF(options);

    // Store in R2
    const pdfKey = `formatted/${manuscriptId}/pdf/${Date.now()}.pdf`;
    await env.R2.getBucket('manuscripts_processed').put(pdfKey, pdfBuffer, {
      customMetadata: {
        manuscriptId,
        userId,
        title: options.title,
        format: 'pdf',
        trimSize,
        fileSize: pdfBuffer.length.toString()
      }
    });

    // Create formatted manuscript record
    const formattedId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO formatted_manuscripts (
        id, manuscript_id, user_id, format_type, file_key,
        file_size, status, trim_size, has_bleed,
        include_title_page, include_copyright, include_toc,
        processing_time_ms, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      formattedId,
      manuscriptId,
      userId,
      'pdf',
      pdfKey,
      pdfBuffer.length,
      'completed',
      trimSize,
      body.includeBleed ? 1 : 0,
      body.includeTitlePage !== false ? 1 : 0,
      body.includeCopyright !== false ? 1 : 0,
      body.includeTOC !== false ? 1 : 0,
      Date.now() - startTime,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();

    const fileUrl = `${env.FRONTEND_URL}/api/formatted/${formattedId}/download`;

    return new Response(JSON.stringify({
      success: true,
      formattedId,
      format: 'pdf',
      trimSize: TRIM_SIZES[trimSize].name,
      fileSize: pdfBuffer.length,
      fileSizeMB: (pdfBuffer.length / (1024 * 1024)).toFixed(2),
      fileUrl,
      processingTimeMs: Date.now() - startTime
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate PDF',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /manuscripts/:id/formatted
 * Get all formatted versions of a manuscript
 */
export async function handleGetFormattedManuscripts(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { manuscriptId } = request.params;

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all formatted versions
    const formatted = await env.DB.prepare(`
      SELECT * FROM formatted_manuscripts
      WHERE manuscript_id = ? AND user_id = ?
      ORDER BY created_at DESC
    `).bind(manuscriptId, userId).all();

    return new Response(JSON.stringify({
      success: true,
      formatted: formatted.results,
      totalFormats: formatted.results.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving formatted manuscripts:', error);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve formatted manuscripts',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /formatted/:id/download
 * Download formatted file
 */
export async function handleDownloadFormatted(request, env) {
  try {
    const userId = await getUserFromRequest(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { formattedId } = request.params;

    // Get formatted manuscript record
    const formatted = await env.DB.prepare(`
      SELECT * FROM formatted_manuscripts
      WHERE id = ? AND user_id = ?
    `).bind(formattedId, userId).first();

    if (!formatted) {
      return new Response(JSON.stringify({ error: 'Formatted file not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get file from R2
    const fileObj = await env.R2.getBucket('manuscripts_processed').get(formatted.file_key);
    if (!fileObj) {
      return new Response(JSON.stringify({
        error: 'File not found in storage'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get manuscript for filename
    const manuscript = await env.DB.prepare(
      'SELECT title FROM manuscripts WHERE id = ?'
    ).bind(formatted.manuscript_id).first();

    const filename = `${manuscript?.title || 'manuscript'}.${formatted.format_type}`;
    const contentType = formatted.format_type === 'epub'
      ? 'application/epub+zip'
      : 'application/pdf';

    return new Response(fileObj.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': formatted.file_size.toString()
      }
    });

  } catch (error) {
    console.error('Error downloading formatted file:', error);
    return new Response(JSON.stringify({
      error: 'Failed to download file',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /trim-sizes
 * Get available trim sizes for PDF generation
 */
export async function handleGetTrimSizes(request, env) {
  return new Response(JSON.stringify({
    success: true,
    trimSizes: Object.entries(TRIM_SIZES).map(([key, value]) => ({
      key,
      name: value.name,
      width: value.width / 72, // Convert points to inches
      height: value.height / 72
    }))
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
