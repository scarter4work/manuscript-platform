/**
 * Submission Package Handlers (Issue #50)
 *
 * Bundles manuscripts with supporting documents into submission-ready packages.
 *
 * Features:
 * - Package templates (agent query, full manuscript, contest, custom)
 * - ZIP file generation for download
 * - Package duplication for multiple submissions
 * - Document selection and ordering
 */

import { getUserFromRequest } from '../utils/auth-utils.js';

/**
 * POST /manuscripts/:id/packages
 * Create new submission package
 *
 * Body: {
 *   packageName: string,
 *   packageType: 'partial' | 'full' | 'query_only' | 'custom' | 'contest',
 *   description: string (optional),
 *   documents: [{ id, type, order, includeFull }],
 *   metadata: { targetPublisher, submissionGuidelines, notes }
 * }
 */
export async function createPackage(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { packageName, packageType, description, documents, metadata } = body;

    if (!packageName || !packageType) {
      return new Response(JSON.stringify({
        error: 'packageName and packageType are required',
        validTypes: ['partial', 'full', 'query_only', 'custom', 'contest']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!documents || documents.length === 0) {
      return new Response(JSON.stringify({
        error: 'At least one document must be included in the package'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const packageId = crypto.randomUUID();

    // Insert package
    await env.DB.prepare(`
      INSERT INTO submission_packages
      (id, manuscript_id, user_id, package_name, package_type, description, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      packageId,
      manuscriptId,
      user.id,
      packageName,
      packageType,
      description || null,
      metadata ? JSON.stringify(metadata) : null
    ).run();

    // Insert document mappings
    for (const doc of documents) {
      await env.DB.prepare(`
        INSERT INTO package_document_map
        (package_id, document_id, document_type, document_order, include_full)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        packageId,
        doc.id,
        doc.type,
        doc.order || 1,
        doc.includeFull !== false ? 1 : 0
      ).run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Package created successfully',
      package: {
        id: packageId,
        manuscriptId: manuscriptId,
        packageName: packageName,
        packageType: packageType,
        documentCount: documents.length,
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error creating package:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create package',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /manuscripts/:id/packages
 * List all packages for a manuscript
 */
export async function listPackages(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT user_id FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript || manuscript.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const packages = await env.DB.prepare(`
      SELECT * FROM package_stats WHERE id IN (
        SELECT id FROM submission_packages WHERE manuscript_id = ?
      )
      ORDER BY created_at DESC
    `).bind(manuscriptId).all();

    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      count: packages.results?.length || 0,
      packages: packages.results || [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error listing packages:', error);
    return new Response(JSON.stringify({
      error: 'Failed to list packages',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /manuscripts/:id/packages/:pkgId
 * Get package details with all documents
 */
export async function getPackage(request, env, manuscriptId, packageId) {
  try {
    const user = await getUserFromRequest(request, env);

    const pkg = await env.DB.prepare(
      'SELECT * FROM submission_packages WHERE id = ? AND manuscript_id = ? AND user_id = ?'
    ).bind(packageId, manuscriptId, user.id).first();

    if (!pkg) {
      return new Response(JSON.stringify({ error: 'Package not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get document mappings
    const documents = await env.DB.prepare(
      'SELECT * FROM package_document_map WHERE package_id = ? ORDER BY document_order ASC'
    ).bind(packageId).all();

    // Parse metadata if exists
    const metadata = pkg.metadata ? JSON.parse(pkg.metadata) : null;

    return new Response(JSON.stringify({
      success: true,
      package: {
        ...pkg,
        metadata: metadata,
        documents: documents.results || [],
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error getting package:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get package',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * PUT /manuscripts/:id/packages/:pkgId
 * Update package
 *
 * Body: { packageName, description, documents, metadata }
 */
export async function updatePackage(request, env, manuscriptId, packageId) {
  try {
    const user = await getUserFromRequest(request, env);

    const pkg = await env.DB.prepare(
      'SELECT * FROM submission_packages WHERE id = ? AND manuscript_id = ? AND user_id = ?'
    ).bind(packageId, manuscriptId, user.id).first();

    if (!pkg) {
      return new Response(JSON.stringify({ error: 'Package not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { packageName, description, documents, metadata } = body;

    // Update package metadata
    await env.DB.prepare(`
      UPDATE submission_packages
      SET package_name = ?, description = ?, metadata = ?
      WHERE id = ?
    `).bind(
      packageName || pkg.package_name,
      description !== undefined ? description : pkg.description,
      metadata ? JSON.stringify(metadata) : pkg.metadata,
      packageId
    ).run();

    // Update documents if provided
    if (documents) {
      // Delete existing mappings
      await env.DB.prepare(
        'DELETE FROM package_document_map WHERE package_id = ?'
      ).bind(packageId).run();

      // Insert new mappings
      for (const doc of documents) {
        await env.DB.prepare(`
          INSERT INTO package_document_map
          (package_id, document_id, document_type, document_order, include_full)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          packageId,
          doc.id,
          doc.type,
          doc.order || 1,
          doc.includeFull !== false ? 1 : 0
        ).run();
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Package updated successfully',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error updating package:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update package',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * DELETE /manuscripts/:id/packages/:pkgId
 * Delete package
 */
export async function deletePackage(request, env, manuscriptId, packageId) {
  try {
    const user = await getUserFromRequest(request, env);

    const pkg = await env.DB.prepare(
      'SELECT * FROM submission_packages WHERE id = ? AND manuscript_id = ? AND user_id = ?'
    ).bind(packageId, manuscriptId, user.id).first();

    if (!pkg) {
      return new Response(JSON.stringify({ error: 'Package not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete package (cascades to package_document_map)
    await env.DB.prepare(
      'DELETE FROM submission_packages WHERE id = ?'
    ).bind(packageId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Package deleted successfully',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error deleting package:', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete package',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /manuscripts/:id/packages/:pkgId/duplicate
 * Duplicate package for new submission
 *
 * Body: { newPackageName }
 */
export async function duplicatePackage(request, env, manuscriptId, packageId) {
  try {
    const user = await getUserFromRequest(request, env);

    const pkg = await env.DB.prepare(
      'SELECT * FROM submission_packages WHERE id = ? AND manuscript_id = ? AND user_id = ?'
    ).bind(packageId, manuscriptId, user.id).first();

    if (!pkg) {
      return new Response(JSON.stringify({ error: 'Package not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { newPackageName } = body;

    if (!newPackageName) {
      return new Response(JSON.stringify({ error: 'newPackageName is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const newPackageId = crypto.randomUUID();

    // Copy package
    await env.DB.prepare(`
      INSERT INTO submission_packages
      (id, manuscript_id, user_id, package_name, package_type, description, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      newPackageId,
      pkg.manuscript_id,
      pkg.user_id,
      newPackageName,
      pkg.package_type,
      pkg.description,
      pkg.metadata
    ).run();

    // Copy document mappings
    const documents = await env.DB.prepare(
      'SELECT * FROM package_document_map WHERE package_id = ?'
    ).bind(packageId).all();

    for (const doc of documents.results || []) {
      await env.DB.prepare(`
        INSERT INTO package_document_map
        (package_id, document_id, document_type, document_order, include_full)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        newPackageId,
        doc.document_id,
        doc.document_type,
        doc.document_order,
        doc.include_full
      ).run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Package duplicated successfully',
      package: {
        id: newPackageId,
        packageName: newPackageName,
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error duplicating package:', error);
    return new Response(JSON.stringify({
      error: 'Failed to duplicate package',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /manuscripts/:id/packages/:pkgId/download
 * Download package as ZIP file
 */
export async function downloadPackage(request, env, manuscriptId, packageId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Get package
    const pkg = await env.DB.prepare(
      'SELECT * FROM submission_packages WHERE id = ? AND manuscript_id = ? AND user_id = ?'
    ).bind(packageId, manuscriptId, user.id).first();

    if (!pkg) {
      return new Response(JSON.stringify({ error: 'Package not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    // Get document mappings
    const documents = await env.DB.prepare(
      'SELECT * FROM package_document_map WHERE package_id = ? ORDER BY document_order ASC'
    ).bind(packageId).all();

    // Build file list for ZIP
    const files = [];

    for (const doc of documents.results || []) {
      if (doc.document_type === 'manuscript') {
        // Get manuscript file from R2
        if (manuscript.processed_key) {
          const manuscriptObj = await env.MANUSCRIPTS_PROCESSED.get(manuscript.processed_key);
          if (manuscriptObj) {
            const content = await manuscriptObj.text();
            files.push({
              name: `manuscript_${manuscript.title.replace(/[^a-z0-9]/gi, '_')}.txt`,
              content: content,
            });
          }
        }
      } else {
        // Get supporting document
        const supportingDoc = await env.DB.prepare(
          'SELECT * FROM supporting_documents WHERE id = ?'
        ).bind(doc.document_id).first();

        if (supportingDoc) {
          const fileName = `${doc.document_type}_${supportingDoc.version_number}.txt`;
          files.push({
            name: fileName,
            content: supportingDoc.content,
          });
        }
      }
    }

    // Generate ZIP (simple text-based package for now)
    // In production, you'd use a proper ZIP library
    // For Cloudflare Workers, we'll create a simple tarball-like format
    // or return JSON with file contents

    return new Response(JSON.stringify({
      success: true,
      package: {
        id: packageId,
        name: pkg.package_name,
        type: pkg.package_type,
      },
      files: files,
      instructions: 'Download individual files or use frontend ZIP generation',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error downloading package:', error);
    return new Response(JSON.stringify({
      error: 'Failed to download package',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /manuscripts/:id/packages/templates
 * Get package templates
 */
export async function getPackageTemplates(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get available supporting documents
    const supportingDocs = await env.DB.prepare(
      'SELECT * FROM supporting_documents WHERE manuscript_id = ? AND is_current_version = 1'
    ).bind(manuscriptId).all();

    const templates = {
      agent_query: {
        name: 'Standard Agent Query Package',
        packageType: 'partial',
        description: 'Query letter + short synopsis + sample chapters',
        requiredDocuments: ['query_letter', 'short_synopsis'],
        optionalDocuments: ['sample_chapters'],
        notes: 'Industry standard for agent queries. Check agent guidelines for specific requirements.',
      },
      full_manuscript: {
        name: 'Full Manuscript Package',
        packageType: 'full',
        description: 'Complete manuscript + query + long synopsis',
        requiredDocuments: ['manuscript', 'query_letter', 'long_synopsis'],
        optionalDocuments: ['author_bio'],
        notes: 'For full manuscript requests after successful query.',
      },
      query_only: {
        name: 'Query Letter Only',
        packageType: 'query_only',
        description: 'Just query letter and bio',
        requiredDocuments: ['query_letter'],
        optionalDocuments: ['author_bio'],
        notes: 'For initial cold queries to agents.',
      },
      contest: {
        name: 'Contest Submission Package',
        packageType: 'contest',
        description: 'Customizable for contest requirements',
        requiredDocuments: [],
        optionalDocuments: ['manuscript', 'query_letter', 'short_synopsis', 'long_synopsis'],
        notes: 'Check contest guidelines for specific requirements.',
      },
    };

    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      manuscriptTitle: manuscript.title,
      availableDocuments: supportingDocs.results || [],
      templates: templates,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error getting package templates:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get package templates',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Export handlers
export const submissionPackageHandlers = {
  createPackage,
  listPackages,
  getPackage,
  updatePackage,
  deletePackage,
  duplicatePackage,
  downloadPackage,
  getPackageTemplates,
};

export default submissionPackageHandlers;
