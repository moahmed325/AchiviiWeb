import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

vi.mock('../src/lib/ai/gemini.js', () => ({ generateStructuredContent: vi.fn() }));
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    goal: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    roadmapWeek: { update: vi.fn(), updateMany: vi.fn(), createMany: vi.fn() },
    dailyTask: { update: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn(),
}));

import { prisma } from '../src/lib/prisma.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';
import { generateWeekPlan } from '../src/lib/ai/weekPlan.js';
import { roadmapWeekRows, storedRoadmap, writeNextWeek } from '../src/lib/planV2.js';
import {
  checkRoadmapAnswer,
  formatTarget,
  presetMethod,
  withPathwayTests,
  type RawRoadmapAnswer,
  type Roadmap,
  type WeekTarget,
  type WeekTest,
} from '../src/lib/ai/roadmap.js';
import { recompPreset, run10kPreset, type CertifiedPresetBlueprint } from '../src/lib/ai/presets/index.js';
import { extractStatedTargets } from '../src/lib/research/statedTarget.js';
import { safeGoalTargets, safeStoredTargets, week12LineFor } from '../src/lib/safety/storedTargets.js';
import { nextSafeStep, safeCheckWeekClimb } from '../src/lib/safety/targetSteps.js';

// Plan safety limits M1.3 (RULE-9, RULE-3, PSL-7, PSL-11 Q1, Q14, PSL-12): an older goal's stored targets are lowered on
// read, in presentGoal and writeNextWeek, and nothing stored changes; a goal created since M1.2 comes back unchanged.

type Direction = 'higher_is_better' | 'lower_is_better';
type Climb = { metric: string; unit: string; direction: Direction; start: number | null; values: number[] };

const METHOD = { name: 'Easy miles', creator: 'Coach', summary: 'Mostly easy.', whyChosen: '', runnerUp: null, safety: 4, rules: ['Easy'], candidates: [] };
const PHASES = [
  { name: 'Base', startWeek: 1, endWeek: 4, purpose: 'Build the base.' },
  { name: 'Build', startWeek: 5, endWeek: 8, purpose: 'Build on it.' },
  { name: 'Peak', startWeek: 9, endWeek: 12, purpose: 'Get ready.' },
];

function target(climb: Climb, value: number): WeekTarget {
  return { kind: 'number', metric: climb.metric, value, unit: climb.unit, direction: climb.direction };
}

/** A goal stored before M1.2: the model's climb as it was, with the model's (or, on a split pathway, the preset's) tests. */
function olderRoadmap(climb: Climb, preset?: Pick<CertifiedPresetBlueprint, 'weeklyTests'>): Roadmap {
  const roadmap: Roadmap = {
    finalGoal: 'The model wrote this goal.',
    finalTest: 'The model wrote its own final test.',
    startingPoint: { value: climb.start, description: 'Where they are today.' },
    method: METHOD,
    phases: PHASES,
    weeks: climb.values.map((value, index) => ({
      weekNumber: index + 1,
      phase: PHASES[Math.floor(index / 4)].name,
      focus: `Focus ${index + 1}`,
      target: target(climb, value),
      test: { type: 'count', instructions: `The model wrote this test for ${value} ${climb.unit}.`, passIf: `${value} ${climb.unit}` },
    })),
  };
  return preset ? withPathwayTests(roadmap, preset) : roadmap;
}

function goalOf(rawGoal: string, roadmap: Roadmap, id = 'goal-1') {
  const rows = roadmapWeekRows(id, roadmap, 45, 'steady').map((row, index) => ({ id: `rw-${index + 1}`, ...row }));
  return {
    id,
    userId: 'u1',
    planVersion: 2,
    status: 'active',
    rawGoal,
    clarifiedOutcome: roadmap.finalGoal,
    currentWeek: 1,
    startDate: new Date('2026-06-01T00:00:00Z'),
    routine: JSON.stringify({ dailyMinutes: 45, planVariant: 'steady' }),
    roadmap: JSON.parse(JSON.stringify(storedRoadmap(roadmap, [{ id: 'success', question: 'Success?', answer: '' }]))),
    roadmapWeeks: rows,
    dailyTasks: [],
    weeklyReviews: [],
  };
}

