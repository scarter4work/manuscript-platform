# Future Enhancements - Publishing Domain Features

This document covers publishing-specific features and workflows that should be considered for future development of the manuscript platform. These go beyond basic file storage and submission tracking to address real-world publishing industry needs.

---

## 1. Manuscript Formatting & Standards

### Problem
Publishers have specific formatting requirements that vary by house and genre. Common rejections happen due to formatting issues before content is even reviewed.

### Features Needed
- **Submission Guidelines Database**: Each publisher can specify their requirements
  - Margins, fonts, line spacing
  - Header/footer requirements
  - Page numbering preferences
  - File format preferences
- **Pre-Submission Validation**: Check manuscript against guidelines
  - Flag common formatting issues
  - Warn about guideline violations
  - Suggest corrections
- **Format Conversion Tools**: 
  - Convert between .docx, .pdf, industry standards
  - Strip incompatible formatting
  - Standardize fonts and spacing
- **Templates**: Provide industry-standard manuscript templates
  - Shunn format (short stories)
  - Standard novel manuscript format
  - Genre-specific variations

### Implementation Priority
**Medium** - Nice to have for professional polish, but not blocking launch

### Database Changes
```sql
CREATE TABLE publisher_guidelines (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL,
  guidelines TEXT NOT NULL, -- JSON with formatting rules
  file_formats_accepted TEXT, -- JSON array: [".docx", ".pdf"]
  max_file_size INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (publisher_id) REFERENCES users(id)
);
```

---

## 2. Query Letters & Synopsis

### Problem
Publishers rarely accept just a manuscript. They need query letters, synopsis, and author bio as part of the submission package.

### Features Needed
- **Query Letter Template**: 
  - Guided form for first-time authors
  - Key elements: hook, brief synopsis, credentials, comp titles
  - Character count limits
- **Synopsis Upload**:
  - Multiple versions (1-page, 5-page)
  - Automatic word count
  - Version management
- **Author Bio**:
  - Short (50 words) and long (200 words) versions
  - Publication credits
  - Relevant credentials
  - Social media links
- **Cover Letter**: For direct submissions vs. queries

### Implementation Priority
**High** - Essential for real-world publishing submissions

### Database Changes
```sql
CREATE TABLE supporting_documents (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  doc_type TEXT NOT NULL, -- query_letter/synopsis_short/synopsis_long/bio_short/bio_long/cover_letter
  content TEXT, -- For text-based documents
  r2_key TEXT, -- For uploaded documents
  word_count INTEGER,
  character_count INTEGER,
  uploaded_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id)
);

CREATE INDEX idx_supporting_docs_manuscript ON supporting_documents(manuscript_id);
CREATE INDEX idx_supporting_docs_type ON supporting_documents(doc_type);
```

---

## 3. Submission Packages

### Problem
Authors need to bundle multiple documents together as one cohesive submission. Publishers want to see everything at once.

### Features Needed
- **Package Builder**:
  - Select manuscript + supporting docs
  - Preview complete package
  - Validate completeness
  - Save package templates for reuse
- **Partial vs. Full Submissions**:
  - First 3 chapters only
  - First 10 pages, 50 pages
  - Full manuscript
  - Sample + synopsis option
- **Package Templates**:
  - Per-publisher preferences
  - Common industry standards
  - Author can create custom templates

### Implementation Priority
**High** - Critical for professional submission workflow

### Database Changes
```sql
CREATE TABLE submission_packages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL, -- "Mystery Novel Package - Standard"
  manuscript_id TEXT NOT NULL,
  supporting_doc_ids TEXT NOT NULL, -- JSON array of document IDs
  submission_type TEXT, -- full/partial/sample
  partial_page_count INTEGER, -- If partial submission
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id)
);

-- Update submissions table to reference packages
ALTER TABLE submissions ADD COLUMN package_id TEXT;
```

---

## 4. Genre & Category Metadata

### Problem
Proper categorization is essential for routing to appropriate publishers and setting expectations.

### Features Needed
- **Genre Selection**:
  - Fiction: Literary, Romance, Thriller, Mystery, Sci-Fi, Fantasy, Horror, Historical, etc.
  - Non-Fiction: Memoir, Biography, Self-Help, Business, History, Science, etc.
  - Subgenres (e.g., Cozy Mystery, Epic Fantasy, Romantic Suspense)
