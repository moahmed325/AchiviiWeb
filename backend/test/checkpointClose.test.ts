import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Checkpoints M1 (RULE-1, RULE-2, RULE-8, RULE-9, RULE-11 to RULE-13, section 7, AC-1, AC-2, AC-6 to AC-10): the check in
// the week close, the expiry, POST /api/goal/checkpoint, the goal response's `checkpoint` and `dayNinetyLine`, and the
// day-90 line in both prompts. Prisma is the in-memory store in weekCloseStore.ts, so the real close, weekly update and
// week writer run; only the two model calls are replaced (the update's answer is the plain fallback: targets as planned).

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./weekCloseStore.js')).db.prisma }));
vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn(),
}));
vi.mock('../src/lib/ai/gemini.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/gemini.js')>()),
  generateStructuredContent: vi.fn(),
}));

import { db } from './weekCloseStore.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';
import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import { buildWeekPrompt, generateWeekPlan, weekLayout, type WeekCallInput, type WeekDayPlan } from '../src/lib/ai/weekPlan.js';
import { buildWeeklyUpdatePrompt } from '../src/lib/ai/weeklyUpdate.js';
import { keyMilestoneText, formatTarget, type WeekTarget } from '../src/lib/ai/roadmap.js';
import { RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';
import { checkpointsAtClose } from '../src/lib/weekClose/checkpointClose.js';
import type { StoredCheckpoint } from '../src/lib/weekClose/checkpoint.js';

const USER = { id: 'u1', email: 'u1@achivii.com', timezone: 'UTC' };
const START = new Date('2026-09-21T00:00:00Z'); // a Monday
const SWITCHES = ['WEEK_CLOSE_ENABLED', 'WEEKLY_UPDATE_ENABLED', 'METHOD_RECOVERY_ENABLED'] as const;
const DAY = 86_400_000;
const PLAN = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DAY90_PROMPT_LINE = 'Day-90 target: 6 km (their goal: 10 km); aim the plan at the day-90 target.';

const km = (value: number): WeekTarget => ({ kind: 'number', metric: 'Weekly running distance', value, unit: 'km', direction: 'higher_is_better' });
const runTest = (target: WeekTarget, light = false) =>
  light ? { type: 'run', instructions: 'Log the long run', passIf: 'Done as written', light: true } : { type: 'run', instructions: 'Run the weekly distance', passIf: formatTarget(target) };
const weekStart = (n: number) => new Date(START.getTime() + (n - 1) * 7 * DAY);

function dayPlans(start: Date): WeekDayPlan[] {
  return weekLayout('steady', start).map((day) => ({
    ...day,
    title: `Session ${day.date}`,
    durationMinutes: day.isRestDay ? 0 : 30,
    slotTime: '19:30',
    implementationIntention: '',
    detailedSteps: day.isRestDay ? [] : [{ stepNumber: 1, title: `Run ${day.date}`, durationMinutes: 30, instructions: 'Run easy.', focusCue: '', pitfallToAvoid: '', priority: 1 }],
    isKeySession: false,
    whyToday: '',
    minimumVersion: null,
  }));
}

interface SeedOptions {
  targets?: WeekTarget[];
  light?: (week: number) => boolean;
  startingPoint?: Record<string, unknown>;
  checkpoints?: StoredCheckpoint[];
}

/** A running goal on week `n` (start 0 km, week 4 at 2 km, week 12 at 10 km), the weeks before closed on plan. */
function seed(n: number, options: SeedOptions = {}) {
  const targets = options.targets ?? PLAN.map(km);
  db.state.goals.push({
    id: 'g1',
    userId: USER.id,
    status: 'active',
    planVersion: 2,
    currentWeek: n,
    rawGoal: 'Build my weekly running distance to 10 km',
    clarifiedOutcome: null,
    startDate: START,
    targetDate: new Date(START.getTime() + 84 * DAY),
    routine: JSON.stringify({ dailyMinutes: 30, planVariant: 'steady', sleepTime: '23:00', preferredSlot: 'evening' }),
    roadmap: {
      finalGoal: 'Run 10 km a week',
      finalTest: 'Run the weekly distance',
      startingPoint: options.startingPoint ?? { value: 0, unit: 'km' },
      method: { name: 'Ten percent rule', creator: '', rules: ['Add at most 10% a week'] },
      phases: [{ name: 'Base', purpose: 'Build.' }],
      answers: [],
      recovery: RECOVERY_TEMPLATES.language,
      ...(options.checkpoints ? { checkpoints: options.checkpoints } : {}),
    },
    movedDays: 0,
    closeTriedAt: null,
    closeTriedWeek: null,
  });
  targets.forEach((target, i) => {
    const weekNumber = i + 1;
    const test = runTest(target, options.light?.(weekNumber));
    db.state.weeks.push({
      id: `w${weekNumber}`,
      goalId: 'g1',
      weekNumber,
      phase: 'Base',
      theme: `Theme ${weekNumber}`,
      objective: formatTarget(target),
      keyMilestone: keyMilestoneText(test as never),
      target,
      test,
      status: weekNumber < n ? 'completed' : weekNumber === n ? 'active' : 'pending',
      testResult: weekNumber < n && target.kind === 'number' && !options.light?.(weekNumber) ? { value: target.value, unit: 'km', passed: true } : null,
      executionScore: null,
      reviewNotes: null,
      closedBy: weekNumber < n ? 'review' : null,
      closedAt: null,
      updateStatus: weekNumber < n ? 'on_track' : null,
      jumped: false,
    });
  });
  addWeekTasks(n);
  atWeekEnd(n);
}

function addWeekTasks(n: number) {
  dayPlans(weekStart(n)).forEach((day) => {
    db.state.tasks.push({
      id: `w${n}d${day.dayNumber}`,
      goalId: 'g1',
      weekNumber: n,
      dayNumber: (n - 1) * 7 + day.dayNumber,
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      title: day.title,
      isRestDay: day.isRestDay,
      isKeySession: false,
      isTestDay: day.isTestDay,
      status: day.isRestDay ? 'pending' : 'completed',
      usedMinimumVersion: false,
      notOffered: false,
      notes: null,
      durationMinutes: day.durationMinutes,
      detailedSteps: JSON.stringify(day.detailedSteps),
    });
  });
}

/** On time: the afternoon of the week's last day. */
const atWeekEnd = (n: number) => vi.setSystemTime(new Date(weekStart(n).getTime() + 6 * DAY + 15 * 3_600_000));
/** The next day at noon: the week's close is due. */
const dayAfter = (n: number, late = 0) => vi.setSystemTime(new Date(weekStart(n).getTime() + (7 + late) * DAY + 12 * 3_600_000));

const noAnswer = { success: false, isFallback: true, data: null, error: 'GEMINI_API_KEY produced no result' };

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

const switchesOn = () => {
  vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
  vi.stubEnv('WEEKLY_UPDATE_ENABLED', 'true');
};

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.mocked(getAuthUser).mockResolvedValue(USER as never);
  vi.mocked(generateWeekPlan).mockImplementation(async (input) => dayPlans(input.weekStart));
  vi.mocked(generateStructuredContent).mockResolvedValue(noAnswer as never);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const name of SWITCHES) vi.stubEnv(name, '');
  switchesOn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const post = async (path: string, body: unknown) => {
  const res = await fetch(`${baseUrl}/api/goal${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};
const review = (n: number, testResult: unknown = { value: 1.2, unit: 'km', passed: false }) => post(`/weeks/${n}/review`, { reflection: '', ...(testResult ? { testResult } : {}) });
const answer = (week: unknown, value: unknown) => post('/checkpoint', { week, answer: value });
const active = async () => (await (await fetch(`${baseUrl}/api/goal/active`, { headers: { Authorization: 'Bearer t' } })).json()).activeGoal;
const lines = () => vi.mocked(console.log).mock.calls.map((args) => String(args[0])).filter((line) => line.startsWith('[Checkpoint]'));
const values = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => db.week(from + i).target.value as number);
const checkpoints = () => db.goal().roadmap.checkpoints as StoredCheckpoint[] | undefined;
const skipLine = (week: number, reason: string) => `[Checkpoint] goal g1 week ${week} result none planned none forecast none share none outcome none reason ${reason}`;

const OFFER: StoredCheckpoint = { week: 4, kind: 'lower', result: 1.2, planned: 2, forecast: 6, target: 10, fullGoal: 10, offered: 6, answer: null, by: null, answeredAt: null };

describe('the check in the close (RULE-2, RULE-13, AC-2, AC-3)', () => {
  it('a review of week 4 clearly behind stores a lower offer and logs it', async () => {
    seed(4);
    expect((await review(4)).status).toBe(200);
    expect(checkpoints()).toEqual([OFFER]);
    expect(lines()).toEqual(['[Checkpoint] goal g1 week 4 result 1.2 planned 2 forecast 6 share 0.6 outcome lower reason none']);
    // No target changes until the person answers.
    expect(values(5, 12)).toEqual(PLAN.slice(4));
  });

  it('on track stores nothing and only logs', async () => {
    seed(4);
    expect((await review(4, { value: 2, unit: 'km', passed: true })).status).toBe(200);
    expect(checkpoints()).toBeUndefined();
    expect(lines()).toEqual(['[Checkpoint] goal g1 week 4 result 2 planned 2 forecast 10 share 1 outcome on_track reason none']);
  });

  it('the automatic close runs it too, from the result logged in the week', async () => {
    seed(4);
    db.week(4).testResult = { value: 1.2, unit: 'km', passed: false };
    dayAfter(4);
    const res = await post('/close-week', {});
    expect(res.body).toMatchObject({ due: true, closedBy: 'auto' });
    expect(checkpoints()).toEqual([OFFER]);
  });

  it('a result at or behind the starting point stores a line-only offer', async () => {
    seed(4, { startingPoint: { value: 1.5, unit: 'km' } });
    expect((await review(4, { value: 1, unit: 'km', passed: false })).status).toBe(200);
    expect(checkpoints()).toEqual([{ ...OFFER, kind: 'line_only', result: 1, offered: null, forecast: expect.any(Number) }]);
  });

  it('only weeks 4 and 8', async () => {
    seed(3);
    expect((await review(3)).status).toBe(200);
    expect(checkpoints()).toBeUndefined();
    expect(lines()).toEqual([]);
  });

  it.each([
    ['not_logged', {}, null],
    ['unit', {}, { value: 1.2, unit: 'mi', passed: false }],
    ['light_test', { light: (week: number) => week === 4 }, { value: 'Done', passed: true }],
    ['no_start', { startingPoint: {} }, { value: 1.2, unit: 'km', passed: false }],
    ['deliverable', { targets: PLAN.map((_, i) => ({ kind: 'deliverable', description: `Chapter ${i + 1} drafted` }) as WeekTarget) }, { value: 'Done', passed: true }],
  ] as const)('none when %s, logged with its reason', async (reason, options, result) => {
    seed(4, options as SeedOptions);
    expect((await review(4, result)).status).toBe(200);
    expect(checkpoints()).toBeUndefined();
    expect(lines()).toEqual([skipLine(4, reason)]);
  });

  it('none when the close is a break', async () => {
    seed(4);
    dayAfter(4, 8);
    expect((await review(4)).status).toBe(200);
    expect(checkpoints()).toBeUndefined();
    expect(lines()).toEqual([skipLine(4, 'break')]);
  });

  it('a jumped week 4 or 8 logs none with reason jumped', () => {
    seed(3);
    const goal = { ...db.goal(), roadmapWeeks: db.state.weeks, dailyTasks: db.tasksOf(3) } as never;
    expect(checkpointsAtClose(goal, 3, { testResult: null, move: { weekBack: 9, breakDays: 40 } as never, update: null }).map((item) => item.line)).toEqual([
      skipLine(4, 'jumped'),
      skipLine(8, 'jumped'),
    ]);
  });

  it('a lost close race stores nothing and logs nothing', async () => {
    seed(4);
    db.week(4).testResult = { value: 1.2, unit: 'km', passed: false };
    dayAfter(4);
    const [first, second] = await Promise.all([review(4), post('/close-week', {})]);
    expect([first.status, second.status]).toContain(200);
    expect(checkpoints()).toHaveLength(1);
    expect(lines().filter((line) => line.includes('outcome'))).toHaveLength(1);
  });
});

describe('expiry (RULE-8, AC-6)', () => {
  it('an offer still open when the next week closes is stored as keep, by expired, and logged first', async () => {
    seed(4);
    await review(4);
    atWeekEnd(5);
    expect((await review(5, { value: 3, unit: 'km', passed: true })).status).toBe(200);
    expect(checkpoints()).toEqual([{ ...OFFER, answer: 'keep', by: 'expired', answeredAt: expect.any(String) }]);
    expect(lines()[1]).toBe('[Checkpoint] goal g1 week 4 answer keep by expired');
    expect(values(5, 12)).toEqual(PLAN.slice(4));
    expect((await active()).checkpoint).toBeNull();
  });
});

describe('POST /api/goal/checkpoint (RULE-8, RULE-9, section 7, AC-7)', () => {
  async function offered() {
    seed(4);
    await review(4);
    vi.mocked(console.log).mockClear();
  }

  it('the goal response sends the open offer, amounts as the card shows them', async () => {
    await offered();
    const goal = await active();
    expect(goal.checkpoint).toEqual({ week: 4, kind: 'lower', target: '10 km', offered: '6 km', goal: '10 km', last: false, toFullGoal: false });
    expect(goal.dayNinetyLine).toBeNull();
  });

  it("the goal shown is week12Line's goal when safety lowered week 12 (WU-23), not the lowered full goal", async () => {
    // Safety lowered week 12 from 10 to 9 km; the week-4 offer (full goal 9) was accepted at 7 km.
    seed(5, { targets: [...PLAN.slice(0, 11), 7].map(km), checkpoints: [{ ...OFFER, target: 9, fullGoal: 9, offered: 7, answer: 'accept', by: 'person', answeredAt: '2026-10-19T10:00:00.000Z' }] });
    db.goal().roadmap.loweredTargets = [{ week: 12, model: 10, safe: 9 }];
    expect((await active()).dayNinetyLine).toEqual({ target: '7 km', goal: '10 km' });
  });

  it('keep stores the answer and changes nothing', async () => {
    await offered();
    const res = await answer(4, 'keep');
    expect(res).toMatchObject({ status: 200, body: { week: 4, answer: 'keep', by: 'person' } });
    expect(checkpoints()).toEqual([{ ...OFFER, answer: 'keep', by: 'person', answeredAt: expect.any(String) }]);
    expect(values(5, 12)).toEqual(PLAN.slice(4));
    expect(lines()).toEqual(['[Checkpoint] goal g1 week 4 answer keep by person']);
    const goal = await active();
    expect(goal.checkpoint).toBeNull();
    expect(goal.dayNinetyLine).toBeNull();
  });

  it('accept sets week 12, spreads the weeks between, keeps the open week and finalGoal, all in one transaction', async () => {
    await offered();
    const transactions = vi.mocked(db.prisma.$transaction).mock.calls.length;
    const res = await answer(4, 'accept');
    expect(res.status).toBe(200);
    expect(vi.mocked(db.prisma.$transaction).mock.calls.length).toBe(transactions + 1);
    expect(values(1, 12)).toEqual([0.5, 1, 1.5, 2, 3, 3, 3.5, 4, 4.5, 5, 5.5, 6]);
    expect(db.week(12)).toMatchObject({ objective: 'Weekly running distance: 6 km', test: { passIf: 'Weekly running distance: 6 km' } });
    expect(db.week(5).objective).toBe('Weekly running distance: 3 km');
    expect(db.goal().roadmap.finalGoal).toBe('Run 10 km a week');
    expect(checkpoints()![0]).toMatchObject({ answer: 'accept', by: 'person' });
    expect(lines()).toEqual(['[Checkpoint] goal g1 week 4 answer accept by person']);
    const goal = await active();
    expect(goal.checkpoint).toBeNull();
    expect(goal.dayNinetyLine).toEqual({ target: '6 km', goal: '10 km' });
  });

  it('an accept saved while the next close is writing its week makes that close save nothing (503); the retry reads the accepted targets', async () => {
    await offered();
    atWeekEnd(5);
    const write = vi.mocked(generateWeekPlan).getMockImplementation()!;
    vi.mocked(generateWeekPlan).mockImplementationOnce(async (input) => {
      expect((await answer(4, 'accept')).status).toBe(200);
      return write(input);
    });
    const res = await review(5, { value: 3, unit: 'km', passed: true });
    expect(res.status).toBe(503);
    expect(db.week(5).status).toBe('active');
    expect(values(1, 12)).toEqual([0.5, 1, 1.5, 2, 3, 3, 3.5, 4, 4.5, 5, 5.5, 6]);
    expect(checkpoints()).toEqual([expect.objectContaining({ week: 4, answer: 'accept', by: 'person' })]);
    expect(lines()).toContain('[Checkpoint] goal g1 week 5 close not saved: the open offer was accepted during the close');
    expect((await review(5, { value: 3, unit: 'km', passed: true })).status).toBe(200);
    expect(db.week(12).target.value).toBe(6);
    expect(values(6, 11).every((value) => value <= 6)).toBe(true);
  });

  it('the first answer wins: a second answer, or two at once, gets 409', async () => {
    await offered();
    const [a, b] = await Promise.all([answer(4, 'accept'), answer(4, 'keep')]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect([a.body, b.body].find((body) => body.reason)).toMatchObject({ reason: 'no_checkpoint' });
    expect((await answer(4, 'keep')).body).toMatchObject({ reason: 'no_checkpoint' });
  });

  it('409 when no open offer matches the week, and on accept of a line-only offer', async () => {
    seed(5, { checkpoints: [{ ...OFFER, kind: 'line_only', offered: null }] });
    expect(await answer(8, 'keep')).toMatchObject({ status: 409, body: { reason: 'no_checkpoint' } });
    expect(await answer(4, 'accept')).toMatchObject({ status: 409, body: { reason: 'no_checkpoint' } });
    expect((await answer(4, 'keep')).status).toBe(200);
  });

  it('409 when the open week closed after the goal was loaded (that close expired the offer)', async () => {
    seed(5, { checkpoints: [OFFER] });
    const read = vi.mocked(db.prisma.goal.findFirst).getMockImplementation()!;
    vi.mocked(db.prisma.goal.findFirst).mockImplementationOnce(async (args: any) => {
      const loaded = await read(args);
      // The close of week 5 commits between the load and the answer's transaction.
      db.week(5).status = 'completed';
      db.week(6).status = 'active';
      db.goal().roadmap.checkpoints = [{ ...OFFER, answer: 'keep', by: 'expired', answeredAt: '2026-10-26T10:00:00.000Z' }];
      return loaded;
    });
    expect(await answer(4, 'accept')).toMatchObject({ status: 409, body: { reason: 'no_checkpoint' } });
    expect(values(5, 12)).toEqual(PLAN.slice(4));
  });

  it.each([[{ week: 7, answer: 'keep' }], [{ week: 4, answer: 'maybe' }], [{ week: '4', answer: 'keep' }], [{}]])('400 for any other body: %j', async (body) => {
    seed(5, { checkpoints: [OFFER] });
    expect((await post('/checkpoint', body)).status).toBe(400);
  });
});

describe('week 8 (RULE-10, AC-8)', () => {
  /** Week 4's lower to 9 km was accepted; week 12 is 9, the weeks between as planned. */
  const lowered = () => {
    seed(8, { targets: [...PLAN.slice(0, 11), 9].map(km), checkpoints: [{ ...OFFER, offered: 9, answer: 'accept', by: 'person', answeredAt: '2026-10-19T10:00:00.000Z' }] });
  };

  it('ahead of the lowered target: a raise back to the full goal, which clears the day-90 line', async () => {
    lowered();
    expect((await active()).dayNinetyLine).toEqual({ target: '9 km', goal: '10 km' });
    expect((await review(8, { value: 7, unit: 'km', passed: true })).status).toBe(200);
    expect(checkpoints()![1]).toMatchObject({ week: 8, kind: 'raise', target: 9, fullGoal: 10, offered: 10, answer: null });
    expect((await active()).checkpoint).toEqual({ week: 8, kind: 'raise', target: '9 km', offered: '10 km', goal: '10 km', last: true, toFullGoal: true });
    expect((await answer(8, 'accept')).status).toBe(200);
    expect(values(9, 12)).toEqual([7, 8, 9, 10]);
    expect((await active()).dayNinetyLine).toBeNull();
  });

  it('behind again: a lower offer worded as the last check', async () => {
    lowered();
    expect((await review(8, { value: 3, unit: 'km', passed: false })).status).toBe(200);
    expect((await active()).checkpoint).toMatchObject({ week: 8, kind: 'lower', target: '9 km', last: true });
  });
});

describe('the day-90 line in both prompts (RULE-12, AC-10)', () => {
  it('after an accepted lower, the weekly update and the week writer get the line after the goal, word for word', async () => {
    seed(4);
    await review(4);
    await answer(4, 'accept');
    vi.mocked(generateStructuredContent).mockClear();
    vi.mocked(generateWeekPlan).mockClear();
    atWeekEnd(5);
    expect((await review(5, null)).status).toBe(200);
    const prompt = String(vi.mocked(generateStructuredContent).mock.calls[0][0]);
    expect(prompt).toContain(`Goal: Run 10 km a week\n${DAY90_PROMPT_LINE}\nMethod:`);
    const input = vi.mocked(generateWeekPlan).mock.calls[0][0] as WeekCallInput;
    expect(input.dayNinety).toEqual({ target: '6 km', goal: '10 km' });
    expect(buildWeekPrompt(input, weekLayout('steady', input.weekStart))).toContain(`Goal: Run 10 km a week\n${DAY90_PROMPT_LINE}\nTheir answers:`);
    // The update keeps the stored week 12.
    expect(db.week(12).target.value).toBe(6);
  });

  it('with no choice standing, neither input has the key, so both prompts are as before', async () => {
    seed(4);
    await review(4);
    await answer(4, 'keep');
    vi.mocked(generateStructuredContent).mockClear();
    vi.mocked(generateWeekPlan).mockClear();
    atWeekEnd(5);
    await review(5, null);
    expect(String(vi.mocked(generateStructuredContent).mock.calls[0][0])).not.toContain('Day-90 target');
    const input = vi.mocked(generateWeekPlan).mock.calls[0][0] as WeekCallInput;
    expect('dayNinety' in input).toBe(false);
    expect(buildWeekPrompt(input, weekLayout('steady', input.weekStart))).not.toContain('Day-90 target');
  });

  it('the line goes into the weekly update prompt only when given', () => {
    const base = {
      finalGoal: 'Run 10 km a week',
      method: { name: 'Ten percent rule', rules: ['Add at most 10% a week'] },
      weekNumber: 5,
      target: km(3),
      lightTest: false,
      lightTestGoal: false,
      result: '3 km',
      testLogged: true,
      lowerBound: null,
      counts: { practiceDone: 4, practicePlanned: 5, detail: null },
      reflection: '',
      history: [],
      weeksLeft: [{ weekNumber: 6, target: km(4), light: false }],
      safeMax: null,
    };
    const withLine = buildWeeklyUpdatePrompt({ ...base, dayNinety: { target: '6 km', goal: '10 km' } } as never);
    expect(withLine.replace(`\n${DAY90_PROMPT_LINE}`, '')).toBe(buildWeeklyUpdatePrompt(base as never));
  });
});

describe('every switch state off stores and sends nothing (RULE-1, AC-1)', () => {
  it.each([
    ['both off', '', ''],
    ['week close only', 'true', ''],
    ['weekly update only', '', 'true'],
  ])('%s', async (_name, close, update) => {
    vi.stubEnv('WEEK_CLOSE_ENABLED', close);
    vi.stubEnv('WEEKLY_UPDATE_ENABLED', update);
    seed(4);
    expect((await review(4)).status).toBe(200);
    expect(checkpoints()).toBeUndefined();
    expect(lines()).toEqual([]);
    const goal = await active();
    expect(goal.checkpoint).toBeNull();
    expect(goal.dayNinetyLine).toBeNull();
  });

  it.each([
    ['both off', '', ''],
    ['week close only', 'true', ''],
    ['weekly update only', '', 'true'],
  ])('%s: an offer or a choice already stored is neither sent nor answerable, and no prompt gets the line', async (_name, close, update) => {
    seed(5, { targets: [...PLAN.slice(0, 11), 6].map(km), checkpoints: [{ ...OFFER, answer: 'accept', by: 'person', answeredAt: '2026-10-19T10:00:00.000Z' }, { ...OFFER, week: 8 }] });
    vi.stubEnv('WEEK_CLOSE_ENABLED', close);
    vi.stubEnv('WEEKLY_UPDATE_ENABLED', update);
    const goal = await active();
    expect(goal.checkpoint).toBeNull();
    expect(goal.dayNinetyLine).toBeNull();
    expect(await answer(8, 'keep')).toMatchObject({ status: 409, body: { reason: 'weekly_update_disabled' } });
    await review(5, null);
    expect('dayNinety' in (vi.mocked(generateWeekPlan).mock.calls[0][0] as WeekCallInput)).toBe(false);
    // The open offer was not expired either.
    expect(checkpoints()![1].answer).toBeNull();
  });
});
