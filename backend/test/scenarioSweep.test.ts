import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { writeFileSync } from 'node:fs';

// Scenario sweep (2026-10-29, Mo: "make sure missed sessions and the weekly thing work for every scenario, custom goals
// especially"). Made-up people run whole plans day by day through the real routes (open the app: close the week when
// due, reconcile; complete tasks and tap how they felt, review, mark missed, carry or swap, change the schedule,
// finish the goal) on the in-memory store, with every switch as in production. Only the week writer is replaced (steps
// of the goal's own kinds, seats for carried steps as the real writer is asked). No weekly tests (2026-10-30): no test,
// target or checkpoint; the week writer is told what was done, and the sweep checks it is told exactly that. After every
// open, the rules that must always hold are checked. Every custom-goal template and every pathway run against every
// person; `SWEEP=full` runs the whole matrix, otherwise a slice that covers each goal and each person at least once.

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./weekCloseStore.js')).db.prisma }));
vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(async () => ({ success: false, error: 'no model in the sweep' })),
}));
vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn(),
}));

import { db } from './weekCloseStore.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';
import { FEELS, generateWeekPlan, paceOf, weekLayout, type Feel, type Pace, type WeekCallInput, type WeekDayPlan } from '../src/lib/ai/weekPlan.js';
import { RECOVERY_TEMPLATES, type RecoveryProfile } from '../src/lib/recovery/index.js';
import { makeGoalProfile } from '../src/lib/recovery/forGoal.js';
import { CERTIFIED_PRESETS } from '../src/lib/ai/presets/index.js';
import { pathwayFor, type Roadmap, type RoadmapWeek } from '../src/lib/ai/roadmap.js';
import { dailyTaskRows, roadmapWeekRows, storedRoadmap } from '../src/lib/planV2.js';
import { planShape } from '../src/lib/planLength.js';

const START = new Date('2026-09-21T00:00:00Z'); // a Monday
const DAY = 86_400_000;
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY);

// ---------------------------------------------------------------------------------------------------------------------
// Goals: every custom-goal template, and every pathway

/** A goal measured in a number: its measure and where they start. `to` is only the goal's own wording. */
type NumberSpec = { metric: string; unit: string; from: number; to: number; direction?: 'higher_is_better' | 'lower_is_better' };
interface GoalSpec {
  name: string;
  rawGoal: string;
  /** A custom goal's template; pathways use their own profile. */
  template?: keyof typeof RECOVERY_TEMPLATES;
  presetId?: string;
  number?: NumberSpec;
  deliverable?: string;
}

const CUSTOM: GoalSpec[] = [
  { name: 'custom endurance', rawGoal: 'Cycle a 100 km sportive', template: 'endurance', number: { metric: 'Longest ride', unit: 'km', from: 20, to: 100 } },
  { name: 'custom strength', rawGoal: 'Deadlift 140 kg', template: 'strength', number: { metric: 'Deadlift', unit: 'kg', from: 80, to: 140 } },
  { name: 'custom language', rawGoal: 'Learn Japanese for my trip', template: 'language', number: { metric: 'Words known', unit: 'words', from: 50, to: 800 } },
  { name: 'custom instrument', rawGoal: 'Play the drums along to 5 songs', template: 'instrument', number: { metric: 'Clean tempo', unit: 'bpm', from: 60, to: 120 } },
  { name: 'custom writing', rawGoal: 'Write a short story collection', template: 'writing', deliverable: 'Draft story' },
  { name: 'custom product', rawGoal: 'Launch my Notion template shop', template: 'product', deliverable: 'Ship shop milestone' },
  { name: 'custom exam', rawGoal: 'Pass the CPA exam section', template: 'exam', number: { metric: 'Practice test score', unit: 'percent', from: 50, to: 80 } },
  { name: 'custom speaking', rawGoal: 'Give a best man speech', template: 'speaking', number: { metric: 'Filler words', unit: 'per minute', from: 8, to: 2, direction: 'lower_is_better' } },
  { name: 'custom creative', rawGoal: 'Paint a watercolour series', template: 'creative', deliverable: 'Finished painting' },
  { name: 'custom habit', rawGoal: 'Meditate every day', template: 'habit', number: { metric: 'Focused minutes a week', unit: 'minutes', from: 30, to: 150 } },
  { name: 'custom content', rawGoal: 'Start a cooking podcast', template: 'content', deliverable: 'Published episode' },
  { name: 'custom strategy', rawGoal: 'Reach 1500 in online Go', template: 'strategy_games', number: { metric: 'Rating', unit: 'points', from: 1200, to: 1500 } },
  { name: 'custom process', rawGoal: 'Bake sourdough bread at home', template: 'process', deliverable: 'A loaf with an open crumb' },
  { name: 'custom general', rawGoal: 'Get better at improv comedy', template: 'general', number: { metric: 'Practice score', unit: 'points', from: 10, to: 50 } },
];

