import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.test.js',
        '**/*.spec.js',
        'frontend/**',
        'test-*.js',
        'create-*.js',
        'migrations/**',
        'delete_deployments/**',
        'edit_agent_by_example/**',
        'dist/**',
        '**/*.config.js',
      ],
      // Target 80% branch coverage
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Global test setup file
    setupFiles: ['./tests/setup.js'],
    // Timeout for long-running tests (AI API calls, database operations, etc.)
    testTimeout: 30000,
    // Test file patterns
    include: [
      'tests/**/*.test.js',
      'tests/**/*.spec.js',
    ],
  },
});
