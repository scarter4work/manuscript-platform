# Frontend Architecture & User Flows (MAN-12)

## Overview

The Manuscript Platform frontend consists of **two distinct architectures** in active use:

1. **Legacy SPA System**: Vanilla JavaScript single-page application (`dashboard-spa.html`, `dashboard-spa.js`)
2. **Modern Build System**: Vite + TypeScript + Tailwind CSS (`frontend-src/`)

Both systems coexist during the migration period, with the modern build system being the target for all new development.

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────┐     ┌──────────────────────┐       │
│  │   Legacy SPA       │     │  Modern Build System  │       │
│  │  (Currently Active)│     │   (Future Target)     │       │
│  ├────────────────────┤     ├──────────────────────┤       │
│  │ - Vanilla JS       │     │ - Vite (Build Tool)  │       │
│  │ - Inline CSS       │     │ - TypeScript         │       │
│  │ - No build step    │     │ - Tailwind CSS v3    │       │
│  │ - Manual routing   │     │ - PostCSS            │       │
│  │ - Direct deploy    │     │ - Path aliases       │       │
│  └────────────────────┘     └──────────────────────┘       │
│           │                          │                       │
│           └────────────┬─────────────┘                       │
│                        │                                     │
│              ┌─────────▼─────────┐                          │
│              │   Cloudflare      │                          │
│              │   Pages/Workers   │                          │
│              │   (Static Assets) │                          │
│              └─────────┬─────────┘                          │
│                        │                                     │
│              ┌─────────▼─────────┐                          │
│              │  API Layer        │                          │
│              │  (Hono Router)    │                          │
│              └───────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

**Technology Stack**:
- **Legacy**: Vanilla JavaScript, inline CSS, no build step
- **Modern**: Vite 7.1, TypeScript 5.9, Tailwind CSS 3.4, PostCSS
- **Deployment**: Cloudflare Pages (static assets), Cloudflare Workers (API)
- **State Management**: Local state in JavaScript objects
- **Routing**: Hash-based routing (`#view/id`)
- **Authentication**: Session-based with HttpOnly cookies

---

## Legacy SPA System (Current Production)

### Overview

The legacy SPA provides the core manuscript management experience without requiring a build step.

**Key Files**:
- `frontend/dashboard-spa.html`: Main dashboard HTML (1,055 lines)
- `frontend/dashboard-spa.js`: Application logic (2,000+ lines)
- `frontend/billing.html`: Billing and subscription management
- `frontend/login.html`, `frontend/register.html`: Authentication pages

### Architecture Pattern

**Single-Page Application with View Switching**:

```javascript
// State management
const app = {
  API_BASE: 'https://api.scarter4workmanuscripthub.com',

  state: {
    currentView: 'library',
    manuscripts: [],
    manuscriptKey: null,
    reportId: null,
    analysisResults: { /* ... */ },
    assetResults: { /* ... */ },
  },

  // Navigation function
  navigate(view, updateHash = true, skipHistory = false) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    // Show target view
    const targetView = document.getElementById(`view${capitalize(view)}`);
    if (targetView) targetView.classList.add('active');

    // Update URL hash
    if (updateHash && !skipHistory) {
      window.location.hash = `#${view}`;
    }

    // Load view-specific data
    switch (view) {
      case 'library': this.loadLibrary(); break;
      case 'upload': this.resetUploadForm(); break;
      case 'summary': this.loadSummary(); break;
      // ...
    }
  }
};
```

### Views and User Flows

#### 1. Library View (`#library`)

**Purpose**: Display all manuscripts, filter, and manage uploads

**Key Features**:
- Manuscript stats (total, analyzing, complete, word count)
- Filter by status (draft, analyzing, complete)
- Filter by genre (thriller, romance, fantasy, etc.)
- Manuscript cards with status indicators
- Quick actions (View Report, Check Progress, Delete)

**Code Structure**:

```javascript
async loadLibrary() {
  // Fetch manuscripts and stats in parallel
  const [manuscriptsResponse, statsResponse] = await Promise.all([
    fetch(`${this.API_BASE}/manuscripts`, { credentials: 'include' }),
    fetch(`${this.API_BASE}/manuscripts/stats`, { credentials: 'include' })
  ]);

  const manuscriptsData = await manuscriptsResponse.json();
  const statsData = await statsResponse.json();

  // Update state
  this.state.manuscripts = manuscriptsData.manuscripts || [];

  // Update UI
  this.displayStats(statsData.stats);
  this.displayManuscripts(this.state.manuscripts);
}
```

**API Endpoints Used**:
- `GET /manuscripts`: Fetch user's manuscripts
- `GET /manuscripts/stats`: Fetch aggregate statistics
- `DELETE /manuscripts/:id`: Delete manuscript

---

#### 2. Upload View (`#upload`)

**Purpose**: Upload manuscript and start analysis

**User Flow**:
1. User clicks "Upload New Manuscript" button
2. User selects file (.txt, .pdf, .docx up to 50MB)
3. User selects genre (thriller, romance, fantasy, etc.)
4. User selects style guide (Chicago, AP, Custom)
5. User checks copyright attestation checkbox
6. User clicks "Upload & Start Analysis"
7. File uploads, manuscript record created, analysis queued
8. User navigates to analysis progress view

**File Processing**:

```javascript
async uploadAndAnalyze() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  if (!file) {
    alert('Please select a file');
    return;
  }

  // Validate copyright attestation
  const attestation = document.getElementById('copyrightAttestation');
  if (!attestation.checked) {
    alert('You must certify copyright ownership');
    return;
  }

  // Create form data
  const formData = new FormData();
  formData.append('file', file);
  formData.append('genre', document.getElementById('genre').value);
  formData.append('styleGuide', document.getElementById('styleGuide').value);
  formData.append('copyrightAttested', 'true');

  // Upload
  const response = await fetch(`${this.API_BASE}/manuscripts`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });

  const result = await response.json();

  if (result.success) {
    // Store reportId for tracking
    this.state.reportId = result.reportId;
    this.state.manuscriptKey = result.manuscriptKey;

    // Navigate to analysis progress view
    this.navigate('analysis');

    // Start polling for status updates
    this.pollAnalysisStatus();
  }
}
```

