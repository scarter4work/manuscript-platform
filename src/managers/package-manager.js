// Package Manager
// Manages creation and bundling of platform-specific export packages

import { strToU8, zipSync } from 'fflate';
import { getUserFromRequest } from '../utils/auth-utils.js';

/**
 * Platform-specific file requirements
 */
const PLATFORM_FILES = {
  kdp: {
    name: 'Amazon KDP',
    files: [
      { key: 'manuscript', filename: 'manuscript.docx', required: true },
      { key: 'cover_ebook', filename: 'cover-ebook.jpg', required: true },
      { key: 'interior_print', filename: 'interior-print.pdf', required: false },
      { key: 'cover_print', filename: 'cover-print.pdf', required: false },
      { key: 'metadata', filename: 'metadata.txt', required: true },
    ],
  },
  draft2digital: {
    name: 'Draft2Digital',
    files: [
      { key: 'manuscript', filename: 'manuscript.docx', required: true },
      { key: 'cover', filename: 'cover.jpg', required: true },
      { key: 'metadata', filename: 'metadata.txt', required: true },
    ],
  },
  ingramspark: {
    name: 'IngramSpark',
    files: [
      { key: 'interior', filename: 'interior.pdf', required: true },
      { key: 'cover', filename: 'cover.pdf', required: true },
      { key: 'metadata', filename: 'metadata.txt', required: true },
    ],
  },
  apple_books: {
    name: 'Apple Books',
    files: [
      { key: 'manuscript', filename: 'manuscript.epub', required: true },
      { key: 'cover', filename: 'cover.jpg', required: true },
      { key: 'metadata', filename: 'metadata.txt', required: true },
    ],
  },
  google_play: {
    name: 'Google Play Books',
    files: [
      { key: 'manuscript', filename: 'manuscript.epub', required: true },
      { key: 'cover', filename: 'cover.jpg', required: true },
      { key: 'metadata', filename: 'metadata.txt', required: true },
    ],
  },
  kobo: {
    name: 'Kobo Writing Life',
    files: [
      { key: 'manuscript', filename: 'manuscript.epub', required: true },
      { key: 'cover', filename: 'cover.jpg', required: true },
      { key: 'metadata', filename: 'metadata.txt', required: true },
    ],
  },
  barnes_noble: {
    name: 'Barnes & Noble Press',
    files: [
      { key: 'manuscript', filename: 'manuscript.epub', required: true },
      { key: 'cover', filename: 'cover.jpg', required: true },
      { key: 'metadata', filename: 'metadata.txt', required: true },
    ],
  },
  publishdrive: {
    name: 'PublishDrive',
    files: [
      { key: 'manuscript', filename: 'manuscript.epub', required: true },
      { key: 'cover', filename: 'cover.jpg', required: true },
      { key: 'metadata', filename: 'metadata.txt', required: true },
    ],
  },
};

/**
 * Generate README file with platform-specific upload instructions
 */
