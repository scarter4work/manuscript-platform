# Developmental Agent Setup Guide

## Overview
The Developmental Agent analyzes manuscripts for big-picture issues like plot, character development, pacing, and genre fit. It provides actionable recommendations based on successful comp titles.

## What You've Built So Far

### ✅ Completed
- **Upload System**: Manuscripts can be uploaded to R2 (MANUSCRIPTS_RAW bucket)
- **File Management**: List, retrieve, and delete files
- **Agent Framework**: Developmental agent class with full analysis pipeline
- **API Integration**: Routes for triggering and retrieving analyses

### 🚧 Next Steps

## 1. Set Up Anthropic API Key

**In Cloudflare Dashboard:**
```bash
# Navigate to: Workers & Pages > manuscript-upload-api > Settings > Variables

# Add secret (encrypted):
ANTHROPIC_API_KEY = sk-ant-... # your actual API key
```

**For local development:**
Create `.dev.vars` file (don't commit this!):
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

## 2. Add to .gitignore

```bash
echo ".dev.vars" >> .gitignore
```

## 3. Test Locally

```bash
# Install dependencies
npm install

# Start local development server
wrangler dev

# In another terminal, test the API
curl http://localhost:8787/
```

## 4. Test Manuscript Upload & Analysis

```bash
# Upload a manuscript
curl -X POST http://localhost:8787/upload/manuscript \
  -F "file=@path/to/manuscript.txt" \
  -F "authorId=test-author" \
  -F "manuscriptId=test-001"

# Trigger developmental analysis
curl -X POST http://localhost:8787/analyze/developmental \
  -H "Content-Type: application/json" \
  -d '{
    "manuscriptKey": "test-author/test-001/2025-01-01T12:00:00.000Z_manuscript.txt",
    "genre": "thriller"
  }'

# Retrieve analysis results
curl http://localhost:8787/analysis/test-author/test-001/2025-01-01T12:00:00.000Z_manuscript.txt
```

## 5. Deploy to Production

```bash
# Deploy to Cloudflare
wrangler deploy

# Verify deployment
curl https://api.scarter4workmanuscripthub.com/
```

## API Endpoints

### Analysis Workflow

1. **Upload Manuscript**
   ```
   POST /upload/manuscript
   Body: multipart/form-data
     - file: manuscript file (.txt, .pdf, .docx)
     - authorId: unique author identifier
     - manuscriptId: unique manuscript identifier
   
   Returns: { manuscriptKey: "..." }
   ```

2. **Trigger Analysis**
   ```
   POST /analyze/developmental
   Body: {
     "manuscriptKey": "author-id/manuscript-id/timestamp_filename.txt",
     "genre": "thriller" // optional: romance, fantasy, thriller, etc.
   }
   
   Returns: Complete developmental analysis with scores and recommendations
   ```

3. **Get Analysis Results**
   ```
   GET /analysis/{manuscriptKey}
   
   Returns: Stored analysis results
   ```

## Analysis Output Structure

```javascript
{
  "manuscriptKey": "...",
  "structure": {
    "totalWords": 85000,
    "chapterCount": 24,
    "avgChapterLength": 3541,
    "chapters": [...]
  },
  "analysis": {
    "overallScore": 8,
    "structure": {
      "score": 7,
      "strengths": ["Clear three-act structure", "Good pacing"],
      "weaknesses": ["Middle drags slightly"],
      "recommendations": ["Tighten chapters 12-15"]
    },
    "characters": {
      "score": 9,
      "strengths": ["Strong protagonist arc", "Authentic dialogue"],
      "weaknesses": ["Supporting characters underdeveloped"],
      "recommendations": ["Add backstory for antagonist"]
    },
    "plot": { ... },
    "voice": { ... },
    "genreFit": { ... },
    "topPriorities": [
      "Strengthen middle section pacing",
      "Develop supporting characters", 
      "Enhance antagonist motivation"
    ],
    "marketability": {
      "score": 8,
      "summary": "Strong commercial potential with comp titles like..."
    }
  },
  "compTitles": [
    {
      "title": "Similar Bestseller",
      "similarity": 0.85,
      "salesRank": 245,
      "relevantFeatures": ["Fast pacing", "Complex protagonist"]
    }
  ],
  "recommendations": [
    {
      "priority": "HIGH",
      "category": "Structure",
      "issue": "Pacing issues in Act 2",
      "action": "Cut 2000 words from chapters 12-15",
      "impact": "Critical for maintaining reader engagement"
    }
  ]
}
```

## Next Phase: Enhancements

### Phase 2A: Text Extraction
- **PDF Support**: Integrate `pdf-parse` or similar
- **DOCX Support**: Use `mammoth` for Word doc parsing
- Currently only .txt files work fully

### Phase 2B: Vector Database
- **Setup Vectorize**: Store embeddings for comp title matching
- **D1 Database**: Store analysis metadata for querying
- **Success Fingerprints**: Build database of successful manuscripts

### Phase 2C: Async Processing
- **Queues**: Use Cloudflare Queues for long-running analyses
- **Webhooks**: Notify authors when analysis completes
- **Batch Processing**: Analyze multiple manuscripts

### Phase 2D: Additional Agents
- **Line Editing Agent**: Style and prose improvements
- **Copy Editing Agent**: Grammar, consistency
- **Proofreading Agent**: Final pass for typos
- **Query Letter Agent**: Optimize pitch to agents/publishers

## Current Limitations

1. **Text Extraction**: Only .txt files fully supported (PDF/DOCX are placeholders)
2. **Long Manuscripts**: Large files truncated for Claude API
3. **Comp Titles**: Placeholder data (needs Vectorize integration)
4. **Sync Processing**: Analysis blocks until complete (add Queues for async)
5. **No Auth**: Need to add proper authentication before production use

## Cost Estimates

**Per Analysis (assuming 80k word manuscript):**
- Claude API: ~$2-4 per analysis (Sonnet 4)
- R2 Storage: Negligible (<$0.01/GB/month)
- Worker Invocations: Free tier covers most usage

**Scaling:**
- 100 analyses/month: ~$300
- 500 analyses/month: ~$1,500
- Cost per manuscript decreases with shorter works

## Architecture Diagram

```
Author Upload → R2 (raw) → Developmental Agent → Analysis
                                  ↓
                            Claude API (structure, characters, plot)
                                  ↓
                            Vectorize (comp title matching)
                                  ↓
                            R2 (processed) + D1 (metadata)
                                  ↓
                            Return Results to Author
```

## Questions?

Focus areas:
1. Want to test with a real manuscript?
2. Need help setting up the Anthropic API key?
3. Ready to add PDF/DOCX support?
4. Want to build the next agent (Line Editing)?
