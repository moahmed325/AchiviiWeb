import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Plan safety limits M2.2b (RULE-7, PSL-18, PSL-11 Q13, AC-7) through the real review and close routes: a load goal's
// first week back reads the older weeks (one query) and is held to the newest week with done running. The real week
// call runs; only the model is replaced, on the in-memory store.

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./weekCloseStore.js')).db.prisma }));
vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { db } from './weekCloseStore.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';
import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import { weekLayout } from '../src/lib/ai/weekPlan.js';
import type { DetailedStep } from '../src/lib/ai/goalDecomposer.js';
import { PATHWAY_PROFILES } from '../src/lib/recovery/pathways.js';

const USER = { id: 'u1', email: 'u1@achivii.com', timezone: 'UTC' };
const START = new Date('2026-09-21T00:00:00Z'); // week 2 is Mon 2026-09-28 to Sun 2026-10-04; week 3 starts Mon 2026-10-05
const TARGET = new Date('2026-12-20T00:00:00Z');
const DAY = 86_400_000;
const target = { kind: 'number', metric: 'Minutes', value: 50, unit: 'min', direction: 'lower_is_better' };
const test = { type: 'run', instructions: 'Log the long run', passIf: 'done' };
const RUN_10K = { rawGoal: 'Run a 10K under 50 minutes', clarifiedOutcome: 'Finish a 10 km race in under 50:00' };
const SPANISH = { rawGoal: 'Learn Spanish', clarifiedOutcome: 'Hold a conversation' };

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
/** 08:00 UTC, `gap` days after week 3's planned start. */
const atGap = (gap: number) => `${addDays('2026-10-05', gap)}T08:00:00Z`;

const step = (title: string, priority: number, minutes: number, kind: string, extra: Partial<DetailedStep> = {}): DetailedStep => ({
  stepNumber: priority,
  title,
  durationMinutes: minutes,
  instructions: `Do ${title}.`,
  focusCue: '',
  pitfallToAvoid: '',
  priority,
  kind,
  ...extra,
});
const run = (minutes: number) => [step('Easy run', 1, minutes, 'easy_session', { load: { runMinutes: minutes, hardRun: false } }), step('Mobility', 2, 40 - minutes, 'strength_and_mobility', { load: {} })];

interface WeekRows {
  /** Each practice day's run minutes. */
  runMinutes: number;
  /** How many practice days, from the first, were done. */
  done: number;
}

