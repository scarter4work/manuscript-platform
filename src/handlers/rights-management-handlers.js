/**
 * Rights Management Handlers
 * API endpoints for publishing rights tracking, territorial restrictions, and rights status
 */

/**
 * GET /manuscripts/:id/rights
 * Get all rights for a manuscript
 */
export async function handleGetManuscriptRights(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all rights
    const rights = await env.DB.prepare(`
      SELECT * FROM manuscript_rights
      WHERE manuscript_id = ? AND user_id = ?
      ORDER BY created_at DESC
    `).bind(manuscriptId, userId).all();

    // Parse JSON fields
    const parsedRights = rights.results?.map(right => ({
      ...right,
      territories: right.territories ? JSON.parse(right.territories) : null,
      languages: right.languages ? JSON.parse(right.languages) : null
    })) || [];

    return new Response(JSON.stringify({
      success: true,
      manuscript: {
        id: manuscript.id,
        title: manuscript.title
      },
      rights: parsedRights,
      count: parsedRights.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting manuscript rights:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get rights',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /manuscripts/:id/rights
 * Create new rights grant
 */
export async function handleCreateRights(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const {
      rightsType,
      rightsStatus = 'available',
      grantedToPublisherId,
      grantedToPublisherName,
      exclusive = false,
      grantStartDate,
      grantEndDate,
      grantDurationYears,
      reversionClause,
      autoReversion = false,
      territories,
      languages,
      advance,
      royaltyRate,
      royaltyEscalation,
      contractFileKey,
      contractSignedDate,
      notes
    } = body;

    if (!rightsType) {
      return new Response(JSON.stringify({
        error: 'Missing required field: rightsType'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check for conflicts (same rights type already granted)
    const existingGrant = await env.DB.prepare(`
      SELECT * FROM manuscript_rights
      WHERE manuscript_id = ? AND rights_type = ? AND rights_status = 'granted'
    `).bind(manuscriptId, rightsType).first();

    if (existingGrant && exclusive) {
      return new Response(JSON.stringify({
        error: 'Conflict: This rights type is already granted',
        existingRightsId: existingGrant.id
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create rights grant
    const rightsId = `rights-${crypto.randomUUID()}`;
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      INSERT INTO manuscript_rights (
        id, manuscript_id, user_id, rights_type, rights_status,
        granted_to_publisher_id, granted_to_publisher_name,
        exclusive, grant_start_date, grant_end_date, grant_duration_years,
        reversion_clause, auto_reversion,
        territories, languages,
        advance, royalty_rate, royalty_escalation,
        contract_file_key, contract_signed_date,
        notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      rightsId, manuscriptId, userId, rightsType, rightsStatus,
      grantedToPublisherId || null, grantedToPublisherName || null,
      exclusive ? 1 : 0,
      grantStartDate || null,
      grantEndDate || null,
      grantDurationYears || null,
      reversionClause || null,
      autoReversion ? 1 : 0,
      territories ? JSON.stringify(territories) : null,
      languages ? JSON.stringify(languages) : null,
      advance || null,
      royaltyRate || null,
      royaltyEscalation || null,
      contractFileKey || null,
      contractSignedDate || null,
      notes || null,
      now
    ).run();

    // Get created rights
    const rights = await env.DB.prepare(
      'SELECT * FROM manuscript_rights WHERE id = ?'
    ).bind(rightsId).first();

    return new Response(JSON.stringify({
      success: true,
      rights: {
        ...rights,
        territories: rights.territories ? JSON.parse(rights.territories) : null,
        languages: rights.languages ? JSON.parse(rights.languages) : null
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating rights:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create rights',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /manuscripts/:id/rights/:rightId
 * Update rights grant
 */
export async function handleUpdateRights(request, env) {
  const { manuscriptId, rightId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();

    // Verify ownership
    const rights = await env.DB.prepare(`
      SELECT * FROM manuscript_rights
      WHERE id = ? AND manuscript_id = ? AND user_id = ?
    `).bind(rightId, manuscriptId, userId).first();

    if (!rights) {
      return new Response(JSON.stringify({
        error: 'Rights not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    const fields = {
      rightsStatus: 'rights_status',
      grantedToPublisherId: 'granted_to_publisher_id',
      grantedToPublisherName: 'granted_to_publisher_name',
      exclusive: 'exclusive',
      grantStartDate: 'grant_start_date',
      grantEndDate: 'grant_end_date',
      grantDurationYears: 'grant_duration_years',
      reversionClause: 'reversion_clause',
      autoReversion: 'auto_reversion',
      reversionDate: 'reversion_date',
      advance: 'advance',
      royaltyRate: 'royalty_rate',
      royaltyEscalation: 'royalty_escalation',
      contractFileKey: 'contract_file_key',
      contractSignedDate: 'contract_signed_date',
      notes: 'notes'
    };

    Object.keys(fields).forEach(key => {
      if (body.hasOwnProperty(key)) {
        updates.push(`${fields[key]} = ?`);
        let value = body[key];
        if (key === 'exclusive' || key === 'autoReversion') {
          value = value ? 1 : 0;
        }
        params.push(value);
      }
    });

    // Handle JSON fields
    if (body.territories) {
      updates.push('territories = ?');
      params.push(JSON.stringify(body.territories));
    }
    if (body.languages) {
      updates.push('languages = ?');
      params.push(JSON.stringify(body.languages));
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        error: 'No fields to update'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    params.push(rightId);

    await env.DB.prepare(`
      UPDATE manuscript_rights
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...params).run();

    // Get updated rights
    const updatedRights = await env.DB.prepare(
      'SELECT * FROM manuscript_rights WHERE id = ?'
    ).bind(rightId).first();

    return new Response(JSON.stringify({
      success: true,
      rights: {
        ...updatedRights,
        territories: updatedRights.territories ? JSON.parse(updatedRights.territories) : null,
        languages: updatedRights.languages ? JSON.parse(updatedRights.languages) : null
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating rights:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update rights',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /manuscripts/:id/rights/:rightId
 * Delete rights grant
 */
export async function handleDeleteRights(request, env) {
  const { manuscriptId, rightId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Verify ownership
    const rights = await env.DB.prepare(`
      SELECT * FROM manuscript_rights
      WHERE id = ? AND manuscript_id = ? AND user_id = ?
    `).bind(rightId, manuscriptId, userId).first();

    if (!rights) {
      return new Response(JSON.stringify({
        error: 'Rights not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete rights
    await env.DB.prepare(
      'DELETE FROM manuscript_rights WHERE id = ?'
    ).bind(rightId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Rights deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting rights:', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete rights',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /manuscripts/:id/publication-history
 * Get publication history for a manuscript
 */
export async function handleGetPublicationHistory(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get publication history
    const history = await env.DB.prepare(`
      SELECT * FROM publication_history
      WHERE manuscript_id = ? AND user_id = ?
      ORDER BY publication_date DESC
    `).bind(manuscriptId, userId).all();

    // Parse JSON fields
    const parsedHistory = history.results?.map(entry => ({
      ...entry,
      rights_sold: entry.rights_sold ? JSON.parse(entry.rights_sold) : null
    })) || [];

    return new Response(JSON.stringify({
      success: true,
      manuscript: {
        id: manuscript.id,
        title: manuscript.title
      },
      history: parsedHistory,
      count: parsedHistory.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting publication history:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get publication history',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /manuscripts/:id/publication-history
 * Add publication history entry
 */
export async function handleAddPublicationHistory(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const {
      publicationType,
      publicationName,
      publicationDate,
      publicationUrl,
      rightsSold,
      rightsCurrentlyHeld = 'author',
      rightsReversionDate,
      rightsReversionDocumentation,
      isbn,
      circulation,
      paymentReceived,
      notes
    } = body;

    if (!publicationType || !publicationName) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: publicationType, publicationName'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create publication history entry
    const historyId = `history-${crypto.randomUUID()}`;
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      INSERT INTO publication_history (
        id, manuscript_id, user_id, publication_type, publication_name,
        publication_date, publication_url, rights_sold, rights_currently_held,
        rights_reversion_date, rights_reversion_documentation,
        isbn, circulation, payment_received, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      historyId, manuscriptId, userId, publicationType, publicationName,
      publicationDate || null,
      publicationUrl || null,
      rightsSold ? JSON.stringify(rightsSold) : null,
      rightsCurrentlyHeld,
      rightsReversionDate || null,
      rightsReversionDocumentation || null,
      isbn || null,
      circulation || null,
      paymentReceived || null,
      notes || null,
      now
    ).run();

    // Get created entry
    const entry = await env.DB.prepare(
      'SELECT * FROM publication_history WHERE id = ?'
    ).bind(historyId).first();

    return new Response(JSON.stringify({
      success: true,
      history: {
        ...entry,
        rights_sold: entry.rights_sold ? JSON.parse(entry.rights_sold) : null
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error adding publication history:', error);
    return new Response(JSON.stringify({
      error: 'Failed to add publication history',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /manuscripts/:id/rights/available
 * Get available rights (not granted or offered)
 */
export async function handleGetAvailableRights(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all granted/offered rights
    const grantedRights = await env.DB.prepare(`
      SELECT DISTINCT rights_type FROM manuscript_rights
      WHERE manuscript_id = ? AND rights_status IN ('granted', 'offered')
    `).bind(manuscriptId).all();

    const grantedTypes = new Set(grantedRights.results?.map(r => r.rights_type) || []);

    // List all rights types
    const allRightsTypes = [
      'first_serial',
      'north_american',
      'world_english',
      'world',
      'translation',
      'audio',
      'film_tv',
      'electronic',
      'print',
      'dramatic',
      'merchandising',
      'anthology',
      'excerpt'
    ];

    const availableRights = allRightsTypes.filter(type => !grantedTypes.has(type));

    return new Response(JSON.stringify({
      success: true,
      manuscript: {
        id: manuscript.id,
        title: manuscript.title
      },
      availableRights,
      grantedRights: Array.from(grantedTypes)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting available rights:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get available rights',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /rights/expiring-soon
 * Get rights expiring in next 90 days
 */
export async function handleGetExpiringRights(request, env) {
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const expiring = await env.DB.prepare(`
      SELECT * FROM rights_expiring_soon
      WHERE user_id = ?
      ORDER BY days_until_expiration ASC
    `).bind(userId).all();

    return new Response(JSON.stringify({
      success: true,
      expiringRights: expiring.results || [],
      count: expiring.results?.length || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting expiring rights:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get expiring rights',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /rights/templates
 * Get rights templates
 */
export async function handleGetRightsTemplates(request, env) {
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get system templates and user's custom templates
    const templates = await env.DB.prepare(`
      SELECT * FROM rights_templates
      WHERE (template_type = 'system' OR user_id = ?) AND is_active = 1
      ORDER BY template_type ASC, template_name ASC
    `).bind(userId).all();

    // Parse JSON fields
    const parsedTemplates = templates.results?.map(template => ({
      ...template,
      rights_types: template.rights_types ? JSON.parse(template.rights_types) : null,
      default_territories: template.default_territories ? JSON.parse(template.default_territories) : null,
      default_languages: template.default_languages ? JSON.parse(template.default_languages) : null
    })) || [];

    return new Response(JSON.stringify({
      success: true,
      templates: parsedTemplates,
      count: parsedTemplates.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting rights templates:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get rights templates',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /manuscripts/:id/rights/check-conflicts
 * Check for rights conflicts
 */
export async function handleCheckRightsConflicts(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all active rights
    const rights = await env.DB.prepare(`
      SELECT * FROM manuscript_rights
      WHERE manuscript_id = ? AND rights_status = 'granted'
      ORDER BY rights_type, grant_start_date
    `).bind(manuscriptId).all();

    const conflicts = [];

    // Check for conflicts
    const rightsArray = rights.results || [];
    for (let i = 0; i < rightsArray.length; i++) {
      for (let j = i + 1; j < rightsArray.length; j++) {
        const r1 = rightsArray[i];
        const r2 = rightsArray[j];

        // Same rights type conflict
        if (r1.rights_type === r2.rights_type) {
          // Check time overlap
          const hasTimeOverlap =
            (r1.grant_start_date && r2.grant_start_date && r1.grant_end_date && r2.grant_end_date) &&
            (r1.grant_start_date <= r2.grant_end_date && r2.grant_start_date <= r1.grant_end_date);

          if (hasTimeOverlap || (!r1.grant_end_date && !r2.grant_end_date)) {
            conflicts.push({
              conflictType: 'time_overlap',
              rightsType: r1.rights_type,
              rights1: r1,
              rights2: r2,
              description: `Time overlap for ${r1.rights_type} rights`
            });
          }

          // Exclusive conflict
          if (r1.exclusive || r2.exclusive) {
            conflicts.push({
              conflictType: 'exclusive_violation',
              rightsType: r1.rights_type,
              rights1: r1,
              rights2: r2,
              description: `Exclusive ${r1.rights_type} rights conflict`
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      manuscriptId,
      conflicts,
      hasConflicts: conflicts.length > 0,
      conflictCount: conflicts.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error checking rights conflicts:', error);
    return new Response(JSON.stringify({
      error: 'Failed to check rights conflicts',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
