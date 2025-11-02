// Audiobook Generation Handlers
// On-demand generation of audiobook production materials
// Complements audiobook-handlers.js which retrieves pre-generated assets

import { getUserFromRequest } from './auth-utils.js';
import {
  formatForNarration,
  calculateNarrationTime,
  extractChapters,
  extractPronunciationWords,
  generatePronunciationGuide,
  selectSamplePassages,
  generateNarratorBrief,
  READING_SPEEDS,
} from './audiobook-processor.js';
import {
  generateACXMetadata,
  generateFindawayMetadata,
  generateNarratorBriefDocument,
  generatePronunciationDocument,
  generateACXChecklist,
  exportToCSV,
} from './audiobook-metadata.js';

/**
 * Generate narration script from manuscript
 * POST /manuscripts/:id/audiobook/generate-script
 */
export async function generateNarrationScript(request, env, manuscriptId) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get manuscript content from R2
    const manuscriptKey = `${user.id}/${manuscriptId}/${manuscript.filename}`;
    const manuscriptObject = await env.MANUSCRIPTS_PROCESSED.get(manuscriptKey) ||
                             await env.MANUSCRIPTS_RAW.get(manuscriptKey);

    if (!manuscriptObject) {
      return new Response(JSON.stringify({ error: 'Manuscript file not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get text content (simplified - would need proper extraction for DOCX/PDF)
    const content = await manuscriptObject.text();

    // Parse options
    const body = await request.json().catch(() => ({}));
    const options = {
      removeDashes: body.removeDashes !== false,
      expandContractions: body.expandContractions || false,
      addPronunciationGuides: body.addPronunciationGuides !== false,
    };

    // Format for narration
    const formattedScript = formatForNarration(content, options);

    // Extract chapters
    const chapters = extractChapters(formattedScript);

    // Calculate total timing
    const totalTiming = calculateNarrationTime(formattedScript);

    return new Response(
      JSON.stringify({
        success: true,
        manuscriptId: manuscriptId,
        title: manuscript.title,
        script: formattedScript,
        chapters: chapters,
        timing: totalTiming,
        chapterCount: chapters.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating narration script:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate script', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get chapter timing breakdown
 * GET /manuscripts/:id/audiobook/calculate-timing
 */
export async function getChapterTiming(request, env, manuscriptId) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get manuscript content
    const manuscriptKey = `${user.id}/${manuscriptId}/${manuscript.filename}`;
    const manuscriptObject = await env.MANUSCRIPTS_PROCESSED.get(manuscriptKey) ||
                             await env.MANUSCRIPTS_RAW.get(manuscriptKey);

    if (!manuscriptObject) {
      return new Response(JSON.stringify({ error: 'Manuscript file not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const content = await manuscriptObject.text();

    // Extract chapters
    const chapters = extractChapters(content);

    // Calculate timing at different speeds
    const url = new URL(request.url);
    const wpm = parseInt(url.searchParams.get('wpm')) || READING_SPEEDS.default;

    const timingData = chapters.map(chapter => ({
      chapterNumber: chapter.number,
      title: chapter.title,
      wordCount: chapter.wordCount,
      timing: calculateNarrationTime(chapter.content, wpm),
    }));

    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
    const totalTiming = calculateNarrationTime(content, wpm);

    return new Response(
      JSON.stringify({
        manuscriptId: manuscriptId,
        title: manuscript.title,
        chapters: timingData,
        totalWordCount: totalWords,
        totalTiming: totalTiming,
        readingSpeed: wpm,
        availableSpeeds: READING_SPEEDS,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error calculating timing:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to calculate timing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Generate pronunciation guide
 * GET /manuscripts/:id/audiobook/generate-pronunciation
 */
export async function getPronunciationGuide(request, env, manuscriptId) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get manuscript content
    const manuscriptKey = `${user.id}/${manuscriptId}/${manuscript.filename}`;
    const manuscriptObject = await env.MANUSCRIPTS_PROCESSED.get(manuscriptKey) ||
                             await env.MANUSCRIPTS_RAW.get(manuscriptKey);

    if (!manuscriptObject) {
      return new Response(JSON.stringify({ error: 'Manuscript file not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const content = await manuscriptObject.text();

    // Extract words needing pronunciation
    const words = extractPronunciationWords(content);

    // Generate pronunciation guide
    const pronunciationGuide = generatePronunciationGuide(words);

    // Generate document
    const document = generatePronunciationDocument(pronunciationGuide);

    return new Response(
      JSON.stringify({
        manuscriptId: manuscriptId,
        title: manuscript.title,
        wordCount: words.length,
        pronunciations: pronunciationGuide,
        document: document,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating pronunciation guide:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate pronunciation guide' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Generate sample passages for auditions
 * GET /manuscripts/:id/audiobook/generate-samples
 */
export async function generateSamplePassages(request, env, manuscriptId) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get manuscript content
    const manuscriptKey = `${user.id}/${manuscriptId}/${manuscript.filename}`;
    const manuscriptObject = await env.MANUSCRIPTS_PROCESSED.get(manuscriptKey) ||
                             await env.MANUSCRIPTS_RAW.get(manuscriptKey);

    if (!manuscriptObject) {
      return new Response(JSON.stringify({ error: 'Manuscript file not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const content = await manuscriptObject.text();

    // Get target length from query params
    const url = new URL(request.url);
    const targetMinutes = parseInt(url.searchParams.get('minutes')) || 5;

    // Select sample passages
    const samples = selectSamplePassages(content, targetMinutes);

    return new Response(
      JSON.stringify({
        manuscriptId: manuscriptId,
        title: manuscript.title,
        targetMinutes: targetMinutes,
        samples: samples,
        sampleCount: samples.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating samples:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate samples' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Generate narrator brief
 * GET /manuscripts/:id/audiobook/generate-narrator-brief
 */
export async function getNarratorBrief(request, env, manuscriptId) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Try to get analysis if available
    const analysisKey = `${user.id}/${manuscriptId}/analysis.json`;
    let analysis = null;
    try {
      const analysisObject = await env.MANUSCRIPTS_PROCESSED.get(analysisKey);
      if (analysisObject) {
        analysis = JSON.parse(await analysisObject.text());
      }
    } catch (err) {
      console.log('No analysis found, generating brief without it');
    }

    // Generate narrator brief
    const narratorInfo = generateNarratorBrief(manuscript, analysis);

    // Generate full document
    const document = generateNarratorBriefDocument(manuscript, narratorInfo);

    return new Response(
      JSON.stringify({
        manuscriptId: manuscriptId,
        title: manuscript.title,
        brief: narratorInfo,
        document: document,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating narrator brief:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate narrator brief' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Generate ACX metadata
 * POST /manuscripts/:id/audiobook/generate-acx-metadata
 */
export async function getACXMetadata(request, env, manuscriptId) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get audiobook settings from request
    const audioSettings = await request.json().catch(() => ({}));

    // Generate ACX metadata
    const metadata = generateACXMetadata(manuscript, audioSettings);

    return new Response(
      JSON.stringify({
        manuscriptId: manuscriptId,
        title: manuscript.title,
        metadata: metadata,
        platform: 'ACX',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating ACX metadata:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate ACX metadata' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Generate Findaway Voices metadata
 * POST /manuscripts/:id/audiobook/generate-findaway-metadata
 */
export async function getFindawayMetadata(request, env, manuscriptId) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get manuscript
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get audiobook settings from request
    const audioSettings = await request.json().catch(() => ({}));

    // Generate Findaway metadata
    const metadata = generateFindawayMetadata(manuscript, audioSettings);

    return new Response(
      JSON.stringify({
        manuscriptId: manuscriptId,
        title: manuscript.title,
        metadata: metadata,
        platform: 'Findaway Voices',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating Findaway metadata:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate Findaway metadata' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get ACX submission checklist
 * GET /audiobook/acx-checklist
 */
export async function getACXChecklist(request, env) {
  try {
    const checklist = generateACXChecklist();

    return new Response(
      JSON.stringify({
        checklist: checklist,
        totalCategories: checklist.length,
        totalItems: checklist.reduce((sum, cat) => sum + cat.items.length, 0),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting ACX checklist:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get checklist' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Export audiobook metadata to CSV
 * POST /audiobook/export-csv
 */
export async function exportMetadataCSV(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get list of manuscript IDs from request
    const { manuscriptIds } = await request.json();

    if (!manuscriptIds || manuscriptIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No manuscript IDs provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get manuscripts
    const manuscripts = [];
    for (const id of manuscriptIds) {
      const manuscript = await env.DB.prepare(
        'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
      ).bind(id, user.id).first();

      if (manuscript) {
        manuscripts.push(manuscript);
      }
    }

    // Generate ACX metadata for each
    const audiobooks = manuscripts.map(m => generateACXMetadata(m, {}));

    // Export to CSV
    const csv = exportToCSV(audiobooks);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="audiobook-metadata.csv"',
      },
    });
  } catch (error) {
    console.error('Error exporting CSV:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to export CSV' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const audiobookGenerationHandlers = {
  generateNarrationScript,
  getChapterTiming,
  getPronunciationGuide,
  generateSamplePassages,
  getNarratorBrief,
  getACXMetadata,
  getFindawayMetadata,
  getACXChecklist,
  exportMetadataCSV,
};
