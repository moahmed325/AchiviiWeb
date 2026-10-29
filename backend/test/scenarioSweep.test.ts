import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { writeFileSync } from 'node:fs';

// Scenario sweep (2026-10-29, Mo: "make sure missed sessions and the weekly thing work for every scenario, custom goals
// especially"). Made-up people run whole plans day by day through the real routes (open the app: close the week when
// due, reconcile; complete tasks, log tests, review, mark missed, carry or swap, change the schedule, answer
// checkpoints, finish the goal) on the in-memory store, with every switch as in production (all five on). Only the
// model calls are replaced: the week writer (steps of the goal's own kinds, seats for carried steps as the real writer
// is asked) and the weekly update (an honest model whose answer goes through the real check). After every open, the
// rules that must always hold are checked. Every custom-goal template and every pathway run against every person;
// `SWEEP=full` runs the whole matrix, otherwise a slice that covers each goal and each person at least once.

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
vi.mock('../src/lib/ai/weeklyUpdate.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weeklyUpdate.js')>()),
  askWeeklyUpdate: vi.fn(),
}));

import { db } from './weekCloseStore.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';
import { generateWeekPlan, weekLayout, type PlanVariant, type WeekCallInput, type WeekDayPlan } from '../src/lib/ai/weekPlan.js';
import {
  askWeeklyUpdate,
  askedWeeks,
  boundOf,
  checkWeeklyUpdate,
  heldWeekOf,
  holdsOf,
  nextWeekIsLast,
  type RawWeeklyUpdate,
  type WeeklyUpdateInput,
} from '../src/lib/ai/weeklyUpdate.js';
import { RECOVERY_TEMPLATES, type RecoveryProfile } from '../src/lib/recovery/index.js';
import { makeGoalProfile } from '../src/lib/recovery/forGoal.js';
import { CERTIFIED_PRESETS } from '../src/lib/ai/presets/index.js';
import { pathwayFor, withPathwayTests, type Roadmap, type RoadmapWeek, type WeekTarget } from '../src/lib/ai/roadmap.js';
import { dailyTaskRows, roadmapWeekRows, storedRoadmap } from '../src/lib/planV2.js';
import { planShape } from '../src/lib/planLength.js';
import { safeTargetClimb, harder } from '../src/lib/safety/targetSteps.js';

const START = new Date('2026-09-21T00:00:00Z'); // a Monday
const DAY = 86_400_000;
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY);

// ---------------------------------------------------------------------------------------------------------------------
// Goals: every custom-goal template, and every pathway

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
  /** How good their logged test results are against the target: 1 hits it, above beats it, below falls short. */
  result?: number | null;
  /** Logs the test on the test day (null: never logs). */
  logs?: boolean;
  /** Submits the review on the week's last day instead of waiting for the automatic close. */
  reviews?: boolean;
  /** On a day they skip, they tap "I missed it" and answer any held key session (carry now or swap). */
  actions?: boolean;
  /** Past the limit after a long break. */
  choice?: 'keep_going' | 'final_week';
  /** A schedule change on this plan day. */
  schedule?: { day: number; body: Record<string, unknown> };
  /** Checkpoint offers: accept or keep. */
  checkpoint?: 'accept' | 'keep';
  timezone?: string;
  /** Local hour they open the app. */
  hour?: number;
}

