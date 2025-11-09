// Legacy format handler functions extracted from worker.js
// These handlers manage manuscript formatting to EPUB and PDF

import { FormattingAgent } from '../agents/formatting-agent.js';

// Format manuscript to EPUB and PDF
async function handleFormatManuscript(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { reportId, metadata, trimSize, includeBleed } = body;

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Formatting manuscript for report:', reportId);

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
    console.log('Found manuscript key:', manuscriptKey);

    // Fetch the original manuscript text
    const manuscriptObj = await env.R2.getBucket('manuscripts_raw').get(manuscriptKey);
    if (!manuscriptObj) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract text
    const buffer = await manuscriptObj.arrayBuffer();
    const manuscriptText = new TextDecoder().decode(buffer);

    // Try to fetch back matter (optional)
    let backMatter = null;
    try {
      const backMatterObj = await env.R2.getBucket('manuscripts_processed').get(`${manuscriptKey}-back-matter.json`);
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
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Store formatted files in R2
    const storagePromises = [];

    if (result.results.epub) {
      console.log('Storing EPUB file...');
      storagePromises.push(
        env.R2.getBucket('manuscripts_processed').put(
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
        env.R2.getBucket('manuscripts_processed').put(
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
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error formatting manuscript:', error);
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

// Download formatted file (EPUB or PDF)
async function handleDownloadFormatted(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('id');
    const format = url.searchParams.get('format'); // 'epub' or 'pdf'

    if (!reportId || !format) {
      return new Response(JSON.stringify({ error: 'id and format parameters required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!['epub', 'pdf'].includes(format)) {
      return new Response(JSON.stringify({ error: 'format must be epub or pdf' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Downloading formatted file:', reportId, format);

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

    // Fetch formatted file
    const fileKey = `${manuscriptKey}-formatted.${format}`;
    const formattedFile = await env.R2.getBucket('manuscripts_processed').get(fileKey);

    if (!formattedFile) {
      return new Response(JSON.stringify({
        error: 'Formatted file not found. Please format the manuscript first.',
        reportId: reportId,
        format: format
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine content type and filename
    const contentType = format === 'epub' ? 'application/epub+zip' : 'application/pdf';
    const filename = `manuscript-${reportId}.${format}`;

    return new Response(formattedFile.body, {
      status: 200,
      headers: {
        ...allHeaders,
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
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export {
  handleFormatManuscript,
  handleDownloadFormatted
};
