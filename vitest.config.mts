import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Coverage tracks the pure business-rule modules; UI and data access are covered by Playwright.
      include: ['src/lib/billing.ts', 'src/lib/csv.ts', 'src/lib/format.ts'],
      reporter: ['text', 'json-summary', 'lcov'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
