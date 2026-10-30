import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));
vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import {
  LIGHT_TEST_STEP,
  WEEK_RESPONSE_SCHEMA,
  buildWeekPrompt,
  checkWeekAnswer,
  codeMadeTestStep,
  generateWeekPlan,
  runningLines,
  weekLayout,
  weekResponseSchema,
  type RawWeekAnswer,
  type WeekCallInput,
  type WeekDayPlan,
} from '../src/lib/ai/weekPlan.js';
import { writeNextWeek } from '../src/lib/planV2.js';
import { baseWeekOf, runOf, weekBreaches, weekRunning, type BaseTask, type BaseWeek } from '../src/lib/safety/weekLoad.js';
import { PATHWAY_PROFILES } from '../src/lib/recovery/pathways.js';
import { placeHandoff } from '../src/lib/recovery/handoff.js';
import type { DetailedStep } from '../src/lib/ai/goalDecomposer.js';
import { RUN10K_WEEK1 } from './run10kWeekInput.js';

// Plan safety limits M2.2a (RULE-5, RULE-6, RULE-10, AC-5, AC-6, AC-10, B-64, PSL-15): week limits against the base week.

const WEEK1: WeekCallInput = { ...RUN10K_WEEK1, loadGoal: { running: true } };
/** A later, measured week (not light). */
const WEEK5: WeekCallInput = { ...WEEK1, weekNumber: 5 };
const minutesBase = (total: number, runs = 3): BaseWeek => ({ known: true, unit: 'minutes', total, totalMinutes: total, runs });
/** A big base, so the running total never decides. */
const BIG = minutesBase(500, 5);

function step(title: string, priority: number, minutes: number, extra: Record<string, unknown> = {}) {
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

interface RunSpec {
  min: number;
  km?: number;
  hard?: boolean;
  kind?: string;
  /** With `km`: also give `runMinutes`. */
  minutesToo?: boolean;
  /** No load at all (a step kept on the last attempt). */
  noLoad?: boolean;
}

const loadOf = (run: RunSpec) =>
  run.noLoad
    ? {}
    : {
        load: {
          ...(run.km !== undefined ? { runKm: run.km } : {}),
          ...(run.km === undefined || run.minutesToo ? { runMinutes: run.min } : {}),
          hardRun: run.hard ?? false,
        },
      };

const minimum = (dayNumber: number, load: Record<string, unknown> = { runMinutes: 10, hardRun: false }) => ({ ...step(`Short easy run ${dayNumber}`, 1, 10), load });

type Practice = 1 | 2 | 3 | 5;

/**
 * Steady: days 1-3 and 5-6 practice, 4 and 7 rest. Each practice day is its run plus a mobility step, 40 minutes in all
 * (so code never rescales the minutes); a day with no run gets two mobility steps. Day 6's run is `day6` (an easy
 * 10-minute run unless given; null for none). No weekly tests (2026-10-30): day 6 was the test day.
 */
function week(runs: Partial<Record<Practice, RunSpec>>, day6: RunSpec | null = { min: 10 }, change: (days: Array<Record<string, any>>) => void = () => {}): RawWeekAnswer {
  const days: Array<Record<string, any>> = Array.from({ length: 7 }, (_, index) => {
    const dayNumber = index + 1;
    if (dayNumber === 4 || dayNumber === 7) return { dayNumber, isKeySession: false, title: 'Rest and recover', whyToday: 'Recovery.', steps: [] };
    let steps: unknown[];
    {
      const run = dayNumber === 6 ? day6 ?? undefined : runs[dayNumber as Practice];
      steps = run
        ? [
            step(`Run ${dayNumber}`, 1, run.min, { kind: run.kind ?? 'easy_session', highLoad: true, ...loadOf(run) }),
            step(`Calf and hip circuit ${dayNumber}`, 2, 40 - run.min, { kind: 'strength_and_mobility' }),
          ]
        : [
            step(`Core circuit ${dayNumber}`, 1, 20, { kind: 'strength_and_mobility' }),
            step(`Hip circuit ${dayNumber}`, 2, 20, { kind: 'strength_and_mobility' }),
          ];
    }
    return { dayNumber, isKeySession: false, title: `Day ${dayNumber} session`, whyToday: 'Builds running.', steps, minimumVersion: minimum(dayNumber) };
  });
  change(days);
  return { days };
}

/** A day's step load, added on the practice day's second step (a mobility step). */
const withStepLoad = (day: number, load: Record<string, unknown>) => (days: Array<Record<string, any>>) => {
  days[day - 1].steps[1].load = load;
};

const reasonOf = (result: ReturnType<typeof checkWeekAnswer>) => ('reason' in result ? result.reason : '');
const valueOf = (result: ReturnType<typeof checkWeekAnswer>) => ('value' in result ? result.value : null);

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.mocked(generateStructuredContent).mockReset();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const safetyLines = () =>
  warn.mock.calls.filter((call: unknown[]) => call[0] === '[Safety]').map((call: unknown[]) => JSON.parse(call[1] as string) as Record<string, unknown>);

describe('AC-5: the running total against the base week (later weeks only)', () => {
  it('passes at the limit and refuses one past, with both numbers in the reason', () => {
    const input = { ...WEEK5, baseWeek: minutesBase(60) };
    expect(valueOf(checkWeekAnswer(week({ 1: { min: 15 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 25 }), input))).not.toBeNull();
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 15 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 26 }), input))).toContain(
      "This week's running is 71 minutes; the most allowed is 70 minutes (last week 60, plus 10 minutes)."
    );
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 15 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 30 }), input))).toContain(
      "SAFETY: This week's running is 75 minutes; the most allowed is 70 minutes (last week 60, plus 10 minutes)."
    );
  });

  it('the allowance is 10% when that is more than 10 minutes', () => {
    const input = { ...WEEK5, baseWeek: minutesBase(120) };
    const runs = { 1: { min: 30 }, 2: { min: 30 }, 3: { min: 30 }, 5: { min: 22 } };
    expect(valueOf(checkWeekAnswer(week(runs, { min: 20 }), input))).not.toBeNull();
    expect(reasonOf(checkWeekAnswer(week(runs, { min: 21 }), input))).toContain('the most allowed is 132 minutes (last week 120, plus 10%)');
  });

  it('in km: 1 km more passes, a little past refuses', () => {
    const input = { ...WEEK5, baseWeek: { known: true, unit: 'km', total: 10, totalMinutes: 60, runs: 3 } as BaseWeek };
    const runs = { 1: { min: 15, km: 2.5 }, 2: { min: 15, km: 2.5 }, 3: { min: 15, km: 2.5 } };
    expect(valueOf(checkWeekAnswer(week(runs, { min: 25, km: 3.5 }), input))).not.toBeNull();
    expect(reasonOf(checkWeekAnswer(week(runs, { min: 25, km: 3.6 }), input))).toContain("This week's running is 11.1 km; the most allowed is 11 km (last week 10, plus 1 km).");
  });

  it('week 1 has no running-total check', () => {
    expect(valueOf(checkWeekAnswer(week({ 1: { min: 30 }, 2: { min: 30 }, 3: { min: 30 }, 5: { min: 30 } }, { min: 30 }), WEEK1))).not.toBeNull();
  });

  it('PSL-16: a known base of 0 runs is held like week 1: no running total, every run at most the cap', () => {
    const input = { ...WEEK5, baseWeek: minutesBase(0, 0) };
    // 3 runs of 25 minutes (75 in all) pass: no running-total check.
    expect(valueOf(checkWeekAnswer(week({ 1: { min: 25 }, 2: { min: 25 } }, { min: 25 }), input))).not.toBeNull();
    // One run of 35 is refused by the cap, though it is under 50% of the week.
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 35 }, 2: { min: 25 } }, { min: 25 }), input))).toContain(
      'Day 1 step "Run 1": the run is 35 minutes; the most allowed is 30 minutes (last week had no running).'
    );
    // In km: 5 km.
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 30, km: 5.5 }, 2: { min: 25, km: 4 } }, { min: 25, km: 4 }), input))).toContain('the run is 5.5 km; the most allowed is 5');
    // The 50% rule still holds with 3 or more runs.
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 5 }, 2: { min: 5 } }, { min: 25 }), input))).toContain("(50% of this week's 35 minutes of running)");
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 5 }, 2: { min: 5 } }, { min: 25 }), input))).not.toContain('running is');
  });
});

