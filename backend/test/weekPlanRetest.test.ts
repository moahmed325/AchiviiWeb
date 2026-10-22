import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { buildWeekPrompt, checkWeekAnswer, codeMadeTestStep, weekLayout, type RawWeekAnswer, type WeekCallInput, type WeekDayPlan } from '../src/lib/ai/weekPlan.js';
import { EASY_RETEST_STEP, codeMadeRetestStep, easyRetestStep, retestDayOf, retestStepFor } from '../src/lib/ai/retestStep.js';
import { TEST_STEP_TITLE, baseWeekOf, runOf, testStepOf } from '../src/lib/safety/weekLoad.js';
import { PATHWAY_PROFILES } from '../src/lib/recovery/pathways.js';
import type { WeekTest } from '../src/lib/ai/roadmap.js';
import { RUN10K_WEEK1 } from './run10kWeekInput.js';

// Weekly update M3.3a (RULE-5, RULE-6, WU-55, WU-56): the re-test step code puts first on the new week's first offered
// practice day, and how the load checks count it.

const TIME_TRIAL: WeekTest = { type: 'timer', instructions: 'Run 5 km as a time trial; note the time', passIf: '5 km in 30 minutes or less' };
const TYPING: WeekTest = { type: 'typing_test', instructions: 'Take a 1-minute typing test on keybr.com', passIf: '16 wpm at 95% accuracy' };

const input: WeekCallInput = {
  finalGoal: 'Type 40 words per minute at 95% accuracy',
  answers: [],
  dailyMinutes: 30,
  planVariant: 'steady',
  slotTime: '19:30',
  method: { name: 'Keybr adaptive drills', creator: '', rules: ['Hold 95% accuracy before adding speed'] },
  weekNumber: 4,
  totalWeeks: 12,
  phase: { name: 'Accuracy', purpose: 'Learn every key without looking.' },
  focus: 'Home row',
  target: { kind: 'number', metric: 'Typing speed', value: 18, unit: 'words per minute', direction: 'higher_is_better' },
  test: { type: 'typing_test', instructions: 'Take a 1-minute typing test on keybr.com', passIf: '18 wpm at 95% accuracy' },
  weekStart: new Date('2026-09-21T12:00:00Z'),
  retest: { ofWeek: 3, test: TYPING },
};

function step(title: string, priority: number, minutes = 10, extra: Record<string, unknown> = {}) {
  return {
    title,
    instructions: `Do ${title.toLowerCase()} for the full time, eyes on the screen and fingers on the home row.`,
    minutes,
    output: 'Your speed and accuracy numbers',
    doneWhen: '95% accuracy or better',
    focusCue: 'Eyes up',
    pitfall: 'Looking down',
    priority,
    ...extra,
  };
}

/** Steady: days 1-3 and 5-6 practice, 4 and 7 rest, day 6 the test. */
function week(change: (days: Array<Record<string, any>>) => void = () => {}): RawWeekAnswer {
  const days: Array<Record<string, any>> = Array.from({ length: 7 }, (_, index) => {
    const dayNumber = index + 1;
    if (dayNumber === 4 || dayNumber === 7) return { dayNumber, isKeySession: false, title: 'Rest', whyToday: 'Rest.', steps: [] };
    const steps =
      dayNumber === 6
        ? [step('Warm up on home row words', 2, 5), step('Weekly test: 1-minute typing test', 1, 15), step('Compare your result with 18 wpm', 3, 10)]
        : [step(`Drill ${dayNumber} letters`, 1, 15), step(`Type sentence set ${dayNumber}`, 2, 10), step(`Speed burst ${dayNumber}`, 3, 5)];
    return { dayNumber, isKeySession: dayNumber === 3, title: `Type set ${dayNumber}`, whyToday: 'Builds accuracy.', steps, minimumVersion: step(`Two minutes per row ${dayNumber}`, 1, 10) };
  });
  change(days);
  return { days };
}

