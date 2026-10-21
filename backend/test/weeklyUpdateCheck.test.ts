import { describe, it, expect } from 'vitest';
import {
  askedWeeks,
  buildWeeklyUpdatePrompt,
  checkWeeklyUpdate,
  sentenceReason,
  type RawWeeklyUpdate,
  type UpdateKind,
  type WeeklyUpdateInput,
} from '../src/lib/ai/weeklyUpdate.js';
import type { WeekTarget } from '../src/lib/ai/roadmap.js';

// Weekly update M3.1 (RULE-4, RULE-7, WU-11, WU-15, WU-20 (3), WU-45): the code checks on the update's answer. Pure.

const km = (value: number): WeekTarget => ({ kind: 'number', metric: 'Weekly running distance', value, unit: 'km', direction: 'higher_is_better' });
const text = (description: string): WeekTarget => ({ kind: 'deliverable', description });

/** Week `n` closing on a plan climbing 1 km a week from 10 (week 1) to 21 (week 12). */
function input(n = 3, over: Partial<WeeklyUpdateInput> = {}): WeeklyUpdateInput {
  const weeksLeft = Array.from({ length: 12 - n }, (_, i) => ({ weekNumber: n + 1 + i, target: km(10 + n + i), light: false }));
  return {
    finalGoal: 'Run 21 km a week',
    method: { name: 'Ten percent rule', rules: ['Add at most 10% a week'] },
    weekNumber: n,
    target: km(9 + n),
    lightTest: false,
    lightTestGoal: false,
    result: 'test logged: 12 km, passed',
    testLogged: true,
    lowerBound: 9 + n,
    counts: { practiceDone: 4, practicePlanned: 5, detail: { keyDone: 1, keySkipped: 0, keySkippedNames: [], doneByMinimum: 0, missed: 1, dropped: 0 } },
    reflection: '',
    history: [],
    weeksLeft,
    safeMax: { weekNumber: n + 1, value: 10 + n + 0.2 },
    ...over,
  };
}

/** An answer that keeps the plan as it is. */
function answer(i: WeeklyUpdateInput, over: Partial<RawWeeklyUpdate> = {}, values?: number[]): RawWeeklyUpdate {
  return {
    status: 'on_track',
    nextTargets: askedWeeks(i).map((week, index) =>
      week.target.kind === 'number'
        ? { weekNumber: week.weekNumber, kind: 'number', metric: week.target.metric, value: values?.[index] ?? week.target.value, unit: week.target.unit }
        : { weekNumber: week.weekNumber, kind: 'deliverable', description: week.target.description }
    ),
    messageToUser: 'Next week builds on this one.',
    guidanceForNextWeek: 'Keep the long run easy.',
    ...over,
  };
}

const reasonsOf = (result: ReturnType<typeof checkWeeklyUpdate>) => ('reasons' in result ? result.reasons.join(' | ') : '');
const behind = (over: Partial<UpdateKind> = {}): UpdateKind => ({ name: 'new material', position: 'Lesson 4', stepsBehind: 3, sessions: 3, weekBehind: true, ...over });

