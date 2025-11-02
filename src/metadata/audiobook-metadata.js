// Audiobook Metadata Generator
// Generate metadata for ACX, Audible, and other audiobook platforms

/**
 * BISAC categories relevant to audiobooks
 */
export const AUDIOBOOK_CATEGORIES = {
  fiction: [
    'FIC000000 - FICTION / General',
    'FIC002000 - FICTION / Action & Adventure',
    'FIC027000 - FICTION / Romance / General',
    'FIC022000 - FICTION / Mystery & Detective / General',
    'FIC030000 - FICTION / Thriller / General',
    'FIC009000 - FICTION / Fantasy / General',
    'FIC028000 - FICTION / Science Fiction / General',
    'FIC015000 - FICTION / Horror',
  ],
  nonfiction: [
    'BIO026000 - BIOGRAPHY & AUTOBIOGRAPHY / Personal Memoirs',
    'SEL000000 - SELF-HELP / General',
    'BUS000000 - BUSINESS & ECONOMICS / General',
    'HIS000000 - HISTORY / General',
    'SCI000000 - SCIENCE / General',
  ],
};

/**
 * Content advisory ratings for audiobooks
 */
export const CONTENT_RATINGS = {
  G: 'General Audiences - No objectionable content',
  PG: 'Parental Guidance - Mild themes/language',
  PG13: 'Parental Guidance 13+ - Moderate themes/language',
  R: 'Restricted - Strong themes/language/content',
  X: 'Adults Only - Explicit content',
};

/**
 * Generate ACX metadata export
 * @param {Object} manuscript - Manuscript data
 * @param {Object} audioSettings - Audiobook-specific settings
 * @returns {Object} ACX metadata
 */
export function generateACXMetadata(manuscript, audioSettings = {}) {
  const {
    narratorName = '',
    narratorBio = '',
    estimatedLength = 0,
    sampleURL = '',
    royaltyPlan = 'exclusive', // 'exclusive' or 'non-exclusive'
    price = null, // null = Audible sets price
  } = audioSettings;

  return {
    // Required fields
    title: manuscript.title || 'Untitled Audiobook',
    author: manuscript.author_name || 'Unknown Author',
    narrator: narratorName,
    publisher: manuscript.publisher || manuscript.author_name || 'Independent',

    // Content details
    description: manuscript.description || '',
    language: manuscript.language || 'English',
    publicationDate: manuscript.publication_date || new Date().toISOString().split('T')[0],

    // Audio details
    estimatedRuntime: estimatedLength, // in minutes
    fileFormat: 'MP3', // ACX requirement
    bitRate: '192 kbps', // ACX requirement (128-192 kbps)
    sampleRate: '44.1 kHz', // ACX requirement

    // Categories
    primaryCategory: getBISACCategory(manuscript.genre),
    secondaryCategory: getSecondaryBISAC(manuscript.genre),

    // Rights and pricing
    copyrightHolder: manuscript.author_name || 'Unknown',
    copyrightYear: new Date().getFullYear(),
    isbn: manuscript.isbn || null,
    asin: null, // Assigned by Audible

    royaltyPlan: royaltyPlan, // 'exclusive' (40% royalty) or 'non-exclusive' (25% royalty)
    retailPrice: price, // null = Audible sets price based on length

    // Sample
    sampleURL: sampleURL,

    // Content advisory
    contentAdvisory: getContentAdvisory(manuscript),
    explicitContent: manuscript.explicit_content || false,

    // Additional metadata
    series: manuscript.series_name || null,
    volume: manuscript.series_number || null,
    subtitle: manuscript.subtitle || null,

    // Narrator details
    narratorBio: narratorBio,

    // Keywords (max 7 for ACX)
    keywords: (manuscript.keywords || '').split(',').slice(0, 7).map(k => k.trim()),
  };
}

/**
 * Generate Findaway Voices metadata
 * @param {Object} manuscript - Manuscript data
 * @param {Object} audioSettings - Audiobook-specific settings
 * @returns {Object} Findaway metadata
 */