const valueOf = (week: { target: unknown }) => (week.target as Extract<WeekTarget, { kind: 'number' }>).value;
const testOf = (week: { test: unknown }) => week.test as WeekTest;

/** Long-run distance from 3 km, climbing 2 km a week at first: faster than +1 km or +10%. */
const OLDER_10K: Climb = { metric: 'Long run distance', unit: 'km', direction: 'higher_is_better', start: 3, values: [5, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] };
const SAFE_10K = [4, 5, 6, 7, 8, 9, 10, 11, 12.1, 13.3, 14.6, 16];
/** run10k's preset tests without the light test: a pathway goal stored with the preset's own measured test every week. */
const MEASURED_10K = { ...run10kPreset, weeklyTests: { measured: run10kPreset.weeklyTests!.measured } };

/** A recomp goal stored on the split pathway (light weeks hold the next big week's target): 24, 20, 18 from 28. */
const OLDER_RECOMP: Climb = { metric: 'Body fat', unit: '%', direction: 'lower_is_better', start: 28, values: [24, 24, 24, 24, 20, 20, 20, 20, 18, 18, 18, 18] };

describe('an older goal is lowered on read (RULE-9, AC-9)', () => {
  it('run10k distance: every too-steep week lowered, objective, test, keyMilestone and finalTest rebuilt from the preset', () => {
    const stored = goalOf('Run my first 10K', olderRoadmap(OLDER_10K, MEASURED_10K));
    const before = JSON.parse(JSON.stringify(stored));
    const safe = safeGoalTargets(stored)!;

    expect(safe.weeks.map(valueOf)).toEqual(SAFE_10K);
    const week12 = safe.weeks[11];
    expect(week12.objective).toBe('Long run distance: 16 km');
    expect(testOf(week12)).toEqual({
      type: run10kPreset.weeklyTests!.measured.type,
      instructions: run10kPreset.weeklyTests!.measured.instructions.replace('{target}', 'Long run distance: 16 km'),
      passIf: 'Long run distance: 16 km',
    });
    expect(week12.keyMilestone).toBe(`${testOf(week12).instructions} Pass if: Long run distance: 16 km`);
    expect(safe.finalTest).toBe(testOf(week12).instructions);
    expect(safe.foundNow).toHaveLength(12);
    expect(safe.foundNow[11]).toEqual({ week: 12, model: 18, safe: 16 });
    // Nothing stored changes.
    expect(JSON.parse(JSON.stringify(stored))).toEqual(before);
  });

  it('recomp on the split pathway: checked on weeks 4, 8 and 12 four steps apart, the light weeks follow (PSL-11 Q1)', () => {
    const stored = goalOf('Body recomp: get to 18% body fat', olderRoadmap(OLDER_RECOMP, recompPreset));
    expect(testOf(stored.roadmapWeeks[0]).light).toBe(true);
    const safe = safeGoalTargets(stored)!;

    expect(safe.weeks.map(valueOf)).toEqual([26, 26, 26, 26, 24, 24, 24, 24, 22, 22, 22, 22]);
    expect(safe.foundNow).toEqual([
      { week: 4, model: 24, safe: 26 },
      { week: 8, model: 20, safe: 24 },
      { week: 12, model: 18, safe: 22 },
    ]);
    // A light week's test does not change; its objective names the next check's lowered target.
    expect(safe.weeks[0].test).toEqual(stored.roadmapWeeks[0].test);
    expect(safe.weeks[0].keyMilestone).toBe(stored.roadmapWeeks[0].keyMilestone);
    expect(safe.weeks[0].objective).toBe('Body fat: 26 % or less');
    // A big week's test is refilled from the preset.
    expect(testOf(safe.weeks[7]).instructions).toContain('Log the number for your target: Body fat: 24 % or less');
    expect(testOf(safe.weeks[7]).passIf).toBe('Body fat: 24 % or less');
    expect(safe.finalTest).toContain('Body fat: 22 % or less');
    expect(safe.week12Line).toEqual({ safe: '22 %', goal: '18 %' });
  });

  it('a custom goal: lowered, its test text and finalTest kept, only the pass mark rebuilt (PSL-7)', () => {
    const lift: Climb = { metric: 'Bench press', unit: 'kg', direction: 'higher_is_better', start: 60, values: [65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120] };
    const stored = goalOf('Bench press 120 kg', olderRoadmap(lift));
    const safe = safeGoalTargets(stored)!;

    let prev = 60;
    for (const week of safe.weeks) {
      expect(valueOf(week)).toBeLessThanOrEqual(nextSafeStep(week.target as WeekTarget, prev)!);
      prev = valueOf(week);
    }
    expect(valueOf(safe.weeks[0])).toBe(63);
    const week12 = safe.weeks[11];
    expect(valueOf(week12)).toBeLessThan(120);
    expect(testOf(week12).instructions).toBe('The model wrote this test for 120 kg.');
    expect(testOf(week12).passIf).toBe(formatTarget(week12.target as WeekTarget));
    expect(week12.keyMilestone).toBe(`The model wrote this test for 120 kg. Pass if: ${formatTarget(week12.target as WeekTarget)}`);
    expect(safe.finalTest).toBe('The model wrote its own final test.');
    expect(safe.week12Line).toEqual({ safe: `${valueOf(week12)} kg`, goal: '120 kg' });
  });

  it('a custom keyMilestone without " Pass if: " is left as stored', () => {
    const lift: Climb = { metric: 'Bench press', unit: 'kg', direction: 'higher_is_better', start: 60, values: [65, 70, 75, 80, 85, 90, 92, 94, 96, 97, 98, 100] };
    const stored = goalOf('Bench press 100 kg', olderRoadmap(lift));
    stored.roadmapWeeks[0] = { ...stored.roadmapWeeks[0], keyMilestone: 'Hit a new bench' };
    expect(safeGoalTargets(stored)!.weeks[0].keyMilestone).toBe('Hit a new bench');
  });

  it('no starting point: week 1 is not checked, the check runs from week 2 (PSL-11 Q14)', () => {
    const stored = goalOf('Run my first 10K', olderRoadmap({ ...OLDER_10K, start: null }));
    const safe = safeGoalTargets(stored)!;
    expect(valueOf(safe.weeks[0])).toBe(5);
    expect(safe.weeks[0]).toBe(stored.roadmapWeeks[0]);
    expect(valueOf(safe.weeks[1])).toBe(6);
  });

  it('a deficit target over 600 is lowered to 600', () => {
    const deficit: Climb = { metric: 'Daily calorie deficit', unit: 'kcal', direction: 'higher_is_better', start: 0, values: [300, 400, 500, 600, 700, 800, 800, 800, 800, 800, 800, 800] };
    const safe = safeGoalTargets(goalOf('Lose some weight', olderRoadmap(deficit)))!;
    expect(safe.weeks.map(valueOf)).toEqual([300, 400, 500, 600, 600, 600, 600, 600, 600, 600, 600, 600]);
  });

  it('a goal with no family is untouched', () => {
    const typing: Climb = { metric: 'Typing speed', unit: 'wpm', direction: 'higher_is_better', start: 20, values: [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140] };
    const stored = goalOf('Type 140 words per minute', olderRoadmap(typing));
    const safe = safeGoalTargets(stored)!;
    stored.roadmapWeeks.forEach((week, index) => expect(safe.weeks[index]).toBe(week));
    expect(safe.lowered).toEqual([]);
    expect(safe.week12Line).toBeNull();
  });

  it('a goal without a v2 roadmap or without weeks is not read', () => {
    const stored = goalOf('Run my first 10K', olderRoadmap(OLDER_10K, MEASURED_10K));
    expect(safeGoalTargets({ ...stored, roadmap: null })).toBeNull();
    expect(safeGoalTargets({ ...stored, roadmapWeeks: undefined })).toBeNull();
  });
});

