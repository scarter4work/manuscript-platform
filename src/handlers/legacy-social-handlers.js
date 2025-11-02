// Legacy social media handler functions extracted from worker.js
// These handlers manage social media marketing generation

import { SocialMediaAgent } from '../agents/social-media-agent.js';

/**
 * Handle social media marketing generation (Phase 5)
 */
async function handleGenerateSocialMedia(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { reportId } = body;

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
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
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Social media generation error:', error);
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

/**
 * Get social media marketing results
 */
async function handleGetSocialMedia(request, env, corsHeaders) {
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

    // Fetch social media marketing results
    const socialMediaObj = await env.MANUSCRIPTS_PROCESSED.get(`${manuscriptKey}-social-media.json`);

    if (!socialMediaObj) {
      return new Response(JSON.stringify({
        error: 'Social media marketing not found. Run /generate-social-media first.',
        reportId: reportId
      }), {
        status: 404,
        headers: { ...allHeaders, 'Content-Type': 'application/json' }
      });
    }

    const socialMediaData = await socialMediaObj.json();

    return new Response(JSON.stringify(socialMediaData), {
      status: 200,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching social media marketing:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...allHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export {
  handleGenerateSocialMedia,
  handleGetSocialMedia
};
