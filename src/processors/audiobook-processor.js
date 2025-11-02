// Audiobook Processor
// Handles audiobook script formatting, timing estimates, and pronunciation guides

/**
 * Reading speed constants (words per minute)
 */
export const READING_SPEEDS = {
  slow: 130,      // Slow, dramatic narration
  moderate: 160,  // Standard audiobook pace
  fast: 180,      // Faster paced narration
  default: 160,
};

/**
 * Format manuscript text for audiobook narration
 * Adds pronunciation guides, removes visual formatting, etc.
 */
export function formatForNarration(text, options = {}) {
  const {
    removeDashes = true,
    expandContractions = false,
    addPronunciationGuides = true,
  } = options;

  let formatted = text;

  // Remove em-dashes that don't work well in audio
  if (removeDashes) {
    formatted = formatted.replace(/—/g, ', ');
    formatted = formatted.replace(/–/g, ' to ');
  }

  // Expand contractions for clarity (optional)
  if (expandContractions) {
    const contractions = {
      "won't": "will not",
      "can't": "cannot",
      "shouldn't": "should not",
      "couldn't": "could not",
      "wouldn't": "would not",
      "I'm": "I am",
      "you're": "you are",
      "we're": "we are",
      "they're": "they are",
      "it's": "it is",
      "that's": "that is",
    };

    Object.entries(contractions).forEach(([contraction, expanded]) => {
      const regex = new RegExp(`\\b${contraction}\\b`, 'gi');
      formatted = formatted.replace(regex, expanded);
    });
  }

  // Convert common symbols to words
  formatted = formatted.replace(/&/g, 'and');
  formatted = formatted.replace(/#(\d+)/g, 'number $1');
  formatted = formatted.replace(/\$/g, 'dollar ');
  formatted = formatted.replace(/%/g, ' percent');

  // Mark chapter breaks clearly
  formatted = formatted.replace(/^(Chapter \d+)/gim, '\n\n[CHAPTER BREAK]\n$1\n');

  return formatted.trim();
}

/**
 * Calculate narration time for text
 * @param {string} text - Text to analyze
 * @param {number} wpm - Words per minute (default: 160)
 * @returns {Object} Timing information
 */
export function calculateNarrationTime(text, wpm = READING_SPEEDS.default) {
  // Count words
  const words = text.trim().split(/\s+/).length;

  // Calculate time in minutes
  const minutes = words / wpm;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  return {
    wordCount: words,
    estimatedMinutes: Math.round(minutes),
    estimatedHours: hours,
    estimatedRemainingMinutes: remainingMinutes,
    formattedTime: `${hours}h ${remainingMinutes}m`,
    wpm: wpm,
  };
}

/**
 * Extract chapters from manuscript text
 * @param {string} text - Full manuscript text
 * @returns {Array} Array of chapter objects
 */
export function extractChapters(text) {
  const chapters = [];

  // Split by chapter markers
  const chapterRegex = /(?:^|\n)(?:Chapter|CHAPTER)\s+(\d+|[IVXLCDM]+)(?:\s*[-:.]?\s*([^\n]*))?/gim;
  const matches = [...text.matchAll(chapterRegex)];

  if (matches.length === 0) {
    // No chapters found, treat entire text as one chapter
    return [{
      number: 1,
      title: 'Full Manuscript',
      content: text,
      wordCount: text.trim().split(/\s+/).length,
      timing: calculateNarrationTime(text),
    }];
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const nextMatch = matches[i + 1];

    const chapterNumber = match[1];
    const chapterTitle = match[2] ? match[2].trim() : '';

    const startIndex = match.index + match[0].length;
    const endIndex = nextMatch ? nextMatch.index : text.length;
    const content = text.substring(startIndex, endIndex).trim();

    chapters.push({
      number: i + 1,
      rawNumber: chapterNumber,
      title: chapterTitle,
      content: content,
      wordCount: content.split(/\s+/).length,
      timing: calculateNarrationTime(content),
    });
  }

  return chapters;
}

/**
 * Identify proper nouns and unique words for pronunciation guide
 * @param {string} text - Text to analyze
 * @returns {Array} List of words needing pronunciation guidance
 */
export function extractPronunciationWords(text) {
  const words = new Set();

  // Find capitalized words that aren't sentence-initial
  // This captures character names, place names, etc.
  const capitalizedRegex = /(?<=[.!?]\s+|\n)([A-Z][a-z]+)|(?<=\s)([A-Z][a-z]+)(?=\s)/g;
  const matches = text.matchAll(capitalizedRegex);

  for (const match of matches) {
    const word = match[0];

    // Skip common words and short words
    if (word.length < 3) continue;
    if (isCommonWord(word)) continue;

    words.add(word);
  }

  // Find unusual or complex words (multiple syllables, unusual patterns)
  const complexWords = findComplexWords(text);
  complexWords.forEach(word => words.add(word));

  // Convert to array and sort
  return Array.from(words).sort();
}

/**
 * Check if word is a common English word
 */
function isCommonWord(word) {
  const common = [
    'The', 'And', 'But', 'For', 'Not', 'With', 'From', 'Have', 'This', 'That',
    'They', 'Will', 'Would', 'There', 'Their', 'What', 'About', 'Which', 'When',
    'Make', 'Like', 'Time', 'Just', 'Know', 'Take', 'People', 'Into', 'Year',
    'Your', 'Good', 'Some', 'Could', 'Them', 'See', 'Other', 'Than', 'Then',
    'Now', 'Look', 'Only', 'Come', 'Its', 'Over', 'Think', 'Also', 'Back',
    'After', 'Use', 'Two', 'How', 'Our', 'Work', 'First', 'Well', 'Way', 'Even',
    'New', 'Want', 'Because', 'Any', 'These', 'Give', 'Day', 'Most', 'Us',
  ];

  return common.includes(word);
}

/**
 * Find complex or unusual words
 */
function findComplexWords(text) {
  const words = new Set();

  // Words with unusual letter combinations
  const patterns = [
    /\b\w*[aeiou]{3,}\w*\b/gi,  // Triple vowels
    /\b\w*[bcdfghjklmnpqrstvwxyz]{4,}\w*\b/gi,  // 4+ consonants
    /\b\w{10,}\b/gi,  // Very long words
  ];

  patterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const word = match[0];
      if (word.length >= 5) {  // Only words 5+ chars
        words.add(word);
      }
    }
  });

  return Array.from(words);
}

