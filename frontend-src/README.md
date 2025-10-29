# Frontend Source Directory

This directory contains the modern frontend source code using Vite, TypeScript, and Tailwind CSS.

## Directory Structure

```
frontend-src/
├── pages/          # Individual page entry points (HTML + TS)
├── components/     # Reusable UI components
├── utils/          # Helper functions and utilities
├── api/            # API client and data fetching
└── styles/         # Global styles and Tailwind configuration
```

## Technology Stack

- **Vite**: Modern build tool with fast HMR and optimized production builds
- **TypeScript**: Type-safe JavaScript with strict type checking
- **Tailwind CSS v3**: Utility-first CSS framework
- **PostCSS**: CSS processing with autoprefixer

## Getting Started

### Development

Start the development server with hot module replacement:

```bash
npm run dev:frontend
```

This will start Vite on http://localhost:3000 with:
- Hot module replacement (HMR) for instant updates
- TypeScript compilation on the fly
- Tailwind CSS processing
- API proxy to the backend worker (localhost:8787)

### Building for Production

Build optimized production assets:

```bash
npm run build:frontend
```

This will:
- Compile TypeScript to JavaScript
- Process and minify Tailwind CSS
- Bundle and tree-shake JavaScript modules
- Generate source maps
- Create hashed filenames for cache busting
- Output to `frontend-dist/` directory

### Preview Production Build

Preview the production build locally:

```bash
npm run preview:frontend
```

### Type Checking

Run TypeScript type checking without building:

```bash
npm run typecheck
```

## Path Aliases

The following path aliases are configured for cleaner imports:

- `@/` → `frontend-src/`
- `@components/` → `frontend-src/components/`
- `@utils/` → `frontend-src/utils/`
- `@styles/` → `frontend-src/styles/`
- `@api/` → `frontend-src/api/`

### Example Usage

```typescript
// Instead of relative paths:
import { formatNumber } from '../../utils/helpers';

// Use path aliases:
import { formatNumber } from '@utils/helpers';
```

## Creating a New Page

### 1. Create HTML File

Create a new HTML file in `pages/`:

```html
<!-- frontend-src/pages/my-page.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Page</title>
  <link rel="stylesheet" href="../styles/main.css">
</head>
<body>
  <div class="container mx-auto px-6 py-12">
    <h1>My Page</h1>
    <button class="btn-primary" id="myButton">Click Me</button>
  </div>
  <script type="module" src="./my-page.ts"></script>
</body>
</html>
```

### 2. Create TypeScript File

Create the corresponding TypeScript file:

```typescript
// frontend-src/pages/my-page.ts
import { apiClient } from '@api/client';
import { formatNumber } from '@utils/helpers';

async function init(): Promise<void> {
  const button = document.getElementById('myButton');

  button?.addEventListener('click', async () => {
    const result = await apiClient.get('/some-endpoint');
    console.log('Result:', result);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

### 3. Add Entry Point to Vite Config

Update `vite.config.ts` to include your new page:

```typescript
rollupOptions: {
  input: {
    main: resolve(__dirname, 'frontend-src/pages/index.html'),
    myPage: resolve(__dirname, 'frontend-src/pages/my-page.html'),
  },
}
```

### 4. Build and Deploy

```bash
npm run build:frontend
```

The built page will be in `frontend-dist/frontend-src/pages/my-page.html`

## Using Tailwind CSS

### Built-in Utility Classes

Tailwind provides utility classes for styling:

```html
<!-- Spacing and layout -->
<div class="container mx-auto px-6 py-12">

  <!-- Typography -->
  <h1 class="text-4xl font-bold mb-6">Heading</h1>
  <p class="text-gray-600 mb-4">Paragraph text</p>

  <!-- Buttons (custom components) -->
  <button class="btn-primary">Primary Button</button>
  <button class="btn-secondary">Secondary Button</button>
  <button class="btn-outline">Outline Button</button>

  <!-- Cards -->
  <div class="card">
    <h3 class="text-xl font-semibold mb-2">Card Title</h3>
    <p class="text-gray-600">Card content</p>
  </div>

  <!-- Input fields -->
  <input type="text" class="input-field" placeholder="Enter text">

  <!-- Gradients -->
  <div class="gradient-bg text-white p-12">
    Gradient background
  </div>
</div>
```

### Custom Brand Colors

The following brand colors are configured:

- `primary` - #667eea (purple)
- `primary-dark` - #764ba2 (darker purple)
- `secondary` - #4caf50 (green)

Use them with any Tailwind utility:

```html
<div class="bg-primary text-white">Primary color background</div>
<div class="text-primary hover:text-primary-dark">Primary color text</div>
<button class="bg-secondary hover:bg-green-600">Secondary button</button>
```

### Custom Components

Pre-defined component classes in `styles/main.css`:

- `.btn-primary` - Primary button style
- `.btn-secondary` - Secondary button style
- `.btn-outline` - Outline button style
- `.card` - Card container
- `.input-field` - Form input field
- `.gradient-bg` - Brand gradient background

## Using the API Client

### Basic Usage

```typescript
import { apiClient } from '@api/client';

