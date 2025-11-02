// Progress Tracking Handler
// Manages publication progress across multiple platforms with per-platform checklists

import { getUserFromRequest } from '../utils/auth-utils.js';

/**
 * Verify user session and return auth result
 */
async function verifySession(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return { authenticated: false };
  }
  return { authenticated: true, userId: user.id };
}

/**
 * Checklist template for each platform
 * Each platform has standardized checklist items
 */
const PLATFORM_CHECKLIST_TEMPLATE = {
  kdp: [
    { key: 'account_created', label: 'Account created', category: 'setup', order: 1 },
    { key: 'tax_info_submitted', label: 'Tax information submitted', category: 'setup', order: 2 },
    { key: 'payment_method_added', label: 'Payment method added', category: 'setup', order: 3 },
    { key: 'book_details_title', label: 'Title & subtitle', category: 'book_details', order: 4 },
    { key: 'book_details_author', label: 'Author name', category: 'book_details', order: 5 },
    { key: 'book_details_description', label: 'Description', category: 'book_details', order: 6 },
    { key: 'book_details_categories', label: 'Categories selected', category: 'book_details', order: 7 },
    { key: 'book_details_keywords', label: 'Keywords entered', category: 'book_details', order: 8 },
    { key: 'files_manuscript', label: 'Manuscript uploaded', category: 'files', order: 9 },
    { key: 'files_cover', label: 'Cover image uploaded', category: 'files', order: 10 },
    { key: 'pricing_set', label: 'Pricing set', category: 'publishing', order: 11 },
    { key: 'rights_territories', label: 'Rights & territories confirmed', category: 'publishing', order: 12 },
    { key: 'preview_reviewed', label: 'Preview reviewed', category: 'publishing', order: 13 },
    { key: 'published', label: 'Published!', category: 'publishing', order: 14 },
  ],
  draft2digital: [
    { key: 'account_created', label: 'Account created', category: 'setup', order: 1 },
    { key: 'tax_info_submitted', label: 'Tax information submitted', category: 'setup', order: 2 },
    { key: 'payment_method_added', label: 'Payment method added', category: 'setup', order: 3 },
    { key: 'book_details_title', label: 'Title & subtitle', category: 'book_details', order: 4 },
    { key: 'book_details_author', label: 'Author name', category: 'book_details', order: 5 },
    { key: 'book_details_description', label: 'Description', category: 'book_details', order: 6 },
    { key: 'book_details_categories', label: 'Categories selected', category: 'book_details', order: 7 },
    { key: 'book_details_keywords', label: 'Keywords entered', category: 'book_details', order: 8 },
    { key: 'files_manuscript', label: 'Manuscript uploaded', category: 'files', order: 9 },
    { key: 'files_cover', label: 'Cover image uploaded', category: 'files', order: 10 },
    { key: 'pricing_set', label: 'Pricing set', category: 'publishing', order: 11 },
    { key: 'distribution_channels', label: 'Distribution channels selected', category: 'publishing', order: 12 },
    { key: 'preview_reviewed', label: 'Preview reviewed', category: 'publishing', order: 13 },
    { key: 'published', label: 'Published!', category: 'publishing', order: 14 },
  ],
  ingramspark: [
    { key: 'account_created', label: 'Account created', category: 'setup', order: 1 },
    { key: 'tax_info_submitted', label: 'Tax information submitted', category: 'setup', order: 2 },
    { key: 'payment_method_added', label: 'Payment method added', category: 'setup', order: 3 },
    { key: 'book_details_title', label: 'Title & subtitle', category: 'book_details', order: 4 },
    { key: 'book_details_author', label: 'Author name', category: 'book_details', order: 5 },
    { key: 'book_details_description', label: 'Description', category: 'book_details', order: 6 },
    { key: 'book_details_bisac', label: 'BISAC categories selected', category: 'book_details', order: 7 },
    { key: 'files_manuscript', label: 'Print-ready PDF uploaded', category: 'files', order: 8 },
    { key: 'files_cover', label: 'Cover PDF uploaded', category: 'files', order: 9 },
    { key: 'trim_size_selected', label: 'Trim size & binding selected', category: 'publishing', order: 10 },
    { key: 'pricing_set', label: 'Pricing set', category: 'publishing', order: 11 },
    { key: 'rights_territories', label: 'Rights & territories confirmed', category: 'publishing', order: 12 },
    { key: 'distribution_setup', label: 'Distribution setup complete', category: 'publishing', order: 13 },
    { key: 'published', label: 'Published!', category: 'publishing', order: 14 },
  ],
  apple_books: [
    { key: 'account_created', label: 'Apple Books account created', category: 'setup', order: 1 },
    { key: 'tax_info_submitted', label: 'Tax information submitted', category: 'setup', order: 2 },
    { key: 'payment_method_added', label: 'Banking info added', category: 'setup', order: 3 },
    { key: 'book_details_title', label: 'Title & subtitle', category: 'book_details', order: 4 },
    { key: 'book_details_author', label: 'Author name', category: 'book_details', order: 5 },
    { key: 'book_details_description', label: 'Description', category: 'book_details', order: 6 },
    { key: 'book_details_categories', label: 'Categories selected', category: 'book_details', order: 7 },
    { key: 'files_manuscript', label: 'EPUB file uploaded', category: 'files', order: 8 },
    { key: 'files_cover', label: 'Cover image uploaded', category: 'files', order: 9 },
    { key: 'pricing_set', label: 'Pricing set', category: 'publishing', order: 10 },
    { key: 'rights_territories', label: 'Rights & territories confirmed', category: 'publishing', order: 11 },
    { key: 'preview_reviewed', label: 'Preview reviewed in Apple Books app', category: 'publishing', order: 12 },
    { key: 'published', label: 'Published!', category: 'publishing', order: 14 },
  ],
  google_play: [
    { key: 'account_created', label: 'Google Play Books account created', category: 'setup', order: 1 },
    { key: 'tax_info_submitted', label: 'Tax information submitted', category: 'setup', order: 2 },
    { key: 'payment_method_added', label: 'Banking info added', category: 'setup', order: 3 },
    { key: 'book_details_title', label: 'Title & subtitle', category: 'book_details', order: 4 },
    { key: 'book_details_author', label: 'Author name', category: 'book_details', order: 5 },
    { key: 'book_details_description', label: 'Description', category: 'book_details', order: 6 },
    { key: 'book_details_categories', label: 'Categories selected', category: 'book_details', order: 7 },
    { key: 'files_manuscript', label: 'EPUB file uploaded', category: 'files', order: 8 },
    { key: 'files_cover', label: 'Cover image uploaded', category: 'files', order: 9 },
    { key: 'pricing_set', label: 'Pricing set', category: 'publishing', order: 10 },
    { key: 'rights_territories', label: 'Rights & territories confirmed', category: 'publishing', order: 11 },
    { key: 'preview_reviewed', label: 'Preview reviewed', category: 'publishing', order: 12 },
    { key: 'published', label: 'Published!', category: 'publishing', order: 13 },
  ],
  kobo: [
    { key: 'account_created', label: 'Kobo Writing Life account created', category: 'setup', order: 1 },
    { key: 'tax_info_submitted', label: 'Tax information submitted', category: 'setup', order: 2 },
    { key: 'payment_method_added', label: 'Payment info added', category: 'setup', order: 3 },
    { key: 'book_details_title', label: 'Title & subtitle', category: 'book_details', order: 4 },
    { key: 'book_details_author', label: 'Author name', category: 'book_details', order: 5 },
    { key: 'book_details_description', label: 'Description', category: 'book_details', order: 6 },
    { key: 'book_details_categories', label: 'Categories selected', category: 'book_details', order: 7 },
    { key: 'files_manuscript', label: 'EPUB file uploaded', category: 'files', order: 8 },
    { key: 'files_cover', label: 'Cover image uploaded', category: 'files', order: 9 },
    { key: 'pricing_set', label: 'Pricing set', category: 'publishing', order: 10 },
    { key: 'rights_territories', label: 'Rights & territories confirmed', category: 'publishing', order: 11 },
    { key: 'preview_reviewed', label: 'Preview reviewed', category: 'publishing', order: 12 },
    { key: 'published', label: 'Published!', category: 'publishing', order: 13 },
  ],
  barnes_noble: [
    { key: 'account_created', label: 'Barnes & Noble Press account created', category: 'setup', order: 1 },
    { key: 'tax_info_submitted', label: 'Tax information submitted', category: 'setup', order: 2 },
    { key: 'payment_method_added', label: 'Payment info added', category: 'setup', order: 3 },
    { key: 'book_details_title', label: 'Title & subtitle', category: 'book_details', order: 4 },
    { key: 'book_details_author', label: 'Author name', category: 'book_details', order: 5 },
    { key: 'book_details_description', label: 'Description', category: 'book_details', order: 6 },
    { key: 'book_details_categories', label: 'Categories selected', category: 'book_details', order: 7 },
    { key: 'files_manuscript', label: 'EPUB file uploaded', category: 'files', order: 8 },
    { key: 'files_cover', label: 'Cover image uploaded', category: 'files', order: 9 },
    { key: 'pricing_set', label: 'Pricing set', category: 'publishing', order: 10 },
    { key: 'rights_territories', label: 'Rights & territories confirmed', category: 'publishing', order: 11 },
    { key: 'preview_reviewed', label: 'Preview reviewed', category: 'publishing', order: 12 },
    { key: 'published', label: 'Published!', category: 'publishing', order: 13 },
  ],
  publishdrive: [
    { key: 'account_created', label: 'PublishDrive account created', category: 'setup', order: 1 },
    { key: 'tax_info_submitted', label: 'Tax information submitted', category: 'setup', order: 2 },
    { key: 'payment_method_added', label: 'Payment info added', category: 'setup', order: 3 },
    { key: 'book_details_title', label: 'Title & subtitle', category: 'book_details', order: 4 },
    { key: 'book_details_author', label: 'Author name', category: 'book_details', order: 5 },
    { key: 'book_details_description', label: 'Description', category: 'book_details', order: 6 },
    { key: 'book_details_categories', label: 'Categories selected', category: 'book_details', order: 7 },
    { key: 'files_manuscript', label: 'EPUB file uploaded', category: 'files', order: 8 },
    { key: 'files_cover', label: 'Cover image uploaded', category: 'files', order: 9 },
    { key: 'pricing_set', label: 'Pricing set', category: 'publishing', order: 10 },
    { key: 'distribution_channels', label: 'Distribution channels selected', category: 'publishing', order: 11 },
    { key: 'preview_reviewed', label: 'Preview reviewed', category: 'publishing', order: 12 },
    { key: 'published', label: 'Published!', category: 'publishing', order: 13 },
  ],
};

