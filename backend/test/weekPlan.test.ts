import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import {
  buildWeekPrompt,
  checkWeekAnswer,
  generateWeekPlan,
  weekLayout,
  type RawWeekAnswer,
  type WeekCallInput,
} from '../src/lib/ai/weekPlan.js';

const input: WeekCallInput = {
  finalGoal: 'Type 40 words per minute at 95% accuracy',
  answers: [{ id: 'current_level', question: 'Speed?', answer: '14 wpm' }],
  dailyMinutes: 30,
  planVariant: 'steady',
  slotTime: '19:30',
  method: { name: 'Keybr adaptive drills', creator: '', rules: ['Hold 95% accuracy before adding speed'] },
  weekNumber: 1,
  totalWeeks: 12,
  phase: { name: 'Accuracy', purpose: 'Learn every key without looking.' },
  focus: 'Home row',
  target: { kind: 'number', metric: 'Typing speed', value: 16, unit: 'words per minute', direction: 'higher_is_better' },
  test: { type: 'typing_test', instructions: 'Take a 1-minute typing test on keybr.com', passIf: '16 wpm at 95% accuracy' },
  weekStart: new Date('2026-09-21T12:00:00Z'),
};

function step(title: string, priority: number, minutes = 10) {
  return {
    title,
    instructions: `Do ${title.toLowerCase()} for the full time, eyes on the screen and fingers on the home row.`,
    minutes,
    output: 'Your speed and accuracy numbers',
    doneWhen: '95% accuracy or better',
    focusCue: 'Eyes up',
    pitfall: 'Looking down',
    priority,
  };
}

/** Steady: days 1-3 and 5-6 practice, 4 and 7 rest, day 6 the test. */
function week(overrides: (days: Array<Record<string, unknown>>) => void = () => {}): RawWeekAnswer {
  const days: Array<Record<string, unknown>> = Array.from({ length: 7 }, (_, index) => {
    const dayNumber = index + 1;
    if (dayNumber === 4 || dayNumber === 7) {
      return { dayNumber, isKeySession: false, title: 'Easy home row pass', whyToday: 'Keeps the keys fresh.', steps: [step('Slow home row pass', 1, 12)] };
    }
    const steps =
      dayNumber === 6
        ? [step('Warm up on home row words', 2, 5), step('Weekly test: 1-minute typing test', 1, 15), step('Compare your result with 16 wpm', 3, 10)]
        : [step(`Drill ${dayNumber} letters`, 1, 15), step(`Type sentence set ${dayNumber}`, 2, 15)];
    return {
      dayNumber,
      isKeySession: dayNumber === 3,
      title: `Type set ${dayNumber} at 95% accuracy`,
      whyToday: 'Builds accuracy toward 16 wpm.',
      steps,
      minimumVersion: { ...step(`Two minutes per row, set ${dayNumber}`, 1, 10) },
    };
  });
  overrides(days);
  return { days };
}

function reason(result: ReturnType<typeof checkWeekAnswer>): string {
  return 'reason' in result ? result.reason : '';
}

describe('weekLayout', () => {
  it('puts rest days where the track says and the test on the last practice day', () => {
    const layout = weekLayout('steady', input.weekStart);
    expect(layout.filter((d) => d.isRestDay).map((d) => d.dayNumber)).toEqual([4, 7]);
    expect(layout.find((d) => d.isTestDay)?.dayNumber).toBe(6);
    expect(weekLayout('accelerated', input.weekStart).find((d) => d.isTestDay)?.dayNumber).toBe(6);
    expect(weekLayout('minimal', input.weekStart).find((d) => d.isTestDay)?.dayNumber).toBe(6);
  });
});

