/**
 * Amazon KDP Integration Handlers
 * Semi-automated Amazon KDP publishing workflow
 */

import { generateKDPPackage, validateKDPPackage, calculateRoyalties } from '../generators/kdp-package-generator.js';

/**
 * POST /manuscripts/:id/kdp/prepare
 * Prepare KDP submission package
 */
export async function handlePrepareKDPPackage(request, env) {
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
      metadata,
      epubKey, // Optional: existing EPUB from formatting engine
      coverKey
    } = body;

    // Validate required fields
    if (!metadata || !coverKey) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        required: ['metadata', 'coverKey']
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
      return new Response(JSON.stringify({ error: 'Manuscript not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if package already exists
    const existingPackage = await env.DB.prepare(
      'SELECT * FROM kdp_packages WHERE manuscript_id = ? AND package_status IN (?, ?)'
    ).bind(manuscriptId, 'ready', 'generating').first();

    if (existingPackage) {
      return new Response(JSON.stringify({
        error: 'Package already exists',
        packageId: existingPackage.id,
        status: existingPackage.package_status
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create package record
    const packageId = `kdp-${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO kdp_packages (
        id, manuscript_id, user_id, package_status
      ) VALUES (?, ?, ?, ?)
    `).bind(packageId, manuscriptId, userId, 'generating').run();

    // Generate package
    const packageResult = await generateKDPPackage({
      manuscriptId,
      userId,
      metadata,
      epubKey,
      coverKey
    }, env);

    // Store files in R2 (optional - for download later)
    // For now, we return files directly for client-side ZIP generation

    // Save metadata
    const metadataId = `kdp-meta-${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO kdp_metadata (
        id, package_id, manuscript_id, title, subtitle, series_name, series_number,
        author_name, contributors, description, description_length, author_bio,
        primary_category, secondary_category, bisac_codes, keywords,
        age_range_min, age_range_max, grade_level,
        publishing_rights, territories, isbn_type, isbn, publication_date,
        price_usd, price_gbp, price_eur, price_cad, price_aud,
        royalty_option, kdp_select_enrolled, enable_lending,
        format_type, trim_size, bleed_settings, paper_color,
        adult_content, public_domain
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      metadataId,
      packageId,
      manuscriptId,
      metadata.title,
      metadata.subtitle || null,
      metadata.series_name || null,
      metadata.series_number || null,
      metadata.author_name,
      metadata.contributors ? JSON.stringify(metadata.contributors) : null,
      metadata.description,
      metadata.description.length,
      metadata.author_bio || null,
      metadata.primary_category || null,
      metadata.secondary_category || null,
      metadata.bisac_codes ? JSON.stringify(metadata.bisac_codes) : null,
      JSON.stringify(metadata.keywords),
      metadata.age_range_min || null,
      metadata.age_range_max || null,
      metadata.grade_level || null,
      metadata.publishing_rights,
      metadata.territories ? JSON.stringify(metadata.territories) : null,
      metadata.isbn_type || 'amazon_free',
      metadata.isbn || null,
      metadata.publication_date || null,
      metadata.price_usd || null,
      metadata.price_gbp || null,
      metadata.price_eur || null,
      metadata.price_cad || null,
      metadata.price_aud || null,
      metadata.royalty_option || '35',
      metadata.kdp_select_enrolled ? 1 : 0,
      metadata.enable_lending !== false ? 1 : 0,
      metadata.format_type || 'ebook',
      metadata.trim_size || null,
      metadata.bleed_settings || null,
      metadata.paper_color || null,
      metadata.adult_content ? 1 : 0,
      metadata.public_domain ? 1 : 0
    ).run();

    // Update package status
    await env.DB.prepare(`
      UPDATE kdp_packages
      SET package_status = ?, package_size = ?, epub_key = ?, cover_key = ?,
          expiration_date = ?
      WHERE id = ?
    `).bind(
      'ready',
      packageResult.stats.totalSizeBytes,
      epubKey,
      coverKey,
      Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // Expires in 30 days
      packageId
    ).run();

    return new Response(JSON.stringify({
      success: true,
      packageId,
      files: packageResult.files,
      stats: packageResult.stats,
      metadata: packageResult.metadata,
      message: 'KDP package prepared successfully. Download files to upload to Amazon KDP.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error preparing KDP package:', error);
    return new Response(JSON.stringify({
      error: 'Failed to prepare KDP package',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /manuscripts/:id/kdp/package
 * Get KDP package details
 */
export async function handleGetKDPPackage(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get package
    const packageData = await env.DB.prepare(`
      SELECT kp.*, km.*
      FROM kdp_packages kp
      LEFT JOIN kdp_metadata km ON kp.id = km.package_id
      WHERE kp.manuscript_id = ? AND kp.user_id = ?
      ORDER BY kp.created_at DESC
      LIMIT 1
    `).bind(manuscriptId, userId).first();

    if (!packageData) {
      return new Response(JSON.stringify({ error: 'Package not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get validation results
    const validationResults = await env.DB.prepare(`
      SELECT * FROM kdp_validation_results
      WHERE package_id = ?
      ORDER BY validated_at DESC
    `).bind(packageData.id).all();

    // Get royalty calculations
    const royaltyCalc = await env.DB.prepare(`
      SELECT * FROM kdp_royalty_calculations
      WHERE package_id = ?
      ORDER BY calculated_at DESC
      LIMIT 1
    `).bind(packageData.id).first();

    return new Response(JSON.stringify({
      success: true,
      package: packageData,
      validation: validationResults.results || [],
      royalty: royaltyCalc
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting KDP package:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get KDP package',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /manuscripts/:id/kdp/validate
 * Validate KDP package against Amazon specs
 */
export async function handleValidateKDPPackage(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get package
    const packageData = await env.DB.prepare(`
      SELECT kp.*, km.*
      FROM kdp_packages kp
      LEFT JOIN kdp_metadata km ON kp.id = km.package_id
      WHERE kp.manuscript_id = ? AND kp.user_id = ?
      ORDER BY kp.created_at DESC
      LIMIT 1
    `).bind(manuscriptId, userId).first();

    if (!packageData) {
      return new Response(JSON.stringify({ error: 'Package not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Run validation
    const validationResult = await validateKDPPackage({
      packageId: packageData.id,
      epubKey: packageData.epub_key,
      coverKey: packageData.cover_key,
      metadata: packageData
    }, env);

    // Save validation results
    const validationId = `kdp-val-${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO kdp_validation_results (
        id, package_id, validation_type, status, issues, recommendations
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      validationId,
      packageData.id,
      'full_package',
      validationResult.status,
      JSON.stringify(validationResult.issues),
      JSON.stringify(validationResult.recommendations)
    ).run();

    // Update package validation status
    await env.DB.prepare(`
      UPDATE kdp_packages
      SET validation_passed = ?
      WHERE id = ?
    `).bind(
      validationResult.status === 'pass' ? 1 : 0,
      packageData.id
    ).run();

    return new Response(JSON.stringify({
      success: true,
      validation: validationResult
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error validating KDP package:', error);
    return new Response(JSON.stringify({
      error: 'Failed to validate KDP package',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /kdp/royalty-calculator
 * Calculate royalty estimates
 */
export async function handleCalculateRoyalties(request, env) {
  try {
    const url = new URL(request.url);
    const priceUSD = parseFloat(url.searchParams.get('price')) || 0;
    const royaltyOption = url.searchParams.get('royalty') || '35';
    const fileSizeMB = parseFloat(url.searchParams.get('fileSize')) || 0;

    if (priceUSD <= 0) {
      return new Response(JSON.stringify({
        error: 'Invalid price',
        message: 'Price must be greater than 0'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const calculation = calculateRoyalties({
      priceUSD,
      royaltyOption,
      fileSizeMB
    });

    return new Response(JSON.stringify({
      success: true,
      royalty: calculation
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error calculating royalties:', error);
    return new Response(JSON.stringify({
      error: 'Failed to calculate royalties',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /manuscripts/:id/kdp/royalty
 * Save royalty calculation for a package
 */
export async function handleSaveRoyaltyCalculation(request, env) {
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
    const { priceUSD, royaltyOption, fileSizeMB } = body;

    // Get package
    const packageData = await env.DB.prepare(`
      SELECT * FROM kdp_packages
      WHERE manuscript_id = ? AND user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(manuscriptId, userId).first();

    if (!packageData) {
      return new Response(JSON.stringify({ error: 'Package not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate royalties
    const calculation = calculateRoyalties({
      priceUSD,
      royaltyOption,
      fileSizeMB
    });

    // Save calculation
    const calcId = `kdp-calc-${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO kdp_royalty_calculations (
        id, package_id, price_usd, royalty_option,
        royalty_per_sale_usd, delivery_cost_usd, net_royalty_usd,
        file_size_mb,
        minimum_price_35, maximum_price_35, minimum_price_70, maximum_price_70,
        recommended_royalty, recommendation_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      calcId,
      packageData.id,
      calculation.priceUSD,
      calculation.royaltyOption,
      calculation.royaltyPerSaleUSD,
      calculation.deliveryCostUSD,
      calculation.netRoyaltyUSD,
      calculation.fileSizeMB,
      calculation.limits.minimum_price_35,
      calculation.limits.maximum_price_35,
      calculation.limits.minimum_price_70,
      calculation.limits.maximum_price_70,
      calculation.recommendedRoyalty,
      calculation.recommendationReason
    ).run();

    return new Response(JSON.stringify({
      success: true,
      calculation
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error saving royalty calculation:', error);
    return new Response(JSON.stringify({
      error: 'Failed to save royalty calculation',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /manuscripts/:id/kdp/package
 * Delete KDP package
 */
export async function handleDeleteKDPPackage(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get package
    const packageData = await env.DB.prepare(`
      SELECT * FROM kdp_packages
      WHERE manuscript_id = ? AND user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(manuscriptId, userId).first();

    if (!packageData) {
      return new Response(JSON.stringify({ error: 'Package not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete package (cascades to metadata, validation, royalty)
    await env.DB.prepare(`
      DELETE FROM kdp_packages WHERE id = ?
    `).bind(packageData.id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'KDP package deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting KDP package:', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete KDP package',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /manuscripts/:id/kdp/stats
 * Get KDP statistics
 */
export async function handleGetKDPStats(request, env) {
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get user's KDP stats
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(DISTINCT kp.id) as total_packages,
        COUNT(DISTINCT CASE WHEN kp.package_status = 'ready' THEN kp.id END) as ready_packages,
        COUNT(DISTINCT CASE WHEN kp.validation_passed = 1 THEN kp.id END) as validated_packages,
        COUNT(DISTINCT kps.id) as publishing_attempts,
        COUNT(DISTINCT CASE WHEN kps.status = 'live' THEN kps.id END) as live_books
      FROM kdp_packages kp
      LEFT JOIN kdp_publishing_status kps ON kp.id = kps.package_id
      WHERE kp.user_id = ?
    `).bind(userId).first();

    return new Response(JSON.stringify({
      success: true,
      stats
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting KDP stats:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get KDP stats',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
