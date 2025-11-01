# AI Chat Assistant Architecture - Specialized Platform Agents

## Overview

Each publishing platform gets its own specialized AI agent that:
1. Guides users through platform-specific workflows with dynamic checklists
2. Automatically updates knowledge from official documentation daily
3. Adapts workflows when platform requirements change
4. Provides contextual help based on user's current step

---

## Agent Specialization Strategy

### One Agent Per Platform

Each agent is an expert in ONE platform only, with deep knowledge of:
- Current upload requirements
- Account setup procedures
- Common error messages and solutions
- Platform-specific terminology
- Pricing strategies and options
- Distribution implications

**Platform Agents:**
- `kdp-agent` - Amazon KDP specialist
- `d2d-agent` - Draft2Digital specialist  
- `ingramspark-agent` - IngramSpark specialist
- `apple-books-agent` - Apple Books specialist
- `barnes-noble-agent` - Barnes & Noble Press specialist
- `kobo-agent` - Kobo Writing Life specialist
- (Future: Additional platforms as needed)

### Why Specialized Agents?

**Advantages:**
1. **Deeper expertise** - Agent isn't confused by cross-platform details
2. **Better context** - Only needs to track one workflow state
3. **Cleaner prompts** - Simpler system prompts, more focused responses
4. **Easier updates** - Update one agent without affecting others
5. **Parallel development** - Different team members can own different agents
6. **Better error handling** - Platform-specific troubleshooting
7. **Optimized for task** - Can have different conversation styles per platform

---

## Dynamic Documentation System

### Architecture: Self-Updating Knowledge Base

```
┌─────────────────────────────────────────────────┐
│  Daily Documentation Crawler (Cloudflare Cron)  │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│         Platform Documentation Sources          │
├─────────────────────────────────────────────────┤
│ • Amazon KDP Help Pages                         │
│ • Draft2Digital Knowledge Base                  │
│ • IngramSpark Support Center                    │
│ • Platform API Documentation                    │
│ • Author Forum Announcements                    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│         Change Detection & Analysis             │
├─────────────────────────────────────────────────┤
│ • Diff against previous version                 │
│ • Claude API: Analyze significance of changes   │
│ • Categorize: Critical / Important / Minor      │
│ • Extract new requirements                      │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│        Update Knowledge Base (D1 Database)      │
├─────────────────────────────────────────────────┤
│ • Store versioned documentation snapshots       │
│ • Update agent system prompts                   │
│ • Flag outdated checklist items                 │
│ • Generate update notifications                 │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│         Workflow Update System                  │
├─────────────────────────────────────────────────┤
│ • Regenerate dynamic checklists                 │
│ • Update UI flow components                     │
│ • Notify affected users in-progress             │
│ • Version control workflow definitions          │
└─────────────────────────────────────────────────┘
```

### Daily Update Process

**Scheduled Job (Cloudflare Cron - Daily at 2 AM UTC):**

```javascript
// Pseudo-code for daily documentation update
export default {
  async scheduled(event, env, ctx) {
    // For each platform
    for (const platform of PLATFORMS) {
      // 1. Fetch current documentation
      const currentDocs = await fetchPlatformDocs(platform);
      
      // 2. Retrieve previous version from D1
      const previousDocs = await env.DB.prepare(
        'SELECT content FROM platform_docs WHERE platform = ? ORDER BY version DESC LIMIT 1'
      ).bind(platform.id).first();
      
      // 3. Detect changes
      const changes = detectChanges(previousDocs.content, currentDocs);
      
      if (changes.length > 0) {
        // 4. Use Claude to analyze significance
        const analysis = await analyzeChangesWithClaude(changes, platform);
        
        // 5. Update knowledge base
        await updateKnowledgeBase(platform, currentDocs, analysis);
        
        // 6. If critical changes, update workflows
        if (analysis.criticality === 'CRITICAL' || analysis.criticality === 'IMPORTANT') {
          await updateWorkflows(platform, analysis.workflowChanges);
          await notifyAffectedUsers(platform, analysis);
        }
        
        // 7. Update agent system prompt
        await updateAgentPrompt(platform, analysis);
      }
    }
  }
};
```

### Documentation Sources to Monitor

