import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// B-46 (3): made-up people run a whole plan, day by day, through the real automatic close, reconcile and week writing
// on the in-memory store, with the production switches on (week close, carry-forward, method recovery) and only the
// model call replaced. After every open of the app, rules that must always hold are checked: no week written in the
// past, no lesson lost, no day longer than the daily time, week 12 still aims at the goal, and the person never stuck.

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
import { generateWeekPlan, weekLayout, type WeekDayPlan } from '../src/lib/ai/weekPlan.js';
import { RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';

const USER = { id: 'u1', email: 'u1@achivii.com', timezone: 'UTC' };
const START = new Date('2026-09-21T00:00:00Z');
const DAY = 86_400_000;
const DAILY_MINUTES = 30;
const LANGUAGE = RECOVERY_TEMPLATES.language;
const LESSON = LANGUAGE.kinds.find((k) => k.inOrder && k.action === 'move')!.id;
const NOTES = LANGUAGE.kinds.find((k) => !k.inOrder && k.action === 'let_go')!.id;
const TARGET = { kind: 'number', metric: 'Words', value: 100, unit: 'words', direction: 'higher_is_better' };
const TEST = { type: 'quiz', instructions: 'Take the quiz', passIf: '80%' };

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY);

const step = (title: string, priority: number, minutes: number, kind: string) => ({
  stepNumber: priority,
  title,
  durationMinutes: minutes,
  instructions: `Do ${title}.`,
  focusCue: '',
  pitfallToAvoid: '',
  priority,
  kind,
});

/** Every lesson the fake writer hands out, in order, so a lost one can be named. */
let nextLesson = 1;
const written: string[] = [];

/**
 * A steady week: each practice day holds the next lesson, then notes; 30 minutes in all. Like the real writer is asked
 * to (`handoffBrief`), the first lesson sessions hold a seat for each lesson still to do from last week (code puts that
 * lesson there), and new lessons continue after them.
 */
function lessonWeek(weekStart: Date, whereTheyAre: string[] = []): WeekDayPlan[] {
  const behind = whereTheyAre.find((line) => line.includes(`kind ${LESSON}`) && line.includes('have not done these steps yet'));
  // The quoted titles before "They are at": the steps still to do, in order.
  let seats = behind ? (behind.split('They are at')[0].match(/"Lesson \d+"/g) ?? []).length : 0;
  return weekLayout('steady', weekStart).map((day) => {
    const seat = !day.isRestDay && !day.isTestDay && seats > 0 ? (seats--, true) : false;
    const lesson = day.isRestDay ? null : seat ? `Seat ${day.date}` : `Lesson ${nextLesson++}`;
    if (lesson && !seat) written.push(lesson);
    return {
      ...day,
      title: lesson ?? 'Rest',
      durationMinutes: day.isRestDay ? 0 : DAILY_MINUTES,
      slotTime: '19:30',
      implementationIntention: '',
      detailedSteps: lesson ? [step(lesson, 1, 20, LESSON), step(`Notes ${day.date}`, 2, 10, NOTES)] : [],
      isKeySession: false,
      whyToday: '',
      minimumVersion: null,
    };
  });
}