const PEOPLE: Person[] = [
  { name: 'Perfect Pat (reviews, logs on target)', logs: true, result: 1, reviews: true },
  { name: 'Auto Ana (never reviews, logs on target)', logs: true, result: 1 },
  { name: 'Busy Sam (skips 1 day in 3, never logs)', practises: (c) => c.day % 3 !== 1 },
  { name: 'Coin-flip Carl (does half the days at random, logs)', practises: (c) => c.rng() < 0.5, logs: true, result: 0.85, actions: true },
  { name: 'Two-bad-weeks Ben (nothing in weeks 3 and 4)', practises: (c) => c.week !== 3 && c.week !== 4, logs: true, result: 0.7 },
  { name: 'Sick Mia (away 10 days in week 5)', away: (c) => c.day >= 30 && c.day < 40, logs: true, result: 1 },
  { name: 'Holiday Hal (away 25 days in week 4)', away: (c) => c.day >= 22 && c.day < 47, logs: true, result: 1 },
  { name: 'Gone Tom (away 6 weeks, keeps going)', away: (c) => c.day >= 15 && c.day < 57, choice: 'keep_going' },
  { name: 'Gone Gina (away 6 weeks, does her final week)', away: (c) => c.day >= 15 && c.day < 57, choice: 'final_week', logs: true, result: 1 },
  { name: 'Weekend Wes (only opens Sat and Sun)', away: (c) => c.weekday !== 0 && c.weekday !== 6, logs: true, result: 1 },
  { name: 'Clicker Cleo (taps I missed it, carries and swaps)', practises: (c) => c.rng() < 0.6, actions: true, logs: true, result: 1 },
  { name: 'Shift Sid (5 days to 4 in week 5, weekends off)', schedule: { day: 30, body: { planVariant: 'minimal', restWeekdays: [0, 3, 6] } }, logs: true, result: 1 },
  { name: 'Strong Stella (beats every target, accepts raises)', logs: true, result: 1.25, checkpoint: 'accept' },
  { name: 'Struggling Sue (60% of target, accepts lowers)', logs: true, result: 0.6, checkpoint: 'accept', practises: (c) => c.rng() < 0.75 },
  { name: 'Stubborn Stu (60% of target, keeps his goal)', logs: true, result: 0.6, checkpoint: 'keep' },
  { name: 'Night-owl Nia (Auckland, opens at 23:30)', timezone: 'Pacific/Auckland', hour: 23.5, logs: true, result: 1 },
  { name: 'Late Leo (Los Angeles, opens at 00:15, skips Mondays)', timezone: 'America/Los_Angeles', hour: 0.25, practises: (c) => c.weekday !== 1 },
  { name: 'Quitter Quinn (stops opening after week 6)', away: (c) => c.day >= 42 },
  { name: 'Forgetful Fay (does every session, never logs the test)' },
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
let weeklyRejections: string[] = [];

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
    if (practice && day.isTestDay) {
      steps = [{ ...stepOf(kinds[0].id, 1, Math.round(minutes / 2)) }, { stepNumber: 2, title: `Weekly test: ${input.test.instructions}`, durationMinutes: Math.round(minutes / 2), instructions: input.test.instructions, focusCue: '', pitfallToAvoid: '', priority: 0, kind: 'weekly_test' }];
    } else if (practice) {
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
      isKeySession: practice && !day.isTestDay && index === 2,
      whyToday: '',
      minimumVersion: practice ? { title: 'Ten minutes', durationMinutes: 10, instructions: 'The smallest step.' } : null,
    } as unknown as WeekDayPlan;
  });
}

/** An honest weekly update: keeps the plan, holds where the rules hold, never backwards, week 12 exactly as it is. */
function honestUpdate(input: WeeklyUpdateInput): RawWeeklyUpdate {
  const counts = input.counts as unknown as { practiceDone: number; practicePlanned: number };
  const score = counts.practicePlanned > 0 ? (counts.practiceDone / counts.practicePlanned) * 100 : null;
  // As a careful model would read it: the practice done and, when logged, the result against the target.
  const status = score === null ? 'a_bit_behind' : score >= 80 ? 'on_track' : score >= 50 ? 'a_bit_behind' : 'far_behind';
  const asked = askedWeeks(input);
  const holds = holdsOf(input);
  const last = nextWeekIsLast(input);
  const heldWeek = heldWeekOf(input);
  const held = input.restart ? !last : (status === 'far_behind' && !last) || holds.notLogged || holds.weekBehind.length > 0;
  const bound = boundOf(input);
  const final = asked[asked.length - 1];
  let prev: number | null = null;
  const nextTargets = asked.map((week) => {
    const planned = week.target;
    if (planned.kind === 'deliverable') {
      const description = held && week.weekNumber === heldWeek && input.target.kind === 'deliverable' ? input.target.description : planned.description;
      return { weekNumber: week.weekNumber, kind: 'deliverable', description };
    }
    let value = planned.value;
    const dir = planned.direction;
    if (week === final) value = planned.value;
    else if (input.restart && week.weekNumber === heldWeek && input.restart.level.kind === 'number') value = input.restart.level.value;
    else if (held && week.weekNumber === heldWeek && input.target.kind === 'number') value = input.target.value;
    else if (bound !== null && harder(bound, value, dir)) value = bound;
    if (prev !== null && harder(prev, value, dir)) value = prev;
    if (week !== final && final.target.kind === 'number' && harder(value, final.target.value, dir)) value = final.target.value;
    prev = value;
    return { weekNumber: week.weekNumber, kind: 'number', metric: planned.metric, value, unit: planned.unit };
  });
  return { status, nextTargets, messageToUser: 'Next week keeps building toward your target.', guidanceForNextWeek: 'Keep the same rhythm.' };
}