/** Week 1 closed by review; week 2 open. Both weeks' practice days hold a run; `week1` / `week2` say how much was done. */
function seed(options: { goal?: Record<string, unknown>; week1?: WeekRows; week2?: WeekRows } = {}) {
  db.state.goals.push({
    id: 'g1',
    userId: USER.id,
    status: 'active',
    planVersion: 2,
    currentWeek: 2,
    ...RUN_10K,
    startDate: START,
    targetDate: TARGET,
    routine: JSON.stringify({ dailyMinutes: 40, planVariant: 'steady', sleepTime: '23:00', preferredSlot: 'evening' }),
    roadmap: {
      finalGoal: 'The goal',
      finalTest: '',
      startingPoint: {},
      method: { name: '80/20 Polarized Training', creator: '', rules: ['Keep 80% of running easy'] },
      phases: [
        { name: 'Base', purpose: 'Build.', startWeek: 1, endWeek: 2 },
        { name: 'Build', purpose: 'Grow.', startWeek: 3, endWeek: 12 },
      ],
      answers: [],
      recovery: PATHWAY_PROFILES.run10k,
    },
    movedDays: 0,
    closeTriedAt: null,
    closeTriedWeek: null,
    ...options.goal,
  });
  for (let weekNumber = 1; weekNumber <= 12; weekNumber++) {
    db.state.weeks.push({
      id: `w${weekNumber}`,
      goalId: 'g1',
      weekNumber,
      phase: weekNumber <= 2 ? 'Base' : 'Build',
      theme: `Theme ${weekNumber}`,
      target,
      test,
      status: weekNumber === 1 ? 'completed' : weekNumber === 2 ? 'active' : 'pending',
      testResult: null,
      executionScore: null,
      reviewNotes: null,
      closedBy: weekNumber === 1 ? 'review' : null,
      closedAt: null,
      breakDays: null,
    });
  }
  const rows = (weekNumber: number, spec: WeekRows) => {
    let practice = 0;
    weekLayout('steady', new Date(START.getTime() + (weekNumber - 1) * 7 * DAY)).forEach((day) => {
      const done = !day.isRestDay && practice++ < spec.done;
      db.state.tasks.push({
        id: `g1-d${(weekNumber - 1) * 7 + day.dayNumber}`,
        goalId: 'g1',
        weekNumber,
        dayNumber: (weekNumber - 1) * 7 + day.dayNumber,
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        title: day.isRestDay ? 'Rest' : 'Practice',
        isRestDay: day.isRestDay,
        isKeySession: false,
        isTestDay: day.isTestDay,
        status: done ? 'completed' : 'pending',
        usedMinimumVersion: false,
        notOffered: false,
        notes: null,
        durationMinutes: 40,
        detailedSteps: JSON.stringify(day.isRestDay ? [] : run(spec.runMinutes)),
        implementationIntention: '',
        whyToday: null,
        minimumVersion: null,
      });
    });
  };
  rows(1, options.week1 ?? { runMinutes: 30, done: 5 });
  rows(2, options.week2 ?? { runMinutes: 20, done: 3 });
}

function answerStep(title: string, priority: number, minutes: number, extra: Record<string, unknown> = {}) {
  return {
    title,
    instructions: `${title}: keep it relaxed and steady from the first minute to the last one.`,
    minutes,
    output: 'Distance and time written down',
    doneWhen: 'Done at the planned effort',
    focusCue: 'Relaxed shoulders',
    pitfall: 'Starting too fast',
    priority,
    highLoad: false,
    ...extra,
  };
}

