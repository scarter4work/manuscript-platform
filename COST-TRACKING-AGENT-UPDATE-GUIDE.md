# Cost Tracking Agent Update Guide

This guide shows how to update the remaining agents to use automatic cost tracking.

## What's Already Done

### ✅ Completed
1. **Database migration** - All cost tracking tables created in production
2. **Core utilities** - `cost-utils.js` and updated `agent-utils.js` with `callClaudeWithCostTracking()`
3. **Admin endpoints** - 7 new API routes in `/admin/costs/`
4. **Admin dashboard** - `/admin-costs.html` frontend
5. **Queue consumer** - Updated to extract and pass `userId` and `manuscriptId`
6. **Developmental agent** - Fully updated with cost tracking
7. **Stripe webhooks** - Cost tracking for all payments

### 🔄 Remaining Agents to Update
- line-editing-agent.js
- copy-editing-agent.js
- book-description-agent.js
- keyword-agent.js
- category-agent.js
- author-bio-agent.js
- back-matter-agent.js
- cover-design-agent.js
- series-description-agent.js
- formatting-agent.js
- market-analysis-agent.js
- social-media-agent.js

## Update Pattern for Each Agent

### Step 1: Add Imports

```javascript
// At the top of the file, add:
import { callClaudeWithCostTracking, AGENT_CONFIG } from './agent-utils.js';
```

### Step 2: Update analyze() Method Signature

```javascript
// Before:
async analyze(manuscriptKey, genre) {

// After:
async analyze(manuscriptKey, genre, userId = null, manuscriptId = null) {
  // Store for cost tracking
  this.userId = userId;
  this.manuscriptId = manuscriptId;
```

### Step 3: Replace Claude API Calls

Find the section with direct `fetch()` calls to Claude API and replace with:

```javascript
// Before: Complex retry logic with fetch()
const response = await fetch(gatewayUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': this.claudeApiKey,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify(requestBody)
});
// ... retry logic, parsing, etc ...

// After: One line with cost tracking
return await callClaudeWithCostTracking(
  this.claudeApiKey,
  prompt,
  AGENT_CONFIG.TEMPERATURE.BALANCED, // or PRECISE, CREATIVE depending on agent
  'AgentName', // e.g., 'LineEditingAgent'
  this.env,
  this.userId,
  this.manuscriptId,
  'feature_name', // e.g., 'analysis' or 'asset_generation'
  'operation_name' // e.g., 'analyze_line_editing'
);
```

### Step 4: Temperature Settings by Agent Type

Use appropriate temperature:
- **PRECISE (0.5)**: analysis, keyword-agent, category-agent
- **BALANCED (0.7)**: author-bio, market-analysis
- **CREATIVE (0.8)**: cover-design, series-description, social-media

### Step 5: Feature Names and Operations

**Analysis Agents:**
- Feature: `analysis`
- Operations: `analyze_line_editing`, `analyze_copy_editing`

**Asset Generation Agents:**
- Feature: `asset_generation`
- Operations:
  - `generate_book_description`
  - `generate_keywords`
  - `generate_categories`
  - `generate_author_bio`
  - `generate_back_matter`
  - `generate_cover_brief`
  - `generate_series_description`
  - `analyze_market`
  - `generate_social_media`

**Formatting Agents:**
- Feature: `formatting`
- Operations: `format_manuscript`

## Example: Line Editing Agent Update

### Before:
```javascript
import { extractText } from './text-extraction.js';

export class LineEditingAgent {
  async analyze(manuscriptKey, genre) {
    // ... text extraction ...

    // Direct API call with retry logic
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5
        })
      });
      // ... error handling, parsing ...
    }
  }
}
```

### After:
```javascript
import { extractText } from './text-extraction.js';
import { callClaudeWithCostTracking, AGENT_CONFIG } from './agent-utils.js';

export class LineEditingAgent {
  async analyze(manuscriptKey, genre, userId = null, manuscriptId = null) {
    // Store for cost tracking
    this.userId = userId;
    this.manuscriptId = manuscriptId;

    // ... text extraction ...

    // One-line API call with automatic retry and cost tracking
    return await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.PRECISE,
      'LineEditingAgent',
      this.env,
      this.userId,
      this.manuscriptId,
      'analysis',
      'analyze_line_editing'
    );
  }
}
```

## Benefits

1. **Automatic cost tracking** - Every API call logged to database
2. **Simplified code** - Removed ~100 lines of retry logic per agent
3. **Consistent error handling** - All agents use same retry strategy
4. **Better monitoring** - Track costs by user, manuscript, and feature
5. **Budget enforcement** - Automatic alerts and optional auto-disable

## Testing

After updating each agent, test by:

1. **Upload a manuscript** via the dashboard
2. **Start analysis** to trigger the agents
3. **Check cost tracking**:
   ```sql
   SELECT * FROM cost_tracking ORDER BY created_at DESC LIMIT 10;
   ```
4. **Verify dashboard** at `/admin-costs.html` shows new costs

## Current Cost Tracking Status

| Component | Status | Cost Attribution |
|-----------|--------|------------------|
| Database Migration | ✅ Complete | - |
| Stripe Payments | ✅ Complete | stripe_fees / payment_processing |
| Developmental Agent | ✅ Complete | analysis / analyze_developmental |
| Line Editing Agent | ⏳ Pending | analysis / analyze_line_editing |
| Copy Editing Agent | ⏳ Pending | analysis / analyze_copy_editing |
| Asset Generation | ⏳ Pending | asset_generation / * |
| Admin Dashboard | ✅ Complete | - |

## Next Steps

1. Update line-editing-agent.js and copy-editing-agent.js (analysis agents)
2. Update all asset generation agents (12 agents)
3. Test full workflow with cost tracking
4. Deploy to production
5. Monitor costs in admin dashboard

## Dashboard Access

Visit `/admin-costs.html` as an admin user to see:
- Monthly budget status and usage
- Cost breakdown by service
- Top spending users
- Feature cost analysis
- Budget alerts

The dashboard auto-refreshes every 30 seconds and shows real-time cost data.
