import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Weekly update M1.5b (RULE-15, WU-37 to WU-40): a break past the limit waits for the person's choice. "Keep going" moves
// the plan by the most days within the room that make a week start on the first try's date, jumps the weeks in between
// and writes that week; past week 12, "Do my final week" starts week 12 on that date. Nothing is written while the choice
// waits, and the review is refused. The real review, close and writeNextWeek run on the in-memory store; only the model
// call is replaced.

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
import { FINAL_WEEK_DATE_INSIGHT, FINAL_WEEK_INSIGHT, KEEP_GOING_INSIGHT, fixedDateRoom, pastLimitMove } from '../src/lib/weekClose/breaks.js';
import { autoCloseInsight, jumpedWeeks, planWeekMove, saveWeekClose } from '../src/lib/weekClose/close.js';
import { weekStartFor } from '../src/lib/planV2.js';

const USER = { id: 'u1', email: 'u1@achivii.com', timezone: 'UTC' };
const START = new Date('2026-09-21T00:00:00Z'); // a Monday
const TARGET = new Date('2026-12-20T00:00:00Z');
const DAY = 86_400_000;
const LANGUAGE = RECOVERY_TEMPLATES.language;
const target = { kind: 'number', metric: 'Minutes', value: 50, unit: 'min', direction: 'lower_is_better' };
const test = { type: 'run', instructions: 'Log the long run', passIf: 'done' };

const iso = (date: Date) => date.toISOString().slice(0, 10);
const shifted = (date: Date, days: number) => new Date(date.getTime() + days * DAY);

/** A week as the model writes it: one general step on each practice day. */
function modelWeek(weekStart: Date): WeekDayPlan[] {
  return weekLayout('steady', weekStart).map((day) => ({
    ...day,
    title: day.isRestDay ? 'Rest' : 'Practice',
    durationMinutes: day.isRestDay ? 0 : 40,
    slotTime: '19:30',
    implementationIntention: '',
    detailedSteps: day.isRestDay
      ? []
      : [{ stepNumber: 1, title: 'Lesson', durationMinutes: 30, instructions: 'Do the lesson.', focusCue: '', pitfallToAvoid: '', priority: 1, kind: 'general' }],
    isKeySession: false,
    whyToday: '',
    minimumVersion: null,
  }));
}

/**
 * Week `open` open (every earlier week closed by review), `movedDays` already moved; its practice days all done.
 * `fixedDate` (B-106): the goal's fixed date, null for none.
 */
function seed(open: number, movedDays = 0, fixedDate: Date | null = null) {
  const start = shifted(START, movedDays);
  db.state.goals.push({
    id: 'g1',
    userId: USER.id,
    status: 'active',
    planVersion: 2,
    currentWeek: open,
    rawGoal: 'Learn Spanish',
    clarifiedOutcome: 'Hold a conversation',
    startDate: start,
    targetDate: shifted(TARGET, movedDays),
    routine: JSON.stringify({ dailyMinutes: 40, planVariant: 'steady', sleepTime: '23:00', preferredSlot: 'evening' }),
    roadmap: {
      finalGoal: 'The goal',
      finalTest: '',
      startingPoint: {},
      method: { name: 'Method', creator: '', rules: ['One step at a time'] },
      phases: [{ name: 'Build', purpose: 'Grow.', startWeek: 1, endWeek: 12 }],
      answers: [],
      recovery: LANGUAGE,
    },
    movedDays,
    closeTriedAt: null,
    closeTriedWeek: null,
    fixedDate,
  });
  for (let weekNumber = 1; weekNumber <= 12; weekNumber++) {
    db.state.weeks.push({
      id: `w${weekNumber}`,
      goalId: 'g1',
      weekNumber,
      phase: 'Build',
      theme: `Theme ${weekNumber}`,
      target: { ...target, value: 60 - weekNumber },
      test,
      status: weekNumber < open ? 'completed' : weekNumber === open ? 'active' : 'pending',
      testResult: null,
      executionScore: null,
      reviewNotes: null,
      closedBy: weekNumber < open ? 'review' : null,
      closedAt: null,
      breakDays: null,
      jumped: false,
    });
  }
  const days = weekLayout('steady', weekStartFor(start, open));
  days.forEach((day) => {
    db.state.tasks.push({
      id: `g1-w${open}-d${day.dayNumber}`,
      goalId: 'g1',
      weekNumber: open,
      dayNumber: (open - 1) * 7 + day.dayNumber,
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      title: day.isRestDay ? 'Rest' : 'Practice',
      isRestDay: day.isRestDay,
      isKeySession: false,
      isTestDay: day.isTestDay,
      status: day.isRestDay ? 'pending' : 'completed',
      usedMinimumVersion: false,
      notOffered: false,
      notes: null,
      durationMinutes: 40,
      detailedSteps: JSON.stringify(day.isRestDay ? [] : [{ stepNumber: 1, title: 'Practice', durationMinutes: 40, instructions: '', focusCue: '', pitfallToAvoid: '', priority: 1, kind: 'general' }]),
      implementationIntention: '',
      whyToday: null,
      minimumVersion: null,
    });
  });
}