**API Endpoints Used**:
- `POST /manuscripts`: Upload file and create manuscript record
- Returns: `{ success: true, reportId, manuscriptKey, manuscriptId }`

---

#### 3. Analysis Progress View (`#analysis`)

**Purpose**: Show real-time analysis progress with agent status

**Agent Cards**:
- 🎯 **Developmental Analysis**: Plot, characters, pacing, structure (5-10 min)
- ✍️ **Line Editing Analysis**: Prose quality, sentence structure (5-10 min)
- 📝 **Copy Editing Analysis**: Grammar, punctuation, consistency (3-5 min)

**Status Updates**:

```javascript
async pollAnalysisStatus() {
  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(
        `${this.API_BASE}/manuscripts/${this.state.reportId}/status`,
        { credentials: 'include' }
      );

      const status = await response.json();

      // Update progress bar
      document.getElementById('progressBar').style.width = `${status.progress}%`;
      document.getElementById('progressText').textContent = status.message;

      // Update agent cards based on currentStep
      this.updateAgentStatus(status);

      // Check if complete
      if (status.status === 'complete') {
        clearInterval(pollInterval);
        this.navigate('summary');
      } else if (status.status === 'failed') {
        clearInterval(pollInterval);
        this.showError(status.error);
      }
    } catch (error) {
      console.error('Status check failed:', error);
    }
  }, 5000); // Poll every 5 seconds
}

updateAgentStatus(status) {
  const agents = ['dev', 'line', 'copy'];
  const stepMap = {
    'developmental': 'dev',
    'line-editing': 'line',
    'copy-editing': 'copy'
  };

  const currentAgent = stepMap[status.currentStep];

  agents.forEach(agent => {
    const card = document.getElementById(`${agent}Agent`);
    const statusBadge = document.getElementById(`${agent}Status`);

    if (agent === currentAgent) {
      card.classList.add('running');
      statusBadge.textContent = 'Running';
      statusBadge.className = 'agent-status status-running';
    } else if (status.completedSteps?.includes(agent)) {
      card.classList.add('complete');
      statusBadge.textContent = 'Complete';
      statusBadge.className = 'agent-status status-complete';
    } else {
      statusBadge.textContent = 'Pending';
      statusBadge.className = 'agent-status status-pending';
    }
  });
}
```

**API Endpoints Used**:
- `GET /manuscripts/:reportId/status`: Poll for analysis status
- Returns: `{ status, progress, message, currentStep, completedSteps, error }`

---

#### 4. Summary View (`#summary`)

**Purpose**: Display analysis results and provide access to reports

**Key Features**:
- Overall manuscript score
- Total issues count
- Publication readiness indicator
- Quick links to reports
- Marketing & publishing tools buttons
- Download JSON data button

**Navigation Options**:
1. 📄 **View Summary Report**: Navigate to `#report`
2. ✏️ **View Annotated Manuscript**: Navigate to `#annotated`
3. 🎯 **Market Analysis**: Navigate to `#market`
4. 📦 **Marketing Assets**: Navigate to `#assets`
5. 🎨 **AI Cover Images**: Navigate to `#covers`
6. 📚 **Format for Publishing**: Navigate to `#formatting`
7. 📱 **Social Media Content**: Navigate to `#social`

**Loading Results**:

```javascript
async loadSummary() {
  try {
    // Fetch all analysis results
    const [devResponse, lineResponse, copyResponse] = await Promise.all([
      fetch(`${this.API_BASE}/reports/${this.state.reportId}/developmental`, {
        credentials: 'include'
      }),
      fetch(`${this.API_BASE}/reports/${this.state.reportId}/line-editing`, {
        credentials: 'include'
      }),
      fetch(`${this.API_BASE}/reports/${this.state.reportId}/copy-editing`, {
        credentials: 'include'
      })
    ]);

    const devData = await devResponse.json();
    const lineData = await lineResponse.json();
    const copyData = await copyResponse.json();

    // Store in state
    this.state.analysisResults = {
      developmental: devData,
      lineEditing: lineData,
      copyEditing: copyData
    };

    // Calculate overall metrics
    const overallScore = this.calculateOverallScore();
    const totalIssues = this.countTotalIssues();

    // Update UI
    document.getElementById('overallScore').textContent = overallScore;
    document.getElementById('totalIssues').textContent = totalIssues;
    document.getElementById('readyStatus').textContent =
      overallScore >= 7.5 ? '✓ Yes' : '⚠ Needs Work';

  } catch (error) {
    console.error('Failed to load summary:', error);
  }
}
```

---

#### 5. Report View (`#report`)

**Purpose**: Display formatted analysis report with scores and recommendations

**Report Loading**:

```javascript
async loadReport() {
  const reportContent = document.getElementById('reportContent');
  const reportLoading = document.getElementById('reportLoading');

  try {
    reportLoading.style.display = 'block';
    reportContent.style.display = 'none';

    // Fetch pre-generated HTML report
    const response = await fetch(
      `${this.API_BASE}/reports/${this.state.reportId}/summary.html`,
      { credentials: 'include' }
    );

    const htmlContent = await response.text();

    // Inject HTML
    reportContent.innerHTML = htmlContent;

    reportLoading.style.display = 'none';
    reportContent.style.display = 'block';

  } catch (error) {
    console.error('Failed to load report:', error);
    reportContent.innerHTML = `
      <div class="error">
        <h3>Error Loading Report</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}
```

**API Endpoints Used**:
- `GET /reports/:reportId/summary.html`: Fetch formatted HTML report
- `GET /reports/:reportId/annotated.html`: Fetch annotated manuscript

---

#### 6. Marketing & Publishing Views

**Market Analysis (`#market`)**:
- Analyze genre positioning
- Find comparable titles
- Identify target demographics
- API: `POST /manuscripts/:id/market-analysis`