- **Age Category**:
  - Adult
  - Young Adult (YA)
  - Middle Grade (MG)
  - Children's (picture books, early readers)
- **Word Count Tracking**:
  - Automatic calculation on upload
  - Genre-appropriate range validation
  - Warning if outside typical ranges
- **Content Warnings**:
  - Violence, sexual content, profanity levels
  - Trigger warnings for sensitive topics
  - LGBTQ+ representation flags (for targeted publishers)

### Implementation Priority
**High** - Essential for meaningful search and filtering

### Database Changes
```sql
ALTER TABLE manuscripts ADD COLUMN genre TEXT NOT NULL DEFAULT 'unspecified';
ALTER TABLE manuscripts ADD COLUMN subgenre TEXT;
ALTER TABLE manuscripts ADD COLUMN age_category TEXT; -- adult/YA/MG/children
ALTER TABLE manuscripts ADD COLUMN word_count INTEGER;
ALTER TABLE manuscripts ADD COLUMN content_warnings TEXT; -- JSON array
ALTER TABLE manuscripts ADD COLUMN representation_tags TEXT; -- JSON array

CREATE INDEX idx_manuscripts_genre ON manuscripts(genre);
CREATE INDEX idx_manuscripts_category ON manuscripts(age_category);
```

---

## 5. Rights Management

### Problem
Authors and publishers need to track what rights are being offered and negotiated.

### Features Needed
- **Rights Offered Selection**:
  - First North American Serial Rights
  - World English Rights
  - Translation Rights
  - Audio Rights
  - Film/TV Rights
  - Digital/Electronic Rights
- **Exclusivity Settings**:
  - Exclusive submission (only to one publisher)
  - Simultaneous submissions allowed
  - Multiple submission tracking
- **Previously Published Status**:
  - First publication rights
  - Reprint rights
  - Self-published history
- **Rights Timeline**:
  - Option clauses (publisher right of first refusal on next work)
  - Rights reversion terms
  - Contract expiration tracking

### Implementation Priority
**Medium** - Important for professional contracts, but can start simple

### Database Changes
```sql
CREATE TABLE manuscript_rights (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  rights_offered TEXT NOT NULL, -- JSON array of rights types
  is_exclusive INTEGER DEFAULT 0,
  previously_published INTEGER DEFAULT 0,
  previous_publication_details TEXT,
  reprint_available INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id)
);

ALTER TABLE submissions ADD COLUMN rights_requested TEXT; -- What publisher wants
ALTER TABLE submissions ADD COLUMN rights_granted TEXT; -- What was agreed upon (post-contract)
```

---

## 6. Submission Windows & Deadlines

### Problem
Publishers aren't always open to submissions. Many have specific reading periods, contests, or capacity limits.

### Features Needed
- **Publisher Submission Status**:
  - Open/Closed toggle
  - Reading period dates
  - Reason for closure (at capacity, seasonal, between editors)
  - Expected reopening date
- **Deadline Management**:
  - Contest deadlines
  - Special calls (themed anthologies, etc.)
  - Priority deadlines (early bird pricing)
- **Auto-Reject After Deadline**:
  - System automatically closes submissions
  - Notification to authors who missed deadline
- **Notification System**:
  - Email when preferred publishers open
  - Deadline reminders
  - Waitlist for closed publishers

### Implementation Priority
**Medium** - Valuable for user experience but not critical for MVP

### Database Changes
```sql
CREATE TABLE publisher_submission_windows (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL,
  is_open INTEGER DEFAULT 1,
  opens_at INTEGER, -- Unix timestamp
  closes_at INTEGER,
  reason_closed TEXT,
  capacity_limit INTEGER, -- Max submissions accepted
  current_submission_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (publisher_id) REFERENCES users(id)
);

CREATE TABLE submission_deadlines (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL,
  deadline_type TEXT, -- contest/anthology/general
  title TEXT, -- "Summer Horror Contest 2026"
  description TEXT,
  deadline_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (publisher_id) REFERENCES users(id)
);
```

---

## 7. Agent vs. Publisher Workflow

### Problem
Literary agents are gatekeepers for traditional publishing. The submission process differs between querying agents and submitting directly to publishers.

### Features Needed
- **User Role Distinction**:
  - Author
  - Agent
  - Publisher
  - Editor (within publisher)