/**
 * Generate pronunciation guide
 * @param {Array} words - List of words needing pronunciation
 * @returns {Array} Pronunciation guide entries
 */
export function generatePronunciationGuide(words) {
  return words.map(word => ({
    word: word,
    pronunciation: '', // Would integrate with pronunciation API in production
    notes: getPronunciationNotes(word),
  }));
}

/**
 * Get pronunciation notes for a word
 */
function getPronunciationNotes(word) {
  // Check for common patterns
  if (word.endsWith('ough')) {
    return 'Multiple pronunciations possible (tough, through, cough, etc.)';
  }
  if (word.includes('ei') || word.includes('ie')) {
    return 'Check "i before e" rule application';
  }
  if (word.match(/[aeiou]{3,}/)) {
    return 'Multiple vowel sounds - verify pronunciation';
  }

  return 'Verify pronunciation with author if character/place name';
}

/**
 * Select best sample passages for auditions
 * @param {string} text - Full manuscript
 * @param {number} targetMinutes - Target length in minutes (default: 5)
 * @returns {Array} Sample passage options
 */
export function selectSamplePassages(text, targetMinutes = 5) {
  const targetWords = targetMinutes * READING_SPEEDS.default;
  const samples = [];

  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/);

  // Strategy 1: Find dialogue-heavy sections (good for voice acting demo)
  const dialogueSections = findDialogueSections(paragraphs, targetWords);
  if (dialogueSections.length > 0) {
    samples.push({
      type: 'dialogue',
      title: 'Dialogue Sample',
      content: dialogueSections[0],
      timing: calculateNarrationTime(dialogueSections[0]),
      reason: 'Dialogue-heavy passage to showcase character voices',
    });
  }

  // Strategy 2: Find action/compelling opening
  const openingSample = paragraphs.slice(0, 20).join('\n\n');
  const openingWords = openingSample.split(/\s+/).slice(0, targetWords).join(' ');
  samples.push({
    type: 'opening',
    title: 'Opening Sample',
    content: openingWords,
    timing: calculateNarrationTime(openingWords),
    reason: 'Book opening - sets tone and introduces narrative style',
  });

  // Strategy 3: Find dramatic/emotional section
  const dramaticSection = findDramaticSection(paragraphs, targetWords);
  if (dramaticSection) {
    samples.push({
      type: 'dramatic',
      title: 'Dramatic Sample',
      content: dramaticSection,
      timing: calculateNarrationTime(dramaticSection),
      reason: 'Emotionally charged passage to demonstrate range',
    });
  }

  return samples;
}

