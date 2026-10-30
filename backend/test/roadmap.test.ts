import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import {
  ROADMAP_RESPONSE_SCHEMA,
  buildRoadmapPrompt,
  checkRoadmapAnswer,
  formatTarget,
  generateRoadmap,
  roadmapSystem,
  type RawRoadmapAnswer,
  type RoadmapInput,
} from '../src/lib/ai/roadmap.js';
import { planShape } from '../src/lib/planLength.js';

// The roadmap call. No weekly tests (2026-10-30, docs/features/no-weekly-tests/plan.md): each week has a focus inside
// the method's phases, and the goal may have one measure (with today's level as the starting point). No weekly
// target, no test, no final test, so there is no target climb to check.

function answer(overrides: Partial<RawRoadmapAnswer> = {}, weeks = 12): RawRoadmapAnswer {
  return {
    finalGoal: 'Type 40 words per minute at 95% accuracy',
    startingPoint: { value: 14, description: 'About 14 wpm, hunt and peck.' },
    measure: { metric: 'Typing speed', unit: 'words per minute', direction: 'higher_is_better' },
    candidates: [
      { name: 'Keybr adaptive drills', creator: '', summary: 'Adaptive letter drills.', strengths: 'Fits beginners.', weaknesses: 'Dull.' },
      { name: 'Typing.com curriculum', creator: '', summary: 'Lesson path.', strengths: 'Structured.', weaknesses: 'Slow.' },
    ],
    chosen: 'Keybr adaptive drills',
    whyChosen: 'They type 14 wpm and want 40.',
    runnerUp: { name: 'Typing.com curriculum', whyLost: 'Slower for adults.' },
    safety: 5,
    rules: [
      'Hold 95% accuracy before adding speed',
      'Eyes on the screen, never the keys',
      'Return to home row after every key',
      'Stop a drill when accuracy drops below 90%',
      'Practise on the same site every week',
    ],
    phases: [
      { name: 'Accuracy', startWeek: 1, endWeek: 4, purpose: 'Learn every key without looking.' },
      { name: 'Speed', startWeek: 5, endWeek: weeks - 2, purpose: 'Add speed at the same accuracy.' },
      { name: 'Polish', startWeek: weeks - 1, endWeek: weeks, purpose: 'Hold the speed for longer.' },
    ],
    weeks: Array.from({ length: weeks }, (_, index) => ({ weekNumber: index + 1, phase: 'whatever', focus: `Focus ${index + 1}` })),
    ...overrides,
  };
}

const context = {};

function reason(result: ReturnType<typeof checkRoadmapAnswer>): string {
  return 'reason' in result ? result.reason : '';
}