- **Agent Representation**:
  - Authors can mark themselves as represented
  - Agents can submit on behalf of multiple authors
  - Link between agent and author accounts
- **Submission Source Tracking**:
  - Agented submission (higher priority)
  - Unagented/slush pile
  - Referral (from another author/agent)
  - Conference pitch follow-up
- **Query vs. Submission**:
  - Query to agent: just query letter + sample pages
  - Submission to publisher: full package after agent acceptance

### Implementation Priority
**Medium** - Important for scaling to industry professionals

### Database Changes
```sql
ALTER TABLE users ADD COLUMN account_type TEXT DEFAULT 'author'; -- author/agent/publisher/editor

CREATE TABLE agent_author_relationships (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- active/terminated/pending
  contract_start INTEGER,
  contract_end INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES users(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

ALTER TABLE submissions ADD COLUMN submission_source TEXT; -- agented/unagented/referral/conference
ALTER TABLE submissions ADD COLUMN referral_info TEXT; -- Who referred, conference name, etc.
ALTER TABLE submissions ADD COLUMN priority_level INTEGER DEFAULT 0; -- 0=normal, 1=agented, 2=solicited
```

---

## 8. Response Types Beyond Accept/Reject

### Problem
Publishing has nuanced feedback beyond binary yes/no. Tracking these response types helps authors understand their progress.

### Features Needed
- **Expanded Response Types**:
  - **Form Rejection**: Standard "not right for us" letter
  - **Personalized Rejection**: Editor took time to give feedback
  - **Revise and Resubmit (R&R)**: "Rewrite with these suggestions and resubmit"
  - **Request Full Manuscript**: After reading partial/synopsis
  - **Hold for Further Consideration**: In final round, needs more review
  - **Refer to Sister Imprint**: Wrong fit here, try this other publisher
  - **Waitlist**: May accept if space opens up
  - **Offer**: Contract offer extended
- **Feedback Tracking**:
  - Personalized comments from editors
  - Revision suggestions
  - Compliments even in rejection
- **Resubmission Workflow**:
  - Track R&R responses
  - Version control for revised manuscripts
  - Link original submission to resubmission

### Implementation Priority
**High** - Critical for realistic publishing workflow

### Database Changes
```sql
ALTER TABLE submissions ADD COLUMN response_type TEXT DEFAULT 'pending';
-- Values: pending/form_rejection/personalized_rejection/request_full/
--         revise_resubmit/hold/refer/waitlist/offer/accepted/rejected

ALTER TABLE submissions ADD COLUMN feedback TEXT; -- Editor's comments
ALTER TABLE submissions ADD COLUMN is_personalized INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN revision_requested INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN parent_submission_id TEXT; -- Links to original if resubmission

CREATE INDEX idx_submissions_response_type ON submissions(response_type);
```

---

## 9. Slush Pile Management

### Problem
Publishers receive hundreds of submissions. They need tools to efficiently manage, prioritize, and track reading progress.

### Features Needed
- **Reading Queue**:
  - Inbox view of new submissions
  - Priority sorting (agented first, referrals, etc.)
  - Filter by genre, word count, submission date
- **Assignment System**:
  - Assign submissions to specific readers/editors
  - Track who's reading what
  - Workload balancing
- **Rating/Scoring**:
  - Pass/Maybe/Strong Yes scale
  - Star ratings (1-5)
  - Tags (great prose, weak plot, needs editing, etc.)
- **Consensus Building**:
  - Multiple readers rate the same submission
  - Discussion threads per submission
  - Final decision requires N approvals
- **Response Time Tracking**:
  - Average time to first response
  - Overdue submissions flagged
  - SLA monitoring (respond within X weeks)

### Implementation Priority
**Medium-High** - Essential for publishers, can start simple

### Database Changes
```sql
CREATE TABLE submission_assignments (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  reader_id TEXT NOT NULL, -- User ID of editor/reader
  assigned_at INTEGER NOT NULL,
  started_reading INTEGER, -- When they opened it
  completed_at INTEGER,
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (reader_id) REFERENCES users(id)
);

CREATE TABLE submission_ratings (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  reader_id TEXT NOT NULL,
  rating INTEGER, -- 1-5 stars
  verdict TEXT, -- pass/maybe/strong_yes
  tags TEXT, -- JSON array: ["great_prose", "weak_ending"]
  notes TEXT,
  rated_at INTEGER NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (reader_id) REFERENCES users(id)
);

CREATE TABLE submission_discussions (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE submissions ADD COLUMN reader_assigned TEXT; -- Primary reader
ALTER TABLE submissions ADD COLUMN rating_average REAL; -- Calculated from ratings
ALTER TABLE submissions ADD COLUMN response_due_by INTEGER; -- SLA deadline
```