const PRESET_TARGETS: Record<string, NumberSpec | string> = {
  run10k: { metric: '10K time', unit: 'minutes', from: 70, to: 58, direction: 'lower_is_better' },
};

function presetSpecs(): GoalSpec[] {
  return CERTIFIED_PRESETS.map((preset) => {
    const target = PRESET_TARGETS[preset.id];
    return {
      name: `pathway ${preset.id}`,
      rawGoal: preset.title,
      presetId: preset.id,
      ...(typeof target === 'object' ? { number: target } : { number: { metric: 'Score', unit: 'points', from: 10, to: 40 } }),
    };
  });
}

const GOALS: GoalSpec[] = [...CUSTOM, ...presetSpecs()];

// ---------------------------------------------------------------------------------------------------------------------
// People

interface Ctx {
  rng: () => number;
  day: number;
  date: string;
  weekday: number;
  week: number;
}
interface Person {
  name: string;
  away?: (c: Ctx) => boolean;
  practises?: (c: Ctx) => boolean;
  /** After a done session, the tap for how it felt (null or missing: no tap), and sometimes a note. */
  feels?: (c: Ctx) => Feel | null;
  notes?: (c: Ctx) => string | null;
  /** Submits the review on the week's last day instead of waiting for the automatic close. */
  reviews?: boolean;
  /** On a day they skip, they tap "I missed it" and answer any held key session (carry now or swap). */
  actions?: boolean;
  /** Past the limit after a long break. */
  choice?: 'keep_going' | 'final_week';
  /** A schedule change on this plan day. */
  schedule?: { day: number; body: Record<string, unknown> };
  timezone?: string;
  /** Local hour they open the app. */
  hour?: number;
}

const PEOPLE: Person[] = [
  { name: 'Perfect Pat (reviews, taps just right)', reviews: true, feels: () => 'just_right' },
  { name: 'Auto Ana (never reviews, never taps)' },
  { name: 'Busy Sam (skips 1 day in 3)', practises: (c) => c.day % 3 !== 1 },
  { name: 'Coin-flip Carl (does half the days at random, taps at random)', practises: (c) => c.rng() < 0.5, feels: (c) => FEELS[Math.floor(c.rng() * 3)], actions: true },
  { name: 'Two-bad-weeks Ben (nothing in weeks 3 and 4)', practises: (c) => c.week !== 3 && c.week !== 4, feels: () => 'just_right' },
  { name: 'Sick Mia (away 10 days in week 5)', away: (c) => c.day >= 30 && c.day < 40, notes: (c) => (c.day === 29 ? 'Coming down with a cold' : null) },
  { name: 'Holiday Hal (away 25 days in week 4)', away: (c) => c.day >= 22 && c.day < 47 },
  { name: 'Gone Tom (away 6 weeks, keeps going)', away: (c) => c.day >= 15 && c.day < 57, choice: 'keep_going' },
  { name: 'Gone Gina (away 6 weeks, does her final week)', away: (c) => c.day >= 15 && c.day < 57, choice: 'final_week' },
  { name: 'Weekend Wes (only opens Sat and Sun)', away: (c) => c.weekday !== 0 && c.weekday !== 6 },
  { name: 'Clicker Cleo (taps I missed it, carries and swaps)', practises: (c) => c.rng() < 0.6, actions: true, feels: () => 'just_right' },
  { name: 'Shift Sid (5 days to 4 in week 5, weekends off)', schedule: { day: 30, body: { planVariant: 'minimal', restWeekdays: [0, 3, 6] } } },
  { name: 'Strong Stella (does it all, always too easy)', feels: () => 'too_easy', reviews: true },
  { name: 'Struggling Sue (does 3 in 4, always too hard, writes notes)', practises: (c) => c.rng() < 0.75, feels: () => 'too_hard', notes: (c) => (c.rng() < 0.3 ? 'My knee hurts a bit' : null) },
  { name: 'Mixed Max (too hard on Mondays, too easy otherwise)', feels: (c) => (c.weekday === 1 ? 'too_hard' : 'too_easy') },
  { name: 'Night-owl Nia (Auckland, opens at 23:30)', timezone: 'Pacific/Auckland', hour: 23.5, feels: () => 'just_right' },
  { name: 'Late Leo (Los Angeles, opens at 00:15, skips Mondays)', timezone: 'America/Los_Angeles', hour: 0.25, practises: (c) => c.weekday !== 1 },
  { name: 'Quitter Quinn (stops opening after week 6)', away: (c) => c.day >= 42 },
  { name: 'Note-taker Nora (a note every day, never taps)', notes: (c) => `Day ${c.day + 1}: ran out of time near the end` },
];