**Marketing Assets (`#assets`)**:
- Generate book description & blurb
- Create keywords and categories
- Write author bio
- Generate back matter content
- Create cover design brief
- Write series description
- API: `POST /manuscripts/:id/generate-assets`

**AI Cover Images (`#covers`)**:
- Input: Book title, author name, number of variations
- Generate AI cover images using DALL-E 3
- API: `POST /manuscripts/:id/generate-covers`

**Formatting (`#formatting`)**:
- Convert manuscript to EPUB format
- Generate PDF for print/distribution
- API: `POST /manuscripts/:id/format`

**Social Media Content (`#social`)**:
- Generate platform-specific posts (Twitter, Facebook, Instagram, LinkedIn, TikTok)
- API: `POST /manuscripts/:id/social-media`

---

### State Management

**Global State Object**:

```javascript
const app = {
  state: {
    // Navigation
    currentView: 'library',

    // Manuscripts
    manuscripts: [],
    manuscriptKey: null,
    reportId: null,

    // Analysis results
    analysisResults: {
      developmental: null,
      lineEditing: null,
      copyEditing: null
    },

    // Asset generation results
    assetResults: {
      bookDescription: null,
      keywords: null,
      categories: null,
      authorBio: null,
      backMatter: null,
      coverBrief: null,
      seriesDescription: null,
      errors: null
    },

    // Marketing results
    generatedAssets: null,
    marketAnalysis: null,
    socialMedia: null
  }
};
```

**State Updates**: Direct mutation (no reactivity framework)

```javascript
// Update state
this.state.manuscripts = newManuscripts;

// Trigger UI update manually
this.displayManuscripts(this.state.manuscripts);
```

---

### Routing

**Hash-based Routing**:

```javascript
// Set hash on navigation
this.navigate('library'); // Sets window.location.hash = '#library'

// Listen for hash changes (browser back/forward)
window.addEventListener('hashchange', () => {
  const newHash = window.location.hash.slice(1);
  const [view] = newHash.split('/');
  if (view && view !== this.state.currentView) {
    this.navigate(view, false, true);
  }
});

// Support for route parameters
// Example: #summary/report-12345
const [view, id] = hash.split('/');
if (id) this.state.reportId = id;
this.navigate(view);
```

**URL Patterns**:
- `#library`: Manuscript library
- `#upload`: Upload new manuscript
- `#analysis`: Analysis progress
- `#summary`: Analysis complete summary
- `#report`: View summary report
- `#annotated`: View annotated manuscript
- `#market`: Market analysis
- `#assets`: Marketing assets
- `#covers`: AI cover generation
- `#formatting`: Format for publishing
- `#social`: Social media content

---

### Authentication

**Session-based Authentication**:

```javascript
// Check authentication on page load
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include' // Send HttpOnly session cookie
    });

    if (response.ok) {
      const data = await response.json();

      // Initialize app
      await app.init();
    } else {
      // Not authenticated, redirect to login
      window.location.href = 'login.html';
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    window.location.href = 'login.html';
  }
});

// Logout handler
async handleLogout() {
  await fetch(`${this.API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  });
  window.location.href = '/login.html';
}
```

**User Info Display**:

```javascript
async loadUserInfo() {
  const response = await fetch(`${this.API_BASE}/auth/me`, {
    credentials: 'include'
  });

  const data = await response.json();

  if (data.userId) {
    document.getElementById('userInfo').innerHTML = `
      <div>
        <div>👤 ${data.email}</div>
        <div>${data.role.toUpperCase()}</div>
        <button onclick="app.handleLogout()">Logout</button>
      </div>
    `;

    // Add admin navigation if admin role
    if (data.role === 'admin') {
      const mainNav = document.getElementById('mainNav');
      mainNav.innerHTML += `
        <a href="/admin-dashboard.html" class="main-nav-item">
          🎯 Admin Dashboard
        </a>
        <a href="/admin-dmca.html" class="main-nav-item">
          🔒 DMCA Review
        </a>
      `;
    }
  }
}
```

---

### Error Handling

**Pattern: Try-Catch with User-Friendly Messages**:

```javascript
async loadLibrary() {
  try {
    const response = await fetch(`${this.API_BASE}/manuscripts`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    // ... process data
  } catch (error) {
    console.error('Failed to load library:', error);

    // Show user-friendly error message
    document.getElementById('libraryEmpty').innerHTML = `
      <div class="error">
        <h3>Error Loading Manuscripts</h3>
        <p>${error.message}</p>
        <button class="btn" onclick="app.loadLibrary()">Try Again</button>
      </div>
    `;
    document.getElementById('libraryEmpty').style.display = 'block';
  }
}
```

---

## Modern Build System (Future Target)

### Overview

The modern build system is located in `frontend-src/` and uses industry-standard tools for a better developer experience and production performance.

**Directory Structure**:

```
frontend-src/
├── pages/           # Entry point HTML files (index.html, dashboard.html)
│   ├── index.html
│   ├── index.ts
│   └── ...
├── components/      # Reusable UI components
│   ├── Button.ts
│   ├── Modal.ts
│   └── ...
├── utils/           # Helper functions
│   ├── helpers.ts
│   └── ...
├── api/             # API client layer
│   ├── client.ts    # Centralized API client with type safety
│   └── ...
├── styles/          # Global styles
│   ├── main.css     # Tailwind imports + custom styles
│   └── ...
└── README.md        # Development guide
```

### Technology Stack

**Build Tool: Vite 7.1**
- Instant HMR (Hot Module Replacement)
- Optimized production builds
- Built-in TypeScript support
- Tree shaking and code splitting
- Asset optimization

**TypeScript 5.9**
- Type-safe JavaScript
- Strict type checking enabled
- IntelliSense and autocomplete
- Compile-time error detection

**Tailwind CSS 3.4**
- Utility-first CSS framework
- Automatic CSS purging (removes unused styles)
- Responsive design utilities
- Custom brand colors configured

**PostCSS**
- Autoprefixer for cross-browser compatibility
- CSS processing pipeline

### Configuration Files

#### `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'frontend-dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'terser',

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'frontend-src/pages/index.html'),
      },
      output: {
        manualChunks: {
          'vendor': ['hono'], // External dependencies
        },
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },

    target: 'es2020',
    chunkSizeWarningLimit: 600,
  },

  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
      '/auth': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'frontend-src'),
      '@components': resolve(__dirname, 'frontend-src/components'),
      '@utils': resolve(__dirname, 'frontend-src/utils'),
      '@styles': resolve(__dirname, 'frontend-src/styles'),
      '@api': resolve(__dirname, 'frontend-src/api'),
    },
  },

  css: {
    postcss: './postcss.config.js',
  },
});
```

**Key Features**:
- API proxy for local development (forwards `/api` and `/auth` to Worker)
- Path aliases for cleaner imports (`@/`, `@components/`, etc.)
- Asset hashing for cache busting
- Manual chunk splitting for vendor code
- Source maps for debugging

---

#### `tailwind.config.js`

```javascript
export default {
  content: [
    "./frontend-src/**/*.{html,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#667eea',
          dark: '#764ba2',
        },
        secondary: {
          DEFAULT: '#4caf50',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto',
               'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

**Custom Brand Colors**:
- `primary`: #667eea (purple)
- `primary-dark`: #764ba2 (darker purple)
- `secondary`: #4caf50 (green)

---

#### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["frontend-src/*"],
      "@components/*": ["frontend-src/components/*"],
      "@utils/*": ["frontend-src/utils/*"],
      "@styles/*": ["frontend-src/styles/*"],
      "@api/*": ["frontend-src/api/*"]
    }
  },
  "include": ["frontend-src/**/*"],
  "exclude": ["node_modules", "frontend-dist"]
}
```

---

### API Client Layer

**Type-Safe API Client** (`frontend-src/api/client.ts`):

```typescript
// Type definitions
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Manuscript {
  id: string;
  title: string;
  author: string;
  wordCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

// API Client class
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  // Generic request method with error handling
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // HTTP method helpers
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Manuscript API methods
  async getManuscripts(): Promise<ApiResponse<Manuscript[]>> {
    return this.get<Manuscript[]>('/manuscripts');
  }

  async getManuscript(id: string): Promise<ApiResponse<Manuscript>> {
    return this.get<Manuscript>(`/manuscripts/${id}`);
  }

  async uploadManuscript(file: File, title: string): Promise<ApiResponse<Manuscript>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);

    const response = await fetch(`${this.baseUrl}/manuscripts/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    return await response.json();
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
```

**Benefits**:
- Type safety for API requests and responses
- Centralized error handling
- Automatic credential (cookie) handling
- IntelliSense support in IDE
- Easier to test and mock

---

### Component Pattern

**Example: Button Component** (`frontend-src/components/Button.ts`):

```typescript
export interface ButtonOptions {
  text: string;
  type?: 'primary' | 'secondary' | 'outline';
  onClick?: () => void;
  disabled?: boolean;
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
  const { text, type = 'primary', onClick, disabled = false } = options;

  const button = document.createElement('button');
  button.textContent = text;
  button.disabled = disabled;

  // Apply Tailwind classes based on type
  const baseClasses = 'px-6 py-3 rounded-lg font-semibold transition-all';
  const typeClasses = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    secondary: 'bg-secondary text-white hover:bg-green-600',
    outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white',
  };

  button.className = `${baseClasses} ${typeClasses[type]}`;

  if (onClick) {
    button.addEventListener('click', onClick);
  }

  return button;
}
```

**Usage**:

```typescript
import { createButton } from '@components/Button';

const submitButton = createButton({
  text: 'Upload Manuscript',
  type: 'primary',
  onClick: async () => {
    await handleUpload();
  }
});

document.body.appendChild(submitButton);
```

---

### Development Workflow

**Start Development Server**:

```bash
npm run dev:frontend
```

This starts Vite on `http://localhost:3000` with:
- Hot Module Replacement (instant updates without page reload)
- TypeScript compilation on the fly
- Tailwind CSS processing
- API proxy to backend Worker (localhost:8787)

**Build for Production**:

```bash
npm run build:frontend
```

This:
- Compiles TypeScript to JavaScript
- Processes and minifies Tailwind CSS (purges unused classes)
- Bundles and tree-shakes JavaScript modules
- Generates source maps
- Creates hashed filenames for cache busting
- Outputs to `frontend-dist/` directory

**Preview Production Build**:

```bash
npm run preview:frontend
```

**Type Checking** (without building):

```bash
npm run typecheck
```

---

### Path Aliases

**Cleaner Imports**:

```typescript
// Instead of relative paths:
import { formatNumber } from '../../utils/helpers';
import { apiClient } from '../../../api/client';

// Use path aliases:
import { formatNumber } from '@utils/helpers';
import { apiClient } from '@api/client';
```

**Configured Aliases**:
- `@/` → `frontend-src/`
- `@components/` → `frontend-src/components/`
- `@utils/` → `frontend-src/utils/`
- `@styles/` → `frontend-src/styles/`
- `@api/` → `frontend-src/api/`

---

### Using Tailwind CSS

**Utility Classes**:

```html
<div class="container mx-auto px-6 py-12">
  <!-- Typography -->
  <h1 class="text-4xl font-bold text-primary mb-6">Heading</h1>
  <p class="text-gray-600 mb-4">Paragraph text</p>

  <!-- Button with custom brand colors -->
  <button class="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-all">
    Click Me
  </button>

  <!-- Card -->
  <div class="bg-white rounded-xl shadow-lg p-8">
    <h3 class="text-xl font-semibold mb-2">Card Title</h3>
    <p class="text-gray-600">Card content</p>
  </div>

  <!-- Responsive grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <!-- Grid items -->
  </div>
</div>
```

**Custom Components** (defined in `styles/main.css`):

```css
@layer components {
  .btn-primary {
    @apply bg-primary text-white px-6 py-3 rounded-lg font-semibold
           hover:bg-primary-dark transition-all shadow-md;
  }

  .btn-secondary {
    @apply bg-secondary text-white px-6 py-3 rounded-lg font-semibold
           hover:bg-green-600 transition-all shadow-md;
  }

  .card {
    @apply bg-white rounded-xl shadow-lg p-8;
  }

  .input-field {
    @apply w-full px-4 py-3 border-2 border-gray-300 rounded-lg
           focus:border-primary focus:outline-none transition-colors;
  }
}
```

---

### Performance Optimizations

**Automatic Optimizations**:
- **Tree shaking**: Unused code is removed
- **Code splitting**: Vendor and app code separated
- **Minification**: All assets are minified
- **CSS purging**: Unused Tailwind classes removed (reduces CSS from ~3MB to ~10KB)
- **Asset hashing**: Files get unique hashes for browser caching

**Manual Optimizations**:

```typescript
// Lazy load heavy modules
const heavyModule = await import('./heavy-module');

// Dynamic imports for code splitting
button.addEventListener('click', async () => {
  const { feature } = await import('./feature');
  feature.run();
});
```

**Build Output**:

```
frontend-dist/
├── assets/
│   ├── main-DkGb84en.css        # ~10KB (purged Tailwind)
│   ├── vendor-xyz123.js         # External dependencies
│   ├── main-qlxH-gfQ.js         # Application code
│   └── main-qlxH-gfQ.js.map     # Source map
└── frontend-src/
    └── pages/
        └── index.html           # Processed HTML
```

---

## Responsive Design

### Mobile-First Approach

**Breakpoints** (Tailwind defaults):
- `sm`: 640px and up
- `md`: 768px and up
- `lg`: 1024px and up
- `xl`: 1280px and up
- `2xl`: 1536px and up

**Example**:

```html
<!-- Mobile: stack vertically, Desktop: horizontal grid -->
<div class="flex flex-col md:flex-row gap-6">
  <div class="w-full md:w-1/2">Column 1</div>
  <div class="w-full md:w-1/2">Column 2</div>
</div>

<!-- Hide on mobile, show on desktop -->
<div class="hidden lg:block">Desktop only content</div>

<!-- Responsive text sizes -->
<h1 class="text-2xl md:text-4xl lg:text-6xl">Responsive Heading</h1>
```

### Viewport Meta Tag

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### Mobile Navigation

**Collapsible Menu**:

```html
<nav class="main-nav">
  <div class="flex overflow-x-auto">
    <a class="main-nav-item whitespace-nowrap">📚 My Manuscripts</a>
    <a class="main-nav-item whitespace-nowrap">💳 Billing</a>
    <!-- More items -->
  </div>
</nav>
```

**Touch-Friendly Buttons**:

```css
.btn {
  padding: 15px 40px; /* Large touch targets */
  font-size: 16px;    /* Readable text size */
}
```

---

## Frontend-Backend Integration

### API Communication Pattern

**Request Flow**:

```
┌──────────────┐      HTTP Request       ┌──────────────┐
│   Frontend   │ ─────────────────────> │   Worker     │
│  (Browser)   │   credentials: 'include'│  (Hono API)  │
└──────────────┘                         └──────────────┘
       │                                        │
       │                                        │
       │         JSON Response                  │
       │ <─────────────────────────────────────┤
       │                                        │
       │                                        ▼
       │                              ┌─────────────────┐
       │                              │  D1, R2, KV     │
       │                              │  (Data Stores)  │
       └──────────────────────────────┴─────────────────┘
```

**CORS Headers**:

```javascript
// Backend (worker.js)
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://scarter4workmanuscripthub.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

app.use('*', cors({
  origin: 'https://scarter4workmanuscripthub.com',
  credentials: true,
}));
```

### Session Management

**HttpOnly Cookies**:

```javascript
// Backend sets session cookie
export async function login(request, env) {
  // Validate credentials
  const user = await validateCredentials(email, password, env);

  if (!user) {
    return Response.json({ success: false, error: 'Invalid credentials' });
  }

  // Create session
  const sessionId = generateSessionId();
  await env.SESSIONS_KV.put(`session:${sessionId}`, JSON.stringify({
    userId: user.id,
    email: user.email,
    role: user.role
  }), { expirationTtl: 86400 * 7 }); // 7 days

  // Set HttpOnly, Secure, SameSite cookie
  const response = Response.json({ success: true, userId: user.id });
  response.headers.set('Set-Cookie', `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=${86400 * 7}; Path=/`);

  return response;
}

// Frontend sends cookie automatically with credentials: 'include'
const response = await fetch(`${API_BASE}/manuscripts`, {
  credentials: 'include' // Sends session cookie
});
```

### File Upload Pattern

**Multipart Form Data**:

```javascript
// Frontend
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('genre', 'thriller');
formData.append('styleGuide', 'chicago');

const response = await fetch(`${API_BASE}/manuscripts`, {
  method: 'POST',
  credentials: 'include',
  body: formData // Don't set Content-Type, browser sets it automatically
});

// Backend (worker.js)
app.post('/manuscripts', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file');
  const genre = formData.get('genre');

  // Extract text from file
  const text = await extractText(file, file.name);

  // Store in R2
  const manuscriptKey = `${userId}/${manuscriptId}/${file.name}`;
  await env.MANUSCRIPTS_RAW.put(manuscriptKey, text);

  // Create D1 record
  await env.DB.prepare(`
    INSERT INTO manuscripts (id, user_id, title, genre, manuscript_key, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(manuscriptId, userId, file.name, genre, manuscriptKey, 'draft').run();

  return c.json({ success: true, manuscriptId, reportId });
});
```

---

## User Flows

### 1. Registration Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User visits /register.html                              │
│  2. User enters email, password, password confirmation      │
│  3. Frontend validates input (email format, password match)│
│  4. POST /auth/register with { email, password }           │
│  5. Backend checks for existing user                        │
│  6. Backend hashes password with bcrypt (cost 12)          │
│  7. Backend creates user record in D1                       │
│  8. Backend creates session and sets HttpOnly cookie        │
│  9. Frontend redirects to /dashboard-spa.html               │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoints**:
- `POST /auth/register`: Create new user account
- Body: `{ email: string, password: string }`
- Returns: `{ success: true, userId: string }`
- Sets: `Set-Cookie: session=...; HttpOnly; Secure; SameSite=Strict`

---

### 2. Login Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User visits /login.html                                 │
│  2. User enters email and password                          │
│  3. POST /auth/login with { email, password }               │
│  4. Backend looks up user by email                          │
│  5. Backend verifies password with bcrypt.compare()         │
│  6. Backend creates session in SESSIONS_KV                  │
│  7. Backend sets HttpOnly session cookie                    │
│  8. Frontend redirects to /dashboard-spa.html               │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoints**:
- `POST /auth/login`: Authenticate user
- Body: `{ email: string, password: string }`
- Returns: `{ success: true, userId: string, role: string }`
- Sets: `Set-Cookie: session=...; HttpOnly; Secure; SameSite=Strict`

---

### 3. Manuscript Upload & Analysis Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User clicks "Upload New Manuscript"                     │
│  2. User navigates to #upload view                          │
│  3. User selects file (.txt, .pdf, .docx up to 50MB)       │
│  4. User selects genre (thriller, romance, etc.)            │
│  5. User selects style guide (Chicago, AP, Custom)          │
│  6. User checks copyright attestation checkbox              │
│  7. User clicks "Upload & Start Analysis"                   │
│  8. Frontend validates file and attestation                 │
│  9. Frontend creates FormData and sends POST /manuscripts   │
│ 10. Backend extracts text from file                         │
│ 11. Backend stores file in R2 (MANUSCRIPTS_RAW)             │
│ 12. Backend creates manuscript record in D1                 │
│ 13. Backend enqueues analysis job → ANALYSIS_QUEUE          │
│ 14. Backend returns { success, reportId, manuscriptKey }    │
│ 15. Frontend navigates to #analysis view                    │
│ 16. Frontend starts polling GET /manuscripts/:id/status     │
│ 17. Queue consumer processes analysis (10-15 min)           │
│     - Developmental Analysis (5-10 min)                     │
│     - Line Editing Analysis (5-10 min)                      │
│     - Copy Editing Analysis (3-5 min)                       │
│ 18. Queue consumer stores results in R2                     │
│ 19. Queue consumer enqueues asset generation                │
│ 20. Frontend detects status = 'complete' from polling       │
│ 21. Frontend navigates to #summary view                     │
│ 22. Frontend loads all analysis results                     │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoints**:
- `POST /manuscripts`: Upload and start analysis
  - Body: `FormData { file, genre, styleGuide, copyrightAttested }`
  - Returns: `{ success, manuscriptId, reportId, manuscriptKey }`
- `GET /manuscripts/:id/status`: Poll for analysis status
  - Returns: `{ status, progress, message, currentStep, completedSteps }`

---

### 4. View Analysis Results Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User on #summary view after analysis complete           │
│  2. User clicks "📄 View Summary Report"                    │
│  3. Frontend navigates to #report view                      │
│  4. Frontend fetches GET /reports/:reportId/summary.html    │
│  5. Backend retrieves report from R2                        │
│  6. Backend returns pre-generated HTML                      │
│  7. Frontend injects HTML into page                         │
│  8. User reads report with scores and recommendations       │
│  9. User clicks "← Back to Results"                         │
│ 10. Frontend navigates back to #summary                     │
│                                                             │
│  Alternative: View Annotated Manuscript                     │
│  1. User clicks "✏️ View Annotated Manuscript"              │
│  2. Frontend navigates to #annotated view                   │
│  3. Frontend fetches GET /reports/:reportId/annotated.html  │
│  4. Backend returns annotated manuscript HTML               │
│  5. Frontend displays manuscript with inline comments       │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoints**:
- `GET /reports/:reportId/summary.html`: Fetch summary report
- `GET /reports/:reportId/annotated.html`: Fetch annotated manuscript
- `GET /reports/:reportId/developmental`: Fetch developmental analysis JSON
- `GET /reports/:reportId/line-editing`: Fetch line editing analysis JSON
- `GET /reports/:reportId/copy-editing`: Fetch copy editing analysis JSON

---

### 5. Generate Marketing Assets Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User on #summary view after analysis complete           │
│  2. User clicks "📦 Marketing Assets"                       │
│  3. Frontend navigates to #assets view                      │
│  4. Frontend shows "Start" screen                           │
│  5. User clicks "Generate Marketing Assets"                 │
│  6. Frontend sends POST /manuscripts/:id/generate-assets    │
│  7. Backend enqueues asset generation job                   │
│  8. Asset generation queue consumer processes (2-3 min):    │
│     - Book Description Agent (parallel)                     │
│     - Keyword Agent (parallel)                              │
│     - Category Agent (parallel)                             │
│     - Author Bio Agent (parallel)                           │
│     - Back Matter Agent (parallel)                          │
│     - Cover Design Agent (parallel)                         │
│     - Series Description Agent (parallel)                   │
│  9. Queue consumer stores results in R2                     │
│ 10. Frontend polls for completion                           │
│ 11. Frontend displays generated assets                      │
│ 12. User can copy/download individual assets                │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoints**:
- `POST /manuscripts/:id/generate-assets`: Start asset generation
- `GET /manuscripts/:id/assets`: Fetch generated assets

---

### 6. Subscription & Billing Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User clicks "💳 Billing" in main navigation             │
│  2. Frontend navigates to /billing.html                     │
│  3. Frontend fetches GET /billing/subscription              │
│  4. Backend returns subscription details from D1            │
│  5. User sees current plan (Free, Pro $29/mo, Enterprise)   │
│  6. User clicks "Upgrade to Pro"                            │
│  7. Frontend sends POST /billing/create-checkout-session    │
│  8. Backend creates Stripe Checkout session                 │
│  9. Backend returns { success, url: stripeCheckoutUrl }     │
│ 10. Frontend redirects to Stripe Checkout                   │
│ 11. User enters payment details on Stripe                   │
│ 12. User completes payment                                  │
│ 13. Stripe sends webhook to /billing/stripe-webhook         │
│ 14. Backend verifies webhook signature                      │
│ 15. Backend creates/updates subscription in D1              │
│ 16. Stripe redirects user to /billing?success=true          │
│ 17. Frontend shows success message                          │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoints**:
- `GET /billing/subscription`: Get current subscription details
- `POST /billing/create-checkout-session`: Create Stripe Checkout
  - Body: `{ plan: 'pro' | 'enterprise' }`
  - Returns: `{ success, url: string }`
- `POST /billing/stripe-webhook`: Handle Stripe webhooks
- `POST /billing/cancel-subscription`: Cancel subscription

---

## Security Considerations

### Authentication

1. **HttpOnly Cookies**: Session IDs stored in HttpOnly cookies to prevent XSS attacks
2. **Secure Flag**: Cookies only sent over HTTPS in production
3. **SameSite=Strict**: Prevents CSRF attacks
4. **Bcrypt Hashing**: Passwords hashed with bcrypt (cost factor 12)
5. **Session Expiration**: Sessions expire after 7 days of inactivity

### CORS

1. **Specific Origin**: `Access-Control-Allow-Origin` set to specific domain (no wildcards)
2. **Credentials**: `Access-Control-Allow-Credentials: true` for cookie support
3. **Preflight Handling**: OPTIONS requests handled correctly

### Input Validation

1. **Frontend Validation**: Basic validation before API call
2. **Backend Validation**: Strict validation on server (never trust client)
3. **File Upload Limits**: 50MB max file size
4. **File Type Validation**: Only accept .txt, .pdf, .docx
5. **Copyright Attestation**: Required checkbox before upload

### XSS Prevention

1. **Sanitize User Input**: Never inject user input directly into HTML
2. **Use `textContent` not `innerHTML`**: When displaying user data
3. **CSP Headers**: Content Security Policy headers set by backend

---

## Performance Optimizations

### Frontend Optimizations

1. **Lazy Loading**: Load views only when needed
2. **Debounced Search**: Debounce search inputs to reduce API calls
3. **Parallel Requests**: Use `Promise.all()` for independent API calls
4. **Caching**: Cache manuscript list in state, reload only when needed
5. **Image Optimization**: Use modern image formats (WebP) where supported

### Network Optimizations

1. **Asset Hashing**: Unique hashes for long-term caching
2. **Gzip Compression**: Cloudflare automatic compression
3. **CDN**: Cloudflare CDN for global low-latency delivery
4. **HTTP/2**: Multiplexed connections for faster loading

### Build Optimizations

1. **Tree Shaking**: Remove unused code
2. **Code Splitting**: Separate vendor and app code
3. **CSS Purging**: Remove unused Tailwind classes (~3MB → ~10KB)
4. **Minification**: Minify JavaScript and CSS
5. **Source Maps**: Separate source maps for debugging (not sent to production users)

---

## Comparison: Legacy vs Modern

| Feature | Legacy SPA | Modern Build System |
|---------|-----------|---------------------|
| **Language** | Vanilla JavaScript | TypeScript |
| **CSS** | Inline styles | Tailwind CSS + PostCSS |
| **Build Tool** | None (direct deploy) | Vite 7.1 |
| **Type Safety** | ❌ No | ✅ Yes (TypeScript) |
| **HMR** | ❌ No | ✅ Yes (instant updates) |
| **Tree Shaking** | ❌ No | ✅ Yes |
| **CSS Purging** | ❌ No | ✅ Yes (~3MB → ~10KB) |
| **Code Splitting** | ❌ No | ✅ Yes |
| **Path Aliases** | ❌ No | ✅ Yes (`@/`, `@components/`, etc.) |
| **Asset Hashing** | Manual versioning | ✅ Automatic |
| **Source Maps** | ❌ No | ✅ Yes |
| **Testing** | Manual testing | Vitest (unit/integration) |
| **Linting** | ❌ No | ✅ ESLint |
| **Dev Server** | Static file server | Vite dev server + proxy |
| **Production Build** | Copy files | Optimized build pipeline |
| **Bundle Size** | ~50KB (single file) | ~15KB (app) + ~20KB (vendor) |
| **CSS Size** | ~30KB (inline) | ~10KB (purged Tailwind) |
| **Browser Support** | Modern browsers | Configurable (ES2020 target) |

---

## Migration Strategy

### Phase 1: Setup (Completed)

- ✅ Install Vite, TypeScript, Tailwind CSS
- ✅ Create `frontend-src/` directory structure
- ✅ Configure `vite.config.ts`, `tailwind.config.js`, `tsconfig.json`
- ✅ Set up path aliases
- ✅ Create API client layer (`api/client.ts`)
- ✅ Create example page (`pages/index.html`, `pages/index.ts`)

### Phase 2: Component Library (Future)

- ⏳ Extract reusable components (Button, Modal, Card, etc.)
- ⏳ Create component documentation
- ⏳ Set up Storybook for component preview

### Phase 3: Page Migration (Future)

**Priority Order**:
1. Login/Register pages (simple, independent)
2. Billing page (moderate complexity)
3. Dashboard SPA (most complex, migrate view by view)

**Migration Process per Page**:
1. Create TypeScript version in `frontend-src/pages/`
2. Extract reusable components
3. Use API client for all requests
4. Test thoroughly in development
5. Deploy to production alongside legacy version
6. Monitor for errors
7. Switch DNS/routing to new version
8. Deprecate legacy version

### Phase 4: Testing Infrastructure (Future)

- ⏳ Write unit tests for utilities and components
- ⏳ Write integration tests for API client
- ⏳ Set up E2E testing with Playwright
- ⏳ Add CI/CD pipeline for frontend tests

### Phase 5: Remove Legacy (Future)

- ⏳ Once all pages migrated, remove legacy files
- ⏳ Update deployment scripts
- ⏳ Archive legacy code for reference

---

## Troubleshooting

### Common Issues

#### 1. File Upload Fails with 413 (Payload Too Large)

**Cause**: Cloudflare Workers have 100MB request limit

**Solution**: File size limit set to 50MB in frontend validation

```javascript
if (file.size > 50 * 1024 * 1024) {
  alert('File too large. Maximum size is 50MB.');
  return;
}
```

#### 2. Session Cookie Not Sent with Requests

**Cause**: Missing `credentials: 'include'` in fetch options

**Solution**: Always include credentials in requests

```javascript
fetch(`${API_BASE}/manuscripts`, {
  credentials: 'include' // Required for cookies
});
```

#### 3. CORS Error on API Requests

**Cause**: CORS headers not configured correctly

**Solution**: Verify CORS configuration on backend

```javascript
// Backend (worker.js)
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://scarter4workmanuscripthub.com',
  'Access-Control-Allow-Credentials': 'true',
};
```

#### 4. Analysis Never Completes

**Symptoms**: Status stuck at "processing", never reaches "complete"

**Diagnosis**:
1. Check R2 for status file: `{reportId}-status.json`
2. Check worker logs for errors
3. Check DLQ (dead letter queue) for failed messages

**Solutions**:
- Verify Claude API key is valid
- Check manuscript file exists in R2
- Review queue consumer logs in Cloudflare Dashboard

#### 5. Vite Build Fails with TypeScript Errors

**Cause**: Type errors in code

**Solution**: Run type checker and fix errors

```bash
npm run typecheck
```

#### 6. Tailwind Classes Not Working

**Cause**: File not in Tailwind `content` paths

**Solution**: Ensure file is in `frontend-src/**/*.{html,js,ts,jsx,tsx}`

```javascript
// tailwind.config.js
content: [
  "./frontend-src/**/*.{html,js,ts,jsx,tsx}",
],
```

---

## Future Enhancements

### 1. Real-Time Updates (MAN-55)

**Goal**: Replace polling with WebSocket/SSE for live updates

**Implementation**:
- Use Cloudflare Durable Objects for WebSocket connections
- Push status updates from queue consumer to connected clients
- Reduce server load from polling

**Benefits**:
- Instant updates (no 5-second delay)
- Reduced API calls (less load on Workers)
- Better user experience

---

### 2. Offline Support (MAN-58)

**Goal**: Allow users to view cached manuscripts and reports offline

**Implementation**:
- Service Worker for offline caching
- IndexedDB for manuscript storage
- Background sync for uploads when back online

**Benefits**:
- Work without internet connection
- Faster load times (cached assets)
- Better mobile experience

---

### 3. Progressive Web App (PWA) (MAN-59)

**Goal**: Make the platform installable on desktop and mobile

**Implementation**:
- Web App Manifest (`manifest.json`)
- Service Worker for caching
- Add to Home Screen prompt

**Benefits**:
- Native app-like experience
- Icon on home screen
- Push notifications support

---

### 4. Component Library with Storybook (MAN-60)

**Goal**: Document and preview reusable components

**Implementation**:
- Set up Storybook
- Create stories for all components
- Generate component documentation

**Benefits**:
- Easier component development
- Visual regression testing
- Component usage examples

---

### 5. Internationalization (i18n) (MAN-61)

**Goal**: Support multiple languages

**Implementation**:
- Use `i18next` or similar library
- Extract all text strings to translation files
- Add language switcher

**Supported Languages** (planned):
- English (default)
- Spanish
- French
- German

---

## Deployment

### Cloudflare Pages

**Frontend Build**:

```bash
# Build modern frontend
npm run build:frontend

