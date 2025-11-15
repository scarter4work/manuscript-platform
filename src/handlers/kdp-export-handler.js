// KDP Export Handler (MAN-15)
// Generates a KDP-ready export package for manual upload to Amazon KDP

/**
import crypto from 'crypto';

 * Generate KDP export package
 *
 * Creates a ZIP file containing:
 * - Formatted manuscript (EPUB or original DOCX)
 * - Cover image (JPG, 2560x1600 minimum)
 * - Metadata file with pre-filled KDP details
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Environment bindings
 * @param {string} manuscriptId - Manuscript ID
 */
export async function generateKDPPackage(request, env, manuscriptId) {
  try {
    // Get user
    const userId = request?.headers?.get('X-User-Id');
    if (!userId) {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get manuscript
    const manuscript = await env.DB.prepare(`
      SELECT * FROM manuscripts
      WHERE id = ? AND user_id = ?
    `).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if analysis is complete
    if (manuscript.status !== 'analyzed') {
      return new Response(JSON.stringify({
        error: 'Please complete manuscript analysis before exporting to KDP',
        currentStatus: manuscript.status
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch analysis results for metadata
    const r2KeyPrefix = `${userId}/${manuscriptId}/`;

    // Get book description from assets
    let bookDescription = '';
    let keywords = [];
    let categories = [];
    let coverImageUrl = null;

    try {
      const descObj = await env.R2.getBucket('marketing_assets').get(`${r2KeyPrefix}book-description.txt`);
      if (descObj) {
        bookDescription = await descObj.text();
      }

      const keywordsObj = await env.R2.getBucket('marketing_assets').get(`${r2KeyPrefix}keywords.json`);
      if (keywordsObj) {
        const keywordsData = JSON.parse(await keywordsObj.text());
        keywords = keywordsData.keywords ? keywordsData.keywords.slice(0, 7) : [];
      }

      const categoriesObj = await env.R2.getBucket('marketing_assets').get(`${r2KeyPrefix}categories.json`);
      if (categoriesObj) {
        const categoriesData = JSON.parse(await categoriesObj.text());
        categories = categoriesData.categories ? categoriesData.categories.slice(0, 2) : [];
      }

      // Get cover image
      const coverObj = await env.R2.getBucket('marketing_assets').get(`${r2KeyPrefix}cover-design.png`);
      if (coverObj) {
        coverImageUrl = `${r2KeyPrefix}cover-design.png`;
      }
    } catch (error) {
      console.warn('Could not fetch some marketing assets:', error);
    }

    // Generate KDP metadata file
    const metadata = generateKDPMetadata({
      title: manuscript.title,
      author: manuscript.author_name || 'Unknown Author',
      description: bookDescription,
      keywords,
      categories,
      genre: manuscript.genre,
      language: 'English', // Default, could be configurable
      wordCount: manuscript.word_count
    });

    // Get original manuscript file
    const manuscriptKey = `${userId}/${manuscriptId}/${manuscript.filename}`;
    const manuscriptObj = await env.R2.getBucket('manuscripts_raw').get(manuscriptKey);

    if (!manuscriptObj) {
      return new Response(JSON.stringify({
        error: 'Original manuscript file not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const manuscriptBuffer = await manuscriptObj.arrayBuffer();

    // Get cover image if available
    let coverBuffer = null;
    if (coverImageUrl) {
      const coverObj = await env.R2.getBucket('marketing_assets').get(coverImageUrl);
      if (coverObj) {
        coverBuffer = await coverObj.arrayBuffer();
      }
    }

    // Create package files array
    const packageFiles = [];

    // Add manuscript file
    packageFiles.push({
      name: `manuscript.${manuscript.filename.split('.').pop()}`,
      content: manuscriptBuffer,
      type: 'application/octet-stream'
    });

    // Add metadata file
    packageFiles.push({
      name: 'KDP_METADATA.txt',
      content: new TextEncoder().encode(metadata),
      type: 'text/plain'
    });

    // Add cover image if available
    if (coverBuffer) {
      packageFiles.push({
        name: 'cover.png',
        content: coverBuffer,
        type: 'image/png'
      });
    }

    // Add README with instructions
    const readme = generateKDPReadme(manuscript.title);
    packageFiles.push({
      name: 'README.txt',
      content: new TextEncoder().encode(readme),
      type: 'text/plain'
    });

    // For now, we'll create a simple package response
    // In production, we'd create a proper ZIP file using a library
    // Since we're in Cloudflare Workers, we'll use a simple approach

    // Store package metadata in DB
    const packageId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      INSERT INTO kdp_export_packages (
        id, manuscript_id, user_id, status, created_at
      ) VALUES (?, ?, ?, 'ready', ?)
    `).bind(packageId, manuscriptId, userId, timestamp).run();

    // For simplicity, return metadata and download links
    // A more complete implementation would create a ZIP file
    return new Response(JSON.stringify({
      success: true,
      packageId,
      manuscript: {
        title: manuscript.title,
        author: manuscript.author_name,
        filename: manuscript.filename,
        wordCount: manuscript.word_count
      },
      metadata: {
        description: bookDescription,
        keywords,
        categories
      },
      files: {
        manuscript: `/api/kdp/download/${packageId}/manuscript`,
        cover: coverBuffer ? `/api/kdp/download/${packageId}/cover` : null,
        metadata: `/api/kdp/download/${packageId}/metadata`,
        readme: `/api/kdp/download/${packageId}/readme`
      },
      instructions: readme
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('KDP package generation error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate KDP package',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Generate KDP metadata text file
 */
function generateKDPMetadata(data) {
  const {
    title,
    author,
    description,
    keywords = [],
    categories = [],
    genre,
    language,
    wordCount
  } = data;

  return `
=================================================================
AMAZON KDP METADATA - PRE-FILLED FROM MANUSCRIPTHUB
=================================================================

TITLE:
${title}

AUTHOR NAME:
${author}

DESCRIPTION (max 4000 characters):
${description || 'Add your book description here'}

KEYWORDS (up to 7):
${keywords.slice(0, 7).map((k, i) => `${i + 1}. ${k}`).join('\n') || '1. [Add keyword]\n2. [Add keyword]\n3. [Add keyword]\n4. [Add keyword]\n5. [Add keyword]\n6. [Add keyword]\n7. [Add keyword]'}

BISAC CATEGORIES (select 2):
${categories.slice(0, 2).map((c, i) => `${i + 1}. ${c}`).join('\n') || '1. [Select from KDP category browser]\n2. [Select from KDP category browser]'}

GENRE/TYPE:
${genre || 'Fiction'}

LANGUAGE:
${language}

ESTIMATED WORD COUNT:
${wordCount ? wordCount.toLocaleString() : 'N/A'}

=================================================================
ADDITIONAL SETTINGS TO CONFIGURE IN KDP:
=================================================================

PUBLICATION RIGHTS:
☐ I own the copyright and hold necessary publishing rights

TERRITORIES:
☐ Worldwide rights
☐ Individual territories (specify)

PRICING:
- Suggested: $2.99 - $9.99 (70% royalty tier)
- Your price: $_______

DRM (Digital Rights Management):
☐ Enable DRM
☐ Disable DRM

ISBN:
☐ Use free KDP ISBN
☐ Use your own ISBN: _______________

AGE AND GRADE RANGE:
☐ Not applicable
☐ Specify range: _______________

PRE-ORDER:
☐ Available for pre-order
☐ Publish immediately

=================================================================
NEXT STEPS:
=================================================================

1. Log in to kdp.amazon.com
2. Click "Create New Title" > "Kindle eBook"
3. Fill in the metadata from this file
4. Upload the manuscript file
5. Upload the cover image
6. Set your pricing
7. Click "Publish"

Generated by ManuscriptHub - https://selfpubhub.co
=================================================================
`.trim();
}

/**
 * Generate README instructions
 */
function generateKDPReadme(title) {
  return `
=================================================================
AMAZON KDP EXPORT PACKAGE - ${title}
=================================================================

This package contains everything you need to publish your book
on Amazon Kindle Direct Publishing (KDP).

FILES INCLUDED:
---------------

1. manuscript.[docx/doc/txt] - Your formatted manuscript
2. cover.png - Your book cover image (if generated)
3. KDP_METADATA.txt - Pre-filled metadata for KDP
4. README.txt - This file

HOW TO PUBLISH TO AMAZON KDP:
------------------------------

STEP 1: Prepare Your KDP Account
- Go to https://kdp.amazon.com
- Sign in or create a new account
- Complete your account setup and tax information

STEP 2: Create New Kindle eBook
- Click the "Kindle eBook" button under "Create New Title"
- You'll see three sections: Kindle eBook Details, Kindle eBook Content, Kindle eBook Pricing

STEP 3: Fill in eBook Details
- Open KDP_METADATA.txt
- Copy the pre-filled information into the KDP form:
  * Title
  * Author name
  * Description
  * Keywords (up to 7)
  * Categories (select 2 from KDP's browser)
  * Language
  * Publication rights

STEP 4: Upload Content
- In the "Kindle eBook Content" section:
  * Upload your manuscript file
  * Upload your cover image (if included)
  * Preview your book using KDP's previewer
  * Make any necessary adjustments

STEP 5: Set Pricing
- Choose your pricing strategy:
  * $2.99 - $9.99 for 70% royalty
  * Below $2.99 or above $9.99 for 35% royalty
- Select territories (worldwide recommended)
- Enable/disable DRM as preferred

STEP 6: Publish
- Review all information
- Click "Publish Your Kindle eBook"
- Your book will be reviewed by Amazon (usually 24-72 hours)
- Once approved, it will be live on Amazon!

TIPS FOR SUCCESS:
-----------------

✓ Use the pre-filled keywords and categories - they're AI-optimized
✓ Price competitively based on your genre
✓ Enable pre-orders to build momentum
✓ Use the free KDP ISBN if you don't have one
✓ Preview your book on multiple devices before publishing
✓ Consider enrolling in KDP Select for promotional tools

NEED HELP?
----------

- KDP Help: https://kdp.amazon.com/help
- KDP Community Forums: https://kdp.amazon.com/community
- ManuscriptHub Support: support@selfpubhub.co

Good luck with your publication! 🚀

Generated by ManuscriptHub
https://selfpubhub.co
=================================================================
`.trim();
}

/**
 * Download individual files from KDP package
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Environment bindings
 * @param {string} packageId - Package ID
 * @param {string} fileType - File type: 'manuscript', 'cover', 'metadata', 'readme'
 */
export async function downloadKDPFile(request, env, packageId, fileType) {
  try {
    // Get user
    const userId = request?.headers?.get('X-User-Id');
    if (!userId) {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get package
    const pkg = await env.DB.prepare(`
      SELECT kep.*, m.filename, m.user_id as manuscript_user_id
      FROM kdp_export_packages kep
      JOIN manuscripts m ON kep.manuscript_id = m.id
      WHERE kep.id = ? AND kep.user_id = ?
    `).bind(packageId, userId).first();

    if (!pkg) {
      return new Response(JSON.stringify({
        error: 'Package not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if expired (30 days)
    if (pkg.expires_at && pkg.expires_at < Math.floor(Date.now() / 1000)) {
      return new Response(JSON.stringify({
        error: 'Package has expired. Please regenerate.'
      }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let fileContent, contentType, filename;

    switch (fileType) {
      case 'manuscript':
        // Get original manuscript
        const manuscriptKey = `${pkg.user_id}/${pkg.manuscript_id}/${pkg.filename}`;
        const manuscriptObj = await env.R2.getBucket('manuscripts_raw').get(manuscriptKey);

        if (!manuscriptObj) {
          return new Response(JSON.stringify({ error: 'Manuscript file not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        fileContent = await manuscriptObj.arrayBuffer();
        contentType = 'application/octet-stream';
        filename = `manuscript.${pkg.filename.split('.').pop()}`;
        break;

      case 'cover':
        // Get cover image
        const coverKey = `${pkg.user_id}/${pkg.manuscript_id}/cover-design.png`;
        const coverObj = await env.R2.getBucket('marketing_assets').get(coverKey);

        if (!coverObj) {
          return new Response(JSON.stringify({ error: 'Cover image not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        fileContent = await coverObj.arrayBuffer();
        contentType = 'image/png';
        filename = 'cover.png';
        break;

      case 'metadata':
        // Generate metadata file
        const metadata = generateKDPMetadata({
          title: pkg.title,
          author: pkg.author_name,
          description: pkg.description,
          keywords: pkg.keywords ? JSON.parse(pkg.keywords) : [],
          categories: pkg.categories ? JSON.parse(pkg.categories) : [],
          language: 'English'
        });

        fileContent = new TextEncoder().encode(metadata);
        contentType = 'text/plain';
        filename = 'KDP_METADATA.txt';
        break;

      case 'readme':
        // Generate README
        const readme = generateKDPReadme(pkg.title);
        fileContent = new TextEncoder().encode(readme);
        contentType = 'text/plain';
        filename = 'README.txt';
        break;

      default:
        return new Response(JSON.stringify({
          error: 'Invalid file type'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

    // Update download tracking
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(`
      UPDATE kdp_export_packages
      SET download_count = download_count + 1,
          last_downloaded_at = ?,
          first_downloaded_at = COALESCE(first_downloaded_at, ?)
      WHERE id = ?
    `).bind(now, now, packageId).run();

    // Return file
    return new Response(fileContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('KDP file download error:', error);
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
 * List all KDP export packages for a user
 */
export async function listKDPPackages(request, env) {
  try {
    // Get user
    const userId = request?.headers?.get('X-User-Id');
    if (!userId) {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get packages
    const packages = await env.DB.prepare(`
      SELECT
        kep.*,
        m.title as manuscript_title,
        m.filename as manuscript_filename
      FROM kdp_export_packages kep
      JOIN manuscripts m ON kep.manuscript_id = m.id
      WHERE kep.user_id = ?
      ORDER BY kep.created_at DESC
      LIMIT 50
    `).bind(userId).all();

    const now = Math.floor(Date.now() / 1000);

    return new Response(JSON.stringify({
      success: true,
      packages: packages.results.map(pkg => ({
        packageId: pkg.id,
        manuscriptId: pkg.manuscript_id,
        title: pkg.title,
        author: pkg.author_name,
        status: pkg.expires_at && pkg.expires_at < now ? 'expired' : pkg.status,
        downloadCount: pkg.download_count,
        createdAt: pkg.created_at,
        expiresAt: pkg.expires_at,
        files: {
          manuscript: `/api/kdp/download/${pkg.id}/manuscript`,
          cover: pkg.has_cover ? `/api/kdp/download/${pkg.id}/cover` : null,
          metadata: `/api/kdp/download/${pkg.id}/metadata`,
          readme: `/api/kdp/download/${pkg.id}/readme`
        }
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('List KDP packages error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to list packages',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const kdpHandlers = {
  generateKDPPackage,
  downloadKDPFile,
  listKDPPackages
};
