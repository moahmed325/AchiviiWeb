import { describe, it, expect } from 'vitest';
import { buildWeeklyUpdatePrompt, type WeeklyUpdateInput } from '../src/lib/ai/weeklyUpdate.js';
import type { WeekTarget } from '../src/lib/ai/roadmap.js';

// Weekly update M3.4 (requirement 2): a close that is not a break builds exactly the prompt it built on `8e9d5dd`. The
// snapshots below were written by running this file on that code, before M3.4 changed anything.

const km = (value: number): WeekTarget => ({ kind: 'number', metric: 'Weekly running distance', value, unit: 'km', direction: 'higher_is_better' });

function input(n: number, over: Partial<WeeklyUpdateInput> = {}): WeeklyUpdateInput {
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
    reflection: 'Felt good',
    history: [{ weekNumber: n - 1, target: km(8 + n), light: false, result: '11 km', sessions: '5 of 5', status: 'on_track' }],
    weeksLeft: Array.from({ length: 12 - n }, (_, i) => ({ weekNumber: n + 1 + i, target: km(10 + n + i), light: false })),
    safeMax: { weekNumber: n + 1, value: 10 + n + 0.2 },
    ...over,
  };
}

const big: Record<number, number> = { 4: 12, 8: 16, 12: 20 };
const shows = (week: number) => big[week <= 4 ? 4 : week <= 8 ? 8 : 12];
const lightLeft = (from: number) => Array.from({ length: 12 - from + 1 }, (_, i) => from + i).map((weekNumber) => ({ weekNumber, target: km(shows(weekNumber)), light: ![4, 8, 12].includes(weekNumber) }));

