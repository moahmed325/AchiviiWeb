import type { Page, Route } from '@playwright/test';

export const API = 'http://localhost:5000';

const USER = { id: 'u-e2e', email: 'e2e@example.com', created_at: '2026-09-23T00:00:00.000Z' };

export interface MockOptions {
  /** The active goal returned after sign-in; null means the user has none. */
  goal?: Record<string, unknown> | null;
  signupStatus?: number;
  loginStatus?: number;
  /** Every API request fails at the network level, as if the backend were stopped. */
  offline?: boolean;
  /** Milliseconds before auth responses arrive, to observe the loading state. */
  authDelayMs?: number;
}

export interface MockCalls {
  signup: number;
  login: number;
}

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Stands in for the backend auth rules (backend/src/routes/auth.ts) without touching the dev database. */
export async function mockApi(page: Page, options: MockOptions = {}): Promise<MockCalls> {
  const calls: MockCalls = { signup: 0, login: 0 };
  const { goal = null, signupStatus = 201, loginStatus = 200, offline = false, authDelayMs = 0 } = options;

  await page.route(`${API}/api/**`, async (route) => {
    if (offline) return route.abort('connectionrefused');
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === '/api/health') return json(route, 200, { status: 'ok', timestamp: '', service: 'achivii-api' });

    if (path === '/api/auth/signup') {
      calls.signup += 1;
      await wait(authDelayMs);
      if (signupStatus === 409) return json(route, 409, { error: 'An account with this email already exists.' });
      if (signupStatus >= 500) return json(route, signupStatus, { error: 'Internal server error during registration.' });
      return json(route, 201, { message: 'ok', token: 'e2e-token', user: USER });
    }

    if (path === '/api/auth/login') {
      calls.login += 1;
      await wait(authDelayMs);
      if (loginStatus === 401) return json(route, 401, { error: 'Invalid email or password.' });
      if (loginStatus >= 500) return json(route, loginStatus, { error: 'Internal server error.' });
      return json(route, 200, { message: 'ok', token: 'e2e-token', user: USER });
    }

    if (path === '/api/auth/me') return json(route, 200, { user: USER });
    if (path === '/api/goal/active') return json(route, 200, { activeGoal: goal });

    // Onboarding's AI calls are out of scope here: hold them open so the screen stays in its loading state.
    if (path.startsWith('/api/goal/')) return new Promise<void>(() => {});

    return json(route, 404, { error: 'Not mocked' });
  });

  return calls;
}