describe("Mo's tests (PSL-15)", () => {
  it('(b) a base week in km and this week in minutes are compared in minutes: one passes, one is refused', () => {
    const input = { ...WEEK5, baseWeek: { known: true, unit: 'km', total: 10, totalMinutes: 60, runs: 3 } as BaseWeek };
    expect(valueOf(checkWeekAnswer(week({ 1: { min: 15 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 25 }), input))).not.toBeNull();
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 15 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 30 }), input))).toContain(
      "This week's running is 75 minutes; the most allowed is 70 minutes (last week 60, plus 10 minutes)."
    );
  });

  it('(b) the reverse: a base week in minutes and this week in km, compared in minutes', () => {
    const input = { ...WEEK5, baseWeek: minutesBase(60) };
    const runs = { 1: { min: 15, km: 2.5, minutesToo: true }, 2: { min: 15, km: 2.5, minutesToo: true }, 3: { min: 15, km: 2.5, minutesToo: true } };
    expect(valueOf(checkWeekAnswer(week(runs, { min: 25, km: 4, minutesToo: true }), input))).not.toBeNull();
    expect(reasonOf(checkWeekAnswer(week(runs, { min: 30, km: 4, minutesToo: true }), input))).toContain("This week's running is 75 minutes; the most allowed is 70");
  });
});

describe('AC-5: the longest run (PSL-15 (7))', () => {
  for (const [label, input] of [
    ['week 1', WEEK1],
    ['a later week', { ...WEEK5, baseWeek: BIG }],
  ] as const) {
    it(`${label}: with 3 or more runs, at most 50% of the week`, () => {
      expect(valueOf(checkWeekAnswer(week({ 1: { min: 10 }, 2: { min: 10 }, 3: { min: 30 } }, { min: 10 }), input))).not.toBeNull();
      expect(reasonOf(checkWeekAnswer(week({ 1: { min: 10 }, 2: { min: 10 }, 3: { min: 31 } }, { min: 10 }), input))).toContain(
        `SAFETY: Day 3 step "Run 3": the run is 31 minutes; the most allowed is 30 minutes (50% of this week's 61 minutes of running).`
      );
    });
  }

  it('no base and fewer than 3 runs: the fixed cap of 30 minutes', () => {
    expect(valueOf(checkWeekAnswer(week({ 1: { min: 30 } }, { min: 10 }), WEEK1))).not.toBeNull();
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 31 } }, { min: 10 }), WEEK1))).toContain(
      'Day 1 step "Run 1": the run is 31 minutes; the most allowed is 30 minutes (with no last week to build from and fewer than 3 runs).'
    );
  });

  it('no base and fewer than 3 runs, counted in km: the cap of 5 km', () => {
    expect(valueOf(checkWeekAnswer(week({ 1: { min: 30, km: 5 } }, { min: 10, km: 1.5 }), WEEK1))).not.toBeNull();
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 30, km: 5.1 } }, { min: 10, km: 1.5 }), WEEK1))).toContain('the run is 5.1 km; the most allowed is 5');
  });

  it('an unknown base is no base: the cap holds', () => {
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 31 } }, { min: 10 }), { ...WEEK5, baseWeek: { known: false, runWithoutLoad: true } }))).toContain('the most allowed is 30');
  });

  it('a 3-run week is held to 50% instead of the cap', () => {
    // Above the 30-minute cap, but a third of the week: passes.
    expect(valueOf(checkWeekAnswer(week({ 1: { min: 32 }, 2: { min: 32 } }, { min: 30 }), WEEK1))).not.toBeNull();
    // Under the cap, but 60% of the week: refused.
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 10 }, 2: { min: 10 } }, { min: 30 }), WEEK1))).toContain('(50% of this week');
  });

  it('a week with a base and 2 runs has no longest-run check', () => {
    expect(valueOf(checkWeekAnswer(week({ 1: { min: 35 } }, { min: 10 }), { ...WEEK5, baseWeek: minutesBase(60) }))).not.toBeNull();
  });
});

describe('AC-5: hard runs', () => {
  for (const [label, input] of [
    ['week 1', WEEK1],
    ['a later week', { ...WEEK5, baseWeek: BIG }],
  ] as const) {
    it(`${label}: 2 pass, 3 are refused`, () => {
      expect(valueOf(checkWeekAnswer(week({ 1: { min: 15, hard: true }, 3: { min: 15, hard: true }, 5: { min: 15 } }), input))).not.toBeNull();
      expect(reasonOf(checkWeekAnswer(week({ 1: { min: 15, hard: true }, 3: { min: 15, hard: true }, 5: { min: 15, hard: true } }), input))).toContain(
        'SAFETY: This week has 3 hard runs (intervals, tempo, race pace or a hard test); the most allowed is 2.'
      );
    });
  }

  it('a quality_session kept without a load on the last attempt is a hard run, counted by its minutes', () => {
    const runs = { 1: { min: 15, hard: true }, 3: { min: 15, hard: true }, 5: { min: 15, kind: 'quality_session', noLoad: true } };
    expect(reasonOf(checkWeekAnswer(week(runs), { ...WEEK5, baseWeek: BIG }, true))).toContain('This week has 3 hard runs');
  });
});

