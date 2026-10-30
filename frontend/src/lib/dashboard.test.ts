import { describe, expect, it } from 'vitest';
import type { DailyTask, Goal, RoadmapWeek } from '../types';
import { dateOfDay, goalTrend, greetingFor, journeyDays, milestones, practiceStreak, practiceTimeLabel, practiceTotals, type MapDay } from './dashboard';

const NOW = new Date('2026-10-29T10:00:00Z');
// Day 10 of 90 on NOW: the target date is 81 days later (`dayNumber` counts 91 minus the days remaining).
const TARGET = '2027-01-18T00:00:00.000Z';

const task = (date: string, overrides: Partial<DailyTask> = {}): DailyTask => ({
  id: date, goalId: 'g', weekNumber: 2, dayNumber: 1, date, dayOfWeek: 'Monday', title: 'Session', detailedSteps: '[]',
  implementationIntention: '', durationMinutes: 40, isRestDay: false, status: 'pending', created_at: '', ...overrides,
});

const goalWith = (dailyTasks: DailyTask[]) => ({ targetDate: TARGET, dailyTasks }) as Pick<Goal, 'targetDate' | 'dailyTasks'>;

describe('journeyDays (ND-29)', () => {
  it('counts plan days the way Today does: day 1 is 90 days before the target, today is day 10', () => {
    expect(dateOfDay({ targetDate: TARGET }, 10)).toBe('2026-10-29');
    expect(dateOfDay({ targetDate: TARGET }, 1)).toBe('2026-10-20');
    expect(journeyDays(goalWith([]), NOW, 'UTC')).toHaveLength(90);
  });

  it('done, a practice day not done, rest, today, ahead, and a day with no row', () => {
    const days = journeyDays(
      goalWith([
        task('2026-10-26', { status: 'completed' }),
        task('2026-10-27'),
        task('2026-10-28', { isRestDay: true }),
        task('2026-10-29'),
        task('2026-10-30'),
      ]),
      NOW,
      'UTC',
    );
    const state = (date: string) => days.find((day) => day.date === date)?.state;
    expect(state('2026-10-26')).toBe('done');
    expect(state('2026-10-27')).toBe('missed');
    expect(state('2026-10-28')).toBe('rest');
    expect(state('2026-10-29')).toBe('today');
    expect(state('2026-10-30')).toBe('ahead');
    expect(state('2026-10-25')).toBe('quiet');
    expect(days.filter((day) => day.isToday).map((day) => day.date)).toEqual(['2026-10-29']);
  });

  it('a date with two rows (a week boundary) is done when either is; a rest day marked complete never counts as practice', () => {
    const days = journeyDays(
      goalWith([task('2026-10-26'), task('2026-10-26', { id: 'b', status: 'completed' }), task('2026-10-27', { isRestDay: true, status: 'completed' })]),
      NOW,
      'UTC',
    );
    expect(days.find((day) => day.date === '2026-10-26')?.state).toBe('done');
    expect(days.find((day) => day.date === '2026-10-27')?.state).toBe('rest');
  });
});

describe('practiceTotals (ND-29)', () => {
  it('sessions, minutes (the 10-minute version counts as its own minutes) and practice days so far', () => {
    const totals = practiceTotals(
      goalWith([
        task('2026-10-26', { status: 'completed' }),
        task('2026-10-27', { status: 'completed', usedMinimumVersion: true, minimumVersion: { stepNumber: 1, title: 'Short', durationMinutes: 12, instructions: '', focusCue: '', pitfallToAvoid: '' } }),
        task('2026-10-28'),
        task('2026-10-29'),
      ]),
      NOW,
      'UTC',
    );
    expect(totals).toEqual({ sessionsDone: 2, minutesPractised: 52, daysDone: 2, daysSoFar: 3 });
  });

  it('labels practice time in minutes, then hours', () => {
    expect(practiceTimeLabel(45)).toBe('45 min');
    expect(practiceTimeLabel(60)).toBe('1 hour');
    expect(practiceTimeLabel(90)).toBe('1.5 hours');
    expect(practiceTimeLabel(600)).toBe('10 hours');
  });
});

const week = (weekNumber: number, overrides: Partial<RoadmapWeek> = {}): RoadmapWeek => ({
  id: 'w' + weekNumber, goalId: 'g', weekNumber, phase: 'Base', theme: '', objective: '', keyMilestone: '', targetIntensity: 1,
  plannedMinutes: 0, status: 'pending', created_at: '', test: { type: 'timer', instructions: '', passIf: '' }, ...overrides,
});
const minutes = (value: number) => ({ kind: 'number' as const, metric: '10K time', value, unit: 'min', direction: 'lower_is_better' as const });
const roadmap = (start: number | null) => ({ startingPoint: { value: start, description: '' } }) as Goal['roadmap'];

