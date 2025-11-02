# Manuscript Publishing Platform - Requirements Specification

## Executive Summary

A comprehensive manuscript publishing platform that transforms raw manuscripts into upload-ready packages for multiple publishing platforms (KDP, Draft2Digital, IngramSpark, etc.), with AI-powered editing, intelligent chat assistance, and streamlined workflow management.

**Core Value Proposition:** "We handle everything except clicking 'Publish'"

---

## Problem Statement

Authors face multiple pain points in the self-publishing journey:
1. **Manuscript editing** - Professional editing is expensive, DIY is time-consuming
2. **Format hell** - Each platform has different file requirements, metadata specs, and technical constraints
3. **Learning curve paralysis** - Authors get overwhelmed by platform-specific quirks and abandon projects
4. **Scattered workflow** - Authors juggle multiple tools (Google Docs, Grammarly, formatting software, platform dashboards)

## Solution Overview

A unified platform that takes authors from raw manuscript to upload-ready files for all major publishing platforms, featuring:
- Multi-agent AI editing pipeline
- Automated format generation per platform
- AI-powered chat assistants for platform guidance
- Progress tracking and checklist management

---

## Core Features

### 1. AI Editing Pipeline (Already Built)

Three-agent editing system:
- **Developmental editing agent** - Structure, plot, character development
- **Line editing agent** - Sentence-level improvements, flow, clarity
- **Copy editing agent** - Grammar, spelling, punctuation, consistency

**Tech Stack:**
- Cloudflare Workers for serverless compute
- R2 for manuscript storage
- D1 for metadata/tracking database
- Claude API for AI agents

### 2. Multi-Platform Format Generator

Automatically generates platform-specific files and packages from the edited manuscript.

#### Amazon KDP Package
**Ebook Files:**
- `.doc` or `.docx` format (KDP preferred)
- Alternative: `.epub` for advanced users
- Embedded metadata

**Print Files:**
- Interior PDF with proper margins/bleeds
- Cover PDF with spine width calculator
- Multiple trim size support (6x9, 5x8, etc.)

**Metadata Package:**
- Title and subtitle
- Author name(s)
- Book description (optimized for discoverability)
- 7 keyword phrases
- 2 BISAC categories
- Pricing recommendations
- Age/grade range (if applicable)

#### Draft2Digital Package
**Ebook Files:**
- `.doc` or `.docx` (D2D auto-converts)
- Alternative: Pre-formatted `.epub`

**Cover:**
- 1600x2400 JPEG minimum
- Resolution validation

**Metadata Package:**
- Book description
- BISAC categories (multiple)
- Pricing by territory
- Series information (if applicable)
- Contributor/illustrator credits

#### IngramSpark Package
**Print Files:**
- Interior PDF with bleed/trim specs
- Cover PDF using IngramSpark templates
- Spine width calculator integration
- Multiple format support (paperback, hardcover)

**Metadata Package:**
- Extended description
- BISAC categories
- Returnable status
- Discount percentages for wholesale
- Distribution territories
- Pricing strategy

#### Apple Books (Direct) Package
**Ebook Files:**
- Validated `.epub` (strict Apple requirements)
- iTunes Producer metadata format

**Cover:**
- High-resolution cover meeting Apple specs

#### Additional Platform Support (Future)
- Barnes & Noble Press
- Kobo Writing Life
- Google Play Books
- Lulu
- BookBaby

### 3. Platform-Specific AI Chat Assistants

Context-aware AI assistants that guide users through platform setup and upload processes.

#### KDP Upload Coach
**Capabilities:**
- Tax form guidance (W-9 for US, W-8BEN for international)
- KDP Select vs. wide distribution decision support
- Pricing strategy advice (70% vs. 35% royalty tiers)
- Category selection help (browse and recommend from 10 allowed)
- Keyword optimization (maximize discoverability)
- Timeline expectations ("Why isn't my book live yet?")
- Common error troubleshooting

#### Draft2Digital Upload Coach
**Capabilities:**
- Account setup walkthrough
- ISBN decision (free D2D ISBN vs. your own)
- Platform selection (which retailers to target)
- Timeline guidance (10 business days typical)
- Pricing strategy by territory
- Pre-order setup assistance

