# AI Analysis Agents & Manuscript Processing (MAN-7)

## Overview

The Manuscript Platform uses **14 specialized AI agents** powered primarily by Claude Sonnet 4 (with DALL-E 3 for cover generation) to provide comprehensive manuscript analysis, asset generation, and publishing support for indie authors.

All agents follow a consistent architecture with shared utilities for:
- Cost tracking (per-operation monitoring)
- Error handling and retries
- Claude API integration via Cloudflare AI Gateway
- R2 storage for inputs and outputs
- JSON-based structured responses

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MANUSCRIPT UPLOAD                            │
│  User uploads .txt/.docx/.pdf → R2 (MANUSCRIPTS_RAW)           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   ANALYSIS QUEUE (Phase 1)                      │
│  Job enqueued with: manuscriptKey, genre, styleGuide           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│            QUEUE CONSUMER (Sequential Processing)               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Step 1: Developmental Agent (0-33% complete)            │ │
│  │  - Plot structure & pacing analysis                      │ │
│  │  - Character development                                 │ │
│  │  - Theme identification                                  │ │
│  │  - Comp title matching                                   │ │
│  │  - Duration: 3-5 minutes                                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                              ↓                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Step 2: Line Editing Agent (33-66% complete)           │ │
│  │  - Prose quality analysis                                │ │
│  │  - Sentence structure review                             │ │
│  │  - Show vs tell identification                           │ │
│  │  - Word choice suggestions                               │ │
│  │  - Duration: 4-6 minutes                                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                              ↓                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Step 3: Copy Editing Agent (66-100% complete)          │ │
│  │  - Grammar & punctuation                                 │ │
│  │  - Style guide compliance (Chicago/AP)                   │ │
│  │  - Consistency checks                                    │ │
│  │  - Technical correctness                                 │ │
│  │  - Duration: 3-5 minutes                                 │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 ASSET GENERATION QUEUE (Phase 2)                │
│  Auto-triggered after analysis completion                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│            ASSET GENERATION AGENTS (On-Demand)                  │
│                                                                 │
│  Marketing Assets (7 agents):                                  │
│  - Book Description, Keywords, Categories                      │
│  - Author Bio, Back Matter, Cover Design Brief                 │
│  - Series Description                                           │
│                                                                 │
│  Market Analysis (1 agent):                                    │
│  - Pricing strategy, Target audience                           │
│  - Competitive positioning, BISAC codes                        │
│                                                                 │
│  Social Media (1 agent):                                       │
│  - Post templates, Hashtag strategy                            │
│  - Launch campaign content                                     │
│                                                                 │
│  Formatting (1 agent):                                         │
│  - EPUB generation (Kindle)                                    │
│  - PDF generation (paperback)                                  │
│                                                                 │
│  Cover Generation (1 agent):                                   │
│  - DALL-E 3 image generation                                   │
│  - Multiple variations (1-5)                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 RESULTS STORAGE                                 │
│  R2 (MANUSCRIPTS_PROCESSED) + D1 (metadata)                    │
│  - Analysis results: JSON files                                │
│  - Generated assets: Various formats                           │
│  - Cost tracking: D1 cost_tracking table                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Analysis Agents (Phase 1)

### 1. Developmental Agent

**Purpose**: Deep analysis of manuscript structure, plot, character development, and story elements.

**File**: `developmental-agent.js`

**Analysis Focus**:
- **Story Structure & Pacing**: Three-act structure, pacing appropriateness, sagging middle sections, climax effectiveness
- **Character Development**: Character arcs, motivations, growth, dialogue authenticity
- **Plot & Conflict**: Central conflict clarity, plot hole detection, subplot integration
- **Voice & Style**: Narrative voice consistency, writing style genre fit
- **Genre Expectations**: Genre convention adherence, trope effectiveness

**Input**:
```javascript
{
  manuscriptKey: "userId/manuscriptId/filename.txt",
  genre: "thriller",
  userId: "user123",
  manuscriptId: "manu456"
}
```