describe('checkRoadmapAnswer', () => {
  it("accepts a sound roadmap and takes each week's phase from the phase ranges", () => {
    const result = checkRoadmapAnswer(answer(), context);
    if (!('value' in result)) throw new Error(reason(result));
    const roadmap = result.value;
    expect(roadmap.weeks).toHaveLength(12);
    expect(roadmap.weeks[0]).toEqual({ weekNumber: 1, phase: 'Accuracy', focus: 'Focus 1' });
    expect(roadmap.weeks[11].phase).toBe('Polish');
    expect(roadmap.measure).toEqual({ metric: 'Typing speed', unit: 'words per minute', direction: 'higher_is_better' });
    expect(roadmap.startingPoint).toEqual({ value: 14, description: 'About 14 wpm, hunt and peck.' });
    expect(roadmap).not.toHaveProperty('finalTest');
    expect(JSON.stringify(roadmap.weeks)).not.toMatch(/target|test/);
  });

  it('sorts weeks by number and renumbers them; an empty focus takes the phase purpose', () => {
    const data = answer();
    const weeks = data.weeks as Array<Record<string, unknown>>;
    weeks.reverse();
    weeks[11].focus = '';
    const result = checkRoadmapAnswer(data, context);
    if (!('value' in result)) throw new Error(reason(result));
    expect(result.value.weeks.map((w) => w.weekNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.value.weeks[0].focus).toBe('Learn every key without looking.');
  });

  it('a goal that is built or made has no measure and no starting value', () => {
    const result = checkRoadmapAnswer(answer({ measure: null }), context);
    expect('value' in result && result.value.measure).toBeNull();
    expect('value' in result && result.value.startingPoint.value).toBeNull();
    const noUnit = checkRoadmapAnswer(answer({ measure: { metric: 'Speed', unit: '' } }), context);
    expect('value' in noUnit && noUnit.value.measure).toBeNull();
  });

  it('reads the measure direction, higher is better unless it says lower', () => {
    const lower = checkRoadmapAnswer(answer({ measure: { metric: '5K time', unit: 'minutes', direction: 'lower_is_better' } }), context);
    expect('value' in lower && lower.value.measure?.direction).toBe('lower_is_better');
    const odd = checkRoadmapAnswer(answer({ measure: { metric: 'Typing speed', unit: 'wpm', direction: 'up' } }), context);
    expect('value' in odd && odd.value.measure?.direction).toBe('higher_is_better');
  });

  it('rejects an unsafe method even on the last attempt', () => {
    expect(reason(checkRoadmapAnswer(answer({ safety: 2 }), context, true))).toMatch(/"safety" is 2/);
  });

  it('rejects phases with a gap', () => {
    const data = answer({
      phases: [
        { name: 'A', startWeek: 1, endWeek: 4, purpose: 'a' },
        { name: 'B', startWeek: 6, endWeek: 12, purpose: 'b' },
      ],
    });
    expect(reason(checkRoadmapAnswer(data, context))).toMatch(/no gaps or overlaps/);
  });

  it('rejects any other number of weeks than the plan has', () => {
    const eleven = answer({ weeks: (answer().weeks as unknown[]).slice(0, 11) });
    expect(reason(checkRoadmapAnswer(eleven, context))).toMatch(/exactly 12 weeks; got 11/);
    const seven = checkRoadmapAnswer(answer({}, 7), { shape: planShape(7) });
    expect('value' in seven && seven.value.weeks).toHaveLength(7);
  });

  it('dedupes rules, caps them at 8, and rejects fewer than 5', () => {
    const many = Array.from({ length: 10 }, (_, i) => `Rule number ${i}`);
    expect('value' in checkRoadmapAnswer(answer({ rules: [...many, 'Rule number 1'] }), context) && true).toBe(true);
    const result = checkRoadmapAnswer(answer({ rules: many }), context);
    expect('value' in result && result.value.method.rules).toHaveLength(8);
    expect(reason(checkRoadmapAnswer(answer({ rules: ['One', 'Two', 'One'] }), context))).toMatch(/needs 5 to 8 different rules; got 2/);
  });

  it('rejects a chosen method that is not a candidate', () => {
    expect(reason(checkRoadmapAnswer(answer({ chosen: 'Something else' }), context))).toMatch(/must be the name of one of the candidates/);
  });

  it('fills the method from the fixed preset method', () => {
    const fixedMethod = { name: 'Jack Daniels VDOT', creator: 'Jack Daniels', summary: 'Paced zones.' };
    const result = checkRoadmapAnswer(answer({ candidates: [], chosen: '' }), { fixedMethod });
    expect('value' in result && result.value.method.name).toBe('Jack Daniels VDOT');
    expect('value' in result && result.value.method.runnerUp).toBe(null);
  });
});

describe('the schema', () => {
  it('asks for no target, test or final test', () => {
    const text = JSON.stringify(ROADMAP_RESPONSE_SCHEMA);
    expect(text).not.toMatch(/target|finalTest|"test"/);
    expect(text).toContain('"measure"');
    expect(text).toContain('"focus"');
  });
});

describe('formatTarget (still used for stored weeks of older goals)', () => {
  it('writes numbers and deliverables plainly', () => {
    expect(formatTarget({ kind: 'number', metric: 'Typing speed', value: 25, unit: 'wpm', direction: 'higher_is_better' })).toBe('Typing speed: 25 wpm');
    expect(formatTarget({ kind: 'number', metric: '5K time', value: 30, unit: 'minutes', direction: 'lower_is_better' })).toBe('5K time: 30 minutes or less');
    expect(formatTarget({ kind: 'deliverable', description: 'One open-crumb loaf' })).toBe('One open-crumb loaf');
  });
});

const input: RoadmapInput = {
  workingTitle: 'Learn to touch type',
  domain: 'Touch typing',
  rawGoal: 'learn to touch type',
  dailyMinutes: 30,
  activeDays: 5,
  answers: [
    { id: 'current_level', question: 'How fast do you type?', answer: 'About 14 wpm' },
    { id: 'success', question: 'In 90 days?', answer: 'Type 40 wpm' },
    { id: 'equipment', question: 'Keyboard?', answer: 'Skipped' },
    { id: 'obstacle', question: 'What stops you?', answer: 'I look at the keys' },
  ],
};

describe('buildRoadmapPrompt', () => {
  it('labels answers by id and marks skipped ones', () => {
    const prompt = buildRoadmapPrompt(input);
    expect(prompt).toContain('- Where they are now: About 14 wpm');
    expect(prompt).toContain('- Equipment and environment: (skipped)');
    expect(prompt).toContain('30 minutes a day, 5 days a week');
    expect(prompt).toContain('"startingPoint"');
    expect(prompt).toContain('List 2 or 3 real, established methods');
  });

  it('fixes the method for presets', () => {
    const prompt = buildRoadmapPrompt(input, { name: 'VDOT', creator: 'Jack Daniels', summary: 'Zones.' });
    expect(prompt).toContain('The method is fixed: VDOT by Jack Daniels.');
    expect(prompt).not.toContain('List 2 or 3 real');
  });

  it('asks for a focus each week and a measure only for a counted goal; never a target or a test', () => {
    const flat = buildRoadmapPrompt(input).replace(/\s+/g, ' ');
    expect(flat).toContain('"focus": what this week works on');
    expect(flat).toContain('"measure": only when the goal is counted in one number');
    expect(flat).not.toMatch(/target|weekly test|final test/i);
    expect(roadmapSystem()).not.toMatch(/target|test/i);
  });

  it('a shorter plan names its weeks and the easier week before the date', () => {
    const flat = buildRoadmapPrompt({ ...input, totalWeeks: 7 }).replace(/\s+/g, ' ');
    expect(flat).toContain('for 7 weeks');
    expect(flat).toContain('Week 7 is the easier week before their date');
  });
});

describe('generateRoadmap', () => {
  const mocked = vi.mocked(generateStructuredContent);
  beforeEach(() => mocked.mockReset());

  it('retries once with the reason and returns the roadmap', async () => {
    mocked
      .mockResolvedValueOnce({ success: true, data: answer({ safety: 1 }) } as never)
      .mockResolvedValueOnce({ success: true, data: answer() } as never);
    const result = await generateRoadmap(input);
    expect(result.ok).toBe(true);
    expect(mocked).toHaveBeenCalledTimes(2);
    expect(mocked.mock.calls[1][0]).toContain('YOUR PREVIOUS ANSWER WAS REJECTED: "safety" is 1');
  });

  it('a preset keeps its method order, and is told the plan has no weekly tests', async () => {
    mocked.mockResolvedValue({ success: true, data: answer() } as never);
    const result = await generateRoadmap({ ...input, rawGoal: 'Run a 10K under 50 minutes', workingTitle: 'Run a 10K under 50 minutes', domain: 'Running' });
    expect(result.ok).toBe(true);
    expect(mocked.mock.calls[0][0]).toContain('this plan has none (each week is written from what the person did)');
  });

  it('reports low safety, not a blocked goal, when both answers are too risky', async () => {
    mocked.mockResolvedValue({ success: true, data: answer({ safety: 2 }) } as never);
    const result = await generateRoadmap(input);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.lowSafety).toBe(true);
    expect(!result.ok && result.unsafe).toBeFalsy();
  });

  it('blocks unsafe goals before calling the model', async () => {
    const result = await generateRoadmap({ ...input, rawGoal: 'lose 20 pounds in a week with a crash diet', workingTitle: 'Crash diet' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.unsafe).toBe(true);
    expect(mocked).not.toHaveBeenCalled();
  });
});
