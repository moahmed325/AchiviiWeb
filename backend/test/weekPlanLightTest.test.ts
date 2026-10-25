import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import {
  LIGHT_TEST_STEP,
  buildWeekPrompt,
  checkWeekAnswer,
  generateWeekPlan,
  weekLayout,
  type RawWeekAnswer,
  type WeekCallInput,
  type WeekDayPlan,
} from '../src/lib/ai/weekPlan.js';
import { textSafetyHits, timeTrialHits } from '../src/lib/ai/safetyScan.js';

/**
 * Weekly update M1.5b (WU-41): in a first week back of a high-load goal the weekly test is a light version. The week is
 * scanned with the weeks 1 to 3 rules and the time-trial rule, whatever its number, and a sentence copied from the stored
 * test is refused, not let through (one retry). Review fix 1: on the last attempt a refusal only on the test step gives
 * the fixed light step instead of failing the week; a refusal elsewhere still fails it. Everywhere else the scan is
 * exactly B-63's.
 */

const TIME_TRIAL_TEST = { type: 'run' as const, instructions: 'Run a 5K time trial at race effort.', passIf: 'Under 27 minutes' };
const MAX_TEST = { type: 'count' as const, instructions: 'Test your 1RM squat', passIf: 'A new 1RM logged' };

const input: WeekCallInput = {
  finalGoal: 'Run a 10K under 50 minutes',
  answers: [{ id: 'current_level', question: '5K time?', answer: '28 minutes' }],
  dailyMinutes: 40,
  planVariant: 'steady',
  slotTime: '19:30',
  method: { name: 'Pfitzinger base', creator: '', rules: ['Mostly easy running'] },
  weekNumber: 8,
  totalWeeks: 12,
  phase: { name: 'Build', purpose: 'Raise the pace.' },
  focus: 'Tempo',
  target: { kind: 'number', metric: '5K time', value: 27, unit: 'min', direction: 'lower_is_better' },
  test: TIME_TRIAL_TEST,
  weekStart: new Date('2026-11-16T12:00:00Z'),
  highLoadGoal: true,
  // Plan safety limits M2.2a review: as production sends it (`loadGoalFor`: a running-time target).
  loadGoal: { running: true },
};
const back = (highLoad: boolean) => ({ firstWeekBack: { awayDays: 45, note: null, highLoad } });

function step(title: string, priority: number, minutes = 15, extra: Record<string, unknown> = {}) {
  return {
    title,
    instructions: `Run ${title.toLowerCase()} at a conversational pace.`,
    minutes,
    output: 'Distance and time written down',
    doneWhen: 'The run is done',
    focusCue: 'Relaxed shoulders',
    pitfall: 'Starting too fast',
    priority,
    highLoad: true,
    // M2.2a review: every step is a run and carries its load (M2.1), easy and within the limits.
    load: { runMinutes: minutes, hardRun: false },
    ...extra,
  };
}

/** Steady: days 1-3 and 5-6 practice, 4 and 7 rest; day 6 runs the weekly test as `testText` says (left out when null). */
function week(testText: string | null, options: { highLoad?: boolean; day1?: string } = {}): RawWeekAnswer {
  const flag = { highLoad: options.highLoad ?? true };
  const days: Array<Record<string, unknown>> = Array.from({ length: 7 }, (_, index) => {
    const dayNumber = index + 1;
    if (dayNumber === 4 || dayNumber === 7) return { dayNumber, isKeySession: false, title: 'Rest', whyToday: 'Recover.', steps: [] };
    const steps =
      dayNumber === 6
        ? [
            step('Warm up with an easy jog', 2, 10, flag),
            ...(testText === null ? [step('Steady 5K run', 1, 30, flag)] : [step('Weekly test: 5K', 1, 30, { instructions: testText, ...flag })]),
            step('Cool down with a walk', 3, 5, flag),
          ]
        : [step(`Easy run ${dayNumber}`, 1, 30, { ...flag, ...(dayNumber === 1 && options.day1 ? { instructions: options.day1 } : {}) }), step(`Strides ${dayNumber}`, 2, 10, flag)];
    return {
      dayNumber,
      isKeySession: dayNumber === 3,
      title: `Run session ${dayNumber} at an easy effort`,
      whyToday: 'Builds the aerobic base toward the 10K.',
      steps,
      minimumVersion: step(`Easy jog ${dayNumber}`, 1, 10, flag),
    };
  });
  return { days };
}