/** The roadmap answer goal create checks (M1.2's path). */
function answer(climb: Climb): RawRoadmapAnswer {
  const fixed = presetMethod(run10kPreset);
  return {
    finalGoal: `Run a 10K in ${climb.values[11]} minutes or less`,
    finalTest: 'The model wrote its own final test.',
    startingPoint: { value: climb.start, description: 'Where they are today.' },
    candidates: [],
    chosen: fixed.name,
    whyChosen: 'It fits.',
    runnerUp: { name: '', whyLost: '' },
    safety: 4,
    rules: ['Rule one', 'Rule two', 'Rule three', 'Rule four', 'Rule five'],
    phases: PHASES,
    weeks: climb.values.map((value, index) => ({
      weekNumber: index + 1,
      phase: 'Base',
      focus: `Focus ${index + 1}`,
      target: target(climb, value),
      test: { type: 'count', instructions: 'The model wrote this test.', passIf: `${value}` },
    })),
  };
}

function createdSinceM12(climb: Climb, goal: string, split: boolean) {
  const result = checkRoadmapAnswer(answer(climb), {
    statedTargets: extractStatedTargets(goal),
    fixedMethod: presetMethod(run10kPreset),
    pathwayTests: true,
    pathwayId: 'run10k',
  });
  if (!('value' in result)) throw new Error(result.reason);
  const { targetCheck: _check, ...checked } = result.value;
  const preset = split ? run10kPreset : { ...run10kPreset, weeklyTests: { measured: run10kPreset.weeklyTests!.measured } };
  return goalOf(goal, withPathwayTests(checked, preset));
}