#### IngramSpark Upload Coach
**Capabilities:**
- Account creation guidance
- File specification validation
- Returnable vs. non-returnable implications
- Discount structure recommendations
- Distribution channel selection
- Print cost calculations
- Common rejection reasons and solutions

#### General Publishing Guidance
**Cross-platform topics:**
- "Do I need my own ISBN?"
- "Should I publish wide or exclusive?"
- "How do I price my book?"
- "What categories should I choose?"
- "How long until my book is live?"
- "Can I update my book after publishing?"

### 4. Progress Tracking Dashboard

Visual dashboard showing publication status across all platforms.

**Per-Platform Checklist:**
```
□ Account created
□ Tax information submitted
□ Payment method added
□ Book details entered
  □ Title & subtitle
  □ Author name
  □ Description
  □ Categories selected
  □ Keywords entered
□ Files uploaded
  □ Manuscript
  □ Cover image
□ Pricing set
□ Rights & territories confirmed
□ Preview reviewed
□ Published!
```

**Dashboard Features:**
- Overall completion percentage
- Platform-specific status (not started, in progress, uploaded, live)
- Next action recommendations
- Estimated time to completion
- Link to platform-specific chat assistant

### 5. File Download & Package Management

**File Organization:**
```
/manuscript-title/
  /kdp/
    - manuscript.docx
    - cover-ebook.jpg
    - interior-print.pdf
    - cover-print.pdf
    - metadata.txt
  /draft2digital/
    - manuscript.docx
    - cover.jpg
    - metadata.txt
  /ingramspark/
    - interior.pdf
    - cover.pdf
    - metadata.txt
  /README.txt (upload instructions)
```

**Download Options:**
- Individual platform packages (ZIP)
- All platforms bundle (ZIP)
- Individual files on demand

---

## Technical Architecture

### Current Stack (Already Implemented)
- **Cloudflare Workers** - Serverless compute for AI agents and API endpoints
- **Cloudflare R2** - Object storage for manuscripts and generated files
- **Cloudflare D1** - SQLite database for user accounts, book metadata, progress tracking
- **Claude API** - Powers the 3-agent editing system

### New Components Required

#### Document Processing Pipeline
**Libraries/Tools:**
- `docx` library (Node.js) - DOCX manipulation
- `epub-gen` - EPUB generation
- `pdfkit` or `jspdf` - PDF generation
- `sharp` - Image processing and validation
- Cover template system - Per-platform specifications

**Processing Steps:**
1. Parse edited manuscript
2. Apply platform-specific formatting
3. Generate required file formats
4. Validate against platform specs
5. Package with metadata
6. Store in R2 with organized structure

#### AI Chat Assistant System
**Architecture:**
- Claude API integration for conversational AI
- Context management (platform, user progress, common issues)
- Knowledge base per platform (specs, gotchas, FAQs)
- Conversation history tracking
- Suggested next actions

**Context Awareness:**
- Current platform being configured
- User's progress on checklist
- Previous questions/issues encountered
- Common error patterns

#### Metadata Optimization Engine
**Functionality:**
- Keyword research and suggestions
- Category recommendations based on content
- Description optimization for discoverability
- Pricing analysis and recommendations
- Competitive analysis (optional)

---

## User Workflows

### Primary User Journey

1. **Upload Manuscript**
   - User uploads Word doc, Google Docs, or plain text
   - System validates and stores in R2

2. **AI Editing Process**
   - Three-agent editing pipeline processes manuscript
   - User reviews suggested changes
   - User approves final version

3. **Platform Selection**
   - User selects target platforms (KDP, D2D, IngramSpark, etc.)
   - System explains pros/cons of each

4. **Cover Upload/Design**
   - User uploads existing cover OR
   - User uses built-in cover designer (future feature)
   - System validates specs for each platform

5. **Metadata Entry**
   - Guided form for book details
   - AI suggestions for keywords/categories
   - Preview of how listing will appear

6. **File Generation**
   - System generates all platform-specific files
   - User receives downloadable packages
   - README with upload instructions included