---

## 10. Industry-Specific Workflows

### Problem
The publishing industry has unique submission pathways that differ from generic file sharing.

### Features Needed
- **Solicited vs. Unsolicited**:
  - Solicited: Publisher/agent specifically requested this submission
  - Unsolicited: Author initiated (slush pile)
  - Different processing priorities
- **Referral Tracking**:
  - "Jane Doe referred me" - track referral sources
  - Weight referrals higher in queue
  - Thank referrer if accepted
- **Conference Pitch Follow-ups**:
  - In-person meetings at writing conferences
  - Editor says "send me your manuscript"
  - Link submission to conference/event
  - Special tag for priority handling
- **Contest Submissions**:
  - Separate workflow from regular submissions
  - Anonymous judging options
  - Entry fees (if applicable)
  - Contest-specific metadata (pen name, category entry)

### Implementation Priority
**Medium** - Adds professionalism but not blocking launch

### Database Changes
```sql
ALTER TABLE submissions ADD COLUMN is_solicited INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN referral_source TEXT; -- Name of referrer
ALTER TABLE submissions ADD COLUMN referral_type TEXT; -- personal/conference/workshop/etc
ALTER TABLE submissions ADD COLUMN conference_name TEXT;
ALTER TABLE submissions ADD COLUMN conference_date INTEGER;
ALTER TABLE submissions ADD COLUMN is_contest_entry INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN contest_id TEXT;
ALTER TABLE submissions ADD COLUMN anonymous_judging INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN entry_fee_paid INTEGER DEFAULT 0;

CREATE TABLE contests (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  entry_fee INTEGER, -- In cents
  deadline INTEGER NOT NULL,
  anonymous_judging INTEGER DEFAULT 0,
  max_entries_per_author INTEGER DEFAULT 1,
  prize_details TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (publisher_id) REFERENCES users(id)
);
```

---

## 11. Manuscript Metadata That Matters

### Problem
Publishers need specific information to evaluate marketability and fit beyond just reading the manuscript.

### Features Needed
- **Completion Status**:
  - Finished manuscript
  - Work in progress (with expected completion date)
  - Outline/partial available
- **Series Information**:
  - Standalone
  - First in series
  - Part of existing series (book 2, 3, etc.)
  - Planned series length
- **Publication History**:
  - Never published
  - Self-published (sales data)
  - Previously published traditionally (rights reverted)
  - Published in magazines/anthologies (short work)
- **Comparable Titles (Comp Titles)**:
  - "Like [Book A] meets [Book B]"
  - Recent releases (within 2-3 years)
  - Similar audience/tone/genre
  - Helps publishers understand market positioning
- **Target Audience Demographics**:
  - Gender, age range, interests
  - Niche audiences (e.g., "cozy mystery readers who love cats")

### Implementation Priority
**High** - Critical for publisher decision-making

### Database Changes
```sql
ALTER TABLE manuscripts ADD COLUMN is_complete INTEGER DEFAULT 1;
ALTER TABLE manuscripts ADD COLUMN completion_date INTEGER; -- If WIP
ALTER TABLE manuscripts ADD COLUMN is_series INTEGER DEFAULT 0;
ALTER TABLE manuscripts ADD COLUMN series_position INTEGER; -- Book 1, 2, 3...
ALTER TABLE manuscripts ADD COLUMN series_title TEXT;
ALTER TABLE manuscripts ADD COLUMN planned_series_length INTEGER;
ALTER TABLE manuscripts ADD COLUMN is_standalone INTEGER DEFAULT 1;

CREATE TABLE publication_history (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  publication_type TEXT, -- traditional/self/magazine/anthology
  publisher_name TEXT,
  publication_date INTEGER,
  sales_data TEXT, -- JSON with units sold, revenue, etc.
  rights_status TEXT, -- active/reverted/expired
  created_at INTEGER NOT NULL,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id)
);

CREATE TABLE comp_titles (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  book_title TEXT NOT NULL,
  author TEXT NOT NULL,
  publication_year INTEGER,
  why_comparable TEXT, -- Similar tone, audience, theme, etc.
  created_at INTEGER NOT NULL,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id)
);

ALTER TABLE manuscripts ADD COLUMN target_audience TEXT; -- JSON with demographics
```

