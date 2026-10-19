import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));
vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import {
  BIG_TEST_WEEKS,
  LIGHT_TEST_PASS_IF,
  buildRoadmapPrompt,
  checkRoadmapAnswer,
  formatTarget,
  generateRoadmap,
  lightTestSession,
  nextCheckWeek,
  presetMethod,
  withPathwayTests,
  type RawRoadmapAnswer,
  type Roadmap,
  type RoadmapInput,
  type WeekTarget,
} from '../src/lib/ai/roadmap.js';
import { buildWeekPrompt, weekLayout, type WeekCallInput } from '../src/lib/ai/weekPlan.js';
import { textSafetyHits } from '../src/lib/ai/safetyScan.js';
import {
  CERTIFIED_PRESETS,
  findPresetForGoal,
  guitarPreset,
  recompPreset,
  run10kPreset,
  spanishPreset,
  speechPreset,
  type CertifiedPresetBlueprint,
} from '../src/lib/ai/presets/index.js';
import { extractStatedTargets } from '../src/lib/research/statedTarget.js';
import { lastWeekResult } from '../src/lib/planV2.js';
import type { DailyTask } from '@prisma/client';

/** Weekly update M2.1 (RULE-19, WU-43): the pathways' hand-written weekly tests and light weeks. */

const SPLIT = ['run10k', 'recomp', 'speech', 'spanish'];
const BY_NAME: Record<string, CertifiedPresetBlueprint> = {
  run10k: run10kPreset,
  recomp: recompPreset,
  speech: speechPreset,
  spanish: spanishPreset,
  guitar: guitarPreset,
};
const preset = (name: string) => BY_NAME[name];

type Direction = 'higher_is_better' | 'lower_is_better';

interface Climb {
  metric: string;
  unit: string;
  direction: Direction;
  start: number;
  values: number[];
  finalGoal: string;
}

const CLIMBS: Record<string, Climb> = {
  // A 70-minute runner aiming at 58: week 4 (65) is 5 of the 12-minute climb, above the 40% week-1 share (4.8).
  run10k: { metric: '10K time', unit: 'minutes', direction: 'lower_is_better', start: 70, values: [68.5, 67.5, 66, 65, 64, 63, 62, 61, 60, 59, 58.5, 58], finalGoal: 'Run a 10K in 58 minutes or less' },
  // Plan safety limits M1.2: at most 0.5 points a week, so no week is lowered (the climb used to drop 0.6 in weeks 9 to 12).
  recomp: { metric: 'Body fat', unit: 'percent', direction: 'lower_is_better', start: 28, values: [27.6, 27.2, 26.8, 26.4, 26, 25.6, 25.2, 24.8, 24.4, 24, 23.5, 23], finalGoal: 'Reach 23 percent body fat' },
  speech: { metric: 'Filler words', unit: 'per minute', direction: 'lower_is_better', start: 8, values: [7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2], finalGoal: 'Give the full talk at 2 filler words per minute or less' },
  spanish: { metric: 'Conversation', unit: 'minutes', direction: 'higher_is_better', start: 1, values: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15], finalGoal: 'Hold a 15 minute conversation in Spanish' },
  guitar: { metric: 'Songs from memory', unit: 'songs', direction: 'higher_is_better', start: 0.5, values: [1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5], finalGoal: 'Play 5 songs from memory' },
};

function rawAnswer(climb: Climb, method: CertifiedPresetBlueprint): RawRoadmapAnswer {
  const fixed = presetMethod(method);
  return {
    finalGoal: climb.finalGoal,
    finalTest: 'The model wrote its own final test.',
    startingPoint: { value: climb.start, description: 'Where they are today.' },
    candidates: [{ name: fixed.name, creator: '', summary: 'The method.', strengths: 'Fits.', weaknesses: 'Hard.' }],
    chosen: fixed.name,
    whyChosen: 'It fits their answers.',
    runnerUp: { name: '', whyLost: '' },
    safety: 4,
    rules: ['Rule one', 'Rule two', 'Rule three', 'Rule four', 'Rule five'],
    phases: [
      { name: 'Base', startWeek: 1, endWeek: 4, purpose: 'Build the base.' },
      { name: 'Build', startWeek: 5, endWeek: 8, purpose: 'Build on it.' },
      { name: 'Peak', startWeek: 9, endWeek: 12, purpose: 'Get ready for the final test.' },
    ],
    weeks: climb.values.map((value, index) => ({
      weekNumber: index + 1,
      phase: 'Base',
      focus: `Focus ${index + 1}`,
      target: { kind: 'number', metric: climb.metric, value, unit: climb.unit, direction: climb.direction },
      test: { type: 'count', instructions: 'The model wrote this test.', passIf: `${value} ${climb.unit}` },
    })),
  };
}