#### Amazon KDP
- **Primary**: https://kdp.amazon.com/help
- **API/Changes**: https://kdp.amazon.com/help/topic/API (if available)
- **Author Forum**: https://kdpcommunity.com/s/ (announcements)
- **Terms**: https://kdp.amazon.com/help/topic/terms-and-conditions

#### Draft2Digital
- **Knowledge Base**: https://draft2digital.com/knowledge-base/
- **FAQ**: https://draft2digital.com/faq/
- **Blog**: https://draft2digital.com/blog/ (feature announcements)
- **Support**: https://draft2digital.com/support/

#### IngramSpark
- **Support Center**: https://www.ingramspark.com/hub/support
- **File Creation Guide**: https://www.ingramspark.com/hub/create-a-book
- **Distribution**: https://www.ingramspark.com/hub/distribution-101

### Change Detection Strategy

**Types of Changes to Monitor:**

1. **File Format Requirements**
   - New formats added/removed
   - Specification changes (dimensions, file size)
   - Validation rules updated

2. **Account Setup Requirements**
   - New required fields
   - Tax form changes
   - Payment method updates
   - Verification procedures

3. **Pricing Rules**
   - Royalty rate changes
   - Territory restrictions
   - Discount requirements

4. **Workflow Steps**
   - New mandatory steps added
   - Steps removed or simplified
   - Order of operations changed

5. **Common Errors**
   - New error codes
   - Updated error messages
   - New troubleshooting guidance

**Detection Method:**

```javascript
async function detectChanges(oldDoc, newDoc) {
  // Chunked comparison for efficiency
  const oldChunks = chunkDocument(oldDoc);
  const newChunks = chunkDocument(newDoc);
  
  const changes = [];
  
  for (let i = 0; i < newChunks.length; i++) {
    const oldChunk = oldChunks[i];
    const newChunk = newChunks[i];
    
    if (oldChunk !== newChunk) {
      changes.push({
        section: i,
        type: categorizeChange(oldChunk, newChunk),
        oldContent: oldChunk,
        newContent: newChunk,
        diff: generateDiff(oldChunk, newChunk)
      });
    }
  }
  
  return changes;
}
```

### Claude-Powered Change Analysis

**Analysis Prompt Template:**

```javascript
const CHANGE_ANALYSIS_PROMPT = `
You are a publishing platform documentation analyst. Analyze these documentation changes and determine their impact on author workflows.

Platform: ${platform.name}
Changes detected: ${changes.length}

For each change, provide:
1. Criticality (CRITICAL / IMPORTANT / MINOR)
2. Category (file_format / account_setup / pricing / workflow / error_handling / other)
3. Impact description
4. Required workflow updates (if any)
5. User-facing explanation

Changes:
${changes.map(c => `
Section: ${c.section}
Old: ${c.oldContent}
New: ${c.newContent}
`).join('\n---\n')}

Respond in JSON format:
{
  "overall_criticality": "CRITICAL|IMPORTANT|MINOR",
  "changes": [
    {
      "section": number,
      "criticality": "CRITICAL|IMPORTANT|MINOR",
      "category": "file_format|account_setup|pricing|workflow|error_handling|other",
      "impact": "description",
      "workflow_updates": ["list of required updates to checklist/workflow"],
      "user_message": "clear explanation for users"
    }
  ]
}
`;
```

---

## Platform-Specific Agent Architecture

### Agent State Management

Each agent maintains state about:
- **User context**: Current step in workflow, files uploaded, metadata entered
- **Platform knowledge**: Latest documentation version, current requirements
- **Conversation history**: Previous questions, resolved issues
- **Progress tracking**: Checklist completion status

**Database Schema:**

