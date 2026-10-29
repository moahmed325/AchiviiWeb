import { describe, it, expect } from 'vitest';
import { ANY_CHECKPOINT_WEEKS, checkWeekFor, DEFAULT_SHAPE, planLengthFor, planShape, shapeOf } from '../src/lib/planLength.js';
import { buildRoadmapPrompt, checkRoadmapAnswer, roadmapSystem, withPathwayTests, type RawRoadmapAnswer, type RoadmapInput } from '../src/lib/ai/roadmap.js';
import { buildWeekPrompt, weekLayout, weekSystem, WEEK_SYSTEM, type WeekCallInput } from '../src/lib/ai/weekPlan.js';
import { safeStoredTargets, type StoredWeek } from '../src/lib/safety/storedTargets.js';
import { acceptedWeeks } from '../src/lib/weekClose/checkpoint.js';
import { pastLimitMove, restartLevel } from '../src/lib/weekClose/breaks.js';
import { nextWeekIsLast, buildWeeklyUpdatePrompt } from '../src/lib/ai/weeklyUpdate.js';
import { findPresetForGoal } from '../src/lib/ai/presets/index.js';

// B-109 (docs/features/fixed-date-plans/plan.md): a fixed date under 12 weeks away gives a shorter plan, with the final
// test in the week before the last and an easier ready week after it. A 12-week plan is exactly as before.

const day = (date: string) => new Date(`${date}T00:00:00.000Z`);

describe('plan length (planLengthFor, planShape)', () => {
  it('a 12-week plan has big tests in weeks 4, 8 and 12, checkpoints after 4 and 8 and no ready week', () => {
    expect(DEFAULT_SHAPE).toEqual({ weeks: 12, finalWeek: 12, bigWeeks: [4, 8, 12], checkpointWeeks: [4, 8], readyWeek: null });
  });

  it.each([
    [4, 3, [3], []],
    [5, 4, [4], []],
    [6, 5, [5], []],
    [7, 6, [6], []],
    [8, 7, [3, 7], [3]],
    [9, 8, [4, 8], [4]],
    [10, 9, [5, 9], [5]],
    [11, 10, [6, 10], [6]],
  ])('%i weeks: the final test in week %i, big tests %j, checkpoints %j, the last week ready', (weeks, finalWeek, bigWeeks, checkpointWeeks) => {
    expect(planShape(weeks)).toEqual({ weeks, finalWeek, bigWeeks, checkpointWeeks, readyWeek: weeks });
  });

  it('anything but a whole number from 4 to 12 reads as 12 weeks', () => {
    for (const value of [null, undefined, 0, 3, 13, 6.5, '6']) expect(planShape(value)).toBe(DEFAULT_SHAPE);
    expect(shapeOf({})).toBe(DEFAULT_SHAPE);
    expect(shapeOf({ totalWeeks: 7 }).weeks).toBe(7);
  });

  it('every checkpoint week of any length, and only those, is in ANY_CHECKPOINT_WEEKS', () => {
    expect(ANY_CHECKPOINT_WEEKS).toEqual([3, 4, 5, 6, 8]);
  });

  it('each week builds toward its next big week; the ready week shows the final week', () => {
    const seven = planShape(7);
    expect([1, 2, 3, 4, 5, 6, 7].map((week) => checkWeekFor(week, seven))).toEqual([6, 6, 6, 6, 6, 6, 6]);
    const ten = planShape(10);
    expect([1, 5, 6, 9, 10].map((week) => checkWeekFor(week, ten))).toEqual([5, 5, 9, 9, 9]);
    expect([1, 4, 5, 12].map((week) => checkWeekFor(week))).toEqual([4, 4, 8, 12]);
  });

  it('no date, or one 90 or more days away, is 12 weeks ending on day 90', () => {
    const start = day('2026-10-28');
    expect(planLengthFor(start, null)).toEqual({ weeks: 12, targetDate: day('2027-01-26') });
    expect(planLengthFor(start, day('2027-03-01'))).toEqual({ weeks: 12, targetDate: day('2027-01-26') });
  });

  it('84 to 89 days away is 12 weeks whose last day is the day before the date', () => {
    expect(planLengthFor(day('2026-10-28'), day('2027-01-20'))).toEqual({ weeks: 12, targetDate: day('2027-01-20') });
  });

  it('28 to 83 days away gives the whole weeks before the date, ending the day before it at the latest', () => {
    const start = day('2026-10-28');
    expect(planLengthFor(start, day('2026-11-25'))).toEqual({ weeks: 4, targetDate: day('2026-11-25') });
    expect(planLengthFor(start, day('2026-12-15'))).toEqual({ weeks: 6, targetDate: day('2026-12-15') });
    expect(planLengthFor(start, day('2027-01-19'))).toEqual({ weeks: 11, targetDate: day('2027-01-19') });
  });

  it('under 4 weeks away is too close', () => {
    expect(planLengthFor(day('2026-10-28'), day('2026-11-24'))).toEqual({ tooClose: true });
  });
});