function checked(climb: Climb, method: CertifiedPresetBlueprint, lastAttempt = false): Roadmap {
  const verdict = checkRoadmapAnswer(rawAnswer(climb, method), { statedTargets: [], fixedMethod: presetMethod(method) }, lastAttempt);
  if (!('value' in verdict)) throw new Error(verdict.reason);
  return verdict.value;
}

/** The roadmap back into the model's shape, so `checkRoadmapAnswer` can check it again. */
function asRaw(roadmap: Roadmap): RawRoadmapAnswer {
  return {
    finalGoal: roadmap.finalGoal,
    finalTest: roadmap.finalTest,
    startingPoint: roadmap.startingPoint,
    candidates: roadmap.method.candidates,
    chosen: roadmap.method.name,
    whyChosen: roadmap.method.whyChosen,
    runnerUp: { name: '', whyLost: '' },
    safety: roadmap.method.safety,
    rules: roadmap.method.rules,
    phases: roadmap.phases,
    weeks: roadmap.weeks,
  };
}

const numberValue = (target: WeekTarget) => (target.kind === 'number' ? target.value : NaN);

describe('withPathwayTests on a split pathway (WU-43 (1), (3), (7))', () => {
  for (const id of SPLIT) {
    it(`${id}: the big test in weeks 4, 8 and 12, the light test with the next check's target in every other week`, () => {
      const method = preset(id);
      const model = checked(CLIMBS[id], method, true);
      const roadmap = withPathwayTests(model, method);
      const tests = method.weeklyTests!;
      expect(tests.light).toBeDefined();

      for (const week of roadmap.weeks) {
        const modelWeek = model.weeks[week.weekNumber - 1];
        if (BIG_TEST_WEEKS.includes(week.weekNumber)) {
          expect(week.target).toEqual(modelWeek.target);
          expect(week.test.type).toBe(tests.measured.type);
          expect(week.test.instructions).toBe(tests.measured.instructions.replace('{target}', formatTarget(week.target)));
          expect(week.test.passIf).toBe(formatTarget(week.target));
          expect(week.test.light).toBeUndefined();
        } else {
          const check = model.weeks[nextCheckWeek(week.weekNumber) - 1];
          expect(week.target).toEqual(check.target);
          expect(week.test).toEqual({ type: tests.light!.type, instructions: tests.light!.instructions, passIf: LIGHT_TEST_PASS_IF, light: true });
        }
      }
      expect(roadmap.weeks[11].target).toEqual(model.weeks[11].target);
      expect(roadmap.finalTest).toBe(roadmap.weeks[11].test.instructions);
      // The model's roadmap is left as it was (pure).
      expect(model.weeks[0].test.instructions).toBe('The model wrote this test.');
    });
  }

  it('maps each light week to its next check: 1 to 3 week 4, 5 to 7 week 8, 9 to 11 week 12', () => {
    expect([1, 2, 3, 5, 6, 7, 9, 10, 11].map(nextCheckWeek)).toEqual([4, 4, 4, 8, 8, 8, 12, 12, 12]);
  });

  it('fills a deliverable target into the big test, and a light week takes the next check\'s deliverable', () => {
    const method = preset('speech');
    const model = checked(CLIMBS.speech, method, true);
    const deliverables: Roadmap = {
      ...model,
      weeks: model.weeks.map((week) => ({ ...week, target: { kind: 'deliverable', description: `Talk draft ${week.weekNumber}.` } })),
    };
    const roadmap = withPathwayTests(deliverables, method);
    expect(roadmap.weeks[3].test.instructions).toMatch(/Target: Talk draft 4$/);
    expect(roadmap.weeks[3].test.instructions).not.toContain('{target}');
    expect(roadmap.weeks[3].test.passIf).toBe('Talk draft 4.');
    expect(roadmap.weeks[4].target).toEqual({ kind: 'deliverable', description: 'Talk draft 8.' });
  });
});