```sql
-- Platform documentation versions
CREATE TABLE platform_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  analyzed_at DATETIME NOT NULL,
  changes_summary TEXT,
  criticality TEXT
);

-- Agent knowledge base
CREATE TABLE agent_knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  category TEXT NOT NULL, -- file_format, account_setup, pricing, etc.
  content TEXT NOT NULL,
  last_updated DATETIME NOT NULL,
  source_url TEXT
);

-- Workflow definitions (versioned)
CREATE TABLE workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  version INTEGER NOT NULL,
  workflow_json TEXT NOT NULL, -- Dynamic checklist definition
  created_at DATETIME NOT NULL,
  deprecated_at DATETIME
);

-- User workflow state
CREATE TABLE user_workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  workflow_version INTEGER NOT NULL,
  current_step INTEGER NOT NULL,
  completed_steps TEXT, -- JSON array
  state_data TEXT, -- JSON object with step-specific data
  last_updated DATETIME NOT NULL
);

-- Agent conversations
CREATE TABLE agent_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  messages TEXT NOT NULL, -- JSON array of conversation
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
```

### Agent System Prompt Template

**Base Template (Dynamically Updated):**

```
You are the ${PLATFORM_NAME} Publishing Assistant, a specialized AI agent that helps authors navigate the ${PLATFORM_NAME} publishing process.

# Your Role
You guide authors through the complete ${PLATFORM_NAME} workflow, from account setup to final publication. You are an expert ONLY in ${PLATFORM_NAME} - do not provide guidance about other platforms.

# Current Platform Requirements (Last Updated: ${LAST_UPDATED})
${DYNAMIC_REQUIREMENTS_SECTION}

# Workflow Steps
${DYNAMIC_WORKFLOW_SECTION}

# Common Issues and Solutions
${DYNAMIC_TROUBLESHOOTING_SECTION}

# User Context
- Current Step: ${USER_CURRENT_STEP}
- Completed Steps: ${USER_COMPLETED_STEPS}
- Book Details: ${BOOK_METADATA}
- Files Uploaded: ${FILES_STATUS}

# Your Behavior
1. Always check user's current step before answering
2. Provide specific, actionable guidance
3. Reference exact field names, button labels, and screen locations from ${PLATFORM_NAME}
4. If requirements changed recently (within 7 days), proactively mention the update
5. When user encounters an error, ask for the exact error message
6. Keep responses concise but complete
7. Use checklists and numbered steps for complex procedures
8. Link to official documentation when appropriate: ${DOCS_URL}

# Conversation Style
- Professional but friendly
- Patient and encouraging
- Never assume the user knows publishing jargon
- Celebrate progress ("Great! Account setup complete. Next up: book details.")
- Clarify ambiguity ("By 'cover', do you mean the front cover image or the full print cover PDF?")

# Out of Scope
- Do NOT provide guidance about other platforms
- Do NOT give legal advice about contracts or copyright
- Do NOT provide editing or writing advice
- If asked about other platforms, say: "I specialize in ${PLATFORM_NAME}. For [other platform], please use that platform's dedicated assistant."

Now, help the user with their current question:
`;
```

### Dynamic Workflow System

**Workflow Definition Format (JSON):**

```json
{
  "platform": "kdp",
  "version": 12,
  "last_updated": "2025-10-31T02:00:00Z",
  "steps": [
    {
      "id": "account_setup",
      "title": "Account Setup",
      "description": "Create and configure your KDP account",
      "required": true,
      "estimated_time_minutes": 15,
      "substeps": [
        {
          "id": "create_account",
          "title": "Create KDP Account",
          "description": "Sign up at kdp.amazon.com",
          "help_url": "https://kdp.amazon.com/help/topic/G200635650",
          "validation": {
            "type": "user_confirmation",
            "prompt": "Have you successfully created your KDP account?"
          }
        },
        {
          "id": "tax_interview",
          "title": "Complete Tax Interview",
          "description": "Submit W-9 (US) or W-8BEN (International)",
          "help_url": "https://kdp.amazon.com/help/topic/G200644210",
          "conditional": {
            "field": "user.country",
            "branches": {
              "US": {
                "form": "W-9",
                "requirements": ["SSN or EIN", "US address"]
              },
              "default": {
                "form": "W-8BEN",
                "requirements": ["Passport or tax ID", "Foreign address", "Tax treaty selection"]
              }
            }
          },
          "validation": {
            "type": "user_confirmation",
            "prompt": "Have you completed and submitted your tax interview?"
          }
        },
        {
          "id": "payment_method",
          "title": "Set Up Payment Method",
          "description": "Add bank account for royalty payments",
          "help_url": "https://kdp.amazon.com/help/topic/G200644220",
          "requirements": [
            "Bank account number",
            "Routing number (US) or SWIFT/IBAN (International)",
            "Account holder name must match KDP account"
          ],
          "validation": {
            "type": "user_confirmation",
            "prompt": "Have you added and verified your payment method?"
          }
        }
      ]
    },
    {
      "id": "book_details",
      "title": "Book Details",
      "description": "Enter metadata about your book",
      "required": true,
      "estimated_time_minutes": 20,
      "depends_on": ["account_setup"],
      "substeps": [
        {
          "id": "basic_info",
          "title": "Basic Information",
          "fields": [
            {
              "name": "title",
              "label": "Book Title",
              "type": "text",
              "required": true,
              "max_length": 200,
              "help": "The main title of your book"
            },
            {
              "name": "subtitle",
              "label": "Subtitle",
              "type": "text",
              "required": false,
              "max_length": 200,
              "help": "Optional subtitle for additional context"
            },
            {
              "name": "author_name",
              "label": "Author Name",
              "type": "text",
              "required": true,
              "help": "Name that will appear on the book cover and detail page"
            },
            {
              "name": "contributors",
              "label": "Contributors",
              "type": "array",
              "required": false,
              "help": "Editor, illustrator, translator, etc."
            }
          ]
        },
        {
          "id": "description",
          "title": "Book Description",
          "fields": [
            {
              "name": "description",
              "label": "Description",
              "type": "textarea",
              "required": true,
              "max_length": 4000,
              "help": "Compelling description that appears on your book's detail page. Use HTML for basic formatting.",
              "suggestions": [
                "Start with a hook",
                "Highlight key themes or conflicts",
                "End with a call to action",
                "Use short paragraphs for readability"
              ]
            }
          ]
        },
        {
          "id": "keywords",
          "title": "Keywords",
          "description": "7 keyword phrases to help readers find your book",
          "fields": [
            {
              "name": "keywords",
              "label": "Keywords",
              "type": "array",
              "required": true,
              "min_items": 1,
              "max_items": 7,
              "max_length_per_item": 50,
              "help": "Use phrases readers might search for. Don't repeat words from your title.",
              "examples": [
                "science fiction adventure",
                "time travel romance",
                "artificial intelligence thriller"
              ]
            }
          ]
        },
        {
          "id": "categories",
          "title": "Categories",
          "description": "Choose up to 2 BISAC categories",
          "fields": [
            {
              "name": "categories",
              "label": "Categories",
              "type": "category_picker",
              "required": true,
              "min_items": 1,
              "max_items": 2,
              "help": "Browse the category tree to find the best fit. You can request up to 10 additional categories by contacting KDP support.",
              "note": "Categories affect where your book appears in Amazon's browse structure"
            }
          ]
        }
      ]
    },
    {
      "id": "content_upload",
      "title": "Upload Content",
      "description": "Upload your manuscript and cover files",
      "required": true,
      "estimated_time_minutes": 10,
      "depends_on": ["book_details"],
      "substeps": [
        {
          "id": "manuscript",
          "title": "Upload Manuscript",
          "description": "Upload your book's interior content",
          "accepted_formats": ["DOC", "DOCX", "EPUB", "HTML", "RTF", "MOBI", "TXT"],
          "recommendations": {
            "format": "DOCX for best formatting control",
            "file_size": "Under 650MB recommended",
            "images": "Embed images at 300 DPI for print, 72 DPI acceptable for ebook"
          },
          "validation": {
            "type": "file_check",
            "requirements": [
              "Valid file format",
              "File size under maximum",
              "No DRM protection",
              "Readable by KDP converter"
            ]
          }
        },
        {
          "id": "cover",
          "title": "Upload Cover",
          "description": "Upload your book cover image",
          "requirements": {
            "format": "JPG or TIFF",
            "minimum_dimensions": "1000px on shortest side",
            "ideal_ratio": "1.6:1 (height:width)",
            "recommended_dimensions": "1600x2560px or 2560x1600px",
            "color_mode": "RGB",
            "quality": "High quality (300 DPI for print)"
          },
          "validation": {
            "type": "image_check",
            "requirements": [
              "Meets minimum dimensions",
              "Valid image format",
              "Adequate resolution",
              "No transparent backgrounds"
            ]
          }
        }
      ]
    },
    {
      "id": "pricing_rights",
      "title": "Rights & Pricing",
      "description": "Set publishing rights and book price",
      "required": true,
      "estimated_time_minutes": 10,
      "depends_on": ["content_upload"],
      "substeps": [
        {
          "id": "publishing_rights",
          "title": "Publishing Rights",
          "fields": [
            {
              "name": "rights",
              "label": "Publishing Rights",
              "type": "select",
              "required": true,
              "options": [
                {
                  "value": "worldwide",
                  "label": "I own worldwide rights"
                },
                {
                  "value": "individual_territories",
                  "label": "I own rights for specific territories"
                },
                {
                  "value": "public_domain",
                  "label": "This is a public domain work"
                }
              ],
              "help": "Select the territories where you have the legal right to distribute this book"
            }
          ]
        },
        {
          "id": "pricing",
          "title": "Book Pricing",
          "fields": [
            {
              "name": "primary_marketplace",
              "label": "Primary Marketplace",
              "type": "select",
              "required": true,
              "options": ["Amazon.com", "Amazon.co.uk", "Amazon.de", "etc"],
              "help": "Choose your primary market for pricing"
            },
            {
              "name": "list_price",
              "label": "List Price (USD)",
              "type": "number",
              "required": true,
              "min": 0.99,
              "max": 200,
              "help": "Price between $0.99-$200. Choose $2.99-$9.99 for 70% royalty option.",
              "royalty_calculator": {
                "70_percent": {
                  "minimum_price": 2.99,
                  "maximum_price": 9.99,
                  "conditions": [
                    "Book must be enabled for lending in KDP Select or enrolled in KDP Select",
                    "List price must be at least 20% below physical list price if physical book exists",
                    "File size delivery charges apply"
                  ]
                },
                "35_percent": {
                  "minimum_price": 0.99,
                  "maximum_price": 200,
                  "conditions": ["Available for all prices"]
                }
              }
            },
            {
              "name": "kindle_unlimited",
              "label": "KDP Select / Kindle Unlimited",
              "type": "boolean",
              "required": true,
              "help": "Enroll in KDP Select for additional promotion opportunities. Requires 90-day exclusivity for ebook.",
              "note": "You can opt in/out with each 90-day term"
            }
          ]
        }
      ]
    },
    {
      "id": "preview_publish",
      "title": "Preview & Publish",
      "description": "Review your book and submit for publishing",
      "required": true,
      "estimated_time_minutes": 15,
      "depends_on": ["pricing_rights"],
      "substeps": [
        {
          "id": "preview",
          "title": "Preview Your Book",
          "description": "Use KDP's online previewer to check formatting",
          "checklist": [
            "Title page displays correctly",
            "Table of contents is functional",
            "Chapter headings are properly formatted",
            "Images appear correctly",
            "Page breaks are in the right places",
            "No formatting errors or odd spacing"
          ],
          "tools": {
            "online_previewer": "Available in KDP dashboard after upload",
            "kindle_previewer_app": "Download for offline preview on multiple devices"
          }
        },
        {
          "id": "final_review",
          "title": "Final Review",
          "checklist": [
            "Book title and subtitle are correct",
            "Author name is spelled correctly",
            "Description is compelling and error-free",
            "Categories are appropriate",
            "Keywords are strategic",
            "Price is competitive",
            "Rights selections are accurate",
            "ISBN (if used) is correct"
          ]
        },
        {
          "id": "publish",
          "title": "Publish Your Book",
          "description": "Click 'Publish Your Kindle eBook' to submit",
          "what_happens_next": {
            "review_time": "Up to 72 hours for content review",
            "live_time": "Once approved, book goes live within 24-48 hours",
            "updates": "Check email for approval/rejection notices",
            "dashboard": "Monitor status in KDP Bookshelf"
          },
          "post_publish_actions": [
            "Share your book link",
            "Set up Amazon Author Central profile",
            "Consider Amazon Advertising",
            "Request reviews from readers",
            "Monitor sales in KDP dashboard"
          ]
        }
      ]
    }
  ],
  "troubleshooting": {
    "common_errors": [
      {
        "error_code": "5:10:8",
        "message": "We found a problem with your book's cover",
        "causes": [
          "Cover dimensions too small",
          "Image resolution too low",
          "File is corrupt",
          "Wrong file format"
        ],
        "solutions": [
          "Ensure cover is at least 1000px on shortest side",
          "Use JPG or TIFF format only",
          "Try re-saving the image in a different program",
          "Verify image is RGB color mode, not CMYK"
        ]
      },
      {
        "error_code": "5:10:7",
        "message": "We found a problem with your book content",
        "causes": [
          "File is password-protected or DRM-locked",
          "File contains macros or scripts",
          "Unsupported formatting in document"
        ],
        "solutions": [
          "Remove any password protection from document",
          "Save as a clean DOCX without macros",
          "Simplify complex formatting",
          "Try uploading as EPUB instead"
        ]
      }
    ],
    "faq": [
      {
        "question": "How long does review take?",
        "answer": "Amazon reviews submitted books within 72 hours. Most books are approved within 24 hours. Once approved, your book goes live within 24-48 hours."
      },
      {
        "question": "Can I update my book after publishing?",
        "answer": "Yes! You can update content, cover, price, description, etc. at any time. Updates go through the same review process and typically take 24-72 hours."
      },
      {
        "question": "Do I need my own ISBN?",
        "answer": "No. Amazon provides a free ISBN for Kindle books. However, you can use your own ISBN if you prefer. For print books, you can use Amazon's free ISBN or provide your own."
      }
    ]
  }
}
```

### Workflow Update Process

When documentation changes are detected:

```javascript
async function updateWorkflows(platform, analysisResults) {
  // 1. Load current workflow definition
  const currentWorkflow = await loadWorkflow(platform);
  
  // 2. Apply changes from analysis
  const updatedWorkflow = applyWorkflowChanges(
    currentWorkflow,
    analysisResults.workflowChanges
  );
  
  // 3. Increment version
  updatedWorkflow.version++;
  updatedWorkflow.last_updated = new Date().toISOString();
  
  // 4. Save new version
  await saveWorkflow(updatedWorkflow);
  
  // 5. Update agent system prompt
  await updateAgentPrompt(platform, updatedWorkflow);
  
  // 6. Notify users with in-progress workflows
  await notifyUsersOfChanges(platform, analysisResults);
  
  // 7. Migrate or notify users on old workflow version
  await migrateUserWorkflows(platform, currentWorkflow.version, updatedWorkflow.version);
}
```

---

## User Experience Flow

### Landing on Platform Page

```
┌───────────────────────────────────────────────────┐
│           Amazon KDP Publishing Guide              │
├───────────────────────────────────────────────────┤
│                                                    │
│  Progress: 2 of 5 steps complete  ████░░░░░  40%  │
│                                                    │
│  ✓ Account Setup                                  │
│  ✓ Book Details                                   │
│  ▶ Content Upload  ← You are here                 │
│  ○ Pricing & Rights                               │
│  ○ Preview & Publish                              │
│                                                    │
├───────────────────────────────────────────────────┤
│                                                    │
│  📄 Files Ready to Upload:                        │
│  ✓ manuscript.docx (ready for KDP)               │
│  ✓ cover.jpg (1600x2560, perfect!)               │
│                                                    │
│  [Download Files] [View Upload Guide]             │
│                                                    │
├───────────────────────────────────────────────────┤
│                                                    │
│  💬 KDP Assistant                                 │
│  ┌─────────────────────────────────────────────┐ │
│  │ Hi! Ready to upload your content to KDP?   │ │
│  │ I can help you through each step.          │ │
│  │                                             │ │
│  │ First, let's upload your manuscript...     │ │
│  └─────────────────────────────────────────────┘ │
│                                                    │
│  [Type your question...]                          │
│                                                    │
│  Quick questions:                                  │
│  • How do I upload my manuscript?                 │
│  • What if I get an error?                        │
│  • Can I preview before publishing?               │
│                                                    │
└───────────────────────────────────────────────────┘
```

### Agent Conversation Examples

**Example 1: Manuscript Upload**

```
User: I'm ready to upload my manuscript