**Output Structure**:
```json
{
  "overallScore": 7,
  "structure": {
    "score": 8,
    "strengths": ["Clear three-act structure", "Strong opening hook"],
    "weaknesses": ["Sagging middle around chapter 12"],
    "recommendations": ["Add subplot tension in chapters 10-15"]
  },
  "characters": {
    "score": 7,
    "strengths": ["Compelling protagonist with clear motivation"],
    "weaknesses": ["Supporting characters lack depth"],
    "recommendations": ["Develop antagonist backstory"]
  },
  "plot": { "score": 8, "strengths": [], "weaknesses": [], "recommendations": [] },
  "voice": { "score": 7, "strengths": [], "weaknesses": [], "recommendations": [] },
  "genreFit": { "score": 9, "strengths": [], "weaknesses": [], "recommendations": [] },
  "topPriorities": [
    "Strengthen character motivations",
    "Tighten middle pacing",
    "Resolve subplot inconsistency"
  ],
  "marketability": {
    "score": 8,
    "summary": "Strong commercial potential in thriller market"
  },
  "compTitles": [
    {
      "title": "Gone Girl",
      "author": "Gillian Flynn",
      "similarity": 0.85,
      "salesRank": 245,
      "relevantFeatures": ["Unreliable narrator", "Psychological suspense"]
    }
  ]
}
```

**Key Features**:
- Intelligent text truncation (40% beginning, 20% middle, 40% end) for large manuscripts
- Comp title matching via embeddings (placeholder for Vectorize integration)
- Actionable priority recommendations
- Cost tracking per operation

**Performance**:
- Duration: 3-5 minutes for 80K word novel
- Cost: ~$1.50-$2.50 per manuscript (Claude API)
- Token usage: ~100K tokens (input + output)

---

### 2. Line Editing Agent

**Purpose**: Sentence-level prose analysis with specific, actionable rewrite suggestions.

**File**: `line-editing-agent.js`

**Analysis Focus**:
- **Prose Quality**: Weak words, passive voice, redundancies, adverb overuse
- **Sentence Structure**: Variety, run-ons, fragments, monotonous rhythm
- **Show vs Tell**: Opportunities for sensory details, weak dialogue attribution
- **Word Choice**: Generic verbs, clichés, inappropriate vocabulary
- **Style Issues**: POV slips, tense shifts, tone inconsistencies

**Processing Strategy**:
- Chunks manuscript into 800-word sections for detailed analysis
- Analyzes each section sequentially with 1-second rate limiting
- Aggregates patterns across all sections

**Output Structure**:
```json
{
  "overallAssessment": {
    "overallProseScore": 7.5,
    "summary": "Solid foundation with room for improvement",
    "keyStrengths": ["Strong dialogue", "Vivid sensory details"],
    "keyWeaknesses": ["passive_voice: 45 instances", "adverb: 89 instances"],
    "urgentIssues": ["Excessive passive voice (45 instances)"]
  },
  "patterns": {
    "totalSections": 12,
    "averageScore": 7.5,
    "totalIssues": 156,
    "passiveVoiceTotal": 45,
    "adverbTotal": 89,
    "issueTypeCounts": {
      "passive_voice": 45,
      "weak_verb": 32,
      "adverb": 89,
      "show_not_tell": 15
    }
  },
  "topSuggestions": [
    {
      "type": "passive_voice",
      "severity": "high",
      "location": "Chapter 3, paragraph 4",
      "original": "The door was opened by Sarah",
      "suggestion": "Sarah opened the door",
      "explanation": "Active voice creates stronger prose"
    }
  ]
}
```

**Key Features**:
- Section-by-section detailed analysis with specific rewrites
- Pattern aggregation across entire manuscript
- Prioritized suggestions by severity and type
- Readability metrics (sentence length, passive voice count, adverb count)

**Performance**:
- Duration: 4-6 minutes for 80K word novel
- Cost: ~$2.00-$3.00 per manuscript
- Token usage: ~120K tokens (higher due to multiple section analyses)

---

### 3. Copy Editing Agent

**Purpose**: Grammar, punctuation, consistency, and style guide compliance.

**File**: `copy-editing-agent.js`

**Analysis Focus**:
- **Grammar & Punctuation**: Errors, style guide violations
- **Consistency**: Character name variations, timeline issues, world-building contradictions
- **Technical Correctness**: Spelling, capitalization, number formatting
- **Style Guide Compliance**: Chicago Manual of Style (default), AP, or custom

**Processing Strategy**:
- Extracts entities (proper nouns, character names) for consistency tracking
- Chunks into 1000-word sections for detailed review
- Cross-references entities across entire manuscript

**Output Structure**:
```json
{
  "overallAssessment": {
    "score": 8,
    "totalErrors": 89,
    "criticalErrors": 5,
    "styleGuideCompliance": "chicago",
    "summary": "Well-edited with minor issues"
  },
  "errorsByType": {
    "grammar": 23,
    "punctuation": 34,
    "spelling": 12,
    "consistency": 15,
    "style_guide": 5
  },
  "consistencyIssues": [
    {
      "type": "character_name",
      "issue": "Character 'Sarah' also appears as 'Sara'",
      "occurrences": ["Chapter 3:12", "Chapter 7:45"],
      "recommendation": "Standardize to 'Sarah' throughout"
    }
  ],
  "topIssues": [
    {
      "type": "grammar",
      "severity": "high",
      "location": "Chapter 5, line 234",
      "original": "Their going to the store",
      "correction": "They're going to the store",
      "rule": "Contraction: they are = they're"
    }
  ]
}
```