describe('checkWeekAnswer', () => {
  it('accepts a sound week and fixes minutes, priorities and flags', () => {
    const result = checkWeekAnswer(week(), input);
    expect(reason(result)).toBe('');
    if (!('value' in result)) return;
    const days = result.value;
    expect(days).toHaveLength(7);
    for (const day of days.filter((d) => !d.isRestDay)) {
      expect(day.detailedSteps.reduce((sum, s) => sum + s.durationMinutes, 0)).toBe(30);
      expect(new Set(day.detailedSteps.map((s) => s.priority)).size).toBe(day.detailedSteps.length);
      expect(day.minimumVersion!.durationMinutes).toBeLessThanOrEqual(10);
    }
    expect(days.find((d) => d.isTestDay)?.dayNumber).toBe(6);
    expect(days.filter((d) => d.isKeySession).map((d) => d.dayNumber)).toEqual([3]);
    const test = days[5].detailedSteps.find((s) => s.title.startsWith('Weekly test'))!;
    expect(test.priority).toBe(1);
    expect(test.passMark).toBe('16 wpm at 95% accuracy');
  });

  it('keeps rest days to one light step of 15 minutes at most', () => {
    const result = checkWeekAnswer(
      week((days) => {
        days[3].steps = [step('Long drill', 1, 40), step('Another', 2, 20)];
      }),
      input
    );
    expect('value' in result).toBe(true);
    if (!('value' in result)) return;
    expect(result.value[3].isRestDay).toBe(true);
    expect(result.value[3].detailedSteps).toHaveLength(1);
    expect(result.value[3].durationMinutes).toBe(15);
    expect(result.value[3].minimumVersion).toBe(null);
  });

  it('fills in a rest day the model left out, but not a practice day', () => {
    const noRest = week((days) => { days.splice(3, 1); });
    const result = checkWeekAnswer(noRest, input);
    expect('value' in result && result.value[3]).toMatchObject({ dayNumber: 4, isRestDay: true, title: 'Rest day' });
    expect(reason(checkWeekAnswer(week((days) => { days.splice(0, 1); }), input))).toMatch(/Day 1 is missing/);
  });

  it('takes a one-step practice day on the last attempt', () => {
    const thin = week((days) => { days[2].steps = [step('Long accuracy drill', 1, 30)]; });
    expect(reason(checkWeekAnswer(thin, input))).toMatch(/needs 2 to 4 steps/);
    expect('value' in checkWeekAnswer(thin, input, true)).toBe(true);
  });

  it('drops break steps and gives their minutes to the real work', () => {
    const result = checkWeekAnswer(
      week((days) => { (days[0].steps as unknown[]).splice(1, 0, step('Mandatory focus reset break', 3, 2)); }),
      input
    );
    if (!('value' in result)) throw new Error(reason(result));
    expect(result.value[0].detailedSteps.map((s) => s.title)).toEqual(['Drill 1 letters', 'Type sentence set 1']);
    expect(result.value[0].detailedSteps.reduce((sum, s) => sum + s.durationMinutes, 0)).toBe(30);
  });

  it('lets the test day be shorter than the daily time instead of padding it', () => {
    const result = checkWeekAnswer(
      week((days) => {
        days[5].steps = [step('Warm up on home row words', 2, 5), step('Weekly test: 1-minute typing test', 1, 5), step('Compare your result with 16 wpm', 3, 5)];
      }),
      input
    );
    if (!('value' in result)) throw new Error(reason(result));
    expect(result.value[5].durationMinutes).toBe(15);
    expect(result.value[5].detailedSteps.map((s) => s.durationMinutes)).toEqual([5, 5, 5]);
  });

  it('allows a rest day with no steps', () => {
    const result = checkWeekAnswer(week((days) => { days[6].steps = []; }), input);
    expect('value' in result && result.value[6].title).toBe('Rest day');
  });

  it('never makes the test day a key session, and picks a mid-week one when none is marked', () => {
    const result = checkWeekAnswer(
      week((days) => {
        for (const day of days) day.isKeySession = false;
        days[5].isKeySession = true;
      }),
      input
    );
    if (!('value' in result)) throw new Error(reason(result));
    const keys = result.value.filter((d) => d.isKeySession);
    expect(keys).toHaveLength(1);
    expect(keys[0].isTestDay).toBe(false);
  });

  it('caps key sessions at 2', () => {
    const result = checkWeekAnswer(week((days) => { for (const day of days) day.isKeySession = true; }), input);
    expect('value' in result && result.value.filter((d) => d.isKeySession)).toHaveLength(2);
  });

  it('asks for the weekly test on the test day, and adds it itself on the last attempt', () => {
    const noTest = week((days) => {
      days[5].steps = [step('Drill six letters', 1, 15), step('Type sentence set six', 2, 15)];
    });
    expect(reason(checkWeekAnswer(noTest, input))).toMatch(/Weekly test/);
    const result = checkWeekAnswer(noTest, input, true);
    if (!('value' in result)) throw new Error(reason(result));
    const test = result.value[5].detailedSteps.find((s) => s.title.startsWith('Weekly test'))!;
    expect(test.instructions).toBe(input.test.instructions);
    expect(test.priority).toBe(1);
  });

  it('rejects a practice day with no steps, even on the last attempt', () => {
    expect(reason(checkWeekAnswer(week((days) => { days[0].steps = []; }), input, true))).toMatch(/needs 2 to 4 steps; got 0/);
  });

  it('rejects two identical practice days unless it is the last attempt', () => {
    const same = week((days) => { days[1].steps = days[0].steps; });
    expect(reason(checkWeekAnswer(same, input))).toMatch(/same steps as day 1/);
    expect('value' in checkWeekAnswer(same, input, true)).toBe(true);
  });

  it('asks for a minimum version, and derives a 10-minute one on the last attempt', () => {
    const none = week((days) => { delete days[0].minimumVersion; });
    expect(reason(checkWeekAnswer(none, input))).toMatch(/minimumVersion/);
    const result = checkWeekAnswer(none, input, true);
    expect('value' in result && result.value[0].minimumVersion?.durationMinutes).toBe(10);
  });

  it('rejects filler steps', () => {
    expect(reason(checkWeekAnswer(week((days) => { (days[0].steps as unknown[])[1] = step('Journal about progress', 2, 15); }), input))).toMatch(/filler/);
  });

  it('asks for a re-test first when the last two weeks were weak', () => {
    expect(reason(checkWeekAnswer(week(), { ...input, retestFirst: true }))).toMatch(/Re-test/);
  });
});