export function generateFindawayMetadata(manuscript, audioSettings = {}) {
  const {
    narratorName = '',
    estimatedLength = 0,
    isExplicit = false,
  } = audioSettings;

  return {
    title: manuscript.title || 'Untitled Audiobook',
    author: manuscript.author_name || 'Unknown Author',
    narrator: narratorName,
    publisher: manuscript.publisher || manuscript.author_name || 'Independent',

    description: manuscript.description || '',
    language: manuscript.language || 'English',
    publicationDate: manuscript.publication_date || new Date().toISOString().split('T')[0],

    // Audio specs
    runtime: estimatedLength,
    format: 'MP3',

    // Distribution
    distributionChannels: [
      'Audiobooks.com',
      'Libro.fm',
      'Chirp',
      'Walmart',
      'Kobo',
      'Google Play',
      'Apple Books',
      'Nook Audiobooks',
      'Scribd',
      'Hoopla',
    ],

    // Categories
    genre: manuscript.genre || 'Fiction',
    subgenre: manuscript.subgenre || null,

    // Rights
    copyright: `© ${new Date().getFullYear()} ${manuscript.author_name || 'Author'}`,
    isbn: manuscript.isbn || null,

    // Content
    explicit: isExplicit,
    ageRecommendation: getAgeRecommendation(manuscript.target_audience),

    // Series
    seriesName: manuscript.series_name || null,
    seriesNumber: manuscript.series_number || null,
  };
}

/**
 * Generate narrator brief document
 * @param {Object} manuscript - Manuscript data
 * @param {Object} narratorInfo - Narrator brief from audiobook-processor
 * @returns {string} Formatted narrator brief
 */
export function generateNarratorBriefDocument(manuscript, narratorInfo) {
  const brief = `
AUDIOBOOK NARRATOR BRIEF
${'='.repeat(60)}

PROJECT INFORMATION
-------------------
Title: ${manuscript.title || 'Untitled'}
Author: ${manuscript.author_name || 'Unknown'}
Genre: ${manuscript.genre || 'General Fiction'}
Target Audience: ${manuscript.target_audience || 'Adult'}
Word Count: ${manuscript.word_count || 'Unknown'}
Estimated Runtime: ${narratorInfo.estimatedLength?.formattedTime || 'TBD'}

BOOK SYNOPSIS
-------------
${manuscript.description || 'No synopsis provided.'}

NARRATION STYLE & TONE
----------------------
Tone: ${narratorInfo.tone || 'Professional, engaging'}
Pacing: ${narratorInfo.pacing || 'Moderate pace'}
POV: ${manuscript.pov || 'Third Person'}

CHARACTER VOICES
----------------
${narratorInfo.mainCharacters ?
  narratorInfo.mainCharacters.map(char =>
    `${char.name}: ${char.description}\n  Voice Notes: ${char.voiceNotes}`
  ).join('\n\n') :
  'Character list to be provided'
}

PRONUNCIATION GUIDE
-------------------
(See separate pronunciation guide document)

SPECIAL CONSIDERATIONS
----------------------
${narratorInfo.specialConsiderations?.length > 0 ?
  narratorInfo.specialConsiderations.map((note, i) => `${i + 1}. ${note}`).join('\n') :
  'None specified'
}

THEMES
------
${narratorInfo.themes ? narratorInfo.themes.join(', ') : 'To be determined'}

SAMPLE PASSAGES
---------------
(See separate sample script documents)

TECHNICAL REQUIREMENTS
----------------------
- Format: MP3
- Bit Rate: 192 kbps (ACX standard)
- Sample Rate: 44.1 kHz
- Mastering: RMS -23dB to -18dB, Peak -3dB
- Noise Floor: -60dB or lower
- Room Tone: Include 1-2 seconds at start/end

DELIVERY SPECIFICATIONS
-----------------------
- Opening Credits: "Title by Author, narrated by [Narrator Name]"
- Closing Credits: "This has been Title by Author"
- Chapter Markers: Include for navigation
- Retail Sample: First 5 minutes (provided separately)

PRODUCTION NOTES
----------------
${manuscript.production_notes || 'None'}

CONTACT INFORMATION
-------------------
Author: ${manuscript.author_name || 'Unknown'}
Email: ${manuscript.author_email || 'Not provided'}
Production Deadline: ${manuscript.deadline || 'To be determined'}

---
Generated: ${new Date().toISOString()}
Platform: ManuscriptHub Audiobook Production
`;

  return brief.trim();
}

/**
 * Generate ACX submission checklist
 * @returns {Array} Checklist items
 */