**Key Features**:
- Entity extraction for consistency checking
- Style guide-specific rules (Chicago, AP)
- Cross-manuscript consistency validation
- Detailed error categorization

**Performance**:
- Duration: 3-5 minutes for 80K word novel
- Cost: ~$1.50-$2.50 per manuscript
- Token usage: ~100K tokens

---

## Asset Generation Agents (Phase 2)

### 4. Book Description Agent

**Purpose**: Generate compelling Amazon KDP book descriptions that convert browsers into buyers.

**File**: `book-description-agent.js`

**Input**: Developmental analysis results + manuscript excerpt

**Output**:
```json
{
  "short": "150-word description for quick browsers",
  "medium": "250-word main description",
  "long": "350-word detailed description",
  "hooks": [
    "Opening hook option 1",
    "Opening hook option 2",
    "Opening hook option 3"
  ],
  "keyWords": ["psychological", "suspense", "thriller"],
  "targetAudience": "Fans of Gillian Flynn and Paula Hawkins",
  "comparisonLine": "For fans of Gone Girl and The Girl on the Train..."
}
```

**Key Features**:
- Multiple length variants for different use cases
- Alternative hook options for A/B testing
- Genre-specific language and conventions
- Comp title integration
- Amazon constraints awareness (4000 char max)

**Performance**: ~30 seconds, ~$0.30 per generation

---

### 5. Keyword Agent

**Purpose**: Generate SEO-optimized keywords for Amazon discoverability.

**File**: `keyword-agent.js`

**Output**:
```json
{
  "keywords": [
    {
      "phrase": "psychological thriller suspense",
      "searchVolume": "high",
      "competition": "medium",
      "relevance": "10/10",
      "reasoning": "High-intent genre descriptor"
    }
  ],
  "alternativeKeywords": ["backup keyword phrases"],
  "longtailStrategy": {
    "phrases": ["very specific niche phrases"],
    "reasoning": "Target niche audiences with lower competition"
  },
  "avoidKeywords": ["misleading or oversaturated keywords"]
}
```

**Key Features**:
- 7 primary keyword phrases (Amazon limit)
- Alternative keywords for testing
- Long-tail strategy for niche targeting
- Competition and search volume estimates

**Performance**: ~20 seconds, ~$0.20 per generation

---

### 6. Category Agent

**Purpose**: Recommend optimal Amazon BISAC categories for maximum visibility.

**File**: `category-agent.js`

**Output**:
```json
{
  "primary": [
    {
      "bisac": "FIC031000",
      "name": "FICTION / Thrillers / General",
      "competitiveness": "high",
      "reasoning": "Core genre category with strong sales potential"
    }
  ],
  "secondary": [
    {
      "bisac": "FIC030000",
      "name": "FICTION / Thrillers / Suspense",
      "competitiveness": "medium",
      "reasoning": "Less competitive, better ranking opportunity"
    }
  ],
  "bestseller_potential": {
    "categories": ["FICTION / Thrillers / Psychological"],
    "reasoning": "Specific niche with achievable bestseller rankings"
  }
}
```

**Key Features**:
- Up to 10 category recommendations (Amazon limit)
- BISAC code + human-readable name
- Competitiveness assessment
- Bestseller ranking potential analysis

**Performance**: ~25 seconds, ~$0.25 per generation

---

### 7. Author Bio Agent

**Purpose**: Generate professional author biographies for book pages and author profiles.

**File**: `author-bio-agent.js`

**Output**:
```json
{
  "short": "50-word bio for book back cover",
  "medium": "150-word bio for Amazon author page",
  "long": "300-word detailed bio for website",
  "thirdPerson": "Third-person version for press releases",
  "firstPerson": "First-person version for personal connection"
}
```

**Performance**: ~20 seconds, ~$0.20 per generation

---

### 8. Back Matter Agent

**Purpose**: Generate back matter content (author notes, social media links, mailing list CTA).

**File**: `back-matter-agent.js`

