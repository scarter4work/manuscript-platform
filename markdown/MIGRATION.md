# Frontend Migration Guide

This guide explains how to migrate existing pages from the legacy `frontend/` directory to the modern `frontend-src/` build system.

## Table of Contents

- [Overview](#overview)
- [Migration Strategy](#migration-strategy)
- [Step-by-Step Migration](#step-by-step-migration)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## Overview

### Why Migrate?

The new build system provides:

- **Type Safety**: TypeScript catches errors before runtime
- **Modern JavaScript**: Use ES modules, async/await, and latest syntax
- **Optimized Builds**: Tree shaking, code splitting, and minification
- **Better DX**: Hot module replacement, fast rebuilds, source maps
- **Utility CSS**: Tailwind CSS for rapid UI development
- **Cleaner Code**: Path aliases and modular structure

### Migration Philosophy

**Gradual, Not All-at-Once**

- Both systems coexist during migration
- Migrate high-value pages first (dashboard, landing pages)
- Legacy pages continue working unchanged
- No breaking changes for users

## Migration Strategy

### Phase 1: Infrastructure (Complete ✅)

- [x] Install Vite and build tools
- [x] Configure TypeScript
- [x] Set up Tailwind CSS
- [x] Create directory structure
- [x] Add build scripts

### Phase 2: Create Reference Implementation (Complete ✅)

- [x] Build example page (`frontend-src/pages/index.html`)
- [x] Demonstrate TypeScript usage
- [x] Show Tailwind CSS integration
- [x] Provide reusable components
- [x] Document patterns

### Phase 3: Migrate Core Pages (Upcoming)

Priority order for migration:

1. **Landing pages** - High visibility, SEO critical
   - `marketing.html` → `frontend-src/pages/marketing.html`
   - `landing-template.html` → `frontend-src/pages/landing-template.html`

2. **Dashboard** - Most frequently used
   - `dashboard-spa.html` + `dashboard-spa.js` → TypeScript

3. **Help center** - Documentation pages
   - `help/index.html` → Modern search functionality
   - `help/getting-started.html` → Interactive tutorials

4. **Legal pages** - Low complexity, good practice
   - `terms.html`, `privacy.html`, etc.

5. **Admin pages** - Internal tools, can iterate
   - `admin-*.html` → TypeScript with better state management

### Phase 4: Deprecate Legacy Frontend

Once all pages migrated:

- Update `wrangler.toml` to serve from `frontend-dist/`
- Archive `frontend/` directory
- Remove legacy static file serving

## Step-by-Step Migration

### Example: Migrating `dashboard-spa.html`

#### Step 1: Analyze Current Page

```html
<!-- OLD: frontend/dashboard-spa.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Dashboard</title>
  <style>/* Inline styles */</style>
</head>
<body>
  <div id="app"><!-- Dashboard UI --></div>
  <script src="dashboard-spa.js"></script>
</body>
</html>
```

```javascript
// OLD: frontend/dashboard-spa.js
class DashboardApp {
  constructor() {
    this.API_BASE = '/api';
    this.state = {};
  }

  async fetchManuscripts() {
    const response = await fetch(`${this.API_BASE}/manuscripts`, {
      credentials: 'include'
    });
    return response.json();
  }
}

const app = new DashboardApp();
```

#### Step 2: Extract Common Styles

Move inline/embedded styles to Tailwind classes:

```html
<!-- OLD -->
<style>
  .manuscript-card {
    border: 1px solid #ddd;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 15px;
  }
  .btn-primary {
    background: #667eea;
    color: white;
    padding: 12px 24px;
    border-radius: 6px;
  }
</style>
<div class="manuscript-card">...</div>

<!-- NEW -->
<div class="card mb-4">...</div>
<button class="btn-primary">...</button>
```

#### Step 3: Create New HTML File

```html
<!-- NEW: frontend-src/pages/dashboard.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - Manuscript Platform</title>
  <link rel="stylesheet" href="../styles/main.css">
</head>
<body>
  <div class="container mx-auto px-6 py-8">
    <div id="app">
      <!-- Dashboard UI with Tailwind classes -->
    </div>
  </div>

  <script type="module" src="./dashboard.ts"></script>
</body>
</html>
```

#### Step 4: Convert JavaScript to TypeScript

```typescript
// NEW: frontend-src/pages/dashboard.ts
import { apiClient, Manuscript } from '@api/client';
import { formatFileSize, formatNumber } from '@utils/helpers';

interface DashboardState {
  manuscripts: Manuscript[];
  loading: boolean;
  error: string | null;
}

class DashboardApp {
  private state: DashboardState = {
    manuscripts: [],
    loading: false,
    error: null,
  };

  async init(): Promise<void> {
    await this.fetchManuscripts();
    this.render();
  }

  async fetchManuscripts(): Promise<void> {
    this.state.loading = true;
    this.render();

    const result = await apiClient.getManuscripts();

    if (result.success && result.data) {
      this.state.manuscripts = result.data;
      this.state.error = null;
    } else {
      this.state.error = result.error || 'Failed to load manuscripts';
    }

    this.state.loading = false;
    this.render();
  }

  render(): void {
    const app = document.getElementById('app');
    if (!app) return;

    if (this.state.loading) {
      app.innerHTML = '<div class="text-center">Loading...</div>';
      return;
    }

    if (this.state.error) {
      app.innerHTML = `<div class="text-red-500">${this.state.error}</div>`;
      return;
    }

    app.innerHTML = this.renderManuscripts();
    this.attachEventListeners();
  }

  renderManuscripts(): string {
    return this.state.manuscripts
      .map(m => `
        <div class="card mb-4" data-id="${m.id}">
          <h3 class="text-xl font-semibold mb-2">${m.title}</h3>
          <p class="text-gray-600 mb-2">${formatNumber(m.wordCount)} words</p>
          <p class="text-sm text-gray-500">${formatFileSize(m.wordCount * 6)}</p>
        </div>
      `)
      .join('');
  }

  attachEventListeners(): void {
    document.querySelectorAll('[data-id]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        this.viewManuscript(id!);
      });
    });
  }

  async viewManuscript(id: string): Promise<void> {
    const result = await apiClient.getManuscript(id);
    if (result.success && result.data) {
      console.log('Manuscript:', result.data);
      // Navigate or show details
    }
  }
}

// Initialize app
const app = new DashboardApp();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

export { DashboardApp };
```

#### Step 5: Add to Vite Config

```typescript
// vite.config.ts
rollupOptions: {
  input: {
    main: resolve(__dirname, 'frontend-src/pages/index.html'),
    dashboard: resolve(__dirname, 'frontend-src/pages/dashboard.html'),
  },
}
```

#### Step 6: Build and Test

```bash
npm run build:frontend
npm run preview:frontend
```

Test the built page at: http://localhost:4173/frontend-src/pages/dashboard.html

#### Step 7: Update Links (Optional)

If other pages link to the old dashboard:

```html
<!-- Update links in other pages -->
<a href="/frontend-src/pages/dashboard.html">Dashboard</a>
```

Or configure URL rewriting in `wrangler.toml` or worker routing.

## Common Patterns

### Pattern 1: Converting Inline Styles

#### Before
```html
<div style="display: flex; justify-content: space-between; padding: 20px;">
  <h1 style="font-size: 24px; font-weight: bold;">Title</h1>
</div>
```

#### After
```html
<div class="flex justify-between p-5">
  <h1 class="text-2xl font-bold">Title</h1>
</div>
```

### Pattern 2: API Calls

#### Before
```javascript
async function getManuscripts() {
  const response = await fetch('/api/manuscripts', {
    credentials: 'include'
  });
  const data = await response.json();
  return data;
}
```

#### After
```typescript
import { apiClient, Manuscript } from '@api/client';

async function getManuscripts(): Promise<Manuscript[]> {
  const result = await apiClient.getManuscripts();
  if (result.success && result.data) {
    return result.data;
  }
  throw new Error(result.error || 'Failed to fetch manuscripts');
}
```

### Pattern 3: DOM Manipulation

#### Before
```javascript
function updateCounter(count) {
  const el = document.getElementById('counter');
  el.textContent = count.toLocaleString();
}
```

#### After
```typescript
import { formatNumber } from '@utils/helpers';

function updateCounter(count: number): void {
  const el = document.getElementById('counter');
  if (el) {
    el.textContent = formatNumber(count);
  }
}
```

### Pattern 4: Event Handlers

#### Before
```javascript
document.getElementById('uploadBtn').onclick = function() {
  uploadFile();
};
```

#### After
```typescript
const uploadBtn = document.getElementById('uploadBtn');
if (uploadBtn) {
  uploadBtn.addEventListener('click', async () => {
    await uploadFile();
  });
}
```

### Pattern 5: Form Handling

#### Before
```javascript
function handleSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('title').value;
  const author = document.getElementById('author').value;
  // ... submit logic
}
```

#### After
```typescript
interface FormData {
  title: string;
  author: string;
}

function handleSubmit(e: Event): void {
  e.preventDefault();

  const form = e.target as HTMLFormElement;
  const formData: FormData = {
    title: (form.querySelector('#title') as HTMLInputElement).value,
    author: (form.querySelector('#author') as HTMLInputElement).value,
  };

  // Type-safe form handling
  submitForm(formData);
}

async function submitForm(data: FormData): Promise<void> {
  const result = await apiClient.post('/manuscripts', data);
  // ...
}
```

## Troubleshooting

### Build Failures

**Error: Cannot find module**
```bash
# Install missing dependency
npm install <package-name>

# Or if it's a type definition
npm install -D @types/<package-name>
```

**Error: TypeScript errors**
```bash
# Run type checking to see all errors
npm run typecheck

# Fix errors or use type assertions as needed
const element = document.getElementById('app') as HTMLDivElement;
```

### Runtime Issues

**CSS not loading**
- Ensure `<link rel="stylesheet" href="../styles/main.css">` is correct
- Check the path is relative to the HTML file
- Rebuild: `npm run build:frontend`

**JavaScript not executing**
- Check browser console for errors
- Ensure `<script type="module" src="./file.ts">` has correct path
- Verify the file is included in Vite's build

**API calls failing**
- Check the API base URL in development (proxy configured in Vite)
- Verify `credentials: 'include'` is set (handled by apiClient)
- Check network tab for actual request/response

### TypeScript Errors

**Type 'null' is not assignable to type 'HTMLElement'**
```typescript
// Use optional chaining and type guards
const element = document.getElementById('app');
if (element) {
  element.textContent = 'Hello';
}

// Or use non-null assertion if you're certain
const element = document.getElementById('app')!;
```

**Property does not exist on type**
```typescript
// Define interfaces for your data
interface CustomData {
  customField: string;
}

const data = response.data as CustomData;
console.log(data.customField);
```

## Migration Checklist

For each page you migrate:

- [ ] Create new HTML in `frontend-src/pages/`
- [ ] Convert styles to Tailwind CSS classes
- [ ] Create TypeScript file with proper types
- [ ] Import utilities and API client
- [ ] Add entry point to `vite.config.ts`
- [ ] Run `npm run typecheck` to verify types
- [ ] Run `npm run build:frontend` to verify build
- [ ] Test in preview mode (`npm run preview:frontend`)
- [ ] Update internal links if needed
- [ ] Deploy and test in production
- [ ] Archive old files (don't delete yet)

## Best Practices

1. **Start small**: Migrate simple pages first to learn the patterns
2. **Test thoroughly**: Use preview mode before deploying
3. **Keep old files**: Don't delete until new version is verified
4. **Extract reusable code**: Move common functionality to components/utils
5. **Use TypeScript**: Don't use `any` - define proper types
6. **Leverage Tailwind**: Use utility classes instead of custom CSS
7. **Document as you go**: Add comments for complex logic

## Getting Help

- Review the example page: `frontend-src/pages/index.html` + `index.ts`
- Check the README: `frontend-src/README.md`
- Search Tailwind docs: https://tailwindcss.com/docs
- TypeScript handbook: https://www.typescriptlang.org/docs
- Ask in team chat or create an issue

## Next Steps

After migrating your first page:

1. Identify patterns that can be extracted to components
2. Create shared components in `frontend-src/components/`
3. Share utility functions in `frontend-src/utils/`
4. Update the migration checklist with lessons learned
5. Help others migrate their pages