describe('goalTrend (ND-29)', () => {
  it('a time to beat: the gap closed, the latest result, and a new best', () => {
    const trend = goalTrend({
      roadmap: roadmap(60),
      roadmapWeeks: [
        week(12, { target: minutes(50) }),
        week(1, { target: minutes(59), testResult: { value: 58, passed: true } }),
        week(2, { target: minutes(58), testResult: { value: '56', passed: true } }),
      ],
    });
    expect(trend).toMatchObject({ metric: '10K time', start: 60, target: 50, targetWeek: 12, latest: 56, newBest: true });
    expect(trend?.points).toEqual([{ week: 1, value: 58 }, { week: 2, value: 56 }]);
    expect(trend?.gapClosed).toBeCloseTo(0.4);
  });

  it('a slower result is not a new best; light tests, paused weeks and words never count', () => {
    const trend = goalTrend({
      roadmap: roadmap(60),
      roadmapWeeks: [
        week(1, { target: minutes(59), testResult: { value: 55, passed: true } }),
        week(2, { target: minutes(58), testResult: { value: 57, passed: true } }),
        week(3, { target: minutes(57), test: { type: 'timer', instructions: '', passIf: '', light: true }, testResult: { value: 'Done', passed: true } }),
        week(4, { target: minutes(56), jumped: true, testResult: { value: 40, passed: true } }),
        week(5, { target: minutes(55), testResult: { value: 'felt fast', passed: true } }),
        week(12, { target: minutes(50) }),
      ],
    });
    expect(trend?.points.map((point) => point.week)).toEqual([1, 2]);
    expect(trend?.newBest).toBe(false);
    expect(trend?.gapClosed).toBeCloseTo(0.3);
  });

  it('higher is better, no result yet, and an unknown start', () => {
    const reps = { kind: 'number' as const, metric: 'Push-ups', value: 40, unit: 'reps', direction: 'higher_is_better' as const };
    expect(goalTrend({ roadmap: roadmap(10), roadmapWeeks: [week(12, { target: reps })] })).toMatchObject({ latest: null, gapClosed: null, newBest: false });
    const unknownStart = goalTrend({ roadmap: roadmap(null), roadmapWeeks: [week(1, { target: reps, testResult: { value: 12, passed: true } }), week(12, { target: reps })] });
    expect(unknownStart).toMatchObject({ start: null, latest: 12, gapClosed: null, newBest: false });
  });

  it('a goal measured by deliverables has no trend; its checks count as milestones', () => {
    const weeks = [
      week(1, { target: { kind: 'deliverable', description: 'A brief' }, testResult: { value: 'Done', passed: true } }),
      week(2, { target: { kind: 'deliverable', description: 'A mock-up' }, testResult: { value: 'Half', passed: false } }),
      week(3, { target: { kind: 'deliverable', description: 'A test' } }),
      week(4, { test: { type: 'photo', instructions: '', passIf: '', light: true } }),
    ];
    expect(goalTrend({ roadmap: roadmap(null), roadmapWeeks: weeks })).toBeNull();
    expect(milestones({ roadmapWeeks: weeks })).toEqual({ reached: 1, total: 3 });
  });
});

describe('greetingFor (ND-29)', () => {

  it("greets by the person's own hour", () => {
    expect(greetingFor(NOW, 'UTC')).toBe('Good morning');
    expect(greetingFor(NOW, 'America/Los_Angeles')).toBe('Good evening');
    expect(greetingFor(NOW, 'Asia/Tokyo')).toBe('Good evening');
    expect(greetingFor(new Date('2026-10-29T14:00:00Z'), 'UTC')).toBe('Good afternoon');
  });
});

describe('practiceStreak (ND-33)', () => {
  const run = (states: MapDay['state'][]) => practiceStreak(states.map((state, i) => ({ day: i + 1, date: '', state, isToday: state === 'today' })));

  it('counts done days in a row; rest and unplanned days keep it, a missed day ends it, today to do does not', () => {
    expect(run(['done', 'done', 'missed', 'done', 'rest', 'done', 'today', 'ahead'])).toEqual({ current: 2, best: 2 });
    expect(run(['done', 'done', 'done', 'missed', 'done', 'quiet', 'done'])).toEqual({ current: 2, best: 3 });
    expect(run(['missed', 'today'])).toEqual({ current: 0, best: 0 });
  });

  it('stops at the first day ahead', () => {
    expect(run(['done', 'ahead', 'done'])).toEqual({ current: 1, best: 1 });
  });
});
