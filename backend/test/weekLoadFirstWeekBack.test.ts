import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));
vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import { checkWeekAnswer, codeMadeTestStep, runningLines, type RawWeekAnswer, type WeekCallInput } from '../src/lib/ai/weekPlan.js';
import { writeNextWeek } from '../src/lib/planV2.js';
import { firstWeekBackBaseOf, type BaseTask, type BaseWeek, type DoneWeek } from '../src/lib/safety/weekLoad.js';
import { PATHWAY_PROFILES } from '../src/lib/recovery/pathways.js';
import type { DetailedStep } from '../src/lib/ai/goalDecomposer.js';
import { RUN10K_WEEK1 } from './run10kWeekInput.js';

// Plan safety limits M2.2b (RULE-7, PSL-18, PSL-11 Q13, AC-7): a load goal's first week back is held to the newest week
// with done running, by what was done, with no allowance, half after a long break, never below 30 minutes / 5 km.

/** A later, measured week (not light), as in `weekLoadLimits.test.ts`. */
const WEEK5: WeekCallInput = {
  ...RUN10K_WEEK1,
  loadGoal: { running: true },
  weekNumber: 5,
  test: { type: 'timer', instructions: 'Run 5 km at a hard, steady effort and log your time.', passIf: 'Under 30 minutes' },
  testSession: undefined,
};
const back = (total: number, fromWeek = 3, percent = 100, runs = 3): BaseWeek => ({ known: true, unit: 'minutes', total, totalMinutes: total, runs, firstWeekBack: { fromWeek, percent } });

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
  noLoad?: boolean;
}
const loadOf = (run: RunSpec) =>
  run.noLoad ? {} : { load: { ...(run.km !== undefined ? { runKm: run.km } : { runMinutes: run.min }), hardRun: false } };
type Practice = 1 | 2 | 3 | 5;

/** As `weekLoadLimits.test.ts`'s `week`: days 1-3 and 5-6 practice (40 minutes each), 4 and 7 rest, day 6 the test. */
function week(runs: Partial<Record<Practice, RunSpec>>, test: RunSpec = { min: 10 }, testText?: string): RawWeekAnswer {
  const days = Array.from({ length: 7 }, (_, index) => {
    const dayNumber = index + 1;
    if (dayNumber === 4 || dayNumber === 7) return { dayNumber, isKeySession: false, title: 'Rest and recover', whyToday: 'Recovery.', steps: [] };
    const run = runs[dayNumber as Practice];
    const steps =
      dayNumber === 6
        ? [
            step('Jog gently before the test', 2, 5, { kind: 'weekly_test' }),
            step('Weekly test: long run at an easy pace', 1, test.min, { kind: 'weekly_test', highLoad: true, ...loadOf(test), ...(testText ? { instructions: testText } : {}) }),
            step('Note how the run felt', 3, 5, { kind: 'weekly_test' }),
          ]
        : run
          ? [
              step(`Run ${dayNumber}`, 1, run.min, { kind: 'easy_session', highLoad: true, ...loadOf(run) }),
              step(`Calf and hip circuit ${dayNumber}`, 2, 40 - run.min, { kind: 'strength_and_mobility' }),
            ]
          : [step(`Core circuit ${dayNumber}`, 1, 20, { kind: 'strength_and_mobility' }), step(`Hip circuit ${dayNumber}`, 2, 20, { kind: 'strength_and_mobility' })];
    const minimumVersion = { ...step(`Short easy run ${dayNumber}`, 1, 10), load: { runMinutes: 10, hardRun: false } };
    return { dayNumber, isKeySession: false, title: `Day ${dayNumber} session`, whyToday: 'Builds running.', steps, minimumVersion };
  });
  return { days } as RawWeekAnswer;
}

const reasonOf = (result: ReturnType<typeof checkWeekAnswer>) => ('reason' in result ? result.reason : '');
const passes = (answer: RawWeekAnswer, baseWeek: BaseWeek) => 'value' in checkWeekAnswer(answer, { ...WEEK5, baseWeek });
const refusal = (answer: RawWeekAnswer, baseWeek: BaseWeek) => reasonOf(checkWeekAnswer(answer, { ...WEEK5, baseWeek }));

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.mocked(generateStructuredContent).mockReset();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const safetyLines = () =>
  warn.mock.calls.filter((call: unknown[]) => call[0] === '[Safety]').map((call: unknown[]) => JSON.parse(call[1] as string) as Record<string, unknown>);

