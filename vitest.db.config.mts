import { defineConfig, loadEnv } from 'vitest/config';
import path from 'node:path';

// Integration tests against a running local Supabase (`npx supabase start`).
export default defineConfig(({ mode }) => ({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['tests/db/**/*.test.ts'],
    env: loadEnv(mode, process.cwd(), ''),
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
}));