Agent: Great! Let's get your manuscript uploaded to KDP. Here's what to do:

1. Log into your KDP account at kdp.amazon.com
2. Click "+ Create" and choose "Kindle eBook"
3. On the "Kindle eBook Details" page, scroll to "Manuscript"
4. Click "Upload eBook manuscript"
5. Select your manuscript.docx file (the one you downloaded from our platform)
6. Wait for the upload and conversion (usually 5-7 minutes)

After uploading, you'll see:
- ✓ A green checkmark if successful
- Spell Check results (optional to review)
- Online Previewer (IMPORTANT: Use this to check your formatting)

Would you like me to walk you through what to check in the previewer?

---

User: Yes, what should I check in the previewer?

Agent: Perfect! The Online Previewer shows how your book will look on Kindle devices. Here's your checklist:

**Must Check:**
□ Title page displays correctly
□ Table of contents is clickable and works
□ Chapter headings are properly formatted
□ Images appear clear (not blurry or pixelated)
□ No weird spacing or gaps
□ No random page breaks in wrong places

**Pro tip:** Use the dropdown at the top to preview on different devices (Phone, Tablet, E-reader)

**Common issues I see:**
- Extra blank pages (usually from paragraph breaks in Word)
- Images too large (should be sized appropriately)
- Broken links in table of contents