const roadmapInput: RoadmapInput = {
  workingTitle: 'Pass the chemistry exam',
  domain: 'exam',
  rawGoal: 'Pass my chemistry exam',
  dailyMinutes: 45,
  activeDays: 5,
  answers: [{ id: 'current_level', question: 'Level?', answer: 'About 50% on practice papers' }],
};

describe('the roadmap call for a shorter plan', () => {
  it('a 12-week plan gets exactly the prompt it got before (no totalWeeks key)', () => {
    expect(buildRoadmapPrompt({ ...roadmapInput, totalWeeks: 12 })).toBe(buildRoadmapPrompt(roadmapInput));
    expect(roadmapSystem(12)).toBe(roadmapSystem());
    expect(roadmapSystem()).toContain('12-week roadmap');
    expect(roadmapSystem()).toContain('checkable 90-day goal');
  });

  it('a 7-week plan names 7 weeks, its date, the final test in week 6 and the ready week', () => {
    const prompt = buildRoadmapPrompt({ ...roadmapInput, totalWeeks: 7 });
    expect(prompt).toContain('5 days a week, for 7 weeks.');
    expect(prompt).toContain('The final test is in week 6; week 7 is the ready week before the date.');
    expect(prompt).toContain('3. THE 7 WEEKS');
    expect(prompt).toContain('"weeks": exactly 7.');
    expect(prompt).toContain('Together they cover weeks 1 to 7 with no gaps.');
    expect(prompt).toContain('full mock exam in week 6 both report');
    expect(prompt).toContain("Week 6's target is the finalGoal.");
    expect(prompt).toContain("Week 7 is the ready week before their date");
    expect(prompt).toContain('checked on the last day of week 6');
    expect(prompt).not.toMatch(/\b12\b|day 90/);
    expect(roadmapSystem(7)).toContain('7-week roadmap');
  });

  it('a 10-week plan names its big tests, weeks 5 and 9', () => {
    const prompt = buildRoadmapPrompt({ ...roadmapInput, totalWeeks: 10 });
    expect(prompt).toContain('full mock exam in weeks 5 and 9 both report');
    expect(prompt).toContain('the harder test in week 5 or 9 keeps');
  });
});

const climb = [52, 55, 58, 62, 66, 70, 70];

function shortAnswer(values = climb): RawRoadmapAnswer {
  return {
    finalGoal: 'Score 70% on a full practice paper',
    finalTest: 'A full past paper under exam conditions.',
    startingPoint: { value: 50, description: 'About 50%.' },
    candidates: [
      { name: 'Retrieval practice', creator: '', summary: 'Self-testing.', strengths: 'Proven.', weaknesses: 'Hard.' },
      { name: 'Rereading notes', creator: '', summary: 'Review.', strengths: 'Easy.', weaknesses: 'Weak.' },
    ],
    chosen: 'Retrieval practice',
    whyChosen: 'They test at 50% and want 70%.',
    runnerUp: { name: 'Rereading notes', whyLost: 'Weaker results.' },
    safety: 5,
    rules: ['Test before rereading', 'Space topics out', 'Mark every paper', 'Fix errors the same day', 'Sleep before the exam'],
    phases: [
      { name: 'Cover', startWeek: 1, endWeek: 3, purpose: 'Cover every topic.' },
      { name: 'Papers', startWeek: 4, endWeek: 6, purpose: 'Full papers.' },
      { name: 'Ready', startWeek: 7, endWeek: 7, purpose: 'Arrive rested.' },
    ],
    weeks: values.map((value, index) => ({
      weekNumber: index + 1,
      phase: 'x',
      focus: `Focus ${index + 1}`,
      target: { kind: 'number', metric: 'Practice test score', value, unit: 'percent', direction: 'higher_is_better' },
      test: { type: 'quiz', instructions: 'A short quiz.', passIf: `${value}%` },
    })),
  };
}