// GET request
const manuscripts = await apiClient.getManuscripts();
if (manuscripts.success) {
  console.log('Manuscripts:', manuscripts.data);
}

// POST request
const result = await apiClient.post('/endpoint', {
  key: 'value'
});

// Upload file
const file = document.querySelector('input[type="file"]').files[0];
const upload = await apiClient.uploadManuscript(file, 'My Book');
```

### Type Safety

The API client provides TypeScript interfaces:

```typescript
import { ApiResponse, Manuscript } from '@api/client';

const response: ApiResponse<Manuscript[]> = await apiClient.getManuscripts();
```

## Creating Reusable Components

### Component Example

```typescript
// frontend-src/components/Modal.ts
export interface ModalOptions {
  title: string;
  content: string;
  onClose?: () => void;
}

export function createModal(options: ModalOptions): HTMLElement {
  const { title, content, onClose } = options;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';

  modal.innerHTML = `
    <div class="bg-white rounded-lg p-8 max-w-md">
      <h2 class="text-2xl font-bold mb-4">${title}</h2>
      <p class="text-gray-600 mb-6">${content}</p>
      <button class="btn-primary close-modal">Close</button>
    </div>
  `;

  modal.querySelector('.close-modal')?.addEventListener('click', () => {
    modal.remove();
    onClose?.();
  });

  return modal;
}
```

### Using the Component

```typescript
import { createModal } from '@components/Modal';

const modal = createModal({
  title: 'Success',
  content: 'Your manuscript has been uploaded!',
  onClose: () => console.log('Modal closed')
});

document.body.appendChild(modal);
```

## Utility Functions

### Available Utilities

```typescript
import {
  formatNumber,     // Format numbers with commas
  truncate,         // Truncate text with ellipsis
  debounce,         // Debounce function calls
  sleep,            // Async sleep utility
  formatFileSize,   // Format bytes to KB/MB/GB
  isValidEmail,     // Email validation
  generateId,       // Generate unique IDs
} from '@utils/helpers';

// Examples
console.log(formatNumber(1234567));      // "1,234,567"
console.log(truncate('Long text...', 10)); // "Long te..."
console.log(formatFileSize(1024 * 1024)); // "1 MB"
console.log(isValidEmail('user@example.com')); // true
console.log(generateId('user'));          // "user-1234567890-abc123"
```

## Migration from Old Frontend

See [MIGRATION.md](../docs/MIGRATION.md) for a complete guide on converting existing pages to the new build system.

## Build Output

Production builds are output to `frontend-dist/` with:

- Minified and bundled JavaScript
- Processed and purged Tailwind CSS (only used classes)
- Hashed filenames for cache busting
- Source maps for debugging
- Gzip size reporting

Example output:
```
frontend-dist/
├── assets/
│   ├── main-DkGb84en.css        # Processed CSS
│   ├── main-qlxH-gfQ.js         # Bundled JS
│   └── main-qlxH-gfQ.js.map     # Source map
└── frontend-src/
    └── pages/
        └── index.html           # Processed HTML
```

## Performance Optimization

### Automatic Optimizations

- **Tree shaking**: Unused code is removed
- **Code splitting**: Vendor and app code separated
- **Minification**: All assets are minified
- **CSS purging**: Unused Tailwind classes removed
- **Asset hashing**: Files get unique hashes for caching

### Manual Optimizations

```typescript
// Lazy load heavy modules
const heavyModule = await import('./heavy-module');

// Dynamic imports for code splitting
button.addEventListener('click', async () => {
  const { feature } = await import('./feature');
  feature.run();
});
```

## Troubleshooting

### Build Errors

If you encounter build errors:

1. **Clear the cache**: Delete `node_modules/.vite`
2. **Reinstall dependencies**: `npm install`
3. **Check TypeScript errors**: `npm run typecheck`

### Type Errors

Enable strict type checking helps catch errors early:

```typescript
// Always type your variables
const count: number = 42;

// Type function parameters and returns
function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

### Tailwind Not Working

1. Ensure the CSS file is imported: `<link rel="stylesheet" href="../styles/main.css">`
2. Check the file is in the Tailwind `content` paths in `tailwind.config.js`
3. Rebuild: `npm run build:frontend`

## Best Practices

1. **Use TypeScript**: Take advantage of type safety
2. **Use path aliases**: Cleaner imports with `@/` prefixes
3. **Component reuse**: Extract reusable UI into components
4. **Utility functions**: Don't repeat common operations
5. **Type your API responses**: Use the provided interfaces
6. **Test in production mode**: Use `npm run preview:frontend`

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [PostCSS Documentation](https://postcss.org/)