describe('withPathwayTests on the other six pathways', () => {
  it('every pathway has a hand-written test; only the four split pathways have a light one', () => {
    expect(CERTIFIED_PRESETS).toHaveLength(10);
    for (const item of CERTIFIED_PRESETS) {
      expect(item.weeklyTests?.measured.instructions, item.id).toContain('{target}');
      expect(Boolean(item.weeklyTests?.light), item.id).toBe(SPLIT.some((name) => preset(name).id === item.id));
    }
  });

  it('guitar: every week measures its own target, no light flag, the targets as the model wrote them', () => {
    const method = preset('guitar');
    const model = checked(CLIMBS.guitar, method, true);
    const roadmap = withPathwayTests(model, method);
    roadmap.weeks.forEach((week, index) => {
      expect(week.target).toEqual(model.weeks[index].target);
      expect(week.test.instructions).toBe(method.weeklyTests!.measured.instructions.replace('{target}', formatTarget(week.target)));
      expect(week.test.passIf).toBe(formatTarget(week.target));
      expect(week.test.light).toBeUndefined();
    });
    expect(roadmap.finalTest).toBe(roadmap.weeks[11].test.instructions);
  });

  it('a custom goal (no pathway) is returned exactly as it is', () => {
    const model = checked(CLIMBS.guitar, preset('guitar'), true);
    expect(withPathwayTests(model, null)).toBe(model);
    expect(withPathwayTests(model, { weeklyTests: undefined })).toBe(model);
  });
});

describe('the light-week rewrite keeps the roadmap rules (requirement 3)', () => {
  it('typing-like climb: the rewritten roadmap passes every checkRoadmapAnswer rule, as a first attempt', () => {
    const climb: Climb = { metric: 'Conversation', unit: 'minutes', direction: 'higher_is_better', start: 1, values: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15], finalGoal: 'Hold a 15 minute conversation in Spanish' };
    const method = preset('spanish');
    const roadmap = withPathwayTests(checked(climb, method), method);
    const verdict = checkRoadmapAnswer(asRaw(roadmap), { statedTargets: [], fixedMethod: presetMethod(method) });
    expect('value' in verdict ? '' : verdict.reason).toBe('');
  });

  it('a stated target still holds in week 12 after the rewrite', () => {
    const method = preset('run10k');
    const statedTargets = extractStatedTargets('Run a 10K in under 58 minutes');
    expect(statedTargets.length).toBeGreaterThan(0);
    const verdict = checkRoadmapAnswer(rawAnswer(CLIMBS.run10k, method), { statedTargets, fixedMethod: presetMethod(method) }, true);
    if (!('value' in verdict)) throw new Error(verdict.reason);
    const again = checkRoadmapAnswer(asRaw(withPathwayTests(verdict.value, method)), { statedTargets, fixedMethod: presetMethod(method) }, true);
    expect('value' in again ? '' : again.reason).toBe('');
  });

  for (const id of SPLIT) {
    it(`${id}: never backwards, one unit and kind, week 12 the final goal, the targets still move`, () => {
      const method = preset(id);
      const model = checked(CLIMBS[id], method, true);
      const roadmap = withPathwayTests(model, method);
      const values = roadmap.weeks.map((week) => numberValue(week.target));
      const direction = CLIMBS[id].direction;
      for (let i = 1; i < values.length; i++) {
        expect(direction === 'higher_is_better' ? values[i] >= values[i - 1] : values[i] <= values[i - 1], `${id} week ${i + 1}`).toBe(true);
      }
      for (const week of roadmap.weeks) {
        expect(week.target.kind).toBe('number');
        if (week.target.kind === 'number') {
          expect(week.target.unit).toBe(CLIMBS[id].unit);
          expect(week.target.direction).toBe(direction);
        }
      }
      expect(values[11]).toBe(CLIMBS[id].values[11]);
      expect(values[0]).not.toBe(values[11]);
      // Every hard rule, plus the soft ones that give way only on the last attempt.
      const verdict = checkRoadmapAnswer(asRaw(roadmap), { statedTargets: [], fixedMethod: presetMethod(method) }, true);
      expect('value' in verdict ? '' : verdict.reason).toBe('');
    });
  }

  it('the 40% week-1 rule is left out after the rewrite: checked on the model\'s answer, not on week 1 showing week 4\'s target (run10k 70, week 4 65, week 12 58)', () => {
    const method = preset('run10k');
    // The model's own climb passes every rule, the 40% week-1 rule included, as a first attempt.
    const model = checked(CLIMBS.run10k, method);
    const roadmap = withPathwayTests(model, method);
    expect(numberValue(roadmap.weeks[0].target)).toBe(65);
    // Checked again after the rewrite, week 1 (65) would be 5 of the 12-minute climb: over 40%. Only that rule fails.
    const again = checkRoadmapAnswer(asRaw(roadmap), { statedTargets: [], fixedMethod: presetMethod(method) });
    expect('reason' in again ? again.reason : '').toMatch(/^Week 1 \(65\) jumps too far/);
  });
});

