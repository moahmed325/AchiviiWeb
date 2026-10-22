import { describe, it, expect } from 'vitest';
import { dailyTimeCheckOf, retestInfo, type RetestTask, type RetestWeek } from '../src/lib/weekClose/retest.js';
import { easyRetestStep, retestStepFor } from '../src/lib/ai/retestStep.js';
import type { WeekTest } from '../src/lib/ai/roadmap.js';

// Weekly update M3.3b (WU-58 (1), (2), (3), RULE-6, WU-20 (1), WU-53): what the app is told about the re-test.

const RESULT = { value: 26, unit: 'min', passed: false };
const TEST = { type: 'time_trial', instructions: 'Run 5 km at an even, hard effort.', passIf: 'under 27 minutes' } as unknown as WeekTest;
const LEAD = { title: 'Easy run', instructions: 'Run easy.', durationMinutes: 15 };

const row = (weekNumber: number, status: string, extra: Partial<RetestWeek> = {}): RetestWeek => ({
  weekNumber,
  status,
  retestOfWeek: null,
  updateStatus: null,
  testResult: null,
  dailyTimeAskedAt: null,
  ...extra,
});

/** Weeks 1 to `open - 1` closed with the given statuses, `open` active and re-testing `open - 1`, the rest pending. */
function weeksWith(open: number, statuses: Record<number, string | null>, extra: Record<number, Partial<RetestWeek>> = {}): RetestWeek[] {
  return Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const status = n < open ? 'completed' : n === open ? 'active' : 'pending';
    return row(n, status, {
      updateStatus: statuses[n] ?? null,
      ...(n === open ? { retestOfWeek: open - 1 } : {}),
      ...extra[n],
    });
  });
}

/** The open week's seven days; `retestOn` (a day number within the week, 1 to 7) holds `step`. */
function tasksOf(open: number, retestOn: number | null = 2, step: object = retestStepFor(TEST, 15)): RetestTask[] {
  return Array.from({ length: 7 }, (_, i) => ({
    id: `t${i + 1}`,
    weekNumber: open,
    dayNumber: (open - 1) * 7 + i + 1,
    date: `2026-10-${String(19 + i).padStart(2, '0')}`,
    detailedSteps: JSON.stringify(i + 1 === retestOn ? [step, LEAD] : [LEAD]),
  }));
}

describe('retestInfo (WU-58)', () => {
  it('null when the open week has no retestOfWeek, or no week is open', () => {
    const weeks = weeksWith(4, { 2: 'far_behind', 3: 'far_behind' });
    weeks[3].retestOfWeek = null;
    expect(retestInfo(weeks, tasksOf(4))).toBeNull();
    expect(retestInfo(weeks.map((w) => ({ ...w, status: w.status === 'active' ? 'completed' : w.status })), tasksOf(4))).toBeNull();
  });

  it('names the day holding the measured re-test step', () => {
    expect(retestInfo(weeksWith(4, { 3: 'a_bit_behind' }), tasksOf(4, 3))).toEqual({
      ofWeek: 3,
      reason: 'not_logged',
      logged: false,
      taskId: 't3',
      date: '2026-10-21',
    });
  });

  it('null when no day holds the measured re-test: none at all, the easy re-test, or a model step titled "Re-test: "', () => {
    const weeks = weeksWith(4, { 3: null });
    expect(retestInfo(weeks, tasksOf(4, null))).toBeNull();
    expect(retestInfo(weeks, tasksOf(4, 2, easyRetestStep(15)))).toBeNull();
    expect(retestInfo(weeks, tasksOf(4, 2, { title: 'Re-test: a model step', instructions: 'x', durationMinutes: 10 }))).toBeNull();
    // A re-test step in another week is not this week's.
    expect(retestInfo(weeks, tasksOf(3, 2))).toBeNull();
  });

  it('two_hard_weeks: the re-tested week and the week before both stored far_behind, and its test was logged', () => {
    const weeks = weeksWith(4, { 2: 'far_behind', 3: 'far_behind' }, { 3: { testResult: RESULT } });
    expect(retestInfo(weeks, tasksOf(4))).toMatchObject({ ofWeek: 3, reason: 'two_hard_weeks', logged: false });
  });

  it('both apply: not_logged wins (WU-58 (2))', () => {
    expect(retestInfo(weeksWith(4, { 2: 'far_behind', 3: 'far_behind' }), tasksOf(4))?.reason).toBe('not_logged');
  });

  it('a week with no stored status is not far_behind (WU-53), and neither is a jumped week', () => {
    const noStatus = weeksWith(4, { 2: null, 3: 'far_behind' }, { 3: { testResult: RESULT } });
    expect(retestInfo(noStatus, tasksOf(4))?.reason).toBe('not_logged');
    const jumped = weeksWith(4, { 2: 'far_behind', 3: 'far_behind' }, { 2: { jumped: true }, 3: { testResult: RESULT } });
    expect(retestInfo(jumped, tasksOf(4))?.reason).toBe('not_logged');
  });

  it('week 1 as the re-tested week: there is no week before it, so not_logged', () => {
    const weeks = weeksWith(2, { 1: 'far_behind' }, { 1: { testResult: RESULT } });
    expect(retestInfo(weeks, tasksOf(2))).toMatchObject({ ofWeek: 1, reason: 'not_logged', logged: false });
  });

  it("logged only when the re-tested week's result names the open week (WU-58 (3))", () => {
    const logged = weeksWith(4, { 3: null }, { 3: { testResult: { ...RESULT, retestLoggedInWeek: 4 } } });
    expect(retestInfo(logged, tasksOf(4))?.logged).toBe(true);
    const otherWeek = weeksWith(4, { 3: null }, { 3: { testResult: { ...RESULT, retestLoggedInWeek: 3 } } });
    expect(retestInfo(otherWeek, tasksOf(4))?.logged).toBe(false);
    const noKey = weeksWith(4, { 3: null }, { 3: { testResult: RESULT } });
    expect(retestInfo(noKey, tasksOf(4))?.logged).toBe(false);
  });
});

