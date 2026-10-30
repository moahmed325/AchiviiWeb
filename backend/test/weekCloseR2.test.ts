import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Weekly update M1.2a, R-2 (RULE-17, AC-17, WU-30 (4)): reconcile's body after the week change is the same whether the
// week was closed by an on-time review, by a review on the morning after the week ended (reconcile first, today's order)
// or by an automatic close on that morning (close first). That includes what `weekHandoff` reads from the finished week:
// in today's order reconcile may first write `toNextWeek` records onto it; with the close first it has not.
// The real reconcile, review, close and writeNextWeek run on the in-memory store; only the model call is replaced.

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./weekCloseStore.js')).db.prisma }));
vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn(),
}));
const handoffs = vi.hoisted(() => ({ results: [] as unknown[] }));
vi.mock('../src/lib/recovery/handoff.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/recovery/handoff.js')>();
  return {
    ...actual,
    weekHandoff: (...args: Parameters<typeof actual.weekHandoff>) => {
      const result = actual.weekHandoff(...args);
      handoffs.results.push(structuredClone(result));
      return result;
    },
  };
});

import { db } from './weekCloseStore.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';
import { generateWeekPlan, weekLayout, type WeekDayPlan } from '../src/lib/ai/weekPlan.js';
import { RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';

const USER = { id: 'u1', email: 'u1@achivii.com', timezone: 'UTC' };
const START = new Date('2026-09-21T00:00:00Z'); // week 2 is Mon 2026-09-28 to Sun 2026-10-04
const LANGUAGE = RECOVERY_TEMPLATES.language;
const LESSON = LANGUAGE.kinds.find((k) => k.inOrder && k.action === 'move')!.id;
const NOTES = LANGUAGE.kinds.find((k) => !k.inOrder && k.action === 'let_go')!.id;
const target = { kind: 'number', metric: 'Words', value: 100, unit: 'words', direction: 'higher_is_better' };
const test = { type: 'quiz', instructions: 'Take the quiz', passIf: '80%' };

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

/** Each practice day holds the next lesson, then notes. Lessons are numbered across weeks. */
function lessonDays(weekStart: Date, firstLesson: number, prefix: string): WeekDayPlan[] {
  let lesson = firstLesson;
  return weekLayout('steady', weekStart).map((day) => ({
    ...day,
    title: day.isRestDay ? 'Rest' : `${prefix} lesson ${lesson}`,
    durationMinutes: day.isRestDay ? 0 : 30,
    slotTime: '19:30',
    implementationIntention: '',
    detailedSteps: day.isRestDay ? [] : [step(`${prefix} lesson ${lesson++}`, 1, 20, LESSON), step(`Notes ${day.date}`, 2, 10, NOTES)],
    isKeySession: false,
    whyToday: '',
    minimumVersion: null,
  }));
}

const weekStart = (weekNumber: number) => new Date(START.getTime() + (weekNumber - 1) * 7 * 86_400_000);

/**
 * Week 1 closed by review and all done; week 2 open. `missed` lists week 2's practice-day indexes left undone (the rest
 * are done).
 */
function seed(missed: number[]) {
  db.state.goals.push({
    id: 'g1',
    userId: USER.id,
    status: 'active',
    planVersion: 2,
    currentWeek: 2,
    rawGoal: 'Learn Spanish',
    clarifiedOutcome: 'Hold a conversation',
    startDate: START,
    targetDate: new Date('2026-12-14T00:00:00Z'),
    routine: JSON.stringify({ dailyMinutes: 30, planVariant: 'steady', sleepTime: '23:00', preferredSlot: 'evening' }),
    roadmap: {
      finalGoal: 'Hold a conversation',
      finalTest: '',
      startingPoint: {},
      method: { name: 'Lessons', creator: '', rules: ['One lesson at a time'] },
      phases: [{ name: 'Base', purpose: 'Build.' }],
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
      phase: 'Base',
      theme: `Theme ${weekNumber}`,
      target,
      test,
      status: weekNumber === 1 ? 'completed' : weekNumber === 2 ? 'active' : 'pending',
      testResult: null,
      executionScore: null,
      reviewNotes: null,
      closedBy: weekNumber === 1 ? 'review' : null,
      closedAt: null,
    });
  }
  for (const weekNumber of [1, 2]) {
    let practice = 0;
    lessonDays(weekStart(weekNumber), weekNumber === 1 ? 1 : 6, 'Planned').forEach((day) => {
      const index = day.isRestDay ? -1 : practice++;
      db.state.tasks.push({
        id: `g1-d${(weekNumber - 1) * 7 + day.dayNumber}`,
        goalId: 'g1',
        weekNumber,
        dayNumber: (weekNumber - 1) * 7 + day.dayNumber,
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        title: day.title,
        isRestDay: day.isRestDay,
        isKeySession: false,
        isTestDay: day.isTestDay,
        status: day.isRestDay ? 'pending' : weekNumber === 2 && missed.includes(index) ? 'pending' : 'completed',
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
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.mocked(getAuthUser).mockResolvedValue(USER as never);
  vi.mocked(generateWeekPlan).mockImplementation(async (input) => lessonDays(input.weekStart, 100, 'Model'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
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
  const json = await res.json();
  expect(res.status, `${path} at ${at}: ${JSON.stringify(json)}`).toBe(200);
  return json;
}

const reconcile = (at: string) => post('/reconcile', at);
const reviewWeek2 = (at: string) => post('/weeks/2/review', at, { reflection: '' });
const closeWeek = (at: string) => post('/close-week', at);

/** Runs one way of closing week 2 from a fresh store; returns what R-2 compares. */
async function run(missed: number[], steps: (at: typeof TIMES) => Promise<void>, lastOpen = TIMES.lastDayMorning) {
  db.reset();
  handoffs.results = [];
  seed(missed);
  await reconcile(lastOpen); // the last ordinary open in week 2
  await steps(TIMES);
  expect(db.goal().currentWeek).toBe(3);
  const body = await reconcile(TIMES.after); // the open after the week change
  return {
    body,
    handoff: handoffs.results,
    week2: db.tasksOf(2).map(({ id, detailedSteps, durationMinutes, title }) => ({ id, detailedSteps, durationMinutes, title })),
    week3: db.tasksOf(3).map(({ id, detailedSteps, durationMinutes, title, date }) => ({ id, detailedSteps, durationMinutes, title, date })),
  };
}

const TIMES = {
  fridayEvening: '2026-10-02T18:00:00Z', // before Saturday, week 2's last practice day (and its test day)
  lastDayMorning: '2026-10-04T07:00:00Z', // Sunday, a rest day
  lastDayEvening: '2026-10-04T20:00:00Z', // before week 2's close (01:00 on Monday)
  morningAfter: '2026-10-05T08:00:00Z',
  morningAfterLater: '2026-10-05T08:01:00Z',
  after: '2026-10-05T08:02:00Z',
};

const onTimeReview = async (t: typeof TIMES) => {
  await reviewWeek2(t.lastDayEvening);
};
const reviewMorningAfter = async (t: typeof TIMES) => {
  await reconcile(t.morningAfter); // today's order: the open's reconcile runs first
  await reviewWeek2(t.morningAfterLater);
};
const closeMorningAfter = async (t: typeof TIMES) => {
  vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
  expect(await closeWeek(t.morningAfter)).toMatchObject({ due: true, closedBy: 'auto', nextWeekNumber: 3 });
  vi.stubEnv('WEEK_CLOSE_ENABLED', '');
};

describe.each([
  ['method-aware recovery on', 'true'],
  ['method-aware recovery off', ''],
])('R-2 with carry writes on, %s', (_name, method) => {
  beforeEach(() => {
    vi.stubEnv('MISSED_SESSIONS_CARRY_ENABLED', 'true');
    vi.stubEnv('METHOD_RECOVERY_ENABLED', method);
  });

  it('a week with one missed mid-week lesson: on-time review, review the morning after and close the morning after agree', async () => {
    const onTime = await run([1], onTimeReview);
    const reviewed = await run([1], reviewMorningAfter);
    const closed = await run([1], closeMorningAfter);
    expect(reviewed).toEqual(onTime);
    expect(closed).toEqual(onTime);
    if (method) expect(onTime.handoff).toHaveLength(1);
  });

  it('the reviews give the same result with WEEK_CLOSE_ENABLED on and off', async () => {
    const onTime = await run([1], onTimeReview);
    const reviewed = await run([1], reviewMorningAfter);
    vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
    expect(await run([1], onTimeReview)).toEqual(onTime);
    expect(await run([1], reviewMorningAfter)).toEqual(reviewed);
  });

  it('the last practice day left undone and first seen the morning after: reconcile first and close first agree', async () => {
    // Last open on Friday evening, so Saturday's miss is first seen on Monday morning: in today's order reconcile writes
    // what it hands on onto week 2 before the review's handoff reads it; with the close first the handoff reads it first.
    const reviewed = await run([1, 4], reviewMorningAfter, TIMES.fridayEvening);
    const closed = await run([1, 4], closeMorningAfter, TIMES.fridayEvening);
    expect(closed.handoff).toEqual(reviewed.handoff);
    expect(closed.week3).toEqual(reviewed.week3);
    expect(closed.body).toEqual(reviewed.body);
    expect(closed).toEqual(reviewed);
  });

  it('records for next week already on the finished week, and more first seen the morning after: both orders agree', async () => {
    // Tue and Wed missed by Friday evening: with the method switch on, Fri and Sat take lessons 7 and 8 and lessons 9 and
    // 10 are recorded for next week on Tuesday's step. Fri and Sat are then left undone too, first seen on Monday.
    const reviewed = await run([1, 2, 3, 4], reviewMorningAfter, TIMES.fridayEvening);
    const closed = await run([1, 2, 3, 4], closeMorningAfter, TIMES.fridayEvening);
    if (method) expect(reviewed.week2.some((day) => day.detailedSteps.includes('toNextWeek'))).toBe(true);
    if (method) expect(JSON.stringify(reviewed.handoff)).toContain('Planned lesson 9');
    expect(closed.handoff).toEqual(reviewed.handoff);
    expect(closed.week3).toEqual(reviewed.week3);
    expect(closed.body).toEqual(reviewed.body);
    expect(closed).toEqual(reviewed);
  });
});