describe('AC-5: every step and 10-minute version', () => {
  const later = { ...WEEK5, baseWeek: BIG };
  for (const [label, input] of [
    ['week 1', WEEK1],
    ['a later week', later],
  ] as const) {
    it(`${label}: a deficit of 600 passes, 601 is refused, and a lower deficit is never refused`, () => {
      expect(valueOf(checkWeekAnswer(week({ 1: { min: 15 } }, { min: 10 }, withStepLoad(1, { kcalDeficit: 600 })), input))).not.toBeNull();
      expect(valueOf(checkWeekAnswer(week({ 1: { min: 15 } }, { min: 10 }, withStepLoad(1, { kcalDeficit: 100 })), input))).not.toBeNull();
      expect(reasonOf(checkWeekAnswer(week({ 1: { min: 15 } }, { min: 10 }, withStepLoad(1, { kcalDeficit: 601 })), input))).toContain(
        'SAFETY: Day 1 step "Calf and hip circuit 1": kcalDeficit is 601; the most allowed is 600 kcal a day.'
      );
    });

    it(`${label}: an intake of 1200 passes, 1199 is refused`, () => {
      expect(valueOf(checkWeekAnswer(week({ 1: { min: 15 } }, { min: 10 }, withStepLoad(1, { kcalIntake: 1200 })), input))).not.toBeNull();
      expect(reasonOf(checkWeekAnswer(week({ 1: { min: 15 } }, { min: 10 }, withStepLoad(1, { kcalIntake: 1199 })), input))).toContain(
        'kcalIntake is 1199; the least allowed is 1200 kcal a day.'
      );
    });

    it(`${label}: the 10-minute version gets the same checks`, () => {
      const change = (days: Array<Record<string, any>>) => {
        days[0].minimumVersion = minimum(1, { runMinutes: 10, hardRun: false, kcalDeficit: 700 });
      };
      expect(reasonOf(checkWeekAnswer(week({ 1: { min: 15 } }, { min: 10 }, change), input))).toContain('SAFETY: Day 1 10-minute version "Short easy run 1": kcalDeficit is 700');
    });
  }

  const lift: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
    ['% of 1RM', { percent1RM: 80 }, { percent1RM: 81 }],
    ['reps in reserve', { rir: 3 }, { rir: 2 }],
    ['to failure', { toFailure: false }, { toFailure: true }],
    ['max test', { maxTest: false }, { maxTest: true }],
  ];
  for (const [label, atLimit, past] of lift) {
    it(`weeks 1 to 3, ${label}: at the limit passes, past it is refused; week 4 is not checked`, () => {
      const atWeek = (weekNumber: number) => ({ ...later, weekNumber });
      expect(valueOf(checkWeekAnswer(week({ 1: { min: 15 } }, { min: 10 }, withStepLoad(1, atLimit)), WEEK1))).not.toBeNull();
      expect(reasonOf(checkWeekAnswer(week({ 1: { min: 15 } }, { min: 10 }, withStepLoad(1, past)), WEEK1))).toContain('in weeks 1 to 3');
      expect(reasonOf(checkWeekAnswer(week({ 1: { min: 15 } }, { min: 10 }, withStepLoad(1, past)), atWeek(3)))).toContain('in weeks 1 to 3');
      expect(valueOf(checkWeekAnswer(week({ 1: { min: 15 } }, { min: 10 }, withStepLoad(1, past)), atWeek(4)))).not.toBeNull();
    });
  }
});

describe('how a week is counted', () => {
  it('mixed units in one week are counted in minutes, using runMinutes where given and the minutes where not', () => {
    const running = weekRunning([
      { name: 'a', minutes: 30, km: 5, hard: false, noLoad: false },
      { name: 'b', minutes: 20, hard: false, noLoad: false },
    ]);
    expect(running).toMatchObject({ unit: 'minutes', total: 50, totalMinutes: 50 });
    expect(runOf({ durationMinutes: 25, load: { runKm: 4, hardRun: false } }, 'x', { running: true, testStep: false, codeMade: null })).toMatchObject({ minutes: 25, km: 4 });
  });

  it('a runMinutes above the step is counted as written, and logged once on the accepted answer only', () => {
    const over = week({ 1: { min: 15 } }, { min: 10 }, (days) => {
      days[0].steps[0].load = { runMinutes: 40, hardRun: false };
    });
    // Counted as written: 40 + 10 is over a base of 30 plus 10.
    expect(reasonOf(checkWeekAnswer(over, { ...WEEK5, baseWeek: minutesBase(30) }))).toContain("This week's running is 50 minutes");
    expect(safetyLines().filter((line) => line.rule === 'run_minutes_over_step')).toEqual([]);
    expect(valueOf(checkWeekAnswer(over, { ...WEEK5, baseWeek: BIG, goalId: 'g1' }))).not.toBeNull();
    expect(safetyLines().filter((line) => line.rule === 'run_minutes_over_step')).toEqual([
      { goalId: 'g1', week: 5, attempt: 1, rule: 'run_minutes_over_step', step: 'Day 1 step "Run 1"', matched: 'runMinutes 40 in a 15-minute step', value: 40, limit: 15, outcome: 'counted' },
    ]);
  });

  it('a rest-day run counts in the running total', () => {
    const restRun = week({ 1: { min: 15 } }, { min: 10 }, (days) => {
      days[3].steps = [step('Easy shakeout jog', 1, 15, { highLoad: true, load: { runMinutes: 15, hardRun: false } })];
    });
    expect(reasonOf(checkWeekAnswer(restRun, { ...WEEK5, baseWeek: minutesBase(20) }))).toContain("This week's running is 40 minutes");
  });

  it('the light step and the code-made test step are read from their fixed text', () => {
    expect(codeMadeTestStep({ title: LIGHT_TEST_STEP.title, focusCue: '', pitfallToAvoid: '' })).toBe('light');
    expect(codeMadeTestStep({ title: 'Weekly test: Run 5 km', focusCue: 'Your honest best, done exactly as written.', pitfallToAvoid: 'Changing the test to make it easier.' })).toBe('measured');
    expect(codeMadeTestStep({ title: 'Weekly test: Run 5 km', focusCue: 'Relaxed', pitfallToAvoid: 'Too fast' })).toBeNull();
  });
});