Found any issues, or does everything look good?

---

User: There's a weird blank page before chapter 2

Agent: That's a super common issue! It's usually caused by extra paragraph marks in your Word doc. Here's the fix:

**Option 1: Fix in Word (recommended)**
1. Download your manuscript.docx again from our platform
2. Turn on "Show/Hide" (¶ button in Word)
3. Look for extra paragraph marks (¶¶¶) before Chapter 2
4. Delete the extra ones (leave just one)
5. Save and re-upload to KDP

**Option 2: Let KDP's converter handle it**
Most readers won't notice a single blank page, and it won't affect sales

Which option would you like to try?
```

**Example 2: Cover Rejection Error**

```
User: My cover was rejected with error 5:10:8

Agent: Error 5:10:8 means "We found a problem with your book's cover." This is usually fixable! Let me help you diagnose it.

**What KDP is checking:**
□ Minimum size: 1000px on shortest side ✓ (yours is 1600px - good!)
□ File format: JPG or TIFF ✓ (you have JPG - good!)
□ Color mode: Must be RGB (not CMYK)
□ File integrity: Not corrupt

Since your size and format are correct, it's likely either:
1. **Color mode issue** - Your cover might be in CMYK instead of RGB
2. **File corruption** - File got damaged during upload

**Quick fix - Try this:**
1. Download cover.jpg from our platform again
2. Open it in any image editor (even Paint works)
3. File → Save As → Save as a new JPG
4. Re-upload this fresh version to KDP

