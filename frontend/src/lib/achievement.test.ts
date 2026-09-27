import { describe, it, expect } from 'vitest';
import type { Goal } from '../types';
import {
  computeAchievementSummary,
  computeTotalPracticeMinutes,
  formatPracticeDuration,
  formatAchievementDate,
  extractFinalTestEvaluation,
} from './achievement';

describe('Achievement Metrics Calculation Engine (M9.3-R4)', () => {
  const baseGoal: Goal = {
    id: 'goal-achieve-1',
    userId: 'usr-1',
    rawGoal: 'Run a sub-45 10k',
    clarifiedOutcome: 'Run 10 kilometers under 45 minutes',
    methodologyNotes: 'Jack Daniels VDOT',
    canonicalMethodName: 'VDOT Running Formula',
    canonicalAuthority: 'Jack Daniels',
    status: 'completed',
    startDate: '2026-06-01',
    targetDate: '2026-08-30',
    currentWeek: 12,
    answers: '{}',
    routine: '{}',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-08-30T10:00:00Z',
    completedAt: '2026-08-30T10:00:00Z',
    roadmapWeeks: [
      {
        id: 'rw-4',
        goalId: 'goal-achieve-1',
        weekNumber: 4,
        theme: 'Phase 1 Benchmark',
        phase: 'Foundation',
        status: 'completed',
        objective: 'Build endurance',
        keyMilestone: 'Consistent pacing',
        targetIntensity: 3,
        plannedMinutes: 200,
        test: {
          type: 'timer',
          instructions: 'Run 5k at threshold pace',
          passIf: 'Under 22:30',
        },
        testResult: {
          value: '22:10',
          passed: true,
          unit: 'mm:ss',
          note: 'Strong finish',
        },
        created_at: '2026-06-01T00:00:00Z',
      },
      {
        id: 'rw-8',
        goalId: 'goal-achieve-1',
        weekNumber: 8,
        theme: 'Phase 2 Benchmark',
        phase: 'Acceleration',
        status: 'completed',
        objective: 'Speed endurance',
        keyMilestone: 'Negative splits',
        targetIntensity: 4,
        plannedMinutes: 240,
        test: {
          type: 'timer',
          instructions: 'Run 8k with progressive splits',
          passIf: 'Under 36:00',
        },
        testResult: {
          value: '35:45',
          passed: true,
          unit: 'mm:ss',
        },
        created_at: '2026-06-01T00:00:00Z',
      },
      {
        id: 'rw-12',
        goalId: 'goal-achieve-1',
        weekNumber: 12,
        theme: 'Phase 3 Capstone Verification',
        phase: 'Mastery',
        status: 'completed',
        objective: 'Sub-45 execution',
        keyMilestone: 'Official sub-45 10k',
        targetIntensity: 5,
        plannedMinutes: 260,
        target: {
          kind: 'number',
          metric: '10k Race Time',
          value: 45,
          unit: 'min',
          direction: 'lower_is_better',
        },
        test: {
          type: 'timer',
          instructions: 'Run 10 kilometers all out on verified flat course',
          passIf: 'Sub-45:00',
        },
        testResult: {
          value: '44:18',
          passed: true,
          unit: 'mm:ss',
          note: 'Goal achieved!',
        },
        created_at: '2026-06-01T00:00:00Z',
      },
    ],
    dailyTasks: [
      { id: 't1', goalId: 'goal-achieve-1', weekNumber: 1, dayNumber: 1, date: '2026-06-01', dayOfWeek: 'Monday', title: 'Easy Run', durationMinutes: 45, isRestDay: false, status: 'completed', slotTime: 'morning', detailedSteps: '[]', implementationIntention: '', created_at: '' },
      { id: 't2', goalId: 'goal-achieve-1', weekNumber: 1, dayNumber: 2, date: '2026-06-02', dayOfWeek: 'Tuesday', title: 'Rest Day', durationMinutes: 0, isRestDay: true, status: 'completed', slotTime: 'morning', detailedSteps: '[]', implementationIntention: '', created_at: '' },
      { id: 't3', goalId: 'goal-achieve-1', weekNumber: 1, dayNumber: 3, date: '2026-06-03', dayOfWeek: 'Wednesday', title: 'Intervals', durationMinutes: 50, isRestDay: false, status: 'completed', slotTime: 'morning', detailedSteps: '[]', implementationIntention: '', created_at: '' },
      { id: 't4', goalId: 'goal-achieve-1', weekNumber: 1, dayNumber: 4, date: '2026-06-04', dayOfWeek: 'Thursday', title: 'Rest Day', durationMinutes: 0, isRestDay: true, status: 'completed', slotTime: 'morning', detailedSteps: '[]', implementationIntention: '', created_at: '' },
      { id: 't5', goalId: 'goal-achieve-1', weekNumber: 1, dayNumber: 5, date: '2026-06-05', dayOfWeek: 'Friday', title: 'Tempo Run', durationMinutes: 40, isRestDay: false, status: 'completed', slotTime: 'morning', detailedSteps: '[]', implementationIntention: '', created_at: '' },
      { id: 't6', goalId: 'goal-achieve-1', weekNumber: 1, dayNumber: 6, date: '2026-06-06', dayOfWeek: 'Saturday', title: 'Long Run', durationMinutes: 65, isRestDay: false, status: 'pending', slotTime: 'morning', detailedSteps: '[]', implementationIntention: '', created_at: '' },
      { id: 't7', goalId: 'goal-achieve-1', weekNumber: 1, dayNumber: 7, date: '2026-06-07', dayOfWeek: 'Sunday', title: 'Recovery Walk', durationMinutes: 0, isRestDay: true, status: 'completed', slotTime: 'morning', detailedSteps: '[]', implementationIntention: '', created_at: '' },
    ],
  };

  it('1. Computes verified summary metrics with accurate adherence and benchmark counts', () => {
    const summary = computeAchievementSummary(baseGoal);

    expect(summary.goalId).toBe('goal-achieve-1');
    expect(summary.totalDays).toBe(90);
    // Active tasks: 4 tasks (t1, t3, t5, t6). Completed: 3 tasks (t1, t3, t5).
    expect(summary.totalPlannedSessions).toBe(4);
    expect(summary.completedSessions).toBe(3);
    // Adherence: 3 / 4 = 75%
    expect(summary.adherenceRate).toBe(75);
    // Completed weeks: 3
    expect(summary.completedWeeks).toBe(3);
    // Total benchmarks: 3, achieved: 3
    expect(summary.totalBenchmarks).toBe(3);
    expect(summary.benchmarksAchieved).toBe(3);
    expect(summary.completedAt).toBe('2026-08-30T10:00:00Z');
  });

  it('2. Handles 100% adherence and bounds percentage safely', () => {
    const allDoneGoal: Goal = {
      ...baseGoal,
      dailyTasks: (baseGoal.dailyTasks || []).map((t) => ({ ...t, status: 'completed' })),
    };

    const summary = computeAchievementSummary(allDoneGoal);
    expect(summary.completedSessions).toBe(4);
    expect(summary.totalPlannedSessions).toBe(4);
    expect(summary.adherenceRate).toBe(100);
  });

  it('3. Handles zero completed tasks gracefully without NaN', () => {
    const emptyGoal: Goal = {
      ...baseGoal,
      dailyTasks: [],
      roadmapWeeks: [],
      completedAt: null,
    };

    const summary = computeAchievementSummary(emptyGoal);
    expect(summary.completedSessions).toBe(0);
    expect(summary.totalPlannedSessions).toBe(0);
    expect(summary.adherenceRate).toBe(0);
    expect(summary.benchmarksAchieved).toBe(0);
    expect(summary.totalBenchmarks).toBe(0);
    expect(summary.completedAt).toBeDefined();
  });

  it('4. Calculates total practice minutes correctly excluding rest days', () => {
    // Completed non-rest tasks: t1 (45m) + t3 (50m) + t5 (40m) = 135m
    const totalMinutes = computeTotalPracticeMinutes(baseGoal);
    expect(totalMinutes).toBe(135);
  });

  it('5. Formats practice duration cleanly', () => {
    expect(formatPracticeDuration(0)).toBe('0 min');
    expect(formatPracticeDuration(45)).toBe('45 min');
    expect(formatPracticeDuration(60)).toBe('1 hr');
    expect(formatPracticeDuration(135)).toBe('2 hrs 15 min');
    expect(formatPracticeDuration(120)).toBe('2 hrs');
  });

  it('6. Formats completion dates gracefully', () => {
    expect(formatAchievementDate('2026-08-30T10:00:00Z')).toBe('August 30, 2026');
    expect(formatAchievementDate(null)).toBe('Completed');
    expect(formatAchievementDate('invalid')).toBe('Completed');
  });

  it('7. Extracts final capstone test evaluation accurately', () => {
    const evalData = extractFinalTestEvaluation(baseGoal);
    expect(evalData).not.toBeNull();
    expect(evalData?.testType).toBe('timer');
    expect(evalData?.targetDeliverable).toBe('10k Race Time: 45 min');
    expect(evalData?.instructions).toBe('Run 10 kilometers all out on verified flat course');
    expect(evalData?.passCriteria).toBe('Sub-45:00');
    expect(evalData?.result?.value).toBe('44:18');
    expect(evalData?.result?.passed).toBe(true);
  });
});