describe('the hand-written tests pass B-63\'s roadmap scan (requirement 2)', () => {
  const targets: WeekTarget[] = [
    { kind: 'number', metric: 'Measure', value: 12, unit: 'units', direction: 'higher_is_better' },
    { kind: 'deliverable', description: 'The week\'s piece of work.' },
  ];
  for (const item of CERTIFIED_PRESETS) {
    it(`${item.id}: weeks 1 to 12, as written and in a light first week back`, () => {
      for (const target of targets) {
        const model: Roadmap = {
          finalGoal: 'Goal',
          finalTest: 'Test',
          startingPoint: { value: null, description: '' },
          method: { ...presetMethod(item), whyChosen: '', runnerUp: null, safety: 4, rules: [], candidates: [] },
          phases: [],
          weeks: Array.from({ length: 12 }, (_, index) => ({
            weekNumber: index + 1,
            phase: 'Base',
            focus: '',
            target,
            test: { type: 'count' as const, instructions: 'x', passIf: 'x' },
          })),
        };
        for (const week of withPathwayTests(model, item).weeks) {
          const text = `${week.test.instructions}\n${week.test.passIf}`;
          expect(textSafetyHits(text, week.weekNumber), `${item.id} week ${week.weekNumber}`).toEqual([]);
          expect(textSafetyHits(text, week.weekNumber, { light: true }), `${item.id} week ${week.weekNumber} light`).toEqual([]);
        }
      }
    });
  }
});

const roadmapInput: RoadmapInput = {
  workingTitle: 'Run a 10K',
  domain: 'Running',
  rawGoal: 'run a 10k',
  dailyMinutes: 40,
  activeDays: 5,
  answers: [{ id: 'current_level', question: 'Now?', answer: '10K in 70 minutes' }],
};

describe('generateRoadmap puts the pathway tests in; a custom goal keeps the model\'s (requirements 2, 6)', () => {
  const mocked = vi.mocked(generateStructuredContent);
  beforeEach(() => mocked.mockReset());

  it('run10k: the stored roadmap holds the light and big tests', async () => {
    mocked.mockResolvedValue({ success: true, data: rawAnswer(CLIMBS.run10k, preset('run10k')) } as never);
    const result = await generateRoadmap(roadmapInput);
    if (!result.ok) throw new Error(result.reason);
    expect(result.roadmap.weeks[1].test.light).toBe(true);
    expect(result.roadmap.weeks[1].test.passIf).toBe(LIGHT_TEST_PASS_IF);
    expect(result.roadmap.weeks[3].test.passIf).toBe('10K time: 65 minutes or less');
    expect(result.roadmap.finalTest).toMatch(/Target: 10K time: 58 minutes or less$/);
  });

  it('a custom goal: the new test rule in the prompt, no light flag and no target rewrite', async () => {
    const custom = { ...roadmapInput, rawGoal: 'learn to bake sourdough', workingTitle: 'Bake sourdough', domain: 'Baking' };
    expect(findPresetForGoal(custom.rawGoal)).toBeNull();
    const raw = rawAnswer(CLIMBS.spanish, preset('spanish'));
    raw.candidates = [
      { name: 'Method A', creator: '', summary: 'A.', strengths: 'S.', weaknesses: 'W.' },
      { name: 'Method B', creator: '', summary: 'B.', strengths: 'S.', weaknesses: 'W.' },
    ];
    raw.chosen = 'Method A';
    mocked.mockResolvedValue({ success: true, data: raw } as never);
    const result = await generateRoadmap(custom);
    if (!result.ok) throw new Error(result.reason);
    expect(result.roadmap.weeks.every((week) => week.test.light === undefined)).toBe(true);
    expect(result.roadmap.weeks.map((week) => numberValue(week.target))).toEqual(CLIMBS.spanish.values);
    expect(result.roadmap.weeks[0].test.instructions).toBe('The model wrote this test.');

    const flat = String(mocked.mock.calls[0][0]).replace(/\s+/g, ' ');
    expect(flat).toContain(
      'The test is part of a normal session, needs no special tools and is short: no all-out effort, no max and nothing to failure. Any harder test (a full mock exam, a full run-through) goes only in weeks 4, 8 and 12.'
    );
    expect(flat).toContain('the short weekly quiz and the full mock exam in weeks 4, 8 and 12 both report that same percent');
    expect(flat).not.toContain('a full mock exam after topic quizzes');
    expect(flat).toBe(buildRoadmapPrompt(custom).replace(/\s+/g, ' '));
  });
});