function generateReadme(manuscriptTitle, platforms) {
  const readme = `
MANUSCRIPT PUBLISHING PACKAGE
==============================

Manuscript: ${manuscriptTitle}
Generated: ${new Date().toISOString()}

This package contains all files needed to publish your manuscript to multiple platforms.

DIRECTORY STRUCTURE
===================

${platforms.map(p => {
  const platform = PLATFORM_FILES[p];
  return `/${p}/
  Platform: ${platform.name}
  Files: ${platform.files.map(f => f.filename).join(', ')}`;
}).join('\n\n')}

UPLOAD INSTRUCTIONS
===================

${platforms.includes('kdp') ? `
AMAZON KDP (Kindle Direct Publishing)
--------------------------------------
1. Log in to https://kdp.amazon.com
2. Click "Create" > "Kindle eBook" or "Paperback"
3. Fill in book details (use metadata.txt as reference)
4. Upload files from /kdp/ folder:
   - Ebook: Upload manuscript.docx and cover-ebook.jpg
   - Print: Upload interior-print.pdf and cover-print.pdf
5. Set pricing and rights
6. Preview and publish

` : ''}${platforms.includes('draft2digital') ? `
DRAFT2DIGITAL
-------------
1. Log in to https://draft2digital.com
2. Click "Add a Book"
3. Upload manuscript.docx from /draft2digital/ folder
4. Upload cover.jpg
5. Fill in metadata (use metadata.txt as reference)
6. Select distribution channels
7. Publish

` : ''}${platforms.includes('ingramspark') ? `
INGRAMSPARK
-----------
1. Log in to https://ingramspark.com
2. Click "Add a Title"
3. Fill in title information (use metadata.txt as reference)
4. Upload interior.pdf from /ingramspark/ folder
5. Upload cover.pdf
6. Set pricing and distribution
7. Submit for review

` : ''}${platforms.includes('apple_books') ? `
APPLE BOOKS
-----------
1. Log in to https://books.apple.com/us/app/apple-books-connect
2. Click "Add a Book"
3. Upload manuscript.epub from /apple_books/ folder
4. Upload cover.jpg
5. Fill in metadata (use metadata.txt as reference)
6. Set pricing and territories
7. Submit for review

` : ''}${platforms.includes('google_play') ? `
GOOGLE PLAY BOOKS
-----------------
1. Log in to https://play.google.com/books/publish
2. Click "Add new book"
3. Upload manuscript.epub from /google_play/ folder
4. Upload cover.jpg
5. Fill in metadata (use metadata.txt as reference)
6. Set pricing and territories
7. Publish

` : ''}${platforms.includes('kobo') ? `
KOBO WRITING LIFE
-----------------
1. Log in to https://writinglife.kobobooks.com
2. Click "Add a Book"
3. Upload manuscript.epub from /kobo/ folder
4. Upload cover.jpg
5. Fill in metadata (use metadata.txt as reference)
6. Set pricing
7. Publish

` : ''}${platforms.includes('barnes_noble') ? `
BARNES & NOBLE PRESS
---------------------
1. Log in to https://press.barnesandnoble.com
2. Click "Create New Project"
3. Upload manuscript.epub from /barnes_noble/ folder
4. Upload cover.jpg
5. Fill in metadata (use metadata.txt as reference)
6. Set pricing
7. Publish

` : ''}${platforms.includes('publishdrive') ? `
PUBLISHDRIVE
------------
1. Log in to https://publishdrive.com
2. Click "Add New Book"
3. Upload manuscript.epub from /publishdrive/ folder
4. Upload cover.jpg
5. Fill in metadata (use metadata.txt as reference)
6. Select distribution channels
7. Publish to selected stores

` : ''}
METADATA FILES
==============

Each platform folder contains a metadata.txt file with:
- Title and subtitle
- Author name
- Description
- Keywords
- Categories
- ISBN (if applicable)
- Pricing recommendations

Review and customize metadata for each platform before uploading.

SUPPORT
=======

For questions or issues, contact: support@selfpubhub.co

Generated by ManuscriptHub - https://selfpubhub.co
`;

  return readme.trim();
}

/**
 * Generate metadata file for a platform
 */
function generateMetadata(manuscript, platform) {
  const metadata = `
METADATA FOR ${PLATFORM_FILES[platform].name.toUpperCase()}
${'='.repeat(50)}

Title: ${manuscript.title || 'Untitled Manuscript'}
Author: ${manuscript.author_name || 'Unknown Author'}

Description:
${manuscript.description || 'No description provided.'}

Genre: ${manuscript.genre || 'Not specified'}

Keywords: ${manuscript.keywords || 'fiction, novel'}

Categories: ${manuscript.categories || 'General Fiction'}

${platform === 'kdp' ? `
Amazon-Specific Fields:
- BISAC Category 1: Fiction / General
- BISAC Category 2: Fiction / Literary
- Age Range: Adult
- Language: English
- Publication Date: ${new Date().toISOString().split('T')[0]}
` : ''}

${platform === 'draft2digital' ? `
Draft2Digital-Specific Fields:
- Distribution: All available retailers
- DRM: No
- Preorder: No
` : ''}

${platform === 'ingramspark' ? `
IngramSpark-Specific Fields:
- Trim Size: 6" x 9"
- Paper Type: White or Cream
- Binding: Perfect Bound
- BISAC Categories: (select from IngramSpark system)
` : ''}

Pricing Recommendations:
- Ebook: $2.99 - $9.99 (70% royalty tier)
- Paperback: $12.99 - $19.99 (based on page count)

Notes:
- Review all metadata before uploading to platform
- Customize categories and keywords for each platform
- Check platform-specific requirements

Generated: ${new Date().toISOString()}
`;

  return metadata.trim();
}

/**
 * Create a ZIP package for a specific platform
 */
