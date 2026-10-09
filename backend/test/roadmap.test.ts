import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import {
  buildRoadmapPrompt,
  checkRoadmapAnswer,
  formatTarget,
  generateRoadmap,
  type RawRoadmapAnswer,
  type RoadmapInput,
} from '../src/lib/ai/roadmap.js';
import { extractStatedTargets } from '../src/lib/research/statedTarget.js';

const WPM = [15, 17, 19, 21, 24, 27, 30, 33, 35, 37, 39, 40];

function answer(overrides: Partial<RawRoadmapAnswer> = {}, values = WPM): RawRoadmapAnswer {
  return {
    finalGoal: 'Type 40 words per minute at 95% accuracy',
    finalTest: 'A 3-minute typing test at 40 wpm with 95% accuracy.',
    startingPoint: { value: 14, description: 'About 14 wpm, hunt and peck.' },
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
      'Test on the same site every week',
    ],
    phases: [
      { name: 'Accuracy', startWeek: 1, endWeek: 4, purpose: 'Learn every key without looking.' },
      { name: 'Speed', startWeek: 5, endWeek: 10, purpose: 'Add speed at the same accuracy.' },
      { name: 'Test prep', startWeek: 11, endWeek: 12, purpose: 'Rehearse the final test.' },
    ],
    weeks: values.map((value, index) => ({
      weekNumber: index + 1,
      phase: 'whatever',
      focus: `Focus ${index + 1}`,
      target: { kind: 'number', metric: 'Typing speed', value, unit: 'words per minute', direction: 'higher_is_better' },
      test: { type: 'typing_test', instructions: 'Take a 1-minute typing test.', passIf: `${value} wpm at 95% accuracy` },
    })),
    ...overrides,
  };
}

const context = { statedTargets: [] };

function reason(result: ReturnType<typeof checkRoadmapAnswer>): string {
  return 'reason' in result ? result.reason : '';
}