const weekInput: WeekCallInput = {
  finalGoal: 'Run a 10K in 58 minutes or less',
  answers: [],
  dailyMinutes: 40,
  planVariant: 'steady',
  slotTime: '07:30',
  method: { name: 'VDOT', creator: '', rules: ['Mostly easy running'] },
  weekNumber: 2,
  totalWeeks: 12,
  phase: { name: 'Base', purpose: 'Build the base.' },
  focus: 'Easy miles',
  target: { kind: 'number', metric: '10K time', value: 65, unit: 'minutes', direction: 'lower_is_better' },
  test: { type: 'timer', instructions: preset('run10k').weeklyTests!.light!.instructions, passIf: LIGHT_TEST_PASS_IF, light: true },
  weekStart: new Date('2026-10-19T12:00:00Z'),
  testSession: 'the long run',
};

describe('the week prompt (requirement 5)', () => {
  const layout = weekLayout('steady', weekInput.weekStart);

  it('a light week: the next check\'s target to build toward, the light test, and the session it belongs to', () => {
    const prompt = buildWeekPrompt(weekInput, layout);
    expect(prompt).toContain('Next check (week 4): 10K time: 65 minutes or less. Build toward it; it is not tested this week.');
    expect(prompt).toContain(`Weekly test (the light test, done as written; no number against the target): ${weekInput.test.instructions}`);
    expect(prompt).toContain('- The light test belongs to the long run: the test day is that session, with the test as its main step.');
    expect(prompt).toContain('a short step after it (5 minutes or less) that notes how it went; it does not compare anything with the target.');
    expect(prompt).not.toContain('\nTarget: ');
    expect(prompt).not.toContain('Pass if:');
  });

  it('a big week: the target and the test as before, no light lines', () => {
    const big: WeekCallInput = {
      ...weekInput,
      weekNumber: 4,
      test: { type: 'timer', instructions: 'Run the test. Target: 10K time: 65 minutes or less', passIf: '10K time: 65 minutes or less' },
      testSession: undefined,
    };
    const prompt = buildWeekPrompt(big, layout);
    expect(prompt).toContain('Target: 10K time: 65 minutes or less\nWeekly test: Run the test. Target: 10K time: 65 minutes or less. Pass if: 10K time: 65 minutes or less');
    expect(prompt).toContain('that compares the\n  result with the target.');
    expect(prompt).not.toContain('Next check');
    expect(prompt).not.toContain('belongs to');
  });

  it('after a light week, last week\'s result is not a result against the target', () => {
    const prompt = buildWeekPrompt(
      { ...weekInput, weekNumber: 3, lastWeek: { target: weekInput.target, lightTest: true, result: 'test logged: Done, passed', done: 4, planned: 5, keySessionsSkipped: [] } },
      layout
    );
    expect(prompt).toContain('Next check: 10K time: 65 minutes or less. Light test (not a check of the target): test logged: Done, passed. Sessions done: 4 of 5.');
  });

  it('the session comes from the pathway, only for a light test', () => {
    expect(lightTestSession({ light: true }, 'run a 10k', 'Run a 10K')).toBe('the long run');
    expect(lightTestSession({ light: true }, 'body fat', recompPreset.title)).toBe(preset('recomp').weeklyTests!.light!.session);
    expect(lightTestSession({}, 'run a 10k', 'Run a 10K')).toBeUndefined();
    expect(lightTestSession({ light: true }, 'learn to bake sourdough', 'Bake sourdough')).toBeUndefined();
  });
});