const reason = (result: ReturnType<typeof checkWeekAnswer>) => ('reason' in result ? result.reason : '');
const valueOf = (result: ReturnType<typeof checkWeekAnswer>) => {
  if (!('value' in result)) throw new Error(`refused: ${result.reason}`);
  return result.value;
};
const testStepOf = (days: WeekDayPlan[]) => days.find((day) => day.isTestDay)!.detailedSteps.find((s) => s.title.startsWith('Weekly test'))!;
/** A saved week as the model would write it, to scan it again. */
const asRaw = (days: WeekDayPlan[]): RawWeekAnswer => ({
  days: days.map((day) => ({
    dayNumber: day.dayNumber,
    isKeySession: day.isKeySession,
    title: day.title,
    whyToday: day.whyToday || 'Recover.',
    steps: day.detailedSteps.map((s) => ({
      title: s.title,
      instructions: s.instructions,
      minutes: s.durationMinutes,
      output: s.output,
      doneWhen: s.passMark,
      focusCue: s.focusCue,
      pitfall: s.pitfallToAvoid,
      priority: s.priority,
      highLoad: s.highLoad,
      // M2.2a review: the loads as saved; the code-made light step has none, so as the model's it gets an easy one.
      load: s.load ?? { runMinutes: s.durationMinutes, hardRun: false },
    })),
    ...(day.minimumVersion
      ? { minimumVersion: { title: day.minimumVersion.title, instructions: day.minimumVersion.instructions, minutes: 10, highLoad: true, load: day.minimumVersion.load } }
      : {}),
  })),
});
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.mocked(generateStructuredContent).mockReset();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());
const safetyLines = () =>
  warn.mock.calls.filter((call) => call[0] === '[Safety]').map((call) => JSON.parse(call[1] as string) as Record<string, unknown>);

describe('the time-trial rule (M1.5b, WU-41)', () => {
  it.each(['No time trial this week.', 'Easy run, no time trial.', 'Never an all-out 5K in your first week back.', 'Sprint as fast as you can for 10 seconds.', 'Keep it easy.'])(
    'does not count %j',
    (text) => {
      expect(timeTrialHits(text)).toEqual([]);
      expect(textSafetyHits(text, 8, { light: true })).toEqual([]);
    }
  );

  it.each(['Run a 5K time trial at race effort.', 'Time trial: run 10 km as fast as you can.', 'All-out 3 km.', 'Run 5K as fast as you can.'])('counts %j', (text) => {
    expect(timeTrialHits(text).map((hit) => hit.rule)).toEqual(['time_trial']);
  });

  it('acts in weeks 1 to 3 of every plan and in a light week, not in week 4 or later (B-78)', () => {
    expect(textSafetyHits('Run a 5K time trial at race effort.', 2).map((hit) => hit.rule)).toEqual(['time_trial']);
    expect(textSafetyHits('Run a 5K time trial at race effort.', 4)).toEqual([]);
    expect(textSafetyHits('Run a 5K time trial at race effort.', 4, { light: true }).map((hit) => hit.rule)).toEqual(['time_trial']);
  });

  it('a light week takes the weeks 1 to 3 rules in any week', () => {
    expect(textSafetyHits('Test your 1RM squat', 8)).toEqual([]);
    expect(textSafetyHits('Test your 1RM squat', 8, { light: true }).map((hit) => hit.rule)).toEqual(['max_test']);
  });
});