const value = (result: ReturnType<typeof checkWeekAnswer>): WeekDayPlan[] => {
  if (!('value' in result)) throw new Error(result.reason);
  return result.value;
};
const reason = (result: ReturnType<typeof checkWeekAnswer>) => ('reason' in result ? result.reason : '');
const retestSteps = (days: WeekDayPlan[]) => days.flatMap((day) => day.detailedSteps.filter((s) => codeMadeRetestStep(s)).map((s) => ({ day: day.dayNumber, step: s })));
const dateOf = (dayNumber: number) => weekLayout('steady', input.weekStart)[dayNumber - 1].date;

let warn: ReturnType<typeof vi.spyOn>;
const safetyLines = () => warn.mock.calls.filter((call) => call[0] === '[Safety]').map((call) => JSON.parse(call[1] as string) as Record<string, unknown>);
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('the re-test step (item 5, WU-56)', () => {
  it('goes first on the first practice day, with fixed text, half the daily minutes, and the rest of the day fitted around it', () => {
    const days = value(checkWeekAnswer(week(), input));
    expect(retestSteps(days).map((item) => item.day)).toEqual([1]);
    const [retest, ...others] = days[0].detailedSteps;
    expect(retest).toMatchObject({
      title: 'Re-test: Take a 1-minute typing test on keybr',
      instructions: TYPING.instructions,
      passMark: TYPING.passIf,
      durationMinutes: 15,
      stepNumber: 1,
    });
    // M3.3a review: first in order, but ranked right after the day's own lead, which stays priority 1.
    expect(days[0].detailedSteps.map((s) => [s.title, s.priority])).toEqual([
      ['Re-test: Take a 1-minute typing test on keybr', 2],
      ['Drill 1 letters', 1],
      ['Type sentence set 1', 3],
      ['Speed burst 1', 4],
    ]);
    expect(retest.load).toBeUndefined();
    // Trimmed as the test day is: at most 3 of the model's steps, the lowest priority dropped first.
    expect(others.map((s) => s.title)).toEqual(['Drill 1 letters', 'Type sentence set 1', 'Speed burst 1']);
    expect(others.reduce((sum, s) => sum + s.durationMinutes, 0)).toBe(15);
    expect(days[0].durationMinutes).toBe(30);
    // The 10-minute version is the rest of the day's, never a short re-test.
    expect(days[0].minimumVersion?.title).toBe('Two minutes per row 1');
  });

  it('is never the week\'s own test step: the test day keeps its test, and neither recogniser confuses the two', () => {
    const days = value(checkWeekAnswer(week(), input));
    const retest = days[0].detailedSteps[0];
    expect(TEST_STEP_TITLE.test(retest.title)).toBe(false);
    expect(codeMadeTestStep(retest)).toBeNull();
    expect(codeMadeRetestStep(retest)).toBe('measured');
    expect(days[5].detailedSteps.some((s) => TEST_STEP_TITLE.test(s.title))).toBe(true);
    expect(days[5].detailedSteps.some((s) => codeMadeRetestStep(s))).toBe(false);
    // Read back from stored text the same way.
    expect(codeMadeRetestStep(JSON.parse(JSON.stringify(retest)))).toBe('measured');
    expect(codeMadeRetestStep({ title: 'Re-test: my own idea', focusCue: 'Eyes up', pitfallToAvoid: 'Looking down' })).toBeNull();
  });

  it('skips days not offered and never uses the test day; none when no offered practice day comes before the test day', () => {
    expect(retestDayOf(weekLayout('steady', input.weekStart), dateOf(3))).toBe(3);
    const skipped = value(checkWeekAnswer(week(), { ...input, retest: { ...input.retest!, notOfferedBefore: dateOf(2) } }));
    expect(retestSteps(skipped).map((item) => item.day)).toEqual([2]);
    // Day 4 is rest; day 5 is the last practice day before the test day 6.
    expect(retestDayOf(weekLayout('steady', input.weekStart), dateOf(4))).toBe(5);
    const none = { ...input, retest: { ...input.retest!, notOfferedBefore: dateOf(6) } };
    expect(retestDayOf(weekLayout('steady', input.weekStart), dateOf(6))).toBeNull();
    expect(retestSteps(value(checkWeekAnswer(week(), none)))).toEqual([]);
    expect(buildWeekPrompt(none, weekLayout('steady', input.weekStart))).not.toMatch(/re-test/i);
  });

  it('the prompt tells the writer the day, the week re-tested and the minutes; without a re-test it says nothing', () => {
    const prompt = buildWeekPrompt(input, weekLayout('steady', input.weekStart));
    expect(prompt).toContain(
      "- Day 1 (Monday) starts with a re-test of week 3's test (Take a 1-minute typing test on keybr.com), which\n  code adds as its first step (15 minutes). Plan the rest of that day around it, shorter: steps adding up to\n  15 minutes, and none that repeats the test."
    );
    expect(prompt).not.toContain('counts as a hard run');
    const { retest: _none, ...plain } = input;
    expect(buildWeekPrompt(plain, weekLayout('steady', input.weekStart))).not.toMatch(/re-test/i);
  });

  it('with a profile it is tagged as the test step is (fixed), and the side-step check passes it', () => {
    const recovery = PATHWAY_PROFILES.run10k;
    const kinds = (days: Array<Record<string, any>>) => {
      for (const day of days) for (const s of day.steps) s.kind = day.dayNumber === 6 ? 'weekly_test' : 'easy_session';
      for (const day of days) if (day.minimumVersion) day.minimumVersion.kind = 'easy_session';
    };
    // A short stored test (under the 25-character instructions rule) and a title ending in "log": code's text, not a reason.
    const ending = { ...TYPING, instructions: 'Type the passage and log' };
    const days = value(checkWeekAnswer(week(kinds), { ...input, recovery, retest: { ofWeek: 3, test: ending } }));
    expect(days[0].detailedSteps[0]).toMatchObject({ title: 'Re-test: Type the passage and log', kind: 'weekly_test' });
    expect(days[0].minimumVersion?.kind).toBe('easy_session');
  });
});