export async function createPlatformPackage(env, manuscriptId, userId, platform) {
  try {
    // Get manuscript metadata
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      throw new Error('Manuscript not found');
    }

    const platformSpec = PLATFORM_FILES[platform];
    if (!platformSpec) {
      throw new Error(`Invalid platform: ${platform}`);
    }

    // Build file map for ZIP
    const files = {};
    const platformPath = `${sanitizeFilename(manuscript.title)}/${platform}/`;

    // Add metadata file
    const metadata = generateMetadata(manuscript, platform);
    files[`${platformPath}metadata.txt`] = strToU8(metadata);

    // Get manuscript file (assuming it's stored in R2)
    const manuscriptKey = `${userId}/${manuscriptId}/${manuscript.filename}`;
    const manuscriptObject = await env.R2.getBucket('manuscripts_processed').get(manuscriptKey) ||
                            await env.R2.getBucket('manuscripts_raw').get(manuscriptKey);

    if (manuscriptObject) {
      const manuscriptBuffer = await manuscriptObject.arrayBuffer();
      const manuscriptFile = platformSpec.files.find(f => f.key === 'manuscript');
      if (manuscriptFile) {
        files[`${platformPath}${manuscriptFile.filename}`] = new Uint8Array(manuscriptBuffer);
      }
    }

    // Get cover image if available
    if (manuscript.cover_image_key) {
      const coverObject = await env.R2.getBucket('marketing_assets').get(manuscript.cover_image_key);
      if (coverObject) {
        const coverBuffer = await coverObject.arrayBuffer();
        const coverFile = platformSpec.files.find(f => f.key === 'cover' || f.key === 'cover_ebook');
        if (coverFile) {
          files[`${platformPath}${coverFile.filename}`] = new Uint8Array(coverBuffer);
        }
      }
    }

    // Add platform-specific README
    const platformReadme = `
${platformSpec.name} Package
${'='.repeat(50)}

Files included:
${platformSpec.files.map(f => `- ${f.filename}${f.required ? ' (required)' : ' (optional)'}`).join('\n')}

See main README.txt for upload instructions.
`;
    files[`${platformPath}README.txt`] = strToU8(platformReadme.trim());

    // Create ZIP
    const zipped = zipSync(files, { level: 6 });

    return {
      buffer: zipped,
      filename: `${sanitizeFilename(manuscript.title)}-${platform}.zip`,
      platform: platform,
      manuscriptTitle: manuscript.title,
    };
  } catch (error) {
    console.error(`Error creating ${platform} package:`, error);
    throw error;
  }
}

/**
 * Create a complete bundle with all platforms
 */
export async function createAllPlatformsBundle(env, manuscriptId, userId, platforms = ['kdp', 'draft2digital', 'ingramspark', 'apple_books']) {
  try {
    // Get manuscript metadata
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      throw new Error('Manuscript not found');
    }

    const files = {};
    const basePath = sanitizeFilename(manuscript.title);

    // Add main README
    const mainReadme = generateReadme(manuscript.title, platforms);
    files[`${basePath}/README.txt`] = strToU8(mainReadme);

    // Get manuscript file once (to reuse)
    const manuscriptKey = `${userId}/${manuscriptId}/${manuscript.filename}`;
    const manuscriptObject = await env.R2.getBucket('manuscripts_processed').get(manuscriptKey) ||
                            await env.R2.getBucket('manuscripts_raw').get(manuscriptKey);
    let manuscriptBuffer = null;
    if (manuscriptObject) {
      manuscriptBuffer = new Uint8Array(await manuscriptObject.arrayBuffer());
    }

    // Get cover once (to reuse)
    let coverBuffer = null;
    if (manuscript.cover_image_key) {
      const coverObject = await env.R2.getBucket('marketing_assets').get(manuscript.cover_image_key);
      if (coverObject) {
        coverBuffer = new Uint8Array(await coverObject.arrayBuffer());
      }
    }

    // Add files for each platform
    for (const platform of platforms) {
      const platformSpec = PLATFORM_FILES[platform];
      if (!platformSpec) continue;

      const platformPath = `${basePath}/${platform}/`;

      // Add metadata
      const metadata = generateMetadata(manuscript, platform);
      files[`${platformPath}metadata.txt`] = strToU8(metadata);

      // Add manuscript file
      if (manuscriptBuffer) {
        const manuscriptFile = platformSpec.files.find(f => f.key === 'manuscript');
        if (manuscriptFile) {
          files[`${platformPath}${manuscriptFile.filename}`] = manuscriptBuffer;
        }
      }

      // Add cover
      if (coverBuffer) {
        const coverFile = platformSpec.files.find(f => f.key === 'cover' || f.key === 'cover_ebook');
        if (coverFile) {
          files[`${platformPath}${coverFile.filename}`] = coverBuffer;
        }
      }

      // Add platform README
      const platformReadme = `
${platformSpec.name} Package
${'='.repeat(50)}

Files included:
${platformSpec.files.map(f => `- ${f.filename}${f.required ? ' (required)' : ' (optional)'}`).join('\n')}

See main README.txt for upload instructions.
`;
      files[`${platformPath}README.txt`] = strToU8(platformReadme.trim());
    }

    // Create ZIP
    const zipped = zipSync(files, { level: 6 });

    return {
      buffer: zipped,
      filename: `${sanitizeFilename(manuscript.title)}-all-platforms.zip`,
      platforms: platforms,
      manuscriptTitle: manuscript.title,
    };
  } catch (error) {
    console.error('Error creating all-platforms bundle:', error);
    throw error;
  }
}

/**
 * Sanitize filename for safe file system use
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-z0-9-_\s]/gi, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .substring(0, 50); // Limit length
}

/**
 * Get available platforms for a manuscript
 */
export function getAvailablePlatforms() {
  return Object.keys(PLATFORM_FILES);
}

/**
 * Get platform information
 */
export function getPlatformInfo(platform) {
  return PLATFORM_FILES[platform] || null;
}

export default {
  createPlatformPackage,
  createAllPlatformsBundle,
  getAvailablePlatforms,
  getPlatformInfo,
};