const STEEP_10K: Climb = { metric: '10K time', unit: 'minutes', direction: 'lower_is_better', start: 70, values: [68, 66, 64, 62, 60, 58, 56, 55, 54, 53, 52, 50] };
const GENTLE_10K: Climb = { ...STEEP_10K, start: 60, values: [59, 58, 57, 56, 55, 54, 53.5, 53, 52.5, 52, 51.5, 51] };

describe('a goal created since M1.2 comes back unchanged', () => {
  for (const split of [false, true]) {
    it(`lowered at create (${split ? 'split' : 'not split'}): no week changes, the stored list is kept`, () => {
      const stored = createdSinceM12(STEEP_10K, 'Run a 10K in under 50 minutes', split);
      expect(stored.roadmap.loweredTargets).toBeDefined();
      const safe = safeGoalTargets(stored)!;
      stored.roadmapWeeks.forEach((week, index) => expect(safe.weeks[index]).toBe(week));
      expect(safe.foundNow).toEqual([]);
      expect(safe.lowered).toEqual(stored.roadmap.loweredTargets);
      expect(safe.finalTest).toBe(stored.roadmap.finalTest);
    });

    it(`not lowered at create (${split ? 'split' : 'not split'}): no week changes and no line`, () => {
      const stored = createdSinceM12(GENTLE_10K, 'Run a faster 10K', split);
      expect(stored.roadmap.loweredTargets).toBeUndefined();
      const safe = safeGoalTargets(stored)!;
      stored.roadmapWeeks.forEach((week, index) => expect(safe.weeks[index]).toBe(week));
      expect(safe.week12Line).toBeNull();
    });
  }

  it('the four-step check never lowers what the one-step check passed', () => {
    const stored = createdSinceM12(STEEP_10K, '', true);
    const big = [4, 8, 12].map((week) => stored.roadmapWeeks[week - 1].target as WeekTarget);
    expect(safeCheckWeekClimb(big, [4, 8, 12], 70, { run10k: true }).lowered).toEqual([]);
  });
});

describe('the honest week 12 line (RULE-3, PSL-12)', () => {
  it('week 12 lowered at create below the stated time: the full line with both numbers', () => {
    const safe = safeGoalTargets(createdSinceM12(STEEP_10K, 'Run a 10K in under 50 minutes', true))!;
    expect(safe.week12Line).toEqual({ safe: '55.5 minutes', goal: '50 minutes' });
  });

  it('week 12 lowered and the goal text names no number: goal is null', () => {
    expect(safeGoalTargets(goalOf('Run my first 10K', olderRoadmap(OLDER_10K, MEASURED_10K)))!.week12Line).toEqual({ safe: '16 km', goal: null });
  });

  it('week 12 not lowered: null, even when an earlier week was', () => {
    const early: Climb = { ...OLDER_10K, values: [5, 5, 6, 7, 8, 9, 10, 11, 11, 12, 13, 14] };
    const safe = safeGoalTargets(goalOf('Run my first 10K', olderRoadmap(early)))!;
    expect(safe.foundNow.map((item) => item.week)).toEqual([1]);
    expect(safe.week12Line).toBeNull();
  });

  it('the stored list and the ones found now are merged, one entry per week', () => {
    const rows = goalOf('Run my first 10K', olderRoadmap(OLDER_10K, MEASURED_10K)).roadmapWeeks;
    const result = safeStoredTargets({ weeks: rows, startValue: 3, finalTest: '', loweredTargets: [{ week: 1, model: 9, safe: 5 }], pathway: run10kPreset });
    expect(result.lowered.filter((item) => item.week === 1)).toEqual([{ week: 1, model: 9, safe: 5 }]);
    expect(result.lowered).toHaveLength(12);
  });
});

