import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import { checkWeekAnswer, generateWeekPlan, type RawWeekAnswer, type WeekCallInput } from '../src/lib/ai/weekPlan.js';
import { textSafetyHits, timeTrialHits } from '../src/lib/ai/safetyScan.js';

/**
 * Weekly update M1.5b (WU-41): in a first week back of a high-load goal the weekly test is a light version. The week is
 * scanned with the weeks 1 to 3 rules and the time-trial rule, whatever its number, and a sentence copied from the stored
 * test is refused, not let through (one retry, then the week fails). Everywhere else the scan is exactly B-63's.
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
    ...extra,
  };
}

/** Steady: days 1-3 and 5-6 practice, 4 and 7 rest; day 6 runs the weekly test as `testText` says. */
function week(testText: string): RawWeekAnswer {
  const days: Array<Record<string, unknown>> = Array.from({ length: 7 }, (_, index) => {
    const dayNumber = index + 1;
    if (dayNumber === 4 || dayNumber === 7) return { dayNumber, isKeySession: false, title: 'Rest', whyToday: 'Recover.', steps: [] };
    const steps =
      dayNumber === 6
        ? [step('Warm up with an easy jog', 2, 10), step('Weekly test: 5K', 1, 30, { instructions: testText }), step('Cool down with a walk', 3, 5)]
        : [step(`Easy run ${dayNumber}`, 1, 30), step(`Strides ${dayNumber}`, 2, 10)];
    return {
      dayNumber,
      isKeySession: dayNumber === 3,
      title: `Run session ${dayNumber} at an easy effort`,
      whyToday: 'Builds the aerobic base toward the 10K.',
      steps,
      minimumVersion: step(`Easy jog ${dayNumber}`, 1, 10),
    };
  });
  return { days };
}

const reason = (result: ReturnType<typeof checkWeekAnswer>) => ('reason' in result ? result.reason : '');
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

  it('acts only in a light week: week 2 of an ordinary plan and the roadmap check (no options) are unchanged', () => {
    expect(textSafetyHits('Run a 5K time trial at race effort.', 2)).toEqual([]);
    expect(textSafetyHits('Run a 5K time trial at race effort.', 2, { light: true }).map((hit) => hit.rule)).toEqual(['time_trial']);
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

  it('a high-load first week back refuses a copied stored max test, also in week 8', () => {
    const result = checkWeekAnswer(week('Test your 1RM squat. Rest 3 minutes between attempts.'), { ...input, test: MAX_TEST, ...back(true) }, true);
    expect(reason(result)).toMatch(/SAFETY: Day 6 step "Weekly test: 5K"/);
    expect(safetyLines().map((line) => [line.rule, line.outcome])).toEqual([['max_test', 'failed']]);
  });

  it('a light version of the test passes', () => {
    const result = checkWeekAnswer(week('Run 5K at an easy, conversational effort. No time trial this week.'), { ...input, ...back(true) }, false);
    expect('value' in result).toBe(true);
    expect(safetyLines()).toEqual([]);
  });

  it('the same time trial passes as now in week 2 of a plan with no break', () => {
    const result = checkWeekAnswer(week('Run a 5K time trial at race effort.'), { ...input, weekNumber: 2 }, true);
    expect('value' in result).toBe(true);
    expect(safetyLines()).toEqual([]);
  });

  it('the same time trial passes as now in a first week back of a goal that is not high-load', () => {
    const result = checkWeekAnswer(week('Run a 5K time trial at race effort.'), { ...input, weekNumber: 2, ...back(false) }, true);
    expect('value' in result).toBe(true);
    expect(safetyLines()).toEqual([]);
  });

  it('a copied max test in week 2 of a plan with no break is still only logged (test_text)', () => {
    const result = checkWeekAnswer(week('Test your 1RM squat. Rest 3 minutes between attempts.'), { ...input, weekNumber: 2, test: MAX_TEST }, true);
    expect('value' in result).toBe(true);
    expect(safetyLines().map((line) => line.outcome)).toEqual(['test_text']);
  });

  it('one retry, then the week fails (the route answers its existing 503)', async () => {
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: week('Run a 5K time trial at race effort.') } as never);
    expect(await generateWeekPlan({ ...input, ...back(true) })).toBeNull();
    expect(generateStructuredContent).toHaveBeenCalledTimes(2);
    expect(safetyLines().map((line) => line.outcome)).toEqual(['retry', 'failed']);
  });

  it('the retry is accepted when it writes the light version', async () => {
    vi.mocked(generateStructuredContent)
      .mockResolvedValueOnce({ success: true, data: week('Run a 5K time trial at race effort.') } as never)
      .mockResolvedValueOnce({ success: true, data: week('Run 5K at an easy effort.') } as never);
    expect(await generateWeekPlan({ ...input, ...back(true) })).not.toBeNull();
  });
});
