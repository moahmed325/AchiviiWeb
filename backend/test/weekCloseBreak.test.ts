import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Weekly update M1.5a (RULE-13's break, RULE-16's date side, RULE-18, WU-18, WU-25 (3), WU-29, WU-35): a close after a
// gap of 7 days or more is a break. Its length (from the closing week's last done step) is stored as `breakDays` on the
// first week back, the week writer is told the days away and the return rule's note, a high-load goal's hard high-load
// steps start with the first-week-back line, and an automatic close says welcome back. The move is M1.4's.
// The real review, close and writeNextWeek run on the in-memory store; only the model call is replaced.

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./weekCloseStore.js')).db.prisma }));
vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn(),
}));

import { db } from './weekCloseStore.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';
import { buildWeekPrompt, firstWeekBackBlock, generateWeekPlan, weekLayout, type WeekCallInput, type WeekDayPlan } from '../src/lib/ai/weekPlan.js';
import type { DetailedStep } from '../src/lib/ai/goalDecomposer.js';
import { RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';
import type { RecoveryProfile } from '../src/lib/recovery/profile.js';
import { EASY_START_LINE, FIRST_WEEK_BACK_LINE } from '../src/lib/recovery/easyStart.js';
import { takesFirstWeekBackLine, withFirstWeekBackLines } from '../src/lib/recovery/firstWeekBack.js';
import { WELCOME_BACK_INSIGHT, breakLength, firstWeekBackFor, goalLoad, returnRuleEntry } from '../src/lib/weekClose/breaks.js';
import { MOVED_INSIGHT, autoCloseInsight, planWeekMove, saveWeekClose } from '../src/lib/weekClose/close.js';

const USER = { id: 'u1', email: 'u1@achivii.com', timezone: 'UTC' };
const START = new Date('2026-09-21T00:00:00Z'); // week 2 is Mon 2026-09-28 to Sun 2026-10-04; week 3 starts Mon 2026-10-05
const TARGET = new Date('2026-12-20T00:00:00Z');
const DAY = 86_400_000;
const LANGUAGE = RECOVERY_TEMPLATES.language;
const ENDURANCE = RECOVERY_TEMPLATES.endurance;
const target = { kind: 'number', metric: 'Minutes', value: 50, unit: 'min', direction: 'lower_is_better' };
const test = { type: 'run', instructions: 'Log the long run', passIf: 'done' };
const RUN_10K = { rawGoal: 'Run a 10K under 50 minutes', clarifiedOutcome: 'Finish a 10 km race in under 50:00' };
const SPANISH = { rawGoal: 'Learn Spanish', clarifiedOutcome: 'Hold a conversation' };
/** A custom goal whose profile has a high-load kind (WU-35 (4)): not `isHighLoadGoal`. */
const CUSTOM = { rawGoal: 'Get stronger at home with my own routine', clarifiedOutcome: 'Train three times a week' };
const STRENGTH_HIGH_LOAD: RecoveryProfile = {
  ...RECOVERY_TEMPLATES.strength,
  kinds: RECOVERY_TEMPLATES.strength.kinds.map((k) => (k.id === 'strength_workout' ? { ...k, highLoad: true } : k)),
};

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const shifted = (date: Date, days: number) => new Date(date.getTime() + days * DAY);
/** 08:00 UTC, `gap` days after week 3's planned start. */
const atGap = (gap: number) => `${addDays('2026-10-05', gap)}T08:00:00Z`;
const WEEK2 = weekLayout('steady', new Date('2026-09-28T00:00:00Z'));
const WEEK2_PRACTICE = WEEK2.filter((d) => !d.isRestDay).map((d) => d.date);

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

/** A week as the model writes it: on practice days the kinds `steps` gives; the test day holds the weekly test. */
function modelWeek(weekStart: Date, steps: () => DetailedStep[]): WeekDayPlan[] {
  return weekLayout('steady', weekStart).map((day) => ({
    ...day,
    title: day.isRestDay ? 'Rest' : 'Practice',
    durationMinutes: day.isRestDay ? 0 : 40,
    slotTime: '19:30',
    implementationIntention: '',
    detailedSteps: day.isRestDay ? [] : day.isTestDay ? [step('Weekly test: long run', 1, 40, 'weekly_test')] : steps(),
    isKeySession: false,
    whyToday: '',
    minimumVersion: day.isRestDay ? null : step('10-minute jog', 1, 10, 'easy_session', { highLoad: true }),
  }));
}
const languageWeek = (weekStart: Date) => modelWeek(weekStart, () => [step('Lesson', 1, 30, LANGUAGE.kinds.find((k) => k.inOrder)!.id)]);
const runWeek = (weekStart: Date) =>
  modelWeek(weekStart, () => [
    step('Intervals', 1, 20, 'quality_session', { highLoad: true }),
    step('Easy run', 2, 15, 'easy_session'),
    step('Mobility', 3, 5, 'strength_and_mobility'),
  ]);

interface SeedOptions {
  goal?: Record<string, unknown>;
  recovery?: RecoveryProfile | null;
  /** Week 2's practice dates marked done; every practice day by default. */
  done?: string[];
  /** Week 2's practice-day steps by date; one general step by default. */
  week2Steps?: (date: string, isTestDay: boolean) => DetailedStep[];
  /** Week 2's stored `breakDays` (it was a first week back). */
  week2BreakDays?: number;
}

/** Week 1 closed by review; week 2 open. */
function seed(options: SeedOptions = {}) {
  const done = new Set(options.done ?? WEEK2_PRACTICE);
  db.state.goals.push({
    id: 'g1',
    userId: USER.id,
    status: 'active',
    planVersion: 2,
    currentWeek: 2,
    ...SPANISH,
    startDate: START,
    targetDate: TARGET,
    routine: JSON.stringify({ dailyMinutes: 40, planVariant: 'steady', sleepTime: '23:00', preferredSlot: 'evening' }),
    roadmap: {
      finalGoal: 'The goal',
      finalTest: '',
      startingPoint: {},
      method: { name: 'Method', creator: '', rules: ['One step at a time'] },
      phases: [
        { name: 'Base', purpose: 'Build.', startWeek: 1, endWeek: 2 },
        { name: 'Build', purpose: 'Grow.', startWeek: 3, endWeek: 12 },
      ],
      answers: [],
      ...(options.recovery === null ? {} : { recovery: options.recovery ?? LANGUAGE }),
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
      breakDays: weekNumber === 2 ? options.week2BreakDays ?? null : null,
    });
  }
  WEEK2.forEach((day) => {
    db.state.tasks.push({
      id: `g1-d${7 + day.dayNumber}`,
      goalId: 'g1',
      weekNumber: 2,
      dayNumber: 7 + day.dayNumber,
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      title: day.isRestDay ? 'Rest' : 'Practice',
      isRestDay: day.isRestDay,
      isKeySession: false,
      isTestDay: day.isTestDay,
      status: !day.isRestDay && done.has(day.date) ? 'completed' : 'pending',
      usedMinimumVersion: false,
      notOffered: false,
      notes: null,
      durationMinutes: 40,
      detailedSteps: JSON.stringify(day.isRestDay ? [] : options.week2Steps?.(day.date, day.isTestDay) ?? [step('Practice', 1, 40, 'general')]),
      implementationIntention: '',
      whyToday: null,
      minimumVersion: null,
    });
  });
}

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
  vi.mocked(generateWeekPlan).mockImplementation(async (input) => languageWeek(input.weekStart));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  for (const name of ['WEEK_CLOSE_ENABLED', 'MISSED_SESSIONS_CARRY_ENABLED', 'METHOD_RECOVERY_ENABLED']) vi.stubEnv(name, '');
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

const closeWeek = (at: string) => post('/close-week', at);
const reviewWeek2 = (at: string) => post('/weeks/2/review', at, { reflection: 'Back now' });
const closeOn = () => vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
const writerInput = () => vi.mocked(generateWeekPlan).mock.calls.at(-1)![0];
const promptOf = (input: WeekCallInput) => buildWeekPrompt(input, weekLayout(input.planVariant, input.weekStart));
const week3Steps = () => db.tasksOf(3).map((t) => ({ date: t.date, rest: t.isRestDay, steps: JSON.parse(t.detailedSteps) as DetailedStep[], min: t.minimumVersion }));
const withLine = () => week3Steps().flatMap((d) => d.steps.filter((s) => s.instructions.startsWith(FIRST_WEEK_BACK_LINE)).map((s) => s.title));
const logged = () => vi.mocked(console.log).mock.calls.map((c) => String(c[0])).filter((line) => line.includes(' break '));
const lastPractice = WEEK2_PRACTICE[WEEK2_PRACTICE.length - 1];
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

describe('a break (RULE-13, WU-33 (2)), WEEK_CLOSE_ENABLED on', () => {
  beforeEach(closeOn);

  it.each([
    [6, false],
    [7, true],
    [10, true],
  ])('a gap of %i days is a break: %s', async (gap, isBreak) => {
    seed();
    expect((await closeWeek(atGap(gap))).status).toBe(200);
    // The move is M1.4's either way.
    expect(db.goal()).toMatchObject({ currentWeek: 3, movedDays: gap, startDate: shifted(START, gap), targetDate: shifted(TARGET, gap) });
    const back = daysBetween(lastPractice, addDays('2026-10-05', gap));
    expect(db.week(3).breakDays).toBe(isBreak ? back : null);
    expect(writerInput().firstWeekBack).toEqual(isBreak ? { awayDays: back, note: LANGUAGE.returnRule.firstWeekBack, length: 'any', restart: 'last level', highLoad: false, everyStep: false } : undefined);
    expect(db.state.reviews[0].aiAdaptationInsight).toBe(isBreak ? WELCOME_BACK_INSIGHT : MOVED_INSIGHT);
    expect(logged()).toHaveLength(isBreak ? 1 : 0);
  });

  it('the welcome-back line is exact', () => {
    expect(WELCOME_BACK_INSIGHT).toBe('Welcome back. Your plan picks up from here and now ends on {date}.');
  });

  it('trained the first two days of the week, then away 3 weeks: the length counts from the second day and picks "3+ weeks"', async () => {
    seed({ goal: RUN_10K, recovery: ENDURANCE, done: WEEK2_PRACTICE.slice(0, 2) });
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => runWeek(input.weekStart));
    expect((await closeWeek(atGap(21))).status).toBe(200);
    const length = daysBetween(WEEK2_PRACTICE[1], addDays('2026-10-05', 21));
    expect(length).toBeGreaterThanOrEqual(21);
    expect(db.week(3).breakDays).toBe(length);
    expect(writerInput().firstWeekBack).toMatchObject({ awayDays: length, length: '3+ weeks' });
    expect(logged()[0]).toBe(`[WeekClose] goal g1 week 2 break breakDays ${length} rule 3+ weeks highLoad true`);
  });

  it('nothing done in the closing week counts from its first day', async () => {
    seed({ done: [] });
    expect((await closeWeek(atGap(10))).status).toBe(200);
    expect(db.week(3).breakDays).toBe(daysBetween('2026-09-28', addDays('2026-10-05', 10)));
  });

  it('a failed write retried later counts the length to the first try (RULE-9)', async () => {
    seed();
    vi.mocked(generateWeekPlan).mockResolvedValueOnce(null);
    expect((await closeWeek(atGap(8))).status).toBe(503);
    expect(db.week(3).breakDays).toBeNull();
    expect((await closeWeek(atGap(12))).status).toBe(200);
    expect(db.week(3).breakDays).toBe(daysBetween(lastPractice, addDays('2026-10-05', 8)));
    expect(writerInput().firstWeekBack!.awayDays).toBe(daysBetween(lastPractice, addDays('2026-10-05', 8)));
  });

  it('a review that closes after a break keeps its own insight and answer, and stores breakDays too', async () => {
    seed();
    const res = await reviewWeek2(atGap(10));
    expect(res.status).toBe(200);
    expect(res.body.review.aiAdaptationInsight).toBe(`${WEEK2_PRACTICE.length} of ${WEEK2_PRACTICE.length} sessions done.`);
    expect(db.week(3).breakDays).toBe(daysBetween(lastPractice, addDays('2026-10-05', 10)));
    expect(writerInput().firstWeekBack).toBeDefined();
  });

  it('breakDays is stored by the request that wins only (WU-27): a losing save writes nothing', async () => {
    seed();
    const goal = { ...db.goal(), roadmapWeeks: db.state.weeks.filter((w) => w.goalId === 'g1'), dailyTasks: db.tasksOf(2) };
    const move = planWeekMove(goal, 2, new Date(atGap(10)), 'UTC', goal.dailyTasks)!;
    expect(move.breakDays).toBe(daysBetween(lastPractice, addDays('2026-10-05', 10)));
    db.week(2).status = 'completed'; // another close won
    const written = languageWeek(move.startDate);
    expect(await saveWeekClose({ goal: goal as never, weekNumber: 2, by: 'auto', written, insight: autoCloseInsight(move), move })).toBeNull();
    expect(db.week(3).breakDays).toBeNull();
    expect(db.state.reviews).toHaveLength(0);
  });

  it('a break whose overflow is under a whole week (room 4, gap 10) keeps the partial move and says welcome back (no choice, WU-37 (3))', async () => {
    seed({ goal: { movedDays: 24, startDate: shifted(START, 24), targetDate: shifted(TARGET, 24) } });
    // Week 3's planned start is now 2026-10-29; back on 2026-11-08 (a gap of 10, room for 4).
    expect((await closeWeek('2026-11-08T08:00:00Z')).status).toBe(200);
    expect(db.goal().movedDays).toBe(28);
    expect(db.state.reviews[0].aiAdaptationInsight).toBe(WELCOME_BACK_INSIGHT);
    expect(db.week(3).breakDays).not.toBeNull();
  });

  it('the stored rows of an older goal (targets, tests) do not change (RULE-18)', async () => {
    seed({ goal: RUN_10K, recovery: ENDURANCE });
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => runWeek(input.weekStart));
    const before = db.state.weeks.map((w) => [w.weekNumber, w.target, w.test]);
    expect((await closeWeek(atGap(10))).status).toBe(200);
    expect(db.state.weeks.map((w) => [w.weekNumber, w.target, w.test])).toEqual(before);
  });
});

