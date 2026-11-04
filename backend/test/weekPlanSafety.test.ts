import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { readFileSync } from 'node:fs';
import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import {
  buildWeekPrompt,
  checkWeekAnswer,
  liftCapsRelaxed,
  generateWeekPlan,
  weekLayout,
  type RawWeekAnswer,
  type WeekCallInput,
} from '../src/lib/ai/weekPlan.js';
import { checkRoadmapAnswer, presetMethod, type RawRoadmapAnswer } from '../src/lib/ai/roadmap.js';
import { textSafetyHits } from '../src/lib/ai/safetyScan.js';
import { stepLoadBreaches } from '../src/lib/safety/weekLoad.js';
import { isExperiencedLifter } from '../src/lib/safety/experience.js';
import { recompPreset } from '../src/lib/ai/presets/recomp.js';

/** B-63 (PSL-1, PSL-2): the week call's safety stopgap. */

const input: WeekCallInput = {
  finalGoal: 'Squat 100 kg for 5 reps',
  answers: [{ id: 'current_level', question: 'Squat?', answer: '70 kg for 5' }],
  dailyMinutes: 30,
  planVariant: 'steady',
  slotTime: '19:30',
  method: { name: 'Linear progression', creator: '', rules: ['Add 2.5 kg a session while form holds'] },
  weekNumber: 1,
  totalWeeks: 12,
  phase: { name: 'Base', purpose: 'Groove the lifts.' },
  focus: 'Squat form',
  target: { kind: 'number', metric: 'Squat', value: 72.5, unit: 'kg for 5', direction: 'higher_is_better' },
  test: { type: 'count', instructions: 'Squat 72.5 kg for 5 reps with 3 reps in reserve', passIf: '5 clean reps at 72.5 kg' },
  weekStart: new Date('2026-09-21T12:00:00Z'),
  highLoadGoal: true,
  // Plan safety limits M2.2a review: as production sends it (`loadGoalFor`: a lift-load target).
  loadGoal: { running: false },
};

function step(title: string, priority: number, minutes = 15, extra: Record<string, unknown> = {}) {
  return {
    title,
    instructions: `Do ${title.toLowerCase()} with a 3-second lowering phase and full depth.`,
    minutes,
    output: 'Sets and reps written down',
    doneWhen: 'Every set done with clean form',
    focusCue: 'Brace before each rep',
    pitfall: 'Rushing the descent',
    priority,
    highLoad: true,
    // M2.2a review: every high-load step carries its load (M2.1), within the limits.
    load: { rir: 3 },
    ...extra,
  };
}

/** Steady: days 1-3 and 5-6 practice, 4 and 7 rest, day 6 the test. `lead` is day 1's first step. */
function week(lead: Record<string, unknown> = {}): RawWeekAnswer {
  const days: Array<Record<string, unknown>> = Array.from({ length: 7 }, (_, index) => {
    const dayNumber = index + 1;
    if (dayNumber === 4 || dayNumber === 7) return { dayNumber, isKeySession: false, title: 'Rest', whyToday: 'Recover.', steps: [] };
    const steps =
      dayNumber === 6
        ? [step('Warm up with empty bar squats', 2, 5), step('Weekly test: squat 72.5 kg for 5', 1, 15), step('Compare your result with 72.5 kg', 3, 5)]
        : [step(`Back squat block ${dayNumber}`, 1, 15, dayNumber === 1 ? lead : {}), step(`Romanian deadlift block ${dayNumber}`, 2, 15)];
    return {
      dayNumber,
      isKeySession: dayNumber === 3,
      title: `Squat session ${dayNumber} at a steady load`,
      whyToday: 'Builds the squat toward 72.5 kg.',
      steps,
      minimumVersion: step(`Goblet squats, set ${dayNumber}`, 1, 10),
    };
  });
  return { days };
}