describe('checkRoadmapAnswer', () => {
  it('accepts a sound roadmap and takes each week\'s phase from the phase ranges', () => {
    const result = checkRoadmapAnswer(answer(), context);
    expect('value' in result).toBe(true);
    if (!('value' in result)) return;
    expect(result.value.weeks).toHaveLength(12);
    expect(result.value.weeks[0].phase).toBe('Accuracy');
    expect(result.value.weeks[4].phase).toBe('Speed');
    expect(result.value.weeks[11].phase).toBe('Test prep');
    expect(result.value.method.name).toBe('Keybr adaptive drills');
    expect(result.value.method.runnerUp?.name).toBe('Typing.com curriculum');
    expect(result.value.startingPoint.value).toBe(14);
  });

  it('sorts weeks by number and renumbers them', () => {
    const data = answer();
    const weeks = [...(data.weeks as unknown[])].reverse();
    const result = checkRoadmapAnswer({ ...data, weeks }, context);
    expect('value' in result && result.value.weeks.map((w) => w.weekNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('rejects an unsafe method even on the last attempt', () => {
    expect(reason(checkRoadmapAnswer(answer({ safety: 2 }), context, true))).toMatch(/"safety" is 2/);
  });

  it('rejects phases with a gap', () => {
    const phases = [
      { name: 'A', startWeek: 1, endWeek: 4, purpose: 'x' },
      { name: 'B', startWeek: 6, endWeek: 12, purpose: 'y' },
    ];
    expect(reason(checkRoadmapAnswer(answer({ phases }), context))).toMatch(/no gaps/);
  });

  it('rejects anything other than 12 weeks', () => {
    const data = answer();
    expect(reason(checkRoadmapAnswer({ ...data, weeks: (data.weeks as unknown[]).slice(0, 10) }, context))).toMatch(/exactly 12/);
  });

  it('rejects targets that go backwards, even on the last attempt', () => {
    const values = [...WPM];
    values[5] = 18;
    expect(reason(checkRoadmapAnswer(answer({}, values), context, true))).toMatch(/goes backwards/);
  });

  it('rejects a week with a target of 0, even on the last attempt', () => {
    const loaves = [0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3];
    const data = answer({ finalGoal: 'Bake 3 loaves', startingPoint: { value: 0, description: 'none yet' } }, loaves);
    expect(reason(checkRoadmapAnswer(data, context, true))).toMatch(/nothing to reach/);
  });

  it('rejects a unit change between weeks', () => {
    const data = answer();
    const weeks = data.weeks as Array<{ target: { unit: string } }>;
    weeks[3].target.unit = 'characters per minute';
    expect(reason(checkRoadmapAnswer(data, context, true))).toMatch(/every week must use/);
  });

  it('rejects a week 1 leap from the starting point, but lets it through on the last attempt', () => {
    const leap = [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 40];
    expect(reason(checkRoadmapAnswer(answer({}, leap), context))).toMatch(/jumps too far/);
    expect('value' in checkRoadmapAnswer(answer({}, leap), context, true)).toBe(true);
  });

  it('rejects week 1 below the starting point', () => {
    expect(reason(checkRoadmapAnswer(answer({ startingPoint: { value: 20, description: '20 wpm' } }), context))).toMatch(/below the starting point/);
  });

  it('needs a starting value for number targets', () => {
    expect(reason(checkRoadmapAnswer(answer({ startingPoint: { description: 'slow' } }), context))).toMatch(/startingPoint.value/);
  });

  it('checks lower-is-better targets the other way', () => {
    const minutes = [38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 28];
    const data = answer({ finalGoal: 'Run 5K in 28 minutes', startingPoint: { value: 40, description: '40 minutes' } }, minutes);
    for (const week of data.weeks as Array<{ target: Record<string, unknown> }>) {
      week.target.metric = '5K time';
      week.target.unit = 'minutes';
      week.target.direction = 'lower_is_better';
    }
    expect('value' in checkRoadmapAnswer(data, context)).toBe(true);
  });

  it('requires the final goal to state week 12\'s number', () => {
    expect(reason(checkRoadmapAnswer(answer({ finalGoal: 'Type much faster' }), context))).toMatch(/must state week 12/);
  });

  it('requires a number the user typed to appear in week 12', () => {
    const statedTargets = extractStatedTargets('Type 50 words per minute');
    expect(reason(checkRoadmapAnswer(answer(), { statedTargets }, true))).toMatch(/50 words per minute/);
    const met = answer({ finalGoal: 'Type 50 words per minute' }, [...WPM.slice(0, 11), 50]);
    expect('value' in checkRoadmapAnswer(met, { statedTargets })).toBe(true);
  });

  // B-21: run10k and exam answers planned a lighter week as a lower target ("Week 9's target (27) goes backwards").
  it('still rejects a lighter week that lowers the target, and says to hold it instead', () => {
    const dip = [16, 18, 20, 22, 24, 26, 28, 28, 27, 30, 35, 40];
    const problem = reason(checkRoadmapAnswer(answer({}, dip), context, true));
    expect(problem).toMatch(/Week 9's target \(27\) goes backwards from week 8 \(28\)/);
    expect(problem).toMatch(/never go down: a lighter week keeps the previous week's target/);
  });

  it('accepts a lighter week that holds the previous target', () => {
    const hold = [16, 18, 20, 22, 24, 26, 28, 28, 28, 30, 35, 40];
    expect('value' in checkRoadmapAnswer(answer({}, hold), context)).toBe(true);
  });

  describe('a number the user named that the method does not count (B-21, guitar5songs)', () => {
    const statedTargets = extractStatedTargets('Play 5 Iconic Guitar Songs from Memory');
    const SWITCHES = [15, 20, 25, 30, 32, 35, 38, 40, 42, 45, 48, 50];

    function switches(values = SWITCHES, finalGoal = 'Play 5 songs from memory with clean chord changes'): RawRoadmapAnswer {
      const data = answer({ finalGoal, startingPoint: { value: 10, description: '10 switches a minute' } }, values);
      for (const week of data.weeks as Array<{ target: Record<string, unknown> }>) {
        week.target.metric = 'Clean chord switches per minute';
        week.target.unit = 'switches';
      }
      return data;
    }

    it("names the user's number before the finalGoal check, so the retry is not told to use the method's unit", () => {
      const problem = reason(checkRoadmapAnswer(switches(), { statedTargets }));
      expect(problem).toMatch(/Week 12 must reach the number the user asked for: 5 songs/);
      expect(problem).toMatch(/use deliverables for all 12 weeks and name it in week 12's/);
      expect(problem).not.toMatch(/finalGoal/);
    });

    it("points a unit change at the user's unit", () => {
      const data = switches();
      const weeks = data.weeks as Array<{ target: Record<string, unknown> }>;
      weeks[3].target = { kind: 'number', metric: 'Songs from memory', value: 1, unit: 'songs', direction: 'higher_is_better' };
      const problem = reason(checkRoadmapAnswer(data, { statedTargets }));
      expect(problem).toMatch(/every week must use "switches"/);
      expect(problem).toMatch(/The user asked for 5 songs: count all 12 weeks in that unit, or use deliverables/);
    });

    it('accepts deliverables that name the number in week 12', () => {
      const data = switches();
      (data.weeks as Array<{ target: Record<string, unknown>; test: Record<string, unknown> }>).forEach((week, index) => {
        week.target = { kind: 'deliverable', description: index === 11 ? 'Play 5 songs from memory' : `Song work ${index + 1}` };
        week.test.type = 'video';
      });
      expect('value' in checkRoadmapAnswer(data, { statedTargets })).toBe(true);
    });

    it('accepts songs counted every week', () => {
      const songs = [1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5];
      const data = answer({ finalGoal: 'Play 5 songs from memory', startingPoint: { value: 0, description: 'no songs yet' } }, songs);
      for (const week of data.weeks as Array<{ target: Record<string, unknown> }>) {
        week.target.metric = 'Songs from memory';
        week.target.unit = 'songs';
      }
      expect('value' in checkRoadmapAnswer(data, { statedTargets })).toBe(true);
    });
  });

  it('dedupes rules, caps them at 8, and rejects fewer than 5', () => {
    const many = Array.from({ length: 10 }, (_, i) => `Rule number ${i + 1}`);
    const result = checkRoadmapAnswer(answer({ rules: [...many, 'Rule number 1'] }), context);
    expect('value' in result && result.value.method.rules).toHaveLength(8);
    expect(reason(checkRoadmapAnswer(answer({ rules: ['a', 'b', 'c'] }), context))).toMatch(/"rules" needs/);
  });

  it('rejects a chosen method that is not a candidate', () => {
    expect(reason(checkRoadmapAnswer(answer({ chosen: 'Something else' }), context))).toMatch(/must be the name of one of the candidates/);
  });

  it('asks for one test type every week, unless it is the last attempt', () => {
    const data = answer();
    (data.weeks as Array<{ test: { type: string } }>)[11].test.type = 'video';
    expect(reason(checkRoadmapAnswer(data, context))).toMatch(/same test type/);
    expect('value' in checkRoadmapAnswer(data, context, true)).toBe(true);
  });

  it('accepts deliverable targets with no starting value', () => {
    const data = answer({ finalGoal: 'One loaf with an open crumb', startingPoint: { value: 3, description: 'Never baked' } });
    for (const week of data.weeks as Array<{ target: Record<string, unknown>; test: Record<string, unknown> }>) {
      week.target = { kind: 'deliverable', description: 'A loaf that rises' };
      week.test.type = 'photo';
    }
    const result = checkRoadmapAnswer(data, context);
    expect('value' in result && result.value.startingPoint.value).toBe(null);
  });

  it('fills the method from the fixed preset method', () => {
    const fixedMethod = { name: 'Jack Daniels VDOT', creator: 'Jack Daniels', summary: 'Paced zones.' };
    const result = checkRoadmapAnswer(answer({ candidates: [], chosen: '' }), { statedTargets: [], fixedMethod });
    expect('value' in result && result.value.method.name).toBe('Jack Daniels VDOT');
    expect('value' in result && result.value.method.runnerUp).toBe(null);
  });
});

describe('formatTarget', () => {
  it('writes numbers and deliverables plainly', () => {
    expect(formatTarget({ kind: 'number', metric: 'Typing speed', value: 25, unit: 'wpm', direction: 'higher_is_better' })).toBe('Typing speed: 25 wpm');
    expect(formatTarget({ kind: 'number', metric: '5K time', value: 30, unit: 'minutes', direction: 'lower_is_better' })).toBe('5K time: 30 minutes or less');
    expect(formatTarget({ kind: 'deliverable', description: 'One open-crumb loaf' })).toBe('One open-crumb loaf');
    expect(formatTarget({ kind: 'number', metric: 'words per minute', value: 30, unit: 'wpm', direction: 'higher_is_better' })).toBe('30 wpm');
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

  // B-21: "ease off before the final test" invited a lower target, which the climb check rejects.
  it('lets steps shrink before the final test but never lets a target go down', () => {
    const prompt = buildRoadmapPrompt(input);
    expect(prompt).not.toContain('ease off');
    expect(prompt).toContain('smaller again before the final test');
    const flat = prompt.replace(/\s+/g, ' ');
    expect(flat).toContain(
      "A lighter week (a taper, a deload, a review week) or a harder test (a full mock exam after topic quizzes) keeps the previous week's target; it never lowers it.",
    );
    expect(flat).toContain("If their answer uses another measure (a 5K time for a 10K goal), convert it to the targets' metric.");
  });

  it("names the user's own number up front, and only when there is one", () => {
    const statedTargets = extractStatedTargets('Play 5 Iconic Guitar Songs from Memory');
    const prompt = buildRoadmapPrompt(input, undefined, statedTargets);
    expect(prompt).toContain(`They named a number: "5 songs". Week 12's target must reach it.`);
    expect(prompt).toContain('They named "5 songs": count every week in that unit, or use deliverables. Never another unit.');
    expect(buildRoadmapPrompt(input)).not.toContain('They named');
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

  it('puts a number from the goal into the first prompt (B-21)', async () => {
    mocked.mockResolvedValue({ success: true, data: answer({ finalGoal: 'Type 50 words per minute' }, [...WPM.slice(0, 11), 50]) } as never);
    const result = await generateRoadmap({ ...input, rawGoal: 'Type 50 words per minute' });
    expect(result.ok).toBe(true);
    expect(mocked.mock.calls[0][0]).toContain('They named a number: "50 words per minute"');
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