**Output**:
```json
{
  "formatted": {
    "html": "<div>HTML formatted back matter</div>",
    "plainText": "Plain text version for paperback",
    "epub": "EPUB-optimized version with links"
  },
  "sections": {
    "authorNote": "Thank you for reading...",
    "callToAction": "Join my mailing list for...",
    "socialLinks": ["Twitter: @author", "Instagram: @author"],
    "nextBook": "Preview of next book in series"
  }
}
```

**Performance**: ~20 seconds, ~$0.20 per generation

---

### 9. Cover Design Agent

**Purpose**: Generate AI art prompts and design briefs for book covers.

**File**: `cover-design-agent.js`

**Output**:
```json
{
  "visualConcept": {
    "mainElements": ["Silhouette of woman", "Dark cityscape background"],
    "composition": "Vertical portrait, rule of thirds",
    "focalPoint": "Woman's face partially obscured"
  },
  "colorPalette": {
    "primary": "#1a1a2e",
    "secondary": "#16213e",
    "accent": "#e94560",
    "overall": "Dark blue and crimson, noir aesthetic"
  },
  "typography": {
    "titleFont": "Bold sans-serif, all caps",
    "authorFont": "Elegant serif, mixed case",
    "placement": "Title at top, author at bottom"
  },
  "moodAtmosphere": "Dark, suspenseful, mysterious",
  "designElements": ["Shadow overlay", "Urban setting"],
  "aiArtPrompts": {
    "dalle": "Professional book cover design. Dark suspenseful thriller...",
    "midjourney": "/imagine professional thriller book cover...",
    "stableDiffusion": "thriller book cover, dark moody lighting..."
  }
}
```

**Key Features**:
- Genre-specific design guidance
- Color palette with hex codes
- Typography recommendations
- AI art prompts for DALL-E, Midjourney, Stable Diffusion

**Performance**: ~30 seconds, ~$0.30 per generation

---

### 10. Series Description Agent

**Purpose**: Generate series descriptions for multi-book collections.

**File**: `series-description-agent.js`

**Output**:
```json
{
  "seriesOverview": "150-word series description",
  "bookOrder": ["Book 1: Title", "Book 2: Title", "Book 3: Title"],
  "seriesHook": "Compelling reason to read the entire series",
  "readingOrder": "Must be read in order / Can be read standalone"
}
```

**Performance**: ~25 seconds, ~$0.25 per generation

---

## Market & Marketing Agents (Phase 3)

### 11. Market Analysis Agent

**Purpose**: Comprehensive market analysis for Amazon KDP positioning.

**File**: `market-analysis-agent.js`

**Analysis Components**:
1. **Genre & Positioning**: Primary/sub-genres, comparable titles, unique selling points
2. **Pricing Strategy**: Ebook/paperback pricing, launch strategy, KDP Select recommendations
3. **Category Recommendations**: BISAC codes, competitiveness, bestseller potential
4. **Keyword Strategy**: 7 keyword phrases, alternatives, long-tail strategy
5. **Target Audience**: Demographics, psychographics, reading habits, marketing channels
6. **Competitive Positioning**: Market gaps, advantages, launch strategy

**Output Structure**:
```json
{
  "genreAnalysis": {
    "primaryGenre": "Thriller",
    "subGenres": ["Psychological", "Suspense", "Domestic"],
    "marketPosition": "Commercial thriller with literary elements",
    "comparableTitles": ["Gone Girl", "The Silent Patient"],
    "uniqueSellingPoints": ["Dual timeline narrative", "Unreliable narrator"],
    "tropes": ["Unreliable narrator", "Twist ending"],
    "tone": "Dark, suspenseful",
    "pacing": "Fast-paced",
    "targetAgeRange": "Adult 25-45",
    "marketSize": "large",
    "competition": "high"
  },
  "pricingStrategy": {
    "ebook": {
      "recommended": 2.99,
      "range": { "min": 0.99, "max": 4.99 },
      "reasoning": "Sweet spot for thriller readers",
      "competitivePosition": "Mid-range pricing"
    },
    "paperback": {
      "recommended": 12.99,
      "range": { "min": 9.99, "max": 15.99 },
      "reasoning": "Based on 300-page estimate"
    },
    "launchStrategy": {
      "initialPrice": 0.99,
      "duration": "First 7 days",
      "normalPrice": 2.99,
      "reasoning": "Build early reviews and momentum"
    },
    "kdpSelectRecommendation": {
      "recommend": true,
      "reasoning": "Maximize visibility for debut author"
    }
  },
  "audienceProfile": {
    "primaryAudience": {
      "ageRange": "25-45",
      "gender": "Primarily female (70%)",
      "demographics": "College-educated, middle-income",
      "psychographics": "Enjoy twisty plots and psychological depth",
      "readingHabits": "2-3 books per month, discover via BookTok"
    },
    "marketingChannels": [
      {
        "channel": "BookTok (TikTok)",
        "effectiveness": "high",
        "reasoning": "Strong thriller community, viral potential"
      }
    ],
    "seasonality": {
      "bestLaunchMonths": ["October", "January"],
      "reasoning": "High thriller readership in fall/winter"
    }
  },
  "competitivePositioning": {
    "marketGap": "Psychological thrillers with strong female leads",
    "positioningStatement": "For fans of Gillian Flynn who want darker twists",
    "launchStrategy": {
      "approach": "aggressive",
      "timeline": "3-month pre-launch build",
      "tactics": ["ARC strategy", "BookTok campaign", "Price promo"]
    }
  }
}
```