describe('presentGoal sends the lowered plan and writes nothing', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/goal', goalRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') throw new Error('no port');
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', email: 'u@achivii.com', timezone: 'UTC' } as never);
  });

  it('GET /active: an older goal comes back with safe targets and the line; nothing is written or logged', async () => {
    const stored = goalOf('Run my first 10K', olderRoadmap(OLDER_10K, MEASURED_10K));
    const before = JSON.parse(JSON.stringify(stored));
    vi.mocked(prisma.goal.findFirst).mockResolvedValue(stored as never);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const body = await (await fetch(`${baseUrl}/api/goal/active`, { headers: { Authorization: 'Bearer t' } })).json();

    expect(body.activeGoal.roadmapWeeks.map(valueOf)).toEqual(SAFE_10K);
    expect(body.activeGoal.roadmapWeeks[11].objective).toBe('Long run distance: 16 km');
    expect(body.activeGoal.roadmap.finalTest).toContain('Target: Long run distance: 16 km');
    expect(body.activeGoal.week12Line).toEqual({ safe: '16 km', goal: null });
    expect(JSON.parse(JSON.stringify(stored))).toEqual(before);
    for (const model of [prisma.goal, prisma.roadmapWeek, prisma.dailyTask] as unknown as Array<Record<string, { mock: { calls: unknown[] } }>>) {
      for (const [name, fn] of Object.entries(model)) if (name !== 'findFirst') expect(fn.mock.calls).toHaveLength(0);
    }
    expect(warn.mock.calls.filter((call) => call[0] === '[Safety]')).toHaveLength(0);
    warn.mockRestore();
  });

  it('GET /active: a goal with nothing to lower comes back as stored, with week12Line null', async () => {
    const stored = createdSinceM12(GENTLE_10K, 'Run a faster 10K', true);
    vi.mocked(prisma.goal.findFirst).mockResolvedValue(stored as never);
    const body = await (await fetch(`${baseUrl}/api/goal/active`, { headers: { Authorization: 'Bearer t' } })).json();
    expect(body.activeGoal.roadmapWeeks).toEqual(JSON.parse(JSON.stringify(stored.roadmapWeeks)));
    expect(body.activeGoal.roadmap).toEqual(stored.roadmap);
    expect(body.activeGoal.week12Line).toBeNull();
  });
});

