import { describe, it, expect } from 'vitest';
import {
  askedWeeks,
  buildWeeklyUpdatePrompt,
  checkWeeklyUpdate,
  fallbackHold,
  fallbackRestart,
  holdsOf,
  type RawWeeklyUpdate,
  type WeeklyUpdateInput,
} from '../src/lib/ai/weeklyUpdate.js';
import type { WeekTarget } from '../src/lib/ai/roadmap.js';

// Weekly update M3.4 (RULE-4, RULE-16, WU-16, WU-59 (2), (3)): the break's check, prompt and fallback. Pure.

const km = (value: number): WeekTarget => ({ kind: 'number', metric: 'Weekly running distance', value, unit: 'km', direction: 'higher_is_better' });
const text = (description: string): WeekTarget => ({ kind: 'deliverable', description });

/** Week 5 closing after a 12-day break, "back 1 week": week 4's 13 km. Plan climbs 1 km a week from 10 to 21. */
function input(over: Partial<WeeklyUpdateInput> = {}): WeeklyUpdateInput {
  return {
    finalGoal: 'Run 21 km a week',
    method: { name: 'Ten percent rule', rules: ['Add at most 10% a week'] },
    weekNumber: 5,
    target: km(14),
    lightTest: false,
    lightTestGoal: false,
    result: 'not logged',
    testLogged: false,
    lowerBound: 14,
    counts: { practiceDone: 2, practicePlanned: 5, detail: null },
    reflection: '',
    history: [],
    weeksLeft: Array.from({ length: 7 }, (_, i) => ({ weekNumber: 6 + i, target: km(15 + i), light: false })),
    safeMax: { weekNumber: 6, value: 15.4 },
    restart: { awayDays: 12, restart: 'back 1 week', level: km(13), week: 4 },
    ...over,
  };
}

function answer(i: WeeklyUpdateInput, values: number[], over: Partial<RawWeeklyUpdate> = {}): RawWeeklyUpdate {
  return {
    status: 'far_behind',
    nextTargets: askedWeeks(i).map((week, index) => ({ weekNumber: week.weekNumber, kind: 'number', metric: 'Weekly running distance', value: values[index], unit: 'km' })),
    messageToUser: 'Welcome back: next week picks up at 13 km and builds from there.',
    guidanceForNextWeek: 'Easy sessions first.',
    ...over,
  };
}

const reasonsOf = (result: ReturnType<typeof checkWeeklyUpdate>) => ('reasons' in result ? result.reasons.join(' | ') : '');
const SPREAD = [13, 14.2, 15.5, 17, 18.5, 19.8, 21];