// ---------------------------------------------------------------------------------------------------------------
// The walk (PSL-18 (3), (5)).

const runStep = (title: string, minutes: number, load: DetailedStep['load'] | null = { runMinutes: minutes, hardRun: false }): DetailedStep => ({
  stepNumber: 1,
  title,
  durationMinutes: minutes,
  instructions: '',
  focusCue: '',
  pitfallToAvoid: '',
  priority: 1,
  kind: 'easy_session',
  ...(load ? { load } : {}),
});
const mobility: DetailedStep = { stepNumber: 2, title: 'Mobility', durationMinutes: 10, instructions: '', focusCue: '', pitfallToAvoid: '', priority: 2, kind: 'strength_and_mobility', load: {} };
const day = (n: number, steps: DetailedStep[], status = 'completed', extra: Partial<BaseTask> = {}): BaseTask => ({
  id: `t${n}`,
  date: `2026-09-${10 + n}`,
  status,
  isTestDay: false,
  notOffered: false,
  usedMinimumVersion: false,
  steps,
  minimumVersion: null,
  ...extra,
});
/** A week of `runs` (minutes each), the first `done` of them completed. */
const weekOf = (weekNumber: number, runs: number[], done = runs.length): DoneWeek => ({
  weekNumber,
  tasks: runs.map((minutes, index) => day(weekNumber * 10 + index, [runStep(`Run ${index}`, minutes), mobility], index < done ? 'completed' : 'pending')),
});
const walk = (weeks: DoneWeek[], percent = 100) => firstWeekBackBaseOf(weeks, true, codeMadeTestStep, percent);