/** 08:00 UTC, `gap` days after week `open + 1`'s planned start (from the seeded, already moved, start). */
const atGap = (open: number, gap: number, movedDays = 0) => `${iso(shifted(weekStartFor(shifted(START, movedDays), open + 1), gap))}T08:00:00Z`;

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
  vi.mocked(generateWeekPlan).mockImplementation(async (input) => modelWeek(input.weekStart));
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

const closeOn = () => vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
const check = (at: string) => post('/close-week', at, { mode: 'check' });
const close = (at: string, choice?: string) => post('/close-week', at, choice ? { choice } : {});
const logLines = (needle: string) => vi.mocked(console.log).mock.calls.map((c) => String(c[0])).filter((line) => line.includes(needle));
/** Everything but the first try, which `check` may record. */
const stored = () => {
  const { goals, ...rest } = structuredClone(db.state);
  return { ...rest, goals: goals.map(({ closeTriedAt: _a, closeTriedWeek: _b, ...goal }) => goal) };
};

describe('pastLimitMove: how far "Keep going" moves (WU-37 (1))', () => {
  it.each([
    // [gap, room, closedWeek, days, weekBack]
    [42, 28, 2, 28, 5], // no limit used: 42 - 28 = 14, weeks 3 and 4 jumped
    [45, 28, 2, 24, 6], // 45 - 24 = 21: weeks 3 to 5 jumped, week 6 starts today
    [48, 28, 2, 27, 6], // 48 - 27 = 21
    [10, 3, 2, 3, 4], // 10 - 3 = 7: aligned, week 3 jumped, week 4 starts today
    [10, 2, 2, 2, 4], // no aligned d (room < gap mod 7): moves the room; week 4 holds today on its 2nd day
    [14, 0, 2, 0, 5], // room 0, aligned with no move
    [10, 0, 2, 0, 4], // room 0, not aligned
  ])('gap %i, room %i, week %i closing: moves %i, first week back %i', (gap, room, closedWeek, days, weekBack) => {
    expect(pastLimitMove(gap, room, closedWeek)).toEqual({ choice: 'keep_going', days, weekBack });
  });

  it('needs no choice for an overflow under a whole week, a gap that is not a break, or week 12', () => {
    expect(pastLimitMove(10, 4, 2)).toBeNull(); // overflow 6
    expect(pastLimitMove(10, 3, 2)).not.toBeNull(); // overflow 7
    expect(pastLimitMove(6, 0, 2)).toBeNull(); // not a break
    expect(pastLimitMove(30, 28, 2)).toBeNull(); // fits within the room
    expect(pastLimitMove(60, 0, 12)).toBeNull(); // RULE-11
  });

  it('past week 12 (WU-38 (2)): week 10 closing, away 7 weeks, offers the final week, past the 28-day limit', () => {
    expect(pastLimitMove(49, 28, 10)).toEqual({ choice: 'final_week', days: 42, weekBack: 12 });
    // Week 11 closing: nothing is jumped; week 12 moves the whole gap.
    expect(pastLimitMove(14, 0, 11)).toEqual({ choice: 'final_week', days: 14, weekBack: 12 });
  });

  it('jumpedWeeks lists the weeks in between, none for an ordinary close', () => {
    expect(jumpedWeeks(2, { weekBack: 6 })).toEqual([3, 4, 5]);
    expect(jumpedWeeks(2, { weekBack: 3 })).toEqual([]);
    expect(jumpedWeeks(11, { weekBack: 12 })).toEqual([]);
    expect(jumpedWeeks(2, null)).toEqual([]);
  });
});

