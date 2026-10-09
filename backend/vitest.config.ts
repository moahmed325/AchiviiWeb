import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      GEMINI_API_KEY: '',
    },
    testTimeout: 10000,
    // `dist/` holds compiled copies of some tests from old builds; run only the TypeScript sources.
    exclude: ['**/node_modules/**', 'dist/**'],
  },
});
