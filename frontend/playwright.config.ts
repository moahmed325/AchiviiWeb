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
    baseURL: 'http://localhost:5174',
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
  // Its own port and a fake Supabase project, so the tests never sign in to a real service and never reuse a dev
  // server started with the real .env. Nothing listens on the Supabase URL: e2e/mockApi.ts answers it, and
  // `signIn` writes a session for it. Variables already in the environment override Vite's .env files.
  webServer: {
    // npm exec finds Vite whether the install put it in frontend/node_modules or the workspace root.
    command: 'npm exec --no -- vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
      VITE_API_BASE_URL: 'http://localhost:5000',
    },
  },
});
