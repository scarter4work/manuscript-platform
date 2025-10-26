import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          // Miniflare options
          compatibilityDate: '2024-01-01',
          compatibilityFlags: ['nodejs_compat'],
        },
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'test/**',
        '**/*.test.js',
        '**/*.spec.js',
        'frontend/**',
        'test-*.js',
        'create-*.js',
      ],
    },
  },
});