describe('writeNextWeek tells the week writer the safe targets (RULE-9, RULE-10)', () => {
  const weekCall = vi.mocked(generateWeekPlan);
  beforeEach(() => {
    vi.clearAllMocks();
    weekCall.mockResolvedValue([]);
  });

  it('an older goal: the lowered next and last targets and the refilled test; one lowered_on_read line', async () => {
    const goal = goalOf('Run my first 10K', olderRoadmap(OLDER_10K, MEASURED_10K));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await writeNextWeek(goal as never, 3, [], '07:00');

    const input = weekCall.mock.calls[0][0];
    expect(input.target).toEqual(target(OLDER_10K, 7));
    expect(input.test.passIf).toBe('Long run distance: 7 km');
    expect(input.lastWeek?.target).toEqual(target(OLDER_10K, 6));
    const lines = warn.mock.calls.filter((call) => call[0] === '[Safety]').map((call) => JSON.parse(call[1] as string));
    expect(lines).toEqual([
      {
        goalId: 'goal-1',
        week: 4,
        rule: 'target_step',
        step: 'Week 4 target',
        matched: 'Long run distance: 10 km lowered to 7 km',
        model: 10,
        safe: 7,
        outcome: 'lowered_on_read',
      },
    ]);
    warn.mockRestore();
  });

  it('a goal with nothing to lower: the stored target and test themselves, and no line', async () => {
    const goal = createdSinceM12(GENTLE_10K, 'Run a faster 10K', true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await writeNextWeek(goal as never, 3, [], '07:00');
    const input = weekCall.mock.calls[0][0];
    expect(input.target).toBe(goal.roadmapWeeks[3].target);
    expect(input.test).toBe(goal.roadmapWeeks[3].test);
    expect(input.lastWeek?.target).toBe(goal.roadmapWeeks[2].target);
    expect(warn.mock.calls.filter((call) => call[0] === '[Safety]')).toHaveLength(0);
    warn.mockRestore();
  });
});

describe('M1.3 review fixes', () => {
  const sent = (goal: ReturnType<typeof goalOf>) => safeGoalTargets(goal)!;
  const closeWeeks = (goal: ReturnType<typeof goalOf>, upTo: number) => ({
    ...goal,
    currentWeek: Math.min(upTo + 1, 12),
    roadmapWeeks: goal.roadmapWeeks.map((week) =>
      week.weekNumber <= upTo ? { ...week, status: 'completed' } : week.weekNumber === upTo + 1 ? { ...week, status: 'active' } : week
    ),
  });

  it('(B) weeks 1-3 closed at 5, 7 and 9 km: kept, and week 4 is checked against 9 km and keeps 10 km', () => {
    const goal = closeWeeks(goalOf('Run my first 10K', olderRoadmap(OLDER_10K, MEASURED_10K)), 3);
    const result = sent(goal);
    goal.roadmapWeeks.forEach((week, index) => expect(result.weeks[index]).toBe(week));
    expect(result.weeks.map(valueOf)).toEqual(OLDER_10K.values);
    expect(result.foundNow).toEqual([]);
    expect(result.week12Line).toBeNull();
  });

  it('(B) the same goal with nothing closed is lowered from the starting point as before', () => {
    expect(sent(goalOf('Run my first 10K', olderRoadmap(OLDER_10K, MEASURED_10K))).weeks.map(valueOf)).toEqual(SAFE_10K);
  });

  it('(B) a too-steep climb after the closed weeks is still lowered, from the last closed week', () => {
    const steep: Climb = { ...OLDER_10K, values: [5, 7, 9, 14, 15, 16, 17, 18, 19, 20, 21, 22] };
    const goal = closeWeeks(goalOf('Run my first 10K', olderRoadmap(steep, MEASURED_10K)), 3);
    const result = sent(goal);
    [0, 1, 2].forEach((index) => expect(result.weeks[index]).toBe(goal.roadmapWeeks[index]));
    expect(valueOf(result.weeks[3])).toBe(10);
    let prev = 9;
    for (const week of result.weeks.slice(3)) {
      expect(valueOf(week)).toBeLessThanOrEqual(nextSafeStep(week.target as WeekTarget, prev)!);
      prev = valueOf(week);
    }
    expect(result.foundNow[0]).toEqual({ week: 4, model: 14, safe: 10 });
  });

  it('(B) a light-test goal with week 4 closed: weeks 1-4 kept, week 8 checked four steps from week 4', () => {
    const goal = closeWeeks(goalOf('Body recomp: get to 18% body fat', olderRoadmap(OLDER_RECOMP, recompPreset)), 4);
    const result = sent(goal);
    [0, 1, 2, 3].forEach((index) => expect(result.weeks[index]).toBe(goal.roadmapWeeks[index]));
    expect(result.weeks.map(valueOf)).toEqual([24, 24, 24, 24, 22, 22, 22, 22, 20, 20, 20, 20]);
    expect(result.foundNow).toEqual([
      { week: 8, model: 20, safe: 22 },
      { week: 12, model: 18, safe: 20 },
    ]);
    expect(result.week12Line).toEqual({ safe: '20 %', goal: '18 %' });
  });

  it('(B) a light-test goal with only light weeks closed is checked from the starting point', () => {
    const goal = closeWeeks(goalOf('Body recomp: get to 18% body fat', olderRoadmap(OLDER_RECOMP, recompPreset)), 3);
    const result = sent(goal);
    [0, 1, 2].forEach((index) => expect(result.weeks[index]).toBe(goal.roadmapWeeks[index]));
    expect(result.weeks.slice(3).map(valueOf)).toEqual([26, 24, 24, 24, 24, 22, 22, 22, 22]);
  });

  for (const split of [false, true]) {
    it(`(B) a goal created since M1.2 with weeks closed still comes back unchanged (${split ? 'split' : 'not split'})`, () => {
      for (const upTo of [3, 4, 8]) {
        const goal = closeWeeks(createdSinceM12(STEEP_10K, 'Run a 10K in under 50 minutes', split), upTo);
        const result = sent(goal);
        goal.roadmapWeeks.forEach((week, index) => expect(result.weeks[index]).toBe(week));
        expect(result.foundNow).toEqual([]);
      }
    });
  }

  it('(1) a completed goal comes back exactly as stored, with no line for a week 12 lowered only on read (2)', () => {
    const goal = { ...closeWeeks(goalOf('Run my first 10K', olderRoadmap(OLDER_10K, MEASURED_10K)), 12), status: 'completed' };
    const result = sent(goal);
    goal.roadmapWeeks.forEach((week, index) => expect(result.weeks[index]).toBe(week));
    expect(result.finalTest).toBe(goal.roadmap.finalTest);
    expect(result.week12Line).toBeNull();
  });

  it('(1) a jumped week counts as closed', () => {
    const goal = goalOf('Run my first 10K', olderRoadmap(OLDER_10K, MEASURED_10K));
    goal.roadmapWeeks[4] = { ...goal.roadmapWeeks[4], jumped: true } as never;
    expect(sent(goal).weeks[4]).toBe(goal.roadmapWeeks[4]);
  });

  it('(2) a week 12 lowered at create keeps its line when it is closed', () => {
    const goal = closeWeeks(createdSinceM12(STEEP_10K, 'Run a 10K in under 50 minutes', true), 12);
    expect(sent(goal).week12Line).toEqual({ safe: '55.5 minutes', goal: '50 minutes' });
  });

  it('(3) "lose 10 kg" from 90 kg, week 12 lowered from 80 to 82 kg: the weight it implies', () => {
    const weight: Climb = { metric: 'Body weight', unit: 'kg', direction: 'lower_is_better', start: 90, values: [89.2, 88.4, 87.6, 86.8, 86, 85.2, 84.4, 83.6, 82.8, 82.8, 82.8, 80] };
    const result = safeGoalTargets(goalOf('Lose 10 kg', olderRoadmap(weight)))!;
    expect(result.foundNow).toEqual([{ week: 12, model: 80, safe: 82 }]);
    expect(result.week12Line).toEqual({ safe: '82 kg', goal: '80 kg' });
  });

  it('(3) "lose N" with no starting point: the short line', () => {
    expect(week12LineFor([{ week: 12, model: 80, safe: 82 }], { kind: 'number', metric: 'Body weight', value: 82, unit: 'kg', direction: 'lower_is_better' }, 'Lose 10 kg. ', null)).toEqual({
      safe: '82 kg',
      goal: null,
    });
  });

  it('(4) an older run10k goal with a model-written test keeps its test text and finalTest; only the pass marks change', () => {
    const steep: Climb = { ...OLDER_10K, start: 4, values: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18] };
    const stored = goalOf('Run my first 10K', olderRoadmap(steep));
    const result = safeGoalTargets(stored)!;
    expect(result.foundNow.map((item) => item.week)).toEqual([12]);
    const week12 = result.weeks[11];
    const safeText = formatTarget(week12.target as WeekTarget);
    expect(testOf(week12)).toEqual({ ...testOf(stored.roadmapWeeks[11]), passIf: safeText });
    expect(week12.keyMilestone).toBe(`The model wrote this test for 18 km. Pass if: ${safeText}`);
    expect(result.finalTest).toBe('The model wrote its own final test.');
  });
});
