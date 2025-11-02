# Manuscript Publishing Platform

An AI-powered platform for indie authors to edit, publish, and market their manuscripts. Built on Cloudflare's edge infrastructure for global performance and zero cold starts.

## 🎯 Vision

Replace the traditional publishing gatekeepers with AI-driven tools that help authors:
- **Edit** with AI agents (developmental, line, copy editing)
- **Publish** directly to Amazon KDP and other platforms
- **Market** with automated ad optimization and comp title analysis
- **Earn** with a revenue-share model (15-20% of author earnings)

## ✨ Current Features

### Upload & Storage
- ✅ Manuscript uploads (PDF, DOCX, TXT, EPUB)
- ✅ Marketing asset uploads (covers, photos)
- ✅ R2 object storage with metadata
- ✅ Author-specific file organization

### AI Editing Agents
- ✅ **Developmental Agent** - Analyzes plot, character development, pacing, structure
  - Scores manuscripts across 5 dimensions
  - Compares against successful comp titles
  - Provides actionable recommendations
  - Identifies marketability potential
- ✅ **Line Editing Agent** - Sentence-level prose improvement
  - Identifies weak words, passive voice, redundancies
  - Analyzes sentence structure and rhythm
  - Provides specific before/after rewrites
  - Processes in sections for detailed feedback
  - Tracks patterns across entire manuscript
- ✅ **Copy Editing Agent** - Grammar, punctuation, and technical correctness
  - Checks grammar, spelling, punctuation
  - Verifies consistency (names, numbers, formatting)
  - Supports Chicago, AP, and custom style guides
  - Flags errors with corrections and explanations
  - Provides publication-readiness assessment
- 🚧 Proofreading Agent (Phase 3)

## 🏗️ Architecture

**Stack:**
- **Cloudflare Workers** - Serverless compute at the edge
- **R2** - Object storage for manuscripts and assets
- **Vectorize** - Vector embeddings for comp title matching (planned)
- **D1** - SQLite database for metadata (planned)
- **Claude API** - AI-powered manuscript analysis

**Buckets:**
- `manuscripts-raw` - Original uploaded manuscripts
- `manuscripts-processed` - AI-analyzed manuscripts with feedback
- `marketing-assets` - Cover images, author photos, promotional materials

## 📋 API Endpoints

### File Management
```bash
# Upload manuscript
POST /upload/manuscript
  FormData: file, authorId, manuscriptId

# Upload marketing asset  
POST /upload/marketing
  FormData: file, authorId, assetType

# List files
GET /list/{authorId}?bucket=raw

# Get file
GET /get/{key}?bucket=raw

# Delete file
DELETE /delete/{key}?bucket=raw
```

### AI Analysis
```bash
# Trigger developmental analysis
POST /analyze/developmental
  JSON: { manuscriptKey, genre }

# Get analysis results
GET /analysis/{manuscriptKey}
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- Cloudflare account
- Anthropic API key

### Local Development

1. **Clone and install:**
```bash
cd manuscript-platform
npm install
```

2. **Create `.dev.vars` file:**
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

3. **Start dev server:**
```bash
wrangler dev
```

4. **Test the API:**
```bash
curl http://localhost:8787/
```

### Deploy to Production

1. **Set secrets in Cloudflare Dashboard:**
```
Workers & Pages > manuscript-upload-api > Settings > Variables
Add: ANTHROPIC_API_KEY = your-key
```

2. **Deploy:**
```bash
wrangler deploy
```

3. **Verify:**
```bash
curl https://api.scarter4workmanuscripthub.com/
```

## 📖 Documentation

- **[AGENT-SETUP.md](./AGENT-SETUP.md)** - Detailed agent setup and usage guide
- **[developmental-agent.js](./developmental-agent.js)** - Agent implementation code
- **[worker.js](./worker.js)** - Main API routes and handlers

## 🎯 Roadmap

### Phase 1: MVP (Current)
- [x] Upload system with R2 storage
- [x] Developmental editing agent
- [x] Basic manuscript structure analysis
- [x] Genre-specific feedback
- [ ] Anthropic API key setup documentation

### Phase 2: Core Agents
- [ ] Line editing agent (prose improvement)
- [ ] Copy editing agent (grammar, consistency)
- [ ] Proofreading agent (final polish)
- [ ] PDF/DOCX text extraction
- [ ] Vectorize integration for comp titles

### Phase 3: Publishing Pipeline
- [ ] Amazon KDP API integration
- [ ] Metadata optimization
- [ ] Category & keyword research
- [ ] Cover design suggestions
- [ ] Blurb optimization

### Phase 4: Marketing Engine
- [ ] Amazon AMS ad automation
- [ ] BookBub submission manager
- [ ] Review campaign tools
- [ ] Social media content generation
- [ ] Email funnel builder

### Phase 5: Revenue & Scale
- [ ] Author dashboard
- [ ] Payment processing (15-20% revenue share)
- [ ] Analytics and reporting
- [ ] Multi-author support
- [ ] Success metrics tracking

## 💡 AI Agent Details

### Developmental Agent

**What it analyzes:**
- **Structure** - Three-act structure, pacing, narrative arc
- **Characters** - Development, motivation, dialogue, arcs
- **Plot** - Central conflict, resolution, consistency
- **Voice** - Style, tone, prose quality
- **Genre Fit** - Adherence to genre expectations

**Output:**
- Overall score (1-10)
- Category-specific scores and feedback
- Top 3 priority recommendations
- Comp title matches with similarity scores
- Marketability assessment

**Example workflow:**
```javascript
// 1. Author uploads manuscript
const upload = await fetch('/upload/manuscript', {
  method: 'POST',
  body: formData // file, authorId, manuscriptId
});

// 2. Trigger analysis
const analysis = await fetch('/analyze/developmental', {
  method: 'POST',
  body: JSON.stringify({
    manuscriptKey: 'author-123/ms-456/manuscript.txt',
    genre: 'thriller'
  })
});

// 3. Get results
const result = await analysis.json();
console.log(result.analysis.topPriorities);
// ["Strengthen middle section pacing", "Develop antagonist", ...]
```

## 🔐 Security Considerations

**Current status:** Development mode
**Production requirements:**
- [ ] Add authentication (Cloudflare Access or JWT)
- [ ] Implement rate limiting
- [ ] Add file virus scanning
- [ ] Secure API key rotation
- [ ] Author data encryption
- [ ] GDPR compliance

## 💰 Cost Structure

**Cloudflare (per month):**
- Workers: Free up to 100K requests/day
- R2: $0.015/GB storage
- D1: Free up to 5GB
- Vectorize: Free up to 5M vectors

**Anthropic API (per manuscript):**
- Claude Sonnet 4: ~$2-4 per analysis
- Scales with manuscript length

**Target pricing:**
- $0 upfront cost for authors
- 15-20% of royalties
- Authors only pay when they earn

## 🤝 Contributing

Built by a 24-year Java/Spring consultant exploring AI engineering. Open to collaboration!

**Current focus:**
1. PDF/DOCX text extraction
2. Vectorize integration for comp titles
3. Additional editing agents

## 📝 Last Updated

**2025-10-01**: Added developmental agent, API documentation, and setup guides

---

## Questions or Issues?

Check out [AGENT-SETUP.md](./AGENT-SETUP.md) for detailed implementation guide.

**Next steps:**
1. Set up Anthropic API key
2. Test with a real manuscript
3. Build line editing agent
4. Add async processing with Queues
