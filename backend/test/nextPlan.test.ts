import { describe, it, expect } from 'vitest';
import { journeyResultOf, journeySummary, nextPlanStart, readPreviousPlan, MEASURED_LEVEL_ID, type JourneyGoal } from '../src/lib/nextPlan.js';
import { checkRoadmapAnswer } from '../src/lib/ai/roadmap.js';

// Next plan (docs/features/next-plan): what a finished plan reached (NP-1, NP-2, NP-5) and the level the next plan
// starts from (NP-3, NP-9, NP-10).

const RUN = [3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7, 7.5, 7.5, 8];

function runWeek(weekNumber: number, value: number, result?: number | string, extra: Record<string, unknown> = {}) {
  return {
    weekNumber,
    target: { kind: 'number', metric: 'Continuous run distance', value, unit: 'km', direction: 'higher_is_better' },
    test: { type: 'count', instructions: 'Run as far as you can.', passIf: `${value} km` },
    objective: `${value} km`,
    keyMilestone: 'Run',
    status: 'completed',
    ...(result === undefined ? {} : { testResult: { value: result, unit: 'km', passed: Number(result) >= value } }),
    ...extra,
  };
}

function runGoal(results: Record<number, number | string>, roadmapExtra: Record<string, unknown> = {}, weekExtra: Record<number, Record<string, unknown>> = {}): JourneyGoal {
  return {
    rawGoal: 'Run 8 km without stopping',
    clarifiedOutcome: 'Run 8 km without stopping',
    roadmap: { method: { name: 'Run-walk' }, finalTest: 'Run 8 km.', startingPoint: { value: 3, description: '3 km' }, ...roadmapExtra },
    roadmapWeeks: RUN.map((value, index) => runWeek(index + 1, value, results[index + 1], weekExtra[index + 1])),
  };
}

describe('journeyResultOf (NP-1, NP-2, NP-5)', () => {
  it('made it: from the starting point to week 12’s result', () => {
    const result = journeyResultOf(runGoal({ 4: 5, 8: 7, 12: 8.5 }))!;
    expect(result).toMatchObject({ kind: 'number', start: '3 km', reached: '8.5 km', reachedWeek: 12, goal: '8 km', madeIt: true, nearGoal: false });
    expect(journeySummary(result)).toBe('3 km → 8.5 km');
  });

  it('fell short far from the goal: not near', () => {
    expect(journeyResultOf(runGoal({ 12: 6 }))).toMatchObject({ reached: '6 km', madeIt: false, nearGoal: false });
  });

  it('fell short by at most one safe step: near (NP-5)', () => {
    expect(journeyResultOf(runGoal({ 12: 7.5 }))).toMatchObject({ reached: '7.5 km', madeIt: false, nearGoal: true });
  });

  it('no week 12 result: the latest measured week, skipping light and jumped weeks', () => {
    const result = journeyResultOf(
      runGoal({ 6: 5.5, 9: 7, 10: 7.5 }, {}, { 10: { jumped: true }, 9: { test: { type: 'run', instructions: 'Easy.', passIf: 'done', light: true } } })
    )!;
    expect(result).toMatchObject({ reached: '5.5 km', reachedWeek: 6 });
  });

  it('nothing logged: no result, and a next plan needs a typed level', () => {
    const result = journeyResultOf(runGoal({}))!;
    expect(result).toMatchObject({ reached: null, madeIt: false, nearGoal: false });
    expect(journeySummary(result)).toBe('12 of 12 weeks');
    expect(nextPlanStart(result, 'keep_going', null)).toBeNull();
    expect(nextPlanStart(result, 'keep_going', 4)?.value).toBe(4);
  });

  it('a checkpoint lowered week 12: judged against the full goal, the day-90 target reported beside it (NP-2)', () => {
    const goal = runGoal(
      { 12: 7 },
      { checkpoints: [{ week: 4, kind: 'lower', result: 4, planned: 5, forecast: 7, target: 8, fullGoal: 8, offered: 7, answer: 'accept', by: 'person', answeredAt: '2026-09-01' }] }
    );
    goal.roadmapWeeks![11] = runWeek(12, 7, 7);
    expect(journeyResultOf(goal)).toMatchObject({ goal: '8 km', dayNinetyTarget: '7 km', reachedDayNinety: true, madeIt: false });
  });

  it('deliverable goals: weeks finished and the last finished piece', () => {
    const goal: JourneyGoal = {
      rawGoal: 'Write a short story',
      clarifiedOutcome: 'Finish a 5,000-word story',
      roadmap: { method: { name: 'Draft' }, finalTest: 'Finished story.' },
      roadmapWeeks: Array.from({ length: 12 }, (_, index) => ({
        weekNumber: index + 1,
        target: { kind: 'deliverable', description: index === 11 ? 'Finished 5,000-word story' : `Scene ${index + 1} drafted` },
        test: { type: 'review', instructions: 'Check it.', passIf: 'done' },
        objective: 'x',
        keyMilestone: 'x',
        status: index < 11 ? 'completed' : 'active',
        testResult: index < 10 ? { value: 'done', passed: true } : undefined,
      })),
    };
    const result = journeyResultOf(goal)!;
    expect(result).toMatchObject({ kind: 'deliverable', weeksFinished: 11, lastDone: 'Scene 10 drafted', madeIt: false });
    expect(journeySummary(result)).toBe('11 of 12 weeks');
    const start = nextPlanStart(result, 'keep_going', null)!;
    expect(start.value).toBeNull();
    expect(start.answer.answer).toContain('Scene 10 drafted');
  });

  it('a goal with no v2 roadmap has none', () => {
    expect(journeyResultOf({ rawGoal: 'x', clarifiedOutcome: null, roadmap: null, roadmapWeeks: [] })).toBeNull();
  });
});