describe('checkRoadmapAnswer for a shorter plan', () => {
  const context = { statedTargets: [], shape: planShape(7) };

  it('accepts 7 weeks with phases 1 to 7', () => {
    const result = checkRoadmapAnswer(shortAnswer(), context);
    expect('value' in result && result.value.weeks).toHaveLength(7);
  });

  it('asks again for 12 weeks, or phases that end at week 12', () => {
    const twelve = checkRoadmapAnswer(shortAnswer([52, 54, 56, 58, 60, 62, 64, 66, 67, 68, 69, 70]), context);
    expect('reason' in twelve && twelve.reason).toBe('"weeks" must have exactly 7 weeks; got 12.');
    const phases = { ...shortAnswer(), phases: [{ name: 'All', startWeek: 1, endWeek: 12, purpose: 'All.' }, { name: 'B', startWeek: 13, endWeek: 13, purpose: 'B' }] };
    const longer = checkRoadmapAnswer(phases, context);
    expect('reason' in longer && longer.reason).toContain('they must end at week 7');
  });

  it('the ready week always keeps the final week\'s target, even when the model lowered it for the taper', () => {
    const result = checkRoadmapAnswer(shortAnswer([52, 55, 58, 62, 66, 70, 60]), context);
    expect('value' in result).toBe(true);
    if (!('value' in result)) return;
    expect(result.value.weeks[6].target).toEqual(result.value.weeks[5].target);
  });

  it('asks for the finalGoal to state week 6\'s target', () => {
    const result = checkRoadmapAnswer({ ...shortAnswer(), finalGoal: 'Pass the exam' }, context);
    expect('reason' in result && result.reason).toBe('"finalGoal" must state week 6\'s target (Practice test score: 70 percent).');
  });

  it('a pathway with light tests: the final week is measured, every other week (the ready week too) light', () => {
    const preset = findPresetForGoal('run a 10k')!;
    const roadmap = checkRoadmapAnswer(shortAnswer(), context);
    if (!('value' in roadmap)) throw new Error('not accepted');
    const { targetCheck: _t, ...plain } = roadmap.value;
    const tested = withPathwayTests(plain, preset, planShape(7));
    expect(tested.weeks.map((week) => week.test.light === true)).toEqual([true, true, true, true, true, false, true]);
    expect(tested.weeks[6].target).toEqual(tested.weeks[5].target);
    expect(tested.finalTest).toBe(tested.weeks[5].test.instructions);
  });
});

const row = (weekNumber: number, value: number, extra: Partial<StoredWeek> = {}): StoredWeek & { weekNumber: number } => ({
  weekNumber,
  target: { kind: 'number', metric: 'Practice test score', value, unit: 'percent', direction: 'higher_is_better' },
  test: { type: 'quiz', instructions: 'A short quiz.', passIf: `${value} percent` },
  objective: `${value} percent`,
  keyMilestone: `A short quiz. Pass if: ${value} percent`,
  ...extra,
});

describe('stored targets, checkpoints and breaks on a shorter plan', () => {
  it('safeStoredTargets reads 7 rows on a 7-week plan, and 7 rows as stored on a 12-week reading', () => {
    const rows = climb.map((value, index) => row(index + 1, value));
    expect(safeStoredTargets({ weeks: rows, startValue: 50, finalTest: '', pathway: null, shape: planShape(7) }).weeks).toEqual(rows);
  });

  it('a ready week whose stored target drifted from the final week\'s reads as the final week\'s, and is not a lowering', () => {
    const rows = [...climb.slice(0, 6), 75].map((value, index) => row(index + 1, value));
    const read = safeStoredTargets({ weeks: rows, startValue: 50, finalTest: '', pathway: null, shape: planShape(7) });
    expect((read.weeks[6].target as { value: number }).value).toBe(70);
    expect(read.foundNow).toEqual([]);
  });

  it('an accepted checkpoint on an 8-week plan spreads to week 7 and the ready week keeps it', () => {
    const rows = [52, 55, 58, 61, 64, 67, 70, 70].map((value, index) => row(index + 1, value, index < 3 ? { status: 'completed' } : {}));
    const spread = acceptedWeeks(rows, 4, 66, 'lower', null, planShape(8));
    expect(spread?.weeks.map((week) => [week.weekNumber, (week.target as { value: number }).value])).toEqual([
      [5, 62],
      [6, 64],
      [7, 66],
      [8, 66],
    ]);
  });

  it('"Do my final week" on a 6-week plan goes to week 5, the final test, never the ready week', () => {
    expect(pastLimitMove(30, 0, 3, null, planShape(6))).toEqual({ choice: 'final_week', days: 23, weekBack: 5 });
    // Closing the final week itself, the next week is the ready week.
    expect(pastLimitMove(30, 0, 5, null, planShape(6))).toMatchObject({ choice: 'final_week', weekBack: 6 });
    // Unchanged on a 12-week plan.
    expect(pastLimitMove(30, 0, 9, null)).toEqual({ choice: 'final_week', days: 16, weekBack: 12 });
  });

  it('a first week back that shows the final week\'s target restarts at none (as week 12 on a 12-week plan)', () => {
    const weeks = climb.map((value, index) => ({ weekNumber: index + 1, target: row(index + 1, value).target, light: false }));
    expect(restartLevel(null, 10, 4, weeks, 6, 6)).toBeNull();
    expect(restartLevel(null, 10, 3, weeks, 5, 6)).not.toBeNull();
  });
});

