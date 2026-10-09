import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { readFileSync } from 'node:fs';
import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import {
  WEEK_RESPONSE_SCHEMA,
  buildWeekPrompt,
  checkWeekAnswer,
  generateWeekPlan,
  resolveKind,
  weekLayout,
  weekResponseSchema,
  type RawWeekAnswer,
  type WeekCallInput,
} from '../src/lib/ai/weekPlan.js';
import { RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';

// Method-aware recovery M2.1: with a profile, every practice-day step carries one of its kind ids, or the week is not
// saved (RULE-6, MR-5, MR-16); code sets the test step's and the 10-minute version's kind (RULE-7, MR-15). Without a
// profile, the week call is exactly as before.

const general = RECOVERY_TEMPLATES.general;
const IDS = general.kinds.map((kind) => kind.id);

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
const withProfile: WeekCallInput = { ...input, recovery: general };

function step(title: string, priority: number, minutes = 10, kind: unknown = 'practice_session') {
  return {
    title,
    instructions: `Do ${title.toLowerCase()} for the full time, eyes on the screen and fingers on the home row.`,
    minutes,
    output: 'Your speed and accuracy numbers',
    doneWhen: '95% accuracy or better',
    focusCue: 'Eyes up',
    pitfall: 'Looking down',
    priority,
    highLoad: false,
    ...(kind === undefined ? {} : { kind }),
  };
}

/** Steady: days 1-3 and 5-6 practice, 4 and 7 rest, day 6 the test. Every step tagged practice_session. */
function week(overrides: (days: Array<Record<string, any>>) => void = () => {}): RawWeekAnswer {
  const days: Array<Record<string, any>> = Array.from({ length: 7 }, (_, index) => {
    const dayNumber = index + 1;
    if (dayNumber === 4 || dayNumber === 7) {
      return { dayNumber, isKeySession: false, title: 'Easy home row pass', whyToday: 'Keeps the keys fresh.', steps: [step('Slow home row pass', 1, 12)] };
    }
    const steps =
      dayNumber === 6
        ? [step('Warm up on home row words', 2, 5), step('Weekly test: 1-minute typing test', 1, 15), step('Compare your result with 16 wpm', 3, 10)]
        : [step(`Drill ${dayNumber} letters`, 1, 15), step(`Type sentence set ${dayNumber}`, 2, 15, 'project_work')];
    return {
      dayNumber,
      isKeySession: dayNumber === 3,
      title: `Type set ${dayNumber} at 95% accuracy`,
      whyToday: 'Builds accuracy toward 16 wpm.',
      steps,
      minimumVersion: { ...step(`Two minutes per row, set ${dayNumber}`, 1, 10, 'review_or_reflection') },
    };
  });
  overrides(days);
  return { days };
}

const value = (result: ReturnType<typeof checkWeekAnswer>) => {
  if (!('value' in result)) throw new Error(result.reason);
  return result.value;
};
const reason = (result: ReturnType<typeof checkWeekAnswer>) => ('reason' in result ? result.reason : '');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the schema (RULE-6)', () => {
  it('without a profile is WEEK_RESPONSE_SCHEMA itself', () => {
    expect(weekResponseSchema()).toBe(WEEK_RESPONSE_SCHEMA);
    expect(weekResponseSchema(null)).toBe(WEEK_RESPONSE_SCHEMA);
  });

  it("with a profile requires kind on every step, a fixed menu of the profile's ids, and leaves the constant alone", () => {
    const stepSchema = weekResponseSchema(general).properties.days.items.properties.steps.items as any;
    expect(stepSchema.properties.kind).toEqual({ type: 'string', enum: IDS });
    expect(stepSchema.required).toContain('kind');
    expect(IDS).toEqual(expect.arrayContaining(['weekly_test', 'fixed_time_session']));
    const constant = WEEK_RESPONSE_SCHEMA.properties.days.items.properties.steps.items as any;
    expect(constant.properties.kind).toBeUndefined();
    expect(constant.required).not.toContain('kind');
  });

  it('generateWeekPlan sends the profile schema, and the plain one without a profile', async () => {
    const mocked = vi.mocked(generateStructuredContent);
    mocked.mockResolvedValue({ success: true, data: week() } as never);
    await generateWeekPlan(withProfile);
    expect((mocked.mock.calls[0][3] as any).responseSchema.properties.days.items.properties.steps.items.properties.kind.enum).toEqual(IDS);
    mocked.mockClear();
    await generateWeekPlan(input);
    expect((mocked.mock.calls[0][3] as any).responseSchema).toBe(WEEK_RESPONSE_SCHEMA);
  });
});