export function generateACXChecklist() {
  return [
    {
      category: 'Audio Quality',
      items: [
        'Audio files are MP3 format, 192 kbps CBR',
        'Sample rate is 44.1 kHz',
        'RMS level between -23dB and -18dB',
        'Peak levels at -3dB or lower',
        'Noise floor -60dB or lower',
        'No clipping or distortion',
        'Consistent volume throughout',
        '1-2 seconds of room tone at start/end',
      ],
    },
    {
      category: 'Content Requirements',
      items: [
        'Opening credits: "Title by Author, narrated by Narrator"',
        'Closing credits: "This has been Title by Author"',
        'Chapter markers included',
        'Retail sample is first 5 minutes',
        'No music (unless rights cleared)',
        'No sound effects (unless rights cleared)',
        'Complete manuscript narrated',
      ],
    },
    {
      category: 'Metadata',
      items: [
        'Title matches book exactly',
        'Author name correct and consistent',
        'Narrator name provided',
        'Description/blurb (under 4,000 characters)',
        'Up to 7 keywords',
        'BISAC categories selected',
        'Publication date set',
        'Copyright information complete',
        'Language specified',
      ],
    },
    {
      category: 'Rights & Legal',
      items: [
        'You own audiobook rights to the work',
        'Narrator has signed rights agreement',
        'No copyrighted music/content (unless licensed)',
        'ISBN obtained (optional but recommended)',
        'Royalty plan selected (exclusive vs non-exclusive)',
      ],
    },
    {
      category: 'Cover Art',
      items: [
        'Minimum 2400x2400 pixels',
        'Square aspect ratio',
        'JPG or PNG format',
        'Title and author name readable',
        'No price or promotional text',
        'No URLs or contact info',
      ],
    },
  ];
}

/**
 * Get BISAC category based on genre
 */
function getBISACCategory(genre) {
  const mapping = {
    'fiction': 'FIC000000',
    'mystery': 'FIC022000',
    'thriller': 'FIC030000',
    'romance': 'FIC027000',
    'fantasy': 'FIC009000',
    'science-fiction': 'FIC028000',
    'horror': 'FIC015000',
    'action': 'FIC002000',
    'literary': 'FIC000000',
    'young-adult': 'FIC000000',
  };

  return mapping[genre?.toLowerCase()] || 'FIC000000';
}

/**
 * Get secondary BISAC category
 */
function getSecondaryBISAC(genre) {
  // Return general fiction as fallback
  return 'FIC000000';
}

/**
 * Get content advisory rating
 */
function getContentAdvisory(manuscript) {
  if (manuscript.explicit_content) return CONTENT_RATINGS.R;
  if (manuscript.target_audience === 'Young Adult') return CONTENT_RATINGS.PG13;
  if (manuscript.target_audience === 'Middle Grade') return CONTENT_RATINGS.PG;
  if (manuscript.target_audience === 'Children') return CONTENT_RATINGS.G;
  return CONTENT_RATINGS.PG13; // Default
}

/**
 * Get age recommendation
 */
function getAgeRecommendation(targetAudience) {
  const mapping = {
    'Children': '5-8',
    'Middle Grade': '8-12',
    'Young Adult': '13-18',
    'New Adult': '18-25',
    'Adult': '18+',
  };

  return mapping[targetAudience] || '18+';
}

/**
 * Generate pronunciation guide document
 * @param {Array} pronunciations - Pronunciation guide from audiobook-processor
 * @returns {string} Formatted pronunciation guide
 */
export function generatePronunciationDocument(pronunciations) {
  if (pronunciations.length === 0) {
    return 'No special pronunciations required.';
  }

  const doc = `
PRONUNCIATION GUIDE
${'='.repeat(60)}

This guide lists proper nouns, character names, place names, and other
words that may need special attention from the narrator.

WORDS REQUIRING PRONUNCIATION GUIDANCE
---------------------------------------

${pronunciations.map((entry, index) =>
  `${index + 1}. ${entry.word}
   Pronunciation: ${entry.pronunciation || '[To be filled by author]'}
   Notes: ${entry.notes || 'N/A'}
`).join('\n')}

INSTRUCTIONS FOR AUTHOR
-----------------------
Please fill in pronunciation guides for character names, place names,
and any specialized terms. Use phonetic spelling where helpful.

Examples:
- Hermione: her-MY-oh-nee
- Leicester: LES-ter
- Yosemite: yoh-SEM-it-ee

---
Generated: ${new Date().toISOString()}
`;

  return doc.trim();
}

/**
 * Export metadata to CSV for batch upload
 * @param {Array} audiobooks - Array of audiobook metadata objects
 * @returns {string} CSV content
 */
export function exportToCSV(audiobooks) {
  const headers = [
    'Title', 'Author', 'Narrator', 'Description', 'Genre', 'Runtime',
    'ISBN', 'Publication Date', 'Copyright', 'Keywords', 'Price'
  ];

  const rows = audiobooks.map(ab => [
    ab.title,
    ab.author,
    ab.narrator || '',
    ab.description || '',
    ab.primaryCategory || '',
    ab.estimatedRuntime || '',
    ab.isbn || '',
    ab.publicationDate || '',
    ab.copyright || '',
    ab.keywords?.join('; ') || '',
    ab.retailPrice || 'Auto',
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csv;
}

export default {
  generateACXMetadata,
  generateFindawayMetadata,
  generateNarratorBriefDocument,
  generatePronunciationDocument,
  generateACXChecklist,
  exportToCSV,
  AUDIOBOOK_CATEGORIES,
  CONTENT_RATINGS,
};