describe('the choice past the limit, WEEK_CLOSE_ENABLED on', () => {
  beforeEach(closeOn);

  it('check answers the choice and the break, and writes nothing but the first try', async () => {
    seed(2);
    const before = stored();
    expect((await check(atGap(2, 45))).body).toEqual({ due: true, weekNumber: 2, break: true, choice: 'keep_going' });
    expect(stored()).toEqual(before);
    expect(db.goal().closeTriedWeek).toBe(2);
    expect(generateWeekPlan).not.toHaveBeenCalled();
  });

  it('a close without the choice gets 409 choice_needed, saves nothing and calls no model', async () => {
    seed(2);
    await check(atGap(2, 45));
    const before = structuredClone(db.state);
    expect(await close(atGap(2, 45))).toEqual({ status: 409, body: { error: 'Choose how to continue on Today first.', reason: 'choice_needed', choice: 'keep_going' } });
    // The other choice is not this break's: refused the same way.
    expect((await close(atGap(2, 45), 'final_week')).body.reason).toBe('choice_needed');
    expect(db.state).toEqual(before);
    expect(generateWeekPlan).not.toHaveBeenCalled();
  });

  it('"Keep going" after 45 days: weeks 3 to 5 jumped, week 6 written from today, the move, the line, all in the close', async () => {
    seed(2);
    const at = atGap(2, 45); // 2026-11-19
    const res = await close(at, 'keep_going');
    expect(res.status).toBe(200);
    expect(res.body.nextWeekNumber).toBe(6);
    expect(db.goal()).toMatchObject({ currentWeek: 6, movedDays: 24, startDate: shifted(START, 24), targetDate: shifted(TARGET, 24) });
    expect(db.week(2)).toMatchObject({ status: 'completed', closedBy: 'auto', jumped: false });
    for (const n of [3, 4, 5]) {
      expect(db.week(n)).toMatchObject({ jumped: true, status: 'completed', closedBy: 'jumped', closedAt: new Date(at) });
      expect(db.tasksOf(n)).toEqual([]);
      // The target is kept (WU-19).
      expect(db.week(n).target.value).toBe(60 - n);
    }
    expect(db.week(6)).toMatchObject({ status: 'active', jumped: false });
    expect(db.week(6).breakDays).toBeGreaterThanOrEqual(45);
    expect(db.week(7).status).toBe('pending');
    // Week 6 starts today, so no day is not offered.
    expect(db.tasksOf(6)[0].date).toBe('2026-11-19');
    expect(db.tasksOf(6).filter((t) => t.notOffered)).toEqual([]);
    // One review row, the closing week's, with the line.
    expect(db.state.reviews.map((r) => [r.weekNumber, r.aiAdaptationInsight])).toEqual([[2, 'Welcome back. Your plan picks up at week 6 and now ends on {date}.']]);
    // The writer wrote week 6 from the closing week (last week's result is week 2's).
    const input = vi.mocked(generateWeekPlan).mock.calls[0][0];
    expect(input.weekNumber).toBe(6);
    expect(input.weekStart).toEqual(new Date('2026-11-19T00:00:00Z'));
    expect(input.lastWeek).toMatchObject({ planned: expect.any(Number), done: expect.any(Number) });
    expect(input.firstWeekBack).toBeDefined();
    expect(logLines(' jumped ')).toEqual(['[WeekClose] goal g1 week 2 jumped 3-5 moved 24 choice keep_going']);
    expect(logLines('past the limit')).toEqual([]);
  });

  it('a second open after "Keep going" is not due (the old re-close bug)', async () => {
    seed(2);
    expect((await close(atGap(2, 45), 'keep_going')).status).toBe(200);
    expect((await check(`${atGap(2, 45).slice(0, 10)}T20:00:00Z`)).body).toEqual({ due: false });
    expect((await check(atGap(2, 46))).body).toEqual({ due: false });
    expect(generateWeekPlan).toHaveBeenCalledTimes(1);
  });

  it('room 3, gap 10: moves 3, week 3 jumped, week 4 starts today', async () => {
    seed(2, 25);
    const at = atGap(2, 10, 25);
    expect((await check(at)).body.choice).toBe('keep_going');
    expect((await close(at, 'keep_going')).status).toBe(200);
    expect(db.goal()).toMatchObject({ currentWeek: 4, movedDays: 28 });
    expect(db.week(3).jumped).toBe(true);
    expect(db.tasksOf(4)[0].date).toBe(at.slice(0, 10));
    expect(db.tasksOf(4).filter((t) => t.notOffered)).toEqual([]);
  });

  it('room 2, gap 10: moves 2, week 3 jumped, week 4 holds today on its second day, its first day not offered', async () => {
    seed(2, 26);
    const at = atGap(2, 10, 26);
    expect((await close(at, 'keep_going')).status).toBe(200);
    expect(db.goal()).toMatchObject({ currentWeek: 4, movedDays: 28 });
    expect(db.week(3).jumped).toBe(true);
    const week4 = db.tasksOf(4);
    expect(week4[1].date).toBe(at.slice(0, 10));
    expect(week4.filter((t) => t.notOffered).map((t) => t.date)).toEqual([week4[0].date]);
    expect(db.state.reviews[0].aiAdaptationInsight).toBe(KEEP_GOING_INSIGHT.replace('{n}', '4'));
  });

  it('overflow 6 (room 4, gap 10): no choice; M1.5a\'s partial move and welcome back', async () => {
    seed(2, 24);
    const at = atGap(2, 10, 24);
    expect((await check(at)).body).toMatchObject({ break: true, choice: null });
    expect((await close(at)).status).toBe(200);
    expect(db.goal()).toMatchObject({ currentWeek: 3, movedDays: 28 });
    expect(db.state.weeks.filter((w) => w.jumped)).toEqual([]);
  });

  it('past week 12: week 10 closing, away 7 weeks, "Do my final week" starts week 12 today, moved past 28 and logged', async () => {
    seed(10);
    const at = atGap(10, 49);
    expect((await check(at)).body.choice).toBe('final_week');
    expect((await close(at, 'keep_going')).body.choice).toBe('final_week');
    expect((await close(at, 'final_week')).status).toBe(200);
    expect(db.goal()).toMatchObject({ currentWeek: 12, movedDays: 42, startDate: shifted(START, 42), targetDate: shifted(TARGET, 42) });
    expect(db.week(11)).toMatchObject({ jumped: true, status: 'completed', closedBy: 'jumped' });
    expect(db.week(12)).toMatchObject({ status: 'active', jumped: false });
    expect(db.tasksOf(12)[0].date).toBe(at.slice(0, 10));
    expect(db.state.reviews.map((r) => r.aiAdaptationInsight)).toEqual([FINAL_WEEK_INSIGHT]);
    expect(logLines(' jumped ')).toEqual(['[WeekClose] goal g1 week 10 jumped 11-11 moved 42 choice final_week']);
    expect(logLines('fixedDate')).toEqual([]);
    expect(logLines('past the limit')).toEqual(['[WeekClose] goal g1 week 10 past the limit movedDays 42']);
  });

  it('the review is refused with 409 choice_needed before any model call and saves nothing (WU-38 (1))', async () => {
    seed(2);
    const before = structuredClone(db.state);
    const res = await post('/weeks/2/review', atGap(2, 45), { reflection: 'Back now' });
    expect(res).toEqual({ status: 409, body: { error: 'Choose how to continue on Today first.', reason: 'choice_needed', choice: 'keep_going' } });
    expect(db.state).toEqual(before);
    expect(generateWeekPlan).not.toHaveBeenCalled();
  });

  it('a losing request saves nothing: no jumped week, no move (WU-27)', async () => {
    seed(2);
    const goal = { ...db.goal(), roadmapWeeks: db.state.weeks, dailyTasks: db.tasksOf(2) };
    const move = planWeekMove(goal, 2, new Date(atGap(2, 45)), 'UTC', goal.dailyTasks, 'keep_going')!;
    expect(move).toMatchObject({ choice: 'keep_going', weekBack: 6, days: 24 });
    db.week(2).status = 'completed'; // another close won
    const before = structuredClone(db.state);
    expect(await saveWeekClose({ goal: goal as never, weekNumber: 2, by: 'auto', written: modelWeek(move.startDate), insight: autoCloseInsight(move), move })).toBeNull();
    expect(db.state).toEqual(before);
  });

  it('all or nothing: a failure while saving the first week back leaves the jumped weeks and the move unsaved', async () => {
    seed(2);
    db.failCreate = true;
    const before = stored();
    expect((await close(atGap(2, 45), 'keep_going')).status).toBe(500);
    expect(stored()).toEqual(before);
  });

  it('with the method switch on, the handoff reads the closing week and the week before it, never a jumped week', async () => {
    vi.stubEnv('METHOD_RECOVERY_ENABLED', 'true');
    seed(2);
    expect((await close(atGap(2, 45), 'keep_going')).status).toBe(200);
    const reads = vi.mocked(db.prisma.dailyTask.findMany).mock.calls.map((c: any[]) => c[0].where.weekNumber);
    expect(reads).toContain(1);
    expect(reads.filter((n: unknown) => n === 3 || n === 4 || n === 5)).toEqual([]);
  });
});