describe('the weekly update on a shorter plan', () => {
  const target = { kind: 'number' as const, metric: 'Practice test score', value: 62, unit: 'percent', direction: 'higher_is_better' as const };
  const weeksLeft = [5, 6].map((weekNumber) => ({ weekNumber, target: { ...target, value: weekNumber === 6 ? 70 : 66 }, light: false }));

  it('names week 6 as the week that stays at the goal', () => {
    const input = {
      finalGoal: 'Score 70%',
      method: { name: 'Retrieval practice', creator: '', summary: '', rules: ['Test first'] },
      weekNumber: 4,
      target,
      lightTest: false,
      lightTestGoal: false,
      result: '62%',
      testLogged: true,
      lowerBound: 62,
      counts: { sessions: 5, planned: 5, completed: 5, score: 100 },
      reflection: '',
      history: [],
      weeksLeft,
      safeMax: null,
      finalWeek: 6,
    } as never;
    expect(buildWeeklyUpdatePrompt(input)).toContain('Week 6 stays exactly Practice test score: 70 percent.');
    expect(buildWeeklyUpdatePrompt(input)).not.toContain('week 12');
    expect(nextWeekIsLast({ weekNumber: 5, weeksLeft: weeksLeft.slice(1), finalWeek: 6 })).toBe(true);
    expect(nextWeekIsLast({ weekNumber: 4, weeksLeft, finalWeek: 6 })).toBe(false);
  });
});

describe('the week call on a shorter plan', () => {
  const input: WeekCallInput = {
    finalGoal: 'Score 70% on a full practice paper',
    answers: [],
    dailyMinutes: 45,
    planVariant: 'steady',
    slotTime: '19:30',
    method: { name: 'Retrieval practice', creator: '', rules: ['Test before rereading'] },
    weekNumber: 7,
    totalWeeks: 7,
    phase: { name: 'Ready', purpose: 'Arrive rested.' },
    focus: 'Sharpen',
    target: { kind: 'number', metric: 'Practice test score', value: 70, unit: 'percent', direction: 'higher_is_better' },
    test: { type: 'quiz', instructions: 'A short quiz', passIf: '70 percent' },
    weekStart: new Date('2026-12-07T00:00:00Z'),
  };

  it('the ready week is told it is the week before their date, lighter than last week', () => {
    const prompt = buildWeekPrompt(input, weekLayout('steady', input.weekStart));
    expect(prompt).toContain('Week 7 of 7');
    expect(prompt).toContain('Ready week: their date (an exam, a race, a talk) is right after this week');
    expect(weekSystem(7)).toContain('following a 7-week plan');
  });

  it('no other week has the line, and a 12-week plan\'s system text is as before', () => {
    expect(buildWeekPrompt({ ...input, weekNumber: 6 }, weekLayout('steady', input.weekStart))).not.toContain('Ready week');
    expect(buildWeekPrompt({ ...input, weekNumber: 12, totalWeeks: 12 }, weekLayout('steady', input.weekStart))).not.toContain('Ready week');
    expect(weekSystem(12)).toBe(WEEK_SYSTEM);
    expect(WEEK_SYSTEM).toContain('following a 90-day plan');
  });
});

describe('the day-90 line on a shorter plan', () => {
  it('names the final week instead of day 90', async () => {
    const { dayNinetyPromptLine } = await import('../src/lib/ai/dayNinety.js');
    expect(dayNinetyPromptLine({ target: '66 percent', goal: '70 percent' })).toBe('Day-90 target: 66 percent (their goal: 70 percent); aim the plan at the day-90 target.');
    expect(dayNinetyPromptLine({ target: '66 percent', goal: '70 percent', finalWeek: 7 })).toBe(
      'Final target (week 7): 66 percent (their goal: 70 percent); aim the plan at the final target.'
    );
  });
});
