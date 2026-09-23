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
  /**
   * A recorded `/api/goal/clarify` response (`e2e/fixtures/onboarding`). When set, clarify answers with it and
   * `/api/goal/create` is recorded, then held open so generation never starts.
   */
  clarify?: unknown;
  /** With `clarify`: answer `/api/goal/create` with this JSON body (`{ goal, roadmapWeeks, dailyTasks }`) instead of holding it. */
  createResult?: unknown;
  /** `/api/goal/clarify` fails at the network level while the rest of the API stays up. */
  clarifyOffline?: boolean;
  /** With `clarify`: the first N clarify requests fail at the network level, then the backend "recovers". */
  clarifyFailures?: number;
  /** With `clarify`: the first clarify request answers with this status and `{ error }`, as the backend does on failure. */
  clarifyError?: { status: number; error: string };
  /** With `clarify`: milliseconds before each clarify response. */
  clarifyDelayMs?: number;
  /** `/api/health` answers 503, so the app starts believing Achivii is offline. */
  healthDown?: boolean;
  /**
   * With `clarify`: how the first create requests fail, in order. `offline` aborts at the network level; a string is
   * sent as the stream's `error` event. Later requests behave as `createResult` says.
   */
  createFailures?: Array<'offline' | string>;
  /**
   * With `clarify`: play this SSE sequence with `delayMs` between events. The page's fetch returns a timed stream, so
   * stages can render between events. A sequence with no `done` or `error` stays open. A step whose event type is
   * `end` closes the stream without a `done` or `error` (mock only; the server never sends it). Defaults
   * (`createResult`, `createFailures`, held-open create) are unchanged when this is omitted.
   */
  createStream?: GenerationStreamStep[];
  /**
   * With `createStream`: later create attempts, in order. The last sequence repeats. Omitted: every attempt replays
   * `createStream`.
   */
  createStreamNext?: GenerationStreamStep[][];
  /** Returned by `/api/goal/active` once a create request has been made (a plan the server finished). */
  goalAfterCreate?: Record<string, unknown>;
}

export interface GenerationStreamStep {
  delayMs: number;
  event: Record<string, unknown>;
}

export interface CreateRequest {
  headers: { 'content-type'?: string; accept?: string; authorization?: string };
  body: unknown;
}

export interface MockCalls {
  signup: number;
  login: number;
  clarify: unknown[];
  create: CreateRequest[];
  /** Every clarify request, including failed ones. */
  clarifyAttempts: number;
}

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Stands in for the backend auth rules (backend/src/routes/auth.ts) without touching the dev database. */
export async function mockApi(page: Page, options: MockOptions = {}): Promise<MockCalls> {
  const calls: MockCalls = { signup: 0, login: 0, clarify: [], create: [], clarifyAttempts: 0 };
  const {
    goal = null,
    signupStatus = 201,
    loginStatus = 200,
    offline = false,
    authDelayMs = 0,
    clarify,
    createResult,
    clarifyOffline = false,
    clarifyFailures = 0,
    clarifyError,
    clarifyDelayMs = 0,
    healthDown = false,
    createFailures = [],
    goalAfterCreate,
    createStream,
    createStreamNext = [],
  } = options;

  if (createStream) {
    await page.addInitScript((sequences: GenerationStreamStep[][]) => {
      let attempt = 0;
      const original = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (method === 'POST' && url.includes('/api/goal/create')) {
          const events = sequences[Math.min(attempt, sequences.length - 1)];
          attempt += 1;
          (window as Window & { __achiviiCreates?: number }).__achiviiCreates = attempt;
          const stream = new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();
              for (const step of events) {
                if (step.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, step.delayMs));
                if (step.event.type === 'end') {
                  controller.close();
                  return;
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(step.event)}\n\n`));
              }
              const terminal = events.some((step) => step.event.type === 'done' || step.event.type === 'error');
              if (terminal) controller.close();
            },
          });
          return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
        }
        return original(input, init as RequestInit);
      };
    }, [createStream, ...createStreamNext]);
  }

  await page.route(`${API}/api/**`, async (route) => {
    if (offline) return route.abort('connectionrefused');
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === '/api/health') {
      if (healthDown) return json(route, 503, { error: 'Service unavailable' });
      return json(route, 200, { status: 'ok', timestamp: '', service: 'achivii-api' });
    }

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
    if (path === '/api/goal/active') {
      return json(route, 200, { activeGoal: goalAfterCreate && calls.create.length > 0 ? goalAfterCreate : goal });
    }

    if (path === '/api/goal/clarify' && clarifyOffline) return route.abort('connectionrefused');
    if (path === '/api/goal/clarify' && clarify !== undefined) {
      calls.clarifyAttempts += 1;
      await wait(clarifyDelayMs);
      if (calls.clarifyAttempts <= clarifyFailures) return route.abort('connectionrefused');
      if (clarifyError && calls.clarifyAttempts === 1) return json(route, clarifyError.status, { error: clarifyError.error });
      calls.clarify.push(route.request().postDataJSON());
      return json(route, 200, clarify);
    }
    if (path === '/api/goal/create' && clarify !== undefined) {
      const failure = createFailures[calls.create.length];
      const request = route.request();
      const headers = request.headers();
      calls.create.push({
        headers: {
          'content-type': headers['content-type'],
          accept: headers['accept'],
          authorization: headers['authorization']?.replace(/^Bearer .+$/, 'Bearer <token>'),
        },
        body: request.postDataJSON(),
      });
      if (failure === 'offline') return route.abort('connectionrefused');
      if (failure !== undefined) {
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `data: ${JSON.stringify({ type: 'error', error: failure })}\n\n`,
        });
      }
      if (createResult !== undefined) return json(route, 200, createResult);
      return new Promise<void>(() => {});
    }

    // Otherwise onboarding's AI calls are held open so the screen stays in its loading state.
    if (path.startsWith('/api/goal/')) return new Promise<void>(() => {});

    return json(route, 404, { error: 'Not mocked' });
  });

  return calls;
}
