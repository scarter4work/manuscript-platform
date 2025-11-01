/**
 * Change Detection System (MAN-50)
 *
 * Detects and categorizes changes between documentation versions
 */

/**
 * Simple diff algorithm using longest common subsequence (LCS)
 * For production, consider using a proper diff library
 *
 * @param {string} oldText - Previous version
 * @param {string} newText - Current version
 * @returns {Array<Object>} - Array of changes
 */
function computeDiff(oldText, newText) {
  // Split into lines for line-based diffing
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const changes = [];
  let i = 0, j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      // Additions at end
      changes.push({
        type: 'added',
        line: j + 1,
        content: newLines[j],
      });
      j++;
    } else if (j >= newLines.length) {
      // Deletions at end
      changes.push({
        type: 'removed',
        line: i + 1,
        content: oldLines[i],
      });
      i++;
    } else if (oldLines[i] === newLines[j]) {
      // No change
      i++;
      j++;
    } else {
      // Look ahead to see if this is a modification or add/remove
      const oldNext = oldLines.slice(i + 1, i + 5);
      const newNext = newLines.slice(j + 1, j + 5);

      if (newNext.includes(oldLines[i])) {
        // Line was added
        changes.push({
          type: 'added',
          line: j + 1,
          content: newLines[j],
        });
        j++;
      } else if (oldNext.includes(newLines[j])) {
        // Line was removed
        changes.push({
          type: 'removed',
          line: i + 1,
          content: oldLines[i],
        });
        i++;
      } else {
        // Line was modified
        changes.push({
          type: 'modified',
          line: i + 1,
          oldContent: oldLines[i],
          newContent: newLines[j],
        });
        i++;
        j++;
      }
    }
  }

  return changes;
}

/**
 * Chunk large documents for more efficient comparison
 *
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Characters per chunk
 * @returns {Array<string>} - Array of chunks
 */