const VALID_PLATFORMS = ['kdp', 'draft2digital', 'ingramspark', 'apple_books', 'google_play', 'kobo', 'barnes_noble', 'publishdrive'];
const VALID_STATUSES = ['not_started', 'in_progress', 'uploaded', 'live'];

/**
 * Initialize progress tracking for a manuscript on a specific platform
 * Creates the progress record and all checklist items
 */
export async function initializeProgress(request, env, manuscriptId, platform) {
  const authResult = await verifySession(request, env);
  if (!authResult.authenticated) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!VALID_PLATFORMS.includes(platform)) {
    return new Response(
      JSON.stringify({ error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Check if manuscript belongs to user
    const manuscript = await env.DB.prepare(
      'SELECT id, user_id FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (manuscript.user_id !== authResult.userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if progress already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM manuscript_publishing_progress WHERE manuscript_id = ? AND platform = ?'
    ).bind(manuscriptId, platform).first();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Progress tracking already initialized for this platform' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const progressId = crypto.randomUUID();

    // Create progress record
    await env.DB.prepare(`
      INSERT INTO manuscript_publishing_progress (
        id, manuscript_id, platform, status, overall_completion_percentage,
        started_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(progressId, manuscriptId, platform, 'not_started', 0, now, now, now).run();

    // Create all checklist items for this platform
    const template = PLATFORM_CHECKLIST_TEMPLATE[platform];
    const checklistInserts = template.map(item => {
      return env.DB.prepare(`
        INSERT INTO progress_checklist_items (
          id, progress_id, item_key, item_label, item_category, is_completed,
          sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        progressId,
        item.key,
        item.label,
        item.category,
        0,
        item.order,
        now,
        now
      );
    });

    await env.DB.batch(checklistInserts);

    return new Response(
      JSON.stringify({
        success: true,
        progressId,
        platform,
        message: `Progress tracking initialized for ${platform}`,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error initializing progress:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to initialize progress tracking' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get progress for a manuscript (all platforms or specific platform)
 */
export async function getProgress(request, env, manuscriptId, platform = null) {
  const authResult = await verifySession(request, env);
  if (!authResult.authenticated) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT id, user_id, title FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (manuscript.user_id !== authResult.userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get progress records
    const query = platform
      ? 'SELECT * FROM manuscript_publishing_progress WHERE manuscript_id = ? AND platform = ?'
      : 'SELECT * FROM manuscript_publishing_progress WHERE manuscript_id = ?';

    const params = platform ? [manuscriptId, platform] : [manuscriptId];
    const progressRecords = await env.DB.prepare(query).bind(...params).all();

    if (!progressRecords.results || progressRecords.results.length === 0) {
      return new Response(
        JSON.stringify({
          manuscript: {
            id: manuscript.id,
            title: manuscript.title,
          },
          platforms: [],
          message: 'No progress tracking initialized yet',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get checklist items for each progress record
    const platformProgress = await Promise.all(
      progressRecords.results.map(async (progress) => {
        const checklistItems = await env.DB.prepare(
          'SELECT * FROM progress_checklist_items WHERE progress_id = ? ORDER BY sort_order'
        ).bind(progress.id).all();

        return {
          platform: progress.platform,
          status: progress.status,
          overallCompletion: progress.overall_completion_percentage,
          estimatedTimeToCompletion: progress.estimated_time_to_completion,
          nextActionRecommendation: progress.next_action_recommendation,
          startedAt: progress.started_at,
          uploadedAt: progress.uploaded_at,
          publishedAt: progress.published_at,
          checklist: checklistItems.results.map(item => ({
            key: item.item_key,
            label: item.item_label,
            category: item.item_category,
            isCompleted: Boolean(item.is_completed),
            completedAt: item.completed_at,
            notes: item.completion_notes,
          })),
        };
      })
    );

    return new Response(
      JSON.stringify({
        manuscript: {
          id: manuscript.id,
          title: manuscript.title,
        },
        platforms: platformProgress,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting progress:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve progress' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Update a checklist item
 */
export async function updateChecklistItem(request, env, manuscriptId, platform, itemKey) {
  const authResult = await verifySession(request, env);
  if (!authResult.authenticated) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { isCompleted, notes } = body;

    if (typeof isCompleted !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'isCompleted must be a boolean' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify manuscript ownership and get progress record
    const progress = await env.DB.prepare(`
      SELECT mpp.id, mpp.manuscript_id, m.user_id
      FROM manuscript_publishing_progress mpp
      JOIN manuscripts m ON mpp.manuscript_id = m.id
      WHERE mpp.manuscript_id = ? AND mpp.platform = ?
    `).bind(manuscriptId, platform).first();

    if (!progress) {
      return new Response(
        JSON.stringify({ error: 'Progress tracking not initialized for this platform' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (progress.user_id !== authResult.userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // Update checklist item
    await env.DB.prepare(`
      UPDATE progress_checklist_items
      SET is_completed = ?,
          completed_at = ?,
          completion_notes = ?,
          updated_at = ?
      WHERE progress_id = ? AND item_key = ?
    `).bind(
      isCompleted ? 1 : 0,
      isCompleted ? now : null,
      notes || null,
      now,
      progress.id,
      itemKey
    ).run();

    // Recalculate completion percentage
    await recalculateCompletion(env, progress.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Checklist item updated',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating checklist item:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update checklist item' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Recalculate completion percentage for a progress record
 */
async function recalculateCompletion(env, progressId) {
  try {
    // Get all checklist items
    const items = await env.DB.prepare(
      'SELECT is_completed FROM progress_checklist_items WHERE progress_id = ?'
    ).bind(progressId).all();

    const total = items.results.length;
    const completed = items.results.filter(item => item.is_completed === 1).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Determine status based on completion
    let status = 'not_started';
    if (percentage > 0 && percentage < 100) {
      status = 'in_progress';
    } else if (percentage === 100) {
      // Check if "published" item is completed
      const publishedItem = items.results.find(item => item.item_key === 'published');
      status = publishedItem && publishedItem.is_completed === 1 ? 'live' : 'uploaded';
    }

    // Generate next action recommendation
    const nextAction = await generateNextAction(env, progressId, items.results);

    // Estimate time to completion (simplified: 5 minutes per remaining item)
    const remaining = total - completed;
    const estimatedTime = remaining * 5;

    const now = Math.floor(Date.now() / 1000);

    // Update progress record
    await env.DB.prepare(`
      UPDATE manuscript_publishing_progress
      SET overall_completion_percentage = ?,
          status = ?,
          next_action_recommendation = ?,
          estimated_time_to_completion = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(percentage, status, nextAction, estimatedTime, now, progressId).run();

  } catch (error) {
    console.error('Error recalculating completion:', error);
  }
}

/**
 * Generate next action recommendation based on checklist state
 */
async function generateNextAction(env, progressId, items) {
  try {
    // Get first incomplete item
    const checklistItems = await env.DB.prepare(
      'SELECT item_label FROM progress_checklist_items WHERE progress_id = ? AND is_completed = 0 ORDER BY sort_order LIMIT 1'
    ).bind(progressId).first();

    if (!checklistItems) {
      return 'All steps complete! Ready to publish.';
    }

    return `Next: ${checklistItems.item_label}`;
  } catch (error) {
    console.error('Error generating next action:', error);
    return null;
  }
}

/**
 * Update platform status (manual override if needed)
 */
export async function updatePlatformStatus(request, env, manuscriptId, platform) {
  const authResult = await verifySession(request, env);
  if (!authResult.authenticated) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { status } = body;

    if (!VALID_STATUSES.includes(status)) {
      return new Response(
        JSON.stringify({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    const progress = await env.DB.prepare(`
      SELECT mpp.id, m.user_id
      FROM manuscript_publishing_progress mpp
      JOIN manuscripts m ON mpp.manuscript_id = m.id
      WHERE mpp.manuscript_id = ? AND mpp.platform = ?
    `).bind(manuscriptId, platform).first();

    if (!progress) {
      return new Response(
        JSON.stringify({ error: 'Progress tracking not initialized' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (progress.user_id !== authResult.userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // Update status with appropriate timestamp
    const updates = { status, updated_at: now };
    if (status === 'uploaded' && !progress.uploaded_at) {
      updates.uploaded_at = now;
    }
    if (status === 'live' && !progress.published_at) {
      updates.published_at = now;
    }

    await env.DB.prepare(`
      UPDATE manuscript_publishing_progress
      SET status = ?,
          uploaded_at = COALESCE(uploaded_at, ?),
          published_at = COALESCE(published_at, ?),
          updated_at = ?
      WHERE id = ?
    `).bind(
      updates.status,
      status === 'uploaded' ? updates.uploaded_at : null,
      status === 'live' ? updates.published_at : null,
      updates.updated_at,
      progress.id
    ).run();

    return new Response(
      JSON.stringify({
        success: true,
        message: `Platform status updated to ${status}`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating platform status:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update status' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const progressHandlers = {
  initializeProgress,
  getProgress,
  updateChecklistItem,
  updatePlatformStatus,
};