/** One stored day of the base week. */
function task(id: string, date: string, steps: Array<Partial<DetailedStep> & Record<string, unknown>>, extra: Partial<BaseTask> = {}): BaseTask {
  return {
    id,
    date,
    status: 'completed',
    isTestDay: false,
    notOffered: false,
    usedMinimumVersion: false,
    steps: steps.map((item, index) => ({ stepNumber: index + 1, title: `Step ${index + 1}`, durationMinutes: 0, instructions: '', focusCue: '', pitfallToAvoid: '', passMark: '', output: '', priority: index + 1, ...item })) as never,
    minimumVersion: null,
    ...extra,
  };
}
const runStep = (title: string, minutes: number, extra: Record<string, unknown> = {}) => ({ title, durationMinutes: minutes, kind: 'easy_session', load: { runMinutes: minutes, hardRun: false }, ...extra });
const base = (tasks: BaseTask[]) => baseWeekOf(tasks, true, codeMadeTestStep);

describe('the base week (B-64, PSL-11 Q8, PSL-15 (1))', () => {
  const four = (status: (index: number) => string) =>
    [1, 2, 3, 4].map((n) => task(`t${n}`, `2026-09-2${n}`, [runStep(`Run ${n}`, 25)], { status: status(n) }));

  it('is planned when 70% or more was done', () => {
    expect(base(four((n) => (n <= 3 ? 'completed' : 'missed')))).toEqual({ known: true, unit: 'minutes', total: 100, totalMinutes: 100, runs: 4 });
  });

  it('is what was done when under 70% of planned was done', () => {
    expect(base(four((n) => (n <= 2 ? 'completed' : 'missed')))).toEqual({ known: true, unit: 'minutes', total: 50, totalMinutes: 50, runs: 2 });
  });

  it("a day done through its 10-minute version counts that version's load", () => {
    const tasks = four((n) => (n <= 2 ? 'completed' : 'missed'));
    tasks[1] = { ...tasks[1], usedMinimumVersion: true, minimumVersion: { ...tasks[1].steps[0], title: 'Short run', durationMinutes: 10, load: { runMinutes: 8, hardRun: false } } };
    expect(base(tasks)).toMatchObject({ known: true, total: 33 });
  });

  it('a code-made 10-minute version done instead of a run counts its minutes', () => {
    const tasks = four((n) => (n <= 2 ? 'completed' : 'missed'));
    tasks[1] = { ...tasks[1], usedMinimumVersion: true, minimumVersion: { ...tasks[1].steps[0], title: 'Short version: Run 2', durationMinutes: 10, load: undefined } };
    expect(base(tasks)).toMatchObject({ known: true, total: 35 });
  });

  it('a carried copy counts once, planned and done', () => {
    const tasks = four(() => 'completed');
    tasks[0] = { ...tasks[0], status: 'missed' };
    tasks[2] = { ...tasks[2], steps: [...tasks[2].steps, { ...tasks[0].steps[0], stepNumber: 2, carriedFrom: { taskId: 't1', date: '2026-09-21' } } as never] };
    // Planned: 4 runs, not 5. Done: runs 2, 3, 4 and the copy of run 1 = 100.
    expect(base(tasks)).toEqual({ known: true, unit: 'minutes', total: 100, totalMinutes: 100, runs: 4 });
  });

  it('a done day that still holds a step carried from it is counted once', () => {
    const tasks = four(() => 'completed');
    tasks[2] = { ...tasks[2], steps: [...tasks[2].steps, { ...tasks[0].steps[0], stepNumber: 2, shiftedFrom: { taskId: 't1', date: '2026-09-21', replaced: [] } } as never] };
    expect(base(tasks)).toMatchObject({ total: 100, runs: 4 });
  });

  it('not-offered days are left out', () => {
    const tasks = four(() => 'completed');
    tasks[3] = { ...tasks[3], notOffered: true, status: 'pending' };
    expect(base(tasks)).toMatchObject({ known: true, total: 75, runs: 3 });
  });

  it('a rest-day run is counted, and a conditioning walk is not', () => {
    const tasks = four(() => 'completed');
    tasks.push(task('rest', '2026-09-26', [{ title: 'Shakeout jog', durationMinutes: 15, load: { runMinutes: 15, hardRun: false } }]));
    tasks.push(task('walk', '2026-09-27', [{ title: 'Brisk walk', durationMinutes: 30, kind: 'conditioning', load: { runMinutes: 0, hardRun: false, kcalDeficit: 300 } }]));
    expect(base(tasks)).toMatchObject({ known: true, total: 115, runs: 5 });
  });

  it('the code-made test step counts its minutes', () => {
    const tasks = four(() => 'completed');
    tasks.push(
      task('test', '2026-09-26', [{ title: 'Weekly test: Run 5 km', durationMinutes: 20, focusCue: 'Your honest best, done exactly as written.', pitfallToAvoid: 'Changing the test to make it easier.' }], { isTestDay: true })
    );
    expect(base(tasks)).toMatchObject({ known: true, total: 120, runs: 5 });
  });

  it("a run without a load (the model's test step kept on the last attempt) makes the base unknown, never 0", () => {
    const tasks = four(() => 'completed');
    tasks.push(task('test', '2026-09-26', [{ title: 'Weekly test: Run 5 km', durationMinutes: 20 }], { isTestDay: true }));
    expect(base(tasks)).toEqual({ known: false, runWithoutLoad: true });
    expect(base([...four(() => 'completed'), task('x', '2026-09-26', [{ title: 'Long run', durationMinutes: 40, kind: 'long_session' }])])).toEqual({ known: false, runWithoutLoad: true });
  });

  it('a week written before M2.1 (no load on any step) is unknown', () => {
    // No kind and no load: nothing reads as a run.
    expect(base([task('a', '2026-09-21', [{ title: 'Easy jog', durationMinutes: 30 }])])).toEqual({ known: false, runWithoutLoad: false });
    expect(base([task('a', '2026-09-21', [{ title: 'Easy jog', durationMinutes: 30, kind: 'easy_session' }])])).toEqual({ known: false, runWithoutLoad: true });
    expect(base([])).toEqual({ known: false, runWithoutLoad: false });
  });

  it('a known week that ran 0 is a real 0', () => {
    expect(base(four(() => 'missed'))).toEqual({ known: true, unit: 'minutes', total: 0, totalMinutes: 0, runs: 0 });
  });

  it('in km only when every run gives km', () => {
    const km = [1, 2, 3].map((n) => task(`k${n}`, `2026-09-2${n}`, [runStep(`Run ${n}`, 20, { load: { runKm: 3, hardRun: false } })]));
    expect(base(km)).toEqual({ known: true, unit: 'km', total: 9, totalMinutes: 60, runs: 3 });
    expect(base([...km, task('m', '2026-09-25', [runStep('Run 4', 15)])])).toEqual({ known: true, unit: 'minutes', total: 75, totalMinutes: 75, runs: 4 });
  });
});