describe('a non-break prompt is unchanged (M3.4 requirement 2)', () => {
  it('an ordinary close, raise allowed', () => {
    expect(buildWeeklyUpdatePrompt(input(3))).toMatchInlineSnapshot(`
      "THE PLAN
      Goal: Run 21 km a week
      Method: Ten percent rule. Rules: Add at most 10% a week
      Weeks left, as currently planned:
      - Week 4: Weekly running distance: 13 km
      - Week 5: Weekly running distance: 14 km
      - Week 6: Weekly running distance: 15 km
      - Week 7: Weekly running distance: 16 km
      - Week 8: Weekly running distance: 17 km
      - Week 9: Weekly running distance: 18 km
      - Week 10: Weekly running distance: 19 km
      - Week 11: Weekly running distance: 20 km
      - Week 12: Weekly running distance: 21 km

      THIS WEEK (week 3)
      Target: Weekly running distance: 12 km
      Test result: test logged: 12 km, passed
      Sessions done: 4 of 5. Key sessions: 1 done, 0 skipped. A key session done only as the 10-minute version counts as skipped.
      10-minute versions used: 0. Missed days: 1. Dropped days: 0.
      Their note: "Felt good"

      LAST 3 WEEKS
      - Week 2: target Weekly running distance: 11 km; result: 11 km; sessions done: 5 of 5; status: on_track

      SAFETY
      - The most week 4 may be: 13.2 km (one safe step). Code lowers anything past it.

      DECIDE
      1. status:
         - on_track: they hit the target
         - a_bit_behind: they missed it but did 50%+ of sessions
         - far_behind: they did under 50%, or skipped the key sessions
         Weigh the trend. One bad week after good ones is not the same as three weeks declining.
      2. nextTargets: one target for each of weeks 4, 5, 6, 7, 8, 9, 10, 11, 12, in order: { weekNumber, kind: "number", metric, value, unit } or { weekNumber, kind: "deliverable", description }.
         - on_track: keep the plan. Raise it only if they clearly beat the target, never above week 12's target before week 12.
         - a_bit_behind: make the next step smaller and spread the remaining climb over the weeks left.
         - far_behind: week 4's target equals this week's target.
         - Never set a target easier than what they last achieved (12 km), and no week easier than the week before it.
         - Week 12 stays exactly Weekly running distance: 21 km.
         - Keep each week's kind, metric and unit as planned.
         - In the message, don't say held, kept or stays when next week's target moves on, or goes up, raised or rises when it stays the same.
      3. messageToUser: one sentence, neutral and encouraging. Say what happens next, and say plainly if next week's
         target is held or lowered. Never ask a question. Never use the words "missed", "behind", "failed" or "fail".
      4. guidanceForNextWeek: 1-2 sentences for the person writing next week's tasks."
    `);
  });

  it('unlogged, a kind a week behind, the bound above this week', () => {
    const i = input(5, {
      testLogged: false,
      result: 'not logged',
      lowerBound: 15,
      kinds: [{ name: 'new material', position: 'Lesson 4', stepsBehind: 3, sessions: 3, weekBehind: true }],
    });
    expect(buildWeeklyUpdatePrompt(i)).toMatchInlineSnapshot(`
      "THE PLAN
      Goal: Run 21 km a week
      Method: Ten percent rule. Rules: Add at most 10% a week
      Weeks left, as currently planned:
      - Week 6: Weekly running distance: 15 km
      - Week 7: Weekly running distance: 16 km
      - Week 8: Weekly running distance: 17 km
      - Week 9: Weekly running distance: 18 km
      - Week 10: Weekly running distance: 19 km
      - Week 11: Weekly running distance: 20 km
      - Week 12: Weekly running distance: 21 km

      THIS WEEK (week 5)
      Target: Weekly running distance: 14 km
      Test result: not logged
      Sessions done: 4 of 5. Key sessions: 1 done, 0 skipped. A key session done only as the 10-minute version counts as skipped.
      10-minute versions used: 0. Missed days: 1. Dropped days: 0.
      Their note: "Felt good"

      WHERE THEY ARE in each in-order kind of step (the first step not done yet):
      - new material: at "Lesson 4", 3 steps still to do (3 sessions of it this week); a week behind

      LAST 3 WEEKS
      - Week 4: target Weekly running distance: 13 km; result: 11 km; sessions done: 5 of 5; status: on_track

      SAFETY
      - The most week 6 may be: 15.2 km (one safe step). Code lowers anything past it.

      DECIDE
      1. status:
         - on_track: they hit the target
         - a_bit_behind: they missed it but did 50%+ of sessions
         - far_behind: they did under 50%, or skipped the key sessions
         Weigh the trend. One bad week after good ones is not the same as three weeks declining.
      2. nextTargets: one target for each of weeks 6, 7, 8, 9, 10, 11, 12, in order: { weekNumber, kind: "number", metric, value, unit } or { weekNumber, kind: "deliverable", description }.
         - on_track: keep the plan. Raise it only if they clearly beat the target, never above week 12's target before week 12.
         - a_bit_behind: make the next step smaller and spread the remaining climb over the weeks left.
         - far_behind: week 6's target equals this week's target.
         - The test was not logged: week 6's target must not be higher than this week's.
         - They are a week behind in new material: week 6's target must not be higher than this week's, and the message says so, naming it ("...so you can catch up on new material").
         - Never set a target easier than what they last achieved (15 km), and no week easier than the week before it. A held week 6 may stay at this week's target instead.
         - Week 12 stays exactly Weekly running distance: 21 km.
         - Keep each week's kind, metric and unit as planned.
         - In the message, don't say held, kept or stays when next week's target moves on, or goes up, raised or rises when it stays the same.
      3. messageToUser: one sentence, neutral and encouraging. Say what happens next, and say plainly if next week's
         target is held or lowered. Never ask a question. Never use the words "missed", "behind", "failed" or "fail".
      4. guidanceForNextWeek: 1-2 sentences for the person writing next week's tasks."
    `);
  });

  it('a light-test goal closing big week 4 (next week is light)', () => {
    const i = input(4, { target: km(12), lightTestGoal: true, lowerBound: 12, testLogged: false, result: 'not logged', weeksLeft: lightLeft(5), safeMax: { weekNumber: 8, value: 17.6 } });
    expect(buildWeeklyUpdatePrompt(i)).toMatchInlineSnapshot(`
      "THE PLAN
      Goal: Run 21 km a week
      Method: Ten percent rule. Rules: Add at most 10% a week
      Weeks left, as currently planned:
      - Week 5: light test week; shows week 8's target (code fills it in)
      - Week 6: light test week; shows week 8's target (code fills it in)
      - Week 7: light test week; shows week 8's target (code fills it in)
      - Week 8: Weekly running distance: 16 km
      - Week 9: light test week; shows week 12's target (code fills it in)
      - Week 10: light test week; shows week 12's target (code fills it in)
      - Week 11: light test week; shows week 12's target (code fills it in)
      - Week 12: Weekly running distance: 20 km
      Only weeks 8, 12 have the big test that measures the target. Each other week shows its next big week's target; code fills those in.

      THIS WEEK (week 4)
      Target: Weekly running distance: 12 km
      Test result: not logged
      Sessions done: 4 of 5. Key sessions: 1 done, 0 skipped. A key session done only as the 10-minute version counts as skipped.
      10-minute versions used: 0. Missed days: 1. Dropped days: 0.
      Their note: "Felt good"

      LAST 3 WEEKS
      - Week 3: target Weekly running distance: 12 km; result: 11 km; sessions done: 5 of 5; status: on_track

      SAFETY
      - The most week 8 may be: 17.6 km (one safe step). Code lowers anything past it.

      DECIDE
      1. status:
         - on_track: they hit the target
         - a_bit_behind: they missed it but did 50%+ of sessions
         - far_behind: they did under 50%, or skipped the key sessions
         Weigh the trend. One bad week after good ones is not the same as three weeks declining.
      2. nextTargets: one target for each of weeks 8, 12, in order: { weekNumber, kind: "number", metric, value, unit } or { weekNumber, kind: "deliverable", description }.
         - on_track: keep the plan. Raise it only if they clearly beat the target, never above week 12's target before week 12.
         - a_bit_behind: make the next step smaller and spread the remaining climb over the weeks left.
         - far_behind: week 8's target (next week shows it) equals this week's target.
         - The test was not logged: week 8's target (next week shows it) must not be higher than this week's.
         - Never set a target easier than what they last achieved (12 km), and no week easier than the week before it.
         - Week 12 stays exactly Weekly running distance: 20 km.
         - Keep each week's kind, metric and unit as planned.
         - In the message, don't say held, kept or stays when next week's target moves on, or goes up, raised or rises when it stays the same.
      3. messageToUser: one sentence, neutral and encouraging. Say what happens next, and say plainly if next week's
         target is held or lowered. Never ask a question. Never use the words "missed", "behind", "failed" or "fail".
      4. guidanceForNextWeek: 1-2 sentences for the person writing next week's tasks."
    `);
  });

  it('next week shows week 12 (closing light-goal week 8)', () => {
    const i = input(8, { target: km(16), lightTestGoal: true, lowerBound: 16, weeksLeft: lightLeft(9), safeMax: null });
    expect(buildWeeklyUpdatePrompt(i)).toMatchInlineSnapshot(`
      "THE PLAN
      Goal: Run 21 km a week
      Method: Ten percent rule. Rules: Add at most 10% a week
      Weeks left, as currently planned:
      - Week 9: light test week; shows week 12's target (code fills it in)
      - Week 10: light test week; shows week 12's target (code fills it in)
      - Week 11: light test week; shows week 12's target (code fills it in)
      - Week 12: Weekly running distance: 20 km
      Only weeks 12 have the big test that measures the target. Each other week shows its next big week's target; code fills those in.

      THIS WEEK (week 8)
      Target: Weekly running distance: 16 km
      Test result: test logged: 12 km, passed
      Sessions done: 4 of 5. Key sessions: 1 done, 0 skipped. A key session done only as the 10-minute version counts as skipped.
      10-minute versions used: 0. Missed days: 1. Dropped days: 0.
      Their note: "Felt good"

      LAST 3 WEEKS
      - Week 7: target Weekly running distance: 16 km; result: 11 km; sessions done: 5 of 5; status: on_track

      DECIDE
      1. status:
         - on_track: they hit the target
         - a_bit_behind: they missed it but did 50%+ of sessions
         - far_behind: they did under 50%, or skipped the key sessions
         Weigh the trend. One bad week after good ones is not the same as three weeks declining.
      2. nextTargets: one target for each of weeks 12, in order: { weekNumber, kind: "number", metric, value, unit } or { weekNumber, kind: "deliverable", description }.
         - on_track: keep the plan. Raise it only if they clearly beat the target, never above week 12's target before week 12.
         - a_bit_behind: make the next step smaller and spread the remaining climb over the weeks left.
         - Week 9 shows week 12's target: it keeps the goal whatever the status, and the message says the final week aims at the goal.
         - Never set a target easier than what they last achieved (16 km), and no week easier than the week before it.
         - Week 12 stays exactly Weekly running distance: 20 km.
         - Keep each week's kind, metric and unit as planned.
         - In the message, don't say held, kept or stays when next week's target moves on, or goes up, raised or rises when it stays the same.
      3. messageToUser: one sentence, neutral and encouraging. Say what happens next, and say plainly if next week's
         target is held or lowered. Never ask a question. Never use the words "missed", "behind", "failed" or "fail".
      4. guidanceForNextWeek: 1-2 sentences for the person writing next week's tasks."
    `);
  });
});
