// Publishing HTTP Handlers
// Endpoints for multi-platform publishing support

import { checkManuscriptAccess } from './manuscript-handlers.js';
import { PlatformMetadataAgent } from '../agents/platform-metadata-agent.js';
import { FormatConversionAgent } from '../agents/format-conversion-agent.js';
import { DistributionAgent } from '../agents/distribution-agent.js';

/**
 * Generate platform-specific metadata
 * POST /manuscripts/:id/publishing/metadata
 */
export async function generatePlatformMetadata(request, env, manuscriptId) {
  try {
    // Authenticate
    const authHeader = request?.headers?.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await env.USERS_KV.get(`session:${token}`, 'json');
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check access
    const hasAccess = await checkManuscriptAccess(env, manuscriptId, user.userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request
    const body = await request.json();
    const { platforms = ['all'], baseMetadata } = body;

    if (!baseMetadata) {
      return new Response(JSON.stringify({ error: 'baseMetadata is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    // Construct manuscript key
    const manuscriptKey = `${user.userId}/${manuscriptId}/${manuscript.filename}`;

    // Generate platform metadata
    const agent = new PlatformMetadataAgent(env);
    const metadata = await agent.generatePlatformMetadata(
      manuscriptKey,
      baseMetadata,
      platforms,
      user.userId,
      manuscriptId
    );

    return new Response(JSON.stringify({
      success: true,
      metadata
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in generatePlatformMetadata:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Prepare manuscript formats
 * POST /manuscripts/:id/publishing/formats
 */
export async function prepareFormats(request, env, manuscriptId) {
  try {
    // Authenticate
    const authHeader = request?.headers?.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await env.USERS_KV.get(`session:${token}`, 'json');
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check access
    const hasAccess = await checkManuscriptAccess(env, manuscriptId, user.userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request
    const body = await request.json();
    const { targetFormats = ['epub', 'mobi', 'pdf'] } = body;

    // Fetch manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    // Construct manuscript key
    const manuscriptKey = `${user.userId}/${manuscriptId}/${manuscript.filename}`;

    // Prepare formats
    const agent = new FormatConversionAgent(env);
    const result = await agent.prepareFormats(
      manuscriptKey,
      targetFormats,
      {
        title: manuscript.title,
        author: manuscript.author_name,
        genre: manuscript.genre,
        wordCount: manuscript.word_count
      },
      user.userId,
      manuscriptId
    );

    return new Response(JSON.stringify({
      success: true,
      formats: result.formats,
      structure: result.structure
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in prepareFormats:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Generate distribution strategy
 * POST /manuscripts/:id/publishing/strategy
 */
export async function generateDistributionStrategy(request, env, manuscriptId) {
  try {
    // Authenticate
    const authHeader = request?.headers?.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await env.USERS_KV.get(`session:${token}`, 'json');
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check access
    const hasAccess = await checkManuscriptAccess(env, manuscriptId, user.userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request
    const body = await request.json();
    const { authorGoals = {} } = body;

    // Fetch manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    // Fetch user's previous books
    const previousBooks = await env.DB.prepare(
      'SELECT id, title, published_date FROM manuscripts WHERE user_id = ? AND id != ? AND status = ?'
    ).bind(user.userId, manuscriptId, 'published').all();

    // Generate distribution strategy
    const agent = new DistributionAgent(env);
    const strategy = await agent.generateStrategy(
      {
        title: manuscript.title,
        genre: manuscript.genre,
        targetAudience: manuscript.target_audience,
        wordCount: manuscript.word_count,
        seriesInfo: manuscript.series_name ? {
          isPartOfSeries: true,
          seriesName: manuscript.series_name,
          seriesNumber: manuscript.series_number
        } : { isPartOfSeries: false },
        previousBooks: previousBooks.results
      },
      authorGoals,
      user.userId,
      manuscriptId
    );

    return new Response(JSON.stringify({
      success: true,
      strategy
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in generateDistributionStrategy:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get publishing package (all-in-one generation)
 * POST /manuscripts/:id/publishing/package
 */
export async function generatePublishingPackage(request, env, manuscriptId) {
  try {
    // Authenticate
    const authHeader = request?.headers?.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await env.USERS_KV.get(`session:${token}`, 'json');
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check access
    const hasAccess = await checkManuscriptAccess(env, manuscriptId, user.userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request
    const body = await request.json();
    const {
      packageType = 'wide', // wide, kdp_select, print_digital
      baseMetadata,
      authorGoals = {}
    } = body;

    // Determine platforms based on package type
    let platforms;
    switch (packageType) {
      case 'wide':
        platforms = ['kdp', 'draft2digital', 'google_play', 'apple_books', 'kobo'];
        break;
      case 'kdp_select':
        platforms = ['kdp'];
        break;
      case 'print_digital':
        platforms = ['kdp', 'ingramspark'];
        break;
      default:
        platforms = ['all'];
    }

    // Fetch manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    const manuscriptKey = `${user.userId}/${manuscriptId}/${manuscript.filename}`;

    // Generate all components in parallel
    const [metadata, formats, strategy] = await Promise.all([
      new PlatformMetadataAgent(env).generatePlatformMetadata(
        manuscriptKey,
        baseMetadata,
        platforms,
        user.userId,
        manuscriptId
      ),
      new FormatConversionAgent(env).prepareFormats(
        manuscriptKey,
        ['epub', 'mobi', 'pdf', 'print'],
        {
          title: manuscript.title,
          author: manuscript.author_name,
          genre: manuscript.genre,
          wordCount: manuscript.word_count
        },
        user.userId,
        manuscriptId
      ),
      new DistributionAgent(env).generateStrategy(
        {
          title: manuscript.title,
          genre: manuscript.genre,
          targetAudience: manuscript.target_audience,
          wordCount: manuscript.word_count,
          seriesInfo: { isPartOfSeries: false }
        },
        authorGoals,
        user.userId,
        manuscriptId
      )
    ]);

    return new Response(JSON.stringify({
      success: true,
      packageType,
      package: {
        platformMetadata: metadata,
        formatPreparation: formats,
        distributionStrategy: strategy,
        generatedAt: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in generatePublishingPackage:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Export handlers object
export const publishingHandlers = {
  generatePlatformMetadata,
  prepareFormats,
  generateDistributionStrategy,
  generatePublishingPackage
};