describe("M2.1 review: a pathway's model tests are not checked, a custom goal's still are (fix 1)", () => {
  const mocked = vi.mocked(generateStructuredContent);
  beforeEach(() => mocked.mockReset());

  /** Week 2's model test breaks B-63's scan (any week: an 800 kcal deficit); week 3's is another type. */
  function badTests(raw: RawRoadmapAnswer): RawRoadmapAnswer {
    const weeks = (raw.weeks as Array<{ test: { type: string; instructions: string; passIf: string } }>).map((week, index) => ({
      ...week,
      test:
        index === 1
          ? { ...week.test, instructions: 'Hold an 800 kcal deficit all week.' }
          : index === 2
            ? { ...week.test, type: 'video' }
            : week.test,
    }));
    return { ...raw, weeks };
  }

  it("a pathway answer with a breaking test and mixed types passes, first time, with the pathway's tests", async () => {
    mocked.mockResolvedValue({ success: true, data: badTests(rawAnswer(CLIMBS.run10k, preset('run10k'))) } as never);
    const result = await generateRoadmap(roadmapInput);
    if (!result.ok) throw new Error(result.reason);
    expect(mocked).toHaveBeenCalledTimes(1);
    expect(result.roadmap.weeks[1].test.instructions).toBe(preset('run10k').weeklyTests!.light!.instructions);
    expect(new Set(result.roadmap.weeks.map((week) => week.test.type))).toEqual(new Set(['timer']));
  });

  it('the same answers for a custom goal are still refused: the scan, and one test type', () => {
    const method = preset('run10k');
    const scan = badTests(rawAnswer(CLIMBS.run10k, method));
    const custom = { statedTargets: [], fixedMethod: presetMethod(method) };
    const scanVerdict = checkRoadmapAnswer(scan, custom);
    expect('reason' in scanVerdict ? scanVerdict.reason : '').toMatch(/^SAFETY: week 2's test says "Hold an 800 kcal deficit all week\."/);
    const mixed = rawAnswer(CLIMBS.run10k, method);
    (mixed.weeks as Array<{ test: { type: string } }>)[2].test.type = 'video';
    const typeVerdict = checkRoadmapAnswer(mixed, custom);
    expect('reason' in typeVerdict ? typeVerdict.reason : '').toMatch(/Use the same test type every week/);
    expect('value' in checkRoadmapAnswer(scan, { ...custom, pathwayTests: true })).toBe(true);
    expect('value' in checkRoadmapAnswer(mixed, { ...custom, pathwayTests: true })).toBe(true);
  });
});

describe("M2.1 review: last week's light test is done, never passed (fix 2)", () => {
  const testDay = (over: Partial<DailyTask> = {}) => ({ isTestDay: true, status: 'completed', notes: null, ...over }) as DailyTask;

  it('a logged light test reads "light test done", with the note when there is one', () => {
    expect(lastWeekResult(testDay(), { value: 'Done', passed: true, note: 'Legs heavy' }, true)).toBe('light test done; their note: "Legs heavy"');
    expect(lastWeekResult(testDay(), { value: 'Done', passed: true }, true)).toBe('light test done');
  });

  it('an unlogged light test keeps the old texts; a test without light is as before', () => {
    expect(lastWeekResult(testDay({ status: 'pending' }), null, true)).toBe('the weekly test was not done');
    expect(lastWeekResult(testDay(), null, true)).toBe('test done, score not logged');
    expect(lastWeekResult(testDay(), { value: 26, unit: 'min', passed: true }, false)).toBe('test logged: 26 min, passed');
  });

  it('in the week prompt: no "passed" after a light week', () => {
    const result = lastWeekResult(testDay(), { value: 'Done', passed: true, note: 'Easy' }, true);
    const prompt = buildWeekPrompt(
      { ...weekInput, weekNumber: 3, lastWeek: { target: weekInput.target, lightTest: true, result, done: 4, planned: 5, keySessionsSkipped: [] } },
      weekLayout('steady', weekInput.weekStart)
    );
    expect(prompt).toContain('Light test (not a check of the target): light test done; their note: "Easy". Sessions done: 4 of 5.');
    expect(prompt).not.toMatch(/passed/);
  });
});