---

## 12. Communication & Feedback

### Problem
Authors want updates without pestering. Publishers need efficient communication tools.

### Features Needed
- **Status Notifications**:
  - Email when submission received
  - Status changes (under review → request for full)
  - Decision notifications
  - Configurable notification preferences
- **Form Letter Library**:
  - Templates for common responses
  - Personalization tokens (author name, manuscript title)
  - Bulk send to multiple submissions
  - Track which template was used
- **Personalized Feedback System**:
  - Rich text editor for detailed feedback
  - Attachments (marked-up manuscripts)
  - Private notes vs. shared with author
- **Revision Request Tracking**:
  - Clear list of requested changes
  - Deadline for resubmission
  - Checklist for author to confirm changes made
- **Negotiation Tools** (post-acceptance):
  - Offer details (advance, royalty rate, rights)
  - Counter-offer mechanism
  - Discussion thread
  - Contract attachment

### Implementation Priority
**High** - Essential for good user experience

### Database Changes
```sql
CREATE TABLE notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email_on_submission_received INTEGER DEFAULT 1,
  email_on_status_change INTEGER DEFAULT 1,
  email_on_decision INTEGER DEFAULT 1,
  email_on_message INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE message_templates (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_type TEXT, -- form_rejection/personalized_rejection/r&r/offer/etc
  subject TEXT NOT NULL,
  body TEXT NOT NULL, -- Supports tokens: {{author_name}}, {{manuscript_title}}
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (publisher_id) REFERENCES users(id)
);

CREATE TABLE submission_messages (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  message TEXT NOT NULL,
  is_internal INTEGER DEFAULT 0, -- Internal note vs shared with author
  template_used TEXT, -- Which template (if any)
  sent_at INTEGER NOT NULL,
  read_at INTEGER,
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (recipient_id) REFERENCES users(id)
);

CREATE TABLE revision_requests (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  requested_changes TEXT NOT NULL,
  deadline INTEGER,
  checklist TEXT, -- JSON array of items to address
  resubmission_submission_id TEXT, -- Link to new submission after revision
  created_at INTEGER NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);
```

---

## 13. Contract Management

### Problem
Once a manuscript is accepted, contract negotiation and management becomes critical. This is currently outside the platform scope but is a natural extension.

### Features Needed
- **Contract Templates**:
  - Standard publishing agreement templates
  - Customizable terms
  - Digital signature integration (DocuSign, etc.)
- **Key Terms Tracking**:
  - Advance amount and payment schedule
  - Royalty rates (print, ebook, audio)
  - Rights granted (territories, formats, duration)
  - Option clauses
  - Reversion terms
- **Milestone Management**:
  - Manuscript delivery deadline
  - Editorial rounds deadlines
  - Publication date
  - Marketing milestone deadlines
- **Payment Tracking**:
  - Advance payments (on signing, on delivery, on publication)
  - Royalty statements
  - Reserve against returns
  - Payment history
- **Rights Reversion**:
  - Out-of-print clauses
  - Sales threshold triggers
  - Time-based reversion
  - Author request process

### Implementation Priority
**Low-Medium** - Important for full-service platform but not immediate

### Database Changes
```sql
CREATE TABLE contracts (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  publisher_id TEXT NOT NULL,
  contract_type TEXT, -- publishing_agreement/option/amendment
  status TEXT DEFAULT 'draft', -- draft/sent/negotiating/signed/executed/terminated
  advance_amount INTEGER, -- In cents
  royalty_print REAL, -- Percentage
  royalty_ebook REAL,
  royalty_audio REAL,
  rights_granted TEXT, -- JSON with details
  territories TEXT, -- JSON array
  term_years INTEGER,
  manuscript_delivery_deadline INTEGER,
  publication_deadline INTEGER,
  option_terms TEXT,
  reversion_terms TEXT,
  document_r2_key TEXT, -- Signed contract PDF
  signed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (publisher_id) REFERENCES users(id)
);

CREATE TABLE contract_payments (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  payment_type TEXT, -- advance_signing/advance_delivery/advance_publication/royalty
  amount INTEGER NOT NULL, -- In cents
  due_date INTEGER,
  paid_date INTEGER,
  status TEXT DEFAULT 'pending', -- pending/paid/overdue
  notes TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

CREATE TABLE contract_milestones (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  milestone_type TEXT, -- manuscript_delivery/editorial_round/cover_approval/publication
  description TEXT,
  deadline INTEGER,
  completed_at INTEGER,
  status TEXT DEFAULT 'pending', -- pending/completed/missed/waived
  created_at INTEGER NOT NULL,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);
```