describe('the prompt (RULE-6, RULE-8, MR-20)', () => {
  const layout = weekLayout('steady', input.weekStart);

  it('without a profile is exactly as before', () => {
    expect(buildWeekPrompt({ ...input, recovery: null }, layout)).toBe(buildWeekPrompt(input, layout));
    expect(buildWeekPrompt(input, layout)).not.toMatch(/KINDS OF STEP|kind:/);
  });

  it('with a profile matches its fixture: each kind, the warm-up and one-step rules, never the actions', () => {
    const fixture = readFileSync(new URL('./fixtures/weekPrompt.with-profile.txt', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const prompt = buildWeekPrompt(withProfile, layout);
    expect(prompt).toBe(fixture);
    for (const kind of general.kinds) expect(prompt).toContain(`- ${kind.id}: ${kind.name}. ${kind.description}`);
    expect(prompt).toContain('- A step whose kind is practice_session or catch_all starts with its own short warm-up');
    expect(prompt).toContain('such as a game and its review, is written as one step');
    expect(prompt).not.toMatch(/let_go|let go|\baction\b/);
  });
});

describe('every step keeps a kind (RULE-6)', () => {
  it('keeps an exact id and maps an exact name, case-insensitively, to its id', () => {
    expect(resolveKind('practice_session', general)).toBe('practice_session');
    expect(resolveKind('PRACTICE SESSION', general)).toBe('practice_session');
    expect(resolveKind(' Project work ', general)).toBe('project_work');
    expect(resolveKind('Practice', general)).toBeNull();
    expect(resolveKind(undefined, general)).toBeNull();

    const answer = week((days) => {
      days[0].steps[1].kind = 'Project Work';
    });
    const day1 = value(checkWeekAnswer(answer, withProfile))[0];
    expect(day1.detailedSteps.map((s) => s.kind)).toEqual(['practice_session', 'project_work']);
  });

  it('a missing or unknown kind is a reason naming the day, the step and the allowed ids', () => {
    const missing = week((days) => {
      delete days[1].steps[0].kind;
    });
    expect(reason(checkWeekAnswer(missing, withProfile))).toBe(
      `Day 2 step "Drill 2 letters" has no kind; use one of: ${IDS.join(', ')}.`
    );
    const unknown = week((days) => {
      days[4].steps[1].kind = 'cardio';
    });
    expect(reason(checkWeekAnswer(unknown, withProfile))).toMatch(/^Day 5 step "Type sentence set 5" has kind "cardio"; use one of: practice_session, /);
  });

  it('is a hard reason: it does not give way on the last attempt', () => {
    const missing = week((days) => {
      delete days[2].steps[1].kind;
    });
    expect(reason(checkWeekAnswer(missing, withProfile, true))).toMatch(/Day 3 step "Type sentence set 3" has no kind/);
  });

  it('two failed answers mean no week', async () => {
    const mocked = vi.mocked(generateStructuredContent);
    const bad = week((days) => {
      days[0].steps[0].kind = 'cardio';
    });
    mocked.mockResolvedValue({ success: true, data: bad } as never);
    expect(await generateWeekPlan(withProfile)).toBeNull();
    expect(mocked).toHaveBeenCalledTimes(2);
    expect(mocked.mock.calls[1][0]).toMatch(/YOUR PREVIOUS ANSWER WAS REJECTED: Day 1 step "Drill 1 letters" has kind "cardio"/);
  });

  it('rest-day steps carry no kind, and an odd one there is never a reason', () => {
    const answer = week((days) => {
      days[3].steps[0].kind = 'cardio';
    });
    const days = value(checkWeekAnswer(answer, withProfile));
    expect(days[3].detailedSteps[0]).not.toHaveProperty('kind');
    expect(days[6].detailedSteps[0]).not.toHaveProperty('kind');
  });

  it('without a profile no step gets a kind and none is checked', () => {
    const answer = week((days) => {
      days[0].steps[0].kind = 'cardio';
      delete days[1].steps[0].kind;
    });
    const days = value(checkWeekAnswer(answer, input));
    for (const day of days) for (const s of day.detailedSteps) expect(s).not.toHaveProperty('kind');
    for (const day of days) if (day.minimumVersion) expect(day.minimumVersion).not.toHaveProperty('kind');
  });
});

describe('what code sets itself (RULE-7, MR-15)', () => {
  it('the test step is weekly_test whatever the model tagged', () => {
    const answer = week((days) => {
      days[5].steps[1].kind = 'project_work';
    });
    const test = value(checkWeekAnswer(answer, withProfile))[5].detailedSteps.find((s) => s.title.startsWith('Weekly test'))!;
    expect(test.kind).toBe('weekly_test');

    const untagged = week((days) => {
      delete days[5].steps[1].kind;
    });
    expect(value(checkWeekAnswer(untagged, withProfile))[5].detailedSteps.find((s) => s.title.startsWith('Weekly test'))!.kind).toBe('weekly_test');
  });

  it('a test step code adds on the last attempt is weekly_test', () => {
    const noTest = week((days) => {
      days[5].steps = [step('Drill six letters', 1, 15), step('Type sentence set six', 2, 15, 'project_work')];
    });
    const added = value(checkWeekAnswer(noTest, withProfile, true))[5].detailedSteps.find((s) => s.title.startsWith('Weekly test'))!;
    expect(added.kind).toBe('weekly_test');
  });

  it("the 10-minute version takes the kind of the day's priority-1 step", () => {
    const answer = week((days) => {
      days[0].steps = [step('Type a paragraph', 2, 15, 'practice_session'), step('Write a short story', 1, 15, 'project_work')];
    });
    const days = value(checkWeekAnswer(answer, withProfile));
    expect(days[0].minimumVersion!.kind).toBe('project_work');
    expect(days[1].minimumVersion!.kind).toBe('practice_session');
    // On the test day the test step leads.
    expect(days[5].minimumVersion!.kind).toBe('weekly_test');

    const derived = week((days) => {
      delete days[2].minimumVersion;
    });
    expect(value(checkWeekAnswer(derived, withProfile, true))[2].minimumVersion!.kind).toBe('practice_session');
  });
});

describe('high load with and without a profile (RULE-7)', () => {
  const answer = () =>
    week((days) => {
      days[0].steps = [{ ...step('Run 3 km easy', 1, 15), highLoad: true }, { ...step('Stretch hamstrings', 2, 15), highLoad: false }];
    });

  it('with a profile the goal-level marking is skipped and the per-step flag stays', () => {
    const days = value(checkWeekAnswer(answer(), { ...withProfile, highLoadGoal: true }));
    expect(days[0].detailedSteps.map((s) => s.highLoad)).toEqual([true, false]);
    expect(days[1].detailedSteps.every((s) => s.highLoad === false)).toBe(true);
    expect(days[1].minimumVersion!.highLoad).toBe(false);
  });

  it('without a profile a physical preset goal still marks every practice step', () => {
    const days = value(checkWeekAnswer(answer(), { ...input, highLoadGoal: true }));
    for (const day of days.filter((d) => !d.isRestDay)) {
      expect(day.detailedSteps.every((s) => s.highLoad === true)).toBe(true);
      expect(day.minimumVersion!.highLoad).toBe(true);
    }
  });
});
