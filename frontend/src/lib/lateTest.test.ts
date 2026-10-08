import { describe, expect, it } from 'vitest';
import type { DailyTask, Goal, Reconciliation, ReconcileDay, RoadmapWeek } from '../types';
import { lateTestWeek } from './lateTest';

// Week 1: Mon 2026-09-21 ... Sun 2026-09-27. Saturday is the test day, Sunday a rest day.
const task = (id: string, date: string, extra: Partial<DailyTask> = {}) =>
  ({ id, goalId: 'g', weekNumber: 1, dayNumber: 1, date, dayOfWeek: '', title: id, detailedSteps: '[]', implementationIntention: '', durationMinutes: 30, isRestDay: false, status: 'pending', created_at: '', ...extra }) as DailyTask;

const TASKS = [
  task('mon', '2026-09-21', { status: 'completed' }),
  task('fri', '2026-09-25'),
  task('sat', '2026-09-26', { isTestDay: true }),
  task('sun', '2026-09-27', { isRestDay: true }),
];

const WEEK = { weekNumber: 1, status: 'active', test: { type: 'time_trial', instructions: 'Run 5 km', passIf: 'under 27 min' }, testResult: null } as unknown as RoadmapWeek;

const goal = (week: Partial<RoadmapWeek> = {}, extra: Partial<Goal> = {}) =>
  ({ id: 'g', planVersion: 2, currentWeek: 1, roadmapWeeks: [{ ...WEEK, ...week }], dailyTasks: TASKS, ...extra }) as Goal;

const reconciled = (kind: ReconcileDay['kind'], goalId = 'g') =>
  ({ applies: true, goalId, days: [{ taskId: 'sat', date: '2026-09-26', weekNumber: 1, dayNumber: 6, isKeySession: false, isTestDay: true, kind }] }) as unknown as Reconciliation;

const SAT_NOON = new Date('2026-09-26T12:00:00Z');
const SUN_NOON = new Date('2026-09-27T12:00:00Z');

describe('lateTestWeek (missed sessions M4.1)', () => {
  it('is null before the test day closes: reconcile says planned, or (without reconcile) it is today', () => {
    expect(lateTestWeek(goal(), reconciled('planned'), SUN_NOON, 'UTC')).toBeNull();
    expect(lateTestWeek(goal(), null, SAT_NOON, 'UTC')).toBeNull();
    expect(lateTestWeek(goal(), null, new Date('2026-09-25T12:00:00Z'), 'UTC')).toBeNull();
  });

  it('returns the week after the close: reconcile says missed or done', () => {
    expect(lateTestWeek(goal(), reconciled('missed'), SUN_NOON, 'UTC')?.weekNumber).toBe(1);
    expect(lateTestWeek(goal(), reconciled('done'), SAT_NOON, 'UTC')?.weekNumber).toBe(1);
  });

  it('without reconcile (or with one for another goal), the test day dated before today counts as closed', () => {
    expect(lateTestWeek(goal(), null, SUN_NOON, 'UTC')?.weekNumber).toBe(1);
    expect(lateTestWeek(goal(), reconciled('planned', 'other-goal'), SUN_NOON, 'UTC')?.weekNumber).toBe(1);
  });

  it('reads "before today" in the user timezone', () => {
    // 2026-09-26T22:30Z is already Sunday in Addis Ababa (UTC+3), still Saturday in UTC.
    const late = new Date('2026-09-26T22:30:00Z');
    expect(lateTestWeek(goal(), null, late, 'Africa/Addis_Ababa')?.weekNumber).toBe(1);
    expect(lateTestWeek(goal(), null, late, 'UTC')).toBeNull();
  });

  it('is null once a result is logged, or once the week is completed by its review', () => {
    expect(lateTestWeek(goal({ testResult: { value: 26, passed: true } }), reconciled('missed'), SUN_NOON, 'UTC')).toBeNull();
    expect(lateTestWeek(goal({ status: 'completed' }), reconciled('missed'), SUN_NOON, 'UTC')).toBeNull();
  });

  it('is null for a goal that is not plan v2, a week without a test, and a week without a test day', () => {
    expect(lateTestWeek(goal({}, { planVersion: 1 }), null, SUN_NOON, 'UTC')).toBeNull();
    expect(lateTestWeek(goal({}, { planVersion: undefined }), null, SUN_NOON, 'UTC')).toBeNull();
    expect(lateTestWeek(goal({ test: null }), null, SUN_NOON, 'UTC')).toBeNull();
    expect(lateTestWeek(goal({}, { dailyTasks: TASKS.filter((t) => !t.isTestDay) }), null, SUN_NOON, 'UTC')).toBeNull();
  });

  it('still shows on a rest day today: the window is the test day close to the review', () => {
    // SUN_NOON is the rest day (sun).
    expect(lateTestWeek(goal(), reconciled('missed'), SUN_NOON, 'UTC')?.weekNumber).toBe(1);
  });

  it('only looks at the current week', () => {
    const next = { ...WEEK, weekNumber: 2, status: 'pending' } as RoadmapWeek;
    expect(lateTestWeek(goal({}, { currentWeek: 2, roadmapWeeks: [{ ...WEEK, status: 'completed' } as RoadmapWeek, next] }), null, SUN_NOON, 'UTC')).toBeNull();
  });
});
