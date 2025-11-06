import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
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
        'migrations/**',
        'delete_deployments/**',
        'edit_agent_by_example/**',
      ],
    },
    // Timeout for long-running tests (AI API calls, etc.)
    testTimeout: 30000,
  },
});