describe('the exceptions', () => {
  it('three hard runs fail the week, on the last attempt too (no light step to swap in)', () => {
    const hard = { 1: { min: 15, hard: true }, 2: { min: 15, hard: true }, 3: { min: 15, hard: true } };
    expect(reasonOf(checkWeekAnswer(week(hard), WEEK1, true))).toContain('This week has 3 hard runs');
  });

  it("B-63's text scan runs exactly as before next to the load checks", () => {
    const answer = week({ 1: { min: 15 } }, { min: 10 }, (days) => {
      days[0].steps[1].instructions = 'Squat: last set to failure.';
    });
    expect(reasonOf(checkWeekAnswer(answer, WEEK1))).toMatch(/SAFETY: Day 1 step "Calf and hip circuit 1" says ".*failure.*"/);
  });
});

describe('AC-6: a second breach returns no week', () => {
  it('generateWeekPlan retries once, then gives null (both callers answer their 503 and save nothing)', async () => {
    const breaching = week({ 1: { min: 15, hard: true }, 2: { min: 15, hard: true }, 3: { min: 15, hard: true } });
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: breaching } as never);
    expect(await generateWeekPlan({ ...WEEK5, baseWeek: BIG, goalId: 'g1' })).toBeNull();
    expect(generateStructuredContent).toHaveBeenCalledTimes(2);
    expect(safetyLines().map((line) => [line.rule, line.outcome])).toEqual([
      ['hard_runs_over_2', 'retry'],
      ['hard_runs_over_2', 'failed'],
    ]);
  });

  it('a retry that comes back within the limits is saved', async () => {
    vi.mocked(generateStructuredContent)
      .mockResolvedValueOnce({ success: true, data: week({ 1: { min: 31 } }) } as never)
      .mockResolvedValueOnce({ success: true, data: week({ 1: { min: 30 } }) } as never);
    expect(await generateWeekPlan(WEEK1)).not.toBeNull();
    const prompts = vi.mocked(generateStructuredContent).mock.calls.map((call) => JSON.stringify(call));
    expect(prompts[1]).toContain('the run is 31 minutes; the most allowed is 30');
  });
});

describe('writeNextWeek (B-64)', () => {
  const target = WEEK1.target;
  const test = WEEK5.test;
  const goal = (rawGoal: string, clarifiedOutcome: string, weekTarget: unknown = target) =>
    ({
      id: 'g1',
      rawGoal,
      clarifiedOutcome,
      startDate: new Date('2026-09-21T00:00:00Z'),
      routine: JSON.stringify({ dailyMinutes: 40, planVariant: 'steady' }),
      roadmap: { finalGoal: clarifiedOutcome, finalTest: '', startingPoint: {}, method: WEEK1.method, phases: [WEEK1.phase], answers: [] },
      roadmapWeeks: [
        { weekNumber: 1, phase: 'Base', theme: 'Easy runs', target: weekTarget, test, status: 'completed' },
        { weekNumber: 2, phase: 'Base', theme: 'Longer runs', target: weekTarget, test, status: 'active' },
      ],
    }) as never;
  const RUN = ['Run 10 km in under 55 minutes', 'Finish a 10 km race in under 55:00'] as const;
  const row = (n: number, steps: unknown[], extra: Record<string, unknown> = {}) =>
    ({
      id: `t${n}`,
      date: `2026-09-2${n}`,
      dayOfWeek: 'Monday',
      title: `Day ${n}`,
      status: 'completed',
      isRestDay: false,
      isTestDay: false,
      isKeySession: false,
      notOffered: false,
      usedMinimumVersion: false,
      notes: null,
      detailedSteps: JSON.stringify(steps),
      minimumVersion: null,
      ...extra,
    }) as never;

  it("(a) a base week whose runs have no load, then a normal week: written, no running-total refusal, no_base logged with the goal id", async () => {
    const finished = [1, 2, 3].map((n) => row(n, [{ stepNumber: 1, title: `Easy run ${n}`, durationMinutes: 10, kind: 'easy_session', priority: 1 }]));
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: week({ 1: { min: 30 }, 2: { min: 30 }, 3: { min: 30 } }, { min: 10 }) } as never);
    const days = await writeNextWeek(goal(...RUN), 1, finished, '07:30', PATHWAY_PROFILES.run10k);
    expect(days).not.toBeNull();
    expect(safetyLines()).toEqual([{ goalId: 'g1', week: 2, rule: 'no_base', step: 'This week', matched: 'last week running not known', outcome: 'logged' }]);
  });

  it('a known base week holds the next week, and the goal id reaches the [Safety] line', async () => {
    const finished = [1, 2, 3].map((n) => row(n, [{ stepNumber: 1, title: `Easy run ${n}`, durationMinutes: 20, kind: 'easy_session', priority: 1, load: { runMinutes: 20, hardRun: false } }]));
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: week({ 1: { min: 30 }, 2: { min: 30 }, 3: { min: 30 } }, { min: 10 }) } as never);
    expect(await writeNextWeek(goal(...RUN), 1, finished, '07:30', PATHWAY_PROFILES.run10k)).toBeNull();
    const lines = safetyLines();
    expect(lines.map((line) => [line.goalId, line.rule, line.outcome])).toEqual([
      ['g1', 'running_total_over_limit', 'retry'],
      ['g1', 'running_total_over_limit', 'failed'],
    ]);
    expect(lines[0]).toMatchObject({ value: 100, limit: 70 });
    // The writer is told the number.
    expect(JSON.stringify(vi.mocked(generateStructuredContent).mock.calls[0])).toContain('at most 70 minutes this week in all (last week 60 minutes)');
  });

  it('a goal that is not a load goal gets no base week and no load key', async () => {
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: false, error: 'stop' } as never);
    await writeNextWeek(goal('Type 40 words per minute', 'Type 40 wpm at 95% accuracy', { kind: 'number', metric: 'Typing speed', value: 40, unit: 'wpm', direction: 'higher_is_better' }), 1, [], '07:30', null).catch(() => null);
    const prompt = JSON.stringify(vi.mocked(generateStructuredContent).mock.calls[0]);
    expect(prompt).not.toContain('SAFETY LIMITS');
    expect(prompt).not.toContain('"load"');
    expect(safetyLines()).toEqual([]);
  });
});

