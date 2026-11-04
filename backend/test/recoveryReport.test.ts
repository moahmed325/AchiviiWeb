import { describe, it, expect } from 'vitest';
import { formatRecoveryReport, moveKindsOf, recoveryReport, type ReportGoal, type ReportTask } from '../src/lib/insights/recoveryReport.js';

// I-30: the read-only recovery report. Days close at bedtime plus 2 hours (no bedtime set: 01:00 the next morning).

const NOW = new Date('2026-10-29T12:00:00Z'); // Thursday; Wednesday 10-28 has closed, today has not
const START = new Date('2026-09-01T00:00:00Z'); // week 9 on NOW

const step = (extra: Record<string, unknown> = {}) => ({ stepNumber: 1, title: 'Practise', instructions: 'Do it.', minutes: 30, ...extra });

let ids = 0;
const task = (date: string, weekNumber: number, status: 'completed' | 'pending', extra: Partial<ReportTask> & { steps?: unknown[] } = {}): ReportTask => {
  const { steps, ...rest } = extra;
  ids += 1;
  return {
    id: `t${ids}`,
    date,
    weekNumber,
    dayNumber: ids,
    status,
    isRestDay: false,
    isKeySession: false,
    isTestDay: false,
    notOffered: false,
    usedMinimumVersion: false,
    detailedSteps: JSON.stringify(steps ?? [step()]),
    ...rest,
  };
};

const goal = (tasks: ReportTask[], extra: Partial<ReportGoal> = {}): ReportGoal => ({
  id: `g${ids}`,
  isGoldenRail: false,
  status: 'active',
  startDate: START,
  totalWeeks: 12,
  routine: '{}',
  user: { timezone: 'UTC' },
  dailyTasks: tasks,
  roadmapWeeks: [],
  ...extra,
});

const marker = { taskId: 'x', date: '2026-09-01', replaced: [] };

describe('moveKindsOf', () => {
  it('reads each recovery marker, and none on an ordinary step', () => {
    expect([...moveKindsOf([step()])]).toEqual([]);
    expect([...moveKindsOf([step({ carriedFrom: marker }), step({ shiftedFrom: marker })])].sort()).toEqual(['carried', 'in_order']);
    expect([...moveKindsOf([step({ swappedFrom: { taskId: 'x', date: '2026-09-01' } }), step({ continueFrom: { taskId: 'x', date: '2026-09-01' } })])].sort()).toEqual([
      'continued',
      'swapped',
    ]);
  });
});