describe('the note to the week writer (WU-25 (3), WU-29 (1))', () => {
  beforeEach(closeOn);

  it('the block: the days away, the restart level and the note; the "at or below" and load lines only for a high-load goal', () => {
    expect(firstWeekBackBlock({ firstWeekBack: { awayDays: 12, note: 'Easy sessions only, no quality session.', restart: 'back 1 week', highLoad: true } })).toBe(
      [
        '',
        '',
        'FIRST WEEK BACK (after a break; the limits below are checked)',
        '- They have been away 12 days. This is their first week back.',
        '- Restart level: go back one week: the level of the week before their last one.',
        '- For the first week back, the method says: Easy sessions only, no quality session.',
        '- Keep every session at or below what they last completed.',
        '- No time trial or all-out effort, no max or 1RM test, nothing to failure, no lift above 80% of 1RM, at least 3 reps in reserve. A week that breaks this is not saved.',
      ].join('\n')
    );
    expect(firstWeekBackBlock({ firstWeekBack: { awayDays: 9, note: 'Starts with fundamentals.', restart: 'last level', highLoad: false } })).toBe(
      [
        '',
        '',
        'FIRST WEEK BACK (after a break; nothing here is checked)',
        '- They have been away 9 days. This is their first week back.',
        '- Restart level: pick up at the level of the last week they trained.',
        '- For the first week back, the method says: Starts with fundamentals.',
      ].join('\n')
    );
    // No readable profile: only the days away.
    expect(firstWeekBackBlock({ firstWeekBack: { awayDays: 9, note: null, restart: null, highLoad: false } })).toBe(
      ['', '', 'FIRST WEEK BACK (after a break; nothing here is checked)', '- They have been away 9 days. This is their first week back.'].join('\n')
    );
    expect(firstWeekBackBlock({})).toBe('');
    const block = firstWeekBackBlock({ firstWeekBack: { awayDays: 30, note: ENDURANCE.returnRule.firstWeekBack, restart: 'back 2 weeks', highLoad: true } });
    expect(block).not.toMatch(/target|weekly test/i);
  });

  it('the week call gets the block at the end, with and without a profile; without a break the prompt is unchanged', async () => {
    seed({ goal: RUN_10K, recovery: ENDURANCE });
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => runWeek(input.weekStart));
    expect((await closeWeek(atGap(10))).status).toBe(200);
    const input = writerInput();
    expect(input.firstWeekBack).toMatchObject({ note: 'Easy sessions only, no quality session.', highLoad: true, length: '1-2 weeks', restart: 'back 1 week' });
    const prompt = promptOf(input);
    expect(prompt.endsWith(firstWeekBackBlock(input))).toBe(true);
    const { firstWeekBack: _ignored, ...withoutBreak } = input;
    expect(promptOf(withoutBreak)).toBe(prompt.slice(0, prompt.length - firstWeekBackBlock(input).length));
    expect(prompt).not.toMatch(/test day|weekly test step/i);
    expect(prompt).toContain('- No tests: no "weekly test", time trial or measuring session.');
    expect(promptOf({ ...withoutBreak, recovery: null })).not.toContain('FIRST WEEK BACK');
    expect(promptOf({ ...input, recovery: null }).endsWith(firstWeekBackBlock(input))).toBe(true);
  });

  it('the return rule entry: any, 1-2 weeks under 21 days, 3+ weeks from 21, none without a profile', () => {
    expect(returnRuleEntry(LANGUAGE, 40)).toEqual({ length: 'any', restart: 'last level' });
    expect(returnRuleEntry(ENDURANCE, 7)).toEqual({ length: '1-2 weeks', restart: 'back 1 week' });
    expect(returnRuleEntry(ENDURANCE, 20)).toEqual({ length: '1-2 weeks', restart: 'back 1 week' });
    expect(returnRuleEntry(ENDURANCE, 21)).toEqual({ length: '3+ weeks', restart: 'back 2 weeks' });
    expect(returnRuleEntry(null, 21)).toBeNull();
    const light = { highLoad: false, everyStep: false };
    expect(firstWeekBackFor(null, 12, light)).toEqual({ awayDays: 12, note: null, length: null, restart: null, highLoad: false, everyStep: false });
    expect(firstWeekBackFor(ENDURANCE, 12, { highLoad: true, everyStep: true })).toMatchObject({ note: ENDURANCE.returnRule.firstWeekBack, highLoad: true, everyStep: true });
  });

  it('goalLoad (WU-35 (4)), worked out once: high-load by goal or by a profile kind; every step only by goal', () => {
    expect(goalLoad(RUN_10K, ENDURANCE)).toEqual({ highLoad: true, everyStep: true });
    expect(goalLoad(RUN_10K, null)).toEqual({ highLoad: true, everyStep: true });
    expect(goalLoad(CUSTOM, STRENGTH_HIGH_LOAD)).toEqual({ highLoad: true, everyStep: false });
    expect(goalLoad(CUSTOM, RECOVERY_TEMPLATES.strength)).toEqual({ highLoad: false, everyStep: false });
    expect(goalLoad(SPANISH, null)).toEqual({ highLoad: false, everyStep: false });
  });

  it('breakLength: from the last done practice day, else the week first day; never below 0', () => {
    const row = (date: string, status = 'pending', extra = {}) => ({ date, status, isRestDay: false, notOffered: false, ...extra });
    expect(breakLength([row('2026-09-28', 'completed'), row('2026-09-29', 'completed'), row('2026-09-30')], '2026-09-28', '2026-10-26')).toBe(27);
    expect(breakLength([row('2026-09-28'), row('2026-09-29')], '2026-09-28', '2026-10-15')).toBe(17);
    // A rest day logged complete is not a done step; a not-offered day is never done.
    expect(breakLength([row('2026-09-28', 'completed'), row('2026-10-01', 'completed', { isRestDay: true }), row('2026-10-02', 'completed', { notOffered: true })], '2026-09-28', '2026-10-15')).toBe(17);
    expect(breakLength([], '2026-09-28', '2026-10-15')).toBe(17);
    expect(breakLength([row('2026-10-20', 'completed')], '2026-09-28', '2026-10-15')).toBe(0);
  });
});