/** Week 1 written at goal create; weeks 2 to 12 wait for the close. */
function seed() {
  db.state.goals.push({
    id: 'g1',
    userId: USER.id,
    status: 'active',
    planVersion: 2,
    currentWeek: 1,
    rawGoal: 'Learn Spanish',
    clarifiedOutcome: 'Hold a conversation',
    startDate: START,
    targetDate: addDays(START, 90),
    routine: JSON.stringify({ dailyMinutes: DAILY_MINUTES, planVariant: 'steady', sleepTime: '23:00', preferredSlot: 'evening' }),
    roadmap: {
      finalGoal: 'Learn 100 words',
      finalTest: '',
      startingPoint: {},
      method: { name: 'Lessons', creator: '', rules: ['One lesson at a time'] },
      phases: [
        { name: 'Base', purpose: 'Build.', startWeek: 1, endWeek: 4 },
        { name: 'Build', purpose: 'Grow.', startWeek: 5, endWeek: 12 },
      ],
      answers: [],
      recovery: LANGUAGE,
    },
    movedDays: 0,
    closeTriedAt: null,
    closeTriedWeek: null,
  });
  for (let weekNumber = 1; weekNumber <= 12; weekNumber++) {
    db.state.weeks.push({
      id: `w${weekNumber}`,
      goalId: 'g1',
      weekNumber,
      phase: weekNumber <= 4 ? 'Base' : 'Build',
      theme: `Theme ${weekNumber}`,
      target: { ...TARGET, value: weekNumber * 8 + 4 },
      test: TEST,
      status: weekNumber === 1 ? 'active' : 'pending',
      testResult: null,
      executionScore: null,
      reviewNotes: null,
      closedBy: null,
      closedAt: null,
    });
  }
  lessonWeek(START).forEach((day) => {
    db.state.tasks.push({
      id: `g1-d${day.dayNumber}`,
      goalId: 'g1',
      weekNumber: 1,
      dayNumber: day.dayNumber,
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      title: day.title,
      isRestDay: day.isRestDay,
      isKeySession: false,
      isTestDay: day.isTestDay,
      status: 'pending',
      usedMinimumVersion: false,
      notOffered: false,
      notes: null,
      durationMinutes: day.durationMinutes,
      detailedSteps: JSON.stringify(day.detailedSteps),
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
  nextLesson = 1;
  written.length = 0;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.mocked(getAuthUser).mockResolvedValue(USER as never);
  vi.mocked(generateWeekPlan).mockImplementation(async (input) => lessonWeek(input.weekStart, input.whereTheyAre));
  for (const method of ['log', 'warn', 'error', 'info'] as const) vi.spyOn(console, method).mockImplementation(() => {});
  // The production switch states (WEEKLY_UPDATE_ENABLED is off there).
  vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
  vi.stubEnv('MISSED_SESSIONS_CARRY_ENABLED', 'true');
  vi.stubEnv('METHOD_RECOVERY_ENABLED', 'true');
  vi.stubEnv('WEEKLY_UPDATE_ENABLED', '');
  vi.stubEnv('CUSTOM_RECOVERY_PROFILES_ENABLED', '');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function post(path: string, at: Date, body: unknown = {}) {
  vi.setSystemTime(at);
  const res = await fetch(`${baseUrl}/api/goal${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

interface Person {
  name: string;
  /** Days of the plan (0 = START) the person doesn't open the app. */
  away?: (day: number) => boolean;
  /** Whether they do the day's practice when they open it. */
  practises?: (day: number) => boolean;
}

const steps = (task: { detailedSteps: string }): Array<{ title: string; durationMinutes: number; toNextWeek?: Array<{ step: { title: string } }> }> =>
  JSON.parse(task.detailedSteps || '[]');

/** Every lesson title stored on any day, as a step or in a `toNextWeek` record. */
function storedLessons(): Set<string> {
  const titles = new Set<string>();
  for (const task of db.state.tasks) {
    for (const item of steps(task)) {
      if (/^Lesson \d+$/.test(item.title)) titles.add(item.title);
      for (const record of item.toNextWeek ?? []) titles.add(record.step.title);
    }
  }
  return titles;
}

/** Opens the app at 08:00 the way it does (close when due, then reconcile) and checks the rules. */
async function open(person: Person, day: number, problems: string[]) {
  const at = new Date(addDays(START, day).getTime() + 8 * 3_600_000);
  const today = dateKey(at);
  const where = `${person.name}, plan day ${day + 1} (${today})`;
  const weekBefore = db.goal().currentWeek;

  let close = await post('/close-week', at);
  if (close.status === 409 && close.body.reason === 'choice_needed') close = await post('/close-week', at, { choice: 'keep_going' });
  if (close.status !== 200) problems.push(`${where}: close answered ${close.status} ${JSON.stringify(close.body)}`);
  const reconcile = await post('/reconcile', at);
  if (reconcile.status !== 200) problems.push(`${where}: reconcile answered ${reconcile.status}`);

  const goal = db.goal();
  // Never stuck: one open never leaves a week due again, and the plan never runs past week 12.
  const again = await post('/close-week', at, { mode: 'check' });
  if (again.body.due === true && goal.currentWeek === weekBefore && close.body.due === true) problems.push(`${where}: still due after closing`);
  if (goal.currentWeek < 1 || goal.currentWeek > 12) problems.push(`${where}: currentWeek ${goal.currentWeek}`);

  // No week written in the past: a week this open wrote has no day before today that is offered.
  if (goal.currentWeek !== weekBefore) {
    for (const task of db.tasksOf(goal.currentWeek)) {
      if (task.date < today && !task.notOffered && !task.isRestDay) problems.push(`${where}: week ${goal.currentWeek} offers a past day ${task.date}`);
    }
  }
  // No day longer than the daily time.
  for (const task of db.state.tasks) {
    const minutes = steps(task).reduce((sum, item) => sum + (item.durationMinutes || 0), 0);
    if (minutes > DAILY_MINUTES) problems.push(`${where}: ${task.date} holds ${minutes} minutes`);
  }
  // No lesson lost: every lesson written is still stored somewhere (done, waiting, or listed for next week).
  const stored = storedLessons();
  for (const lesson of written) if (!stored.has(lesson)) problems.push(`${where}: ${lesson} is gone`);
  // Week 12 still aims at the goal.
  const week12 = db.week(12);
  if (week12.target?.value !== 100) problems.push(`${where}: week 12 aims at ${JSON.stringify(week12.target)}`);

  // They do today's practice if the plan offers it and they choose to.
  const task = db.state.tasks.find((t) => t.date === today && t.weekNumber === goal.currentWeek && !t.isRestDay && !t.notOffered);
  if (task && task.status !== 'completed' && (person.practises?.(day) ?? true)) {
    task.status = 'completed';
    task.completedAt = at;
  }
}

async function runPlan(person: Person) {
  seed();
  const problems: string[] = [];
  for (let day = 0; day < 140 && db.goal().status === 'active'; day++) {
    if (person.away?.(day)) continue;
    await open(person, day, problems);
    // Week 12 closed: the plan is done.
    if (db.week(12).status === 'completed') break;
  }
  return problems;
}

describe('90 days, made-up people (B-46 (3))', () => {
  it('Perfect Pat never misses: reaches week 12, nothing breaks', async () => {
    const problems = await runPlan({ name: 'Pat' });
    expect(problems).toEqual([]);
    expect(db.goal().currentWeek).toBe(12);
    expect(db.goal().movedDays).toBe(0);
  }, 120_000);

  it('Busy Sam skips about one day in three', async () => {
    const problems = await runPlan({ name: 'Sam', practises: (day) => day % 3 !== 1 });
    expect(problems).toEqual([]);
    expect(db.goal().currentWeek).toBe(12);
    // The run really hands missed lessons to the next week, so the lesson rule is tested.
    expect(vi.mocked(generateWeekPlan).mock.calls.some(([input]) => (input.whereTheyAre ?? []).length > 0)).toBe(true);
  }, 120_000);

  it('Sick Mia is away 10 days in week 5', async () => {
    const problems = await runPlan({ name: 'Mia', away: (day) => day >= 30 && day < 40 });
    expect(problems).toEqual([]);
    expect(db.goal().currentWeek).toBe(12);
    // The break moved the plan's dates.
    expect(db.goal().movedDays).toBeGreaterThan(0);
  }, 120_000);

  it('Gone Tom is away 6 weeks, comes back and keeps going', async () => {
    const problems = await runPlan({ name: 'Tom', away: (day) => day >= 15 && day < 57 });
    expect(problems).toEqual([]);
    expect(db.goal().currentWeek).toBe(12);
    expect(db.state.weeks.some((week) => week.jumped === true)).toBe(true);
  }, 120_000);
});