**Key Features**:
- 6-part comprehensive analysis
- Data-driven pricing recommendations
- Target audience profiling
- Competitive strategy planning
- Seasonal timing recommendations

**Performance**: ~90 seconds, ~$0.80-$1.00 per analysis

---

### 12. Social Media Agent

**Purpose**: Generate social media content for book marketing and author platform building.

**File**: `social-media-agent.js`

**Output**:
```json
{
  "launchCampaign": {
    "countdownPosts": ["30 days", "14 days", "7 days", "Launch day"],
    "teaserPosts": ["Quote graphics", "Scene snippets", "Character reveals"],
    "engagementPosts": ["Polls", "Q&A prompts", "Behind-the-scenes"]
  },
  "platforms": {
    "instagram": {
      "postTemplates": ["Quote card", "Cover reveal", "Writing process"],
      "captionExamples": ["Engaging captions with CTAs"],
      "hashtagStrategy": ["#ThrillerReads", "#BookTok", "#IndieAuthor"]
    },
    "tiktok": {
      "videoIdeas": ["Book reveal", "Writing journey", "Character inspiration"],
      "trendIntegration": ["Current trending sounds for book content"]
    },
    "facebook": {
      "groupStrategy": "Join 5-10 thriller reader groups",
      "postSchedule": "3x per week leading up to launch"
    }
  },
  "contentCalendar": {
    "prelaunch": "Weekly post schedule for 3 months pre-launch",
    "launchWeek": "Daily posts with variety",
    "postlaunch": "3x weekly ongoing engagement"
  }
}
```

**Performance**: ~40 seconds, ~$0.40 per generation

---

## Formatting & Cover Generation Agents (Phase 4)

### 13. Formatting Agent

**Purpose**: Convert manuscripts to Amazon KDP-compliant EPUB and PDF formats.

**File**: `formatting-agent.js`

**Supported Formats**:
- **EPUB 3.0**: Kindle ebooks
- **PDF**: Paperback print-on-demand

**EPUB Features**:
- Valid EPUB 3.0 structure with proper metadata
- Front matter (title page, copyright page)
- Automatic table of contents (toc.ncx)
- CSS styling for typography and layout
- Back matter integration
- KDP validation compliance