describe('the re-test on a load goal (WU-55)', () => {
  const RUN10K: WeekCallInput = { ...RUN10K_WEEK1, weekNumber: 5, loadGoal: { running: true }, retest: { ofWeek: 4, test: TIME_TRIAL } };
  const run = (title: string, priority: number, minutes: number, extra: Record<string, unknown> = {}) => ({ ...step(title, priority, minutes), highLoad: false, ...extra });
  const easy = { runMinutes: 30, hardRun: false };
  /** Days 1-3, 5 easy runs (days 2 and 3 hard when `hard`); day 6 the light long-run test. */
  function runWeek(hard: number[] = []): RawWeekAnswer {
    const days = Array.from({ length: 7 }, (_, index) => {
      const dayNumber = index + 1;
      if (dayNumber === 4 || dayNumber === 7) return { dayNumber, isKeySession: false, title: 'Rest', whyToday: 'Rest.', steps: [] };
      const steps =
        dayNumber === 6
          ? [run('Weekly test: long run at an easy pace', 1, 30, { kind: 'weekly_test', load: { runMinutes: 30, hardRun: false } }), run('Note how it felt', 2, 5, { kind: 'weekly_test' })]
          : hard.includes(dayNumber)
            ? [run(`Intervals ${dayNumber}`, 1, 30, { kind: 'quality_session', load: { runMinutes: 30, hardRun: true } }), run(`Mobility ${dayNumber}`, 2, 10, { kind: 'strength_and_mobility' })]
            : [run(`Easy run ${dayNumber}`, 1, 30, { kind: 'easy_session', load: easy }), run(`Mobility ${dayNumber}`, 2, 10, { kind: 'strength_and_mobility' })];
      return { dayNumber, isKeySession: false, title: `Run day ${dayNumber}`, whyToday: 'Builds running.', steps, minimumVersion: run(`Short run ${dayNumber}`, 1, 10, { kind: 'easy_session', load: { runMinutes: 10, hardRun: false } }) };
    });
    return { days };
  }

  it('the prompt says it counts as a hard run', () => {
    expect(buildWeekPrompt(RUN10K, weekLayout('steady', RUN10K.weekStart))).toContain('The re-test counts as a hard run.');
  });

  it('counts as a hard run of its minutes on a running goal; the easy re-test as an easy one; never on a goal that is not running', () => {
    const measured = retestStepFor(TIME_TRIAL, 20);
    const easyOne = easyRetestStep(20);
    const context = (s: typeof measured, running: boolean) => ({ running, ...testStepOf(s, false, codeMadeTestStep), measured: false });
    expect(runOf(measured, 'r', context(measured, true))).toEqual({ name: 'r', minutes: 20, hard: true, noLoad: false });
    expect(runOf(easyOne, 'e', context(easyOne, true))).toEqual({ name: 'e', minutes: 20, hard: false, noLoad: false });
    expect(runOf(measured, 'r', context(measured, false))).toBeNull();
  });

  it('a third hard run fails the first attempt, naming the hard-run limit', () => {
    expect(reason(checkWeekAnswer(runWeek([2, 3]), RUN10K))).toMatch(/hard/i);
    // Two hard runs with the re-test (one quality session) pass.
    expect(retestSteps(value(checkWeekAnswer(runWeek([2]), RUN10K)))[0].step.title).toMatch(/^Re-test: /);
  });

  it('on the last attempt the easy re-test takes its place, kept only because the swapped week passes; logged light_retest', () => {
    const days = value(checkWeekAnswer(runWeek([2, 3]), RUN10K, true));
    const [retest] = retestSteps(days);
    expect(retest.day).toBe(1);
    expect(retest.step).toMatchObject({ title: EASY_RETEST_STEP.title, instructions: EASY_RETEST_STEP.instructions, passMark: EASY_RETEST_STEP.passMark, durationMinutes: 20, kind: 'weekly_test' });
    expect(codeMadeRetestStep(retest.step)).toBe('light');
    expect(retest.step.load).toBeUndefined();
    expect(safetyLines().map((line) => [line.rule, line.outcome])).toEqual([['hard_runs_over_2', 'light_retest']]);
  });

  it('a swapped week that still breaks a week limit is not kept: the week fails as before', () => {
    const base = { known: true as const, unit: 'minutes' as const, total: 100, totalMinutes: 100, runs: 4 };
    const result = checkWeekAnswer(runWeek([2, 3]), { ...RUN10K, baseWeek: base }, true);
    expect(reason(result)).toMatch(/running/i);
    expect(safetyLines().every((line) => line.outcome === 'failed')).toBe(true);
  });

  it('a refusal on any other step is as today: no swap', () => {
    const answer = runWeek();
    (answer.days as any[])[1].steps[0].load = { runMinutes: 30, hardRun: false, kcalDeficit: 900 };
    const result = checkWeekAnswer(answer, RUN10K, true);
    expect(reason(result)).toMatch(/600/);
    expect(safetyLines().some((line) => line.outcome === 'light_retest')).toBe(false);
  });

  it("the re-test's own stored test text is let through on the re-test step, as the test step's is (PSL-3)", () => {
    const maxTest: WeekTest = { type: 'lift', instructions: 'Squat a 1RM test with a spotter', passIf: '100 kg' };
    const early = { ...RUN10K, weekNumber: 2, retest: { ofWeek: 1, test: maxTest } };
    const days = value(checkWeekAnswer(runWeek(), early));
    expect(retestSteps(days)[0].step.title).toBe('Re-test: Squat a 1RM test with a spotter');
    expect(safetyLines().map((line) => [line.rule, line.outcome])).toEqual([['max_test', 'test_text']]);
  });

  it('a stored re-test step counts in the base week as the code-made test step does', () => {
    const stepOf = (s: ReturnType<typeof retestStepFor>) => ({ ...s, priority: 1 });
    const task = (steps: any[], isTestDay = false) => ({ id: 't', date: '2026-09-21', status: 'completed', isTestDay, notOffered: false, usedMinimumVersion: false, steps, minimumVersion: null });
    const easyRun = { stepNumber: 2, title: 'Easy run', durationMinutes: 20, instructions: '', focusCue: '', pitfallToAvoid: '', priority: 2, kind: 'easy_session', load: { runMinutes: 20, hardRun: false } };
    const base = baseWeekOf([task([stepOf(retestStepFor(TIME_TRIAL, 20)), easyRun])], true, codeMadeTestStep);
    expect(base).toMatchObject({ known: true, totalMinutes: 40, runs: 2 });
  });
});