describe('recoveryReport (I-30)', () => {
  it('days done: moved steps against ordinary days, closed practice days only', () => {
    const report = recoveryReport(
      [
        goal([
          task('2026-10-26', 9, 'completed'),
          task('2026-10-27', 9, 'pending'),
          task('2026-10-28', 9, 'completed', { steps: [step({ carriedFrom: marker })] }),
          task('2026-10-25', 8, 'pending', { steps: [step({ shiftedFrom: marker })] }),
          // Not counted: a rest day, a day not offered, today (still open) and a day ahead.
          task('2026-10-24', 8, 'pending', { isRestDay: true }),
          task('2026-10-23', 8, 'pending', { notOffered: true }),
          task('2026-10-29', 9, 'pending', { steps: [step({ carriedFrom: marker })] }),
          task('2026-10-30', 9, 'pending'),
        ]),
      ],
      NOW
    );
    expect(report.all.ordinaryDays).toEqual({ total: 2, done: 1 });
    expect(report.all.anyMovedDays).toEqual({ total: 2, done: 1 });
    expect(report.all.movedDays.carried).toEqual({ total: 1, done: 1 });
    expect(report.all.movedDays.in_order).toEqual({ total: 1, done: 0 });
    expect(report.all.movedDays.swapped).toEqual({ total: 0, done: 0 });
  });

  it('coming back: the closed practice day after each miss, across rest days and weeks', () => {
    const report = recoveryReport(
      [
        goal([
          task('2026-10-20', 8, 'pending'), // missed, next practice day 10-22 done
          task('2026-10-21', 8, 'pending', { isRestDay: true }),
          task('2026-10-22', 8, 'completed'),
          task('2026-10-26', 8, 'pending'), // missed, next 10-27 missed
          task('2026-10-27', 9, 'pending'), // missed, next 10-28 done
          task('2026-10-28', 9, 'completed'),
          task('2026-10-29', 9, 'pending'), // today: still open, so it is no one's next day
        ]),
      ],
      NOW
    );
    expect(report.all.comeback).toEqual({ total: 3, done: 2 });
  });

  it('after a break: the first week back, never a jumped week', () => {
    const report = recoveryReport(
      [
        goal([task('2026-10-19', 8, 'completed'), task('2026-10-21', 8, 'pending'), task('2026-10-26', 9, 'pending')], {
          roadmapWeeks: [
            { weekNumber: 8, breakDays: 12, jumped: false },
            { weekNumber: 9, breakDays: 9, jumped: true },
          ],
        }),
        goal([task('2026-10-20', 8, 'pending')], { roadmapWeeks: [{ weekNumber: 8, breakDays: 20, jumped: false }] }),
      ],
      NOW
    );
    expect(report.all.firstWeekBackDays).toEqual({ total: 3, done: 1 });
    expect(report.all.firstWeekBackGoals).toEqual({ total: 2, done: 1 });
  });

  it('still going: goals that reached week N on the calendar, split by a miss in week 1', () => {
    const report = recoveryReport(
      [
        // Missed a day in week 1, still practising in week 9.
        goal([task('2026-09-01', 1, 'pending'), task('2026-09-02', 1, 'completed'), task('2026-10-27', 9, 'completed')]),
        // No miss in week 1, stopped after week 3.
        goal([task('2026-09-01', 1, 'completed'), task('2026-09-15', 3, 'completed')]),
        // Started a week ago: has reached week 2 only.
        goal([task('2026-10-22', 1, 'completed')], { startDate: new Date('2026-10-22T00:00:00Z') }),
        // A 4-week plan never counts at week 8.
        goal([task('2026-09-01', 1, 'completed'), task('2026-09-22', 4, 'completed')], { totalWeeks: 4 }),
      ],
      NOW
    );
    expect(report.all.stillGoing[2]).toEqual({ total: 4, done: 3 });
    expect(report.all.stillGoing[4]).toEqual({ total: 3, done: 2 });
    expect(report.all.stillGoing[8]).toEqual({ total: 2, done: 1 });
    expect(report.all.stillGoing[12]).toEqual({ total: 0, done: 0 });
    expect(report.all.stillGoingAfterEarlyMiss[8]).toEqual({ total: 1, done: 1 });
    expect(report.all.stillGoingNoEarlyMiss[8]).toEqual({ total: 1, done: 0 });
  });

  it('splits pathway and custom goals; a bad stored step reads as ordinary', () => {
    const report = recoveryReport(
      [
        goal([task('2026-10-26', 9, 'completed')], { isGoldenRail: true }),
        goal([task('2026-10-26', 9, 'pending', { detailedSteps: 'not json' })]),
      ],
      NOW
    );
    expect(report.all.goals).toBe(2);
    expect(report.pathway).toMatchObject({ goals: 1, ordinaryDays: { total: 1, done: 1 } });
    expect(report.custom).toMatchObject({ goals: 1, ordinaryDays: { total: 1, done: 0 } });
  });

  it('prints each group with shares, and a dash where there is nothing to count', () => {
    const text = formatRecoveryReport(recoveryReport([goal([task('2026-10-26', 9, 'completed'), task('2026-10-27', 9, 'pending')])], NOW));
    expect(text).toContain('All goals: 1 goal');
    expect(text).toContain('Custom goals: 1 goal');
    expect(text).toContain('Pathway goals: 0 goals');
    expect(text).toMatch(/Ordinary practice days\s+50%\s+\(1 of 2 days\)/);
    expect(text).toMatch(/Days holding a moved step\s+—\s+\(0 of 0 days\)/);
  });
});
