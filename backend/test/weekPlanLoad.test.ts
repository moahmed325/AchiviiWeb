import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  loadLine,
  weekLayout,
  weekResponseSchema,
  type RawWeekAnswer,
  type WeekCallInput,
} from '../src/lib/ai/weekPlan.js';
import { fitStepMinutes } from '../src/lib/ai/scheduleRepair.js';
import { describeDay } from '../src/lib/recovery/dayText.js';
import { PATHWAY_PROFILES } from '../src/lib/recovery/pathways.js';
import { RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';
import { templateProfile } from '../src/lib/recovery/templates.js';
import { polishDays } from '../src/lib/ai/taskRules.js';
import { CARDIO_KIND, LIFT_KIND, RUN_KINDS, loadGoalFor, parseStepLoad, withMinutes } from '../src/lib/safety/stepLoad.js';
import type { DetailedStep } from '../src/lib/ai/goalDecomposer.js';
import { RUN10K_WEEK1 } from './run10kWeekInput.js';

// Plan safety limits M2.1 (RULE-4, PSL-4, PSL-8, AC-4): high-load steps carry their load as numbers.

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const RUN10K: WeekCallInput = { ...RUN10K_WEEK1, loadGoal: { running: true } };

/** A run10k-shaped step; `kind` and `load` as given. */
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

const easyLoad = { runMinutes: 30, hardRun: false };
const minimum = (dayNumber: number, extra: Record<string, unknown> = {}) => ({
  ...step(`Short easy run ${dayNumber}`, 1, 10),
  load: { runMinutes: 10, hardRun: false },
  ...extra,
});

/** Steady: days 1-3 and 5-6 practice, 4 and 7 rest, day 6 the test. Every step PSL-8 names has its load. */
function runWeek(change: (days: Array<Record<string, any>>) => void = () => {}): RawWeekAnswer {
  const days: Array<Record<string, any>> = Array.from({ length: 7 }, (_, index) => {
    const dayNumber = index + 1;
    if (dayNumber === 4 || dayNumber === 7) return { dayNumber, isKeySession: false, title: 'Rest and recover', whyToday: 'Recovery.', steps: [] };
    const steps =
      dayNumber === 6
        ? [
            step('Jog gently before the test', 2, 5, { kind: 'weekly_test' }),
            step('Weekly test: long run at an easy pace', 1, 30, { kind: 'weekly_test', highLoad: true, load: { runKm: 6, hardRun: false } }),
            step('Note how the run felt', 3, 5, { kind: 'weekly_test' }),
          ]
        : [
            step(`Easy run ${dayNumber}`, 1, 30, { kind: 'easy_session', highLoad: true, load: easyLoad }),
            step(`Calf and hip circuit ${dayNumber}`, 2, 10, { kind: 'strength_and_mobility' }),
          ];
    return { dayNumber, isKeySession: dayNumber === 2, title: `Run day ${dayNumber}`, whyToday: 'Builds easy running time.', steps, minimumVersion: minimum(dayNumber) };
  });
  change(days);
  return { days };
}

const value = (result: ReturnType<typeof checkWeekAnswer>) => {
  if (!('value' in result)) throw new Error(result.reason);
  return result.value;
};
const reason = (result: ReturnType<typeof checkWeekAnswer>) => ('reason' in result ? result.reason : '');

let warn: ReturnType<typeof vi.spyOn>;
const safetyLines = () =>
  warn.mock.calls.filter((call) => call[0] === '[Safety]').map((call) => JSON.parse(call[1] as string) as Record<string, unknown>);

beforeEach(() => {
  vi.clearAllMocks();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('parseStepLoad', () => {
  it('keeps every field of the right type', () => {
    const load = { runMinutes: 30, runKm: 5.5, hardRun: true, kcalDeficit: 400, kcalIntake: 2000, percent1RM: 70, rir: 3, toFailure: false, maxTest: false };
    expect(parseStepLoad(load)).toEqual(load);
    expect(parseStepLoad({ runMinutes: 0, percent1RM: 100 })).toEqual({ runMinutes: 0, percent1RM: 100 });
  });

  it('drops a bad value and keeps the rest', () => {
    expect(
      parseStepLoad({ runMinutes: -5, runKm: '5', hardRun: 'yes', percent1RM: 101, rir: Number.NaN, kcalDeficit: Infinity, toFailure: 1, maxTest: true, other: 3 })
    ).toEqual({ maxTest: true });
  });

  it('counts a load with no field left as missing', () => {
    expect(parseStepLoad({ runMinutes: -1, hardRun: 'no' })).toBeUndefined();
    expect(parseStepLoad({})).toBeUndefined();
    expect(parseStepLoad(null)).toBeUndefined();
    expect(parseStepLoad([30])).toBeUndefined();
    expect(parseStepLoad('30 minutes')).toBeUndefined();
  });

  it('reaches the stored step through the week parse, with bad fields dropped', () => {
    const answer = runWeek((days) => {
      days[0].steps[0].load = { runMinutes: 30, hardRun: false, runKm: -2 };
    });
    const day1 = value(checkWeekAnswer(answer, RUN10K))[0];
    expect(day1.detailedSteps[0].load).toEqual({ runMinutes: 30, hardRun: false });
    expect(day1.detailedSteps[1].load).toBeUndefined();
    expect(day1.minimumVersion?.load).toEqual({ runMinutes: 10, hardRun: false });
  });

  it('is not read on a goal that is not a load goal', () => {
    const day1 = value(checkWeekAnswer(runWeek(), RUN10K_WEEK1))[0];
    expect(day1.detailedSteps[0].load).toBeUndefined();
    expect(day1.minimumVersion?.load).toBeUndefined();
  });
});

describe('which goals are asked for load', () => {
  const typing = { rawGoal: 'Type 40 words per minute', clarifiedOutcome: 'Type 40 wpm at 95% accuracy' };
  const wpm = { kind: 'number', metric: 'Typing speed', value: 20, unit: 'wpm', direction: 'higher_is_better' } as const;

  it('a run10k goal is a running load goal, whatever its target', () => {
    const run10k = { rawGoal: 'Run a 10K under 50 minutes', clarifiedOutcome: 'Finish a 10 km race in under 50:00' };
    expect(loadGoalFor(run10k, { kind: 'number', metric: 'Pace', value: 5, unit: 'min/km', direction: 'lower_is_better' })).toEqual({ running: true });
    expect(loadGoalFor(run10k, { kind: 'milestone', description: 'Run three times' } as never)).toEqual({ running: true });
  });

  it('a custom goal with a running-distance target is a running load goal', () => {
    const custom = { rawGoal: 'Run my first half marathon', clarifiedOutcome: 'Run 21 km without stopping' };
    expect(loadGoalFor(custom, { kind: 'number', metric: 'Long run distance', value: 8, unit: 'km', direction: 'higher_is_better' })).toEqual({ running: true });
  });

  it('a custom goal with a body-weight target is a load goal, not a running one', () => {
    const custom = { rawGoal: 'Get down to 80 kg', clarifiedOutcome: 'Weigh 80 kg' };
    expect(loadGoalFor(custom, { kind: 'number', metric: 'Body weight', value: 88, unit: 'kg', direction: 'lower_is_better' })).toEqual({ running: false });
  });

  it('a typing goal, and a cycling goal with no family, are not load goals', () => {
    expect(loadGoalFor(typing, wpm)).toBeUndefined();
    const cycling = { rawGoal: 'Ride a 100 km sportive', clarifiedOutcome: 'Ride 100 km in one day' };
    expect(loadGoalFor(cycling, { kind: 'number', metric: 'Ride distance', value: 40, unit: 'km', direction: 'higher_is_better' })).toBeUndefined();
  });
});

describe('the schema and the prompt', () => {
  it('is the same object for a goal with no profile and no load', () => {
    expect(weekResponseSchema(undefined)).toBe(WEEK_RESPONSE_SCHEMA);
    expect(weekResponseSchema(null, undefined)).toBe(WEEK_RESPONSE_SCHEMA);
  });

  it('adds no load with a profile alone', () => {
    const schema = weekResponseSchema(RECOVERY_TEMPLATES.general);
    expect(JSON.stringify(schema)).not.toContain('"load"');
  });

  it('gives the step and the 10-minute version an optional load on a load goal', () => {
    const schema = weekResponseSchema(PATHWAY_PROFILES.run10k, { running: true });
    const day = schema.properties.days.items.properties;
    const stepItems = day.steps.items as { properties: Record<string, any>; required: string[] };
    const minimumVersion = day.minimumVersion as { properties: Record<string, any>; required: string[] };
    for (const item of [stepItems, minimumVersion]) {
      expect(Object.keys(item.properties.load.properties)).toEqual([
        'runMinutes', 'runKm', 'hardRun', 'kcalDeficit', 'kcalIntake', 'percent1RM', 'rir', 'toFailure', 'maxTest',
      ]);
      expect(item.required).not.toContain('load');
    }
    expect(stepItems.required).toContain('kind');
    // The shared schema is never changed.
    expect(JSON.stringify(WEEK_RESPONSE_SCHEMA)).not.toContain('"load"');
  });

  it('a run10k week 1 prompt differs from main only by the load line (and, since M2.2a, the SAFETY LIMITS lines)', () => {
    const prompt = buildWeekPrompt(RUN10K, weekLayout('steady', RUN10K.weekStart));
    expect(prompt).toBe(fixture('weekPrompt.run10k-m2.2a.txt'));
    // Plan safety limits M2.2a: the M2.1 prompt with the old SAFETY LIMITS block (weekLoadLimits.test.ts checks the new one).
    const block = (text: string) => text.slice(text.indexOf('\n\nSAFETY LIMITS'), text.indexOf('\n\nKINDS OF STEP'));
    const m21 = prompt.replace(block(prompt), block(fixture('weekPrompt.run10k-m2.1.txt')));
    expect(m21).toBe(fixture('weekPrompt.run10k-m2.1.txt'));
    const added = loadLine({ running: true });
    expect(m21.split(added)).toHaveLength(2);
    expect(m21.replace(`\n${added}`, '')).toBe(fixture('weekPrompt.run10k-before-m2.1.txt'));
    // It follows the kind line.
    expect(prompt).toContain(`from KINDS OF STEP below\n${added}`);
  });

  it('the run10k prompt without a load goal is exactly main', () => {
    expect(buildWeekPrompt(RUN10K_WEEK1, weekLayout('steady', RUN10K_WEEK1.weekStart))).toBe(fixture('weekPrompt.run10k-before-m2.1.txt'));
  });

  it('names the test step only on a running goal', () => {
    expect(loadLine({ running: true })).toContain('the weekly test step');
    expect(loadLine({ running: false })).not.toContain('weekly test');
    const noProfile = buildWeekPrompt({ ...RUN10K, recovery: null }, weekLayout('steady', RUN10K.weekStart));
    expect(noProfile).toContain(`otherwise false\n${loadLine({ running: true })}`);
  });

  it('sends the load schema with the week call', async () => {
    vi.mocked(generateStructuredContent).mockResolvedValueOnce({ success: true, data: runWeek() } as never);
    expect(await generateWeekPlan(RUN10K)).not.toBeNull();
    const options = vi.mocked(generateStructuredContent).mock.calls[0][3] as { responseSchema: unknown };
    expect(options.responseSchema).toEqual(weekResponseSchema(PATHWAY_PROFILES.run10k, { running: true }));
  });
});

/** M2.1 review (option A): a custom "lose weight" goal gets the strength template; its runs are `conditioning`. */
const STRENGTH = templateProfile('strength');
const toStrengthKinds = (days: Array<Record<string, any>>) => {
  const kinds: Record<string, string> = { easy_session: 'conditioning', strength_and_mobility: 'mobility' };
  for (const day of days) day.steps = day.steps.map((item: Record<string, any>) => ({ ...item, kind: kinds[item.kind] ?? item.kind }));
};

describe('the kind ids the load rules name', () => {
  it('every one exists in a recovery template', () => {
    const ids = new Set(Object.values(RECOVERY_TEMPLATES).flatMap((template) => template.kinds.map((item) => item.id)));
    for (const id of [...RUN_KINDS, LIFT_KIND, CARDIO_KIND]) expect(ids, id).toContain(id);
    expect(RECOVERY_TEMPLATES.strength.kinds.map((item) => item.id)).toEqual(expect.arrayContaining([LIFT_KIND, CARDIO_KIND]));
  });
});

describe('a missing load is a retry reason (PSL-8)', () => {
  it('a run10k long_session step without load', () => {
    const answer = runWeek((days) => {
      days[1].steps[0] = step('Long steady run', 1, 30, { kind: 'long_session' });
    });
    expect(reason(checkWeekAnswer(answer, RUN10K))).toContain('Day 2 step "Long steady run" needs its load: runMinutes or runKm, and hardRun.');
  });

  it('a run step with minutes but no hardRun', () => {
    const answer = runWeek((days) => {
      days[0].steps[0].load = { runMinutes: 30 };
    });
    expect(reason(checkWeekAnswer(answer, RUN10K))).toContain('Day 1 step "Easy run 1" needs its load: runMinutes or runKm, and hardRun.');
  });

  it('a recomp strength_workout step without rir or percent1RM', () => {
    const recomp: WeekCallInput = { ...RUN10K, recovery: PATHWAY_PROFILES.body_recomposition_90day, loadGoal: { running: false } };
    const answer = runWeek((days) => {
      for (const day of days) {
        if (!day.steps.length) continue;
        day.steps = day.steps.map((item: Record<string, unknown>) => (item.kind === 'weekly_test' ? item : { ...item, kind: 'mobility', highLoad: false }));
      }
      days[0].steps[0] = step('Workout A: squat, press, row', 1, 30, { kind: 'strength_workout', highLoad: true, load: { kcalDeficit: 400 } });
      days[1].steps[0] = step('Workout B: deadlift, bench, pull-up', 1, 30, { kind: 'strength_workout', highLoad: true, load: { rir: 3 } });
    });
    const text = reason(checkWeekAnswer(answer, recomp));
    expect(text).toContain('Day 1 step "Workout A: squat, press, row" needs its load: rir or percent1RM.');
    expect(text).not.toContain('Workout B');
    // Not a running goal: the test step needs a load only because the model flagged it, and it has one.
    expect(text).not.toContain('Weekly test');
  });

  it('a step flagged highLoad on a custom running goal with no profile', () => {
    const custom: WeekCallInput = { ...RUN10K, recovery: null, highLoadGoal: false };
    const answer = runWeek((days) => {
      days[2].steps[1] = step('Hill strides', 2, 10, { highLoad: true });
    });
    expect(reason(checkWeekAnswer(answer, custom))).toContain('Day 3 step "Hill strides" needs its load: the numbers that apply.');
  });

  it("the model's test step on a running goal, whatever its flag", () => {
    const answer = runWeek((days) => {
      days[5].steps[1] = step('Weekly test: long run at an easy pace', 1, 30, { kind: 'weekly_test', highLoad: false });
    });
    expect(reason(checkWeekAnswer(answer, RUN10K))).toContain('Day 6 step "Weekly test: long run at an easy pace" needs its load: runMinutes or runKm, and hardRun.');
  });

  it('a custom body-weight goal on the strength template: its run (conditioning) and lift steps are both asked', () => {
    const custom: WeekCallInput = { ...RUN10K, highLoadGoal: false, recovery: STRENGTH, loadGoal: { running: false } };
    const answer = runWeek((days) => {
      toStrengthKinds(days);
      days[0].steps[0] = step('Brisk easy jog', 1, 30, { kind: 'conditioning' });
      days[1].steps[0] = step('Full-body strength session', 1, 30, { kind: 'strength_workout' });
      days[2].steps[1] = step("Plan tomorrow's meals and protein", 2, 10, { kind: 'nutrition_and_tracking' });
    });
    const text = reason(checkWeekAnswer(answer, custom));
    expect(text).toContain('Day 1 step "Brisk easy jog" needs its load: the numbers that apply.');
    expect(text).toContain('Day 2 step "Full-body strength session" needs its load: rir or percent1RM.');
    expect(text).not.toContain('meals');
    // The lift day's 10-minute version follows its lead; the other conditioning steps carry a run load with hardRun.
    expect(text).toContain('Day 2 10-minute version "Short easy run 2" needs its load: rir or percent1RM.');
    expect(text.match(/needs its load/g)).toHaveLength(3);
  });

  it('a load that names running needs hardRun, whatever the step needs', () => {
    const custom: WeekCallInput = { ...RUN10K, highLoadGoal: false, recovery: STRENGTH, loadGoal: { running: false } };
    const answer = runWeek((days) => {
      toStrengthKinds(days);
      days[0].steps[0] = step('Brisk easy jog', 1, 30, { kind: 'conditioning', load: { runMinutes: 30 } });
      // A step that needs no load, but names running in the one it gives.
      days[1].steps[1] = step('Hip mobility and strides', 2, 10, { kind: 'mobility', load: { runKm: 1 } });
      days[2].steps[0] = step('Workout A: squat, press, row', 1, 30, { kind: 'strength_workout', load: { rir: 3, runMinutes: 5 } });
    });
    const text = reason(checkWeekAnswer(answer, custom));
    expect(text).toContain('Day 1 step "Brisk easy jog" needs its load: hardRun.');
    expect(text).toContain('Day 2 step "Hip mobility and strides" needs its load: hardRun.');
    expect(text).toContain('Day 3 step "Workout A: squat, press, row" needs its load: hardRun.');
  });

  it('load misses reach the model even with 8 other soft reasons', () => {
    const answer = runWeek((days) => {
      for (const day of days) {
        if (!day.steps.length) continue;
        delete day.whyToday;
        delete day.minimumVersion;
      }
      days[0].steps[0] = step('Easy run 1', 1, 30, { kind: 'easy_session' });
    });
    const text = reason(checkWeekAnswer(answer, RUN10K));
    expect(text).toContain('has no "whyToday"');
    expect(text).toContain('Day 1 step "Easy run 1" needs its load: runMinutes or runKm, and hardRun.');
  });

  it('the 10-minute version needs a load when the priority-1 step does', () => {
    const answer = runWeek((days) => {
      days[2].minimumVersion = step('Short easy run 3', 1, 10);
    });
    expect(reason(checkWeekAnswer(answer, RUN10K))).toContain('Day 3 10-minute version "Short easy run 3" needs its load: runMinutes or runKm, and hardRun.');
  });

  it('no retry for a warm-up, a food-logging step or a non-load 10-minute version', () => {
    const answer = runWeek((days) => {
      days[0].steps = [step('Easy run 1', 1, 30, { kind: 'easy_session', load: easyLoad }), step('Plan tomorrow’s meals and protein', 2, 10, { kind: 'strength_and_mobility' })];
      // The test day's warm-up has no load and is not flagged.
      days[5].steps[0] = step('Jog gently before the test', 2, 5, { kind: 'weekly_test', highLoad: false });
      // A day whose priority-1 step needs no load: its 10-minute version needs none either.
      days[4].steps = [step('Calf and hip circuit 5', 1, 20, { kind: 'strength_and_mobility' }), step('Easy run 5', 2, 20, { kind: 'easy_session', load: easyLoad })];
      days[4].minimumVersion = step('Short calf circuit', 1, 10);
    });
    expect(value(checkWeekAnswer(answer, RUN10K))).toHaveLength(7);
  });

  it('no retry for a cycling goal on the endurance template with no family (not a load goal)', () => {
    const cycling: WeekCallInput = { ...RUN10K_WEEK1, highLoadGoal: false, recovery: RECOVERY_TEMPLATES.endurance, test: { ...RUN10K_WEEK1.test, light: false } };
    const answer = runWeek((days) => {
      for (const day of days) {
        for (const item of day.steps) delete item.load;
        if (day.minimumVersion) delete day.minimumVersion.load;
      }
    });
    expect(value(checkWeekAnswer(answer, cycling))).toHaveLength(7);
  });

  it('no retry for a code-made test step on a running goal', () => {
    const answer = runWeek((days) => {
      days[5].steps = [step('Long easy run to finish the week', 1, 30, { kind: 'weekly_test', load: easyLoad }), step('Note how the run felt', 2, 5, { kind: 'weekly_test' })];
    });
    // The missing test is a reason of its own before the last attempt; on it code puts the test step in.
    const week = value(checkWeekAnswer(answer, RUN10K, true));
    const made = week[5].detailedSteps.find((item) => item.title.startsWith('Weekly test'))!;
    expect(made.load).toBeUndefined();
    expect(safetyLines()).toEqual([]);
  });
});

describe('the last attempt keeps a step without its load (RULE-4, AC-4)', () => {
  it('keeps the week and logs load_missing once per step', () => {
    const answer = runWeek((days) => {
      days[0].steps[0] = step('Easy run 1', 1, 30, { kind: 'easy_session' });
      days[1].steps[0].load = { runMinutes: 30 };
      days[2].minimumVersion = step('Short easy run 3', 1, 10);
    });
    const week = value(checkWeekAnswer(answer, { ...RUN10K, goalId: 'g1' }, true));
    expect(week[0].detailedSteps[0].title).toBe('Easy run 1');
    expect(week[0].detailedSteps[0].load).toBeUndefined();
    expect(safetyLines()).toEqual([
      { goalId: 'g1', week: 1, attempt: 2, rule: 'load_missing', step: 'Day 1 step "Easy run 1"', matched: 'runMinutes or runKm, and hardRun', outcome: 'kept' },
      { goalId: 'g1', week: 1, attempt: 2, rule: 'load_missing', step: 'Day 2 step "Easy run 2"', matched: 'runMinutes or runKm, and hardRun', outcome: 'kept' },
      { goalId: 'g1', week: 1, attempt: 2, rule: 'load_missing', step: 'Day 3 10-minute version "Short easy run 3"', matched: 'runMinutes or runKm, and hardRun', outcome: 'kept' },
    ]);
  });

  it('finds the kept step by its place in the day: two steps share a title, only the one without load is logged', () => {
    const answer = runWeek((days) => {
      days[0].steps = [
        step('Easy run', 1, 20, { kind: 'easy_session', load: { runMinutes: 20, hardRun: false } }),
        step('Easy run', 2, 20, { kind: 'easy_session' }),
      ];
    });
    const week = value(checkWeekAnswer(answer, { ...RUN10K, goalId: 'g1' }, true));
    expect(week[0].detailedSteps.map((item) => [item.stepNumber, item.title, item.load])).toEqual([
      [1, 'Easy run', { runMinutes: 20, hardRun: false }],
      [2, 'Easy run', undefined],
    ]);
    expect(safetyLines()).toEqual([
      { goalId: 'g1', week: 1, attempt: 2, rule: 'load_missing', step: 'Day 1 step "Easy run"', matched: 'runMinutes or runKm, and hardRun', outcome: 'kept' },
    ]);
  });

  it('polishDays changes no step title or number (the log relies on it)', () => {
    // A vague day title and a missing pass mark: the two things polishDays rewrites.
    const days = value(checkWeekAnswer(runWeek(), RUN10K)).map((day) => ({
      ...day,
      title: 'Practice session',
      detailedSteps: day.detailedSteps.map((item) => ({ ...item, passMark: '' })),
    }));
    const polished = polishDays(days);
    expect(polished[0].title).toBe('Easy run 1');
    expect(polished[0].detailedSteps[0].passMark).not.toBe('');
    expect(polished.map((day) => day.detailedSteps.map((item) => [item.stepNumber, item.title]))).toEqual(
      days.map((day) => day.detailedSteps.map((item) => [item.stepNumber, item.title]))
    );
  });

  it('logs nothing before the last attempt, and nothing when the week is refused', () => {
    const answer = runWeek((days) => {
      days[0].steps[0] = step('Easy run 1', 1, 30, { kind: 'easy_session' });
    });
    expect(reason(checkWeekAnswer(answer, RUN10K))).toContain('needs its load');
    const refused = runWeek((days) => {
      days[0].steps[0] = step('Easy run 1', 1, 30, { kind: 'easy_session' });
      days[1].steps[1] = step('Mystery work', 2, 10, { kind: 'not_a_kind' });
    });
    expect(reason(checkWeekAnswer(refused, RUN10K, true))).toContain('not_a_kind');
    expect(safetyLines()).toEqual([]);
  });

  it("goes through generateWeekPlan: one retry, then the week is saved and B-63's scan still decides", async () => {
    const missing = runWeek((days) => {
      days[0].steps[0] = step('Easy run 1', 1, 30, { kind: 'easy_session' });
    });
    vi.mocked(generateStructuredContent)
      .mockResolvedValueOnce({ success: true, data: missing } as never)
      .mockResolvedValueOnce({ success: true, data: missing } as never);
    const week = await generateWeekPlan({ ...RUN10K, goalId: 'g1' });
    expect(week).not.toBeNull();
    expect(generateStructuredContent).toHaveBeenCalledTimes(2);
    expect(vi.mocked(generateStructuredContent).mock.calls[1][0]).toContain('Day 1 step "Easy run 1" needs its load');
    expect(safetyLines().map((line) => line.rule)).toEqual(['load_missing']);

    // A scan breach on the last attempt still fails the week, as before.
    vi.mocked(generateStructuredContent).mockReset();
    warn.mockClear();
    const breach = runWeek((days) => {
      days[0].steps[0] = step('Easy run 1', 1, 30, { kind: 'easy_session', instructions: 'Run easy, then hold a 700 kcal deficit today.' });
    });
    vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: breach } as never);
    expect(await generateWeekPlan({ ...RUN10K, goalId: 'g1' })).toBeNull();
    expect(safetyLines().map((line) => line.rule)).not.toContain('load_missing');
  });
});

describe('code never copies or keeps a wrong load', () => {
  it("the fallback 10-minute version carries no load", () => {
    const answer = runWeek((days) => {
      delete days[0].minimumVersion;
    });
    const day1 = value(checkWeekAnswer(answer, RUN10K, true))[0];
    expect(day1.minimumVersion?.title).toBe('Short version: Easy run 1');
    expect(day1.minimumVersion?.load).toBeUndefined();
    expect(safetyLines()).toEqual([]);
  });

  it("describeDay's 10-minute version carries no load", () => {
    const run = { ...step('Easy run', 1, 30), stepNumber: 1, durationMinutes: 30, pitfallToAvoid: 'x', priority: 1, load: { runMinutes: 30, hardRun: false } } as unknown as DetailedStep;
    const other = { ...run, title: 'Tempo run', load: { runMinutes: 25, hardRun: true } } as DetailedStep;
    const text = describeDay({ title: 'Run day' }, [run], [other]);
    expect(text?.minimumVersion.title).toBe('Short version: Tempo run');
    expect(text?.minimumVersion.load).toBeUndefined();
  });

  it("the light-week swap drops the refused step's load", () => {
    const back: WeekCallInput = { ...RUN10K, test: { ...RUN10K.test, light: false }, firstWeekBack: { awayDays: 10, highLoad: true } };
    const answer = runWeek((days) => {
      days[5].steps[1] = step('Weekly test: 5 km time trial', 1, 30, {
        kind: 'weekly_test',
        instructions: 'Run a 5 km time trial and log your time.',
        load: { runKm: 5, hardRun: true },
      });
    });
    const week = value(checkWeekAnswer(answer, back, true));
    const light = week[5].detailedSteps.find((item) => item.title === 'Weekly test: an easy version')!;
    expect(light.load).toBeUndefined();
    expect(safetyLines().map((line) => line.rule)).not.toContain('load_missing');
  });

  it('fitStepMinutes scales runMinutes, never runKm', () => {
    const steps = [
      { ...step('Easy run', 1, 0), stepNumber: 1, durationMinutes: 30, pitfallToAvoid: 'x', load: { runMinutes: 30, runKm: 5, hardRun: false } },
      { ...step('Strides', 2, 0), stepNumber: 2, durationMinutes: 30, pitfallToAvoid: 'x', load: { runKm: 1, hardRun: true } },
    ] as unknown as DetailedStep[];
    const [run, strides] = fitStepMinutes(steps, 40);
    expect(run.durationMinutes).toBe(20);
    expect(run.load).toEqual({ runMinutes: 20, runKm: 5, hardRun: false });
    expect(strides.load).toEqual({ runKm: 1, hardRun: true });
    // The model's own steps: 30 + 10 written, 40 a day, nothing to scale.
    const day1 = value(checkWeekAnswer(runWeek(), RUN10K))[0];
    expect(day1.detailedSteps[0].load).toEqual(easyLoad);
    // 45 + 15 written for a 40-minute day: 30 and 10, and the run's 45 minutes become 30.
    const scaled = value(
      checkWeekAnswer(
        runWeek((days) => {
          days[0].steps[0] = step('Easy run 1', 1, 45, { kind: 'easy_session', load: { runMinutes: 45, runKm: 7, hardRun: false } });
          days[0].steps[1].minutes = 15;
        }),
        RUN10K
      )
    )[0];
    expect(scaled.detailedSteps[0].durationMinutes).toBe(30);
    expect(scaled.detailedSteps[0].load).toEqual({ runMinutes: 30, runKm: 7, hardRun: false });
  });

  it("the 10-minute cap scales the model's runMinutes, never runKm", () => {
    const answer = runWeek((days) => {
      days[0].minimumVersion = { ...step('Short easy run 1', 1, 20), load: { runMinutes: 20, runKm: 3, hardRun: false } };
    });
    const day1 = value(checkWeekAnswer(answer, RUN10K))[0];
    expect(day1.minimumVersion?.durationMinutes).toBe(10);
    expect(day1.minimumVersion?.load).toEqual({ runMinutes: 10, runKm: 3, hardRun: false });
  });

  it('withMinutes keeps a step written with 0 minutes as written, and rounds to a whole minute', () => {
    const base = { stepNumber: 1, title: 'Run', instructions: '', focusCue: '', pitfallToAvoid: '' };
    expect(withMinutes({ ...base, durationMinutes: 0, load: { runMinutes: 30 } }, 10).load).toEqual({ runMinutes: 30 });
    expect(withMinutes({ ...base, durationMinutes: 30, load: { runMinutes: 25 } }, 13).load).toEqual({ runMinutes: 11 });
    expect(withMinutes({ ...base, durationMinutes: 30 }, 13)).toEqual({ ...base, durationMinutes: 13 });
  });
});