export function chunkDocument(text, chunkSize = 5000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Detect changes between two documentation versions
 *
 * @param {string} oldDoc - Previous version content
 * @param {string} newDoc - Current version content
 * @returns {Array<Object>} - Array of detected changes with context
 */
export function detectChanges(oldDoc, newDoc) {
  if (!oldDoc || oldDoc === newDoc) {
    return [];
  }

  // Chunk documents for efficient comparison
  const oldChunks = chunkDocument(oldDoc);
  const newChunks = chunkDocument(newDoc);

  const changes = [];

  // Compare chunks
  const maxChunks = Math.max(oldChunks.length, newChunks.length);

  for (let i = 0; i < maxChunks; i++) {
    const oldChunk = oldChunks[i] || '';
    const newChunk = newChunks[i] || '';

    if (oldChunk !== newChunk) {
      // Compute detailed diff for this chunk
      const chunkDiff = computeDiff(oldChunk, newChunk);

      if (chunkDiff.length > 0) {
        changes.push({
          chunkIndex: i,
          chunkStart: i * 5000,
          chunkEnd: (i + 1) * 5000,
          oldContent: oldChunk,
          newContent: newChunk,
          diff: chunkDiff,
          changeCount: chunkDiff.length,
        });
      }
    }
  }

  return changes;
}

/**
 * Categorize a change based on content patterns
 *
 * @param {Object} change - Change object
 * @returns {string} - Category (file_format, account_setup, pricing, workflow, error_handling, general)
 */
export function categorizeChange(change) {
  const content = (change.newContent || change.oldContent || '').toLowerCase();

  // File format patterns
  if (
    content.includes('file format') ||
    content.includes('docx') ||
    content.includes('epub') ||
    content.includes('pdf') ||
    content.includes('file size') ||
    content.includes('dimensions') ||
    content.includes('resolution') ||
    content.includes('dpi')
  ) {
    return 'file_format';
  }

  // Account setup patterns
  if (
    content.includes('account') ||
    content.includes('sign up') ||
    content.includes('register') ||
    content.includes('tax') ||
    content.includes('w-9') ||
    content.includes('w-8ben') ||
    content.includes('payment method') ||
    content.includes('bank account')
  ) {
    return 'account_setup';
  }

  // Pricing patterns
  if (
    content.includes('price') ||
    content.includes('pricing') ||
    content.includes('royalty') ||
    content.includes('revenue') ||
    content.includes('70%') ||
    content.includes('35%') ||
    content.includes('discount') ||
    content.includes('cost')
  ) {
    return 'pricing';
  }

  // Workflow patterns
  if (
    content.includes('step') ||
    content.includes('workflow') ||
    content.includes('process') ||
    content.includes('submit') ||
    content.includes('publish') ||
    content.includes('upload') ||
    content.includes('requirement')
  ) {
    return 'workflow';
  }

  // Error handling patterns
  if (
    content.includes('error') ||
    content.includes('problem') ||
    content.includes('issue') ||
    content.includes('troubleshoot') ||
    content.includes('failed') ||
    content.includes('rejected') ||
    content.includes('invalid')
  ) {
    return 'error_handling';
  }

  return 'general';
}

/**
 * Generate a summary of changes
 *
 * @param {Array<Object>} changes - Array of detected changes
 * @returns {Object} - Summary statistics
 */
export function summarizeChanges(changes) {
  if (changes.length === 0) {
    return {
      totalChanges: 0,
      categoryCounts: {},
      summary: 'No changes detected',
    };
  }

  const categoryCounts = {};
  const affectedSections = new Set();

  for (const change of changes) {
    const category = categorizeChange(change);
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    affectedSections.add(change.chunkIndex);
  }

  // Generate human-readable summary
  const categoryList = Object.entries(categoryCounts)
    .map(([cat, count]) => `${count} ${cat.replace('_', ' ')} change${count > 1 ? 's' : ''}`)
    .join(', ');

  return {
    totalChanges: changes.length,
    totalChunksAffected: affectedSections.size,
    categoryCounts,
    summary: `${changes.length} change${changes.length > 1 ? 's' : ''} detected across ${affectedSections.size} section${affectedSections.size > 1 ? 's' : ''}: ${categoryList}`,
  };
}

/**
 * Extract meaningful excerpts from changes for analysis
 *
 * @param {Array<Object>} changes - Array of detected changes
 * @param {number} maxExcerpts - Maximum number of excerpts to return
 * @returns {Array<Object>} - Array of {oldText, newText, category}
 */
export function extractChangeExcerpts(changes, maxExcerpts = 10) {
  const excerpts = [];

  for (const change of changes.slice(0, maxExcerpts)) {
    // Get a meaningful excerpt around the change
    const oldPreview = change.oldContent.slice(0, 500);
    const newPreview = change.newContent.slice(0, 500);

    excerpts.push({
      chunkIndex: change.chunkIndex,
      category: categorizeChange(change),
      oldText: oldPreview,
      newText: newPreview,
      changeCount: change.changeCount,
    });
  }

  return excerpts;
}

/**
 * Determine if changes are significant enough to warrant analysis
 *
 * @param {Array<Object>} changes - Array of detected changes
 * @returns {boolean} - True if changes are significant
 */
export function areChangesSignificant(changes) {
  if (changes.length === 0) {
    return false;
  }

  // Analyze change categories
  const summary = summarizeChanges(changes);

  // Critical categories always significant
  if (
    summary.categoryCounts.file_format ||
    summary.categoryCounts.pricing ||
    summary.categoryCounts.workflow
  ) {
    return true;
  }

  // Large number of changes likely significant
  if (changes.length > 5) {
    return true;
  }

  // Multiple categories affected
  if (Object.keys(summary.categoryCounts).length > 2) {
    return true;
  }

  return false;
}

export default {
  detectChanges,
  categorizeChange,
  summarizeChanges,
  extractChangeExcerpts,
  areChangesSignificant,
  chunkDocument,
};