describe('buildWeekPrompt', () => {
  it('lists the fixed days, the target and the test', () => {
    const prompt = buildWeekPrompt(input, weekLayout('steady', input.weekStart));
    expect(prompt).toContain('Target: Typing speed: 16 words per minute');
    expect(prompt).toContain('Weekly test: Take a 1-minute typing test on keybr.com. Pass if: 16 wpm at 95% accuracy');
    expect(prompt).toMatch(/Day 4 \(\w+\): rest/);
    expect(prompt).toMatch(/Day 6 \(\w+\): practice, TEST DAY/);
    expect(prompt).not.toContain('LAST WEEK');
  });

  it('includes last week from week 2', () => {
    const prompt = buildWeekPrompt(
      {
        ...input,
        weekNumber: 2,
        lastWeek: { target: input.target, result: 'test done', done: 4, planned: 5, keySessionsSkipped: [] },
      },
      weekLayout('steady', input.weekStart)
    );
    expect(prompt).toContain('LAST WEEK');
    expect(prompt).toContain('Sessions done: 4 of 5.');
    expect(prompt).toContain('Key sessions skipped: none.');
  });
});

describe('generateWeekPlan', () => {
  const mocked = vi.mocked(generateStructuredContent);
  beforeEach(() => mocked.mockReset());

  it('returns null when both answers fail', async () => {
    mocked.mockResolvedValue({ success: false, error: 'quota' } as never);
    expect(await generateWeekPlan(input)).toBe(null);
    expect(mocked).toHaveBeenCalledTimes(2);
  });

  it('returns the checked week', async () => {
    mocked.mockResolvedValueOnce({ success: true, data: week() } as never);
    const days = await generateWeekPlan(input);
    expect(days).toHaveLength(7);
  });
});
