import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Weekly update M3.1 (RULE-1, RULE-4, RULE-9, RULE-10, WU-45): the update on the review path. Prisma is the in-memory
// store in weekCloseStore.ts, so the real close, writeNextWeek and safety climb run; only the two model calls (the
// update's `generateStructuredContent` and the week's `generateWeekPlan`) are replaced.

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
import { keyMilestoneText, formatTarget, measuredPathwayTest, pathwayFor, type WeekTarget } from '../src/lib/ai/roadmap.js';
import { RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';
import { safeGoalTargets } from '../src/lib/safety/storedTargets.js';
import { AUTO_CLOSE_INSIGHT, MOVED_INSIGHT } from '../src/lib/weekClose/close.js';
import {
  FALLBACK_HOLD_INSIGHT,
  RESTART_FALLBACK_BIG_WEEK_INSIGHT,
  RESTART_FALLBACK_INSIGHT,
  WEEKLY_UPDATE_TIME_LIMIT_MS,
  autoCloseUpdateInsight,
  nextWeekSentence,
  planWeeklyUpdate,
  updateThenWrite,
  type PlannedUpdate,
} from '../src/lib/weekClose/update.js';
import { FINAL_WEEK_INSIGHT, KEEP_GOING_INSIGHT, WELCOME_BACK_INSIGHT } from '../src/lib/weekClose/breaks.js';
import { dailyTimeCheckOf } from '../src/lib/weekClose/retest.js';
import { nextSafeStep } from '../src/lib/safety/targetSteps.js';
import { easyRetestStep, retestStepFor } from '../src/lib/ai/retestStep.js';
import { sentenceReason } from '../src/lib/ai/weeklyUpdate.js';

const USER = { id: 'u1', email: 'u1@achivii.com', timezone: 'UTC' };
const START = new Date('2026-09-21T00:00:00Z'); // a Monday
const SWITCHES = ['WEEK_CLOSE_ENABLED', 'WEEKLY_UPDATE_ENABLED', 'METHOD_RECOVERY_ENABLED'] as const;
const DAY = 86_400_000;

const km = (value: number): WeekTarget => ({ kind: 'number', metric: 'Weekly running distance', value, unit: 'km', direction: 'higher_is_better' });
const runTest = (target: WeekTarget, light = false) =>
  light ? { type: 'run', instructions: 'Log the long run', passIf: 'Done as written', light: true } : { type: 'run', instructions: 'Run the weekly distance', passIf: formatTarget(target) };

function dayPlans(weekStart: Date, kind?: string): WeekDayPlan[] {
  return weekLayout('steady', weekStart).map((day) => ({
    ...day,
    title: `Session ${day.date}`,
    durationMinutes: day.isRestDay ? 0 : 30,
    slotTime: '19:30',
    implementationIntention: '',
    detailedSteps: day.isRestDay
      ? []
      : [{ stepNumber: 1, title: `Lesson ${day.date}`, durationMinutes: 30, instructions: 'Practice.', focusCue: '', pitfallToAvoid: '', priority: 1, ...(kind ? { kind } : {}) }],
    isKeySession: false,
    whyToday: '',
    minimumVersion: null,
  }));
}

interface SeedOptions {
  /** The 12 targets; by default 10 km in week 1 up 1 km a week to 21 km. */
  targets?: WeekTarget[];
  light?: (week: number) => boolean;
  /** Practice days done in the closing week, of 5. */
  done?: number;
  kind?: string;
  rawGoal?: string;
  /** A week's stored test; by default `runTest`. */
  testFor?: (week: number, target: WeekTarget) => Record<string, unknown>;
  finalTest?: string;
}

/** A running goal on week `n`, weeks before it closed by review with their results and review rows. */
function seed(n: number, options: SeedOptions = {}) {
  const targets = options.targets ?? Array.from({ length: 12 }, (_, i) => km(10 + i));
  db.state.goals.push({
    id: 'g1',
    userId: USER.id,
    status: 'active',
    planVersion: 2,
    currentWeek: n,
    rawGoal: options.rawGoal ?? 'Build my weekly running distance to 21 km',
    clarifiedOutcome: null,
    startDate: START,
    targetDate: new Date(START.getTime() + 84 * DAY),
    routine: JSON.stringify({ dailyMinutes: 30, planVariant: 'steady', sleepTime: '23:00', preferredSlot: 'evening' }),
    roadmap: {
      finalGoal: 'Run 21 km a week',
      finalTest: options.finalTest ?? 'Run the weekly distance',
      startingPoint: {},
      method: { name: 'Ten percent rule', creator: '', rules: ['Add at most 10% a week'] },
      phases: [{ name: 'Base', purpose: 'Build.' }],
      answers: [],
      recovery: RECOVERY_TEMPLATES.language,
    },
    movedDays: 0,
    closeTriedAt: null,
    closeTriedWeek: null,
  });
  targets.forEach((target, i) => {
    const weekNumber = i + 1;
    const test = options.testFor ? options.testFor(weekNumber, target) : runTest(target, options.light?.(weekNumber));
    db.state.weeks.push({
      id: `w${weekNumber}`,
      goalId: 'g1',
      weekNumber,
      phase: 'Base',
      theme: `Theme ${weekNumber}`,
      objective: formatTarget(target),
      keyMilestone: keyMilestoneText(test),
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
    if (weekNumber < n) db.state.reviews.push({ id: `r${weekNumber}`, goalId: 'g1', weekNumber, tasksPlanned: 5, tasksCompleted: 4, scorePercentage: 80, reflection: '', aiAdaptationInsight: '' });
  });
  const weekStart = new Date(START.getTime() + (n - 1) * 7 * DAY);
  let practice = 0;
  dayPlans(weekStart, options.kind).forEach((day) => {
    const done = !day.isRestDay && practice++ < (options.done ?? 4);
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
      status: done ? 'completed' : 'pending',
      usedMinimumVersion: false,
      notOffered: false,
      notes: null,
      durationMinutes: day.durationMinutes,
      detailedSteps: JSON.stringify(day.detailedSteps),
    });
  });
  // On time: the afternoon of the week's last day.
  vi.setSystemTime(new Date(weekStart.getTime() + 6 * DAY + 15 * 3_600_000));
}

/** The model's answer: every week left (or the big weeks), at the given values. */
function modelAnswer(weeks: number[], values: number[], over: Record<string, unknown> = {}) {
  return {
    success: true,
    isFallback: false,
    data: {
      status: 'on_track',
      nextTargets: weeks.map((weekNumber, i) => ({ weekNumber, kind: 'number', metric: 'Weekly running distance', value: values[i], unit: 'km' })),
      messageToUser: 'Next week builds on a strong one.',
      guidanceForNextWeek: 'Keep the long run easy and add the extra kilometre on Tuesday.',
      ...over,
    },
  };
}
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
/** A raise after a strong week: each week one safe step or less past the one before, week 12 unchanged. */
const RAISED = [13.2, 14.2, 15.2, 16.2, 17.2, 18.2, 19.2, 20.2, 21];
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
  vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
  vi.stubEnv('WEEKLY_UPDATE_ENABLED', 'true');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const review = async (weekNumber: number, body: unknown = { reflection: 'Went fine', testResult: { value: 12.5, unit: 'km', passed: true } }) => {
  const res = await fetch(`${baseUrl}/api/goal/weeks/${weekNumber}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const valueOf = (week: number) => db.week(week).target.value as number;
const values = (from: number, to: number) => range(from, to).map(valueOf);
const weekInput = () => vi.mocked(generateWeekPlan).mock.calls[0][0] as WeekCallInput;
const updateLines = () => vi.mocked(console.log).mock.calls.map((args) => String(args[0])).filter((line) => line.startsWith('[WeeklyUpdate]'));
const safetyLines = () =>
  vi.mocked(console.warn).mock.calls.filter((args) => args[0] === '[Safety]').map((args) => JSON.parse(String(args[1])) as Record<string, unknown>);
const updatePrompt = (call = 0) => String(vi.mocked(generateStructuredContent).mock.calls[call][0]);

describe('an accepted update (RULE-1, RULE-9)', () => {
  it('saves the targets, the status and the sentence with the close, and writes next week from them with the coach\'s note', async () => {
    seed(3);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(4, 12), RAISED) as never);
    const res = await review(3);
    expect(res.status).toBe(200);
    expect(generateStructuredContent).toHaveBeenCalledTimes(1);
    expect(values(4, 12)).toEqual(RAISED);
    expect(db.week(4)).toMatchObject({ objective: 'Weekly running distance: 13.2 km', keyMilestone: 'Run the weekly distance Pass if: Weekly running distance: 13.2 km' });
    expect(db.week(4).test.passIf).toBe('Weekly running distance: 13.2 km');
    expect(db.week(3).updateStatus).toBe('on_track');
    expect(db.state.reviews.find((r) => r.weekNumber === 3)?.aiAdaptationInsight).toBe('Next week builds on a strong one.');
    // The week call got the new target and the coach's note.
    expect(weekInput().target).toMatchObject({ value: 13.2 });
    expect(weekInput().lastWeek?.note).toBe('Keep the long run easy and add the extra kilometre on Tuesday.');
    expect(buildWeekPrompt(weekInput(), weekLayout('steady', weekInput().weekStart))).toContain("Coach's note: Keep the long run easy and add the extra kilometre on Tuesday.");
    expect(updateLines()).toEqual(['[WeeklyUpdate] goal g1 week 3 status on_track restart none outcome accepted held none lowered 0 stored 4,5,6,7,8,9,10,11 readBack none retest none reasons none']);
  });

  it('reads the review\'s result, the reconcile counts, the reflection and the last 3 weeks', async () => {
    seed(5);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(6, 12), range(15, 21)) as never);
    await review(5, { reflection: 'Legs felt heavy', testResult: { value: 14, unit: 'km', passed: true } });
    const prompt = updatePrompt();
    expect(prompt).toContain('THIS WEEK (week 5)\nTarget: Weekly running distance: 14 km\nTest result: test logged: 14 km, passed');
    expect(prompt).toContain('Sessions done: 4 of 5.');
    expect(prompt).toContain('Their note: "Legs felt heavy"');
    expect(prompt).toContain('- Week 2: target Weekly running distance: 11 km; result: test logged: 11 km, passed; sessions done: 4 of 5; status: on_track');
    expect(prompt).toContain('- Week 4: target');
    expect(prompt).not.toContain('- Week 1: target');
    expect(prompt).toContain('- The most week 6 may be: 15.4 km (one safe step).');
    expect(prompt).not.toContain('WHERE THEY ARE');
  });
});

describe('the retry and the fallback (RULE-4, RULE-7, AC-2)', () => {
  it('one retry with the reasons; the second answer is accepted', async () => {
    seed(3);
    vi.mocked(generateStructuredContent)
      .mockResolvedValueOnce(modelAnswer(range(4, 12), [...RAISED.slice(0, 8), 20.2]) as never)
      .mockResolvedValueOnce(modelAnswer(range(4, 12), RAISED) as never);
    expect((await review(3)).status).toBe(200);
    expect(generateStructuredContent).toHaveBeenCalledTimes(2);
    expect(updatePrompt(1)).toContain('YOUR PREVIOUS ANSWER WAS REJECTED: week 12 must stay exactly 21 km.');
    expect(valueOf(4)).toBe(13.2);
    expect(updateLines()).toEqual(['[WeeklyUpdate] goal g1 week 3 status on_track restart none outcome retry_accepted held none lowered 0 stored 4,5,6,7,8,9,10,11 readBack none retest none reasons ["week 12 must stay exactly 21 km."]']);
  });

  it('two bad answers: targets as planned, no status, the neutral line, no coach\'s note', async () => {
    seed(3);
    const bad = modelAnswer(range(4, 12), range(13, 21), { messageToUser: 'You missed a day.' });
    vi.mocked(generateStructuredContent).mockResolvedValue(bad as never);
    expect((await review(3)).status).toBe(200);
    expect(generateStructuredContent).toHaveBeenCalledTimes(2);
    expect(values(4, 12)).toEqual(range(13, 21));
    expect(db.week(3).updateStatus ?? null).toBeNull();
    expect(db.state.reviews.find((r) => r.weekNumber === 3)?.aiAdaptationInsight).toBe(AUTO_CLOSE_INSIGHT);
    expect(weekInput().lastWeek?.note).toBeUndefined();
    expect(updateLines()[0]).toMatch(/^\[WeeklyUpdate\] goal g1 week 3 status none restart none outcome fallback held none lowered 0 stored none readBack none retest none reasons \[.*uses the word \\"missed\\"/);
  });

  it('no answer at all is the fallback and never fails the close', async () => {
    seed(3);
    expect((await review(3)).status).toBe(200);
    expect(db.week(3).status).toBe('completed');
    expect(db.state.reviews.find((r) => r.weekNumber === 3)?.aiAdaptationInsight).toBe(AUTO_CLOSE_INSIGHT);
    expect(updateLines()).toEqual(['[WeeklyUpdate] goal g1 week 3 status none restart none outcome fallback held none lowered 0 stored none readBack none retest none reasons ["no_answer","no_answer"]']);
  });

  it('a failed week write is the 503 and saves nothing of the update', async () => {
    seed(3);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(4, 12), RAISED) as never);
    vi.mocked(generateWeekPlan).mockResolvedValue(null);
    const before = structuredClone(db.state);
    expect((await review(3)).status).toBe(503);
    expect(db.state).toEqual(before);
  });
});

describe('safety (RULE-10, AC-8, AC-11, WU-45 (3))', () => {
  it('a raise past a safe step is lowered to it, and each lowered week logs lowered_on_update', async () => {
    seed(3);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(4, 12), [14, 15, 16, 17, 18, 19, 20, 21, 21]) as never);
    expect((await review(3)).status).toBe(200);
    // From 12 km: 13.2, then 14.5 and 15.9 (10%), then the model's own values once they are within a step.
    expect(values(4, 7)).toEqual([13.2, 14.5, 15.9, 17]);
    expect(safetyLines().map((line) => [line.week, line.model, line.safe, line.outcome, line.rule])).toEqual([
      [4, 14, 13.2, 'lowered_on_update', 'target_step'],
      [5, 15, 14.5, 'lowered_on_update', 'target_step'],
      [6, 16, 15.9, 'lowered_on_update', 'target_step'],
    ]);
    expect(updateLines()[0]).toContain('outcome accepted held none lowered 3');
    expect(db.goal().roadmap.loweredTargets).toBeUndefined();
    // WU-46 (3): next week was lowered (week 12 was not), so the sentence is code's.
    expect(db.state.reviews.find((r) => r.weekNumber === 3)?.aiAdaptationInsight).toBe('Next week aims at 13.2 km, a safe step.');
  });

  it("week 12 lowered by the climb is accepted, with code's sentence and its loweredTargets entry; a read lowers nothing more", async () => {
    // Weeks 10 to 12: 20, 22, 24 km. far_behind holds week 11 at 20, so 24 is two steps away.
    const targets = Array.from({ length: 12 }, (_, i) => km([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24][i]));
    seed(10, { targets, rawGoal: 'Build my weekly running distance to 24 km', done: 2 });
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer([11, 12], [20, 24], { status: 'far_behind', messageToUser: 'Next week keeps the same distance.' }) as never);
    expect((await review(10, { reflection: '', testResult: { value: 20, unit: 'km', passed: true } })).status).toBe(200);
    expect(values(11, 12)).toEqual([20, 22]);
    expect(db.goal().roadmap.loweredTargets).toEqual([{ week: 12, model: 24, safe: 22 }]);
    expect(db.state.reviews.find((r) => r.weekNumber === 10)?.aiAdaptationInsight).toBe('Week 12 aims at 22 km, a safe step. Your 24 km goal is the next step.');
    expect(db.week(10).updateStatus).toBe('far_behind');
    // Stop-if check: the stored goal read back lowers nothing, and week12Line keeps showing.
    const read = safeGoalTargets({ ...db.goal(), roadmapWeeks: db.state.weeks });
    expect(read?.foundNow).toEqual([]);
    expect(read?.week12Line).toEqual({ safe: '22 km', goal: '24 km' });
  });
});

describe('M3.1 review fixes', () => {
  /** Week 8 stored at 25 km: a read lowers it to 17.6 (one step past week 7's 16). */
  const older = () => Array.from({ length: 12 }, (_, i) => km(i === 7 ? 25 : 10 + i));

  it('(5) a week only lowered on read and left as it was is not stored; nothing for week 12', async () => {
    seed(3, { targets: older() });
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(4, 12), [13, 14, 15, 16, 17.6, 18, 19, 20, 21]) as never);
    const writes = () => vi.mocked(db.prisma.roadmapWeek.update).mock.calls.filter(([args]: any[]) => 'target' in args.data);
    expect((await review(3)).status).toBe(200);
    expect(updatePrompt()).toContain('- Week 8: Weekly running distance: 17.6 km');
    expect(writes()).toEqual([]);
    expect(valueOf(8)).toBe(25);
    expect(db.goal().roadmap.loweredTargets).toBeUndefined();
  });

  it('(5) a week the read would climb differently once an earlier week changed is stored at the update value', async () => {
    seed(3, { targets: older() });
    // Week 7 rises to 16.5: read from it, stored week 8 (25) would become 18.1, not the 17.6 the update kept.
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(4, 12), [13, 14, 15, 16.5, 17.6, 18, 19, 20, 21]) as never);
    expect((await review(3)).status).toBe(200);
    expect(values(7, 8)).toEqual([16.5, 17.6]);
    const read = safeGoalTargets({ ...db.goal(), roadmapWeeks: db.state.weeks });
    expect(read?.weeks.filter((w) => w.weekNumber > 3).map((w) => (w.target as any).value)).toEqual([13, 14, 15, 16.5, 17.6, 18, 19, 20, 21]);
  });

  it("(6) week 12 lowered on a pathway goal also sets the roadmap's finalTest, in the close", async () => {
    const run10k = pathwayFor('Run a 10k', null)!;
    expect(run10k.id).toBe('run10k');
    const tests = run10k.weeklyTests!;
    const distance = (value: number): WeekTarget => ({ kind: 'number', metric: 'Continuous run distance', value, unit: 'km', direction: 'higher_is_better' });
    const shows = (week: number) => (week <= 4 ? 5 : week <= 8 ? 8 : 10);
    const big = (week: number) => [4, 8, 12].includes(week);
    seed(5, {
      targets: range(1, 12).map((week) => distance(shows(week))),
      rawGoal: 'Run a 10k',
      testFor: (week, target) => (big(week) ? measuredPathwayTest(tests, target) : { type: 'timer', instructions: tests.light.instructions, passIf: 'Done as written', light: true }),
      finalTest: measuredPathwayTest(tests, distance(10)).instructions,
    });
    db.week(4).testResult = { value: 5, unit: 'km', passed: true };
    // Week 8 down to 5.5 km: from it, week 12's 10 km is more than four safe steps away (9.5 km).
    const answer = modelAnswer([8, 12], [5.5, 10], { status: 'a_bit_behind', messageToUser: 'Week 8 now aims a little lower.' });
    answer.data.nextTargets.forEach((item) => (item.metric = 'Continuous run distance'));
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(answer as never);
    expect((await review(5, { reflection: '', testResult: { value: 'Done', passed: true } })).status).toBe(200);
    expect(valueOf(12)).toBe(9.5);
    expect(db.week(12).test.instructions).toBe(measuredPathwayTest(tests, distance(9.5)).instructions);
    expect(db.goal().roadmap.finalTest).toBe(measuredPathwayTest(tests, distance(9.5)).instructions);
    expect(db.goal().roadmap.loweredTargets).toEqual([{ week: 12, model: 10, safe: 9.5 }]);
    expect(db.state.reviews.find((r) => r.weekNumber === 5)?.aiAdaptationInsight).toMatch(/^Week 12 aims at 9.5 km, a safe step\./);
  });

  it('(7) the week before is read once and handed to the week writer', async () => {
    vi.stubEnv('METHOD_RECOVERY_ENABLED', 'true');
    seed(3, { kind: 'new_material', done: 3 });
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(4, 12), RAISED) as never);
    expect((await review(3)).status).toBe(200);
    const reads = vi.mocked(db.prisma.dailyTask.findMany).mock.calls.filter(([args]: any[]) => args.where?.weekNumber === 2);
    expect(reads).toHaveLength(1);
  });
});

describe('M3.1 review fixes 2', () => {
  const run10k = () => pathwayFor('Run a 10k', null)!;
  const distance = (value: number): WeekTarget => ({ kind: 'number', metric: 'Continuous run distance', value, unit: 'km', direction: 'higher_is_better' });
  const big = (week: number) => [4, 8, 12].includes(week);
  /** A run10k goal: weeks 1 to 4 show `w4`, 5 to 8 show `w8`, 9 to 12 show `w12` (stored). */
  function seedRun10k(n: number, [w4, w8, w12]: number[]) {
    const tests = run10k().weeklyTests!;
    const shows = (week: number) => (week <= 4 ? w4 : week <= 8 ? w8 : w12);
    seed(n, {
      targets: range(1, 12).map((week) => distance(shows(week))),
      rawGoal: 'Run a 10k',
      testFor: (week, target) => (big(week) ? measuredPathwayTest(tests, target) : { type: 'timer', instructions: tests.light.instructions, passIf: 'Done as written', light: true }),
      finalTest: measuredPathwayTest(tests, distance(w12)).instructions,
    });
    db.week(4).testResult = { value: w4, unit: 'km', passed: true };
    return tests;
  }
  const run10kAnswer = (weeks: number[], values: number[], over: Record<string, unknown> = {}) => {
    const answer = modelAnswer(weeks, values, over);
    answer.data.nextTargets.forEach((item) => (item.metric = 'Continuous run distance'));
    return answer as never;
  };

  it('(2) an older pathway goal whose week 12 is lowered on read and stored by the read-back gets a finalTest naming it; (3) the line names it', async () => {
    // Week 12 stored at 12 km reads as 10 (four steps past week 8's 6). Week 8 rises to 7, so a read of the stored 12
    // would give 11: the read-back stores week 12 at the 10 the update kept.
    const tests = seedRun10k(5, [5, 6, 12]);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(run10kAnswer([8, 12], [7, 10]));
    expect((await review(5, { reflection: '', testResult: { value: 'Done', passed: true } })).status).toBe(200);
    expect(values(6, 12)).toEqual([7, 7, 7, 10, 10, 10, 10]);
    expect(db.goal().roadmap.finalTest).toBe(measuredPathwayTest(tests, distance(10)).instructions);
    expect(db.goal().roadmap.loweredTargets).toEqual([{ week: 12, model: 12, safe: 10 }]);
    expect(updateLines()).toEqual(['[WeeklyUpdate] goal g1 week 5 status on_track restart none outcome accepted held none lowered 0 stored 6,7,8,9,10,11,12 readBack 9,10,11,12 retest none reasons none']);
  });

  describe('(1) WU-47: no hold when next week shows week 12', () => {
    beforeEach(() => vi.stubEnv('METHOD_RECOVERY_ENABLED', 'true'));

    it.each([
      ['far_behind', { status: 'far_behind' }, {}, true],
      ['an unlogged test', {}, {}, false],
      ['a kind a week behind', {}, { kind: 'new_material', done: 0 }, true],
    ])('closing week 8 with %s is accepted with week 12 unchanged', async (_name, over: Record<string, unknown>, extra: SeedOptions, logged) => {
      seedRun10k(8, [5, 7, 10]);
      for (const task of db.tasksOf(8)) if (extra.kind) task.detailedSteps = task.detailedSteps.replace('"priority":1', `"priority":1,"kind":"${extra.kind}"`);
      if (extra.done === 0) for (const task of db.tasksOf(8)) task.status = 'pending';
      vi.mocked(generateStructuredContent).mockResolvedValueOnce(run10kAnswer([12], [10], { messageToUser: 'The final week aims at your 10 km goal.', ...over }));
      const body = logged ? { reflection: '', testResult: { value: 7, unit: 'km', passed: true } } : { reflection: '' };
      expect((await review(8, body)).status).toBe(200);
      expect(generateStructuredContent).toHaveBeenCalledTimes(1);
      expect(updatePrompt()).toContain("Week 9 shows week 12's target: it keeps the goal whatever the status");
      if (extra.kind) expect(updatePrompt()).toMatch(/- new material: .*; a week behind/);
      if (!logged) expect(updatePrompt()).toContain('Test result: the weekly test was not done');
      expect(updatePrompt()).not.toContain('must not be higher than this week');
      expect(values(9, 12)).toEqual([10, 10, 10, 10]);
      expect(db.state.reviews.find((r) => r.weekNumber === 8)?.aiAdaptationInsight).toBe('The final week aims at your 10 km goal.');
    });

    it('the same goal closing week 7 still holds (far_behind keeps week 8 at the 7 km week 7 shows)', async () => {
      seedRun10k(7, [5, 7, 10]);
      vi.mocked(generateStructuredContent).mockResolvedValue(run10kAnswer([8, 12], [8, 10], { status: 'far_behind' }));
      expect((await review(7, { reflection: '', testResult: { value: 'Done', passed: true } })).status).toBe(200);
      expect(updatePrompt(1)).toContain("far_behind, so week 8's target must equal this week's (7 km)");
      expect(valueOf(8)).toBe(7);
      expect(updateLines()[0]).toContain('outcome fallback');
    });
  });
});

describe('a light-test goal (WU-45 (2))', () => {
  it('the model sets the big weeks left; each light week takes its next big week\'s target', async () => {
    const big: Record<number, number> = { 4: 12, 8: 16, 12: 20 };
    const shows = (week: number) => big[week <= 4 ? 4 : week <= 8 ? 8 : 12];
    const light = (week: number) => ![4, 8, 12].includes(week);
    seed(5, { targets: range(1, 12).map((w) => km(shows(w))), light });
    db.week(4).testResult = { value: 12, unit: 'km', passed: true };
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer([8, 12], [15, 20], { status: 'a_bit_behind', messageToUser: 'Week 8 now aims a little lower.' }) as never);
    expect((await review(5, { reflection: '', testResult: { value: 'Done', passed: true, note: 'Felt good' } })).status).toBe(200);
    expect(updatePrompt()).toContain('one target for each of weeks 8, 12, in order');
    expect(updatePrompt()).toContain('Test result: light test done; their note: "Felt good"');
    expect(values(6, 12)).toEqual([15, 15, 15, 20, 20, 20, 20]);
    expect(db.week(6).test.light).toBe(true);
    expect(db.week(6).objective).toBe('Weekly running distance: 15 km');
    expect(db.week(8).test.passIf).toBe('Weekly running distance: 15 km');
  });
});

describe('in-order kinds (WU-11, AC-15), with METHOD_RECOVERY_ENABLED on', () => {
  beforeEach(() => vi.stubEnv('METHOD_RECOVERY_ENABLED', 'true'));

  it('a kind a week behind holds next week; the raise is refused and the retry holds', async () => {
    seed(3, { kind: 'new_material', done: 0 });
    vi.mocked(generateStructuredContent)
      .mockResolvedValueOnce(modelAnswer(range(4, 12), RAISED) as never)
      .mockResolvedValueOnce(modelAnswer(range(4, 12), [12, ...RAISED.slice(1)], { messageToUser: 'Next week keeps the same distance, so you can catch up on new material.' }) as never);
    expect((await review(3, { reflection: '', testResult: { value: 12, unit: 'km', passed: true } })).status).toBe(200);
    expect(updatePrompt()).toMatch(/- new material: at "Lesson [\d-]+", 4 steps still to do \(4 sessions of it this week\); a week behind/);
    expect(updatePrompt(1)).toContain("because they are a week behind in new material");
    expect(valueOf(4)).toBe(12);
  });

  it('one step behind does not block a raise', async () => {
    seed(3, { kind: 'new_material', done: 3 });
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(4, 12), RAISED) as never);
    expect((await review(3)).status).toBe(200);
    expect(updatePrompt()).toMatch(/- new material: at "Lesson [\d-]+", 1 step still to do \(4 sessions of it this week\)\n/);
    expect(generateStructuredContent).toHaveBeenCalledTimes(1);
    expect(valueOf(4)).toBe(13.2);
  });

  it('with the method switch off nothing is held for this reason', async () => {
    vi.stubEnv('METHOD_RECOVERY_ENABLED', '');
    seed(3, { kind: 'new_material', done: 0 });
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(4, 12), RAISED) as never);
    expect((await review(3)).status).toBe(200);
    expect(updatePrompt()).not.toContain('WHERE THEY ARE');
    expect(valueOf(4)).toBe(13.2);
  });
});

describe('saved together or not at all (RULE-9)', () => {
  it('a request that loses the close saves no target, no status and no review row', async () => {
    seed(3);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(4, 12), [14, ...RAISED.slice(1)]) as never);
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => {
      // Another close wins while this one writes the week.
      db.week(3).status = 'completed';
      return dayPlans(input.weekStart);
    });
    const res = await review(3);
    expect(res).toMatchObject({ status: 409, body: { reason: 'week_closed' } });
    expect(values(4, 12)).toEqual(range(13, 21));
    expect(db.week(3).updateStatus ?? null).toBeNull();
    expect(db.state.reviews.find((r) => r.weekNumber === 3)).toBeUndefined();
    expect(safetyLines()).toEqual([]);
  });

  it("an older goal whose profile is written during the close keeps no week 12 entry when it loses", async () => {
    seed(10, { targets: Array.from({ length: 12 }, (_, i) => km([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24][i])), rawGoal: 'Build my weekly running distance to 24 km' });
    delete db.goal().roadmap.recovery;
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer([11, 12], [20, 24], { status: 'far_behind', messageToUser: 'Next week keeps the same distance.' }) as never);
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => {
      db.week(10).status = 'completed';
      return dayPlans(input.weekStart);
    });
    expect((await review(10)).status).toBe(409);
    expect(db.goal().roadmap.recovery).toBeTruthy();
    expect(db.goal().roadmap.loweredTargets).toBeUndefined();
    expect(values(11, 12)).toEqual([22, 24]);
  });

  it('a save that fails inside the transaction rolls the targets back', async () => {
    seed(10, { targets: Array.from({ length: 12 }, (_, i) => km([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24][i])), rawGoal: 'Build my weekly running distance to 24 km' });
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer([11, 12], [20, 24], { status: 'far_behind', messageToUser: 'Next week keeps the same distance.' }) as never);
    db.failCreate = true;
    const before = structuredClone(db.state);
    expect((await review(10)).status).toBe(500);
    expect(db.state).toEqual(before);
  });
});

describe('when the update does not run (RULE-1, RULE-18, R-3, R-7)', () => {
  /** The review with the update off: one week call, no update call, the review's own line. */
  async function reviewWith(env: Record<string, string>) {
    db.reset();
    vi.clearAllMocks();
    for (const name of SWITCHES) vi.stubEnv(name, '');
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    seed(3);
    const res = await review(3);
    // Review row ids come from a counter in the store that runs across tests.
    const state = structuredClone(db.state);
    state.reviews.forEach((row) => delete row.id);
    return { res, state, input: vi.mocked(generateWeekPlan).mock.calls[0]?.[0] as WeekCallInput };
  }

  it.each([
    ['both switches unset', {}],
    ['only WEEK_CLOSE_ENABLED on', { WEEK_CLOSE_ENABLED: 'true' }],
    ['only WEEKLY_UPDATE_ENABLED on', { WEEKLY_UPDATE_ENABLED: 'true' }],
    ['both set to something other than "true"', { WEEK_CLOSE_ENABLED: 'TRUE', WEEKLY_UPDATE_ENABLED: '1' }],
  ])('%s: the review is exactly as today', async (_name, env: Record<string, string>) => {
    const baseline = await reviewWith({});
    const now = await reviewWith(env);
    expect(now.res.status).toBe(200);
    expect(generateStructuredContent).not.toHaveBeenCalled();
    expect(generateWeekPlan).toHaveBeenCalledTimes(1);
    expect(now.input.lastWeek?.note).toBeUndefined();
    expect(now.input).toEqual(baseline.input);
    expect(buildWeekPrompt(now.input, weekLayout('steady', now.input.weekStart))).toBe(buildWeekPrompt(baseline.input, weekLayout('steady', baseline.input.weekStart)));
    expect(now.state).toEqual(baseline.state);
    expect(now.state.reviews.find((r: any) => r.weekNumber === 3)?.aiAdaptationInsight).toBe('4 of 5 sessions done.');
    expect(updateLines()).toEqual([]);
  });

  it('week 12 runs no update', async () => {
    seed(12);
    expect((await review(12)).status).toBe(200);
    expect(generateStructuredContent).not.toHaveBeenCalled();
    expect(db.state.reviews.find((r) => r.weekNumber === 12)?.aiAdaptationInsight).toBe('4 of 5 sessions done.');
  });

  it('M3.4: a close that is a break now runs the update (its restart is covered below)', async () => {
    seed(3);
    vi.setSystemTime(new Date(START.getTime() + 3 * 7 * DAY + 9 * DAY + 10 * 3_600_000));
    expect((await review(3)).status).toBe(200);
    expect(generateStructuredContent).toHaveBeenCalled();
    expect(updateLines()[0]).toContain(' restart last level ');
  });

  it("the week prompt without a coach's note is byte-for-byte the one with no note key (R-1)", async () => {
    const { input } = await reviewWith({});
    const layout = weekLayout('steady', input.weekStart);
    const withUndefined = { ...input, lastWeek: { ...input.lastWeek!, note: undefined } };
    expect(buildWeekPrompt(withUndefined, layout)).toBe(buildWeekPrompt(input, layout));
    expect(buildWeekPrompt(input, layout)).not.toContain("Coach's note");
  });
});

describe('M3.2b: a fallback keeps the holds code can see (WU-48)', () => {
  const insightOf = (week: number) => db.state.reviews.find((r) => r.weekNumber === week)?.aiAdaptationInsight;
  const notLogged = { reflection: '' };

  it("an unlogged test holds next week at this week's target, with its own line; status and coach's note stay empty", async () => {
    seed(3);
    expect((await review(3, notLogged)).status).toBe(200);
    expect(generateStructuredContent).toHaveBeenCalledTimes(2);
    expect(valueOf(4)).toBe(12);
    expect(db.week(4).objective).toBe('Weekly running distance: 12 km');
    expect(insightOf(3)).toBe(FALLBACK_HOLD_INSIGHT);
    expect(sentenceReason(FALLBACK_HOLD_INSIGHT)).toBeNull();
    expect(db.week(3).updateStatus ?? null).toBeNull();
    expect(weekInput().target).toMatchObject({ value: 12 });
    expect(weekInput().lastWeek?.note).toBeUndefined();
    expect(updateLines()[0]).toMatch(/^\[WeeklyUpdate\] goal g1 week 3 status none restart none outcome fallback held not_logged lowered \d+ stored 4,/);
    // The later weeks take the same climb as accepted targets, so a read lowers nothing more; week 12 stays the goal.
    expect(valueOf(12)).toBe(21);
    expect(safeGoalTargets({ ...db.goal(), roadmapWeeks: db.state.weeks })?.foundNow).toEqual([]);
  });

  it("a hold that forces week 12 down gets WU-23's loweredTargets entry and sentence", async () => {
    const targets = Array.from({ length: 12 }, (_, i) => km([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24][i]));
    seed(10, { targets, rawGoal: 'Build my weekly running distance to 24 km' });
    expect((await review(10, notLogged)).status).toBe(200);
    expect(values(11, 12)).toEqual([20, 22]);
    expect(db.goal().roadmap.loweredTargets).toEqual([{ week: 12, model: 24, safe: 22 }]);
    expect(insightOf(10)).toBe('Week 12 aims at 22 km, a safe step. Your 24 km goal is the next step.');
    expect(db.week(10).updateStatus ?? null).toBeNull();
    expect(updateLines()[0]).toContain('outcome fallback held not_logged');
    expect(safeGoalTargets({ ...db.goal(), roadmapWeeks: db.state.weeks })?.week12Line).toEqual({ safe: '22 km', goal: '24 km' });
  });

  it('on a light-test goal it holds the next big week, and the light weeks before it show it', async () => {
    const big: Record<number, number> = { 4: 12, 8: 13, 12: 14 };
    const shows = (week: number) => big[week <= 4 ? 4 : week <= 8 ? 8 : 12];
    seed(4, { targets: range(1, 12).map((w) => km(shows(w))), light: (week) => ![4, 8, 12].includes(week), rawGoal: 'Build my weekly running distance to 14 km' });
    expect((await review(4, notLogged)).status).toBe(200);
    expect(values(5, 12)).toEqual([12, 12, 12, 12, 14, 14, 14, 14]);
    expect(db.week(5).test.light).toBe(true);
    expect(db.week(8).test.passIf).toBe('Weekly running distance: 12 km');
    expect(insightOf(4)).toBe(FALLBACK_HOLD_INSIGHT);
    expect(updateLines()[0]).toContain('outcome fallback held not_logged lowered 0 stored 5,6,7,8 ');
  });

  it("a kind a week behind holds a deliverable at this week's text", async () => {
    vi.stubEnv('METHOD_RECOVERY_ENABLED', 'true');
    const text = (description: string): WeekTarget => ({ kind: 'deliverable', description });
    seed(4, { targets: range(1, 12).map((w) => text(w === 12 ? 'Publish the book' : `Draft chapter ${w}`)), kind: 'new_material', done: 0, rawGoal: 'Write a book' });
    expect((await review(4, { reflection: '', testResult: { value: 'Done', passed: true } })).status).toBe(200);
    expect(db.week(5).target).toEqual(text('Draft chapter 4'));
    expect(db.week(6).target).toEqual(text('Draft chapter 6'));
    expect(insightOf(4)).toBe(FALLBACK_HOLD_INSIGHT);
    expect(updateLines()[0]).toContain('outcome fallback held week_behind');
  });

  it("no hold when next week shows week 12's target (WU-47): the plain fallback", async () => {
    const run10k = pathwayFor('Run a 10k', null)!;
    const tests = run10k.weeklyTests!;
    const distance = (value: number): WeekTarget => ({ kind: 'number', metric: 'Continuous run distance', value, unit: 'km', direction: 'higher_is_better' });
    const shows = (week: number) => (week <= 4 ? 5 : week <= 8 ? 7 : 10);
    seed(8, {
      targets: range(1, 12).map((week) => distance(shows(week))),
      rawGoal: 'Run a 10k',
      testFor: (week, target) =>
        [4, 8, 12].includes(week) ? measuredPathwayTest(tests, target) : { type: 'timer', instructions: tests.light.instructions, passIf: 'Done as written', light: true },
      finalTest: measuredPathwayTest(tests, distance(10)).instructions,
    });
    db.week(4).testResult = { value: 5, unit: 'km', passed: true };
    expect((await review(8, notLogged)).status).toBe(200);
    expect(values(9, 12)).toEqual([10, 10, 10, 10]);
    expect(insightOf(8)).toBe(AUTO_CLOSE_INSIGHT);
    expect(updateLines()[0]).toContain('outcome fallback held none lowered 0 stored none');
  });

  // M3.3a (WU-52): changed. An error from the model call now keeps code's holds, as a rejected answer does.
  it('an error from the model call keeps the hold, with its own line', async () => {
    seed(3);
    vi.mocked(generateStructuredContent).mockRejectedValue(new Error('boom'));
    expect((await review(3, notLogged)).status).toBe(200);
    expect(valueOf(4)).toBe(12);
    expect(insightOf(3)).toBe(FALLBACK_HOLD_INSIGHT);
    expect(updateLines()[0]).toMatch(/^\[WeeklyUpdate\] goal g1 week 3 status none restart none outcome fallback held not_logged lowered \d+ stored 4,.* retest not_logged reasons \["error"\]$/);
  });

  it('an error before the update has its input stays the plain fallback: no hold, the neutral line', async () => {
    seed(3);
    vi.mocked(db.prisma.weeklyReview.findMany).mockRejectedValueOnce(new Error('db down'));
    expect((await review(3, notLogged)).status).toBe(200);
    expect(generateStructuredContent).not.toHaveBeenCalled();
    expect(valueOf(4)).toBe(13);
    expect(insightOf(3)).toBe(AUTO_CLOSE_INSIGHT);
    // The re-test is code's fact, so it still starts the week (RULE-5).
    expect(updateLines()).toEqual(['[WeeklyUpdate] goal g1 week 3 status none restart none outcome fallback held none lowered 0 stored none readBack none retest not_logged reasons ["error"]']);
  });
});

describe('M3.2b: the safe-step line has no metric label', () => {
  it('gives only the amount, with " or less" for a lower-is-better target', () => {
    expect(nextWeekSentence(km(19.3))).toBe('Next week aims at 19.3 km, a safe step.');
    expect(nextWeekSentence({ kind: 'number', metric: '10K test time', value: 51.9, unit: 'minutes', direction: 'lower_is_better' })).toBe(
      'Next week aims at 51.9 minutes or less, a safe step.'
    );
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Weekly update M3.3a (RULE-1, RULE-5, RULE-6, RULE-18, WU-52 to WU-56).

const closeWeek = async (body: unknown = {}) => {
  const res = await fetch(`${baseUrl}/api/goal/close-week`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const putResult = async (weekNumber: number, body: unknown) => {
  const res = await fetch(`${baseUrl}/api/goal/weeks/${weekNumber}/test-result`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const insightOfWeek = (week: number) => db.state.reviews.find((r) => r.weekNumber === week)?.aiAdaptationInsight;
/** The closing week `n`'s last day closes at 01:00 the next day; `days` after the new week's planned start, at 10:00. */
const after = (n: number, days = 0) => vi.setSystemTime(new Date(START.getTime() + (n * 7 + days) * DAY + 10 * 3_600_000));
/** A week writer that places the re-test as `checkWeekAnswer` does (first on day 1), so the close can store it. */
const writerWithRetest = () =>
  vi.mocked(generateWeekPlan).mockImplementation(async (input) => {
    const days = dayPlans(input.weekStart);
    if (input.retest) days[0].detailedSteps.unshift(retestStepFor(input.retest.test, 15));
    return days;
  });
const farBehind = (weeks: number[], values: number[]) => modelAnswer(weeks, values, { status: 'far_behind', messageToUser: 'Next week stays at this week\'s distance.' });
const logged = { reflection: '', testResult: { value: 12, unit: 'km', passed: true } };

describe('M3.3a: the update in the automatic close (RULE-1, RULE-18, WU-52)', () => {
  it('with both switches on it runs the same update: targets, status, the sentence, the coach\'s note', async () => {
    seed(3);
    db.week(3).testResult = { value: 12.5, unit: 'km', passed: true };
    after(3);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(4, 12), RAISED) as never);
    const res = await closeWeek();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ due: true, closedBy: 'auto', nextWeekNumber: 4 });
    expect(values(4, 12)).toEqual(RAISED);
    expect(db.week(3)).toMatchObject({ status: 'completed', closedBy: 'auto', updateStatus: 'on_track' });
    expect(insightOfWeek(3)).toBe('Next week builds on a strong one.');
    expect(db.state.reviews.find((r) => r.weekNumber === 3)?.reflection).toBe('');
    expect(weekInput().target).toMatchObject({ value: 13.2 });
    expect(weekInput().lastWeek?.note).toBe('Keep the long run easy and add the extra kilometre on Tuesday.');
    expect(updatePrompt()).toContain('Their note: none');
    expect(updateLines()).toEqual(['[WeeklyUpdate] goal g1 week 3 status on_track restart none outcome accepted held none lowered 0 stored 4,5,6,7,8,9,10,11 readBack none retest none reasons none']);
  });

  it('after a short gap the line is the move line, a space, then the update\'s sentence', async () => {
    seed(3);
    db.week(3).testResult = { value: 12.5, unit: 'km', passed: true };
    after(3, 3);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(4, 12), RAISED) as never);
    expect((await closeWeek()).status).toBe(200);
    expect(db.goal().movedDays).toBe(3);
    expect(insightOfWeek(3)).toBe(`${MOVED_INSIGHT} Next week builds on a strong one.`);
  });

  it('{ mode: "check" } runs nothing', async () => {
    seed(3);
    after(3);
    expect((await closeWeek({ mode: 'check' })).body).toMatchObject({ due: true, weekNumber: 3 });
    expect(generateStructuredContent).not.toHaveBeenCalled();
    expect(generateWeekPlan).not.toHaveBeenCalled();
  });

  it('runs nothing for week 12; then the close is as before (M3.4: a break runs it, below)', async () => {
    seed(12);
    after(12);
    expect((await closeWeek()).status).toBe(200);
    expect(generateStructuredContent).not.toHaveBeenCalled();
  });

  it.each([
    ['WEEKLY_UPDATE_ENABLED off', 'WEEKLY_UPDATE_ENABLED'],
    ['WEEK_CLOSE_ENABLED off', 'WEEK_CLOSE_ENABLED'],
  ])('R-3, R-7: with %s nothing of the update runs: no model call beyond the week, no re-test, the neutral line', async (_label, name) => {
    vi.stubEnv(name, '');
    seed(3);
    after(3);
    writerWithRetest();
    const res = await closeWeek();
    expect(generateStructuredContent).not.toHaveBeenCalled();
    if (name === 'WEEK_CLOSE_ENABLED') {
      expect(res.body).toEqual({ due: false });
      return;
    }
    expect(res.status).toBe(200);
    expect(weekInput().retest).toBeUndefined();
    expect('retest' in weekInput()).toBe(false);
    expect(db.week(4).retestOfWeek ?? null).toBeNull();
    expect(db.week(3).updateStatus ?? null).toBeNull();
    expect(insightOfWeek(3)).toBe(AUTO_CLOSE_INSIGHT);
    expect(updateLines()).toEqual([]);
  });

  it('R-3: with WEEKLY_UPDATE_ENABLED off the review is as before too: no update call, no re-test', async () => {
    vi.stubEnv('WEEKLY_UPDATE_ENABLED', '');
    seed(3);
    writerWithRetest();
    expect((await review(3, { reflection: '' })).status).toBe(200);
    expect(generateStructuredContent).not.toHaveBeenCalled();
    expect('retest' in weekInput()).toBe(false);
    expect(db.week(4).retestOfWeek ?? null).toBeNull();
  });

  it('a lost race saves nothing of the update', async () => {
    seed(3);
    after(3);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(4, 12), RAISED) as never);
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => {
      // Another close wins while this one writes the week.
      db.week(3).status = 'completed';
      const days = dayPlans(input.weekStart);
      if (input.retest) days[0].detailedSteps.unshift(retestStepFor(input.retest.test, 15));
      return days;
    });
    const res = await closeWeek();
    expect(res.body).toEqual({ due: false, alreadyClosed: true, weekNumber: 3 });
    expect(values(4, 12)).toEqual(range(13, 21));
    expect(db.week(3).updateStatus ?? null).toBeNull();
    expect(db.week(4).retestOfWeek ?? null).toBeNull();
    expect(insightOfWeek(3)).toBeUndefined();
  });

  it('an error from the model call keeps the hold in the automatic close too', async () => {
    seed(3);
    after(3);
    vi.mocked(generateStructuredContent).mockRejectedValue(new Error('boom'));
    expect((await closeWeek()).status).toBe(200);
    expect(valueOf(4)).toBe(12);
    expect(insightOfWeek(3)).toBe(FALLBACK_HOLD_INSIGHT);
  });
});

describe('M3.3a: the time limit (WU-52)', () => {
  /** The reads before the call are not timed: wait (outside the fake clock) until the model is asked. */
  const untilAsked = async () => {
    for (let i = 0; i < 200 && vi.mocked(generateStructuredContent).mock.calls.length === 0; i++) await new Promise((resolve) => setImmediate(resolve));
    expect(generateStructuredContent).toHaveBeenCalled();
  };
  const closing = (n: number) => ({ ...structuredClone(db.goal()), roadmapWeeks: structuredClone(db.state.weeks), dailyTasks: structuredClone(db.tasksOf(n)) }) as never;

  it('one 15 s limit on the model call; a call that never settles gives the time_limit fallback with the hold kept', async () => {
    expect(WEEKLY_UPDATE_TIME_LIMIT_MS).toBe(15000);
    seed(3);
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(START.getTime() + 2 * 7 * DAY + 6 * DAY + 15 * 3_600_000));
    let late: (value: unknown) => void = () => {};
    vi.mocked(generateStructuredContent).mockReturnValue(new Promise((resolve) => (late = resolve)) as never);
    const pending = planWeeklyUpdate(closing(3), 3, { userId: USER.id, reflection: '', now: new Date() });
    await untilAsked();
    await vi.advanceTimersByTimeAsync(WEEKLY_UPDATE_TIME_LIMIT_MS - 1);
    let settled = false;
    void pending.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const update = await pending;
    expect(update).toMatchObject({ outcome: 'fallback', status: null, held: ['not_logged'], reasons: ['time_limit'], insight: FALLBACK_HOLD_INSIGHT });
    expect(update?.weeks.find((week) => week.weekNumber === 4)?.target).toMatchObject({ value: 12 });
    // The call left running changes nothing when it answers later.
    late(modelAnswer(range(4, 12), RAISED));
    await vi.advanceTimersByTimeAsync(0);
    expect(update?.reasons).toEqual(['time_limit']);
    expect(updateLines()).toHaveLength(1);
    expect(db.week(3).status).toBe('active');
  });

  it('M3.3a review: a first attempt that settles after the limit starts no second attempt', async () => {
    seed(3);
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(START.getTime() + 2 * 7 * DAY + 6 * DAY + 15 * 3_600_000));
    let answer: (value: unknown) => void = () => {};
    vi.mocked(generateStructuredContent).mockReturnValueOnce(new Promise((resolve) => (answer = resolve)) as never);
    const pending = planWeeklyUpdate(closing(3), 3, { userId: USER.id, reflection: '', now: new Date() });
    await untilAsked();
    await vi.advanceTimersByTimeAsync(WEEKLY_UPDATE_TIME_LIMIT_MS + 1000);
    expect((await pending)?.reasons).toEqual(['time_limit']);
    // A rejected first answer, after the deadline: the retry is never sent.
    answer(modelAnswer(range(4, 12), [99, ...RAISED.slice(1)]));
    for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
    expect(generateStructuredContent).toHaveBeenCalledTimes(1);
  });

  it('the review path goes through the same limit (updateThenWrite): a timed-out update still writes the week from the held target', async () => {
    seed(3);
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(START.getTime() + 2 * 7 * DAY + 6 * DAY + 15 * 3_600_000));
    vi.mocked(generateStructuredContent).mockReturnValue(new Promise(() => {}) as never);
    const pending = updateThenWrite(closing(3), 3, { userId: USER.id, reflection: 'x', now: new Date() });
    await untilAsked();
    await vi.advanceTimersByTimeAsync(WEEKLY_UPDATE_TIME_LIMIT_MS);
    const { update, next } = await pending;
    expect(update?.reasons).toEqual(['time_limit']);
    expect(next?.written).not.toBeNull();
    expect(weekInput().target).toMatchObject({ value: 12 });
    expect(weekInput().retest).toMatchObject({ ofWeek: 3 });
  });
});

describe('M3.3a: the re-test (RULE-5, RULE-6, WU-53, WU-54, WU-56)', () => {
  const retestTag = () => updateLines()[0]?.match(/ retest (\S+) /)?.[1];

  it('an unlogged test: the hold, a re-test of the closing week\'s stored test, stored as retestOfWeek (review path)', async () => {
    seed(3);
    writerWithRetest();
    expect((await review(3, { reflection: '' })).status).toBe(200);
    expect(retestTag()).toBe('not_logged');
    expect(weekInput().retest).toMatchObject({ ofWeek: 3, test: db.week(3).test });
    expect(db.week(4).retestOfWeek).toBe(3);
    expect(JSON.stringify(db.tasksOf(4)[0].detailedSteps)).toContain('Re-test: Run the weekly distance');
  });

  it('and on the automatic close', async () => {
    seed(3);
    after(3);
    writerWithRetest();
    expect((await closeWeek()).status).toBe(200);
    expect(retestTag()).toBe('not_logged');
    expect(db.week(4).retestOfWeek).toBe(3);
  });

  it('no retestOfWeek when the week written holds no re-test step', async () => {
    seed(3);
    expect((await review(3, { reflection: '' })).status).toBe(200);
    expect(weekInput().retest).toMatchObject({ ofWeek: 3 });
    expect(db.week(4).retestOfWeek ?? null).toBeNull();
  });

  it('two hard weeks: this update far_behind and the stored status of the week before far_behind', async () => {
    seed(3);
    db.week(2).updateStatus = 'far_behind';
    writerWithRetest();
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(farBehind(range(4, 12), [12, ...range(14, 21)]) as never);
    expect((await review(3, logged)).status).toBe(200);
    expect(db.week(3).updateStatus).toBe('far_behind');
    expect(retestTag()).toBe('two_hard_weeks');
    expect(db.week(4).retestOfWeek).toBe(3);
  });

  it('both at once give one re-test', async () => {
    seed(3);
    db.week(2).updateStatus = 'far_behind';
    writerWithRetest();
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(farBehind(range(4, 12), [12, ...range(14, 21)]) as never);
    expect((await review(3, { reflection: '' })).status).toBe(200);
    expect(retestTag()).toBe('not_logged,two_hard_weeks');
    expect(db.tasksOf(4).filter((task) => JSON.stringify(task.detailedSteps).includes('Re-test:'))).toHaveLength(1);
  });

  it.each([
    ['the week before has no stored status (WU-53)', () => (db.week(2).updateStatus = null)],
    ['the week before was on_track', () => (db.week(2).updateStatus = 'on_track')],
    ['the week before was jumped', () => Object.assign(db.week(2), { jumped: true, updateStatus: 'far_behind' })],
  ])('no two-hard-weeks re-test when %s', async (_label, set) => {
    seed(3);
    set();
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(farBehind(range(4, 12), [12, ...range(14, 21)]) as never);
    expect((await review(3, logged)).status).toBe(200);
    expect(db.week(3).updateStatus).toBe('far_behind');
    expect(retestTag()).toBe('none');
    expect('retest' in weekInput()).toBe(false);
  });

  it('a fallback this week has no status, so it never starts a two-hard-weeks re-test (WU-53)', async () => {
    seed(3);
    db.week(2).updateStatus = 'far_behind';
    expect((await review(3, logged)).status).toBe(200);
    expect(db.week(3).updateStatus ?? null).toBeNull();
    expect(retestTag()).toBe('none');
  });

  it('none when next week is week 12 (WU-15)', async () => {
    seed(11);
    expect((await review(11, { reflection: '' })).status).toBe(200);
    expect(retestTag()).toBe('none');
    expect('retest' in weekInput()).toBe(false);
  });

  const lightGoal = (n: number) => seed(n, { light: (week) => ![4, 8, 12].includes(week) });

  it('none when next week is a light week showing week 12\'s target (WU-47): closing week 8', async () => {
    lightGoal(8);
    expect((await review(8, { reflection: '' })).status).toBe(200);
    expect(retestTag()).toBe('none');
  });

  it('WU-54, WU-56 (3): an unlogged light week holds nothing and gets no re-test', async () => {
    lightGoal(5);
    expect((await review(5, { reflection: '' })).status).toBe(200);
    expect(updateLines()[0]).toContain(' held none ');
    expect(retestTag()).toBe('none');
    expect(updatePrompt()).not.toContain('The test was not logged');
  });

  it('WU-54: an unlogged big week 4 on a light-test goal holds and gets the re-test', async () => {
    lightGoal(4);
    writerWithRetest();
    expect((await review(4, { reflection: '' })).status).toBe(200);
    expect(updateLines()[0]).toContain(' held not_logged ');
    expect(retestTag()).toBe('not_logged');
    expect(db.week(5).retestOfWeek).toBe(4);
  });

  it('two hard weeks after a light week: no re-test (WU-56 (3))', async () => {
    lightGoal(5);
    db.week(4).updateStatus = 'far_behind';
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(
      modelAnswer([8, 12], [14, 21], { status: 'far_behind', messageToUser: 'Week 8 stays at this week\'s distance.' }) as never
    );
    expect((await review(5, { reflection: '' })).status).toBe(200);
    expect(retestTag()).toBe('none');
  });

  it('none when the new week has no offered practice day before its test day (a gap that left only the test day)', async () => {
    seed(3);
    db.week(3).testResult = null;
    // A 6-day gap (not a break) moves the plan by only the room left, so the new week starts in the past and its days
    // before today are not offered: with 27 days moved already, one day of room, leaving only the test day (day 6).
    db.goal().movedDays = 27;
    after(3, 6);
    expect((await closeWeek()).status).toBe(200);
    expect(updateLines()[0]).toContain(' held not_logged ');
    expect(retestTag()).toBe('none');
  });
});

describe('M3.3a: the re-test result is the earlier week\'s late result (WU-17)', () => {
  it('the next update reads it in the trend, and the new week\'s own test as its result', async () => {
    seed(4);
    db.week(3).testResult = null;
    db.week(4).retestOfWeek = 3;
    expect((await putResult(3, { value: 12.5, unit: 'km', passed: true })).status).toBe(200);
    expect((await putResult(2, { value: 99, unit: 'km', passed: true })).body.reason).toBe('week_closed');
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(5, 12), range(14, 21)) as never);
    expect((await review(4, { reflection: '', testResult: { value: 13.5, unit: 'km', passed: true } })).status).toBe(200);
    const prompt = updatePrompt();
    expect(prompt).toContain('- Week 3: target Weekly running distance: 12 km; result: test logged: 12.5 km, passed;');
    expect(prompt).toContain('Test result: test logged: 13.5 km, passed');
  });

  it('M3.3a review (amends WU-56 (2)): the easy re-test stores no retestOfWeek, so the earlier week takes no result', async () => {
    seed(3);
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => {
      const days = dayPlans(input.weekStart);
      if (input.retest) days[0].detailedSteps.unshift(easyRetestStep(15));
      return days;
    });
    expect((await review(3, { reflection: '' })).status).toBe(200);
    expect(weekInput().retest).toMatchObject({ ofWeek: 3 });
    expect(db.week(4).retestOfWeek ?? null).toBeNull();
    expect((await putResult(3, { value: 12, unit: 'km', passed: true })).body.reason).toBe('week_closed');
  });
});

describe('M3.3a review: the automatic close line after the plain fallback', () => {
  it('stores only the move line when the update fell back to the neutral line; the neutral line alone with no move', async () => {
    seed(3);
    db.week(3).testResult = { value: 12.5, unit: 'km', passed: true };
    after(3, 3);
    expect((await closeWeek()).status).toBe(200);
    expect(updateLines()[0]).toContain('outcome fallback held none');
    expect(insightOfWeek(3)).toBe(MOVED_INSIGHT);
    db.reset();
    seed(3);
    db.week(3).testResult = { value: 12.5, unit: 'km', passed: true };
    after(3);
    expect((await closeWeek()).status).toBe(200);
    expect(insightOfWeek(3)).toBe(AUTO_CLOSE_INSIGHT);
  });

  it('a held fallback keeps its own line after the move line', async () => {
    seed(3);
    after(3, 3);
    expect((await closeWeek()).status).toBe(200);
    expect(insightOfWeek(3)).toBe(`${MOVED_INSIGHT} ${FALLBACK_HOLD_INSIGHT}`);
  });
});

describe('M3.4: the break restart (RULE-16, WU-16, WU-59)', () => {
  const tag = (name: string) => updateLines()[0]?.match(new RegExp(` ${name} (\\S+) `))?.[1];
  const restartTag = () => updateLines()[0]?.match(/ restart (.+?) outcome /)?.[1];
  const retestTag = () => updateLines()[0]?.match(/ retest (\S+) /)?.[1];
  const endurance = () => (db.goal().roadmap.recovery = RECOVERY_TEMPLATES.endurance);
  /** The week writer places a measured or (when asked) an easy re-test first on day 1, as `checkWeekAnswer` does. */
  const writerWithAnyRetest = () =>
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => {
      const days = dayPlans(input.weekStart);
      if (input.retest) days[0].detailedSteps.unshift(input.retest.easy ? easyRetestStep(15) : retestStepFor(input.retest.test, 15));
      return days;
    });
  const readsAsStored = () => expect(safeGoalTargets({ ...db.goal(), roadmapWeeks: db.state.weeks })?.foundNow).toEqual([]);
  const SPREAD = [12, 13, 14.2, 15.5, 16.8, 18, 19.3, 20.2, 21];

  it('section 5 "Week ends, then away 10 days": an accepted answer at the restart level, no status, a break re-test', async () => {
    seed(3);
    writerWithAnyRetest();
    after(3, 10);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(
      modelAnswer(range(4, 12), SPREAD, { status: 'far_behind', messageToUser: 'Next week picks up at 12 km and builds from there.' }) as never
    );
    expect((await closeWeek()).status).toBe(200);
    expect(updatePrompt()).toContain('- Week 4 must be exactly Weekly running distance: 12 km.');
    expect(updatePrompt()).toMatch(/They were away \d+ days\. The method's return rule for a break this long: restart at the last level reached \(week 3's target\)\./);
    expect(values(4, 12)).toEqual(SPREAD);
    expect(db.week(3).updateStatus ?? null).toBeNull();
    expect(insightOfWeek(3)).toBe(`${WELCOME_BACK_INSIGHT} Next week picks up at 12 km and builds from there.`);
    expect(restartTag()).toBe('last level');
    expect(updateLines()[0]).toMatch(/ status none restart last level outcome accepted /);
    // Week 3's test was not logged: one re-test, for both reasons; a goal that is not high-load gets the measured one.
    expect(retestTag()).toBe('break,not_logged');
    expect(weekInput().retest).toMatchObject({ ofWeek: 3 });
    expect(weekInput().retest?.easy).toBeUndefined();
    expect(db.week(4)).toMatchObject({ retestOfWeek: 3, breakDays: expect.any(Number) });
    readsAsStored();
  });

  it('an answer not at the restart level is retried; the second one is accepted', async () => {
    seed(3);
    after(3, 10);
    vi.mocked(generateStructuredContent)
      .mockResolvedValueOnce(modelAnswer(range(4, 12), range(13, 21)) as never)
      .mockResolvedValueOnce(modelAnswer(range(4, 12), SPREAD) as never);
    expect((await closeWeek()).status).toBe(200);
    expect(updatePrompt(1)).toContain("week 4's target must be exactly Weekly running distance: 12 km after the break");
    expect(valueOf(4)).toBe(12);
    expect(updateLines()[0]).toContain(' outcome retry_accepted ');
  });

  it('WU-59 (3): two rejected answers keep the restart, with its own line after the welcome-back line', async () => {
    seed(3);
    after(3, 10);
    expect((await closeWeek()).status).toBe(200);
    expect(generateStructuredContent).toHaveBeenCalledTimes(2);
    expect(valueOf(4)).toBe(12);
    expect(db.week(4).objective).toBe('Weekly running distance: 12 km');
    expect(insightOfWeek(3)).toBe(`${WELCOME_BACK_INSIGHT} ${RESTART_FALLBACK_INSIGHT.replace('{level}', '12 km')}`);
    expect(sentenceReason(RESTART_FALLBACK_INSIGHT.replace('{level}', '12 km'))).toBeNull();
    expect(updateLines()[0]).toMatch(/ status none restart last level outcome fallback held none lowered \d+ stored 4,/);
    expect(weekInput().target).toMatchObject({ value: 12 });
    readsAsStored();
  });

  it('WU-59 (3): a time out on a break keeps the restart too', async () => {
    seed(5);
    endurance();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    after(5, 12);
    vi.mocked(generateStructuredContent).mockReturnValue(new Promise(() => {}) as never);
    const closing = { ...structuredClone(db.goal()), roadmapWeeks: structuredClone(db.state.weeks), dailyTasks: structuredClone(db.tasksOf(5)) } as never;
    const pending = planWeeklyUpdate(closing, 5, { userId: USER.id, reflection: '', now: new Date() });
    for (let i = 0; i < 200 && vi.mocked(generateStructuredContent).mock.calls.length === 0; i++) await new Promise((resolve) => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(WEEKLY_UPDATE_TIME_LIMIT_MS);
    const update = (await pending) as PlannedUpdate;
    // Endurance, under 21 days away: back 1 week, so week 4's 13 km.
    expect(update).toMatchObject({ outcome: 'fallback', status: null, restart: 'back 1 week', reasons: ['time_limit'], insight: RESTART_FALLBACK_INSIGHT.replace('{level}', '13 km') });
    expect(update.weeks.find((week) => week.weekNumber === 6)?.target).toMatchObject({ value: 13 });
  });

  it('section 5 "Trained Mon and Tue of week 5, then away 3 weeks": the 3+ weeks rule (back 2 weeks), counted from Tuesday', async () => {
    seed(5, { done: 2 });
    endurance();
    // Week 6 should have started 17 days ago; from Tuesday of week 5 that is 23 days away.
    after(5, 17);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(6, 12), [12, 13.2, 14.5, 15.9, 17.4, 19.1, 21]) as never);
    expect((await closeWeek()).status).toBe(200);
    expect(db.week(6).breakDays).toBe(23);
    expect(restartTag()).toBe('back 2 weeks');
    expect(updatePrompt()).toContain("go back 2 weeks (week 3's target)");
    expect(values(6, 12)).toEqual([12, 13.2, 14.5, 15.9, 17.4, 19.1, 21]);
    // RULE-6, WU-18: the week the break started in stores no status.
    expect(db.week(5).updateStatus ?? null).toBeNull();
    expect(retestTag()).toBe('break,not_logged');
  });

  it('section 5 "Break in week 2, rule says back 2 weeks": restart at week 1\'s target', async () => {
    seed(2);
    endurance();
    after(2, 25);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(3, 12), [10, 11, 12, 13, 14, 15, 16.5, 18, 19.5, 21]) as never);
    expect((await closeWeek()).status).toBe(200);
    expect(restartTag()).toBe('back 2 weeks');
    expect(updatePrompt()).toContain("go back 2 weeks (week 1's target)");
    expect(updatePrompt()).toContain('- Week 3 must be exactly Weekly running distance: 10 km.');
    expect(valueOf(3)).toBe(10);
    expect(retestTag()).toBe('break,not_logged');
  });

  it('section 5 "Away 6 weeks, chose Keep going": the weeks left start at weekBack; the jumped weeks are never stored', async () => {
    seed(3);
    writerWithAnyRetest();
    db.goal().movedDays = 20;
    after(3, 20);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(6, 12), [12, 13.2, 14.5, 15.9, 17.4, 19.1, 21]) as never);
    expect((await closeWeek({ choice: 'keep_going' })).status).toBe(200);
    expect(db.goal().currentWeek).toBe(6);
    expect(updatePrompt()).toContain('one target for each of weeks 6, 7, 8, 9, 10, 11, 12, in order');
    expect(updatePrompt()).toContain('- Week 6 must be exactly Weekly running distance: 12 km.');
    // Jumped weeks keep their targets and are never in `stored` or `readBack`.
    expect([db.week(4), db.week(5)].map((week) => [week.jumped, week.target.value])).toEqual([
      [true, 13],
      [true, 14],
    ]);
    expect(tag('stored')).toBe('6,7,8,9,10,11');
    expect(tag('readBack')).toBe('none');
    expect(values(6, 12)).toEqual([12, 13.2, 14.5, 15.9, 17.4, 19.1, 21]);
    readsAsStored();
    expect(insightOfWeek(3)).toBe(`${KEEP_GOING_INSIGHT.replace('{n}', '6')} Next week builds on a strong one.`);
    // One re-test of week 3 (break and not logged), on week 6, stored there although weeks were jumped.
    expect(retestTag()).toBe('break,not_logged');
    expect(db.week(6).retestOfWeek).toBe(3);
    expect((await putResult(3, { value: 11.5, unit: 'km', passed: false })).status).toBe(200);
  });

  it('"Keep going" on a light-test goal jumping big week 4: the climb starts from the jumped week, as the read after the save does', async () => {
    // Weeks 4, 8 and 12 are big (12, 14, 17 km); light weeks store their next big week's target.
    const shows = (week: number) => (week <= 4 ? 12 : week <= 8 ? 14 : 17);
    seed(3, { targets: range(1, 12).map((week) => km(shows(week))), light: (week) => ![4, 8, 12].includes(week) });
    db.goal().movedDays = 20;
    after(3, 20);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer([8, 12], [12, 17]) as never);
    expect((await closeWeek({ choice: 'keep_going' })).status).toBe(200);
    expect(updatePrompt()).toContain('- Week 8 (next week shows it) must be exactly Weekly running distance: 12 km.');
    expect(values(6, 12)).toEqual([12, 12, 12, 17, 17, 17, 17]);
    expect(db.week(4)).toMatchObject({ jumped: true, target: km(12) });
    expect(tag('stored')).toBe('6,7,8');
    // Review fix 1: the first week the model sets after the restart week (8) is week 12, so no SAFETY line.
    expect(updatePrompt()).not.toContain('SAFETY');
    readsAsStored();
    // WU-56 (3): no re-test after a light closing week.
    expect(retestTag()).toBe('none');
  });

  it('section 5 "Away 7 weeks after week 10": the final week, no restart; the update still runs', async () => {
    seed(10);
    db.goal().movedDays = 20;
    after(10, 49);
    expect((await closeWeek({ mode: 'check' })).body).toMatchObject({ choice: 'final_week' });
    expect((await closeWeek({ choice: 'final_week' })).status).toBe(200);
    expect(db.goal().currentWeek).toBe(12);
    expect(generateStructuredContent).toHaveBeenCalled();
    expect(updatePrompt()).not.toContain('BREAK');
    expect(updatePrompt()).toContain('one target for each of weeks 12, in order');
    expect(restartTag()).toBe('none');
    expect(retestTag()).toBe('none');
    expect(tag('stored')).toBe('none');
    expect(insightOfWeek(10)).toBe(FINAL_WEEK_INSIGHT);
  });

  it('a high-load goal (run10k): the easy re-test from the start, which stores nothing (WU-41, WU-55)', async () => {
    const tests = pathwayFor('Run a 10k', null)!.weeklyTests!;
    const distance = (value: number): WeekTarget => ({ kind: 'number', metric: 'Continuous run distance', value, unit: 'km', direction: 'higher_is_better' });
    const shows = (week: number) => (week <= 4 ? 5 : week <= 8 ? 7 : 10);
    seed(4, {
      targets: range(1, 12).map((week) => distance(shows(week))),
      rawGoal: 'Run a 10k',
      testFor: (week, target) =>
        [4, 8, 12].includes(week) ? measuredPathwayTest(tests, target) : { type: 'timer', instructions: tests.light.instructions, passIf: 'Done as written', light: true },
      finalTest: measuredPathwayTest(tests, distance(10)).instructions,
    });
    writerWithAnyRetest();
    after(4, 10);
    expect((await closeWeek()).status).toBe(200);
    expect(retestTag()).toBe('break,not_logged');
    expect(weekInput().retest).toMatchObject({ ofWeek: 4, easy: true });
    // Review fix 6: the easy re-test is decided where the week is written, and logged there.
    expect(updateLines()).toContain('[WeeklyUpdate] goal g1 week 4 retest easy');
    expect(db.week(5).retestOfWeek ?? null).toBeNull();
    expect((await putResult(4, { value: 5, unit: 'km', passed: true })).body.reason).toBe('week_closed');
  });

  it('WU-38: a break that needs a choice is still refused before any model call', async () => {
    seed(3);
    db.goal().movedDays = 20;
    after(3, 20);
    expect((await closeWeek()).body.reason).toBe('choice_needed');
    expect((await review(3)).body.reason).toBe('choice_needed');
    expect(generateStructuredContent).not.toHaveBeenCalled();
    expect(updateLines()).toEqual([]);
  });

  it("RULE-6 (WU-18, WU-53): the week a break started in is not counted by the next close's two hard weeks or the daily-time check", async () => {
    seed(3);
    db.week(2).updateStatus = 'far_behind';
    after(3, 10);
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(modelAnswer(range(4, 12), SPREAD, { status: 'far_behind' }) as never);
    expect((await closeWeek()).status).toBe(200);
    expect(db.week(3).updateStatus ?? null).toBeNull();
    expect(retestTag()).toBe('break,not_logged');
    // Week 4 closes far_behind next: week 3 has no status, so no two hard weeks and no daily-time check after it.
    vi.mocked(console.log).mockClear();
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(
      modelAnswer(range(5, 12), [12, 13.2, 14.5, 15.9, 17.4, 19.1, 20.2, 21], { status: 'far_behind', messageToUser: "Next week stays at this week's distance." }) as never
    );
    const lastDay = db.tasksOf(4).map((task) => task.date).sort().pop()!;
    vi.setSystemTime(new Date(`${lastDay}T15:00:00Z`));
    expect((await review(4, { reflection: '', testResult: { value: 12, unit: 'km', passed: true } })).status).toBe(200);
    expect(db.week(4).updateStatus).toBe('far_behind');
    expect(retestTag()).toBe('none');
    expect(dailyTimeCheckOf(db.state.weeks, 30)).toBeNull();
  });
});

describe('M3.4 review fixes', () => {
  const endurance = () => (db.goal().roadmap.recovery = RECOVERY_TEMPLATES.endurance);

  it('1: on a break, SAFETY names the first week the model sets after the restart week, one safe step above the level', async () => {
    // 15 km in week 1, up 5 km a week: week 6 is 40, week 4 is 30. Endurance, 22 days away: back 2 weeks.
    seed(6, { targets: range(1, 12).map((week) => km(10 + 5 * week)) });
    endurance();
    after(6, 20);
    expect((await closeWeek()).status).toBe(200);
    expect(updatePrompt()).toContain('- Week 7 must be exactly Weekly running distance: 30 km.');
    const safety = updatePrompt().match(/- The most week (\d+) may be: ([\d.]+) km \(one safe step\)/);
    expect(safety?.[1]).toBe('8');
    expect(Number(safety?.[2])).toBe(nextSafeStep(km(30), 30, { run10k: false }));
  });

  it('2: the restart fallback line says " or less" for a lower-is-better target', async () => {
    const minutes = (value: number): WeekTarget => ({ kind: 'number', metric: 'Time to solve the puzzle set', value, unit: 'min', direction: 'lower_is_better' });
    seed(3, { targets: range(1, 12).map((week) => minutes(36 - week)) });
    after(3, 10);
    expect((await closeWeek()).status).toBe(200);
    expect(valueOf(4)).toBe(33);
    expect(insightOfWeek(3)).toBe(`${WELCOME_BACK_INSIGHT} ${RESTART_FALLBACK_INSIGHT.replace('{level}', '33 min or less')}`);
  });

  it('2: on a light-test goal whose next week is light, the fallback line names the big week', async () => {
    const shows = (week: number) => (week <= 4 ? 12 : week <= 8 ? 14 : 17);
    seed(3, { targets: range(1, 12).map((week) => km(shows(week))), light: (week) => ![4, 8, 12].includes(week) });
    db.goal().movedDays = 20;
    after(3, 20);
    expect((await closeWeek({ choice: 'keep_going' })).status).toBe(200);
    expect(values(6, 8)).toEqual([12, 12, 12]);
    expect(insightOfWeek(3)).toBe(`${KEEP_GOING_INSIGHT.replace('{n}', '6')} ${RESTART_FALLBACK_BIG_WEEK_INSIGHT.replace('{w}', '8').replace('{level}', '12 km')}`);
  });
});

describe('M3.4: the automatic close line after a break (WU-59 (6))', () => {
  const move = (over: Record<string, unknown>) => ({ gap: 10, days: 10, breakDays: 12, weekBack: 4, choice: null, choiceNeeded: null, ...over }) as never;
  const update = (insight: string) => ({ insight }) as PlannedUpdate;

  it.each([
    ['welcome back', move({}), WELCOME_BACK_INSIGHT],
    ['keep going', move({ choice: 'keep_going', weekBack: 6 }), KEEP_GOING_INSIGHT.replace('{n}', '6')],
    ['final week', move({ choice: 'final_week', weekBack: 12 }), FINAL_WEEK_INSIGHT],
  ])('%s: the welcome-back line, a space, then the sentence; only the welcome-back line after the neutral line', (_label, m, line) => {
    expect(autoCloseUpdateInsight(m, update('Next week picks up at 12 km.'))).toBe(`${line} Next week picks up at 12 km.`);
    expect(autoCloseUpdateInsight(m, update(AUTO_CLOSE_INSIGHT))).toBe(line);
  });

  it('also when the limit left no room to move (days 0)', () => {
    expect(autoCloseUpdateInsight(move({ days: 0 }), update('Next week picks up at 12 km.'))).toBe(`${WELCOME_BACK_INSIGHT} Next week picks up at 12 km.`);
  });
});
