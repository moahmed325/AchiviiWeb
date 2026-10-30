import { describe, it, expect } from 'vitest';
import { journeyResultOf, journeySummary, measureOf, nextPlanStart, readPreviousPlan, MEASURED_LEVEL_ID, type JourneyGoal } from '../src/lib/nextPlan.js';
import { checkRoadmapAnswer, sameUnit } from '../src/lib/ai/roadmap.js';

// Next plan (docs/features/next-plan): what a finished plan did (NP-1) and the level the next plan starts from (NP-3,
// NP-9, NP-10). No weekly tests (2026-10-30): weeks and sessions done, and a goal measured in a number always asks the
// level now.

const MEASURE = { metric: 'Continuous run distance', unit: 'km', direction: 'higher_is_better' as const };

const tasks = (done: number, planned: number, rest = 2) => [
  ...Array.from({ length: planned }, (_, index) => ({ status: index < done ? 'completed' : 'pending', isRestDay: false, notOffered: false })),
  ...Array.from({ length: rest }, () => ({ status: 'pending', isRestDay: true, notOffered: false })),
  { status: 'pending', isRestDay: false, notOffered: true },
];

function goal(roadmapExtra: Record<string, unknown> = {}, weekExtra: Record<number, Record<string, unknown>> = {}, extra: Partial<JourneyGoal> = {}): JourneyGoal {
  return {
    rawGoal: 'Run 8 km without stopping',
    clarifiedOutcome: 'Run 8 km without stopping',
    roadmap: { method: { name: 'Run-walk' }, finalGoal: 'Run 8 km without stopping', measure: MEASURE, startingPoint: { value: 3, description: '3 km' }, ...roadmapExtra },
    roadmapWeeks: Array.from({ length: 12 }, (_, index) => ({ weekNumber: index + 1, status: 'completed', ...weekExtra[index + 1] })),
    dailyTasks: tasks(52, 60),
    ...extra,
  };
}

describe('journeyResultOf (NP-1)', () => {
  it('a measured goal: its start, unit and what was done', () => {
    const result = journeyResultOf(goal({}, { 12: { status: 'active' }, 5: { jumped: true } }))!;
    expect(result).toMatchObject({ kind: 'number', start: '3 km', startValue: 3, unit: 'km', goal: 'Run 8 km without stopping', weeksFinished: 10 });
    expect(result).toMatchObject({ sessionsDone: 52, sessionsPlanned: 60 });
    expect(journeySummary(result)).toBe('10 of 12 weeks, 52 of 60 sessions');
  });

  it('a skill or thing made: kind other, no start', () => {
    const result = journeyResultOf(goal({ measure: null, startingPoint: { value: null, description: 'New to it' } }))!;
    expect(result).toMatchObject({ kind: 'other', start: null, startValue: null, unit: null });
  });

  it('a shorter plan names its weeks', () => {
    const result = journeyResultOf(goal({}, {}, { totalWeeks: 7, roadmapWeeks: Array.from({ length: 7 }, (_, i) => ({ weekNumber: i + 1, status: 'completed' })) }))!;
    expect(journeySummary(result)).toBe('7 of 7 weeks, 52 of 60 sessions');
  });

  it('no sessions: weeks only', () => {
    expect(journeySummary(journeyResultOf(goal({}, {}, { dailyTasks: [] }))!)).toBe('12 of 12 weeks');
  });

  it('a goal with no v2 roadmap or no weeks has none', () => {
    expect(journeyResultOf({ rawGoal: 'x', clarifiedOutcome: null, roadmap: null, roadmapWeeks: [] })).toBeNull();
    expect(journeyResultOf(goal({}, {}, { roadmapWeeks: [] }))).toBeNull();
  });
});

describe('measureOf: a goal made before the weekly tests went', () => {
  const target = (value: number) => ({ kind: 'number', metric: 'Continuous run distance', value, unit: 'km', direction: 'higher_is_better' });

  it('reads the last week’s stored number target when there is no measure', () => {
    expect(measureOf({ method: {} }, [{ weekNumber: 1, target: target(3) }, { weekNumber: 12, target: target(8) }])).toEqual(MEASURE);
  });

  it('none for a deliverable target, and a stored measure (or a stored null) wins', () => {
    expect(measureOf({ method: {} }, [{ weekNumber: 12, target: { kind: 'deliverable', description: 'An app' } }])).toBeNull();
    expect(measureOf({ measure: null }, [{ weekNumber: 12, target: target(8) }])).toBeNull();
    expect(measureOf({ measure: { ...MEASURE, unit: 'mi' } }, [])).toEqual({ ...MEASURE, unit: 'mi' });
  });
});