describe('the check (WU-59 (2))', () => {
  it('next week at the restart level, the rest spread up to week 12, passes whatever the status', () => {
    for (const status of ['on_track', 'a_bit_behind', 'far_behind']) {
      expect('value' in checkWeeklyUpdate(answer(input(), SPREAD, { status }), input())).toBe(true);
    }
  });

  it('next week not at the restart level is refused, naming the week and the level', () => {
    expect(reasonsOf(checkWeeklyUpdate(answer(input(), [14, 15, 16, 17, 18.5, 19.8, 21]), input()))).toMatch(
      /week 6's target must be exactly Weekly running distance: 13 km after the break/
    );
  });

  it('the restart level is the lower bound of every week left, replacing the last result', () => {
    // The last result (14) would refuse 13; the restart level allows it, and refuses anything below it.
    expect(reasonsOf(checkWeeklyUpdate(answer(input(), [13, 12.5, 15.5, 17, 18.5, 19.8, 21]), input()))).toMatch(
      /week 7's 12.5 km is easier than the restart level \(13 km\)/
    );
  });

  it('the unlogged, week-behind and far_behind holds do not apply on a break', () => {
    const i = input({ kinds: [{ name: 'new material', position: 'Lesson 4', stepsBehind: 3, sessions: 3, weekBehind: true }] });
    expect(holdsOf(i)).toEqual({ notLogged: false, weekBehind: [] });
    expect(fallbackHold(i).held).toEqual([]);
  });

  it('every other RULE-4 check still applies: week 12 stays the goal, no week goes backwards', () => {
    expect(reasonsOf(checkWeeklyUpdate(answer(input(), [13, 14, 15, 16, 17, 18, 20]), input()))).toMatch(/week 12 must stay exactly 21 km/);
    expect(reasonsOf(checkWeeklyUpdate(answer(input(), [13, 15, 14.5, 16, 17, 18, 21]), input()))).toMatch(/week 8's 14.5 km is easier than the week before it/);
  });

  it('a deliverable restart level must be repeated exactly', () => {
    const i = input({
      target: text('Draft chapter 5'),
      lowerBound: null,
      weeksLeft: Array.from({ length: 7 }, (_, k) => ({ weekNumber: 6 + k, target: text(k === 6 ? 'Finished book' : `Draft chapter ${6 + k}`), light: false })),
      safeMax: null,
      restart: { awayDays: 12, restart: 'back 1 week', level: text('Draft chapter 4'), week: 4 },
    });
    const raw = (first: string): RawWeeklyUpdate => ({
      status: 'on_track',
      nextTargets: i.weeksLeft.map((week, k) => ({ weekNumber: week.weekNumber, kind: 'deliverable', description: k === 0 ? first : (week.target as { description: string }).description })),
      messageToUser: 'Next week picks up at chapter 4.',
      guidanceForNextWeek: '',
    });
    expect('value' in checkWeeklyUpdate(raw('Draft chapter 4'), i)).toBe(true);
    expect(reasonsOf(checkWeeklyUpdate(raw('Draft chapter 6'), i))).toMatch(/week 6's target must be exactly "?Draft chapter 4/);
  });

  it('a light-test goal: the big week next week shows must be the level; code fills the light weeks', () => {
    // Closing light week 6 after a break, "back 2 weeks": week 4's 12 km. Next week (7) is light and shows week 8.
    const big: Record<number, number> = { 8: 16, 12: 20 };
    const i = input({
      weekNumber: 6,
      target: km(16),
      lightTest: true,
      lightTestGoal: true,
      lowerBound: 12,
      weeksLeft: [7, 8, 9, 10, 11, 12].map((weekNumber) => ({ weekNumber, target: km(big[weekNumber <= 8 ? 8 : 12]), light: ![8, 12].includes(weekNumber) })),
      safeMax: { weekNumber: 8, value: 17.6 },
      restart: { awayDays: 12, restart: 'back 2 weeks', level: km(12), week: 4 },
    });
    const ok = checkWeeklyUpdate(answer(i, [12, 20]), i);
    expect('value' in ok && ok.value.targets.map((t) => (t.target as { value: number }).value)).toEqual([12, 12, 20, 20, 20, 20]);
    expect(reasonsOf(checkWeeklyUpdate(answer(i, [16, 20]), i))).toMatch(/week 8's target \(next week shows it\) must be exactly Weekly running distance: 12 km/);
  });

  it('"Keep going": next week is weekBack; the weeks left start there', () => {
    // Closing week 3, picking up at week 6 (weeks 4 and 5 jumped), "last level": week 3's 12 km.
    const i = input({
      weekNumber: 3,
      nextWeek: 6,
      target: km(12),
      weeksLeft: Array.from({ length: 7 }, (_, k) => ({ weekNumber: 6 + k, target: km(15 + k), light: false })),
      restart: { awayDays: 40, restart: 'last level', level: km(12), week: 3 },
    });
    expect('value' in checkWeeklyUpdate(answer(i, [12, 13.2, 14.5, 16, 17.6, 19.3, 21]), i)).toBe(true);
    expect(reasonsOf(checkWeeklyUpdate(answer(i, [15, 16, 17, 18, 19, 20, 21]), i))).toMatch(/week 6's target must be exactly/);
  });
});

describe('the prompt (requirement 4)', () => {
  it('a BREAK block with the days away, the restart in words, the exact level and the spread', () => {
    const prompt = buildWeeklyUpdatePrompt(input());
    expect(prompt).toContain(
      [
        'BREAK',
        "- They were away 12 days. The method's return rule for a break this long: go back 1 week (week 4's target).",
        '- Week 6 must be exactly Weekly running distance: 13 km. Spread the remaining weeks from there up to week 12; none easier than it.',
      ].join('\n')
    );
    expect(prompt).toContain("   - After the break, week 6's target equals Weekly running distance: 13 km whatever the status.");
    expect(prompt).toContain('   - Never set a target easier than the restart level (13 km), and no week easier than the week before it.');
    expect(prompt).not.toContain('far_behind: week 6');
    expect(prompt).not.toContain('The test was not logged');
  });

  it('"Keep going" names weekBack, and a light-test goal names the big week next week shows', () => {
    expect(buildWeeklyUpdatePrompt(input({ weekNumber: 3, nextWeek: 6, target: km(12), restart: { awayDays: 40, restart: 'last level', level: km(12), week: 3 } }))).toContain(
      '- Week 6 must be exactly Weekly running distance: 12 km.'
    );
  });

  it('no BREAK block when next week shows week 12\'s target ("Do my final week")', () => {
    const i = input({ weekNumber: 5, nextWeek: 12, weeksLeft: [{ weekNumber: 12, target: km(21), light: false }], restart: undefined, safeMax: null });
    const prompt = buildWeeklyUpdatePrompt(i);
    expect(prompt).not.toContain('BREAK');
    expect(prompt).toContain("Week 12 shows week 12's target");
    expect(prompt).toContain('one target for each of weeks 12, in order');
  });
});

describe('the fallback keeps the restart (WU-59 (3))', () => {
  it('next week takes the level; later weeks stay as planned', () => {
    expect(fallbackRestart(input())).toEqual([{ weekNumber: 6, target: km(13) }]);
  });

  it('a light-test goal: the light weeks before the big week show it too', () => {
    const i = input({
      weekNumber: 5,
      lightTestGoal: true,
      weeksLeft: [6, 7, 8, 9, 10, 11, 12].map((weekNumber) => ({ weekNumber, target: km(weekNumber <= 8 ? 16 : 20), light: ![8, 12].includes(weekNumber) })),
      restart: { awayDays: 12, restart: 'back 1 week', level: km(12), week: 4 },
    });
    expect(fallbackRestart(i)).toEqual([6, 7, 8].map((weekNumber) => ({ weekNumber, target: km(12) })));
  });

  it('none without a restart', () => {
    expect(fallbackRestart(input({ restart: undefined }))).toEqual([]);
  });
});
