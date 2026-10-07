import type { Page, Route } from '@playwright/test';

export const API = 'http://localhost:5000';

const USER = { id: 'u-e2e', email: 'e2e@example.com', created_at: '2026-09-23T00:00:00.000Z' };

/**
 * The Supabase project the e2e dev server is built with (playwright.config.ts `webServer.env`). Nothing listens
 * there: `mockApi` answers its auth requests, and `signIn` writes a session where supabase-js looks for it
 * (`sb-<first label of the host>-auth-token`).
 */
export const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_STORAGE_KEY = 'sb-localhost-auth-token';

const SUPABASE_USER = {
  id: USER.id,
  aud: 'authenticated',
  role: 'authenticated',
  email: USER.email,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: USER.created_at,
};

/** A session as Supabase returns and stores it. The token is JWT-shaped but unsigned; nothing here verifies it. */
function supabaseSession() {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiresAt = 4102444800; // 2100-01-01: never expires during a run.
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: USER.id, role: 'authenticated', exp: expiresAt })}.e2e`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: 'e2e-refresh-token',
    user: SUPABASE_USER,
  };
}

/** Signs the visitor in before the page loads, as a returning user whose Supabase session is still stored. */
export const signIn = (page: Page) =>
  page.addInitScript(
    ([key, session]) => localStorage.setItem(key, session),
    [SUPABASE_STORAGE_KEY, JSON.stringify(supabaseSession())] as const,
  );

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
  /** `GET /api/goal/active` answers with this status and `{ error }`, so the goal load fails (`goalLoadFailed`). */
  activeStatus?: number;
  /** `DELETE /api/goal/active` (Reset 90-Day Plan) answers with this status. 200 by default. */
  resetStatus?: number;
  /**
   * `PATCH /api/goal/tasks/:id` answers with this status and `{ error }` instead of saving. When it saves, the task in
   * the mocked goal changes as the backend changes it, so a reload returns what was saved.
   */
  taskUpdateStatus?: number;
  /**
   * The body `POST /api/goal/reconcile` answers with (missed sessions, ND-6). Default `{ applies: false }`, as the
   * backend answers without a plan v2 goal, so no spec depends on a failing or held request.
   */
  reconcile?: Record<string, unknown>;
  /**
   * The plan `GET /api/billing/entitlement` reports. `pro` by default, so specs written before the custom-goal gate
   * (ND-10) still reach the custom goal field; `free` shows the Pro gate instead.
   */
  plan?: 'free' | 'pro';
  /** With `clarify`: `/api/goal/create` refuses with the server's 403 for a custom goal without Pro. */
  createProRequired?: boolean;
  /**
   * How the three plan actions answer (missed sessions M3.3): `POST /api/goal/tasks/:id/mark-missed`, `/swap` and
   * `/carry-now`. Each defaults to 409 `carry_disabled`, as the backend answers while MISSED_SESSIONS_CARRY_ENABLED is
   * off, so specs written before M3.3 are unchanged.
   */
  markMissed?: PlanActionAnswer;
  swap?: PlanActionAnswer;
  carryNow?: PlanActionAnswer;
  /**
   * `PUT /api/goal/weeks/:weekNumber/test-result` (missed sessions M4.1) answers with this status and `{ error }`
   * instead of saving. When it saves, the week in the mocked goal gets the result, so a reload returns it; a completed
   * week answers 409 `week_closed`, as the backend does.
   */
  testResultStatus?: number;
}

/**
 * A plan action's answer: the reconcile body on 200, or `{ error, reason }` on a refusal. With `goal`, a 200 also
 * replaces the mocked goal, so the reload after it returns the plan as the backend changed it.
 */
export interface PlanActionAnswer {
  status?: number;
  body?: unknown;
  goal?: Record<string, unknown>;
}

const CARRY_DISABLED: PlanActionAnswer = { status: 409, body: { error: 'This action is not available yet.', reason: 'carry_disabled' } };

export interface TaskUpdate {
  taskId: string;
  body: { status?: string; notes?: string | null; slotTime?: string };
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
  /** GET /api/goal/active, including the check before a create. */
  active: number;
  /** DELETE /api/goal/active. */
  resets: number;
  /** Every PATCH /api/goal/tasks/:id body, including failed ones. */
  taskUpdates: TaskUpdate[];
  /** Every plan action request (M3.3), including refused ones. */
  planActions: Array<{ action: 'mark-missed' | 'swap' | 'carry-now'; taskId: string; body: unknown }>;
  /** Every PUT /api/goal/weeks/:weekNumber/test-result request, including failed ones. */
  testResults: Array<{ weekNumber: number; body: unknown }>;
}

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Stands in for the backend and Supabase Auth without touching any real service or database. */
export async function mockApi(page: Page, options: MockOptions = {}): Promise<MockCalls> {
  const calls: MockCalls = { signup: 0, login: 0, clarify: [], create: [], clarifyAttempts: 0, active: 0, resets: 0, taskUpdates: [], planActions: [], testResults: [] };
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
    activeStatus,
    resetStatus = 200,
    taskUpdateStatus,
    reconcile = { applies: false, reason: 'not_plan_v2' },
    plan = 'pro',
    createProRequired = false,
    markMissed = CARRY_DISABLED,
    swap = CARRY_DISABLED,
    carryNow = CARRY_DISABLED,
    testResultStatus,
  } = options;
  // The goal as the "server" holds it: task writes change this copy, never the caller's fixture.
  let saved = goal ? (structuredClone(goal) as Record<string, unknown> & { dailyTasks?: unknown[] }) : null;

  // Supabase Auth (supabase-js against SUPABASE_URL): sign-in, sign-up and sign-out, with Supabase's own error shapes.
  await page.route(`${SUPABASE_URL}/auth/v1/**`, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/auth/v1', '');
    const authError = (status: number, code: string, msg: string) => json(route, status, { code: status, error_code: code, msg });

    if (path === '/token' && url.searchParams.get('grant_type') === 'password') {
      calls.login += 1;
      await wait(authDelayMs);
      if (loginStatus === 401) return authError(400, 'invalid_credentials', 'Invalid login credentials');
      if (loginStatus >= 500) return authError(loginStatus, 'unexpected_failure', 'Internal server error');
      return json(route, 200, supabaseSession());
    }
    if (path === '/signup') {
      calls.signup += 1;
      await wait(authDelayMs);
      if (signupStatus === 409) return authError(422, 'user_already_exists', 'User already registered');
      if (signupStatus >= 500) return authError(signupStatus, 'unexpected_failure', 'Database error saving new user');
      return json(route, 200, supabaseSession());
    }
    if (path === '/logout') return route.fulfill({ status: 204 });
    if (path === '/user') return json(route, 200, SUPABASE_USER);
    return authError(404, 'not_found', `No e2e mock for ${path}`);
  });

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

    if (path === '/api/auth/me') return json(route, 200, { user: USER });
    if (path === '/api/billing/entitlement') return json(route, 200, { plan, entitled: plan === 'pro' });
    if (path === '/api/goal/active' && route.request().method() === 'DELETE') {
      calls.resets += 1;
      if (resetStatus >= 400) return json(route, resetStatus, { error: 'Failed to reset goal' });
      return json(route, 200, { success: true });
    }
    if (path === '/api/goal/active') {
      calls.active += 1;
      if (activeStatus) return json(route, activeStatus, { error: 'Failed to fetch active goal' });
      return json(route, 200, { activeGoal: goalAfterCreate && calls.create.length > 0 ? goalAfterCreate : saved });
    }

    if (path === '/api/goal/reconcile' && route.request().method() === 'POST') return json(route, 200, reconcile);

    const actionMatch = path.match(/^\/api\/goal\/tasks\/([^/]+)\/(mark-missed|swap|carry-now)$/);
    if (actionMatch && route.request().method() === 'POST') {
      const action = actionMatch[2] as 'mark-missed' | 'swap' | 'carry-now';
      calls.planActions.push({ action, taskId: actionMatch[1], body: route.request().postDataJSON() ?? null });
      const answer = action === 'mark-missed' ? markMissed : action === 'swap' ? swap : carryNow;
      const status = answer.status ?? 200;
      if (status === 200 && answer.goal) saved = structuredClone(answer.goal) as typeof saved;
      return json(route, status, answer.body ?? {});
    }

    const testResultMatch = path.match(/^\/api\/goal\/weeks\/(\d+)\/test-result$/);
    if (testResultMatch && route.request().method() === 'PUT') {
      const weekNumber = Number(testResultMatch[1]);
      const body = route.request().postDataJSON();
      calls.testResults.push({ weekNumber, body });
      if (testResultStatus) return json(route, testResultStatus, { error: 'Failed to save the test result.' });
      const weeks = (saved?.roadmapWeeks ?? []) as Array<Record<string, unknown>>;
      const week = weeks.find((w) => w.weekNumber === weekNumber);
      if (!week) return json(route, 404, { error: 'Week not found.' });
      if (week.status === 'completed') return json(route, 409, { error: 'This week has already been reviewed.', reason: 'week_closed' });
      week.testResult = body;
      return json(route, 200, { testResult: body });
    }

    const taskMatch = path.match(/^\/api\/goal\/tasks\/([^/]+)$/);
    if (taskMatch && route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as TaskUpdate['body'];
      calls.taskUpdates.push({ taskId: taskMatch[1], body });
      if (taskUpdateStatus) return json(route, taskUpdateStatus, { error: 'Failed to update task.' });
      const tasks = (saved?.dailyTasks ?? []) as Array<Record<string, unknown>>;
      const task = tasks.find((t) => t.id === taskMatch[1]);
      if (!task) return json(route, 404, { error: 'Task not found.' });
      // As backend/src/routes/goal.ts PATCH /tasks/:taskId: status when given, completedAt with it, notes when present.
      if (body.status) task.status = body.status;
      if (body.status === 'completed') task.completedAt = new Date().toISOString();
      if (body.status === 'pending') task.completedAt = null;
      if (body.notes !== undefined) task.notes = body.notes;
      if (body.slotTime !== undefined) task.slotTime = body.slotTime;
      return json(route, 200, { task });
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
      // As backend/src/routes/goal.ts answers before any plan work (authorizeNewCustomGoal).
      if (createProRequired) {
        return json(route, 403, { error: 'Custom Goals require Achivii Pro.', code: 'CUSTOM_GOAL_REQUIRES_PRO' });
      }
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
