import { availableParallelism } from 'node:os';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Vitest's default is one worker per core minus one. On a many-core machine that is 20+
// jsdom workers at once, and they slow each other down until the heavier UI tests pass
// the 5-second timeout (B-36). Six is just as fast there and keeps every test well under
// it; smaller machines such as the CI runners keep Vitest's own default.
const maxWorkers = Math.min(6, Math.max(1, availableParallelism() - 1));

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      maxWorkers,
    },
  }),
);