// Short plans (B-109): a fixed date under 12 weeks away.
const LENGTHS: Array<{ name: string; weeks: number; fixedDay: number | null }> = [
  { name: '12 weeks', weeks: 12, fixedDay: null },
  { name: '7 weeks (exam on day 51)', weeks: 7, fixedDay: 51 },
];

// ---------------------------------------------------------------------------------------------------------------------
// The fake model

let rngSeed = 1;
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (text: string) => [...text].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

/** Per kind: the next number to write, and every title written (for the "nothing lost" rule). */
let counters = new Map<string, number>();
let writtenByKind = new Map<string, string[]>();
let profileNow: RecoveryProfile;

const practiceKinds = () => profileNow.kinds.filter((k) => k.action !== 'fixed');

/** The steps still to do the handoff names for a kind (`handoffBrief`'s quoted titles before "They are at"). */
function seatsFor(kind: string, whereTheyAre: string[] = []): number {
  const line = whereTheyAre.find((l) => l.includes(`(kind ${kind})`) && l.includes('have not done these steps yet'));
  return line ? (line.split('They are at')[0].match(/"[^"]+"/g) ?? []).length : 0;
}

function fakeWeek(input: WeekCallInput): WeekDayPlan[] {
  const kinds = practiceKinds();
  const seats = new Map(kinds.map((k) => [k.id, seatsFor(k.id, input.whereTheyAre)]));
  const minutes = input.dailyMinutes;
  let index = 0;
  const stepOf = (kindId: string, priority: number, mins: number) => {
    const kind = kinds.find((k) => k.id === kindId)!;
    const left = seats.get(kindId) ?? 0;
    let title: string;
    if (kind.inOrder && left > 0) {
      seats.set(kindId, left - 1);
      title = `Seat ${kindId} ${input.weekNumber}-${index}`;
    } else {
      const n = (counters.get(kindId) ?? 0) + 1;
      counters.set(kindId, n);
      title = `${kindId} ${n}`;
      writtenByKind.set(kindId, [...(writtenByKind.get(kindId) ?? []), title]);
    }
    return { stepNumber: priority, title, durationMinutes: mins, instructions: `Do ${title}.`, focusCue: '', pitfallToAvoid: '', priority, kind: kindId };
  };
  return weekLayout(input.planVariant, input.weekStart, input.restWeekdays).map((day) => {
    const practice = !day.isRestDay;
    let steps: ReturnType<typeof stepOf>[] = [];
    if (practice) {
      const first = kinds[index % kinds.length];
      const second = kinds[(index + 1) % kinds.length];
      index++;
      steps = [stepOf(first.id, 1, Math.round(minutes * 0.6)), stepOf(second.id, 2, minutes - Math.round(minutes * 0.6))];
    }
    return {
      ...day,
      title: practice ? steps[0].title : 'Rest',
      durationMinutes: practice ? minutes : 0,
      slotTime: '19:30',
      implementationIntention: '',
      detailedSteps: steps,
      isKeySession: practice && index === 2,
      whyToday: '',
      minimumVersion: practice ? { title: 'Ten minutes', durationMinutes: 10, instructions: 'The smallest step.' } : null,
    } as unknown as WeekDayPlan;
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Seeding: a goal as goal create saves it

function seed(spec: GoalSpec, length: (typeof LENGTHS)[number], timezone: string) {
  const shape = planShape(length.weeks);
  const fixedDate = length.fixedDay === null ? null : addDays(START, length.fixedDay);
  const made = makeGoalProfile({ presetId: spec.presetId, domain: null, goalText: spec.rawGoal });
  profileNow = spec.template ? (RECOVERY_TEMPLATES[spec.template] as unknown as RecoveryProfile) : (made as { profile: RecoveryProfile }).profile;
  const weeks: RoadmapWeek[] = Array.from({ length: shape.weeks }, (_, i) => ({
    weekNumber: i + 1,
    phase: i < Math.ceil(shape.weeks / 2) ? 'Base' : 'Build',
    focus: `Focus ${i + 1}`,
  }));
  const n = spec.number;
  const roadmap: Roadmap = {
    finalGoal: n ? `${n.metric}: ${n.to} ${n.unit}` : `${spec.deliverable}, finished`,
    startingPoint: { value: n?.from ?? null, description: 'Now' },
    measure: n ? { metric: n.metric, unit: n.unit, direction: n.direction ?? 'higher_is_better' } : null,
    method: { name: 'Method', creator: '', summary: 'A method.', whyChosen: 'Fits.', runnerUp: null, safety: 5, rules: ['One thing at a time'], candidates: [] },
    phases: [
      { name: 'Base', startWeek: 1, endWeek: Math.ceil(shape.weeks / 2), purpose: 'Build.' },
      { name: 'Build', startWeek: Math.ceil(shape.weeks / 2) + 1, endWeek: shape.weeks, purpose: 'Grow.' },
    ],
    weeks,
  };
  const routine = { dailyMinutes: 30, planVariant: 'steady', sleepTime: '23:00', preferredSlot: 'evening', wakeTime: '07:00', busyHours: '09:00 - 17:00', commitments: [] };
  db.state.goals.push({
    id: 'g1',
    userId: 'u1',
    status: 'active',
    planVersion: 2,
    currentWeek: 1,
    rawGoal: spec.rawGoal,
    clarifiedOutcome: spec.rawGoal,
    startDate: START,
    targetDate: length.weeks === 12 ? addDays(START, 90) : fixedDate!,
    fixedDate,
    totalWeeks: length.weeks,
    routine: JSON.stringify(routine),
    roadmap: JSON.parse(JSON.stringify(storedRoadmap(roadmap, [], profileNow))),
    movedDays: 0,
    closeTriedAt: null,
    closeTriedWeek: null,
    answers: '{}',
  });
  for (const row of roadmapWeekRows('g1', roadmap, 30, 'steady')) {
    db.state.weeks.push({ id: `w${row.weekNumber}`, testResult: null, executionScore: null, reviewNotes: null, closedBy: null, closedAt: null, jumped: false, ...JSON.parse(JSON.stringify(row)) });
  }
  const week1 = fakeWeek({ weekNumber: 1, totalWeeks: length.weeks, weekStart: START, planVariant: 'steady', dailyMinutes: 30 } as unknown as WeekCallInput);
  for (const row of dailyTaskRows('g1', 1, week1)) {
    db.state.tasks.push({ id: `g1-d${row.dayNumber}`, status: 'pending', usedMinimumVersion: false, notOffered: false, notes: null, feel: null, completedAt: null, ...JSON.parse(JSON.stringify(row)) });
  }
  return { shape, fixedDate, roadmap };
}

// ---------------------------------------------------------------------------------------------------------------------
// The server and the requests

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/goal', goalRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('bind');
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

let currentUser = { id: 'u1', email: 'u1@achivii.com', timezone: 'UTC' };

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.mocked(getAuthUser).mockImplementation(async () => currentUser as never);
  vi.mocked(generateWeekPlan).mockImplementation(async (input) => {
    writerCalls.push({ input, closing: closingWeekCounts(input.weekNumber) });
    return fakeWeek(input);
  });
  for (const method of ['log', 'warn', 'error', 'info'] as const) vi.spyOn(console, method).mockImplementation(() => {});
  // The production switch states (docs: CLAUDE.md).
  for (const flag of ['WEEK_CLOSE_ENABLED', 'MISSED_SESSIONS_CARRY_ENABLED', 'METHOD_RECOVERY_ENABLED', 'CUSTOM_RECOVERY_PROFILES_ENABLED']) vi.stubEnv(flag, 'true');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function call(path: string, at: Date, body: unknown = {}, method = 'POST') {
  vi.setSystemTime(at);
  const res = await fetch(`${baseUrl}/api/goal${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}

/** The local date key of `at` in `tz`. */
function localKey(at: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}
/** The UTC instant of plan day `day` at `hour` local time in `tz` (whole-hour offsets are enough here). */
function openAt(day: number, hour: number, tz: string): Date {
  const local = addDays(START, day).getTime() + hour * 3_600_000;
  const probe = new Date(local);
  const offset = new Date(probe.toLocaleString('en-US', { timeZone: tz })).getTime() - new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  return new Date(local - offset);
}

const steps = (task: { detailedSteps: string }): Array<{ title: string; durationMinutes: number; kind?: string; toNextWeek?: Array<{ step: { title: string } }> }> =>
  JSON.parse(task.detailedSteps || '[]');

function storedTitles(): Set<string> {
  const titles = new Set<string>();
  for (const task of db.state.tasks) {
    for (const item of steps(task)) {
      titles.add(item.title);
      for (const record of item.toNextWeek ?? []) titles.add(record.step.title);
    }
  }
  return titles;
}

/**
 * What the writer should be told about last week, read from the store at the call: the newest closed week before
 * `weekNumber` (a jump or a break skips weeks), its practice sessions (no rest days, no days not offered), done ones,
 * and the taps and notes on them.
 */
function closingWeekCounts(weekNumber: number) {
  const closed = db.state.weeks.filter((w) => w.weekNumber < weekNumber && (w.status === 'completed' || w.status === 'active')).sort((a, b) => b.weekNumber - a.weekNumber)[0];
  if (!closed) return null;
  const tasks = db.tasksOf(closed.weekNumber);
  const practice = tasks.filter((t) => !t.isRestDay && !t.notOffered);
  const feel: Record<Feel, number> = { too_easy: 0, just_right: 0, too_hard: 0 };
  for (const t of practice) if (t.status === 'completed' && t.feel) feel[t.feel as Feel] += 1;
  return { week: closed.weekNumber, done: practice.filter((t) => t.status === 'completed').length, planned: practice.length, feel, notes: tasks.filter((t) => t.notes?.trim()).length };
}

let writerCalls: Array<{ input: WeekCallInput; closing: ReturnType<typeof closingWeekCounts> }> = [];

interface RunResult {
  problems: string[];
  finished: boolean;
  finalWeekClosed: boolean;
  weeksJumped: number;
  movedDays: number;
  lostLetGo: number;
  lostMove: Record<string, number>;
  /** The pace each written week was given (week 2 on). */
  paces: Partial<Record<Pace, number>>;
  daysToFinish: number;
}

async function runPlan(spec: GoalSpec, person: Person, length: (typeof LENGTHS)[number]): Promise<RunResult> {
  counters = new Map();
  writtenByKind = new Map();
  writerCalls = [];
  const tz = person.timezone ?? 'UTC';
  currentUser = { id: 'u1', email: 'u1@achivii.com', timezone: tz };
  const { shape, fixedDate } = seed(spec, length, tz);
  const rng = mulberry(hash(spec.name + person.name + length.name) + rngSeed);
  const problems: string[] = [];
  // Each kind of problem once per run, at the first day it shows.
  const seen = new Set<string>();
  const add = (where: string, what: string) => {
    const key = what.replace(/\d[\d\-.]*/g, 'N');
    if (seen.has(key)) return;
    seen.add(key);
    problems.push(`${where}: ${what}`);
  };
  let lastWeekSeen = 1;
  let day = 0;
  let callsChecked = 0;
  let tookFinalWeek = false;
  const dailyMinutes = () => JSON.parse(db.goal().routine).dailyMinutes as number;

  for (; day < 175 && db.goal().status === 'active'; day++) {
    const at = openAt(day, person.hour ?? 8, tz);
    const today = localKey(at, tz);
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    const ctx: Ctx = { rng, day, date: today, weekday, week: db.goal().currentWeek };
    const where = `${spec.name} / ${person.name} / ${length.name}, day ${day + 1} (${today}, week ${db.goal().currentWeek})`;
    if (person.away?.(ctx)) continue;

    if (person.schedule?.day === day) {
      const changed = await call('/schedule', at, person.schedule.body, 'PATCH');
      if (changed.status !== 200 && !(changed.status === 409 && ['week_closing', 'last_week'].includes(changed.body?.reason))) add(where, `schedule answered ${changed.status} ${JSON.stringify(changed.body)}`);
    }

    // The app's open: close when due (the choice past the limit as the person makes it), then reconcile.
    const weekBefore = db.goal().currentWeek;
    let close = await call('/close-week', at);
    // The card offers one choice next to "Start a fresh plan"; the person takes it.
    if (close.status === 409 && close.body?.reason === 'choice_needed') {
      if (close.body.choice === 'final_week') tookFinalWeek = true;
      close = await call('/close-week', at, { choice: close.body.choice });
    }
    if (close.status !== 200) add(where, `close answered ${close.status} ${JSON.stringify(close.body)}`);
    const rec = await call('/reconcile', at);
    if (rec.status !== 200) add(where, `reconcile answered ${rec.status} ${JSON.stringify(rec.body)?.slice(0, 200)}`);
    const again = await call('/close-week', at, { mode: 'check' });
    if (again.body?.due === true && close.body?.due === true && db.goal().currentWeek === weekBefore) add(where, 'still due after closing');

    const goal = db.goal();
    // Weeks only move forward and stay inside the plan.
    if (goal.currentWeek < lastWeekSeen) add(where, `currentWeek went back from ${lastWeekSeen} to ${goal.currentWeek}`);
    if (goal.currentWeek < 1 || goal.currentWeek > shape.weeks) add(where, `currentWeek ${goal.currentWeek} outside 1..${shape.weeks}`);
    lastWeekSeen = Math.max(lastWeekSeen, goal.currentWeek);
    // Exactly one open week, and it is the current week.
    const active = db.state.weeks.filter((w) => w.status === 'active');
    const planOver = db.week(shape.weeks).status === 'completed';
    if (goal.status === 'active' && !planOver && (active.length !== 1 || active[0].weekNumber !== goal.currentWeek)) add(where, `open weeks ${active.map((w) => w.weekNumber).join(',') || 'none'}, current ${goal.currentWeek}`);
    // The plan never ends after a fixed date (a shorter plan: the day before it), except "Do my final week" and once the
    // date has passed while they were away (B-106: no room is kept for a date already gone).
    if (fixedDate && !tookFinalWeek && today <= dateKey(fixedDate)) {
      const latest = dateKey(addDays(fixedDate, shape.readyWeek === null ? 0 : -1));
      if (dateKey(addDays(goal.targetDate, -1)) > latest) add(where, `plan ends ${dateKey(addDays(goal.targetDate, -1))}, after ${latest}`);
    }
    // The move limit (28 days), except "Do my final week".
    if ((goal.movedDays ?? 0) > 28 && !tookFinalWeek) add(where, `movedDays ${goal.movedDays}`);
    // A week written now offers no past day.
    if (goal.currentWeek !== weekBefore) {
      for (const task of db.tasksOf(goal.currentWeek)) {
        if (task.date < today && !task.notOffered && !task.isRestDay) add(where, `week ${goal.currentWeek} offers past day ${task.date}`);
      }
    }
    // No two written weeks share a date; every week's 7 days are 7 days in a row.
    const byDate = new Map<string, number>();
    for (const task of db.state.tasks) {
      if (byDate.has(task.date) && byDate.get(task.date) !== task.weekNumber) add(where, `${task.date} is in weeks ${byDate.get(task.date)} and ${task.weekNumber}`);
      byDate.set(task.date, task.weekNumber);
    }
    // No day holds more than the daily time; a rest day holds no work.
    for (const task of db.state.tasks) {
      const minutes = steps(task).reduce((sum, item) => sum + (item.durationMinutes || 0), 0);
      const limit = task.weekNumber >= goal.currentWeek ? dailyMinutes() : 90;
      if (minutes > Math.max(limit, 30)) add(where, `${task.date} (week ${task.weekNumber}) holds ${minutes} minutes`);
      if (task.isRestDay && steps(task).length > 0 && !task.notOffered) add(where, `rest day ${task.date} holds steps ${steps(task).map((s) => s.title).join(', ')}`);
    }
    // No in-order step lost: every one written is still stored somewhere (done, waiting, or listed for next week).
    const stored = storedTitles();
    for (const kind of profileNow.kinds.filter((k) => k.inOrder && k.action !== 'let_go')) {
      for (const title of writtenByKind.get(kind.id) ?? []) if (!stored.has(title)) add(where, `in-order step ${title} is gone`);
    }
    // No test anywhere in a week written now (no weekly tests): no test day, no "Weekly test" step.
    for (const task of db.state.tasks) {
      if (task.isTestDay) add(where, `${task.date} (week ${task.weekNumber}) is a test day`);
      if (steps(task).some((item) => /^weekly test\b/i.test(item.title) || item.kind === 'weekly_test')) add(where, `${task.date} holds a test step`);
      // A tap only on a done session.
      if (task.feel && task.status !== 'completed') add(where, `${task.date} has feel ${task.feel} but is ${task.status}`);
    }
    // The writer is told exactly what last week was: its sessions done and planned, the taps, every note.
    for (; callsChecked < writerCalls.length; callsChecked++) {
      const { input, closing } = writerCalls[callsChecked];
      if (!closing) continue;
      const last = input.lastWeek;
      if (!last) {
        add(where, `week ${input.weekNumber} was written with no last week (week ${closing.week} closed)`);
        continue;
      }
      if (last.done !== closing.done || last.planned !== closing.planned) add(where, `week ${input.weekNumber} was told ${last.done} of ${last.planned} done; week ${closing.week} had ${closing.done} of ${closing.planned}`);
      if (JSON.stringify(last.feel) !== JSON.stringify(closing.feel)) add(where, `week ${input.weekNumber} was told taps ${JSON.stringify(last.feel)}; week ${closing.week} had ${JSON.stringify(closing.feel)}`);
      if (last.notes.length !== closing.notes) add(where, `week ${input.weekNumber} was told ${last.notes.length} notes; week ${closing.week} had ${closing.notes}`);
      if (!input.weekNumber || input.weekNumber <= closing.week) add(where, `week ${input.weekNumber} written from a later week ${closing.week}`);
    }

    // The person's day.
    const task = db.state.tasks.find((t) => t.date === today && t.weekNumber === db.goal().currentWeek && !t.isRestDay && !t.notOffered);
    const practise = person.practises?.(ctx) ?? true;
    if (task && task.status !== 'completed' && practise) {
      const done = await call(`/tasks/${task.id}`, at, { status: 'completed' }, 'PATCH');
      if (done.status !== 200) add(where, `completing ${task.date} answered ${done.status} ${JSON.stringify(done.body)}`);
      // The tap after the session, and a note in the day's note box.
      const feel = person.feels?.(ctx) ?? null;
      const note = person.notes?.(ctx) ?? null;
      if (feel || note) {
        const tapped = await call(`/tasks/${task.id}`, at, { ...(feel ? { feel } : {}), ...(note ? { notes: note } : {}) }, 'PATCH');
        if (tapped.status !== 200) add(where, `feel ${feel} answered ${tapped.status} ${JSON.stringify(tapped.body)}`);
      }
    }
    if (task && task.status !== 'completed' && !practise && person.actions) {
      const marked = await call(`/tasks/${task.id}/mark-missed`, at);
      if (marked.status !== 200 && marked.status !== 409) add(where, `mark missed answered ${marked.status} ${JSON.stringify(marked.body)}`);
      const held = marked.body?.carry?.choices?.held ?? [];
      for (const [i, h] of held.entries()) {
        if (i % 2 === 0) {
          const moved = await call(`/tasks/${h.taskId}/carry-now`, at);
          if (moved.status !== 200 && moved.status !== 409) add(where, `carry now answered ${moved.status} ${JSON.stringify(moved.body)}`);
        } else {
          const a = db.state.tasks.find((t) => t.id === h.taskId);
          const b = db.state.tasks.find((t) => t.id === h.receivingTaskId);
          if (a && b) {
            const swapped = await call(`/tasks/${h.taskId}/swap`, at, { withTaskId: h.receivingTaskId, expected: { [a.id]: a.detailedSteps, [b.id]: b.detailedSteps } });
            if (swapped.status !== 200 && swapped.status !== 409) add(where, `swap answered ${swapped.status} ${JSON.stringify(swapped.body)}`);
          }
        }
      }
    }
    // The review on the week's last day.
    const weekTasks = db.tasksOf(db.goal().currentWeek);
    if (person.reviews && weekTasks.length && weekTasks[weekTasks.length - 1].date === today) {
      const reviewed = await call(`/weeks/${db.goal().currentWeek}/review`, at, { reflection: 'It went fine.' });
      if (reviewed.status !== 200 && reviewed.status !== 409) add(where, `review answered ${reviewed.status} ${JSON.stringify(reviewed.body)?.slice(0, 200)}`);
    }
    // The last week closed: they finish the goal.
    if (db.week(shape.weeks).status === 'completed') {
      const complete = await call('/complete', at, { finalReflection: 'Done.' });
      if (complete.status !== 200) add(where, `complete answered ${complete.status} ${JSON.stringify(complete.body)}`);
      break;
    }
  }

  const goal = db.goal();
  const stored = storedTitles();
  const lostMove: Record<string, number> = {};
  let lostLetGo = 0;
  for (const kind of profileNow.kinds) {
    const lost = (writtenByKind.get(kind.id) ?? []).filter((t) => !stored.has(t)).length;
    if (kind.action === 'let_go') lostLetGo += lost;
    else if (lost > 0) lostMove[`${kind.id} (${kind.action}${kind.inOrder ? ', in order' : ''})`] = lost;
  }
  if (process.env.SWEEP_DEBUG && (spec.name + ' / ' + person.name + ' / ' + length.name).includes(process.env.SWEEP_DEBUG)) {
    writeFileSync(process.env.SWEEP_DEBUG_OUT ?? 'sweep-debug.json', JSON.stringify({ problems, state: db.state, calls: writerCalls.map(({ input, closing }) => ({ week: input.weekNumber, lastWeek: input.lastWeek, closing, whereTheyAre: input.whereTheyAre })) }, null, 1));
  }
  const paces: Partial<Record<Pace, number>> = {};
  for (const { input } of writerCalls) if (input.lastWeek) paces[paceOf(input.lastWeek)] = (paces[paceOf(input.lastWeek)] ?? 0) + 1;
  return {
    problems,
    finished: goal.status === 'completed',
    finalWeekClosed: db.week(shape.weeks).status === 'completed',
    weeksJumped: db.state.weeks.filter((w) => w.jumped).length,
    movedDays: goal.movedDays ?? 0,
    lostLetGo,
    lostMove,
    paces,
    daysToFinish: day + 1,
  };
}

// ---------------------------------------------------------------------------------------------------------------------

const FULL = process.env.SWEEP === 'full';
interface Case {
  spec: GoalSpec;
  person: Person;
  length: (typeof LENGTHS)[number];
}
function cases(): Case[] {
  const out: Case[] = [];
  GOALS.forEach((spec, g) => {
    PEOPLE.forEach((person, p) => {
      LENGTHS.forEach((length, l) => {
        // The slice: each goal with three people, each person with several goals, short plans for a third.
        if (FULL || (g + p) % 6 === 0 || (l === 1 && (g + p) % 9 === 4) || (l === 0 && (g * 7 + p) % 11 === 3)) out.push({ spec, person, length });
      });
    });
  });
  return out.filter((c) => c.length.weeks === 12 || !c.person.away || c.person.name.startsWith('Sick') || c.person.name.startsWith('Quitter') || FULL);
}

const results: Array<Case & { result: RunResult }> = [];

// Opt-in: minutes long, so not in the normal suite. `SWEEP=1 npx vitest run test/scenarioSweep.test.ts` (slice),
// `SWEEP=full` (every goal x person x length), `SWEEP_OUT=<file>` writes every run's result.
describe.skipIf(!process.env.SWEEP)('scenario sweep: every goal type, every person', () => {
  it('the goals are what they say: custom ones match no pathway, pathways match their own', () => {
    for (const spec of CUSTOM) expect(pathwayFor(spec.rawGoal, spec.rawGoal), spec.name).toBeNull();
    for (const spec of presetSpecs()) expect(pathwayFor(spec.rawGoal, spec.rawGoal)?.id, spec.name).toBe(spec.presetId);
  });

  for (const c of cases()) {
    it(`${c.spec.name} / ${c.person.name} / ${c.length.name}`, async () => {
      const result = await runPlan(c.spec, c.person, c.length);
      results.push({ ...c, result });
      expect(result.problems.slice(0, 15)).toEqual([]);
      // Everyone who keeps opening the app reaches the end of the plan.
      if (!c.person.name.startsWith('Quitter')) expect(result.finalWeekClosed, 'the last week closed').toBe(true);
    }, 300_000);
  }

  afterAll(() => {
    const out = process.env.SWEEP_OUT;
    if (out) writeFileSync(out, JSON.stringify(results.map((r) => ({ goal: r.spec.name, person: r.person.name, length: r.length.name, ...r.result })), null, 2));
  });
});