describe('a high-load first week back (WU-29, WU-35)', () => {
  beforeEach(closeOn);

  it('run10k: the line goes first on every hard high-load step, once, and never on easy or non-physical steps or the 10-minute version', async () => {
    seed({ goal: RUN_10K, recovery: ENDURANCE });
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => runWeek(input.weekStart));
    expect((await closeWeek(atGap(10))).status).toBe(200);
    const practice = week3Steps().filter((d) => !d.rest);
    expect(practice.length).toBeGreaterThan(0);
    for (const day of practice) {
      expect(day.steps.map((s) => s.instructions)).toEqual([`${FIRST_WEEK_BACK_LINE}\nDo Intervals.`, 'Do Easy run.', 'Do Mobility.']);
      expect(day.steps.map((s) => s.durationMinutes)).toEqual([20, 15, 5]);
      expect((day.min as DetailedStep).instructions).toBe('Do 10-minute jog.');
    }
    expect(withLine().every((title) => title === 'Intervals')).toBe(true);
    expect(JSON.stringify(week3Steps())).not.toContain(EASY_START_LINE);
  });

  it('a custom goal whose profile has a high-load kind: its flagged hard steps get the line', async () => {
    seed({ goal: CUSTOM, recovery: STRENGTH_HIGH_LOAD });
    vi.mocked(generateWeekPlan).mockImplementation(async (input) =>
      modelWeek(input.weekStart, () => [step('Workout A', 1, 30, 'strength_workout', { highLoad: true }), step('Log food', 2, 10, 'nutrition_and_tracking')])
    );
    expect((await closeWeek(atGap(10))).status).toBe(200);
    expect(writerInput().highLoadGoal).toBe(false);
    expect(writerInput().firstWeekBack!.highLoad).toBe(true);
    expect(promptOf(writerInput())).toContain('- Keep every session at or below what they last completed.');
    expect(new Set(withLine())).toEqual(new Set(['Workout A']));
  });

  it('not on a goal that is not high-load, and not without a break', async () => {
    seed({ goal: CUSTOM, recovery: RECOVERY_TEMPLATES.strength });
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => modelWeek(input.weekStart, () => [step('Workout A', 1, 30, 'strength_workout')]));
    expect((await closeWeek(atGap(10))).status).toBe(200);
    expect(withLine()).toEqual([]);
    expect(promptOf(writerInput())).not.toContain('at or below');

    db.reset();
    seed({ goal: RUN_10K, recovery: ENDURANCE });
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => runWeek(input.weekStart));
    expect((await closeWeek(atGap(6))).status).toBe(200);
    expect(withLine()).toEqual([]);
  });

  it('withFirstWeekBackLines is pure and adds the line once; rest days and unchanged days are returned as they were', () => {
    const days = runWeek(new Date('2026-10-15T00:00:00Z'));
    const once = withFirstWeekBackLines(days, ENDURANCE, true);
    const twice = withFirstWeekBackLines(once, ENDURANCE, true);
    expect(twice).toEqual(once);
    expect(days[0].detailedSteps[0].instructions).toBe('Do Intervals.');
    const rest = days.findIndex((d) => d.isRestDay);
    expect(once[rest]).toBe(days[rest]);
    // No readable profile: every high-load step, since nothing says which are hard.
    expect(takesFirstWeekBackLine(step('Easy run', 2, 15, 'easy_session'), null, true)).toBe(true);
    expect(takesFirstWeekBackLine(step('Easy run', 2, 15, 'easy_session'), ENDURANCE, true)).toBe(false);
    expect(takesFirstWeekBackLine(step('Notes', 2, 15, 'notes'), null, false)).toBe(false);
  });

  it('never fails the week: a throw while adding the line keeps the week as written', async () => {
    seed({ goal: RUN_10K, recovery: ENDURANCE });
    // The first read of a step's kind (by the line's check) throws; later reads (the save) work.
    let thrown = false;
    const throwsOnce = (s: DetailedStep): DetailedStep =>
      Object.defineProperty({ ...s }, 'kind', {
        enumerable: true,
        get: () => {
          if (thrown) return s.kind;
          thrown = true;
          throw new Error('boom');
        },
      });
    vi.mocked(generateWeekPlan).mockImplementation(async (input) =>
      runWeek(input.weekStart).map((d, i) => (i === 0 ? { ...d, detailedSteps: d.detailedSteps.map(throwsOnce) } : d))
    );
    expect((await closeWeek(atGap(10))).status).toBe(200);
    expect(thrown).toBe(true);
    expect(db.tasksOf(3)).toHaveLength(7);
    expect(withLine()).toEqual([]);
    expect(console.error).toHaveBeenCalledWith('[PlanV2] Could not add the first-week-back line:', expect.any(Error));
  });
});