describe('an answer that keeps the rules is accepted', () => {
  it('keeps the plan; every week left comes back in order', () => {
    const i = input();
    const result = checkWeeklyUpdate(answer(i), i);
    expect('value' in result && result.value).toMatchObject({ status: 'on_track', messageToUser: 'Next week builds on this one.', guidanceForNextWeek: 'Keep the long run easy.' });
    expect('value' in result && result.value.targets.map((t) => t.weekNumber)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('a raise after a strong test passes', () => {
    const i = input();
    expect('value' in checkWeeklyUpdate(answer(i, {}, [13, 14, 15, 16, 17, 18, 19, 20, 21]), i)).toBe(true);
  });

  it('a_bit_behind may make next week lower than this week, above the last result', () => {
    const i = input(3, { lowerBound: 11 });
    expect('value' in checkWeeklyUpdate(answer(i, { status: 'a_bit_behind' }, [11.5, 12.5, 14, 15, 16, 17, 18, 20, 21]), i)).toBe(true);
  });
});

describe('RULE-4 rejections', () => {
  it('the count is wrong', () => {
    const i = input();
    const raw = answer(i);
    (raw.nextTargets as unknown[]).pop();
    expect(reasonsOf(checkWeeklyUpdate(raw, i))).toMatch(/exactly one target for each of weeks 4, 5, 6, 7, 8, 9, 10, 11, 12/);
  });

  it('a week out of order', () => {
    const i = input();
    const raw = answer(i);
    const list = raw.nextTargets as unknown[];
    [list[0], list[1]] = [list[1], list[0]];
    expect(reasonsOf(checkWeeklyUpdate(raw, i))).toMatch(/in order; got weeks 5, 4/);
  });

  it("a week's kind, metric or unit changes", () => {
    const i = input();
    const kind = answer(i);
    (kind.nextTargets as any[])[2] = { weekNumber: 6, kind: 'deliverable', description: 'Run' };
    expect(reasonsOf(checkWeeklyUpdate(kind, i))).toMatch(/week 6's kind changed/);
    const metric = answer(i);
    (metric.nextTargets as any[])[2].metric = 'Long run';
    expect(reasonsOf(checkWeeklyUpdate(metric, i))).toMatch(/week 6's metric changed/);
    const unit = answer(i);
    (unit.nextTargets as any[])[2].unit = 'mi';
    expect(reasonsOf(checkWeeklyUpdate(unit, i))).toMatch(/week 6's unit changed/);
  });

  it('a target easier than the last result', () => {
    const i = input(3, { lowerBound: 13 });
    expect(reasonsOf(checkWeeklyUpdate(answer(i, {}, [12.5]), i))).toMatch(/week 4's 12.5 km is easier than what they last achieved \(13 km\)/);
  });

  it('no bound when there is no usable result', () => {
    const i = input(3, { lowerBound: null, testLogged: true });
    expect('value' in checkWeeklyUpdate(answer(i, { status: 'a_bit_behind' }, [11]), i)).toBe(true);
  });

  it('a week easier than the one before', () => {
    const i = input();
    expect(reasonsOf(checkWeeklyUpdate(answer(i, {}, [13, 12.5]), i))).toMatch(/week 5's 12.5 km is easier than the week before it \(13 km\)/);
  });

  it('a week before 12 harder than week 12', () => {
    const i = input();
    expect(reasonsOf(checkWeeklyUpdate(answer(i, {}, [13, 14, 15, 16, 17, 18, 19, 22, 21]), i))).toMatch(/week 11's 22 km is harder than week 12's 21 km/);
  });

  it('week 12 is not its current target', () => {
    const i = input();
    expect(reasonsOf(checkWeeklyUpdate(answer(i, {}, [12, 13, 14, 15, 16, 17, 18, 19, 20]), i))).toMatch(/week 12 must stay exactly 21 km/);
  });

  it("far_behind and next week is not this week's target", () => {
    const i = input();
    expect(reasonsOf(checkWeeklyUpdate(answer(i, { status: 'far_behind' }), i))).toMatch(/far_behind, so week 4's target must equal this week's \(12 km\)/);
    expect('value' in checkWeeklyUpdate(answer(i, { status: 'far_behind' }, [12]), i)).toBe(true);
  });

  it('an in-order kind a week behind blocks a raise (WU-11)', () => {
    const i = input(3, { kinds: [behind()] });
    expect(reasonsOf(checkWeeklyUpdate(answer(i), i))).toMatch(/must not be higher than this week's \(12 km\) because they are a week behind in new material/);
    expect('value' in checkWeeklyUpdate(answer(i, {}, [12]), i)).toBe(true);
  });

  it('a kind a week behind still lets a lower target another rule allows pass', () => {
    const i = input(3, { kinds: [behind()], lowerBound: 11 });
    expect('value' in checkWeeklyUpdate(answer(i, { status: 'a_bit_behind' }, [11.5]), i)).toBe(true);
  });

  it('a kind one step behind does not block a raise (AC-15)', () => {
    const i = input(3, { kinds: [behind({ stepsBehind: 1, weekBehind: false })] });
    expect('value' in checkWeeklyUpdate(answer(i, {}, [13, 14]), i)).toBe(true);
  });

  it('the test was not logged and next week is higher (WU-45 (4))', () => {
    const i = input(3, { testLogged: false, result: 'not logged', lowerBound: null });
    expect(reasonsOf(checkWeeklyUpdate(answer(i), i))).toMatch(/must not be higher than this week's \(12 km\) because the test was not logged/);
    expect('value' in checkWeeklyUpdate(answer(i, {}, [12]), i)).toBe(true);
  });

  it('a sentence with a forbidden word or a question (WU-45 (6))', () => {
    const i = input();
    expect(reasonsOf(checkWeeklyUpdate(answer(i, { messageToUser: 'You fell behind a little, so next week is easier.' }), i))).toMatch(/uses the word "behind"/);
    expect(reasonsOf(checkWeeklyUpdate(answer(i, { messageToUser: 'Why did the week go this way?' }), i))).toMatch(/asks a question/);
    expect(reasonsOf(checkWeeklyUpdate(answer(i, { messageToUser: '' }), i))).toMatch(/is empty/);
    for (const word of ['missed', 'Failed', 'fail', 'failing']) expect(sentenceReason(`You ${word} it.`)).toMatch(/uses the word/);
    expect(sentenceReason('Next week keeps the same target.')).toBeNull();
  });

  it('a bad status', () => {
    const i = input();
    expect(reasonsOf(checkWeeklyUpdate(answer(i, { status: 'great' }), i))).toMatch(/"status" must be one of/);
  });
});

describe('week 12 comes first (WU-15): no hold when next week is week 12', () => {
  const i = input(11, { kinds: [behind()], testLogged: false, lowerBound: null });

  it('far_behind, an unlogged test and a kind a week behind all let week 12 keep the goal', () => {
    expect('value' in checkWeeklyUpdate(answer(i, { status: 'far_behind' }), i)).toBe(true);
  });

  it('the prompt says week 12 keeps the goal and states no hold', () => {
    const prompt = buildWeeklyUpdatePrompt(i);
    expect(prompt).toContain("Week 12 shows week 12's target: it keeps the goal whatever the status");
    expect(prompt).not.toContain('far_behind: week 12');
    expect(prompt).not.toContain('The test was not logged');
  });
});

describe('deliverable targets (WU-20 (3))', () => {
  const weeksLeft = [5, 6, 7, 8, 9, 10, 11, 12].map((weekNumber) => ({ weekNumber, target: text(weekNumber === 12 ? 'Publish the book' : `Draft chapter ${weekNumber}`), light: false }));
  const i = input(4, { target: text('Draft chapter 4'), weeksLeft, lowerBound: null, safeMax: null });

  it('a changed plan with week 12 unchanged passes', () => {
    const raw = answer(i);
    (raw.nextTargets as any[])[0].description = 'Draft chapter 4 and 5';
    expect('value' in checkWeeklyUpdate(raw, i)).toBe(true);
  });

  it("week 12's text must stay", () => {
    const raw = answer(i);
    (raw.nextTargets as any[])[7].description = 'Publish half the book';
    expect(reasonsOf(checkWeeklyUpdate(raw, i))).toMatch(/week 12 must stay exactly "Publish the book"/);
  });

  it("a held week repeats this week's text exactly", () => {
    const raw = answer(i, { status: 'far_behind' });
    expect(reasonsOf(checkWeeklyUpdate(raw, i))).toMatch(/week 5 must repeat this week's target exactly \("Draft chapter 4"\) because the status is far_behind/);
    (raw.nextTargets as any[])[0].description = 'Draft chapter 4';
    expect('value' in checkWeeklyUpdate(raw, i)).toBe(true);
  });

  it('the count and the kind are checked', () => {
    const raw = answer(i);
    (raw.nextTargets as any[])[1] = { weekNumber: 6, kind: 'number', metric: 'Words', value: 3, unit: 'words' };
    expect(reasonsOf(checkWeeklyUpdate(raw, i))).toMatch(/week 6's kind changed/);
  });
});

describe('a light-test goal (WU-45 (2))', () => {
  // Weeks 4, 8 and 12 are big: 12, 16 and 20 km. Light weeks show their next big week's target.
  const big: Record<number, number> = { 4: 12, 8: 16, 12: 20 };
  const shows = (week: number) => big[week <= 4 ? 4 : week <= 8 ? 8 : 12];
  const weeksLeft = [6, 7, 8, 9, 10, 11, 12].map((weekNumber) => ({ weekNumber, target: km(shows(weekNumber)), light: ![8, 12].includes(weekNumber) }));
  const i = input(5, { target: km(16), lightTest: true, lightTestGoal: true, lowerBound: 12, weeksLeft, result: 'light test done', safeMax: { weekNumber: 8, value: 17.6 } });

  it('the model sets only the big weeks left; code fills each light week from its next big week', () => {
    expect(askedWeeks(i).map((w) => w.weekNumber)).toEqual([8, 12]);
    const result = checkWeeklyUpdate(answer(i, { status: 'a_bit_behind' }, [15, 20]), i);
    expect('value' in result && result.value.targets.map((t) => [t.weekNumber, (t.target as any).value])).toEqual([
      [6, 15],
      [7, 15],
      [8, 15],
      [9, 20],
      [10, 20],
      [11, 20],
      [12, 20],
    ]);
  });

  it("a hold compares the target each week shows: far_behind keeps week 8 at this week's 16", () => {
    expect(reasonsOf(checkWeeklyUpdate(answer(i, { status: 'far_behind' }, [15, 20]), i))).toMatch(/week 6's target must equal this week's \(16 km\)/);
    expect('value' in checkWeeklyUpdate(answer(i, { status: 'far_behind' }, [16, 20]), i)).toBe(true);
  });

  it('the lower bound is the last big-test result', () => {
    expect(reasonsOf(checkWeeklyUpdate(answer(i, { status: 'a_bit_behind' }, [11, 20]), i))).toMatch(/easier than what they last achieved \(12 km\)/);
  });

  it('the prompt asks only for the big weeks and marks the light ones', () => {
    const prompt = buildWeeklyUpdatePrompt(i);
    expect(prompt).toContain('one target for each of weeks 8, 12, in order');
    expect(prompt).toContain("- Week 6: light test week; shows week 8's target (code fills it in)");
    expect(prompt).toContain("Next check: Weekly running distance: 16 km. This week's test was the light test, not a check of the target.");
    expect(prompt).toContain('- The most week 8 may be: 17.6 km (one safe step).');
  });
});

describe('the prompt (prompt 4, trimmed)', () => {
  it('names the kinds a week behind and leaves out checkpoints and retestFirst (WU-45 (5))', () => {
    const prompt = buildWeeklyUpdatePrompt(input(3, { kinds: [behind(), behind({ name: 'conversation', stepsBehind: 1, sessions: 2, weekBehind: false, position: 'Talk 2' })] }));
    expect(prompt).toContain('- new material: at "Lesson 4", 3 steps still to do (3 sessions of it this week); a week behind');
    expect(prompt).toContain('- conversation: at "Talk 2", 1 step still to do (2 sessions of it this week)');
    expect(prompt).toContain("They are a week behind in new material: week 4's target must not be higher than this week's");
    expect(prompt).not.toMatch(/checkpoint|retestFirst|Extensions/i);
  });
});

describe('M3.1 review (WU-46)', () => {
  it('(1) a hold wins over the lower bound: far_behind with a result above this week keeps next week at this week', () => {
    const i = input(3, { lowerBound: 12.5 });
    expect('value' in checkWeeklyUpdate(answer(i, { status: 'far_behind' }, [12]), i)).toBe(true);
    // Only the held week: the weeks after it still keep the bound.
    expect(reasonsOf(checkWeeklyUpdate(answer(i, { status: 'far_behind' }, [12, 12.2]), i))).toMatch(/week 5's 12.2 km is easier than what they last achieved \(12.5 km\)/);
    expect(buildWeeklyUpdatePrompt(i)).toContain("(12.5 km), and no week easier than the week before it. A held week 4 may stay at this week's target instead.");
  });

  it('(1) an unlogged test with an older result above this week holds next week at this week', () => {
    const i = input(3, { testLogged: false, result: 'not logged', lowerBound: 12.5 });
    expect('value' in checkWeeklyUpdate(answer(i, {}, [12]), i)).toBe(true);
  });

  it('(1) without a hold, next week still keeps the bound', () => {
    const i = input(3, { lowerBound: 12.5 });
    expect(reasonsOf(checkWeeklyUpdate(answer(i, { status: 'a_bit_behind' }, [12]), i))).toMatch(/week 4's 12 km is easier than what they last achieved \(12.5 km\)/);
    // The bound at or below this week's target needs no exception for a held week.
    expect(buildWeeklyUpdatePrompt(input(3, { lowerBound: 12 }))).not.toContain('A held week');
  });

  it('(2) a result above week 12 no longer rejects: the bound is week 12', () => {
    const i = input(3, { lowerBound: 25 });
    expect('value' in checkWeeklyUpdate(answer(i, {}, Array(9).fill(21)), i)).toBe(true);
    expect(buildWeeklyUpdatePrompt(i)).toContain('what they last achieved (21 km)');
    expect(buildWeeklyUpdatePrompt(i)).not.toContain('25 km');
  });

  it('counts reconcile could not make are "not counted", never zeros', () => {
    const prompt = buildWeeklyUpdatePrompt(input(3, { counts: { practiceDone: 3, practicePlanned: 5, detail: null } }));
    expect(prompt).toContain('Sessions done: 3 of 5. Key sessions, 10-minute versions, missed and dropped days: not counted.');
    expect(prompt).not.toContain('Missed days:');
  });
});