describe('the prompt (PSL-11 Q17)', () => {
  const layout = weekLayout('steady', WEEK1.weekStart);

  it('names the most allowed and last week, in the unit compared', () => {
    expect(runningLines(minutesBase(60))[0]).toBe('- Running: at most 70 minutes this week in all (last week 60 minutes). Add up the runMinutes of every run before you answer; the total must be at most 70 minutes.');
    expect(runningLines({ known: true, unit: 'km', total: 12, totalMinutes: 75, runs: 3 })[0]).toBe(
      '- Running: at most 13.2 km this week in all when every run is given in km, otherwise at most 85 minutes (last week 12 km, 75 minutes). Add up the runKm of every run before you answer; the total must be at most 13.2 km (or the runMinutes, at most 85 minutes, when any run is not given in km).'
    );
    expect(runningLines(minutesBase(0, 0))).toEqual([
      '- Running: last week had no running; keep it at their level.',
      "- Longest run: at most 50% of the week's running when there are 3 or more runs.",
      '- No run longer than 30 minutes (5 km when every run is given in km).',
    ]);
    expect(runningLines({ known: false, runWithoutLoad: true })).toEqual(runningLines(undefined));
    expect(runningLines(undefined).join('\n')).toContain('no run longer than 30 minutes (5 km when every run is given in km)');
  });

  it('a later week tells the base, the longest-run rule, the hard-run limit and the intake floor', () => {
    const prompt = buildWeekPrompt({ ...WEEK5, baseWeek: minutesBase(60) }, layout);
    const block = prompt.slice(prompt.indexOf('SAFETY LIMITS'), prompt.indexOf('\n\nKINDS OF STEP') + 2);
    expect(block).toBe(
      [
        'SAFETY LIMITS (these override the method and the target; a week whose steps break any of them is not saved)',
        '- Running: at most 70 minutes this week in all (last week 60 minutes). Add up the runMinutes of every run before you answer; the total must be at most 70 minutes.',
        "- Longest run: at most 50% of the week's running when there are 3 or more runs.",
        '- At most 2 hard runs this week (intervals, tempo, race pace).',
        '- Calorie deficit: 250 to 600 kcal a day, never more.',
        '- Daily intake: never below 1200 kcal a day.',
        '',
        '',
      ].join('\n')
    );
  });

  it('is told on a custom physical goal (a load goal that is not a high-load preset)', () => {
    const custom = { ...WEEK1, highLoadGoal: false, recovery: null };
    expect(buildWeekPrompt(custom, layout)).toContain('SAFETY LIMITS (these override the method and the target; a week whose steps break any of them is not saved)');
  });
});

describe('a goal that is not a load goal is exactly as before', () => {
  const typing: WeekCallInput = { ...RUN10K_WEEK1, finalGoal: 'Type 40 wpm', highLoadGoal: false, recovery: null, loadGoal: undefined, test: { type: 'score', instructions: 'Take a typing test.', passIf: '40 wpm' } };

  it('schema and prompt', () => {
    expect(weekResponseSchema(null, undefined)).toBe(WEEK_RESPONSE_SCHEMA);
    expect(buildWeekPrompt(typing, weekLayout('steady', typing.weekStart))).not.toContain('SAFETY LIMITS');
  });

  it('result: load numbers the model sends are neither read nor checked', () => {
    const answer = week({ 1: { min: 35 }, 2: { min: 35 }, 3: { min: 35 } }, { min: 10, hard: true }, (days) => {
      days[0].steps[1].load = { kcalDeficit: 900 };
    });
    const days = valueOf(checkWeekAnswer(answer, { ...typing, baseWeek: minutesBase(0, 0) })) as WeekDayPlan[];
    expect(days).not.toBeNull();
    expect(days.flatMap((day) => day.detailedSteps).some((item) => 'load' in item)).toBe(false);
    expect(safetyLines()).toEqual([]);
  });

  it('weekBreaches is pure: no base, no running-total check', () => {
    expect(weekBreaches(weekRunning([]), undefined)).toEqual([]);
  });
});

describe('M2.2a review fixes', () => {
  describe('fix 5: no_base only where running is expected', () => {
    const recomp: WeekCallInput = { ...WEEK1, loadGoal: { running: false }, goalId: 'g1' };
    const noBaseLines = () => safetyLines().filter((line) => line.rule === 'no_base');
    const lift = (load?: Record<string, unknown>) => [task('a', '2026-09-21', [{ title: 'Squat workout A', durationMinutes: 40, kind: 'strength_workout', ...(load ? { load } : {}) }])];
    const call = async (input: WeekCallInput) => {
      vi.mocked(generateStructuredContent).mockResolvedValue({ success: false, error: 'stop' } as never);
      await generateWeekPlan(input);
    };

    it('a lift-only recomp week gives no line: with loads it is a known 0, and written before M2.1 it has no run without a load', async () => {
      const withLoads = baseWeekOf(lift({ rir: 3 }), false, codeMadeTestStep);
      expect(withLoads).toMatchObject({ known: true, runs: 0 });
      const older = baseWeekOf(lift(), false, codeMadeTestStep);
      expect(older).toEqual({ known: false, runWithoutLoad: false });
      await call({ ...recomp, weekNumber: 2, baseWeek: withLoads });
      await call({ ...recomp, weekNumber: 2, baseWeek: older });
      expect(noBaseLines()).toEqual([]);
    });

    it('logged on a goal that is not a running goal when a run step of the base week had no load', async () => {
      const base = baseWeekOf([task('a', '2026-09-21', [{ title: 'Easy run', durationMinutes: 20, kind: 'easy_session' }, { title: 'Squat', durationMinutes: 20, kind: 'strength_workout', load: { rir: 3 } }])], false, codeMadeTestStep);
      expect(base).toEqual({ known: false, runWithoutLoad: true });
      await call({ ...recomp, weekNumber: 2, baseWeek: base });
      expect(noBaseLines()).toHaveLength(1);
    });

    it('always logged on a running goal', async () => {
      await call({ ...WEEK5, goalId: 'g1', baseWeek: { known: false, runWithoutLoad: false } });
      expect(noBaseLines()).toHaveLength(1);
    });
  });

  describe('fix 3: the handoff never places a step that names running', () => {
    const profile = PATHWAY_PROFILES.body_recomposition_90day;
    const stepOf = (title: string, kind: string, priority: number, minutes: number, load?: Record<string, unknown>): DetailedStep => ({
      stepNumber: priority,
      title,
      durationMinutes: minutes,
      instructions: `${title}, as written.`,
      focusCue: 'Brace',
      pitfallToAvoid: 'Rushing',
      passMark: 'Done',
      output: 'Logged',
      priority,
      kind,
      ...(load ? { load } : {}),
    });
    /** A strength week: Monday and Friday workouts with a catch-all finisher, Wednesday a mobility day. */
    const newWeek = () =>
      ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map((date, index) => {
        const workout = index === 0 || index === 4;
        const rest = index === 3 || index === 6;
        const steps = rest
          ? []
          : workout
            ? [stepOf(`Workout ${index === 0 ? 'A2' : 'B2'}`, 'strength_workout', 1, 30, { rir: 3 }), stepOf(`Finisher ${index}`, 'catch_all', 2, 10)]
            : [stepOf(`Mobility ${index}`, 'mobility', 1, 20), stepOf(`Core ${index}`, 'catch_all', 2, 20)];
        return { date, isRestDay: rest, isTestDay: index === 5, durationMinutes: rest ? 0 : 40, detailedSteps: steps };
      });
    const handoff = (carried: DetailedStep | null, noRoom: DetailedStep | null) => ({
      carried: carried ? [{ kind: 'strength_workout', name: 'Strength workout', steps: [{ taskId: 'last1', date: '2026-09-21', title: carried.title, step: carried }] }] : [],
      letGo: [],
      unfinished: [],
      noRoom: noRoom ? [{ taskId: 'last2', date: '2026-09-23', title: noRoom.title, step: noRoom, kind: 'catch_all', dayOfWeek: 'Wednesday', hard: false }] : [],
    });
    const place = (carried: DetailedStep | null, noRoom: DetailedStep | null) =>
      placeHandoff({ days: newWeek(), handoff: handoff(carried, noRoom), profile, lastWeek: [] });

    it('an in-order step with a run load waits; no session gives its step up for it', () => {
      const result = place(stepOf('Workout A1', 'strength_workout', 1, 30, { rir: 3, runMinutes: 10, hardRun: false }), null);
      expect(result.placed).toEqual([]);
      expect(result.gaveUp).toEqual([]);
      expect(result.waiting).toEqual([{ kind: 'strength_workout', title: 'Workout A1', why: 'sessions_full' }]);
      expect(result.days[0].detailedSteps[0].title).toBe('Workout A2');
      // Without running it is placed, as before.
      expect(place(stepOf('Workout A1', 'strength_workout', 1, 30, { rir: 3 }), null).placed).toHaveLength(1);
    });

    it('a no-room step with a run load is not placed', () => {
      // Both fit Monday's 10-minute finisher; only the load differs.
      expect(place(null, stepOf('Easy jog finisher', 'catch_all', 2, 10, { runMinutes: 10, hardRun: false })).noRoomPlaced).toEqual([]);
      expect(place(null, stepOf('Band pull-aparts', 'catch_all', 2, 10, { kcalDeficit: 300 })).noRoomPlaced).toHaveLength(1);
    });
  });
});