describe('M1.5a review: the line belongs to the week, through the real close (METHOD_RECOVERY_ENABLED on)', () => {
  beforeEach(() => {
    closeOn();
    vi.stubEnv('METHOD_RECOVERY_ENABLED', 'true');
  });

  const WARM_UP = 'Start with an easy 5-minute warm-up and end with 5 easy minutes.';
  const lastPracticeDay = WEEK2.filter((d) => !d.isRestDay && !d.isTestDay).at(-1)!.date;
  /** Week 2: a workout on every practice day (the test day keeps the test); the last one is not done. */
  const workouts = (line: boolean) => ({
    goal: CUSTOM,
    recovery: STRENGTH_HIGH_LOAD,
    done: WEEK2_PRACTICE.filter((date) => date !== lastPracticeDay),
    week2Steps: (date: string, isTestDay: boolean) =>
      isTestDay
        ? [step('Weekly test: long run', 1, 40, 'weekly_test')]
        : [step(`Workout ${date}`, 1, 30, 'strength_workout', { highLoad: true, ...(line ? { instructions: `${FIRST_WEEK_BACK_LINE}\nDo Workout ${date}.` } : {}) })],
  });
  const newWeek = (input: WeekCallInput) =>
    modelWeek(input.weekStart, () => [step('Workout A', 1, 30, 'strength_workout', { highLoad: true }), step('Log food', 2, 10, 'nutrition_and_tracking')]);
  const handedOn = () => week3Steps().flatMap((d) => d.steps).find((s) => s.title === `Workout ${lastPracticeDay}`);

  it('a hard high-load step handed into the first week back gets the line once, before the warm-up line', async () => {
    seed(workouts(false));
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => newWeek(input));
    expect((await closeWeek(atGap(10))).status).toBe(200);
    expect(handedOn()!.instructions).toBe(`${FIRST_WEEK_BACK_LINE}\n${WARM_UP}\nDo Workout ${lastPracticeDay}.`);
    expect(JSON.stringify(week3Steps())).not.toContain(EASY_START_LINE);
  });

  it('a step handed on out of a first week back (week 2) into a normal week leaves the line behind', async () => {
    seed({ ...workouts(true), week2BreakDays: 12 });
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => newWeek(input));
    expect((await closeWeek(atGap(0))).status).toBe(200);
    expect(db.week(3).breakDays).toBeNull();
    expect(handedOn()!.instructions).toBe(`${WARM_UP}\nDo Workout ${lastPracticeDay}.`);
    expect(withLine()).toEqual([]);
  });
});

