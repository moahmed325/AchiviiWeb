import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({ generateStructuredContent: vi.fn() }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

import {
  buildRoadmapPrompt,
  checkRoadmapAnswer,
  presetMethod,
  withPathwayTests,
  type RawRoadmapAnswer,
  type Roadmap,
  type RoadmapCheckContext,
} from '../src/lib/ai/roadmap.js';
import { recompPreset, run10kPreset, type CertifiedPresetBlueprint } from '../src/lib/ai/presets/index.js';
import { extractStatedTargets } from '../src/lib/research/statedTarget.js';

// Plan safety limits M1.2 (RULE-2, RULE-3, PSL-6, PSL-11 Q1, Q2, Q14): the roadmap check lowers a target that climbs
// faster than a safe step, before the stated-target check and before light weeks copy the targets.

type Direction = 'higher_is_better' | 'lower_is_better';

function answer(
  method: CertifiedPresetBlueprint,
  climb: { metric: string; unit: string; direction: Direction; start: number | null; values: number[]; finalGoal: string }
): RawRoadmapAnswer {
  const fixed = presetMethod(method);
  return {
    finalGoal: climb.finalGoal,
    finalTest: 'The model wrote its own final test.',
    startingPoint: climb.start === null ? { description: 'Not sure.' } : { value: climb.start, description: 'Where they are today.' },
    candidates: [],
    chosen: fixed.name,
    whyChosen: 'It fits their answers.',
    runnerUp: { name: '', whyLost: '' },
    safety: 4,
    rules: ['Rule one', 'Rule two', 'Rule three', 'Rule four', 'Rule five'],
    phases: [
      { name: 'Base', startWeek: 1, endWeek: 4, purpose: 'Build the base.' },
      { name: 'Build', startWeek: 5, endWeek: 8, purpose: 'Build on it.' },
      { name: 'Peak', startWeek: 9, endWeek: 12, purpose: 'Get ready.' },
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

function context(method: CertifiedPresetBlueprint, goal = '', pathwayId?: string): RoadmapCheckContext {
  return { statedTargets: extractStatedTargets(goal), fixedMethod: presetMethod(method), pathwayTests: true, pathwayId };
}

function accepted(result: ReturnType<typeof checkRoadmapAnswer>): Roadmap {
  if (!('value' in result)) throw new Error(result.reason);
  return result.value;
}

const values = (roadmap: Roadmap) => roadmap.weeks.map((week) => (week.target.kind === 'number' ? week.target.value : NaN));

/** A 70-minute 10K runner the model takes to 50 minutes: about 2.8% a week, faster than 2%. */
const STEEP_10K = {
  metric: '10K time',
  unit: 'minutes',
  direction: 'lower_is_better' as const,
  start: 70,
  values: [68, 66, 64, 62, 60, 58, 56, 55, 54, 53, 52, 50],
  finalGoal: 'Run a 10K in 50 minutes or less',
};
/** 2% a week from 70, each rounded up to the slower tenth. */
const SAFE_10K = [68.6, 67.3, 66, 64.7, 63.5, 62.3, 61.1, 59.9, 58.8, 57.7, 56.6, 55.5];

describe('the roadmap check lowers a too-steep climb (RULE-2, AC-2)', () => {
  it('run10k: each week lowered to 2% faster than the week before, the model values kept in loweredTargets', () => {
    const roadmap = accepted(checkRoadmapAnswer(answer(run10kPreset, STEEP_10K), context(run10kPreset, '', 'run10k')));
    expect(values(roadmap)).toEqual(SAFE_10K);
    expect(roadmap.loweredTargets).toEqual(STEEP_10K.values.map((model, index) => ({ week: index + 1, model, safe: SAFE_10K[index] })));
  });

  it('run10k split pathway: the light weeks copy the lowered big-week values (PSL-11 Q1)', () => {
    const roadmap = withPathwayTests(accepted(checkRoadmapAnswer(answer(run10kPreset, STEEP_10K), context(run10kPreset, '', 'run10k'))), run10kPreset);
    expect(values(roadmap)).toEqual([64.7, 64.7, 64.7, 64.7, 59.9, 59.9, 59.9, 59.9, 55.5, 55.5, 55.5, 55.5]);
    expect(roadmap.weeks[0].test.light).toBe(true);
    expect(roadmap.loweredTargets).toHaveLength(12);
  });

  it('recomp: body fat lowered to 0.5 points a week', () => {
    const steep = {
      metric: 'Body fat',
      unit: 'percent',
      direction: 'lower_is_better' as const,
      start: 28,
      values: [27.3, 26.6, 25.9, 25.2, 24.5, 23.8, 23.1, 22.4, 21.7, 21, 20.3, 19.6],
      finalGoal: 'Reach 19.6 percent body fat',
    };
    const roadmap = accepted(checkRoadmapAnswer(answer(recompPreset, steep), context(recompPreset)));
    expect(values(roadmap)).toEqual([27.5, 27, 26.5, 26, 25.5, 25, 24.5, 24, 23.5, 23, 22.5, 22]);
    expect(roadmap.loweredTargets?.[11]).toEqual({ week: 12, model: 19.6, safe: 22 });
  });

  it('a climb within the limits is stored as written, with no loweredTargets', () => {
    const safe = { ...STEEP_10K, start: 60, values: [59, 58, 57, 56.5, 56, 55.5, 55.2, 55, 55, 55, 55, 55], finalGoal: 'Run a 10K in 55 minutes' };
    const roadmap = accepted(checkRoadmapAnswer(answer(run10kPreset, safe), context(run10kPreset, '', 'run10k')));
    expect(values(roadmap)).toEqual(safe.values);
    expect(roadmap.loweredTargets).toBeUndefined();
  });

  it('a deficit target above 600 is lowered to 600; below 250 is left alone (PSL-6)', () => {
    const deficit = {
      metric: 'Daily calorie deficit',
      unit: 'kcal',
      direction: 'higher_is_better' as const,
      start: 100,
      values: [200, 300, 400, 500, 600, 700, 700, 800, 800, 800, 800, 800],
      finalGoal: 'Hold an 800 kcal daily deficit',
    };
    const roadmap = accepted(checkRoadmapAnswer(answer(recompPreset, deficit), context(recompPreset)));
    expect(values(roadmap)).toEqual([200, 300, 400, 500, 600, 600, 600, 600, 600, 600, 600, 600]);
    expect(roadmap.loweredTargets?.map((item) => item.week)).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  it('a target no family reads is never refused or changed (unknown family)', () => {
    const waist = {
      metric: 'Waist',
      unit: 'cm',
      direction: 'lower_is_better' as const,
      start: 100,
      values: [97, 94, 91, 88, 86, 84, 82, 80, 79, 78, 77, 76],
      finalGoal: 'A 76 cm waist',
    };
    const roadmap = accepted(checkRoadmapAnswer(answer(recompPreset, waist), context(recompPreset)));
    expect(values(roadmap)).toEqual(waist.values);
    expect(roadmap.loweredTargets).toBeUndefined();
  });

  it('with no starting point (accepted on the last attempt), week 1 is not checked and week 2 on is (no_start)', () => {
    const run = {
      metric: 'Longest continuous run',
      unit: 'km',
      direction: 'higher_is_better' as const,
      start: null,
      values: [9, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
      finalGoal: 'Run 22 km without stopping',
    };
    const roadmap = accepted(checkRoadmapAnswer(answer(run10kPreset, run), context(run10kPreset, '', 'run10k'), true));
    expect(roadmap.startingPoint.value).toBeNull();
    expect(values(roadmap)).toEqual([9, 10, 11, 12.1, 13.3, 14.6, 16, 17.6, 19, 20, 21, 22]);
    expect(roadmap.loweredTargets?.[0]).toEqual({ week: 2, model: 12, safe: 10 });
  });
});

describe('safety wins over the stated number (RULE-3, AC-3 server)', () => {
  it('a stated time the model reached, put out of reach only by the lowering, is accepted at the highest safe step', () => {
    const roadmap = accepted(checkRoadmapAnswer(answer(run10kPreset, STEEP_10K), context(run10kPreset, 'Run a 10K in under 50 minutes', 'run10k')));
    expect(values(roadmap)[11]).toBe(55.5);
  });

  it('a plain miss with nothing lowered is still refused', () => {
    const miss = { ...STEEP_10K, start: 60, values: [59, 58, 57, 56.5, 56, 55.5, 55.2, 55, 55, 55, 55, 55], finalGoal: 'Run a 10K in 55 minutes' };
    const result = checkRoadmapAnswer(answer(run10kPreset, miss), context(run10kPreset, 'Run a 10K in under 50 minutes', 'run10k'), true);
    expect('reason' in result && result.reason).toMatch(/Week 12 must reach the number the user asked for: under 50 minutes/);
  });

  it('a model week 12 that missed the stated number is refused even when the lowering also acted', () => {
    const miss = { ...STEEP_10K, values: [68, 66, 64, 62, 60, 58, 56, 55, 54, 53, 52.5, 52] };
    const result = checkRoadmapAnswer(answer(run10kPreset, miss), context(run10kPreset, 'Run a 10K in under 50 minutes', 'run10k'), true);
    expect('reason' in result && result.reason).toMatch(/Week 12 must reach/);
  });

  it('"lose 10 kg": a model week 12 at the start minus 10, lowered, is accepted; a model that stops short is refused', () => {
    const weight = {
      metric: 'Body weight',
      unit: 'kg',
      direction: 'lower_is_better' as const,
      start: 90,
      values: [89.2, 88.4, 87.6, 86.8, 86, 85.2, 84.4, 83.6, 82.8, 82, 81, 80],
      finalGoal: 'Weigh 80 kg',
    };
    const roadmap = accepted(checkRoadmapAnswer(answer(recompPreset, weight), context(recompPreset, 'Lose 10 kg')));
    expect(values(roadmap).slice(10)).toEqual([81.2, 80.4]);
    expect(roadmap.loweredTargets?.map((item) => item.week)).toEqual([11, 12]);

    const short = { ...weight, values: [89.2, 88.4, 87.6, 86.8, 86, 85.2, 84.4, 83.6, 82.8, 82, 81.5, 81.2], finalGoal: 'Weigh 81.2 kg' };
    const result = checkRoadmapAnswer(answer(recompPreset, short), context(recompPreset, 'Lose 10 kg'), true);
    expect('reason' in result && result.reason).toMatch(/Week 12 must reach the number the user asked for: 10 kg/);
  });

  it('finalGoal is not asked for again when week 12 was lowered (PSL-11 Q2)', () => {
    const roadmap = accepted(checkRoadmapAnswer(answer(run10kPreset, STEEP_10K), context(run10kPreset, '', 'run10k'), false));
    expect(roadmap.finalGoal).toBe('Run a 10K in 50 minutes or less');
  });

  it('finalGoal is still asked for when nothing was lowered', () => {
    const safe = { ...STEEP_10K, start: 60, values: [59, 58, 57, 56.5, 56, 55.5, 55.2, 55, 55, 55, 55, 55], finalGoal: 'Run a faster 10K' };
    const result = checkRoadmapAnswer(answer(run10kPreset, safe), context(run10kPreset, '', 'run10k'), false);
    expect('reason' in result && result.reason).toMatch(/"finalGoal" must state week 12's target/);
  });
});

describe('"lose N" in the first prompt (M1.2 review)', () => {
  const input = { workingTitle: 'Lose 10 kg', domain: 'fitness', rawGoal: 'Lose 10 kg', dailyMinutes: 45, activeDays: 5, answers: [] };

  it('says week 12 is N below the starting point, not that week 12 must reach N', () => {
    const prompt = buildRoadmapPrompt(input, presetMethod(recompPreset), extractStatedTargets('Lose 10 kg'));
    expect(prompt).toContain('For "10 kg", week 12 is 10 kg below the starting point (or, counting what is lost, 10 kg or more).');
    expect(prompt).not.toContain("Week 12's target must reach it.");
  });

  it('keeps the plain sentence when nothing is a loss', () => {
    const prompt = buildRoadmapPrompt({ ...input, rawGoal: 'Squat 100 kg' }, presetMethod(recompPreset), extractStatedTargets('Squat 100 kg'));
    expect(prompt).toContain(`They named a number: "100 kg". Week 12's target must reach it.`);
  });
});