describe('the walk (PSL-18 (3))', () => {
  it('the closing week with done running is the base', () => {
    expect(walk([weekOf(3, [20, 20, 20]), weekOf(2, [40, 40, 40])])).toEqual(back(60));
  });

  it('a closing week with no done running reads an older week', () => {
    expect(walk([weekOf(3, [30, 30, 30], 0), weekOf(2, [25, 25])])).toEqual({ ...back(50, 2), runs: 2 });
  });

  it('a jumped week (no rows) is passed over', () => {
    expect(walk([weekOf(5, [30, 30], 0), { weekNumber: 4, tasks: [] }, weekOf(3, [20, 20])])).toEqual({ ...back(40, 3), runs: 2 });
  });

  it('planned running and the 70% rule are ignored: done only', () => {
    // 150 of 200 planned was done (75%): the ordinary base would be the planned 200.
    expect(walk([weekOf(3, [50, 50, 50, 50], 3)])).toEqual(back(150));
    // 20 of 200: done, too.
    expect(walk([weekOf(3, [20, 60, 60, 60], 1)])).toEqual({ ...back(20), runs: 1 });
  });

  it('a done run with no running number stops the walk at unknown (an older week is not read)', () => {
    const unknown = { weekNumber: 3, tasks: [day(1, [runStep('Easy run', 30, null), mobility])] };
    expect(walk([weekOf(4, [30], 0), unknown, weekOf(2, [40, 40])])).toEqual({ known: false, runWithoutLoad: true, firstWeekBack: { fromWeek: 3, percent: 100 } });
  });

  it("a day done through its 10-minute version that gives no running number is unknown", () => {
    const viaMinimum = { weekNumber: 3, tasks: [day(1, [runStep('Easy run', 30), mobility], 'completed', { usedMinimumVersion: true })] };
    expect(walk([viaMinimum, weekOf(2, [40])])).toMatchObject({ known: false, firstWeekBack: { fromWeek: 3 } });
  });

  it('done days of a week written before M2.1 (no load on any step) are unknown', () => {
    const old = { weekNumber: 2, tasks: [day(1, [{ ...mobility, load: undefined }])] };
    expect(walk([weekOf(3, [30], 0), old])).toEqual({ known: false, runWithoutLoad: false, firstWeekBack: { fromWeek: 2, percent: 100 } });
  });

  it('no done running anywhere is a known base of 0 runs', () => {
    expect(walk([weekOf(3, [30, 30], 0), weekOf(2, [30], 0)], 50)).toEqual({ known: true, unit: 'minutes', total: 0, totalMinutes: 0, runs: 0, firstWeekBack: { fromWeek: null, percent: 50 } });
  });

  it('a week done in km is a km base', () => {
    const km = { weekNumber: 3, tasks: [day(1, [runStep('Run', 20, { runKm: 3, hardRun: false })]), day(2, [runStep('Run', 15, { runKm: 2, hardRun: false })])] };
    expect(walk([km])).toEqual({ known: true, unit: 'km', total: 5, totalMinutes: 35, runs: 2, firstWeekBack: { fromWeek: 3, percent: 100 } });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The limit (RULE-7, PSL-18 (1), (2), (5), (6)).

describe('the limit (RULE-7, PSL-18)', () => {
  it('AC-7: held to the last done total, with no allowance (the ordinary base would allow 70)', () => {
    expect(passes(week({ 1: { min: 15 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 15 }), back(60))).toBe(true);
    expect(refusal(week({ 1: { min: 15 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 16 }), back(60))).toContain(
      "SAFETY: This week's running is 61 minutes; the most allowed is 60 minutes (what they last did, week 3). Rewrite the week within the limit."
    );
    expect(refusal(week({ 1: { min: 15 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 30 }), back(60))).toContain(
      "This week's running is 75 minutes; the most allowed is 60 minutes (what they last did, week 3)."
    );
    // The same week passes against an ordinary base of 60.
    expect(passes(week({ 1: { min: 15 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 16 }), { known: true, unit: 'minutes', total: 60, totalMinutes: 60, runs: 3 })).toBe(true);
  });

  it('the floor: a last done total of 10 minutes allows 30', () => {
    const base = { ...back(10), runs: 1 };
    expect(passes(week({ 1: { min: 10 }, 2: { min: 10 } }, { min: 10 }), base)).toBe(true);
    expect(refusal(week({ 1: { min: 10 }, 2: { min: 10 } }, { min: 11 }), base)).toContain(
      "This week's running is 31 minutes; the most allowed is 30 minutes (what they last did, week 3, was 10; never below 30 minutes)."
    );
  });

  it('the floor in km is 5', () => {
    const base: BaseWeek = { known: true, unit: 'km', total: 2, totalMinutes: 12, runs: 1, firstWeekBack: { fromWeek: 3, percent: 100 } };
    const runs = { 1: { min: 15, km: 1.5 }, 2: { min: 15, km: 1.5 }, 3: { min: 15, km: 1.5 } };
    expect(passes(week(runs, { min: 10, km: 0.5 }), base)).toBe(true);
    expect(refusal(week(runs, { min: 10, km: 0.6 }), base)).toContain("This week's running is 5.1 km; the most allowed is 5 km (what they last did, week 3, was 2; never below 5 km).");
  });

  it('mixed units are compared in minutes: a km base and a week in minutes', () => {
    const base: BaseWeek = { known: true, unit: 'km', total: 8, totalMinutes: 50, runs: 2, firstWeekBack: { fromWeek: 3, percent: 100 } };
    expect(passes(week({ 1: { min: 15 }, 2: { min: 15 } }, { min: 20 }), base)).toBe(true);
    expect(refusal(week({ 1: { min: 15 }, 2: { min: 15 } }, { min: 21 }), base)).toContain("This week's running is 51 minutes; the most allowed is 50 minutes (what they last did, week 3).");
    // A tiny km base, compared in minutes, takes the floor in minutes.
    const tiny: BaseWeek = { known: true, unit: 'km', total: 2, totalMinutes: 12, runs: 1, firstWeekBack: { fromWeek: 3, percent: 100 } };
    expect(passes(week({ 1: { min: 10 }, 2: { min: 10 } }, { min: 10 }), tiny)).toBe(true);
    expect(refusal(week({ 1: { min: 10 }, 2: { min: 10 } }, { min: 11 }), tiny)).toContain('the most allowed is 30 minutes (what they last did, week 3, was 12; never below 30 minutes)');
  });

  it('a long break: half of the base, never below the floor', () => {
    expect(passes(week({ 1: { min: 10 }, 2: { min: 10 }, 3: { min: 10 } }, { min: 10 }), back(80, 3, 50))).toBe(true);
    expect(refusal(week({ 1: { min: 10 }, 2: { min: 10 }, 3: { min: 10 } }, { min: 11 }), back(80, 3, 50))).toContain(
      "This week's running is 41 minutes; the most allowed is 40 minutes (half of what they last did, week 3: 80)."
    );
    // A base of 40 halves to 20: the floor, 30, holds.
    expect(passes(week({ 1: { min: 10 }, 2: { min: 10 } }, { min: 10 }), back(40, 3, 50))).toBe(true);
    expect(refusal(week({ 1: { min: 10 }, 2: { min: 10 } }, { min: 11 }), back(40, 3, 50))).toContain(
      'the most allowed is 30 minutes (half of what they last did, week 3: 40, is 20; never below 30 minutes).'
    );
  });

  it('a base with fewer than 3 runs has no longest-run check; the total caps it', () => {
    expect(passes(week({ 1: { min: 40 } }, { min: 20 }), { ...back(60), runs: 1 })).toBe(true);
  });

  it('an unknown base after a break is held like a 0-run base (PSL-16), not "no total check"', () => {
    const unknown: BaseWeek = { known: false, runWithoutLoad: true, firstWeekBack: { fromWeek: 3, percent: 100 } };
    expect(refusal(week({ 1: { min: 35 } }, { min: 20 }), unknown)).toContain(`Day 1 step "Run 1": the run is 35 minutes; the most allowed is 30 minutes (last week's running isn't known).`);
    expect(passes(week({ 1: { min: 30 }, 2: { min: 30 } }, { min: 30 }), unknown)).toBe(true);
    expect(refusal(week({ 1: { min: 30, km: 5.5 }, 2: { min: 25, km: 4 } }, { min: 25, km: 4 }), unknown)).toContain('the run is 5.5 km; the most allowed is 5');
    // Without a break the same unknown base has no cap on a run with 3 or more runs (M2.2a).
    expect(passes(week({ 1: { min: 35 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 15 }), { known: false, runWithoutLoad: true })).toBe(true);
    expect(refusal(week({ 1: { min: 35 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 15 }), unknown)).toContain('the run is 35 minutes; the most allowed is 30');
  });

  it('no done running anywhere is held like a 0-run base', () => {
    const none: BaseWeek = { known: true, unit: 'minutes', total: 0, totalMinutes: 0, runs: 0, firstWeekBack: { fromWeek: null, percent: 100 } };
    expect(passes(week({ 1: { min: 25 }, 2: { min: 25 } }, { min: 25 }), none)).toBe(true);
    expect(refusal(week({ 1: { min: 35 }, 2: { min: 25 } }, { min: 25 }), none)).toContain('the run is 35 minutes; the most allowed is 30 minutes (last week had no running).');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The prompt line (PSL-11 Q17).

describe('the prompt line', () => {
  const longest = "- Longest run: at most 50% of the week's running when there are 3 or more runs.";

  it('names the number and the week', () => {
    expect(runningLines(back(60))).toEqual([
      '- Running: first week back; at most 60 minutes in total, what they last completed (week 3).',
      '- Add up the runMinutes of every run before you answer; the total must be at most 60 minutes.',
      longest,
    ]);
  });

  it('with the floor', () => {
    expect(runningLines({ ...back(10), runs: 1 })[0]).toBe('- Running: first week back; at most 30 minutes in total.');
    expect(runningLines(back(40, 3, 50))[0]).toBe('- Running: first week back after a long break; at most 30 minutes in total.');
  });

  it('after a long break', () => {
    expect(runningLines(back(80, 3, 50))[0]).toBe('- Running: first week back after a long break; at most 40 minutes in total, half of what they last completed (week 3).');
  });

  it('in km, with the limit in minutes too', () => {
    expect(runningLines({ known: true, unit: 'km', total: 8, totalMinutes: 50, runs: 2, firstWeekBack: { fromWeek: 2, percent: 100 } }).slice(0, 2)).toEqual([
      '- Running: first week back; at most 8 km in total, what they last completed (week 2).',
      '- Add up the runKm of every run before you answer; the total must be at most 8 km (or the runMinutes, at most 50 minutes, when any run is not given in km).',
    ]);
  });

  it("an unknown base says so, with the 0-run base's longest-run and cap lines; no done running gets the 0-run lines", () => {
    const zero = runningLines({ known: true, unit: 'minutes', total: 0, totalMinutes: 0, runs: 0 });
    expect(zero[0]).toBe('- Running: last week had no running; keep it at their level.');
    expect(runningLines({ known: false, runWithoutLoad: true, firstWeekBack: { fromWeek: 3, percent: 100 } })).toEqual([
      "- Running: last week's running isn't known; keep it at their level.",
      ...zero.slice(1),
    ]);
    // Without a break an unknown base keeps M2.2a's lines.
    expect(runningLines({ known: false, runWithoutLoad: true })[0]).toBe('- Running: there is no last week to count from; keep it at their level.');
    expect(runningLines({ known: true, unit: 'minutes', total: 0, totalMinutes: 0, runs: 0, firstWeekBack: { fromWeek: null, percent: 50 } })).toEqual(zero);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// writeNextWeek: the base, the share and the log line (RULE-10).

describe('writeNextWeek with a first week back', () => {
  const target = RUN10K_WEEK1.target;
  const test = WEEK5.test;
  const goal = (rawGoal = 'Run 10 km in under 55 minutes', clarifiedOutcome = 'Finish a 10 km race in under 55:00') =>
    ({
      id: 'g1',
      rawGoal,
      clarifiedOutcome,
      startDate: new Date('2026-09-21T00:00:00Z'),
      routine: JSON.stringify({ dailyMinutes: 40, planVariant: 'steady' }),
      roadmap: { finalGoal: clarifiedOutcome, finalTest: '', startingPoint: {}, method: WEEK5.method, phases: [WEEK5.phase], answers: [] },
      roadmapWeeks: [1, 2, 3, 4].map((weekNumber) => ({ weekNumber, phase: 'Base', theme: 'Easy runs', target, test, status: weekNumber < 3 ? 'completed' : weekNumber === 3 ? 'active' : 'pending' })),
    }) as never;
  const row = (weekNumber: number, n: number, minutes: number | null, status = 'completed') =>
    ({
      id: `w${weekNumber}t${n}`,
      weekNumber,
      dayNumber: n,
      date: `2026-09-2${n}`,
      dayOfWeek: 'Monday',
      title: `Day ${n}`,
      status,
      isRestDay: false,
      isTestDay: false,
      isKeySession: false,
      notOffered: false,
      usedMinimumVersion: false,
      notes: null,
      detailedSteps: JSON.stringify(
        minutes === null ? [{ ...mobility }] : [{ stepNumber: 1, title: `Easy run ${n}`, durationMinutes: minutes, kind: 'easy_session', priority: 1, load: { runMinutes: minutes, hardRun: false } }]
      ),
      minimumVersion: null,
    }) as never;
  const firstWeekBack = (awayDays: number) => ({ awayDays, note: null, length: null, highLoad: true, everyStep: false });
  /** Week 3 closing with nothing done; week 2 done 80 minutes; week 1 done 30. */
  const closing = [1, 2, 3].map((n) => row(3, n, 30, 'pending'));
  const older = [row(2, 1, 40), row(2, 2, 40), row(1, 1, 30)];

  it('reads back past the closing week, and logs the week read, its total, the share and the limit with the goal id', async () => {
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: week({ 1: { min: 30 }, 2: { min: 30 } }, { min: 30 }) } as never);
    expect(await writeNextWeek(goal(), 3, closing, '07:30', PATHWAY_PROFILES.run10k, [], { firstWeekBack: firstWeekBack(10), olderWeeks: older })).toBeNull();
    const lines = safetyLines();
    expect(lines[0]).toEqual({ goalId: 'g1', week: 4, rule: 'first_week_back_base', step: 'This week', matched: 'week 2 total 80 minutes, share 100, limit 80 minutes', value: 80, limit: 80, outcome: 'logged' });
    expect(lines.slice(1).map((line) => [line.rule, line.outcome])).toEqual([
      ['running_total_over_limit', 'retry'],
      ['running_total_over_limit', 'failed'],
    ]);
    expect(JSON.stringify(vi.mocked(generateStructuredContent).mock.calls[0])).toContain('first week back; at most 80 minutes in total, what they last completed (week 2).');
  });

  it.each([
    [21, 50, 40],
    [20, 100, 80],
  ])('a break of %i days uses share %i: limit %i', async (awayDays, share, limit) => {
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: week({ 1: { min: 10 }, 2: { min: 10 }, 3: { min: 10 } }, { min: 10 }) } as never);
    expect(await writeNextWeek(goal(), 3, closing, '07:30', PATHWAY_PROFILES.run10k, [], { firstWeekBack: firstWeekBack(awayDays), olderWeeks: older })).not.toBeNull();
    expect(safetyLines()[0]).toMatchObject({ rule: 'first_week_back_base', matched: `week 2 total 80 minutes, share ${share}, limit ${limit} minutes`, limit });
  });

  it('a done run without a number: no_base and the unknown base logged, held like PSL-16', async () => {
    const noNumber = [{ ...(row(3, 1, 30) as object), detailedSteps: JSON.stringify([{ stepNumber: 1, title: 'Easy run', durationMinutes: 30, kind: 'easy_session', priority: 1 }, { ...mobility }]) }] as never[];
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: week({ 1: { min: 35 }, 2: { min: 25 } }, { min: 25 }) } as never);
    expect(await writeNextWeek(goal(), 3, noNumber, '07:30', PATHWAY_PROFILES.run10k, [], { firstWeekBack: firstWeekBack(10), olderWeeks: older })).toBeNull();
    const lines = safetyLines();
    expect(lines.slice(0, 2)).toEqual([
      { goalId: 'g1', week: 4, rule: 'no_base', step: 'This week', matched: 'last week running not known', outcome: 'logged' },
      { goalId: 'g1', week: 4, rule: 'first_week_back_base', step: 'This week', matched: 'week 3 total unknown, share 100, limit none (held like no running)', outcome: 'logged' },
    ]);
    expect(lines[2]).toMatchObject({ rule: 'longest_run_over_limit', outcome: 'retry' });
  });

  it('no done running anywhere: logged as none', async () => {
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: week({ 1: { min: 25 }, 2: { min: 25 } }, { min: 25 }) } as never);
    expect(await writeNextWeek(goal(), 3, closing, '07:30', PATHWAY_PROFILES.run10k, [], { firstWeekBack: firstWeekBack(10), olderWeeks: [] })).not.toBeNull();
    expect(safetyLines()).toEqual([{ goalId: 'g1', week: 4, rule: 'first_week_back_base', step: 'This week', matched: 'week none, share 100, limit none (held like no running)', outcome: 'logged' }]);
  });

  it('without a break the base is the closing week, as before (older weeks not read, nothing new logged)', async () => {
    const done = [1, 2, 3].map((n) => row(3, n, 20));
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: week({ 1: { min: 15 }, 2: { min: 15 }, 3: { min: 15 } }, { min: 25 }) } as never);
    expect(await writeNextWeek(goal(), 3, done, '07:30', PATHWAY_PROFILES.run10k, [], { olderWeeks: older })).not.toBeNull();
    expect(safetyLines()).toEqual([]);
    expect(JSON.stringify(vi.mocked(generateStructuredContent).mock.calls[0])).toContain('at most 70 minutes this week in all (last week 60 minutes)');
  });

  it('a goal that is not a load goal: no base, nothing logged', async () => {
    const typing = { ...(goal('Type 40 words per minute', 'Type 40 wpm at 95% accuracy') as object) } as Record<string, any>;
    typing.roadmapWeeks = typing.roadmapWeeks.map((w: object) => ({ ...w, target: { kind: 'number', metric: 'Typing speed', value: 40, unit: 'wpm', direction: 'higher_is_better' } }));
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: false, error: 'stop' } as never);
    await writeNextWeek(typing as never, 3, closing, '07:30', null, [], { firstWeekBack: { ...firstWeekBack(10), highLoad: false } }).catch(() => null);
    expect(JSON.stringify(vi.mocked(generateStructuredContent).mock.calls[0])).not.toContain('SAFETY LIMITS');
    expect(safetyLines()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// M2.2b review fix 1: the light-step swap fits the room left under the running-total limit.

describe('the light-step swap fits the room (review fix 1)', () => {
  /** A run10k first week back of a high-load goal: a light week, so a test step refused on the last attempt is swapped. */
  const BACK: WeekCallInput = { ...WEEK5, firstWeekBack: { awayDays: 10, note: null, highLoad: true } };
  const TRIAL = 'Run a 5K time trial at race effort.';
  /** The test step, refused for the time trial, says 0 running minutes so the model's week fits; its day is 40 minutes. */
  const testDay = (answer: RawWeekAnswer) => {
    const result = checkWeekAnswer(answer, { ...BACK, baseWeek: base }, true);
    return 'value' in result ? result.value.find((day) => day.isTestDay)! : null;
  };
  let base: BaseWeek;
  const lightStep = (day: NonNullable<ReturnType<typeof testDay>>) => day.detailedSteps.find((item) => item.title === 'Weekly test: an easy version')!;

  it('limit 30, no other running, a 30-minute test: the light step keeps its 30 minutes and the week is written', () => {
    base = { ...back(10), runs: 1 };
    const day = testDay(week({}, { min: 30 }, TRIAL));
    expect(day).not.toBeNull();
    expect(lightStep(day!).durationMinutes).toBe(30);
  });

  it('limit 30, no other running, a 40-minute test day: the light step is cut to 30 and the week is written', () => {
    base = { ...back(10), runs: 1 };
    const answer = week({}, { min: 30 }, TRIAL);
    // The test step takes the whole 40 minutes of its day, with its running said as 5.
    const day6 = (answer.days as Array<Record<string, any>>)[5];
    day6.steps = [{ ...day6.steps[1], minutes: 40, load: { runMinutes: 5, hardRun: false } }];
    const day = testDay(answer);
    expect(day).not.toBeNull();
    expect(lightStep(day!).durationMinutes).toBe(30);
    expect(day!.durationMinutes).toBe(30);
  });

  it('other running 25 leaves room 5, under a 10-minute version: not shortened, the week fails as before', () => {
    base = { ...back(10), runs: 1 };
    const answer = week({ 1: { min: 25 } }, { min: 5 }, TRIAL);
    (answer.days as Array<Record<string, any>>)[5].steps[1].minutes = 20;
    const result = checkWeekAnswer(answer, { ...BACK, baseWeek: base }, true);
    expect('reason' in result ? result.reason : '').toContain("This week's running is 45 minutes; the most allowed is 30");
  });

  it('an ordinary base with room: a light step that already fits is unchanged', () => {
    base = { known: true, unit: 'minutes', total: 200, totalMinutes: 200, runs: 4 };
    const day = testDay(week({ 1: { min: 20 }, 2: { min: 20 } }, { min: 20 }, TRIAL));
    expect(lightStep(day!).durationMinutes).toBe(20);
  });

  it('an ordinary base: the light step is cut to the room too', () => {
    // Base 60 + 10 = 70; other running 50; a 30-minute test becomes 20.
    base = { known: true, unit: 'minutes', total: 60, totalMinutes: 60, runs: 3 };
    const answer = week({ 1: { min: 25 }, 2: { min: 25 } }, { min: 30 }, TRIAL);
    (answer.days as Array<Record<string, any>>)[5].steps[1].load = { runMinutes: 15, hardRun: false };
    const day = testDay(answer);
    expect(day).not.toBeNull();
    expect(lightStep(day!).durationMinutes).toBe(20);
  });

  it('no running-total limit (a 0-run base): no change', () => {
    base = { known: true, unit: 'minutes', total: 0, totalMinutes: 0, runs: 0, firstWeekBack: { fromWeek: null, percent: 100 } };
    const day = testDay(week({}, { min: 30 }, TRIAL));
    expect(lightStep(day!).durationMinutes).toBe(30);
  });
});