describe('the check answers whether it was a break (WU-39)', () => {
  beforeEach(closeOn);

  it.each([
    [1, false],
    [4, false],
    [7, true],
    [10, true],
  ])('a gap of %i days: break %s', async (gap, isBreak) => {
    seed(2);
    expect((await check(atGap(2, gap))).body).toEqual({ due: true, weekNumber: 2, break: isBreak, choice: null });
  });
});

describe('switch off (R-7, AC-19)', () => {
  // M4.1b (WU-62 (1)): state A (the switch unset).
  it.each([
    ['the switch unset', ''],
  ])('%s: no choice in any answer, no jumps, the review works as before', async (_name, _update) => {
    vi.stubEnv('WEEK_CLOSE_ENABLED', '');
    seed(2);
    expect((await check(atGap(2, 45))).body).toEqual({ due: false });
    expect((await close(atGap(2, 45), 'keep_going')).body).toEqual({ due: false });
    const res = await post('/weeks/2/review', atGap(2, 45), { reflection: 'Back now' });
    expect(res.status).toBe(200);
    expect(res.body.nextWeekNumber).toBe(3);
    expect(db.goal()).toMatchObject({ currentWeek: 3, movedDays: 0, startDate: START });
    expect(db.state.weeks.filter((w) => w.jumped)).toEqual([]);
    expect(vi.mocked(generateWeekPlan).mock.calls[0][0].firstWeekBack).toBeUndefined();
  });
});