describe('M2.2a follow-up: safety reasons are told with a day-level reason', () => {
  const input = { ...WEEK5, baseWeek: minutesBase(60), goalId: 'g1' };
  /** 75 minutes of running against a limit of 70, and day 1 has only its run (one step). */
  const answer = () =>
    week({ 1: { min: 15 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 30 }, (days) => {
      days[0].steps = [days[0].steps[0]];
    });
  const DAY_REASON = 'Day 1 is a practice day and needs 2 to 4 steps; got 1.';
  const RUNNING = "SAFETY: This week's running is 75 minutes; the most allowed is 70 minutes (last week 60, plus 10 minutes).";

  it('names both, the safety reason first, and logs each breach once as retry', () => {
    const reason = reasonOf(checkWeekAnswer(answer(), input));
    expect(reason).toContain(RUNNING);
    expect(reason).toContain(DAY_REASON);
    expect(reason.indexOf(RUNNING)).toBeLessThan(reason.indexOf(DAY_REASON));
    expect(safetyLines().map((line) => [line.goalId, line.rule, line.outcome])).toEqual([['g1', 'running_total_over_limit', 'retry']]);
  });

  it('a missing day: the days parsed are still checked', () => {
    const missing = week({ 1: { min: 15 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 30 }, (days) => {
      days.splice(4, 1);
    });
    // Day 5 is missing; days 1-3 and the test are 75 minutes.
    expect(reasonOf(checkWeekAnswer(missing, input))).toBe(`${RUNNING} Rewrite the week within the limit. Day 5 is missing. Return all 7 days.`);
  });

  it('the no-title exit tells the safety reasons', () => {
    const noTitle = week({ 1: { min: 15 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 30 }, (days) => {
      days[1].title = '';
    });
    const reason = reasonOf(checkWeekAnswer(noTitle, input));
    expect(reason).toMatch(/^SAFETY: This week's running is 75 minutes/);
    expect(reason).toContain('Day 2 has no title.');
  });

  it("a typing goal's reasons are unchanged: the day-level reason alone, nothing logged", () => {
    const typing: WeekCallInput = { ...input, loadGoal: undefined, baseWeek: undefined, highLoadGoal: false, recovery: null };
    expect(reasonOf(checkWeekAnswer(answer(), typing))).toBe(DAY_REASON);
    expect(safetyLines()).toEqual([]);
  });

  it('a stretched lone run keeps its runMinutes (code makes a step longer, never its running)', () => {
    // On the last attempt one step is allowed, and code fits it to the day's 40 minutes.
    const days = valueOf(checkWeekAnswer(answer(), { ...input, baseWeek: BIG }, true)) as WeekDayPlan[];
    expect(days[0].detailedSteps).toHaveLength(1);
    expect(days[0].detailedSteps[0]).toMatchObject({ durationMinutes: 40, load: { runMinutes: 15 } });
    // So the same answer still breaks a limit of 70 by its own 75 minutes, not 100.
    expect(reasonOf(checkWeekAnswer(answer(), input, true))).toContain(RUNNING);
  });
});

describe('M2.2a follow-up: the first answer when the last one breaks a limit', () => {
  const input = { ...WEEK5, baseWeek: minutesBase(150), goalId: 'g1' };
  /** Week 5: 145 minutes, within 165, but day 5 has only its run. */
  const safeFirst = () =>
    week({ 1: { min: 35 }, 2: { min: 35 }, 3: { min: 35 }, 5: { min: 30 } }, { min: 10 }, (days) => {
      days[4].steps = [days[4].steps[0]];
    });
  /** 170 minutes: over 165. */
  const overLast = () => week({ 1: { min: 35 }, 2: { min: 35 }, 3: { min: 35 }, 5: { min: 35 } }, { min: 30 });

  it('attempt 1 safe with a one-step day, attempt 2 over the limit: attempt 1 is the week, with one first_answer line', async () => {
    vi.mocked(generateStructuredContent)
      .mockResolvedValueOnce({ success: true, data: safeFirst() } as never)
      .mockResolvedValueOnce({ success: true, data: overLast() } as never);
    const days = await generateWeekPlan(input);
    expect(days).not.toBeNull();
    // Day 5 keeps its one run, stretched to the day, its running as written.
    expect(days![4].detailedSteps).toHaveLength(1);
    expect(days![4].detailedSteps[0]).toMatchObject({ title: 'Run 5', load: { runMinutes: 30 } });
    expect(safetyLines().map((line) => [line.rule, line.outcome])).toEqual([
      ['running_total_over_limit', 'failed'],
      ['running_total_over_limit', 'first_answer'],
    ]);
    expect(safetyLines()[1]).toMatchObject({ goalId: 'g1', week: 5, attempt: 2, step: 'This week' });
  });

  it('attempt 1 unsafe too: no week', async () => {
    const unsafeFirst = () =>
      week({ 1: { min: 35 }, 2: { min: 35 }, 3: { min: 35 }, 5: { min: 35 } }, { min: 30 }, (days) => {
        days[4].steps = [days[4].steps[0]];
      });
    vi.mocked(generateStructuredContent)
      .mockResolvedValueOnce({ success: true, data: unsafeFirst() } as never)
      .mockResolvedValueOnce({ success: true, data: overLast() } as never);
    expect(await generateWeekPlan(input)).toBeNull();
    // Attempt 1's breach once (retry), the last answer's once (failed); the dry run of attempt 1 logs nothing.
    expect(safetyLines().map((line) => [line.rule, line.outcome])).toEqual([
      ['running_total_over_limit', 'retry'],
      ['running_total_over_limit', 'failed'],
    ]);
  });

  it('no fallback when the last answer is refused for anything but safety', async () => {
    const missingDay = () =>
      week({ 1: { min: 35 }, 2: { min: 35 }, 3: { min: 35 }, 5: { min: 30 } }, { min: 10 }, (days) => {
        days.splice(4, 1);
      });
    vi.mocked(generateStructuredContent)
      .mockResolvedValueOnce({ success: true, data: safeFirst() } as never)
      .mockResolvedValueOnce({ success: true, data: missingDay() } as never);
    expect(await generateWeekPlan(input)).toBeNull();
    expect(safetyLines().filter((line) => line.outcome === 'first_answer')).toEqual([]);
  });
});

// M3.1 (PSL-19): with no last week, the longest-run cap is never below what they already run, from their starting point.
describe('the no-base cap follows their starting point (PSL-19)', () => {
  const minutesLevel: WeekCallInput = { ...WEEK1, loadGoal: { running: true, runLevel: { minutes: 50 } } };
  const kmLevel: WeekCallInput = { ...WEEK1, loadGoal: { running: true, runLevel: { km: 12 } } };

  it('a runner who already runs 50 minutes may run 50 in week 1, not more', () => {
    expect(valueOf(checkWeekAnswer(week({ 1: { min: 40 } }, { min: 10 }), WEEK1))).toBeNull();
    expect(valueOf(checkWeekAnswer(week({ 1: { min: 40 } }, { min: 10 }), minutesLevel))).not.toBeNull();
    expect(valueOf(checkWeekAnswer(week({ 1: { min: 40 } }, { min: 10 }, (days) => (days[0].steps[0].minutes = 50, days[0].steps[0].load.runMinutes = 50, days[0].steps[1].minutes = 0)), minutesLevel))).not.toBeNull();
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 40 } }, { min: 10 }, (days) => (days[0].steps[0].load.runMinutes = 51)), minutesLevel))).toContain(
      'the run is 51 minutes; the most allowed is 50 minutes (what they already run, from their starting point, with no last week to build from).'
    );
  });

  it('counted in km, the km level raises the 5 km cap; a level in the other unit changes nothing', () => {
    expect(valueOf(checkWeekAnswer(week({ 1: { min: 35, km: 8 } }, { min: 10, km: 1.5 }), kmLevel))).not.toBeNull();
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 35, km: 12.5 } }, { min: 10, km: 1.5 }), kmLevel))).toContain('the most allowed is 12');
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 35, km: 8 } }, { min: 10, km: 1.5 }), minutesLevel))).toContain('the most allowed is 5');
  });

  it('a level below the fixed cap keeps the cap', () => {
    const low: WeekCallInput = { ...WEEK1, loadGoal: { running: true, runLevel: { minutes: 20 } } };
    expect(valueOf(checkWeekAnswer(week({ 1: { min: 30 } }, { min: 10 }), low))).not.toBeNull();
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 31 } }, { min: 10 }), low))).toContain('the most allowed is 30 minutes (with no last week to build from');
  });

  it('a week after a 0-run week, or a first week back with no known base, keeps the fixed cap', () => {
    const zero = { ...WEEK5, baseWeek: minutesBase(0, 0), loadGoal: { running: true, runLevel: { minutes: 50 } } };
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 31 } }, { min: 10 }), zero))).toContain('the most allowed is 30');
    const back = { ...WEEK5, baseWeek: { known: false as const, runWithoutLoad: false, firstWeekBack: { fromWeek: null, percent: 100 } }, loadGoal: { running: true, runLevel: { minutes: 50 } } };
    expect(reasonOf(checkWeekAnswer(week({ 1: { min: 31 } }, { min: 10 }), back))).toContain('the most allowed is 30');
  });

  it('the prompt names the raised cap', () => {
    expect(runningLines(undefined, { minutes: 50, km: 9 })).toContain('- With fewer than 3 runs, no run longer than 50 minutes (9 km when every run is given in km).');
    expect(runningLines(undefined)).toContain('- With fewer than 3 runs, no run longer than 30 minutes (5 km when every run is given in km).');
  });
});

