# Frontend Dashboard

## Files

- **`dashboard.html`** - Full-featured analysis dashboard (USE THIS ONE!)
- **`index.html`** - Simple API test page (legacy)

## Dashboard Features

The dashboard provides a complete manuscript analysis workflow:

### 🎯 What It Does

1. **Upload Manuscript**
   - Drag & drop or click to upload
   - Supports .txt, .pdf, .docx (up to 50MB)
   - Set author ID, genre, and style guide

2. **Automated Analysis Pipeline**
   - Runs all 3 agents sequentially
   - Real-time progress tracking
   - Visual status for each agent

3. **Results Display**
   - Developmental analysis scores
   - Line editing metrics
   - Copy editing error count
   - Overall publication readiness

4. **Actions**
   - Download combined JSON report
   - Start new analysis
   - View detailed results per agent

## Usage

### Local Development

1. **Start the worker:**
   ```bash
   npx wrangler dev
   ```

2. **Open dashboard:**
   ```bash
   # In browser:
   file:///C:/manuscript-platform/frontend/dashboard.html
   ```

3. **Upload and analyze:**
   - Click to upload manuscript
   - Fill in author ID and genre
   - Click "Upload & Start Analysis"
   - Wait 3-5 minutes for all analyses to complete
   - View results and download report

### Production Deployment

1. **Update API URL in dashboard.html:**
   ```javascript
   // Change line 545:
   const API_BASE = 'https://api.selfpubhub.co';
   ```

2. **Deploy to your hosting:**
   - Upload `dashboard.html` to your web host
   - Or use Cloudflare Pages for the frontend
   - Access at your domain

## Timeline

**Full Analysis (Sample Manuscript):**
- Upload: ~2 seconds
- Developmental Agent: ~30-60 seconds
- Line Editing Agent: ~1-2 minutes
- Copy Editing Agent: ~1-2 minutes
- **Total: ~3-5 minutes**

**Costs per Analysis:**
- Sample manuscript (3000 words): ~$3-5
- Full novel (80,000 words): ~$30-50

## Dashboard Screenshots

**Upload Screen:**
- Clean, intuitive interface
- File drag & drop
- Genre and style guide selection

**Analysis in Progress:**
- Progress bar
- Real-time agent status
- Color-coded cards (pending → running → complete)

**Results Summary:**
- Overall score (weighted average)
- Total issues found
- Publication readiness verdict
- Quick stats for each agent

**Detailed View:**
- Expandable details per agent
- Specific scores and metrics
- Top priorities and recommendations

## API Endpoints Used

```
POST /upload/manuscript
POST /analyze/developmental
POST /analyze/line-editing
POST /analyze/copy-editing
```

## Next Steps

Want to enhance the dashboard? Consider adding:

- [ ] User authentication
- [ ] Manuscript history/library
- [ ] Side-by-side comparisons
- [ ] Export to Word with tracked changes
- [ ] Email notifications when analysis complete
- [ ] Payment integration
- [ ] Author dashboard with stats