/** A model answer: runs (minutes) on practice days 1-3 and 5, and `day6` minutes on day 6 (once the test day); 4 and 7 rest. */
function answer(runs: Partial<Record<1 | 2 | 3 | 5, number>>, day6: number) {
  const load = (minutes: number) => ({ load: { runMinutes: minutes, hardRun: false } });
  return {
    days: Array.from({ length: 7 }, (_, index) => {
      const dayNumber = index + 1;
      if (dayNumber === 4 || dayNumber === 7) return { dayNumber, isKeySession: false, title: 'Rest and recover', whyToday: 'Recovery.', steps: [] };
      const minutes = dayNumber === 6 ? day6 : runs[dayNumber as 1 | 2 | 3 | 5];
      const steps =
        minutes
            ? [answerStep(`Run ${dayNumber}`, 1, minutes, { kind: 'easy_session', highLoad: true, ...load(minutes) }), answerStep(`Calf and hip circuit ${dayNumber}`, 2, 40 - minutes, { kind: 'strength_and_mobility' })]
            : [answerStep(`Core circuit ${dayNumber}`, 1, 20, { kind: 'strength_and_mobility' }), answerStep(`Hip circuit ${dayNumber}`, 2, 20, { kind: 'strength_and_mobility' })];
      return { dayNumber, isKeySession: false, title: `Day ${dayNumber} session`, whyToday: 'Builds running.', steps, minimumVersion: { ...answerStep(`Short easy run ${dayNumber}`, 1, 10), load: { runMinutes: 10, hardRun: false } } };
    }),
  };
}
const modelSays = (data: unknown) => vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data } as never);

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/goal', goalRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Failed to bind');
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.mocked(getAuthUser).mockResolvedValue(USER as never);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  for (const name of ['MISSED_SESSIONS_CARRY_ENABLED', 'METHOD_RECOVERY_ENABLED']) vi.stubEnv(name, '');
  vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function post(path: string, at: string, body: unknown = {}) {
  vi.setSystemTime(new Date(at));
  const res = await fetch(`${baseUrl}/api/goal${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const closeWeek = (at: string, body: unknown = {}) => post('/close-week', at, body);
const reviewWeek2 = (at: string) => post('/weeks/2/review', at, { reflection: 'Back now' });
const safetyLines = () =>
  warn.mock.calls.filter((call: unknown[]) => call[0] === '[Safety]').map((call: unknown[]) => JSON.parse(call[1] as string) as Record<string, unknown>);
const olderReads = () => vi.mocked(db.prisma.dailyTask.findMany).mock.calls.filter(([args]: any[]) => typeof args?.where?.weekNumber === 'object');
const prompts = () => vi.mocked(generateStructuredContent).mock.calls.map((call) => String(call[0]));
const nothingSaved = () => {
  expect(db.week(2)).toMatchObject({ status: 'active', closedBy: null });
  expect(db.tasksOf(3)).toEqual([]);
  expect(db.state.reviews).toEqual([]);
  expect(db.goal()).toMatchObject({ currentWeek: 2, movedDays: 0, startDate: START });
};

describe('AC-7: the first week back is held to the last done running total', () => {
  it.each([
    ['the automatic close', () => closeWeek(atGap(10))],
    ['the review', () => reviewWeek2(atGap(10))],
  ])('%s: over the total is refused once, retried, and given no week (503, nothing saved)', async (_name, close) => {
    seed();
    // Week 2 ran 60 (3 done runs of 20); 70 is over it (the ordinary base would allow 70).
    modelSays(answer({ 1: 15, 2: 15, 3: 15 }, 25));
    const res = await close();
    expect(res.status).toBe(503);
    expect(generateStructuredContent).toHaveBeenCalledTimes(2);
    expect(prompts()[0]).toContain('- Running: first week back; at most 60 minutes in total, what they last completed (week 2).');
    expect(prompts()[1]).toContain("This week's running is 70 minutes; the most allowed is 60 minutes (what they last did, week 2).");
    expect(safetyLines().map((line) => [line.goalId, line.rule, line.outcome])).toEqual([
      ['g1', 'first_week_back_base', 'logged'],
      ['g1', 'running_total_over_limit', 'retry'],
      ['g1', 'running_total_over_limit', 'failed'],
    ]);
    expect(olderReads()).toHaveLength(1);
    nothingSaved();
  });

  it.each([
    ['the automatic close', () => closeWeek(atGap(10))],
    ['the review', () => reviewWeek2(atGap(10))],
  ])('%s: at the total it passes and the week is saved', async (_name, close) => {
    seed();
    modelSays(answer({ 1: 15, 2: 15, 3: 15 }, 15));
    expect((await close()).status).toBe(200);
    expect(db.goal().currentWeek).toBe(3);
    expect(db.tasksOf(3).length).toBe(7);
    expect(safetyLines()).toEqual([{ goalId: 'g1', week: 3, rule: 'first_week_back_base', step: 'This week', matched: 'week 2 total 60 minutes, share 100, limit 60 minutes', value: 60, limit: 60, outcome: 'logged' }]);
  });

  it('a closing week with no done running reads week 1 (one query, weeks before the closing week)', async () => {
    seed({ week2: { runMinutes: 20, done: 0 } });
    // 150 is week 1's done total: at the limit, so the week is written.
    modelSays(answer({ 1: 30, 2: 30, 3: 30, 5: 30 }, 30));
    expect((await closeWeek(atGap(10))).status).toBe(200);
    expect(safetyLines()[0]).toMatchObject({ rule: 'first_week_back_base', matched: 'week 1 total 150 minutes, share 100, limit 150 minutes' });
    expect(olderReads().map(([args]: any[]) => args.where)).toEqual([{ goalId: 'g1', weekNumber: { lt: 2 } }]);
  });

  it('a failed read of the older weeks fails the close: nothing saved, no model call', async () => {
    seed();
    const read = vi.mocked(db.prisma.dailyTask.findMany).getMockImplementation()!;
    vi.mocked(db.prisma.dailyTask.findMany).mockImplementation(async (args: any) => {
      if (typeof args?.where?.weekNumber === 'object') throw new Error('read failed');
      return read(args);
    });
    try {
      modelSays(answer({ 1: 15, 2: 15, 3: 15 }, 15));
      // Like any other read in the route: its catch answers 500.
      expect((await closeWeek(atGap(10))).status).toBe(500);
      expect(generateStructuredContent).not.toHaveBeenCalled();
      nothingSaved();
    } finally {
      vi.mocked(db.prisma.dailyTask.findMany).mockImplementation(read);
    }
  });
});

describe('a long break and the jump past the limit', () => {
  it('keep going: the week written is the first week back, the walk starts from the closing week, and the share is half', async () => {
    seed();
    // A 40-day gap: past the 28-day room by 12, so the person chooses.
    modelSays(answer({ 1: 10, 2: 10 }, 10));
    const first = await closeWeek(atGap(40));
    expect(first).toMatchObject({ status: 409, body: { reason: 'choice_needed', choice: 'keep_going' } });
    expect((await closeWeek(atGap(40), { choice: 'keep_going' })).status).toBe(200);
    const weekBack = db.goal().currentWeek;
    expect(weekBack).toBeGreaterThan(3);
    expect(safetyLines()).toEqual([
      { goalId: 'g1', week: weekBack, rule: 'first_week_back_base', step: 'This week', matched: 'week 2 total 60 minutes, share 50, limit 30 minutes', value: 60, limit: 30, outcome: 'logged' },
    ]);
    expect(prompts()[0]).toContain('- Running: first week back after a long break; at most 30 minutes in total, half of what they last completed (week 2).');
    expect(olderReads().map(([args]: any[]) => args.where)).toEqual([{ goalId: 'g1', weekNumber: { lt: 2 } }]);
  });
});

describe('not a break, or not a load goal: exactly as before', () => {
  it('a close that is not a break: the closing week is the base, no older-weeks read, nothing new logged', async () => {
    seed();
    // Week 2 planned 100 (5 runs of 20), done 60: 60% of planned, so the base is the done 60 plus 10 minutes.
    modelSays(answer({ 1: 15, 2: 15, 3: 15 }, 25));
    expect((await closeWeek(atGap(3))).status).toBe(200);
    expect(olderReads()).toEqual([]);
    expect(safetyLines()).toEqual([]);
    expect(prompts()[0]).toContain('- Running: at most 70 minutes this week in all (last week 60 minutes).');
    expect(prompts()[0]).not.toContain('first week back;');
  });

  it('a goal that is not a load goal, after a break: no older-weeks read, no running line', async () => {
    seed({ goal: { ...SPANISH, roadmap: { ...db_roadmap(), recovery: undefined } } });
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: false, error: 'stop' } as never);
    await closeWeek(atGap(10));
    expect(generateStructuredContent).toHaveBeenCalled();
    expect(prompts()[0]).toContain('FIRST WEEK BACK');
    expect(olderReads()).toEqual([]);
    expect(prompts()[0]).not.toContain('SAFETY LIMITS');
    expect(safetyLines()).toEqual([]);
  });
});

function db_roadmap() {
  return {
    finalGoal: 'The goal',
    finalTest: '',
    startingPoint: {},
    method: { name: 'Method', creator: '', rules: ['One step at a time'] },
    phases: [
      { name: 'Base', purpose: 'Build.', startWeek: 1, endWeek: 2 },
      { name: 'Build', purpose: 'Grow.', startWeek: 3, endWeek: 12 },
    ],
    answers: [],
  };
}
