import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts', '**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/tests/e2e/**', '**/.turbo/**'],
    testTimeout: 15000,
    hookTimeout: 15000,
    alias: {
      '@vynor/contracts': path.resolve(import.meta.dirname, './packages/contracts/src'),
      '@vynor/database': path.resolve(import.meta.dirname, './packages/database/src'),
      '@vynor/observability': path.resolve(import.meta.dirname, './packages/observability/src'),
      '@vynor/shared': path.resolve(import.meta.dirname, './packages/shared/src'),
      '@vynor/storage': path.resolve(import.meta.dirname, './packages/storage/src'),
      '@vynor/channel-adapters': path.resolve(
        import.meta.dirname,
        './packages/channel-adapters/src',
      ),
      '@vynor/ai': path.resolve(import.meta.dirname, './packages/ai/src'),
      '@': path.resolve(import.meta.dirname, './apps/web/src'),
    },
  },
});
