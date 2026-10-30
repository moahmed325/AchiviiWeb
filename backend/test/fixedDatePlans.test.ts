import { describe, it, expect } from 'vitest';
import { DEFAULT_SHAPE, planLengthFor, planShape, shapeOf } from '../src/lib/planLength.js';
import { buildRoadmapPrompt, checkRoadmapAnswer, roadmapSystem, type RawRoadmapAnswer, type RoadmapInput } from '../src/lib/ai/roadmap.js';
import { buildWeekPrompt, weekLayout, weekSystem, WEEK_SYSTEM, type WeekCallInput } from '../src/lib/ai/weekPlan.js';
import { fixedDateRoom, pastLimitMove } from '../src/lib/weekClose/breaks.js';

// B-109 (docs/features/fixed-date-plans/plan.md): a fixed date under 12 weeks away gives a shorter plan, its last week
// an easier ready week before the date. A 12-week plan is exactly as before. No weekly tests (2026-10-30): no week is a
// test week, so the shorter plan only differs in its length and its ready week.

const day = (date: string) => new Date(`${date}T00:00:00.000Z`);

describe('plan length (planLengthFor, planShape)', () => {
  it('a 12-week plan has no ready week', () => {
    expect(DEFAULT_SHAPE).toEqual({ weeks: 12, finalWeek: 12, readyWeek: null });
  });

  it.each([4, 5, 6, 7, 8, 9, 10, 11])('%i weeks: the last full week before it, and the last week ready', (weeks) => {
    expect(planShape(weeks)).toEqual({ weeks, finalWeek: weeks - 1, readyWeek: weeks });
  });

  it('anything but a whole number from 4 to 12 reads as 12 weeks', () => {
    for (const value of [null, undefined, 0, 3, 13, 6.5, '6']) expect(planShape(value)).toBe(DEFAULT_SHAPE);
    expect(shapeOf({})).toBe(DEFAULT_SHAPE);
    expect(shapeOf({ totalWeeks: 7 }).weeks).toBe(7);
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
    expect(buildRoadmapPrompt(roadmapInput)).not.toContain('their date leaves');
  });

  it('a 7-week plan names 7 weeks, its date and the ready week, and keeps the goal only when it is safe by then', () => {
    const prompt = buildRoadmapPrompt({ ...roadmapInput, totalWeeks: 7 });
    expect(prompt).toContain('5 days a week, for 7 weeks.');
    expect(prompt).toContain('right after week 7; week 7 is the easier week before it.');
    expect(prompt).toContain('their date leaves 7 weeks');
    expect(prompt.replace(/\s+/g, ' ')).toContain('"finalGoal" the furthest safe point on the way to it.');
    expect(prompt).toContain('3. THE 7 WEEKS');
    expect(prompt).toContain('"weeks": exactly 7.');
    expect(prompt).toContain('Together they cover weeks 1 to 7 with no gaps.');
    expect(prompt).toContain('Week 7 is the easier week before their date');
    expect(prompt).toContain('checked on the last day of week 7');
    expect(prompt).not.toMatch(/\b12\b|day 90/);
    expect(roadmapSystem(7)).toContain('7-week roadmap');
  });
});

function shortAnswer(weeks = 7): RawRoadmapAnswer {
  return {
    finalGoal: 'Score 70% on a full practice paper',
    startingPoint: { value: 50, description: 'About 50%.' },
    measure: { metric: 'Practice test score', unit: 'percent', direction: 'higher_is_better' },
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
    weeks: Array.from({ length: weeks }, (_, index) => ({ weekNumber: index + 1, phase: 'x', focus: `Focus ${index + 1}` })),
  };
}

describe('checkRoadmapAnswer for a shorter plan', () => {
  const context = { shape: planShape(7) };

  it('accepts 7 weeks with phases 1 to 7', () => {
    const result = checkRoadmapAnswer(shortAnswer(), context);
    expect('value' in result && result.value.weeks).toHaveLength(7);
    expect('value' in result && result.value.weeks[6].phase).toBe('Ready');
  });

  it('asks again for 12 weeks, or phases that end at week 12', () => {
    const twelve = checkRoadmapAnswer(shortAnswer(12), context);
    expect('reason' in twelve && twelve.reason).toBe('"weeks" must have exactly 7 weeks; got 12.');
    const phases = { ...shortAnswer(), phases: [{ name: 'All', startWeek: 1, endWeek: 12, purpose: 'All.' }, { name: 'B', startWeek: 13, endWeek: 13, purpose: 'B' }] };
    const longer = checkRoadmapAnswer(phases, context);
    expect('reason' in longer && longer.reason).toContain('they must end at week 7');
  });
});

describe('breaks on a shorter plan', () => {
  it('"Do my final week" on a 6-week plan goes to week 5, the last full week, never the ready week', () => {
    expect(pastLimitMove(30, 0, 3, null, planShape(6))).toEqual({ choice: 'final_week', days: 23, weekBack: 5 });
    // Closing the final week itself, the next week is the ready week.
    expect(pastLimitMove(30, 0, 5, null, planShape(6))).toMatchObject({ choice: 'final_week', weekBack: 6 });
    // Unchanged on a 12-week plan.
    expect(pastLimitMove(30, 0, 9, null)).toEqual({ choice: 'final_week', days: 16, weekBack: 12 });
  });

  it('"Keep going" never jumps past the last full week to the ready week', () => {
    // 8 weeks: the last full week is week 7. Closing week 4 after 22 days with 1 day of room lands on week 8.
    expect(pastLimitMove(22, 1, 4, 1, planShape(8))).toMatchObject({ choice: 'final_week', weekBack: 7 });
    expect(pastLimitMove(15, 1, 4, 1, planShape(8))).toMatchObject({ choice: 'keep_going', weekBack: 7 });
  });

  it('a shorter plan may move only until its last day is the day before the date', () => {
    // targetDate = the date: the last day is already the day before it.
    expect(fixedDateRoom(day('2026-12-15'), day('2026-12-15'), '2026-11-01', true)).toBe(0);
    expect(fixedDateRoom(day('2026-12-15'), day('2026-12-15'), '2026-11-01')).toBe(1);
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
    weekStart: new Date('2026-12-07T00:00:00Z'),
  };

  it('the ready week is told it is the week before their date, lighter than last week', () => {
    const prompt = buildWeekPrompt(input, weekLayout('steady', input.weekStart));
    expect(prompt).toContain('Week 7 of 7');
    expect(prompt).toContain('Ready week: their date (an exam, a race, a talk) is right after this week');
    expect(weekSystem(7)).toContain('following a 7-week plan');
  });

  it("no other week has the line, and a 12-week plan's system text is as before", () => {
    expect(buildWeekPrompt({ ...input, weekNumber: 6 }, weekLayout('steady', input.weekStart))).not.toContain('Ready week');
    expect(buildWeekPrompt({ ...input, weekNumber: 12, totalWeeks: 12 }, weekLayout('steady', input.weekStart))).not.toContain('Ready week');
    expect(weekSystem(12)).toBe(WEEK_SYSTEM);
    expect(WEEK_SYSTEM).toContain('following a 90-day plan');
  });
});