/**
 * Find dialogue-heavy sections
 */
function findDialogueSections(paragraphs, targetWords) {
  const sections = [];

  for (let i = 0; i < paragraphs.length - 5; i++) {
    const section = paragraphs.slice(i, i + 10).join('\n\n');
    const dialogueRatio = (section.match(/["']/g) || []).length / section.length;

    if (dialogueRatio > 0.05) {  // More than 5% quote marks = dialogue-heavy
      const words = section.split(/\s+/).slice(0, targetWords).join(' ');
      sections.push(words);
    }
  }

  return sections;
}

/**
 * Find dramatic/emotional section
 */
function findDramaticSection(paragraphs, targetWords) {
  const emotionalWords = [
    'screamed', 'shouted', 'whispered', 'cried', 'gasped', 'sobbed',
    'terror', 'fear', 'rage', 'fury', 'despair', 'hope', 'joy',
    'death', 'blood', 'kill', 'love', 'hate',
  ];

  let bestSection = null;
  let highestScore = 0;

  for (let i = 0; i < paragraphs.length - 5; i++) {
    const section = paragraphs.slice(i, i + 10).join('\n\n');
    let score = 0;

    emotionalWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      score += (section.match(regex) || []).length;
    });

    if (score > highestScore) {
      highestScore = score;
      const words = section.split(/\s+/).slice(0, targetWords).join(' ');
      bestSection = words;
    }
  }

  return bestSection;
}

/**
 * Generate narrator brief
 * @param {Object} manuscript - Manuscript metadata
 * @param {Object} analysis - Analysis results (if available)
 * @returns {Object} Narrator brief
 */
export function generateNarratorBrief(manuscript, analysis = null) {
  const brief = {
    title: manuscript.title,
    author: manuscript.author_name || 'Unknown',
    genre: manuscript.genre || 'General Fiction',
    targetAudience: manuscript.target_audience || 'Adult',
    wordCount: manuscript.word_count || 0,
    estimatedLength: calculateNarrationTime(manuscript.word_count ? ' '.repeat(manuscript.word_count) : ''),

    // Narration guidance
    tone: getToneGuidance(manuscript.genre),
    pacing: getPacingGuidance(manuscript.genre),
    characterCount: 'To be determined from manuscript',
    specialConsiderations: [],
  };

  // Add analysis-based guidance if available
  if (analysis) {
    if (analysis.characters) {
      brief.characterCount = analysis.characters.length;
      brief.mainCharacters = analysis.characters.slice(0, 5).map(c => ({
        name: c.name,
        description: c.description,
        voiceNotes: 'Distinct voice needed',
      }));
    }

    if (analysis.themes) {
      brief.themes = analysis.themes;
    }
  }

  return brief;
}

/**
 * Get tone guidance based on genre
 */
function getToneGuidance(genre) {
  const tones = {
    'mystery': 'Suspenseful, measured, keeping secrets',
    'thriller': 'Intense, fast-paced, building tension',
    'romance': 'Warm, emotional, intimate',
    'fantasy': 'Epic, wonder-filled, immersive',
    'science-fiction': 'Clinical yet engaging, futuristic tone',
    'horror': 'Dark, atmospheric, unsettling',
    'literary': 'Thoughtful, nuanced, character-focused',
    'young-adult': 'Energetic, relatable, contemporary',
  };

  return tones[genre?.toLowerCase()] || 'Engaging, clear, professional narration';
}

/**
 * Get pacing guidance based on genre
 */
function getPacingGuidance(genre) {
  const pacing = {
    'mystery': 'Moderate pace, pause for clues and revelations',
    'thriller': 'Fast pace during action, slower for character moments',
    'romance': 'Moderate pace, linger on emotional beats',
    'fantasy': 'Moderate pace, world-building needs clarity',
    'science-fiction': 'Moderate pace, technical terms need emphasis',
    'horror': 'Variable pace, slow build to fast scares',
    'literary': 'Slower, contemplative pace',
    'young-adult': 'Energetic pace matching protagonist energy',
  };

  return pacing[genre?.toLowerCase()] || 'Moderate pace, adjust for content';
}

export default {
  formatForNarration,
  calculateNarrationTime,
  extractChapters,
  extractPronunciationWords,
  generatePronunciationGuide,
  selectSamplePassages,
  generateNarratorBrief,
  READING_SPEEDS,
};