describe('dailyTimeCheckOf (RULE-6, WU-7, WU-20 (1))', () => {
  const hard = { 2: 'far_behind', 3: 'far_behind' };

  it('asked after two hard weeks, with the shorter options ascending', () => {
    expect(dailyTimeCheckOf(weeksWith(4, hard, { 3: { testResult: RESULT } }), 60)).toEqual({ minutes: 60, shorter: [30, 45] });
  });

  it('asked after two hard weeks with no re-test (a light closing week, or the easy re-test): no retestOfWeek', () => {
    const weeks = weeksWith(4, hard, { 4: { retestOfWeek: null } });
    expect(dailyTimeCheckOf(weeks, 45)).toEqual({ minutes: 45, shorter: [30] });
  });

  it('none on the shortest daily time (section 5), or below every option', () => {
    expect(dailyTimeCheckOf(weeksWith(4, hard), 30)).toBeNull();
    expect(dailyTimeCheckOf(weeksWith(4, hard), 20)).toBeNull();
  });

  it("a daily time between options gets the shorter ones (a pathway's 35 minutes)", () => {
    expect(dailyTimeCheckOf(weeksWith(4, hard), 35)).toEqual({ minutes: 35, shorter: [30] });
  });

  it('none without two hard weeks before the open week: one hard week, or a fallback week (no status) in between', () => {
    expect(dailyTimeCheckOf(weeksWith(4, { 3: 'far_behind' }), 60)).toBeNull();
    expect(dailyTimeCheckOf(weeksWith(5, { 2: 'far_behind', 3: null, 4: 'far_behind' }), 60)).toBeNull();
  });

  it('none while the open week is week 12: no week is written after it', () => {
    expect(dailyTimeCheckOf(weeksWith(12, { 10: 'far_behind', 11: 'far_behind' }), 60)).toBeNull();
    expect(dailyTimeCheckOf(weeksWith(11, { 9: 'far_behind', 10: 'far_behind' }), 60)).toEqual({ minutes: 60, shorter: [30, 45] });
  });

  it('once: none when the open week was already asked', () => {
    expect(dailyTimeCheckOf(weeksWith(4, hard, { 4: { dailyTimeAskedAt: new Date() } }), 60)).toBeNull();
  });

  it('once per run: none when an earlier week of the same run was followed by a week that was asked', () => {
    // Weeks 2, 3 and 4 far_behind; week 4 (after 2 and 3) was asked; week 5 follows 3 and 4 in the same run.
    const sameRun = weeksWith(5, { 2: 'far_behind', 3: 'far_behind', 4: 'far_behind' }, { 4: { dailyTimeAskedAt: new Date() } });
    expect(dailyTimeCheckOf(sameRun, 60)).toBeNull();
  });

  it('asked again when a new run starts after a week that was not far_behind', () => {
    // Run 1: weeks 2 and 3, asked in week 4. Week 4 on track. Run 2: weeks 5 and 6, open week 7.
    const weeks = weeksWith(7, { 2: 'far_behind', 3: 'far_behind', 4: 'on_track', 5: 'far_behind', 6: 'far_behind' }, { 4: { dailyTimeAskedAt: new Date() } });
    expect(dailyTimeCheckOf(weeks, 60)).toEqual({ minutes: 60, shorter: [30, 45] });
  });
});
