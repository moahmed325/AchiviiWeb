import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      GEMINI_API_KEY: '',
      GROQ_API_KEY: '',
    },
    testTimeout: 10000,
  },
});