describe('WEEK_CLOSE_ENABLED off (RULE-18, R-7, AC-19)', () => {
  // M4.1b (WU-62 (1)): state A (the switch unset).
  it.each([
    ['the switch unset', ''],
  ])('%s: a late review after 10 days: no break, no breakDays, no block, no line, the review insight', async (_name, _update) => {
    vi.stubEnv('WEEK_CLOSE_ENABLED', '');
    seed({ goal: RUN_10K, recovery: ENDURANCE });
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => runWeek(input.weekStart));
    const res = await reviewWeek2(atGap(10));
    expect(res.status).toBe(200);
    expect(db.week(3).breakDays).toBeNull();
    expect('firstWeekBack' in writerInput()).toBe(false);
    expect(promptOf(writerInput())).not.toContain('FIRST WEEK BACK');
    expect(withLine()).toEqual([]);
    expect(db.state.reviews[0].aiAdaptationInsight).toBe(`${WEEK2_PRACTICE.length} of ${WEEK2_PRACTICE.length} sessions done.`);
    expect(logged()).toEqual([]);
  });
});

describe('R-2: a normal week change with nobody away', () => {
  it('the week call and the stored week are the same with WEEK_CLOSE_ENABLED on and off', async () => {
    const run = async (on: boolean) => {
      db.reset();
      vi.mocked(generateWeekPlan).mockClear();
      vi.stubEnv('WEEK_CLOSE_ENABLED', on ? 'true' : '');
      seed({ goal: RUN_10K, recovery: ENDURANCE });
      vi.mocked(generateWeekPlan).mockImplementation(async (input) => runWeek(input.weekStart));
      expect((await reviewWeek2('2026-10-04T18:00:00Z')).status).toBe(200);
      return { input: writerInput(), week: week3Steps(), breakDays: db.week(3).breakDays, insight: db.state.reviews[0].aiAdaptationInsight };
    };
    const off = await run(false);
    const on = await run(true);
    expect(on).toEqual(off);
    expect('firstWeekBack' in on.input).toBe(false);
  });
});