const reason = (result: ReturnType<typeof checkWeekAnswer>) => ('reason' in result ? result.reason : '');
const PREFIX = 'Do back squats with a 3-second lowering phase and full depth. ';
const withText = (instructions: string) => week({ instructions: PREFIX + instructions });

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.mocked(generateStructuredContent).mockReset();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

const safetyLines = () =>
  warn.mock.calls.filter((call) => call[0] === '[Safety]').map((call) => JSON.parse(call[1] as string) as Record<string, unknown>);

describe('safety scan: safe wording never counts', () => {
  const safe = [
    'Stop 3 reps before failure on every set.',
    'Never train to failure this week.',
    'No max test this week.',
    'Keep it under 80% of 1RM.',
    'Leave 3 reps in reserve.',
    'Work at RIR 3-4.',
    'Hold a 300-500 kcal deficit.',
    'Avoid AMRAP sets.',
  ];
  it.each(safe)('passes "%s" in week 1', (text) => {
    expect(textSafetyHits(text, 1)).toEqual([]);
    expect(reason(checkWeekAnswer(withText(text), input))).toBe('');
  });

  it('ignores the pitfall field', () => {
    expect(reason(checkWeekAnswer(week({ pitfall: 'Training to failure in week 1' }), input))).toBe('');
  });
});

describe('safety scan: breaches count in week 1', () => {
  const breaches: Array<[string, string]> = [
    ['Eat at an 800 kcal deficit today.', 'deficit_over_600'],
    ['Run a deficit of 700 kcal.', 'deficit_over_600'],
    ['Hold a 500-700 kcal deficit.', 'deficit_over_600'],
    ['Work up to 85% of 1RM.', 'over_80_percent_1rm'],
    ['Stay under 90% 1RM.', 'over_80_percent_1rm'],
    ['Three sets at RIR 1-2.', 'rir_below_3'],
    ['Three sets at RIR 1-3.', 'rir_below_3'],
    ['Leave 2 reps in reserve.', 'rir_below_3'],
    ['Stop 1 rep short of failure.', 'rir_below_3'],
    ['Last set to failure.', 'to_failure'],
    ['Keep going until failure.', 'to_failure'],
    ['Finish with an AMRAP set.', 'to_failure'],
    ['Do a 1RM test on the squat.', 'max_test'],
    ['Test your 1RM.', 'max_test'],
    ['Test your max on the bench.', 'max_test'],
    ['Max out on the deadlift.', 'max_test'],
    ['Work up to a max single.', 'max_test'],
    ['Find your true max.', 'max_test'],
  ];
  it.each(breaches)('refuses "%s" (%s)', (text, rule) => {
    expect(textSafetyHits(text, 1).map((hit) => hit.rule)).toContain(rule);
    const why = reason(checkWeekAnswer(withText(text), input));
    expect(why).toMatch(/^SAFETY: Day 1 step "Back squat block 1" says/);
    expect(why).toContain('The limit is');
  });
});

describe('safety scan: week 4 and later', () => {
  const week4 = { ...input, weekNumber: 4 };
  it.each(['Three sets at RIR 1.', 'Last set to failure.', 'Work up to 85% of 1RM.'])('allows "%s"', (text) => {
    expect(reason(checkWeekAnswer(withText(text), week4))).toBe('');
  });
  it('still refuses an 800 kcal deficit', () => {
    expect(reason(checkWeekAnswer(withText('Eat at an 800 kcal deficit today.'), week4))).toMatch(/250 to 600 kcal/);
  });
});