**PDF Features**:
- Multiple trim sizes: 5x8, 5.5x8.5, 6x9, 7x10, 8x10, 8.5x11
- Automatic margin calculation based on page count
- Optional bleed (0.125" on each side)
- Professional typography (Times Roman)
- Page numbering options
- Front/back matter integration

**Output Structure**:
```json
{
  "epub": {
    "buffer": "<Uint8Array>",
    "size": 1234567,
    "format": "epub",
    "validation": {
      "sizeOk": true,
      "version": "EPUB 3.0",
      "kdpCompliant": true
    }
  },
  "pdf": {
    "buffer": "<Uint8Array>",
    "size": 2345678,
    "format": "pdf",
    "trimSize": "6x9",
    "includeBleed": false,
    "pageCount": 312,
    "validation": {
      "sizeOk": true,
      "pageCount": 312,
      "pageCountValid": true,
      "kdpCompliant": true
    }
  }
}
```

**Key Features**:
- Zero external dependencies (uses fflate, pdf-lib)
- Chapter auto-detection via regex patterns
- KDP compliance validation (650MB max, 24-828 pages)
- Intelligent margin calculation for page count
- Front matter generation from metadata

**Performance**: ~10-20 seconds, no AI cost (local generation)

---

### 14. Cover Generation Agent

**Purpose**: Generate actual cover images using DALL-E 3 based on cover design briefs.

**File**: `cover-generation-agent.js`

**Input**: Cover design brief from CoverDesignAgent + book metadata

**Generation Process**:
1. Build DALL-E 3 prompt from design brief
2. Request image generation (1024x1792 portrait)
3. Download image from temporary URL
4. Store in R2 (MANUSCRIPTS_PROCESSED)
5. Track cost ($0.080 per HD image)

**Output Structure**:
```json
{
  "coverImages": [
    {
      "variationNumber": 1,
      "r2Key": "userId/manuId/processed-cover-variation-1.png",
      "originalUrl": "https://oaidalleapiprodscus.blob.core.windows.net/...",
      "prompt": "Professional book cover design. Dark suspenseful thriller...",
      "revisedPrompt": "DALL-E's revised interpretation of the prompt",
      "size": "1024x1792",
      "quality": "hd",
      "duration": 15234
    }
  ],
  "generated": 3,
  "requested": 3
}
```

**Key Features**:
- Multiple variations (1-5) per generation
- Amazon KDP sizing (1024x1792 for portrait covers)
- HD quality for print-ready images
- Cost tracking per image ($0.080/image)
- 2-second rate limiting between generations
- Automatic R2 storage

**Performance**: ~15-20 seconds per variation, $0.080 per image

**Note**: Unlike other agents using Claude, this agent uses OpenAI's DALL-E 3 API.

---

## Agent Architecture & Shared Components

### Shared Utilities

All agents use common utilities from `agent-utils.js` and `cost-utils.js`:

#### 1. Cost Tracking

```javascript
import { callClaudeWithCostTracking } from './agent-utils.js';

// Automatically tracks tokens, cost, and logs to D1
const result = await callClaudeWithCostTracking(
  apiKey,
  prompt,
  temperature,
  'DevelopmentalAgent',
  env,
  userId,
  manuscriptId,
  'analysis',
  'analyze_developmental'
);
```

**Tracked Metrics**:
- Input tokens & cost
- Output tokens & cost
- Total cost in USD
- Model used (claude-sonnet-4-20250514)
- Feature name & operation
- Timestamp

**Storage**: D1 `cost_tracking` table for billing and analytics

#### 2. Text Extraction

```javascript
import { extractText } from './text-extraction.js';

// Supports .txt, .docx, .pdf
const text = await extractText(buffer, contentType);
```

#### 3. Claude API Integration

```javascript
// Via Cloudflare AI Gateway for caching and rate limiting
const gatewayUrl = 'https://gateway.ai.cloudflare.com/v1/{account-id}/manuscript-ai-gateway/anthropic/v1/messages';

const response = await fetch(gatewayUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }]
  })
});
```

#### 4. R2 Storage

```javascript
// Store results in R2
await env.MANUSCRIPTS_PROCESSED.put(
  `${processedKey}-analysis.json`,
  JSON.stringify(results, null, 2),
  {
    customMetadata: {
      analysisType: 'developmental',
      timestamp: new Date().toISOString()
    },
    httpMetadata: {
      contentType: 'application/json'
    }
  }
);
```

---

## Queue Processing Pipeline

### Queue Consumer Architecture

**File**: `queue-consumer.js`

The queue consumer orchestrates the **sequential processing** of the three core analysis agents:

```javascript
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      const { manuscriptKey, genre, styleGuide, reportId } = message.body;

      // Step 1: Developmental Analysis (0-33%)
      const devAgent = new DevelopmentalAgent(env);
      const devAnalysis = await devAgent.analyze(manuscriptKey, genre, userId, manuscriptId);

      // Step 2: Line Editing (33-66%)
      const lineAgent = new LineEditingAgent(env);
      const lineAnalysis = await lineAgent.analyze(manuscriptKey, genre, userId, manuscriptId);

      // Step 3: Copy Editing (66-100%)
      const copyAgent = new CopyEditingAgent(env);
      const copyAnalysis = await copyAgent.analyze(manuscriptKey, styleGuide, userId, manuscriptId);

      // Auto-queue asset generation
      await env.ASSET_QUEUE.send({
        manuscriptKey,
        reportId,
        genre
      });

      message.ack();
    }
  }
};
```

**Progress Tracking**:
- Real-time status updates to R2
- Frontend polls R2 for progress (status.json)
- Database status updates (analyzing → complete/failed)

**Error Handling**:
- Automatic retries (max 3) via Cloudflare Queues
- Failed messages go to dead-letter queue
- Status updates on failure with error details

---

## Cost Tracking System

### Database Schema

```sql
CREATE TABLE cost_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  manuscript_id TEXT,
  cost_center TEXT,          -- 'anthropic_api', 'openai_api'
  feature_name TEXT,         -- 'analysis', 'asset_generation', 'cover_generation'
  operation TEXT,            -- 'analyze_developmental', 'generate_description', etc.
  cost_usd REAL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  model TEXT,
  metadata TEXT,             -- JSON string with additional details
  timestamp INTEGER
);
```

### Cost Tracking Flow

```
1. Agent calls Claude/DALL-E
   ↓
2. Receives token counts / fixed cost
   ↓
3. Calculates USD cost using model pricing
   ↓
4. Logs to D1 via logCost()
   ↓
5. Dashboard shows per-user/per-manuscript costs
```

### Pricing Reference

**Claude Sonnet 4 (claude-sonnet-4-20250514)**:
- Input: $3.00 per million tokens
- Output: $15.00 per million tokens

**DALL-E 3**:
- HD 1024x1792: $0.080 per image

**Typical Costs per Manuscript**:
- Developmental: ~$1.50-$2.50
- Line Editing: ~$2.00-$3.00
- Copy Editing: ~$1.50-$2.50
- Asset Generation (7 agents): ~$2.00-$3.00
- Cover Generation (3 variations): ~$0.24
- **Total per manuscript**: ~$8-$12

---

## Integration Points

### 1. Manuscript Upload Flow

```
POST /manuscripts
  ↓
Store in R2 (MANUSCRIPTS_RAW)
  ↓
Create manuscript record in D1
  ↓
Enqueue analysis job (ANALYSIS_QUEUE)
  ↓
Return manuscript ID + report ID
```

### 2. Analysis Status Polling

```
GET /manuscripts/:id/analysis-status
  ↓
Check R2 for {reportId}-status.json
  ↓
Return: { status, progress, message, currentStep }
  ↓
Frontend polls every 5 seconds
```

### 3. Asset Generation Flow

```
POST /manuscripts/:id/generate-description
  ↓
Fetch developmental analysis from R2
  ↓
Call BookDescriptionAgent
  ↓
Store result in R2
  ↓
Return generated description
```

### 4. Cost Reporting

```
GET /admin/costs?userId=abc&startDate=...&endDate=...
  ↓
Query D1 cost_tracking table
  ↓
Aggregate by feature, operation, user
  ↓
Return cost breakdown
```

---

## Agent Development Best Practices

### 1. Prompt Engineering

**Structure**:
```
You are [role with expertise].

[Context about the task]

[Input data]

TASK: [Clear, specific task description]

REQUIREMENTS:
1. [Specific requirement]
2. [Specific requirement]
...

CONSTRAINTS:
- [Constraint 1]
- [Constraint 2]

IMPORTANT: Return ONLY valid JSON. No other text before or after.

Return this exact structure:
{
  "field1": "description",
  "field2": { "nested": "structure" }
}
```

**Tips**:
- Be extremely specific about output format (JSON structure)
- Include examples when helpful
- Specify "ONLY valid JSON" to avoid markdown code blocks
- Provide context (genre, manuscript analysis) for better results
- Use structured scores (1-10) for consistency

### 2. Error Handling

```javascript
try {
  const result = await agent.analyze(manuscriptKey, genre);
  message.ack();
} catch (error) {
  console.error('Agent error:', error);

  // Update status
  await updateStatus(env, reportId, {
    status: 'failed',
    error: error.message
  });

  // Retry via queue (automatic)
  message.retry();
}
```

### 3. Rate Limiting

```javascript
// Between sections
for (let i = 0; i < sections.length; i++) {
  const analysis = await analyzeSection(sections[i]);
  sectionAnalyses.push(analysis);

  if (i < sections.length - 1) {
    await sleep(1000); // 1 second between requests
  }
}
```

### 4. Cost Optimization

**Strategies**:
- Cache analysis results in R2 (avoid re-analyzing)
- Use smart truncation for large manuscripts
- Batch similar operations when possible
- Use lower temperatures for structured outputs
- Monitor token usage via cost tracking

---

## Performance Benchmarks

### Analysis Pipeline (80K word novel)

| Agent | Duration | Cost | Tokens | Output Size |
|-------|----------|------|--------|-------------|
| Developmental | 3-5 min | $1.50-$2.50 | ~100K | ~8KB JSON |
| Line Editing | 4-6 min | $2.00-$3.00 | ~120K | ~15KB JSON |
| Copy Editing | 3-5 min | $1.50-$2.50 | ~100K | ~12KB JSON |
| **Total Pipeline** | **10-15 min** | **$5-$8** | **~320K** | **~35KB** |

### Asset Generation (on-demand)

| Agent | Duration | Cost | Output Size |
|-------|----------|------|-------------|
| Book Description | ~30s | $0.30 | ~2KB JSON |
| Keywords | ~20s | $0.20 | ~1KB JSON |
| Categories | ~25s | $0.25 | ~1.5KB JSON |
| Author Bio | ~20s | $0.20 | ~1KB JSON |
| Back Matter | ~20s | $0.20 | ~1KB JSON |
| Cover Design | ~30s | $0.30 | ~3KB JSON |
| Series Desc | ~25s | $0.25 | ~1.5KB JSON |
| Market Analysis | ~90s | $0.80-$1.00 | ~8KB JSON |
| Social Media | ~40s | $0.40 | ~5KB JSON |
| **Total Assets** | **~5 min** | **~$3.00** | **~24KB** |

### Formatting & Cover

| Agent | Duration | Cost | Output Size |
|-------|----------|------|-------------|
| Formatting (EPUB+PDF) | ~15s | $0 (local) | 2-5MB |
| Cover (3 variations) | ~60s | $0.24 | ~3MB |

### Overall Platform Cost

**Per manuscript (full analysis + all assets + cover)**:
- **Analysis**: $5-$8
- **Assets**: $3.00
- **Cover**: $0.24
- **Total**: **$8-$12 per manuscript**

---

## Future Enhancements

### Planned Improvements

1. **Vectorize Integration** (MAN-40)
   - Replace placeholder comp title matching with Vectorize
   - Store embeddings for all analyzed manuscripts
   - Semantic search for similar books

2. **Agent Performance Optimization** (MAN-41)
   - Parallel processing where possible (currently sequential)
   - Smarter chunking strategies
   - Prompt caching for repeated patterns

3. **Additional Agents** (Backlog)
   - **Sensitivity Reader Agent**: Check for problematic content
   - **Series Bible Agent**: Track characters, timelines, world-building across series
   - **Audiobook Script Agent**: Format for ACX narration
   - **Translation Prep Agent**: Prepare for foreign language editions

4. **Enhanced Cost Control** (MAN-42)
   - Per-user budget limits
   - Cost estimation before analysis
   - Automatic cost alerts for admin

5. **Real-time Progress** (MAN-43)
   - WebSocket/SSE for live updates
   - Currently uses polling (5-second intervals)

---

## Troubleshooting

### Common Issues

**Issue**: Agent times out after 30 seconds
**Cause**: Worker CPU limit (10ms per request)
**Solution**: All long-running agents use Cloudflare Queues (no CPU limit)

**Issue**: JSON parse errors from Claude responses
**Cause**: Claude returns markdown code blocks or extra text
**Solution**: Use `extractJsonFromResponse()` utility to clean responses

**Issue**: Cost tracking not appearing in dashboard
**Cause**: `userId` or `manuscriptId` not passed to agent
**Solution**: Ensure queue message includes both IDs

**Issue**: Analysis stuck at "processing"
**Cause**: Queue consumer error not updating status
**Solution**: Check queue DLQ (dead-letter queue) for failed messages

**Issue**: DALL-E rate limits
**Cause**: Too many concurrent cover generation requests
**Solution**: 2-second delay between variations, limit to 5 per request

---

## Testing

### Unit Testing Agents

```javascript
// Test developmental agent
const env = getMiniflareBindings();
const agent = new DevelopmentalAgent(env);

const result = await agent.analyze(
  'test-manuscript-key',
  'thriller',
  'user123',
  'manu456'
);

assert(result.overallScore >= 1 && result.overallScore <= 10);
assert(result.analysis.structure);
assert(result.analysis.characters);
```

### Integration Testing Pipeline

```javascript
// Test full analysis pipeline
const message = {
  body: {
    manuscriptKey: 'test/123/manuscript.txt',
    genre: 'thriller',
    styleGuide: 'chicago',
    reportId: 'test-report-123'
  },
  ack: () => console.log('Acknowledged'),
  retry: () => console.log('Retrying')
};

await queueConsumer.queue({ messages: [message] }, env);

// Check status updates
const status = await env.MANUSCRIPTS_PROCESSED.get('test-report-123-status.json');
assert(status.status === 'complete');
```

---

## References

- [Anthropic Claude API Docs](https://docs.anthropic.com/)
- [Claude Prompt Engineering Guide](https://docs.anthropic.com/en/docs/prompt-engineering)
- [OpenAI DALL-E 3 API](https://platform.openai.com/docs/guides/images)
- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
- [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/)
- [Amazon KDP Guidelines](https://kdp.amazon.com/en_US/help/topic/G200634390)

---

**Last Updated**: 2025-10-28
**Author**: System Documentation (MAN-7)
**Version**: 1.0
**Total Agents Documented**: 14
