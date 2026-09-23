import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests. `e2e/*.spec.ts` mock the API and run anywhere. `e2e/live/*.spec.ts` talk to the real backend on
 * :5000, create accounts, and only run when LIVE_API=1.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: process.env.LIVE_API ? [] : ['live/**'],
  // One worker: parallel workers saturate the Vite dev server here and requests stall past the test timeout.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    // Full Chromium in new headless mode, closer to a real browser than the headless shell.
    channel: 'chromium',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