7. **Platform Upload (User's Responsibility)**
   - User logs into each platform
   - AI chat assistant guides through process
   - Checklist tracks completion
   - User clicks final "Publish" button

8. **Post-Publication**
   - Dashboard shows "Live" status
   - Links to live book pages
   - Sales tracking (future feature)

---

## Competitive Differentiation

### What We Offer That Nobody Else Does:

1. **Integrated AI Editing** - Most platforms assume you bring a finished manuscript
2. **Multi-Platform Prep** - One click generates all formats (not just one platform)
3. **Intelligent Chat Guidance** - Context-aware AI help (not static FAQs)
4. **Progress Tracking** - Unified dashboard across all platforms
5. **Proven With Real Use Case** - Already validated with real author workflow

### vs. Draft2Digital
- We include editing
- We support KDP (D2D doesn't)
- We provide AI chat assistance
- We track progress across platforms

### vs. BookBaby
- Lower cost (no $1,090+ packages)
- More flexibility (à la carte)
- Better tech experience (modern UI)
- AI-powered vs. human-powered

### vs. Reedsy/Vellum
- Integrated editing (not just formatting)
- Multi-platform support built-in
- AI assistance throughout
- Simpler pricing

---

## Monetization Strategy

### Pricing Models (Choose One or Hybrid)

#### Option 1: Per-Book Pricing
- **Basic**: $49/book - Editing + KDP package
- **Professional**: $99/book - Editing + KDP + D2D + IngramSpark packages
- **Premium**: $199/book - Everything + priority support + cover design

#### Option 2: Subscription
- **Indie Author**: $29/month - 3 books/month, all features
- **Prolific Writer**: $79/month - Unlimited books, priority processing
- **Publishing House**: $299/month - Team accounts, bulk processing

#### Option 3: Freemium
- **Free**: Basic editing, KDP package only, watermarked files
- **Pro**: $15/month - All features, unlimited books, no watermarks

#### Option 4: À La Carte
- AI Editing: $29/book
- Format Package (per platform): $10/platform
- Chat Assistant Access: Included free
- Cover Design: $99 (future feature)

### Revenue Projections
- Target: 100 paying users in Month 1
- Average revenue: $49-99 per book
- Monthly recurring: $2,900-$9,900 (if subscription model)

---

## Target Customers

### Primary Segments

1. **First-Time Authors**
   - Overwhelmed by publishing process
   - Need hand-holding and education
   - Budget-conscious
   - Value: Simplified workflow + guidance

2. **Experienced Indie Authors**
   - Tired of formatting headaches
   - Publishing multiple books/year
   - Going "wide" across platforms
   - Value: Time savings + automation

3. **Genre Fiction Writers**
   - Prolific (4-12 books/year)
   - Publish direct to platforms
   - Series management important
   - Value: Speed + consistency

4. **Non-Fiction Authors**
   - Professional expertise to share
   - Less familiar with publishing
   - Need professional polish
   - Value: Credibility + ease of use

### Customer Acquisition

**Channels:**
- Author communities (Reddit r/selfpublish, Kboards)
- YouTube tutorials for self-publishing
- Author conference sponsors
- Partnerships with author coaches
- Content marketing (blog, case studies)
- Your wife's author network (initial beta users)

---

## Success Metrics

### Key Performance Indicators (KPIs)

**User Acquisition:**
- Monthly signups
- Conversion rate (free trial → paid)
- Customer acquisition cost (CAC)

**Engagement:**
- Books processed per user
- Platform packages downloaded
- Chat assistant usage
- Completion rate (manuscript → published)

**Quality:**
- AI editing acceptance rate
- File validation pass rate
- User satisfaction (NPS score)
- Support ticket volume

**Revenue:**
- Monthly recurring revenue (MRR)
- Average revenue per user (ARPU)
- Lifetime value (LTV)
- LTV:CAC ratio

---

## Technical Implementation Phases

### Phase 1: MVP (Weeks 1-4)
- [ ] File upload and storage
- [ ] Basic AI editing (single agent)
- [ ] KDP package generation only
- [ ] Simple download interface
- [ ] Basic chat assistant (KDP only)

### Phase 2: Multi-Platform (Weeks 5-8)
- [ ] Three-agent editing pipeline
- [ ] Draft2Digital package generation
- [ ] IngramSpark package generation
- [ ] Platform selection interface
- [ ] Enhanced chat assistants (all platforms)

### Phase 3: Polish & Scale (Weeks 9-12)
- [ ] Progress dashboard with checklists
- [ ] Metadata optimization engine
- [ ] Cover validation and processing
- [ ] User account management
- [ ] Payment integration

### Phase 4: Advanced Features (Weeks 13+)
- [ ] Cover designer tool
- [ ] Series management
- [ ] Sales tracking integration
- [ ] Team/publisher accounts
- [ ] API for third-party integrations

---

## Dependencies & Requirements

### Technical Dependencies
- Cloudflare Workers account (existing)
- Claude API access (existing)
- Document processing libraries
- PDF generation libraries
- Image processing libraries

### External Services
- Stripe/payment processor (Phase 3)
- Email service (transactional emails)
- Error monitoring (Sentry, LogRocket)
- Analytics (Plausible, Fathom)

### Domain Knowledge Required
- Platform specifications (KDP, D2D, IngramSpark)
- Publishing industry best practices
- ISBN/copyright requirements
- Print specifications and standards

---

## Risks & Mitigations

### Technical Risks
**Risk**: Platform specifications change
**Mitigation**: Regular monitoring, version-controlled templates, user notifications

**Risk**: AI editing quality inconsistent
**Mitigation**: Human review option, iterative improvements, user feedback loop

**Risk**: File generation errors
**Mitigation**: Comprehensive validation, preview before download, clear error messages

### Business Risks
**Risk**: Low conversion rate
**Mitigation**: Free trial, case studies, testimonials, money-back guarantee

**Risk**: High support burden
**Mitigation**: Comprehensive AI chat assistance, knowledge base, video tutorials

**Risk**: Competition from established players
**Mitigation**: Focus on integration & ease of use, superior AI assistance, niche marketing

### Legal Risks
**Risk**: Copyright issues with user content
**Mitigation**: Clear ToS, user attestation of ownership, DMCA process

**Risk**: Platform ToS violations
**Mitigation**: No automated publishing, user maintains direct relationship with platforms

---

## Open Questions

1. Should we build our own cover designer or integrate with Canva?
2. What's the right pricing model for launch?
3. Do we need ISBN assignment/reselling capabilities?
4. Should we handle print proofs/author copies ordering?
5. Integration with marketing tools (email lists, book promo sites)?
6. Should we support simultaneous launches (pre-order coordination)?
7. Localization/internationalization needed for Day 1?

---

## Next Steps

1. **Validate assumptions** with author community surveys
2. **Build MVP** focusing on KDP + basic editing
3. **Beta test** with your wife and 5-10 other authors
4. **Iterate** based on feedback
5. **Launch** with targeted marketing to indie author communities
6. **Scale** to additional platforms and features

---

## Appendix: Platform Specifications

### Amazon KDP Requirements
**Ebook:**
- Formats: DOC, DOCX, EPUB, HTML, RTF, MOBI, TXT
- Cover: JPG or TIFF, minimum 1000px shortest side, 1.6:1 ratio ideal
- DRM: Optional
- Pricing: $0.99-$200 (70% royalty: $2.99-$9.99)

**Print:**
- Interior: PDF, trim sizes vary (5"x8", 5.25"x8", 5.5"x8.5", 6"x9", etc.)
- Cover: PDF with spine calculator
- Paper: White or cream, 50-828 pages
- Binding: Paperback only (hardcover in select markets)

### Draft2Digital Requirements
**Ebook:**
- Formats: DOC, DOCX, RTF, EPUB
- Cover: JPG, 1600x2400 minimum
- Accepts most ebook formats, auto-converts
- ISBN: Free D2D ISBN or bring your own

**Distribution:**
- Apple Books, B&N, Kobo, Google Play, libraries, subscription services
- No Amazon distribution (user must upload direct to KDP)

### IngramSpark Requirements
**Print:**
- Interior: PDF/X-1a:2001 or PDF/X-3:2002
- Cover: PDF using IngramSpark templates
- Binding: Paperback, hardcover, case laminate
- Global distribution to 40,000+ retailers
- Setup fee: $49/format, revision fee: $25

**Ebook:**
- EPUB2 or EPUB3
- Cover: JPG, minimum 1400px height
- Distribution through Ingram CoreSource

---

**Document Version:** 1.0  
**Last Updated:** 2025-10-31  
**Author:** Scott (IT Practice Manager & AI SME)  
**Purpose:** Requirements specification for Linear project management