// B-106: a goal with a fixed date (an exam, a race, a talk). The plan's end (day 90, the day before `targetDate`) never
// moves past it; what does not fit is not offered or jumped, as past the 28-day limit.
describe('fixedDateRoom and pastLimitMove with a fixed date (B-106)', () => {
  const DAY_90 = shifted(TARGET, -1);

  it('is the days from day 90 to the date, 0 when day 90 is already past it, null with no date or once it has passed', () => {
    expect(fixedDateRoom(TARGET, shifted(DAY_90, 10), '2026-10-01')).toBe(10);
    expect(fixedDateRoom(TARGET, DAY_90, '2026-10-01')).toBe(0);
    expect(fixedDateRoom(TARGET, shifted(DAY_90, -20), '2026-10-01')).toBe(0);
    expect(fixedDateRoom(TARGET, null, '2026-10-01')).toBeNull();
    expect(fixedDateRoom(TARGET, new Date('2026-10-01T00:00:00Z'), '2026-10-02')).toBeNull();
  });

  it('"Do my final week" moves only as far as the date allows, but always keeps today in week 12', () => {
    expect(pastLimitMove(49, 28, 10, 39)).toEqual({ choice: 'final_week', days: 39, weekBack: 12 });
    expect(pastLimitMove(49, 28, 10, 30)).toEqual({ choice: 'final_week', days: 36, weekBack: 12 });
    expect(pastLimitMove(49, 28, 10, 60)).toEqual({ choice: 'final_week', days: 42, weekBack: 12 });
    expect(pastLimitMove(49, 28, 10, null)).toEqual({ choice: 'final_week', days: 42, weekBack: 12 });
  });

  it('a date further away than the 28-day room changes nothing', () => {
    closeOn();
    const goal = { startDate: START, targetDate: TARGET, movedDays: 0, closeTriedAt: null, closeTriedWeek: null };
    const at = new Date(atGap(2, 10));
    expect(planWeekMove({ ...goal, fixedDate: shifted(DAY_90, 60) }, 2, at, 'UTC')).toEqual({ ...planWeekMove(goal, 2, at, 'UTC'), dateRoom: 60, dateCut: false });
  });
});