// Edit my schedule (B-108): the week call's days come from the layout, so the chosen rest days are rest whatever the
// model writes on them, and the test is the last practice day.
describe('the week call follows the chosen rest days (B-108)', () => {
  it('days on the chosen weekdays are rest even when the model fills them', () => {
    const weekdayOfDay = (n: number) => new Date(WEEK1.weekStart.getTime() + (n - 1) * 86_400_000).getUTCDay();
    const restWeekdays = [weekdayOfDay(3), weekdayOfDay(7)].sort((a, b) => a - b);
    const fillDay4 = (days: Array<Record<string, any>>) => {
      days[3] = { ...days[0], dayNumber: 4, steps: days[0].steps.map((item: Record<string, unknown>) => ({ ...item, title: `${item.title} on day 4` })) };
    };
    const result = valueOf(checkWeekAnswer(week({ 1: { min: 15 }, 2: { min: 15 }, 3: { min: 15 }, 5: { min: 15 } }, { min: 10 }, fillDay4), { ...WEEK1, restWeekdays }));
    expect(result).not.toBeNull();
    expect(result!.filter((day) => day.isRestDay).map((day) => day.dayNumber)).toEqual([3, 7]);
    expect(result!.some((day) => day.isTestDay)).toBe(false);
    expect(result!.find((day) => day.dayNumber === 4)?.detailedSteps.length).toBeGreaterThan(0);
  });
});

