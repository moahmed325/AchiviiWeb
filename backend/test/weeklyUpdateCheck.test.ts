import { describe, it, expect } from 'vitest';
import {
  askedWeeks,
  buildWeeklyUpdatePrompt,
  checkWeeklyUpdate,
  directionReason,
  fallbackHold,
  sentenceReason,
  WEEKLY_UPDATE_DELIVERABLE_SCHEMA,
  WEEKLY_UPDATE_SCHEMA,
  weeklyUpdateSchema,
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

  it("a week's kind or unit changes (the metric is not compared, WU-50)", () => {
    const i = input();
    const kind = answer(i);
    (kind.nextTargets as any[])[2] = { weekNumber: 6, kind: 'deliverable', description: 'Run' };
    expect(reasonsOf(checkWeeklyUpdate(kind, i))).toMatch(/week 6's kind changed/);
    const metric = answer(i);
    (metric.nextTargets as any[])[2].metric = 'Long run';
    const kept = checkWeeklyUpdate(metric, i);
    expect('value' in kept && kept.value.targets[2].target).toEqual(km(15));
    const unit = answer(i);
    (unit.nextTargets as any[])[2].unit = 'mi';
    expect(reasonsOf(checkWeeklyUpdate(unit, i))).toMatch(/week 6's unit changed to "mi"; keep "km"/);
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
    // WU-49: the reason names the week the model sets, week 8, which next week (6) shows.
    expect(reasonsOf(checkWeeklyUpdate(answer(i, { status: 'far_behind' }, [15, 20]), i))).toMatch(
      /far_behind, so week 8's target \(next week shows it\) must equal this week's \(16 km\)/
    );
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

describe('WU-49: the hold lines name the week the model sets', () => {
  // As the light-test goal above: closing light week 5; next week (6) is light and shows week 8's 16 km.
  const big: Record<number, number> = { 4: 12, 8: 16, 12: 20 };
  const shows = (week: number) => big[week <= 4 ? 4 : week <= 8 ? 8 : 12];
  const weeksLeft = [6, 7, 8, 9, 10, 11, 12].map((weekNumber) => ({ weekNumber, target: km(shows(weekNumber)), light: ![8, 12].includes(weekNumber) }));
  const light = (over: Partial<WeeklyUpdateInput> = {}) =>
    input(5, { target: km(16), lightTest: true, lightTestGoal: true, lowerBound: 12, weeksLeft, result: 'light test done', safeMax: { weekNumber: 8, value: 17.6 }, ...over });

  // M3.3a (WU-54): an unlogged light week holds nothing, so the unlogged hold is shown closing big week 4, whose next
  // week (5) is light and shows week 8's 16 km.
  const big4 = (over: Partial<WeeklyUpdateInput> = {}) =>
    input(4, {
      target: km(12),
      lightTest: false,
      lightTestGoal: true,
      lowerBound: 12,
      weeksLeft: [5, 6, 7, 8, 9, 10, 11, 12].map((weekNumber) => ({ weekNumber, target: km(shows(weekNumber)), light: ![8, 12].includes(weekNumber) })),
      safeMax: { weekNumber: 8, value: 17.6 },
      ...over,
    });

  it('on a light-test goal every hold line names the next big week, which next week shows', () => {
    const prompt = buildWeeklyUpdatePrompt(big4({ testLogged: false, kinds: [behind()], lowerBound: 12.5 }));
    expect(prompt).toContain("   - far_behind: week 8's target (next week shows it) equals this week's target.");
    expect(prompt).toContain("   - The test was not logged: week 8's target (next week shows it) must not be higher than this week's.");
    expect(prompt).toContain("They are a week behind in new material: week 8's target (next week shows it) must not be higher than this week's");
    expect(prompt).toContain("A held week 8 (next week shows it) may stay at this week's target instead.");
  });

  it('the retry reasons name the same week, and the check itself is unchanged', () => {
    const i = big4({ testLogged: false, kinds: [behind()] });
    expect(reasonsOf(checkWeeklyUpdate(answer(i, {}, [17, 20]), i))).toMatch(
      /week 8's target \(next week shows it\) must not be higher than this week's \(12 km\) because the test was not logged and they are a week behind in new material/
    );
    expect('value' in checkWeeklyUpdate(answer(i, {}, [12, 20]), i)).toBe(true);
  });

  it('WU-54: an unlogged light week holds nothing: no line, no reason, no fallback hold; a week behind still holds', () => {
    const i = light({ testLogged: false });
    expect(buildWeeklyUpdatePrompt(i)).not.toContain('The test was not logged');
    expect('value' in checkWeeklyUpdate(answer(i, {}, [17, 20]), i)).toBe(true);
    expect(fallbackHold(i).held).toEqual([]);
    const behindToo = light({ testLogged: false, kinds: [behind()] });
    expect(reasonsOf(checkWeeklyUpdate(answer(behindToo, {}, [17, 20]), behindToo))).toBe("week 8's target (next week shows it) must not be higher than this week's (16 km) because they are a week behind in new material.");
    expect(fallbackHold(behindToo).held).toEqual(['week_behind']);
  });

  it('WU-54: an unlogged big week on a light-test goal still holds, in the fallback too', () => {
    const i = big4({ testLogged: false });
    expect(fallbackHold(i).held).toEqual(['not_logged']);
    expect(fallbackHold(i).targets.map((t) => [t.weekNumber, t.target.kind === 'number' && t.target.value])).toEqual([
      [5, 12],
      [6, 12],
      [7, 12],
      [8, 12],
    ]);
  });

  it('on a goal without light weeks the lines name next week as before', () => {
    const prompt = buildWeeklyUpdatePrompt(input(3, { testLogged: false }));
    expect(prompt).toContain("   - far_behind: week 4's target equals this week's target.");
    expect(prompt).toContain("   - The test was not logged: week 4's target must not be higher than this week's.");
  });
});

describe('WU-50: code keeps the metric and unit', () => {
  const pct = (value: number): WeekTarget => ({ kind: 'number', metric: 'Body fat percentage', value, unit: 'percent', direction: 'lower_is_better' });
  const weeksLeft = Array.from({ length: 9 }, (_, k) => ({ weekNumber: 4 + k, target: pct(24 - 0.5 * k), light: false }));
  const i = input(3, { target: pct(24.5), weeksLeft, lowerBound: 24.5, safeMax: null, finalGoal: 'Reach 20% body fat' });

  it('"%" for "percent", with its own metric wording, is accepted and the week keeps its metric and unit', () => {
    const raw = answer(i);
    for (const item of raw.nextTargets as any[]) Object.assign(item, { metric: 'body fat', unit: '%' });
    const result = checkWeeklyUpdate(raw, i);
    expect('value' in result && result.value.targets.map((t) => t.target)).toEqual(weeksLeft.map((w) => w.target));
  });

  it('a missing or empty unit is accepted; only the value is taken', () => {
    const raw = answer(i, {}, [23.8]);
    delete (raw.nextTargets as any[])[0].unit;
    (raw.nextTargets as any[])[1].unit = '';
    const result = checkWeeklyUpdate(raw, i);
    expect('value' in result && result.value.targets.slice(0, 2).map((t) => t.target)).toEqual([pct(23.8), pct(23.5)]);
  });

  it('"miles" for "km" and a changed kind are still rejected', () => {
    const k = input();
    const miles = answer(k);
    (miles.nextTargets as any[])[0].unit = 'miles';
    expect(reasonsOf(checkWeeklyUpdate(miles, k))).toMatch(/week 4's unit changed to "miles"; keep "km"/);
    const kind = answer(k);
    (kind.nextTargets as any[])[0] = { weekNumber: 4, kind: 'deliverable', description: 'Run 13 km' };
    expect(reasonsOf(checkWeeklyUpdate(kind, k))).toMatch(/week 4's kind changed to "deliverable"; keep "number"/);
  });
});

describe('WU-51: no "held" for a raise, no "raised" for a hold', () => {
  it('"held" while next week goes up is a retry reason that says what to fix', () => {
    const i = input();
    expect(reasonsOf(checkWeeklyUpdate(answer(i, { messageToUser: 'Next week your target is held steady.' }), i))).toMatch(
      /"messageToUser" says "held", but next week's target moves on from 12 km to 13 km; say plainly that next week aims at 13 km, not that it is held\./
    );
    for (const message of ['Your pace is kept for now.', 'The plan stays on course.']) {
      expect(reasonsOf(checkWeeklyUpdate(answer(i, { messageToUser: message }), i))).toMatch(/but next week's target moves on/);
    }
  });

  it('"goes up" while next week stays is a retry reason', () => {
    const i = input(3, { testLogged: false, result: 'not logged', lowerBound: null });
    for (const message of ['Next week goes up a little.', 'Your target rises next week.', 'Next week is raised.', 'It went up.', 'Next week moves up.']) {
      expect(reasonsOf(checkWeeklyUpdate(answer(i, { messageToUser: message }, [12]), i))).toMatch(
        /"messageToUser" says "(goes up|rises|raised|went up|moves up)", but next week's target stays at 12 km; say plainly that it is held\./i
      );
    }
  });

  it('a held sentence for a week that really is held passes', () => {
    const i = input(3, { testLogged: false, result: 'not logged', lowerBound: null });
    expect('value' in checkWeeklyUpdate(answer(i, { messageToUser: "Next week's target is held at 12 km until the test is logged." }, [12]), i)).toBe(true);
  });

  it('"catch up", "build up" and "keep it up" pass on a held week (never a bare "up")', () => {
    const i = input(3, { kinds: [behind()] });
    for (const message of [
      'Next week repeats this target so you can catch up on new material.',
      'Next week repeats this target so you can build up slowly.',
      'Keep it up: next week repeats this target.',
    ]) {
      expect('value' in checkWeeklyUpdate(answer(i, { messageToUser: message }, [12]), i)).toBe(true);
    }
  });

  it('a raise said plainly passes, and a lowered week is not checked', () => {
    const i = input();
    expect('value' in checkWeeklyUpdate(answer(i, { messageToUser: 'Next week goes up to 13 km.' }), i)).toBe(true);
    expect(directionReason('Next week is held at an easier 11.5 km.', km(12), km(11.5))).toBeNull();
  });

  it('a lower-is-better target that gets harder is never called "up" in the retry reason (M3.2b review)', () => {
    const fat = (value: number) => ({ kind: 'number' as const, metric: 'Body fat percentage', value, unit: 'percent', direction: 'lower_is_better' as const });
    const reason = directionReason('Next week is held at this benchmark.', fat(23.4), fat(21));
    expect(reason).toMatch(/moves on from 23\.4 percent to 21 percent; say plainly that next week aims at 21 percent/);
    expect(reason).not.toMatch(/goes up/);
  });

  it('a deliverable: new text has gone up, the same text has stayed', () => {
    expect(directionReason('The target is kept as planned.', text('Draft chapter 4'), text('Draft chapter 5'))).toMatch(
      /says "kept", but next week's target moves on from "Draft chapter 4" to "Draft chapter 5"/
    );
    expect(directionReason('The target rises to the next chapter.', text('Draft chapter 4'), text('Draft chapter 4'))).toMatch(/says "rises", but next week's target stays at "Draft chapter 4"/);
    expect(directionReason("Next week's target is held.", text('Draft chapter 4'), text('Draft chapter 4'))).toBeNull();
  });
});

describe('WU-48: the holds a fallback keeps (fallbackHold)', () => {
  it('an unlogged test holds next week at this week when it is planned harder; later weeks stay as planned', () => {
    expect(fallbackHold(input(3, { testLogged: false }))).toEqual({ held: ['not_logged'], targets: [{ weekNumber: 4, target: km(12) }], keeps: true });
  });

  it('a kind a week behind holds too; both together are listed', () => {
    expect(fallbackHold(input(3, { kinds: [behind()] })).held).toEqual(['week_behind']);
    expect(fallbackHold(input(3, { kinds: [behind()], testLogged: false })).held).toEqual(['not_logged', 'week_behind']);
  });

  it("no hold code can see: nothing held (far_behind is never applied: it is the model's)", () => {
    expect(fallbackHold(input(3))).toEqual({ held: [], targets: [], keeps: false });
  });

  it('a light-test goal holds the next big week, with the light weeks before it', () => {
    // Closing big week 4 at 12 km; weeks 5 to 7 are light and show week 8's 16 km.
    const weeksLeft = [5, 6, 7, 8, 9, 10, 11, 12].map((weekNumber) => ({ weekNumber, target: km(weekNumber <= 8 ? 16 : 20), light: ![8, 12].includes(weekNumber) }));
    const i = input(4, { target: km(12), lightTestGoal: true, weeksLeft, kinds: [behind()] });
    expect(fallbackHold(i)).toEqual({ held: ['week_behind'], targets: [5, 6, 7, 8].map((weekNumber) => ({ weekNumber, target: km(12) })), keeps: true });
  });

  it("no hold when next week shows week 12's target (WU-47)", () => {
    const weeksLeft = [9, 10, 11, 12].map((weekNumber) => ({ weekNumber, target: km(20), light: weekNumber !== 12 }));
    expect(fallbackHold(input(8, { target: km(16), lightTestGoal: true, weeksLeft, testLogged: false }))).toEqual({ held: [], targets: [], keeps: false });
    expect(fallbackHold(input(11, { testLogged: false }))).toEqual({ held: [], targets: [], keeps: false });
  });

  it("a deliverable holds next week at this week's text", () => {
    const weeksLeft = [5, 6, 7, 8, 9, 10, 11, 12].map((weekNumber) => ({ weekNumber, target: text(weekNumber === 12 ? 'Publish the book' : `Draft chapter ${weekNumber}`), light: false }));
    const i = input(4, { target: text('Draft chapter 4'), weeksLeft, lowerBound: null, safeMax: null, testLogged: false });
    expect(fallbackHold(i)).toEqual({ held: ['not_logged'], targets: [{ weekNumber: 5, target: text('Draft chapter 4') }], keeps: true });
  });

  it('a next week already at this week keeps it with nothing to change; one planned easier is left alone', () => {
    expect(fallbackHold(input(3, { testLogged: false, target: km(13) }))).toEqual({ held: ['not_logged'], targets: [], keeps: true });
    expect(fallbackHold(input(3, { testLogged: false, target: km(14) }))).toEqual({ held: ['not_logged'], targets: [], keeps: false });
  });
});

describe('M3.3a: the deliverable schema and the WU-51 line (03-phases M3.3 notes (a), (b))', () => {
  const deliverable = () =>
    input(3, {
      target: text('Draft chapter 3'),
      lowerBound: null,
      safeMax: null,
      weeksLeft: Array.from({ length: 9 }, (_, k) => ({ weekNumber: 4 + k, target: text(k === 8 ? 'Finish the book' : `Draft chapter ${4 + k}`), light: false })),
    });

  it('a deliverable week gets kind fixed to deliverable and description required, with no number fields', () => {
    const schema = weeklyUpdateSchema(deliverable());
    expect(schema).toBe(WEEKLY_UPDATE_DELIVERABLE_SCHEMA);
    const items = (schema.properties.nextTargets as any).items;
    expect(items.properties.kind.enum).toEqual(['deliverable']);
    expect(items.required).toEqual(['weekNumber', 'kind', 'description']);
    expect(Object.keys(items.properties).sort()).toEqual(['description', 'kind', 'weekNumber']);
    expect(schema.required).toEqual(WEEKLY_UPDATE_SCHEMA.required);
  });

  it("a deliverable week's prompt shows only the deliverable shape", () => {
    const prompt = buildWeeklyUpdatePrompt(deliverable());
    expect(prompt).toContain('2. nextTargets: one target for each of weeks 4, 5, 6, 7, 8, 9, 10, 11, 12, in order: { weekNumber, kind: "deliverable", description }.');
    expect(prompt).not.toContain('kind: "number"');
  });

  it("a number week keeps today's schema and nextTargets line exactly", () => {
    expect(weeklyUpdateSchema(input(3))).toBe(WEEKLY_UPDATE_SCHEMA);
    expect(JSON.stringify(WEEKLY_UPDATE_SCHEMA.properties.nextTargets)).toBe(
      '{"type":"array","items":{"type":"object","properties":{"weekNumber":{"type":"integer"},"kind":{"type":"string","enum":["number","deliverable"]},"metric":{"type":"string"},"value":{"type":"number"},"unit":{"type":"string"},"description":{"type":"string"}},"required":["weekNumber","kind"]}}'
    );
    expect(buildWeeklyUpdatePrompt(input(3))).toContain(
      '2. nextTargets: one target for each of weeks 4, 5, 6, 7, 8, 9, 10, 11, 12, in order: { weekNumber, kind: "number", metric, value, unit } or { weekNumber, kind: "deliverable", description }.'
    );
  });

  it('both prompts state the WU-51 rule in the target rules', () => {
    const line = "   - In the message, don't say held, kept or stays when next week's target moves on, or goes up, raised or rises when it stays the same.";
    for (const prompt of [buildWeeklyUpdatePrompt(input(3)), buildWeeklyUpdatePrompt(deliverable())]) {
      expect(prompt).toContain(line);
      expect(prompt.indexOf(line)).toBeLessThan(prompt.indexOf('3. messageToUser'));
    }
  });

  it('checkWeeklyUpdate is unchanged for a deliverable answer', () => {
    const i = deliverable();
    expect('value' in checkWeeklyUpdate(answer(i), i)).toBe(true);
  });
});