describe('a close with a fixed date, WEEK_CLOSE_ENABLED on (B-106)', () => {
  beforeEach(closeOn);
  const DAY_90 = shifted(TARGET, -1);

  it('a 5-day gap with 3 days of room: the plan moves 3, ends on the date, and the passed days are not offered', async () => {
    seed(2, 0, shifted(DAY_90, 3));
    const at = atGap(2, 5);
    expect((await close(at)).status).toBe(200);
    expect(db.goal()).toMatchObject({ currentWeek: 3, movedDays: 3, targetDate: shifted(TARGET, 3) });
    expect(iso(shifted(db.goal().targetDate, -1))).toBe(iso(db.goal().fixedDate));
    const week3 = db.tasksOf(3);
    expect(week3[2].date).toBe(at.slice(0, 10));
    expect(week3.filter((t) => t.notOffered).map((t) => t.date)).toEqual([week3[0].date, week3[1].date]);
    expect(logLines('fixedDate')).toEqual(['[WeekClose] goal g1 week 2 fixedDate room 3 moved 3 gap 5']);
  });

  it('no room left (the plan already ends on the date): a 10-day break needs "Keep going", which jumps a week and moves nothing', async () => {
    seed(2, 0, DAY_90);
    const at = atGap(2, 10);
    expect((await check(at)).body.choice).toBe('keep_going');
    expect((await close(at, 'keep_going')).status).toBe(200);
    expect(db.goal()).toMatchObject({ currentWeek: 4, movedDays: 0, startDate: START, targetDate: TARGET });
    expect(db.week(3).jumped).toBe(true);
    expect(db.tasksOf(4).filter((t) => !t.notOffered)[0].date).toBe(at.slice(0, 10));
  });

  it('"Do my final week" ends on the date: week 12 started 3 days ago, so its first 3 days are not offered', async () => {
    // Week 10 closing, away 49 days: today is the plan's day 120; the date is 39 days after day 90.
    seed(10, 0, shifted(DAY_90, 39));
    const at = atGap(10, 49);
    expect((await close(at, 'final_week')).status).toBe(200);
    expect(db.goal()).toMatchObject({ currentWeek: 12, movedDays: 39, targetDate: shifted(TARGET, 39) });
    const week12 = db.tasksOf(12);
    expect(week12[3].date).toBe(at.slice(0, 10));
    expect(week12.filter((t) => t.notOffered)).toHaveLength(3);
    // Week 12 didn't start today, so the line doesn't say it did.
    expect(db.state.reviews.map((r) => r.aiAdaptationInsight)).toEqual([FINAL_WEEK_DATE_INSIGHT]);
    expect(logLines('fixedDate')).toEqual(['[WeekClose] goal g1 week 10 fixedDate room 39 moved 39 gap 49']);
  });

  it('a date that did not hold the move back logs nothing: a one-day-late close, or the 28-day limit was the cap', async () => {
    seed(2, 0, shifted(DAY_90, 5));
    expect((await close(atGap(2, 1))).status).toBe(200);
    db.reset();
    seed(2, 24, shifted(DAY_90, 24 + 20));
    expect((await close(atGap(2, 5, 24))).status).toBe(200);
    expect(db.goal()).toMatchObject({ movedDays: 28 });
    expect(logLines('fixedDate')).toEqual([]);
  });

  it('the review path logs the cut too', async () => {
    seed(2, 0, shifted(DAY_90, 3));
    const res = await post('/weeks/2/review', atGap(2, 5), { reflection: 'Back' });
    expect(res.status).toBe(200);
    expect(db.goal()).toMatchObject({ movedDays: 3 });
    expect(logLines('fixedDate')).toEqual(['[WeekClose] goal g1 week 2 fixedDate room 3 moved 3 gap 5']);
  });

  it('a date that has already passed holds nothing back', async () => {
    seed(2, 0, shifted(START, 10));
    const at = atGap(2, 5);
    expect((await close(at)).status).toBe(200);
    expect(db.goal()).toMatchObject({ movedDays: 5 });
  });
});