describe('nextPlanStart (NP-3, NP-9, NP-10)', () => {
  const result = journeyResultOf(runGoal({ 12: 7 }))!;

  it('keep going: the last measured result, as the measured-level answer', () => {
    const start = nextPlanStart(result, 'keep_going', null)!;
    expect(start).toMatchObject({ value: 7, unit: 'km' });
    expect(start.answer).toMatchObject({ id: MEASURED_LEVEL_ID });
    expect(start.answer.answer).toBe('7 km (that plan started at 3 km). This is where they are now; it replaces any earlier level in these answers.');
  });

  it('a level the person typed wins over the result', () => {
    expect(nextPlanStart(result, 'go_further', 6.5)?.value).toBe(6.5);
  });

  it('a fresh plan after a break always needs the level they typed', () => {
    expect(nextPlanStart(result, 'fresh', null)).toBeNull();
    expect(nextPlanStart(result, 'fresh', 5)?.value).toBe(5);
  });
});

describe('readPreviousPlan', () => {
  it('reads a stored link and ignores anything else', () => {
    expect(readPreviousPlan({ previousPlan: { goalId: 'g1', number: 2, mode: 'keep_going', summary: '3 km → 7 km' } })).toMatchObject({ number: 2 });
    expect(readPreviousPlan({ previousPlan: { goalId: 1 } })).toBeNull();
    expect(readPreviousPlan(null)).toBeNull();
  });
});

describe('the roadmap check holds the measured starting point (NP-3)', () => {
  const answer = (start: number) => ({
    finalGoal: 'Run 10 km without stopping',
    finalTest: 'Run 10 km.',
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
    weeks: [7.5, 7.5, 8, 8, 8.5, 8.5, 9, 9, 9.5, 9.5, 10, 10].map((value, index) => ({
      weekNumber: index + 1,
      phase: 'Base',
      focus: 'Run',
      target: { kind: 'number', metric: 'Continuous run distance', value, unit: 'km', direction: 'higher_is_better' },
      test: { type: 'count', instructions: 'Run as far as you can.', passIf: `${value} km` },
    })),
  });
  const context = { statedTargets: [], measuredStart: { value: 7, unit: 'km' } };

  it('a different starting point is sent back on the first attempt', () => {
    const verdict = checkRoadmapAnswer(answer(3) as never, context);
    expect(verdict).toEqual({ reason: '"startingPoint.value" must be 7 km: their level measured at the end of their last plan.' });
  });

  it('on the last attempt it is replaced with the measured level', () => {
    const verdict = checkRoadmapAnswer(answer(3) as never, context, true);
    expect('value' in verdict && verdict.value.startingPoint.value).toBe(7);
  });

  it('the measured level passes as it is', () => {
    const verdict = checkRoadmapAnswer(answer(7) as never, context);
    expect('value' in verdict && verdict.value.startingPoint.value).toBe(7);
  });
});