---

## 14. Editorial Process Integration

### Problem
After acceptance, there's a lengthy editorial process before publication. Tracking this workflow keeps everyone aligned.

### Features Needed
- **Editorial Rounds**:
  - Developmental edit (big picture: plot, character, structure)
  - Line edit (sentence-level improvements)
  - Copyedit (grammar, consistency, style)
  - Proofreading (final pass for typos)
- **Revision Tracking**:
  - Upload revised manuscripts
  - Track changes documents
  - Version comparison tools
  - Comments/notes from editors
- **Approval Workflow**:
  - Author approves/rejects editorial changes
  - Discussion threads on specific edits
  - Escalation to editorial director if needed
- **Manuscript Lock**:
  - Final manuscript locked for production
  - No further content changes (except critical fixes)
- **Cover Design Approval**:
  - Upload cover mockups
  - Author feedback and approval
  - Revisions requested
- **Publication Timeline**:
  - Gantt chart view of milestones
  - Automated reminders for upcoming deadlines
  - Delay tracking and impact analysis

### Implementation Priority
**Low** - Post-MVP, but valuable for full publishing lifecycle

### Database Changes
```sql
CREATE TABLE editorial_rounds (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  manuscript_id TEXT NOT NULL,
  round_type TEXT, -- developmental/line/copyedit/proofread
  editor_id TEXT NOT NULL,
  manuscript_version_r2_key TEXT, -- Edited version
  tracked_changes_r2_key TEXT, -- Track changes document
  editor_notes TEXT,
  sent_to_author INTEGER, -- Timestamp
  author_response TEXT,
  author_approved INTEGER, -- Timestamp when approved
  status TEXT DEFAULT 'in_progress', -- in_progress/sent_to_author/author_review/approved/rejected
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (contract_id) REFERENCES contracts(id),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id),
  FOREIGN KEY (editor_id) REFERENCES users(id)
);

CREATE TABLE cover_designs (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  cover_r2_key TEXT NOT NULL, -- Cover image file
  version_number INTEGER,
  designer_id TEXT,
  notes TEXT,
  submitted_at INTEGER NOT NULL,
  author_feedback TEXT,
  author_approved INTEGER, -- Timestamp
  status TEXT DEFAULT 'pending_review', -- pending_review/approved/revision_requested/final
  created_at INTEGER NOT NULL,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

ALTER TABLE manuscripts ADD COLUMN is_locked INTEGER DEFAULT 0; -- Final version locked
ALTER TABLE manuscripts ADD COLUMN locked_at INTEGER;
ALTER TABLE manuscripts ADD COLUMN locked_by TEXT; -- User ID who locked it
```

---

## 15. Market Positioning Data

### Problem
Publishers need to understand how to market and position a book. This data helps with acquisition decisions and marketing strategy.

### Features Needed
- **Comp Titles Analysis**:
  - Recent sales performance of comparable books
  - Similar books on bestseller lists
  - Market saturation assessment
- **Target Bookstore Shelf**:
  - Fiction → Mystery → Cozy Mystery
  - Non-Fiction → Self-Help → Career Development
  - Helps with placement and discoverability
- **Marketing Hooks**:
  - What makes this book sellable?
  - Unique selling propositions (USPs)
  - Taglines, elevator pitches
  - Media angles (author expertise, timely topics)
- **Author Platform Assessment**:
  - Social media following (Twitter, Instagram, TikTok)
  - Email list size
  - Speaking engagements
  - Previous book sales
  - Media appearances
  - Professional credentials
- **Market Trends**:
  - Rising/declining genre popularity
  - Seasonal considerations
  - Cultural relevance
  - International market potential