describe('nextPlanStart (NP-3, NP-9, NP-10)', () => {
  const result = journeyResultOf(goal())!;

  it('a measured goal needs the level they typed, in every mode', () => {
    expect(nextPlanStart(result, 'keep_going', null)).toBeNull();
    expect(nextPlanStart(result, 'fresh', null)).toBeNull();
    const start = nextPlanStart(result, 'go_further', 6.5)!;
    expect(start).toMatchObject({ value: 6.5, unit: 'km', answer: { id: MEASURED_LEVEL_ID } });
    expect(start.answer.answer).toBe(
      '6.5 km (that plan started at 3 km). They finished 12 of 12 weeks, 52 of 60 sessions of a plan for "Run 8 km without stopping". This is where they are now; it replaces any earlier level in these answers.'
    );
  });

  it('any other goal starts from what they did, without a level', () => {
    const other = journeyResultOf(goal({ measure: null }))!;
    const start = nextPlanStart(other, 'keep_going', null)!;
    expect(start).toMatchObject({ value: null, unit: null });
    expect(start.answer.answer).toContain('Start from there, not from the beginning.');
    expect(nextPlanStart(other, 'fresh', null)!.answer.answer).toContain('Start again at a level they can keep up.');
  });
});

describe('readPreviousPlan', () => {
  it('reads a stored link and ignores anything else', () => {
    expect(readPreviousPlan({ previousPlan: { goalId: 'g1', number: 2, mode: 'keep_going', summary: '12 of 12 weeks' } })).toMatchObject({ number: 2 });
    expect(readPreviousPlan({ previousPlan: { goalId: 1 } })).toBeNull();
    expect(readPreviousPlan(null)).toBeNull();
  });
});

describe('the roadmap check holds the level they gave (NP-3)', () => {
  const answer = (start: number, unit = 'km') => ({
    finalGoal: 'Run 10 km without stopping',
    measure: { metric: 'Continuous run distance', unit, direction: 'higher_is_better' },
    startingPoint: { value: start, description: 'Today' },
    candidates: [
      { name: 'Run-walk', creator: '', summary: 'Run and walk.', strengths: 'Easy.', weaknesses: 'Slow.' },
      { name: 'Steady runs', creator: '', summary: 'Run steady.', strengths: 'Simple.', weaknesses: 'Hard.' },
    ],
    chosen: 'Run-walk',
    whyChosen: 'Fits.',
    runnerUp: { name: '', whyLost: '' },
    safety: 4,
    rules: ['One', 'Two', 'Three', 'Four', 'Five'],
    phases: [
      { name: 'Base', startWeek: 1, endWeek: 4, purpose: 'Base.' },
      { name: 'Build', startWeek: 5, endWeek: 8, purpose: 'Build.' },
      { name: 'Peak', startWeek: 9, endWeek: 12, purpose: 'Peak.' },
    ],
    weeks: Array.from({ length: 12 }, (_, index) => ({ weekNumber: index + 1, focus: 'Run' })),
  });
  const context = { measuredStart: { value: 7, unit: 'km' } };

  it('a different starting point is sent back on the first attempt', () => {
    expect(checkRoadmapAnswer(answer(3) as never, context)).toEqual({ reason: '"startingPoint.value" must be 7 km: their level at the end of their last plan.' });
  });

  it('on the last attempt it is replaced with their level', () => {
    const verdict = checkRoadmapAnswer(answer(3) as never, context, true);
    expect('value' in verdict && verdict.value.startingPoint.value).toBe(7);
  });

  it('their level passes as it is, also written another way; another unit is left alone', () => {
    const same = checkRoadmapAnswer(answer(7, 'kilometres') as never, context);
    expect('value' in same && same.value.startingPoint.value).toBe(7);
    const miles = checkRoadmapAnswer(answer(4, 'miles') as never, context);
    expect('value' in miles && miles.value.startingPoint.value).toBe(4);
  });

  it('sameUnit: spellings, never conversions', () => {
    expect(sameUnit('km', 'Kilometres')).toBe(true);
    expect(sameUnit('reps', 'rep')).toBe(true);
    expect(sameUnit('kg', 'lb')).toBe(false);
  });
});
