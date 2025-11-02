/**
 * Asset Generation and Publishing Handlers
 *
 * Handlers for marketing assets, manuscript formatting, market analysis, and social media
 */

import { BookDescriptionAgent } from './book-description-agent.js';
import { KeywordAgent } from './keyword-agent.js';
import { CategoryAgent } from './category-agent.js';
import { AuthorBioAgent } from './author-bio-agent.js';
import { BackMatterAgent } from './back-matter-agent.js';
import { CoverDesignAgent } from './cover-design-agent.js';
import { SeriesDescriptionAgent } from './series-description-agent.js';
import { FormattingAgent } from './formatting-agent.js';
import { MarketAnalysisAgent } from './market-analysis-agent.js';
import { SocialMediaAgent } from './social-media-agent.js';
import { CoverGenerationAgent } from './cover-generation-agent.js';

/**
 * Check asset generation status (Phase D)
 *
 * GET /assets/status?reportId={reportId}
 * Returns the current status of asset generation for a given report
 */
export async function handleAssetStatus(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const statusObj = await env.MANUSCRIPTS_RAW.get(`asset-status:${reportId}`);

    if (!statusObj) {
      return new Response(JSON.stringify({
        error: 'Asset status not found',
        status: 'not_started'
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
    console.error('Error checking asset status:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Generate all marketing and publishing assets for a manuscript
 *
 * This endpoint runs 7 AI agents in parallel to generate:
 * 1. Book Description - Multiple lengths (elevator pitch, short, long, retailer-optimized)
 * 2. Keywords - Amazon search keywords for discoverability
 * 3. Categories - Amazon category recommendations (BISAC codes)
 * 4. Author Bio - Professional author biographies (multiple lengths)
 * 5. Back Matter - "Also by" section, newsletter signup, social links
 * 6. Cover Design Brief - Visual concepts, color palettes, AI art prompts
 * 7. Series Description - Multi-book arc planning and series marketing
 *
 * POST /generate-assets
 */
export async function handleGenerateAssets(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { reportId } = body;

    // Validate required parameters
    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Generating assets for report:', reportId);

    // Look up the manuscript key from the short report ID
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

    // Fetch developmental analysis (required input for all asset generators)
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

    // Extract optional data from request body
    const authorData = body.authorData || {};
    const seriesData = body.seriesData || {};

    // Initialize all 7 asset generation agents
    const bookDescAgent = new BookDescriptionAgent(env);
    const keywordAgent = new KeywordAgent(env);
    const categoryAgent = new CategoryAgent(env);
    const authorBioAgent = new AuthorBioAgent(env);
    const backMatterAgent = new BackMatterAgent(env);
    const coverDesignAgent = new CoverDesignAgent(env);
    const seriesDescriptionAgent = new SeriesDescriptionAgent(env);

    console.log('Running all 7 asset generation agents in parallel...');

    // Execute all agents in parallel using Promise.all
    const [bookDescription, keywords, categories, authorBio, backMatter, coverBrief, seriesDescription] = await Promise.all([
      bookDescAgent.generate(manuscriptKey, devAnalysis, genre)
        .catch(e => ({ error: e.message, type: 'bookDescription' })),
      keywordAgent.generate(manuscriptKey, devAnalysis, genre)
        .catch(e => ({ error: e.message, type: 'keywords' })),
      categoryAgent.generate(manuscriptKey, devAnalysis, genre)
        .catch(e => ({ error: e.message, type: 'categories' })),
      authorBioAgent.generate(manuscriptKey, devAnalysis, genre, authorData)
        .catch(e => ({ error: e.message, type: 'authorBio' })),
      backMatterAgent.generate(manuscriptKey, devAnalysis, genre, authorData)
        .catch(e => ({ error: e.message, type: 'backMatter' })),
      coverDesignAgent.generate(manuscriptKey, devAnalysis, genre)
        .catch(e => ({ error: e.message, type: 'coverBrief' })),
      seriesDescriptionAgent.generate(manuscriptKey, devAnalysis, genre, seriesData)
        .catch(e => ({ error: e.message, type: 'seriesDescription' }))
    ]);

    // Collect any errors that occurred during generation
    const errors = [];
    if (bookDescription.error) errors.push(bookDescription);
    if (keywords.error) errors.push(keywords);
    if (categories.error) errors.push(categories);
    if (authorBio.error) errors.push(authorBio);
    if (backMatter.error) errors.push(backMatter);
    if (coverBrief.error) errors.push(coverBrief);
    if (seriesDescription.error) errors.push(seriesDescription);

    // If any errors occurred, return partial results with error details
    if (errors.length > 0) {
      console.error('Asset generation errors:', errors);
      return new Response(JSON.stringify({
        success: false,
        partialSuccess: errors.length < 7,
        errors: errors,
        results: {
          bookDescription: bookDescription.error ? null : bookDescription.description,
          keywords: keywords.error ? null : keywords.keywords,
          categories: categories.error ? null : categories.categories,
          authorBio: authorBio.error ? null : authorBio.bio,
          backMatter: backMatter.error ? null : backMatter.backMatter,
          coverBrief: coverBrief.error ? null : coverBrief.coverBrief,
          seriesDescription: seriesDescription.error ? null : seriesDescription.seriesDescription
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // All agents succeeded - combine results into a single asset package
    const combinedAssets = {
      manuscriptKey,
      reportId,
      generated: new Date().toISOString(),
      bookDescription: bookDescription.description,
      keywords: keywords.keywords,
      categories: categories.categories,
      authorBio: authorBio.bio,
      backMatter: backMatter.backMatter,
      coverBrief: coverBrief.coverBrief,
      seriesDescription: seriesDescription.seriesDescription
    };

    // Store the combined assets in R2 for later retrieval
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

/**
 * Get generated assets by reportId
 * GET /assets?id={reportId}
 */
export async function handleGetAssets(request, env, corsHeaders) {
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

/**
 * Format manuscript to EPUB and PDF
 * POST /format-manuscript
 */
export async function handleFormatManuscript(request, env, corsHeaders) {
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

/**
 * Download formatted file (EPUB or PDF)
 * GET /download-formatted?id={reportId}&format={epub|pdf}
 */
export async function handleDownloadFormatted(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('id');
    const format = url.searchParams.get('format');

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

/**
 * Handle market analysis request
 * POST /analyze-market
 */
export async function handleMarketAnalysis(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { reportId, metadata = {} } = body;

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Market analysis error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get market analysis results
 * GET /market-analysis?reportId={reportId}
 */
export async function handleGetMarketAnalysis(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId') || url.searchParams.get('id');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const analysisData = await analysisObj.json();

    return new Response(JSON.stringify(analysisData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching market analysis:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle social media marketing generation
 * POST /generate-social-media
 */
export async function handleGenerateSocialMedia(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { reportId } = body;

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Generating social media marketing for report:', reportId);

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

    // Fetch market analysis (if available, for better targeting)
    let marketAnalysis = null;
    try {
      const marketAnalysisObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-market-analysis.json`);
      if (marketAnalysisObj) {
        marketAnalysis = await marketAnalysisObj.json();
      }
    } catch (e) {
      console.log('No market analysis found, continuing without it');
    }

    // Prepare book metadata
    const bookMetadata = {
      title: manuscriptObj.customMetadata?.originalName?.replace(/\.[^/.]+$/, '') || 'Untitled',
      author: manuscriptObj.customMetadata?.authorId || 'Unknown Author',
      ...body.metadata
    };

    console.log('Book metadata:', bookMetadata);

    // Initialize social media agent
    const agent = new SocialMediaAgent(env.ANTHROPIC_API_KEY);

    // Generate marketing package
    const result = await agent.generateMarketingPackage(
      manuscriptText,
      bookMetadata,
      marketAnalysis?.analysis
    );

    // Generate formatted report
    const report = agent.generateReport(result.marketingPackage);

    // Store results in R2
    await env.MANUSCRIPTS_PROCESSED.put(
      `${manuscriptKey}-social-media.json`,
      JSON.stringify({
        reportId,
        marketingPackage: result.marketingPackage,
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

    console.log('Social media marketing generated and stored');

    return new Response(JSON.stringify({
      success: true,
      reportId,
      summary: {
        totalPosts: report.sections[0].totalPosts,
        emailCount: report.sections[1].emailCount,
        calendarDuration: report.sections[2].duration,
        trailerDuration: report.sections[3].duration,
        magnetIdeas: report.sections[4].ideaCount
      },
      duration: result.metadata.duration
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Social media generation error:', error);
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
 * Get social media marketing results
 * GET /social-media?reportId={reportId}
 */
export async function handleGetSocialMedia(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId') || url.searchParams.get('id');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();

    // Fetch social media marketing results
    const socialMediaObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-social-media.json`);

    if (!socialMediaObj) {
      return new Response(JSON.stringify({
        error: 'Social media marketing not found. Run /generate-social-media first.',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const socialMediaData = await socialMediaObj.json();

    return new Response(JSON.stringify(socialMediaData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching social media marketing:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Generate AI cover images using DALL-E 3
 * POST /generate-covers
 *
 * Required: reportId, title, authorName
 * Optional: numVariations (default: 3, max: 5)
 *
 * Requires: Cover brief must exist (generated via /generate-assets or cover design agent)
 */
export async function handleGenerateCovers(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { reportId, title, authorName, numVariations } = body;

    // Validate required parameters
    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!title) {
      return new Response(JSON.stringify({ error: 'title is required for cover generation' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!authorName) {
      return new Response(JSON.stringify({ error: 'authorName is required for cover generation' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Generating covers for report:', reportId);

    // Look up the manuscript key from the short report ID
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

    // Fetch cover brief (generated from /generate-assets or standalone)
    const coverBriefObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-cover-brief.json`);

    if (!coverBriefObj) {
      return new Response(JSON.stringify({
        error: 'Cover design brief not found. Please run /generate-assets first or generate a cover brief.',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const coverBriefData = await coverBriefObj.json();
    const coverBrief = coverBriefData.coverBrief || coverBriefData;

    // Get user ID for cost tracking
    // Extract userId from manuscriptKey (format: userId/manuscriptId/filename)
    const userId = manuscriptKey.split('/')[0];
    const manuscriptId = manuscriptKey.split('/')[1];

    // Initialize cover generation agent
    const coverGenAgent = new CoverGenerationAgent(env);

    console.log('Generating cover images with DALL-E 3...');

    // Generate cover images
    const result = await coverGenAgent.generate(
      manuscriptKey,
      coverBrief,
      title,
      authorName,
      numVariations || 3,
      userId,
      manuscriptId
    );

    console.log('Covers generated successfully');

    return new Response(JSON.stringify({
      success: true,
      reportId: reportId,
      covers: result
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating covers:', error);
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
 * Get generated cover images
 * GET /covers?reportId={reportId}
 */
export async function handleGetCovers(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId') || url.searchParams.get('id');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();

    // Fetch cover images metadata
    const coverImagesObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-cover-images.json`);

    if (!coverImagesObj) {
      return new Response(JSON.stringify({
        error: 'Cover images not found. Run /generate-covers first.',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const coverImagesData = await coverImagesObj.json();

    // Generate signed URLs for each cover image (valid for 1 hour)
    const coversWithUrls = await Promise.all(
      coverImagesData.coverImages.map(async (cover) => {
        // Get the actual image from R2
        const imageObj = await env.MANUSCRIPTS_PROCESSED.get(cover.r2Key);

        if (imageObj) {
          // For now, return the R2 key and metadata
          // In production, you might generate signed URLs or serve via a CDN
          return {
            ...cover,
            available: true
          };
        } else {
          return {
            ...cover,
            available: false,
            error: 'Image file not found in storage'
          };
        }
      })
    );

    return new Response(JSON.stringify({
      ...coverImagesData,
      coverImages: coversWithUrls
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching covers:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Download a specific cover image
 * GET /covers/download?reportId={reportId}&variation={variationNumber}
 */
export async function handleDownloadCover(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId');
    const variation = parseInt(url.searchParams.get('variation') || '1');

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const manuscriptKey = await mappingObject.text();

    // Build R2 key for the specific variation
    const processedKey = manuscriptKey.replace('MANUSCRIPTS_RAW', 'PROCESSED');
    const imageKey = `${processedKey}-cover-variation-${variation}.png`;

    // Fetch the image from R2
    const imageObj = await env.MANUSCRIPTS_PROCESSED.get(imageKey);

    if (!imageObj) {
      return new Response(JSON.stringify({
        error: `Cover variation ${variation} not found`,
        reportId: reportId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Return the image
    return new Response(imageObj.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="cover-variation-${variation}.png"`
      }
    });

  } catch (error) {
    console.error('Error downloading cover:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
