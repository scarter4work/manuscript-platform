import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Build configuration optimized for Cloudflare Pages
  build: {
    outDir: 'frontend-dist',
    emptyOutDir: true,

    // Generate sourcemaps for debugging
    sourcemap: true,

    // Optimize for production
    minify: 'terser',

    // Chunk splitting strategy
    rollupOptions: {
      input: {
        // Entry points for pages
        main: resolve(__dirname, 'frontend-src/pages/index.html'),
      },
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          'vendor': ['hono'], // Example: external dependencies
        },
        // Asset naming for cache busting
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },

    // Target modern browsers for smaller bundles
    target: 'es2020',

    // Optimize chunk size
    chunkSizeWarningLimit: 600,
  },

  // Development server configuration
  server: {
    port: 3000,
    strictPort: false,

    // Proxy API requests to Cloudflare Worker during development
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },

  // Preview server (for testing production builds locally)
  preview: {
    port: 4173,
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'frontend-src'),
      '@components': resolve(__dirname, 'frontend-src/components'),
      '@utils': resolve(__dirname, 'frontend-src/utils'),
      '@styles': resolve(__dirname, 'frontend-src/styles'),
      '@api': resolve(__dirname, 'frontend-src/api'),
    },
  },

  // CSS configuration
  css: {
    postcss: './postcss.config.js',

    // CSS modules configuration
    modules: {
      localsConvention: 'camelCase',
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [], // Add dependencies to pre-bundle
  },

  // Environment variables prefix
  envPrefix: 'VITE_',
});
