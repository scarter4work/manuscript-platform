// Series Management Handlers
// API handlers for series management features

import { getUserFromRequest } from '../utils/auth-utils.js';
import {
  createSeries,
  getSeries,
  listUserSeries,
  updateSeries,
  deleteSeries,
  addManuscriptToSeries,
  removeManuscriptFromSeries,
  updateSeriesManuscript,
  createSeriesBundle,
  createReadingOrder,
  calculateReadThroughRate,
  generateSeriesBackmatter,
  getSeriesPerformance,
  generateSeriesMarketingCopy,
} from '../managers/series-manager.js';

/**
 * Create a new series
 * POST /series
 */
export async function handleCreateSeries(request, env) {
  try {
    const user = await getUserFromRequest(request, env);
    const seriesData = await request.json();

    // Validate required fields
    if (!seriesData.seriesName) {
      return new Response(JSON.stringify({
        error: 'seriesName is required',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const series = await createSeries(env, user.id, seriesData);

    return new Response(JSON.stringify({
      success: true,
      message: 'Series created successfully',
      series: series,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating series:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create series',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get series details
 * GET /series/:id
 */
export async function handleGetSeries(request, env, seriesId) {
  try {
    const user = await getUserFromRequest(request, env);

    const series = await getSeries(env, seriesId, user.id);

    if (!series) {
      return new Response(JSON.stringify({
        error: 'Series not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      series: series,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error getting series:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get series',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * List all series for a user
 * GET /series
 */
export async function handleListSeries(request, env) {
  try {
    const user = await getUserFromRequest(request, env);

    // Parse query params
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || null;
    const genre = url.searchParams.get('genre') || null;
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const series = await listUserSeries(env, user.id, {
      status,
      genre,
      limit,
      offset,
    });

    return new Response(JSON.stringify({
      success: true,
      series: series,
      count: series.length,
      limit: limit,
      offset: offset,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error listing series:', error);
    return new Response(JSON.stringify({
      error: 'Failed to list series',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Update series
 * PATCH /series/:id
 */
export async function handleUpdateSeries(request, env, seriesId) {
  try {
    const user = await getUserFromRequest(request, env);
    const updates = await request.json();

    const series = await updateSeries(env, seriesId, user.id, updates);

    return new Response(JSON.stringify({
      success: true,
      message: 'Series updated successfully',
      series: series,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating series:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update series',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Delete series
 * DELETE /series/:id
 */
export async function handleDeleteSeries(request, env, seriesId) {
  try {
    const user = await getUserFromRequest(request, env);

    const success = await deleteSeries(env, seriesId, user.id);

    if (!success) {
      return new Response(JSON.stringify({
        error: 'Series not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Series deleted successfully',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error deleting series:', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete series',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Add manuscript to series
 * POST /series/:id/manuscripts
 */
export async function handleAddManuscriptToSeries(request, env, seriesId) {
  try {
    const user = await getUserFromRequest(request, env);
    const data = await request.json();

    // Validate series ownership
    const series = await getSeries(env, seriesId, user.id);
    if (!series) {
      return new Response(JSON.stringify({
        error: 'Series not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate required fields
    if (!data.manuscriptId || !data.bookNumber) {
      return new Response(JSON.stringify({
        error: 'manuscriptId and bookNumber are required',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(data.manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const entry = await addManuscriptToSeries(env, seriesId, data.manuscriptId, data);

    return new Response(JSON.stringify({
      success: true,
      message: 'Manuscript added to series successfully',
      entry: entry,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error adding manuscript to series:', error);
    return new Response(JSON.stringify({
      error: 'Failed to add manuscript to series',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Remove manuscript from series
 * DELETE /series/:id/manuscripts/:manuscriptId
 */
export async function handleRemoveManuscriptFromSeries(request, env, seriesId, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Validate series ownership
    const series = await getSeries(env, seriesId, user.id);
    if (!series) {
      return new Response(JSON.stringify({
        error: 'Series not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const success = await removeManuscriptFromSeries(env, seriesId, manuscriptId);

    if (!success) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found in series',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Manuscript removed from series successfully',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error removing manuscript from series:', error);
    return new Response(JSON.stringify({
      error: 'Failed to remove manuscript from series',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Update manuscript in series
 * PATCH /series/:id/manuscripts/:manuscriptId
 */
export async function handleUpdateSeriesManuscript(request, env, seriesId, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);
    const updates = await request.json();

    // Validate series ownership
    const series = await getSeries(env, seriesId, user.id);
    if (!series) {
      return new Response(JSON.stringify({
        error: 'Series not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const entry = await updateSeriesManuscript(env, seriesId, manuscriptId, updates);

    return new Response(JSON.stringify({
      success: true,
      message: 'Series manuscript updated successfully',
      entry: entry,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating series manuscript:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update series manuscript',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Create series bundle
 * POST /series/:id/bundles
 */
export async function handleCreateBundle(request, env, seriesId) {
  try {
    const user = await getUserFromRequest(request, env);
    const bundleData = await request.json();

    // Validate series ownership
    const series = await getSeries(env, seriesId, user.id);
    if (!series) {
      return new Response(JSON.stringify({
        error: 'Series not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate required fields
    if (!bundleData.bundleName || !bundleData.includedBookNumbers) {
      return new Response(JSON.stringify({
        error: 'bundleName and includedBookNumbers are required',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const bundle = await createSeriesBundle(env, seriesId, bundleData);

    return new Response(JSON.stringify({
      success: true,
      message: 'Bundle created successfully',
      bundle: bundle,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating bundle:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create bundle',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Create custom reading order
 * POST /series/:id/reading-orders
 */
export async function handleCreateReadingOrder(request, env, seriesId) {
  try {
    const user = await getUserFromRequest(request, env);
    const orderData = await request.json();

    // Validate series ownership
    const series = await getSeries(env, seriesId, user.id);
    if (!series) {
      return new Response(JSON.stringify({
        error: 'Series not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate required fields
    if (!orderData.orderName || !orderData.bookOrder) {
      return new Response(JSON.stringify({
        error: 'orderName and bookOrder are required',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const readingOrder = await createReadingOrder(env, seriesId, orderData);

    return new Response(JSON.stringify({
      success: true,
      message: 'Reading order created successfully',
      readingOrder: readingOrder,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating reading order:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create reading order',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get read-through rate
 * GET /series/:id/read-through
 */
export async function handleGetReadThroughRate(request, env, seriesId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Validate series ownership
    const series = await getSeries(env, seriesId, user.id);
    if (!series) {
      return new Response(JSON.stringify({
        error: 'Series not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const readThrough = await calculateReadThroughRate(env, seriesId);

    return new Response(JSON.stringify({
      success: true,
      seriesId: seriesId,
      seriesName: series.series_name,
      readThrough: readThrough,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error getting read-through rate:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get read-through rate',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Generate backmatter for a book in the series
 * GET /series/:id/backmatter/:bookNumber
 */
export async function handleGenerateBackmatter(request, env, seriesId, bookNumber) {
  try {
    const user = await getUserFromRequest(request, env);

    // Validate series ownership
    const series = await getSeries(env, seriesId, user.id);
    if (!series) {
      return new Response(JSON.stringify({
        error: 'Series not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const backmatter = await generateSeriesBackmatter(env, seriesId, parseFloat(bookNumber));

    return new Response(JSON.stringify({
      success: true,
      seriesId: seriesId,
      bookNumber: parseFloat(bookNumber),
      backmatter: backmatter,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating backmatter:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate backmatter',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get series performance metrics
 * GET /series/:id/performance
 */
export async function handleGetPerformance(request, env, seriesId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Validate series ownership
    const series = await getSeries(env, seriesId, user.id);
    if (!series) {
      return new Response(JSON.stringify({
        error: 'Series not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const performance = await getSeriesPerformance(env, seriesId);

    return new Response(JSON.stringify({
      success: true,
      seriesId: seriesId,
      seriesName: series.series_name,
      performance: performance,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error getting series performance:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get series performance',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Generate series marketing copy
 * GET /series/:id/marketing
 */
export async function handleGenerateMarketing(request, env, seriesId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Validate series ownership
    const series = await getSeries(env, seriesId, user.id);
    if (!series) {
      return new Response(JSON.stringify({
        error: 'Series not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const marketing = await generateSeriesMarketingCopy(env, seriesId);

    return new Response(JSON.stringify({
      success: true,
      seriesId: seriesId,
      seriesName: series.series_name,
      marketing: marketing,
      usage: {
        shortTagline: 'Use in social media posts, email subject lines',
        mediumPitch: 'Use in newsletter announcements, social media captions',
        longPitch: 'Use in blog posts, author website, Amazon author page',
        bingeReadPitch: 'Use in social media ads, email campaigns',
        completeSeries: 'Use in marketing when series is complete',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating marketing copy:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate marketing copy',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Export handlers
export const seriesHandlers = {
  handleCreateSeries,
  handleGetSeries,
  handleListSeries,
  handleUpdateSeries,
  handleDeleteSeries,
  handleAddManuscriptToSeries,
  handleRemoveManuscriptFromSeries,
  handleUpdateSeriesManuscript,
  handleCreateBundle,
  handleCreateReadingOrder,
  handleGetReadThroughRate,
  handleGenerateBackmatter,
  handleGetPerformance,
  handleGenerateMarketing,
};

export default seriesHandlers;