### Implementation Priority
**Low** - Nice for acquisitions but not critical for core submission workflow

### Database Changes
```sql
CREATE TABLE author_platform (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  twitter_followers INTEGER,
  instagram_followers INTEGER,
  tiktok_followers INTEGER,
  facebook_followers INTEGER,
  email_list_size INTEGER,
  website_monthly_visitors INTEGER,
  speaking_engagements_per_year INTEGER,
  media_appearances TEXT, -- JSON array
  professional_credentials TEXT,
  previous_books_sold INTEGER, -- Total lifetime sales
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE marketing_hooks (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  hook_type TEXT, -- tagline/elevator_pitch/usp/media_angle
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id)
);

ALTER TABLE manuscripts ADD COLUMN target_shelf TEXT; -- Bookstore categorization
ALTER TABLE manuscripts ADD COLUMN market_trends TEXT; -- JSON with trend analysis
ALTER TABLE manuscripts ADD COLUMN seasonal_relevance TEXT; -- Holiday tie-ins, etc.
ALTER TABLE manuscripts ADD COLUMN international_potential TEXT; -- Translation markets
```

---

## Priority Matrix for Implementation

### Must-Have Before Launch (MVP)
1. Query letters & synopsis upload
2. Genre & category metadata
3. Expanded response types (beyond accept/reject)
4. Supporting documents table
5. Basic submission packages

### High Priority (Phase 2 - First 6 Months)
1. Submission windows & deadlines
2. Slush pile management basics (assignment, ratings)
3. Form letter templates & notifications
4. Revision request tracking
5. Word count validation & formatting checks

### Medium Priority (Phase 3 - 6-12 Months)
1. Agent vs. publisher workflows
2. Rights management
3. Publication history tracking
4. Comp titles database
5. Advanced slush pile tools (consensus building, discussions)

### Nice-to-Have (Phase 4 - Year 2+)
1. Contract management
2. Editorial process integration
3. Payment tracking
4. Cover design approval
5. Author platform assessment
6. Market positioning tools

---

## Quick Wins to Add Now

These can be added with minimal effort but high impact:

### Database Schema Additions
```sql
-- Add to manuscripts table immediately
ALTER TABLE manuscripts ADD COLUMN genre TEXT;
ALTER TABLE manuscripts ADD COLUMN age_category TEXT;
ALTER TABLE manuscripts ADD COLUMN word_count INTEGER;
ALTER TABLE manuscripts ADD COLUMN is_complete INTEGER DEFAULT 1;
ALTER TABLE manuscripts ADD COLUMN is_series INTEGER DEFAULT 0;
ALTER TABLE manuscripts ADD COLUMN series_info TEXT; -- JSON

-- Add to submissions table immediately
ALTER TABLE submissions ADD COLUMN response_type TEXT DEFAULT 'pending';
ALTER TABLE submissions ADD COLUMN feedback TEXT;
ALTER TABLE submissions ADD COLUMN is_personalized INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN reader_assigned TEXT;
ALTER TABLE submissions ADD COLUMN priority_level INTEGER DEFAULT 0;

-- Create supporting documents table now
CREATE TABLE supporting_documents (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  word_count INTEGER,
  uploaded_at INTEGER NOT NULL,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id)
);
```

### UI Quick Additions
- Genre dropdown on manuscript upload form
- Word count display (calculated on upload)
- Query letter upload option alongside manuscript
- Response type dropdown for publishers (beyond just accept/reject)
- Simple feedback text area on submission responses

---

## Notes for claude-code Integration

When implementing these features:

1. **Start with database schema** - Add columns/tables as needed
2. **Build incrementally** - Don't try to implement everything at once
3. **User testing** - Get feedback from actual authors/publishers
4. **API design** - RESTful endpoints for each feature
5. **Documentation** - Update extended-functionality.md as features are added

**Feature Flag Strategy:**
Use environment variables to toggle features on/off:
```javascript
const FEATURES = {
  QUERY_LETTERS: true,
  SUBMISSION_PACKAGES: true,
  SLUSH_PILE: false, // Not ready yet
  CONTRACTS: false, // Future phase
};
```

This allows rolling out features gradually without breaking existing functionality.

---

*Last Updated: October 12, 2025*
*Version: 1.0*
*Companion to: extended-functionality.md*