// ---------------------------------------------------------------------------------------------------------------------
// Seeding: a goal as goal create saves it

function targetsFor(spec: GoalSpec, shape: ReturnType<typeof planShape>): WeekTarget[] {
  if (spec.deliverable) return Array.from({ length: shape.weeks }, (_, i) => ({ kind: 'deliverable' as const, description: `${spec.deliverable} ${Math.min(i + 1, shape.finalWeek)}` }));
  const n = spec.number!;
  const raw: WeekTarget[] = Array.from({ length: shape.weeks }, (_, i) => {
    const step = Math.min(i + 1, shape.finalWeek) / shape.finalWeek;
    return { kind: 'number', metric: n.metric, value: Math.round((n.from + (n.to - n.from) * step) * 10) / 10, unit: n.unit, direction: n.direction ?? 'higher_is_better' };
  });
  const safe = safeTargetClimb(raw, n.from, { run10k: spec.presetId === 'run10k' }).targets;
  // As the roadmap check does (B-109): the ready week keeps the final week's target.
  if (shape.readyWeek !== null) safe[shape.readyWeek - 1] = { ...safe[shape.finalWeek - 1] };
  return safe;
}

function seed(spec: GoalSpec, length: (typeof LENGTHS)[number], timezone: string) {
  const shape = planShape(length.weeks);
  const fixedDate = length.fixedDay === null ? null : addDays(START, length.fixedDay);
  const preset = spec.presetId ? CERTIFIED_PRESETS.find((p) => p.id === spec.presetId)! : null;
  const made = makeGoalProfile({ presetId: spec.presetId, domain: null, goalText: spec.rawGoal });
  profileNow = spec.template ? (RECOVERY_TEMPLATES[spec.template] as unknown as RecoveryProfile) : (made as { profile: RecoveryProfile }).profile;
  const targets = targetsFor(spec, shape);
  const weeks: RoadmapWeek[] = targets.map((target, i) => ({
    weekNumber: i + 1,
    phase: i < Math.ceil(shape.weeks / 2) ? 'Base' : 'Build',
    focus: `Focus ${i + 1}`,
    target,
    test: { type: 'count', instructions: 'Check where you are', passIf: 'x' },
  }));
  let roadmap: Roadmap = {
    finalGoal: 'The goal',
    finalTest: 'The final test',
    startingPoint: { value: spec.number?.from ?? null, description: 'Now' },
    method: { name: 'Method', creator: '', summary: 'A method.', whyChosen: 'Fits.', runnerUp: null, safety: 5, rules: ['One thing at a time'], candidates: [] },
    phases: [
      { name: 'Base', startWeek: 1, endWeek: Math.ceil(shape.weeks / 2), purpose: 'Build.' },
      { name: 'Build', startWeek: Math.ceil(shape.weeks / 2) + 1, endWeek: shape.weeks, purpose: 'Grow.' },
    ],
    weeks,
  };
  roadmap = withPathwayTests(roadmap, preset, shape);
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
  const week1 = fakeWeek({ weekNumber: 1, totalWeeks: length.weeks, weekStart: START, planVariant: 'steady', dailyMinutes: 30, test: roadmap.weeks[0].test } as unknown as WeekCallInput);
  for (const row of dailyTaskRows('g1', 1, week1)) {
    db.state.tasks.push({ id: `g1-d${row.dayNumber}`, status: 'pending', usedMinimumVersion: false, notOffered: false, notes: null, completedAt: null, ...JSON.parse(JSON.stringify(row)) });
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
  vi.mocked(generateWeekPlan).mockImplementation(async (input) => fakeWeek(input));
  vi.mocked(askWeeklyUpdate).mockImplementation(async (input) => {
    const verdict = checkWeeklyUpdate(honestUpdate(input), input);
    if ('value' in verdict) return { outcome: 'accepted', update: verdict.value, reasons: [] };
    weeklyRejections.push(`week ${input.weekNumber}: ${verdict.reasons.join(' | ')}`);
    return { outcome: 'fallback', update: null, reasons: verdict.reasons };
  });
  for (const method of ['log', 'warn', 'error', 'info'] as const) vi.spyOn(console, method).mockImplementation(() => {});
  // The production switch states (all five on, docs: CLAUDE.md).
  for (const flag of ['WEEK_CLOSE_ENABLED', 'MISSED_SESSIONS_CARRY_ENABLED', 'METHOD_RECOVERY_ENABLED', 'WEEKLY_UPDATE_ENABLED', 'CUSTOM_RECOVERY_PROFILES_ENABLED']) vi.stubEnv(flag, 'true');
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

const valueOf = (target: unknown) => (target && typeof target === 'object' && (target as WeekTarget).kind === 'number' ? (target as { value: number }).value : null);

interface RunResult {
  problems: string[];
  finished: boolean;
  finalWeekClosed: boolean;
  weeksJumped: number;
  movedDays: number;
  lostLetGo: number;
  lostMove: Record<string, number>;
  updates: { accepted: number; fallback: number };
  checkpoints: string[];
  daysToFinish: number;
  finalAtStart: number | null;
  finalAtEnd: number | null;
}

async function runPlan(spec: GoalSpec, person: Person, length: (typeof LENGTHS)[number]): Promise<RunResult> {
  counters = new Map();
  writtenByKind = new Map();
  weeklyRejections = [];
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
  const finalTargetAtStart = valueOf(db.week(shape.finalWeek).target);
  let lastWeekSeen = 1;
  let day = 0;
  let checkpointsSeen: string[] = [];
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
    // The plan never ends after a fixed date (a shorter plan: the day before it), except "Do my final week" (B-106).
    if (fixedDate && !tookFinalWeek) {
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
    // Targets: never backwards; the ready week keeps the final week's; nothing beyond the goal.
    const nums = db.state.weeks.sort((a, b) => a.weekNumber - b.weekNumber).map((w) => w.target);
    for (let i = 1; i < nums.length; i++) {
      const a = valueOf(nums[i - 1]);
      const b = valueOf(nums[i]);
      if (a !== null && b !== null && harder(a, b, (nums[i] as { direction: 'higher_is_better' | 'lower_is_better' }).direction) && !db.week(i).jumped && db.week(i).status !== 'completed') {
        add(where, `week ${i + 1}'s target ${b} is easier than week ${i}'s ${a}`);
      }
    }
    if (shape.readyWeek !== null && JSON.stringify(db.week(shape.readyWeek).target) !== JSON.stringify(db.week(shape.finalWeek).target)) {
      add(where, `ready week target ${JSON.stringify(db.week(shape.readyWeek).target)} differs from the final week's ${JSON.stringify(db.week(shape.finalWeek).target)}`);
    }
    const finalNow = valueOf(db.week(shape.finalWeek).target);
    const accepted = (Array.isArray(goal.roadmap?.checkpoints) ? goal.roadmap.checkpoints : []).some((c: any) => c.answer === 'accept');
    // The final target moves only by an accepted checkpoint, or lowered by the safe climb (recorded in loweredTargets).
    const safetyLowered = (Array.isArray(goal.roadmap?.loweredTargets) ? goal.roadmap.loweredTargets : []).some((l: any) => l.week === shape.finalWeek) || finalNow === null || finalTargetAtStart === null || harder(finalTargetAtStart, finalNow, (db.week(shape.finalWeek).target as any).direction);
    if (finalTargetAtStart !== null && finalNow !== finalTargetAtStart && !accepted && !safetyLowered) add(where, `final target moved from ${finalTargetAtStart} to ${finalNow} with no accepted checkpoint`);

    // Checkpoint offers: answered as the person would.
    const active2 = await call('/active', at, undefined, 'GET');
    const offer = active2.body?.activeGoal?.checkpoint;
    if (offer && !checkpointsSeen.includes(`${offer.week}-${offer.kind}`)) {
      checkpointsSeen.push(`${offer.week}-${offer.kind}`);
      const answer = offer.kind === 'line_only' ? 'keep' : person.checkpoint ?? 'keep';
      const answered = await call('/checkpoint', at, { week: offer.week, answer });
      if (answered.status !== 200) add(where, `checkpoint answer ${answer} answered ${answered.status} ${JSON.stringify(answered.body)}`);
    }

    // The person's day.
    const task = db.state.tasks.find((t) => t.date === today && t.weekNumber === db.goal().currentWeek && !t.isRestDay && !t.notOffered);
    const practise = person.practises?.(ctx) ?? true;
    if (task && task.status !== 'completed' && practise) {
      const done = await call(`/tasks/${task.id}`, at, { status: 'completed' }, 'PATCH');
      if (done.status !== 200) add(where, `completing ${task.date} answered ${done.status} ${JSON.stringify(done.body)}`);
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
    // The test, on the test day, when they log it.
    const testTask = db.state.tasks.find((t) => t.date === today && t.weekNumber === db.goal().currentWeek && t.isTestDay);
    if (testTask && person.logs && practise) {
      const week = db.week(testTask.weekNumber);
      const light = week.test?.light === true;
      const target = week.target as WeekTarget;
      let body: Record<string, unknown>;
      if (light) body = { value: 'Done', passed: true, note: 'Felt fine' };
      else if (target.kind === 'number') {
        const f = person.result ?? 1;
        const value = target.direction === 'lower_is_better' ? Math.round((target.value / f) * 10) / 10 : Math.round(target.value * f * 10) / 10;
        body = { value, unit: target.unit, passed: target.direction === 'lower_is_better' ? value <= target.value : value >= target.value };
      } else body = { value: 'Done', passed: (person.result ?? 1) >= 1 };
      const logged = await call(`/weeks/${testTask.weekNumber}/test-result`, at, body, 'PUT');
      if (logged.status !== 200) add(where, `test log answered ${logged.status} ${JSON.stringify(logged.body)}`);
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
    writeFileSync(process.env.SWEEP_DEBUG_OUT ?? 'sweep-debug.json', JSON.stringify({ problems, state: db.state, calls: vi.mocked(generateWeekPlan).mock.calls.map(([i]) => ({ week: i.weekNumber, whereTheyAre: i.whereTheyAre })), updates: vi.mocked(askWeeklyUpdate).mock.calls.map(([i]) => i) }, null, 1));
  }
  for (const r of weeklyRejections) problems.push(`${spec.name} / ${person.name} / ${length.name}: our honest weekly update was rejected, ${r}`);
  return {
    problems,
    finished: goal.status === 'completed',
    finalWeekClosed: db.week(shape.weeks).status === 'completed',
    weeksJumped: db.state.weeks.filter((w) => w.jumped).length,
    movedDays: goal.movedDays ?? 0,
    lostLetGo,
    lostMove,
    updates: {
      accepted: vi.mocked(askWeeklyUpdate).mock.calls.length - weeklyRejections.length,
      fallback: weeklyRejections.length,
    },
    checkpoints: checkpointsSeen,
    daysToFinish: day + 1,
    finalAtStart: finalTargetAtStart,
    finalAtEnd: valueOf(db.week(shape.finalWeek).target),
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
