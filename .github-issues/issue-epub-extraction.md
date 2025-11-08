# 🔴 HIGH: Implement EPUB Text Extraction

## Priority: HIGH
**Impact**: Users cannot upload EPUB manuscripts (major format)
**Effort**: 3-4 hours
**User Facing**: YES

## Problem

EPUB file upload throws an error instead of extracting text. This blocks a major manuscript format used by many indie authors.

**Current Behavior**:
```
Error: EPUB extraction not yet implemented. Please convert to .docx or .txt format.
```

**User Impact**: Authors with EPUB manuscripts must manually convert to DOCX/TXT, creating friction in onboarding.

## Current Code

```javascript
// src/utils/text-extraction.js:119-130
async function extractFromEPUB(buffer) {
  // TODO: Implement EPUB extraction
  // Options:
  // 1. epub-parser: npm install epub-parser
  // 2. Extract and parse XHTML files from ZIP

  throw new Error('EPUB extraction not yet implemented. Please convert to .docx or .txt format.');
}
```

## Recommended Solution: epub-parser

```bash
npm install epub-parser
```

### Implementation

```javascript
import EPub from 'epub-parser';

async function extractFromEPUB(buffer) {
  try {
    // Parse EPUB from buffer
    const epub = await EPub.parse(buffer);

    // Extract metadata
    const metadata = {
      title: epub.title,
      author: epub.creator,
      language: epub.language,
      publisher: epub.publisher,
      publishDate: epub.date,
      isbn: epub.identifier,
      chapters: []
    };

    // Extract text from all chapters
    let fullText = '';
    for (const chapter of epub.spine) {
      const chapterText = await extractChapterText(chapter);
      fullText += chapterText + '\n\n';

      metadata.chapters.push({
        title: chapter.title || `Chapter ${chapter.index}`,
        wordCount: chapterText.split(/\s+/).length
      });
    }

    // Calculate word count
    const wordCount = fullText.trim().split(/\s+/).length;

    return {
      text: fullText,
      wordCount: wordCount,
      metadata: metadata
    };

  } catch (error) {
    console.error('[TextExtraction] EPUB parsing error:', error);
    throw new Error('Failed to parse EPUB file. Please ensure the file is a valid EPUB.');
  }
}

async function extractChapterText(chapter) {
  // Remove HTML tags, keep text
  const doc = new DOMParser().parseFromString(chapter.content, 'text/html');
  return doc.body.textContent || '';
}
```

## Alternative: Manual ZIP Extraction

If epub-parser has issues:

```javascript
import AdmZip from 'adm-zip';
import { JSDOM } from 'jsdom';

async function extractFromEPUB(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  // Find content.opf for chapter order
  const contentOpf = entries.find(e => e.entryName.endsWith('content.opf'));
  // Parse spine to get chapter order

  // Extract all .xhtml/.html files
  let fullText = '';
  for (const entry of entries) {
    if (entry.entryName.match(/\.(xhtml|html)$/i)) {
      const html = entry.getData().toString('utf8');
      const dom = new JSDOM(html);
      fullText += dom.window.document.body.textContent + '\n\n';
    }
  }

  return {
    text: fullText,
    wordCount: fullText.trim().split(/\s+/).length
  };
}
```

## Testing Checklist

- [ ] Test with EPUB 2.0 files
- [ ] Test with EPUB 3.0 files
- [ ] Test with DRM-free EPUB (Adobe DRM should fail gracefully)
- [ ] Test with large EPUB (>1MB)
- [ ] Test with multi-chapter EPUB (50+ chapters)
- [ ] Test with images in EPUB (should extract text only)
- [ ] Verify word count accuracy
- [ ] Verify chapter detection
- [ ] Test error handling (corrupted EPUB)
- [ ] Test upload endpoint: `POST /upload/manuscript`

## Test Cases

### Sample EPUB Files

1. **Project Gutenberg** (public domain): Download free EPUBs for testing
2. **Standard Ebooks**: https://standardebooks.org/ (clean, well-formatted)
3. **Draft2Digital samples**: If available

### Unit Tests

```javascript
// tests/text-extraction.test.js
import { extractFromEPUB } from '../src/utils/text-extraction.js';
import fs from 'fs';

describe('EPUB Extraction', () => {
  it('should extract text from EPUB 2.0', async () => {
    const buffer = fs.readFileSync('test-fixtures/sample-epub2.epub');
    const result = await extractFromEPUB(buffer);

    expect(result.text).toBeTruthy();
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.metadata.title).toBeDefined();
  });

  it('should handle corrupted EPUB gracefully', async () => {
    const buffer = Buffer.from('not an epub');
    await expect(extractFromEPUB(buffer)).rejects.toThrow();
  });

  it('should extract chapter structure', async () => {
    const buffer = fs.readFileSync('test-fixtures/multi-chapter.epub');
    const result = await extractFromEPUB(buffer);

    expect(result.metadata.chapters.length).toBeGreaterThan(1);
    expect(result.metadata.chapters[0].wordCount).toBeGreaterThan(0);
  });
});
```

## Edge Cases

1. **DRM-protected EPUBs**: Should fail with helpful error message
2. **Fixed-layout EPUBs**: Text extraction may be difficult (image-based)
3. **Large EPUBs (10MB+)**: May need streaming/chunking
4. **Malformed EPUBs**: Should fail gracefully with validation error

## Files to Modify

1. `src/utils/text-extraction.js` (implement extractFromEPUB)
2. `package.json` (add epub-parser or adm-zip + jsdom)
3. `tests/text-extraction.test.js` (add EPUB tests)
4. `test-fixtures/` (add sample EPUB files for testing)

## Acceptance Criteria

- [ ] Users can upload EPUB manuscripts via `/upload/manuscript`
- [ ] Text is correctly extracted from EPUB files
- [ ] Word count is accurate (within 5% of manual count)
- [ ] Chapter structure is preserved in metadata
- [ ] Error handling works for corrupted/DRM EPUBs
- [ ] Unit tests pass with 80%+ coverage
- [ ] Performance: Extract 100k words in <5 seconds

## User-Facing Changes

**Before**:
> "EPUB extraction not yet implemented. Please convert to .docx or .txt format."

**After**:
> ✅ EPUB uploaded successfully! Detected 12 chapters, 85,432 words.

## Documentation Updates

Update `frontend/help/file-formats.html`:
- Add EPUB to supported formats list
- Add EPUB requirements (DRM-free, EPUB 2.0/3.0)
- Add troubleshooting for EPUB upload issues

## Related Issues

- Improves user onboarding
- Reduces format conversion friction
- Part of file upload feature completeness

## References

- Current code: `src/utils/text-extraction.js:119`
- Upload handler: `src/handlers/manuscript-handlers.js`
- epub-parser: https://www.npmjs.com/package/epub-parser