describe('the week call in a first week back (M1.5b, WU-41)', () => {
  it('a high-load first week back refuses a copied stored time trial on the test step', () => {
    const result = checkWeekAnswer(week('Run a 5K time trial at race effort.'), { ...input, ...back(true) }, false);
    expect(reason(result)).toMatch(/SAFETY: Day 6 step "Weekly test: 5K" says "Run a 5K time trial at race effort\."/);
    expect(safetyLines().map((line) => [line.rule, line.outcome])).toEqual([['time_trial', 'retry']]);
  });

  it('a high-load first week back refuses a copied stored max test, also in week 8; the last attempt gets the light step', () => {
    const copied = week('Test your 1RM squat. Rest 3 minutes between attempts.');
    expect(reason(checkWeekAnswer(copied, { ...input, test: MAX_TEST, ...back(true) }, false))).toMatch(/SAFETY: Day 6 step "Weekly test: 5K"/);
    const last = checkWeekAnswer(copied, { ...input, test: MAX_TEST, ...back(true) }, true);
    expect(testStepOf(valueOf(last))).toMatchObject(LIGHT_TEST_STEP);
    expect(safetyLines().map((line) => [line.rule, line.outcome])).toEqual([
      ['max_test', 'retry'],
      ['max_test', 'light_test'],
    ]);
  });

  it('a light version of the test passes', () => {
    const result = checkWeekAnswer(week('Run 5K at an easy, conversational effort. No time trial this week.'), { ...input, ...back(true) }, false);
    expect('value' in result).toBe(true);
    expect(safetyLines()).toEqual([]);
  });

  it('the same time trial copied from the stored test in week 2 of a plan with no break is only logged (B-78, test_text)', () => {
    const result = checkWeekAnswer(week('Run a 5K time trial at race effort.'), { ...input, weekNumber: 2 }, true);
    expect('value' in result).toBe(true);
    expect(safetyLines().map((line) => [line.rule, line.outcome])).toEqual([['time_trial', 'test_text']]);
  });

  it('the same copied time trial in a first week back of a goal that is not high-load is only logged (B-78, test_text)', () => {
    const result = checkWeekAnswer(week('Run a 5K time trial at race effort.'), { ...input, weekNumber: 2, ...back(false) }, true);
    expect('value' in result).toBe(true);
    expect(safetyLines().map((line) => [line.rule, line.outcome])).toEqual([['time_trial', 'test_text']]);
  });

  it('a copied max test in week 2 of a plan with no break is still only logged (test_text)', () => {
    const result = checkWeekAnswer(week('Test your 1RM squat. Rest 3 minutes between attempts.'), { ...input, weekNumber: 2, test: MAX_TEST }, true);
    expect('value' in result).toBe(true);
    expect(safetyLines().map((line) => line.outcome)).toEqual(['test_text']);
  });

  it('review fix 1: the stored time trial copied on both attempts gives a saved week holding the fixed light step', async () => {
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: week('Run a 5K time trial at race effort.') } as never);
    const days = await generateWeekPlan({ ...input, ...back(true) });
    expect(generateStructuredContent).toHaveBeenCalledTimes(2);
    expect(days).not.toBeNull();
    expect(testStepOf(days!)).toMatchObject({
      title: 'Weekly test: an easy version',
      instructions: "First week back: do this week's test at an easy, comfortable effort, never all-out. Note what you did and how it felt.",
      passMark: 'No pass mark this week; just log what you did.',
    });
    expect(safetyLines().map((line) => line.outcome)).toEqual(['retry', 'light_test']);
    // The swapped week is safe: scanning it again as a light week finds nothing.
    warn.mockClear();
    expect(checkWeekAnswer(asRaw(days!), { ...input, ...back(true) }, false)).toHaveProperty('value');
    expect(safetyLines()).toEqual([]);
  });

  it('review fix 1: a model that leaves out the test step gets the fixed light step (an ordinary week gets the stored test as before)', () => {
    expect(testStepOf(valueOf(checkWeekAnswer(week(null), { ...input, ...back(true) }, true)))).toMatchObject(LIGHT_TEST_STEP);
    const ordinary = testStepOf(valueOf(checkWeekAnswer(week(null), { ...input, weekNumber: 5 }, true)));
    expect(ordinary).toMatchObject({ instructions: TIME_TRIAL_TEST.instructions, passMark: TIME_TRIAL_TEST.passIf });
  });

  it('review fix 1: a non-test step that breaks a rule on both attempts still fails the week (the 503)', async () => {
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: week('Run 5K at an easy effort.', { day1: 'Last set to failure.' }) } as never);
    expect(await generateWeekPlan({ ...input, ...back(true) })).toBeNull();
    expect(safetyLines().map((line) => line.outcome)).toEqual(['retry', 'failed']);
  });

  it('review fix 1: a test-step refusal next to another refusal still fails the week', () => {
    const result = checkWeekAnswer(week('Run a 5K time trial at race effort.', { day1: 'Last set to failure.' }), { ...input, ...back(true) }, true);
    expect(reason(result)).toMatch(/Day 6 step "Weekly test: 5K"/);
    expect(safetyLines().map((line) => line.outcome)).toEqual(['failed', 'failed']);
  });

  it('review fix 1: the test-day line asks for a light version only in a high-load first week back', () => {
    const layout = weekLayout('steady', input.weekStart);
    expect(buildWeekPrompt({ ...input, ...back(true) }, layout)).toContain('a light version of the weekly test above (see FIRST WEEK BACK)');
    for (const other of [input, { ...input, ...back(false) }]) {
      const prompt = buildWeekPrompt(other, layout);
      expect(prompt).toContain("The test day's main step is the weekly test exactly as written above");
      expect(prompt).not.toContain('a light version of the weekly test above');
    }
  });

  it('review fix 2: a custom goal high-load only through its profile has every step scanned in its first week back', () => {
    const custom = { ...input, highLoadGoal: false, test: MAX_TEST, ...back(true) };
    const copied = week('Test your 1RM squat. Rest 3 minutes between attempts.', { highLoad: false });
    expect(reason(checkWeekAnswer(copied, custom, false))).toMatch(/SAFETY: Day 6 step "Weekly test: 5K"/);
    // An ordinary week of the same goal scans only flagged steps, as before.
    warn.mockClear();
    expect(checkWeekAnswer(copied, { ...custom, firstWeekBack: undefined, weekNumber: 2 }, false)).toHaveProperty('value');
    expect(safetyLines()).toEqual([]);
  });

  it('B-78: a goal high-load only through its profile has its test step scanned in an ordinary week', () => {
    const profile = { kinds: [{ id: 'tempo_run', name: 'Tempo run', description: '', action: 'move', hard: true, inOrder: false, highLoad: true }] };
    const custom = { ...input, highLoadGoal: false, weekNumber: 2, test: { type: 'run', instructions: 'Run 5K at an easy effort', passIf: 'Done' }, recovery: profile as never };
    const trial = week('Run a 5K time trial at race effort.', { highLoad: false });
    expect(reason(checkWeekAnswer(trial, custom, false))).toMatch(/SAFETY: Day 6 step "Weekly test: 5K" says "Run a 5K time trial at race effort\."/);
    // Without a high-load kind in the profile, the unflagged test step is not scanned, as before.
    expect(checkWeekAnswer(trial, { ...custom, recovery: undefined }, false)).toHaveProperty('value');
  });

  it('the retry is accepted when it writes the light version', async () => {
    vi.mocked(generateStructuredContent)
      .mockResolvedValueOnce({ success: true, data: week('Run a 5K time trial at race effort.') } as never)
      .mockResolvedValueOnce({ success: true, data: week('Run 5K at an easy effort.') } as never);
    expect(await generateWeekPlan({ ...input, ...back(true) })).not.toBeNull();
  });
});