If that doesn't work, let me know and I'll help you check the color mode.

Want me to walk you through checking color mode?
```

**Example 3: Platform Update Notification**

```
Agent: 📢 Important update! KDP just changed their category system (updated yesterday).

**What changed:**
Previously, you could only select 2 categories during setup. Now KDP allows you to request up to 10 additional categories by contacting support AFTER publishing.

**Impact on your book:**
- Your current 2 category selections are still valid
- After you publish, you can request 8 more for better discoverability
- I've updated the workflow to include this new option

**Recommendation:**
Choose your 2 best categories now. After publishing, I can help you identify 8 additional categories to request for maximum visibility.

No action needed right now - just wanted you to know about this opportunity!

Continue with your upload, or would you like help choosing better categories?
```

---

## Implementation Details

### Agent Context Loading

**Before each conversation turn:**

```javascript
async function loadAgentContext(userId, bookId, platform) {
  // 1. Load user's workflow state
  const workflowState = await db.prepare(
    'SELECT * FROM user_workflows WHERE user_id = ? AND book_id = ? AND platform = ?'
  ).bind(userId, bookId, platform).first();
  
  // 2. Load latest platform workflow definition
  const workflow = await db.prepare(
    'SELECT * FROM workflows WHERE platform = ? ORDER BY version DESC LIMIT 1'
  ).bind(platform).first();
  
  // 3. Load platform knowledge base
  const knowledge = await db.prepare(
    'SELECT * FROM agent_knowledge WHERE platform = ?'
  ).bind(platform).all();
  
  // 4. Load conversation history
  const conversation = await db.prepare(
    'SELECT messages FROM agent_conversations WHERE user_id = ? AND book_id = ? AND platform = ?'
  ).bind(userId, bookId, platform).first();
  
  // 5. Load book metadata and files
  const book = await getBookDetails(bookId);
  
  // 6. Check for recent platform updates
  const recentUpdates = await db.prepare(
    'SELECT * FROM platform_docs WHERE platform = ? AND analyzed_at > datetime("now", "-7 days")'
  ).bind(platform).all();
  
  return {
    workflowState,
    workflow: JSON.parse(workflow.workflow_json),
    knowledge,
    conversation: conversation ? JSON.parse(conversation.messages) : [],
    book,
    recentUpdates
  };
}
```

### Agent Response Generation

```javascript
async function generateAgentResponse(userMessage, context) {
  const systemPrompt = buildSystemPrompt(context);
  
  const response = await claudeAPI.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      ...context.conversation,
      { role: "user", content: userMessage }
    ]
  });
  
  // Parse response for any actions
  const actions = extractActions(response.content);
  
  // Update workflow state if agent marked step complete
  if (actions.completeStep) {
    await updateWorkflowProgress(
      context.workflowState.id,
      actions.completeStep
    );
  }
  
  // Save conversation turn
  await saveConversation(context, userMessage, response.content);
  
  return {
    message: response.content,
    actions,
    updatedState: context.workflowState
  };
}
```

---

## Benefits of This Architecture

### For Users
1. **Accurate guidance** - Always up-to-date with platform changes
2. **Less confusion** - Each agent speaks only about one platform
3. **Faster help** - Specialized knowledge means better answers
4. **Progress tracking** - Visual checklist shows exactly where they are
5. **Proactive updates** - Notified when platform changes affect them

### For Development
1. **Easier maintenance** - Update one agent without touching others
2. **Parallel development** - Team members can own different agents
3. **Better testing** - Test each agent in isolation
4. **Clearer responsibilities** - Each agent has defined scope
5. **Simpler prompts** - No cross-platform confusion in system prompts

### For Product
1. **Competitive moat** - No other platform offers this level of guidance
2. **Reduced support burden** - AI handles 80%+ of questions
3. **Better user retention** - Success rate goes up dramatically
4. **Viral potential** - "You have to see this AI assistant" sharing
5. **Data goldmine** - Learn exactly where users struggle

---

## Next Steps for Implementation

### Phase 1: Single Agent MVP (Week 1-2)
- [ ] Build KDP agent only (most important platform)
- [ ] Create basic workflow definition
- [ ] Implement agent conversation system
- [ ] Add simple progress tracking

### Phase 2: Documentation Crawler (Week 3)
- [ ] Build daily documentation fetcher
- [ ] Implement change detection
- [ ] Add Claude-powered analysis
- [ ] Test with manual workflow updates

### Phase 3: Additional Agents (Week 4-5)
- [ ] Add Draft2Digital agent
- [ ] Add IngramSpark agent
- [ ] Standardize agent prompt templates
- [ ] Build agent management dashboard

### Phase 4: Auto-Update System (Week 6)
- [ ] Implement automatic workflow updates
- [ ] Add user notification system
- [ ] Build workflow migration logic
- [ ] Test with beta users

---

## Metrics to Track

### Agent Performance
- Response accuracy (user ratings)
- Average conversation length to resolution
- Completion rate (started workflow → published)
- User satisfaction scores
- Questions requiring human escalation

### Platform Updates
- Documentation changes detected per day
- Critical vs. minor changes ratio
- Time to workflow update after platform change
- User impact notifications sent

### User Success
- Average time to publish by platform
- Workflow abandonment rate by step
- Error rate by step
- Support ticket volume before/after agent

---

**Document Version:** 1.0  
**Last Updated:** 2025-10-31  
**Author:** Scott  
**Purpose:** Specialized AI agent architecture for platform-specific publishing guidance