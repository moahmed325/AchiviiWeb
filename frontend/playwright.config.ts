import { defineConfig, devices } from '@playwright/test';

/**
 * The e2e server's port. Set E2E_PORT when another checkout's tests already use 5174: the server is never reused, so a
 * busy port fails loudly instead of silently testing someone else's code.
 */
const PORT = Number(process.env.E2E_PORT) || 5174;

/**
 * Browser tests. `e2e/*.spec.ts` mock the API and run anywhere. `e2e/live/*.spec.ts` talk to the real backend on
 * :5000, create accounts, and only run when LIVE_API=1.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: process.env.LIVE_API ? [] : ['live/**'],
  // One worker: parallel workers saturate the Vite dev server here and requests stall past the test timeout.
  workers: 1,
  // CI also writes the HTML report, which the e2e job uploads when it fails.
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
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
  // server: not one started with the real .env, and not another checkout's e2e server. Nothing listens on the Supabase URL: e2e/mockApi.ts answers it, and
  // `signIn` writes a session for it. Variables already in the environment override Vite's .env files.
  webServer: {
    // npm exec finds Vite whether the install put it in frontend/node_modules or the workspace root.
    command: `npm exec --no -- vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
      VITE_API_BASE_URL: 'http://localhost:5000',
    },
  },
});