# Output: frontend-dist/
```

**Deployment**:

```bash
# Deploy frontend to Cloudflare Pages
wrangler pages deploy frontend-dist --project-name manuscript-platform-frontend
```

**Automatic Deployment**:
- Connected to GitHub repository
- Automatically deploys on push to `main` branch
- Preview deployments for pull requests

### Cloudflare Workers

**API Deployment**:

```bash
# Deploy Worker (API)
wrangler deploy
```

**Bindings**:
- D1 database: `DB`
- R2 buckets: `MANUSCRIPTS_RAW`, `MANUSCRIPTS_PROCESSED`
- KV namespace: `SESSIONS_KV`
- Queues: `ANALYSIS_QUEUE`, `ASSET_QUEUE`

---

## Monitoring & Analytics

### Cloudflare Analytics

**Metrics Tracked**:
- Page views
- Unique visitors
- Bandwidth usage
- Request counts
- Error rates (4xx, 5xx)

**Worker Metrics**:
- Invocations per second
- CPU time per request
- Errors per request
- Subrequest counts

### Custom Analytics

**User Actions**:
- Manuscript uploads
- Analysis completions
- Report downloads
- Subscription upgrades

**Implementation**:

```javascript
// Track user action
await env.DB.prepare(`
  INSERT INTO analytics_events (user_id, event_type, event_data, created_at)
  VALUES (?, ?, ?, ?)
`).bind(userId, 'manuscript_upload', JSON.stringify({ genre, wordCount }), Date.now()).run();
```

---

## References

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Hono Framework](https://hono.dev/)

---

**Last Updated**: 2025-10-28
**Author**: System Documentation (MAN-12)
**Version**: 1.0