describe('safety scan: which steps are checked', () => {
  const custom: WeekCallInput = { ...input, highLoadGoal: false };
  it('passes "to failure" on a custom goal step not flagged highLoad', () => {
    expect(reason(checkWeekAnswer(week({ instructions: `${PREFIX}Push-ups to failure.`, highLoad: false }), custom))).toBe('');
  });
  it('refuses the same step flagged highLoad', () => {
    expect(reason(checkWeekAnswer(week({ instructions: `${PREFIX}Push-ups to failure.`, highLoad: true }), custom))).toMatch(/^SAFETY/);
  });
  it('checks the 10-minute version and the test step', () => {
    const answer = week();
    const day2 = (answer.days as Array<Record<string, unknown>>)[1];
    day2.minimumVersion = step('Goblet squats to failure', 1, 10);
    expect(reason(checkWeekAnswer(answer, input))).toMatch(/Day 2 10-minute version "Goblet squats to failure"/);
    const testDay = (week().days as Array<Record<string, unknown>>);
    (testDay[5].steps as Array<Record<string, unknown>>)[1].instructions = `${PREFIX}Test your 1RM squat.`;
    expect(reason(checkWeekAnswer({ days: testDay }, input))).toMatch(/Day 6 step "Weekly test/);
  });
  it('is a hard reason: the last attempt still refuses', () => {
    expect(reason(checkWeekAnswer(withText('Last set to failure.'), input, true))).toMatch(/^SAFETY/);
  });
});

describe('safety limits in the week prompt', () => {
  // B-39: the optional due-date line came after these fixtures.
  const DUE_DATE_LINE = "  - dueDate (optional, YYYY-MM-DD): only when an outside deadline sets the step's date, such as an application or entry due that day";
  const HIGH_LOAD_LINE =
    '  - highLoad: true when the step puts real physical strain on the body (running, lifting, high-intensity or impact work); otherwise false';
  const layout = weekLayout('steady', input.weekStart);
  const OVERRIDE = "In weeks 1 to 3 this overrides the method's RIR range: at least 3 reps in reserve.";

  it('leaves the prompt unchanged without a high-load goal', () => {
    const before = readFileSync(new URL('./fixtures/weekPrompt.before-m2.1.txt', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const typing: WeekCallInput = {
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
      weekStart: new Date('2026-09-21T12:00:00Z'),
      highLoadGoal: false,
    };
    const prompt = buildWeekPrompt(typing, layout);
    expect(prompt).not.toContain('SAFETY LIMITS');
    expect(prompt.split('\n').filter((line) => line !== HIGH_LOAD_LINE && line !== DUE_DATE_LINE).join('\n')).toBe(before);
  });

  it('tells the real recomp week 1 the limits and the override, next to the method\'s own range', () => {
    const recomp: WeekCallInput = {
      ...input,
      method: { name: presetMethod(recompPreset).name, creator: '', rules: [...recompPreset.capabilities] },
    };
    const prompt = buildWeekPrompt(recomp, layout);
    expect(prompt).toContain('RIR 1–3');
    expect(prompt).toContain('SAFETY LIMITS');
    expect(prompt).toContain('Calorie deficit: 250 to 600 kcal a day, never more.');
    expect(prompt).toContain('At most 2 hard runs this week');
    // M2.2a review: the load goal's block (week 1 has no base week).
    expect(prompt).toContain('- Running: there is no last week to count from; keep it at their level.');
    expect(prompt).toContain('- Daily intake: never below 1200 kcal a day.');
    expect(prompt).toContain(OVERRIDE);
    const week4 = buildWeekPrompt({ ...recomp, weekNumber: 4 }, layout);
    expect(week4).toContain('SAFETY LIMITS');
    expect(week4).not.toContain(OVERRIDE);
    expect(week4).not.toContain('Weeks 1 to 3');
  });
});

describe('[Safety] log line', () => {
  it('is written once per hit with the goal, week, attempt, rule, step, sentence and outcome', () => {
    checkWeekAnswer(withText('Warm up well. Last set to failure. Then stretch.'), { ...input, goalId: 'goal-1' });
    expect(safetyLines()).toEqual([
      {
        goalId: 'goal-1',
        week: 1,
        attempt: 1,
        rule: 'to_failure',
        step: 'Day 1 step "Back squat block 1"',
        matched: 'Last set to failure.',
        outcome: 'retry',
      },
    ]);
  });

  it('logs null without a goal id, clips the sentence, and says failed on the last attempt', () => {
    checkWeekAnswer(withText(`Last set to failure ${'and keep pushing '.repeat(10)}`), input, true);
    const [line] = safetyLines();
    expect(line.goalId).toBeNull();
    expect(line.attempt).toBe(2);
    expect(line.outcome).toBe('failed');
    expect((line.matched as string).length).toBeLessThanOrEqual(120);
  });

  it('fails the week when the second answer still breaks a limit', async () => {
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: withText('Last set to failure.') } as never);
    expect(await generateWeekPlan(input)).toBeNull();
    expect(safetyLines().map((line) => line.outcome)).toEqual(['retry', 'failed']);
  });

  it('accepts the retry when the second answer is safe', async () => {
    vi.mocked(generateStructuredContent)
      .mockResolvedValueOnce({ success: true, data: withText('Last set to failure.') } as never)
      .mockResolvedValueOnce({ success: true, data: withText('Stop 3 reps before failure.') } as never);
    expect(await generateWeekPlan(input)).not.toBeNull();
  });
});

describe('safety scan: review fixes', () => {
  const rules = (text: string, weekNumber = 1) => textSafetyHits(text, weekNumber).map((hit) => hit.rule);

  it('counts failure after an unrelated negation in another clause, or next to a safe clause', () => {
    expect(rules('Do 3 sets with no rest between them, last set to failure.')).toEqual(['to_failure']);
    expect(rules('Rest 90 seconds, not more, and push the final set to failure.')).toEqual(['to_failure']);
    expect(rules('Take the last set to failure, and stop 3 reps before failure on the others.')).toEqual(['to_failure']);
    expect(rules('Never let any set go to failure.')).toEqual([]);
  });

  it('reads a max heart rate, pace or WPM as no max test, and a max lift as one', () => {
    expect(rules('Test your max heart rate with a 3-minute hill effort.')).toEqual([]);
    expect(rules('Test your max WPM on a 1-minute passage.')).toEqual([]);
    expect(rules('Test your max squat.')).toEqual(['max_test']);
  });

  it('reads a hyphenated deficit and "Deficit: 750 kcal"', () => {
    expect(rules('Hold an 800-calorie deficit today.')).toEqual(['deficit_over_600']);
    expect(rules('Deficit: 750 kcal.')).toEqual(['deficit_over_600']);
    expect(rules('Deficit: 400 kcal.')).toEqual([]);
  });

  it('does not read a week or set number as reps in reserve', () => {
    expect(rules('Week 1 RIR target: 3 on every set.')).toEqual([]);
    expect(rules('Set 2 RIR 3.')).toEqual([]);
    expect(rules('Bench at 2 RIR on the top set.')).toEqual(['rir_below_3']);
  });
});

describe('weeks 1 to 3 for someone who already lifts (PSL-20)', () => {
  const recompOption = (start: string) => recompPreset.diagnosticQuestions[0].options.find((option) => option.startsWith(start))!;
  const lifter: WeekCallInput = { ...input, answers: [{ id: 'baseline', question: 'Experience?', answer: recompOption('Overfat / Intermediate Lifter') }] };

  it('reads experience from the answers, a beginner or a lapsed lifter never counting', () => {
    expect(isExperiencedLifter([{ answer: recompOption('Overfat / Intermediate Lifter') }])).toBe(true);
    expect(isExperiencedLifter([{ answer: recompOption('Athletic Cut / Advanced') }])).toBe(true);
    expect(isExperiencedLifter([{ answer: recompOption('Beginner / Untrained') }])).toBe(false);
    expect(isExperiencedLifter([{ answer: recompOption('Skinny-Fat / Sedentary') }])).toBe(false);
    expect(isExperiencedLifter([{ answer: "I've been lifting for 3 years, squat 120 kg" }])).toBe(true);
    expect(isExperiencedLifter([{ answer: 'I lifted in college 10 years ago but stopped' }])).toBe(false);
    expect(isExperiencedLifter([{ answer: 'Intermediate Spanish' }])).toBe(false);
    expect(isExperiencedLifter([{ answer: '70 kg for 5' }])).toBe(false);
    expect(isExperiencedLifter([{ answer: 'I lift 4 times a week for 2 years' }, { answer: 'Beginner at deadlifts' }])).toBe(false);
    expect(isExperiencedLifter([])).toBe(false);
    // Code review: an age or a plan is not experience, and a lapse in another answer counts.
    expect(isExperiencedLifter([{ answer: "I'm 35 years old and want to start lifting weights" }])).toBe(false);
    expect(isExperiencedLifter([{ answer: 'I want to go to the gym regularly' }])).toBe(false);
    expect(isExperiencedLifter([{ answer: recompOption('Overfat / Intermediate Lifter') }, { answer: "I quit the gym 2 years ago after an injury and I'm coming back" }])).toBe(false);
    expect(isExperiencedLifter([{ answer: 'I train at the gym 4x a week for 2 years' }])).toBe(true);
    expect(isExperiencedLifter([{ answer: 'I used to skip breakfast' }, { answer: 'Lifting for 3 years' }])).toBe(true);
  });

  it('a light week (a high-load first week back) and a running goal keep every cap (code review)', () => {
    const answer = week({ instructions: PREFIX + 'Leave 2 reps in reserve on the last set.', load: { rir: 2 } });
    const back = { ...lifter, firstWeekBack: { awayDays: 10, note: null, highLoad: true } };
    expect(liftCapsRelaxed(back)).toBe(false);
    expect(reason(checkWeekAnswer(answer, back))).toContain('at least 3 reps in reserve');
    expect(liftCapsRelaxed({ ...lifter, loadGoal: { running: true } })).toBe(false);
    expect(liftCapsRelaxed(lifter)).toBe(true);
  });

  it('a step load at 2 reps in reserve or 85% of 1RM passes in week 1; failure and a max test do not', () => {
    expect(stepLoadBreaches({ rir: 2, percent1RM: 85 }, 1, { experiencedLifter: true })).toEqual([]);
    expect(stepLoadBreaches({ rir: 2, percent1RM: 85 }, 1).map((b) => b.rule)).toEqual(['over_80_percent_1rm', 'rir_below_3']);
    expect(stepLoadBreaches({ toFailure: true, maxTest: true }, 1, { experiencedLifter: true }).map((b) => b.rule)).toEqual(['to_failure', 'max_test']);
  });

  it('the text scan lets "2 reps in reserve" through for them in week 1, but not in a light week or to failure', () => {
    expect(textSafetyHits('Work up to 2 reps in reserve on every set.', 1, { experiencedLifter: true })).toEqual([]);
    expect(textSafetyHits('Work up to 2 reps in reserve on every set.', 1).map((h) => h.rule)).toEqual(['rir_below_3']);
    expect(textSafetyHits('Work up to 2 reps in reserve on every set.', 6, { experiencedLifter: true, light: true }).map((h) => h.rule)).toEqual(['rir_below_3']);
    expect(textSafetyHits('Take the last set to failure.', 1, { experiencedLifter: true }).map((h) => h.rule)).toEqual(['to_failure']);
  });

  it('a whole week 1 at 2 reps in reserve is accepted for them and refused for a beginner', () => {
    const answer = week({ instructions: PREFIX + 'Leave 2 reps in reserve on the last set.', load: { rir: 2 } });
    expect('value' in checkWeekAnswer(answer, lifter)).toBe(true);
    expect(reason(checkWeekAnswer(answer, input))).toContain('reps in reserve');
  });

  it('the prompt tells them the method sets their loads, without the 3-reps-in-reserve override', () => {
    const prompt = buildWeekPrompt(lifter, weekLayout('steady', input.weekStart));
    expect(prompt).toContain('- Weeks 1 to 3: nothing to failure, no max or 1RM test; loads and reps in reserve follow the method (they already lift).');
    expect(prompt).not.toContain('at least 3 reps in reserve');
  });
});
