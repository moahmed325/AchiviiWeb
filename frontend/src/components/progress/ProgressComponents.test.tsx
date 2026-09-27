import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DailyTask, Goal, RoadmapWeek } from '../../types';
import { CompletionOverview } from './CompletionOverview';
import { PhaseMilestonesCard } from './PhaseMilestonesCard';
import { WeekBreakdownList } from './WeekBreakdownList';

const createSampleTasks = (): DailyTask[] => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  // 2 weeks of tasks: 5 active days per week, 2 rest days
  const tasks: DailyTask[] = [];
  for (let w = 1; w <= 2; w++) {
    for (let d = 0; d < 7; d++) {
      const isRest = d === 5 || d === 6;
      tasks.push({
        id: `t-w${w}-d${d}`,
        goalId: 'g-1',
        weekNumber: w,
        dayNumber: (w - 1) * 7 + d + 1,
        date: `2026-09-${String((w - 1) * 7 + d + 1).padStart(2, '0')}`,
        dayOfWeek: days[d],
        title: isRest ? 'Active Recovery' : `Practice Session ${d + 1}`,
        detailedSteps: '[]',
        implementationIntention: '',
        durationMinutes: 45,
        isRestDay: isRest,
        status: w === 1 && !isRest ? 'completed' : 'pending',
        created_at: '',
      } as DailyTask);
    }
  }
  return tasks;
};

const createSampleWeeks = (): RoadmapWeek[] => [
  {
    id: 'rw-1',
    goalId: 'g-1',
    weekNumber: 1,
    phase: 'Foundation',
    theme: 'Core Posture & Mechanics',
    objective: 'Establish fundamental motor patterns',
    keyMilestone: 'Consistent form across 5 sessions',
    targetIntensity: 3,
    plannedMinutes: 225,
    status: 'completed',
    executionScore: 100,
    created_at: '',
  },
  {
    id: 'rw-2',
    goalId: 'g-1',
    weekNumber: 2,
    phase: 'Foundation',
    theme: 'Tempo & Control',
    objective: 'Increase repetition consistency at 60 bpm',
    keyMilestone: 'Zero errors on standard drill',
    targetIntensity: 3,
    plannedMinutes: 225,
    status: 'active',
    created_at: '',
  },
  {
    id: 'rw-3',
    goalId: 'g-1',
    weekNumber: 3,
    phase: 'Development',
    theme: 'Dynamic Speed',
    objective: 'Advance tempo safely',
    keyMilestone: 'Sustain speed without tension',
    targetIntensity: 4,
    plannedMinutes: 240,
    status: 'pending',
    created_at: '',
  },
];

const createSampleGoal = (tasks: DailyTask[], weeks: RoadmapWeek[]): Goal =>
  ({
    id: 'g-1',
    userId: 'u-1',
    rawGoal: 'Run a 10K Under 50 Minutes',
    clarifiedOutcome: 'Achieve sub-50 minute 10K pace with steady breathing',
    status: 'active',
    startDate: '2026-09-01',
    targetDate: '2026-11-30',
    currentWeek: 2,
    answers: '{}',
    routine: '{}',
    created_at: '',
    updated_at: '',
    roadmapWeeks: weeks,
    dailyTasks: tasks,
  }) as Goal;

describe('Progress Components (M8.2 — Completion and Milestones)', () => {
  it('CompletionOverview renders active sessions done, adherence, elapsed days, and duration', () => {
    const tasks = createSampleTasks();
    const weeks = createSampleWeeks();
    const goal = createSampleGoal(tasks, weeks);

    render(<CompletionOverview goal={goal} currentDay={14} />);

    // Day 14 of 90
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('Day 14 of 90')).toBeInTheDocument();

    // 5 sessions completed out of 10 planned active sessions (w1: 5 done, w2: 0 done)
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Practice sessions')).toBeInTheDocument();
    expect(screen.getByText('of 10 planned')).toBeInTheDocument();

    // Adherence: 5 / 10 = 50%
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Execution adherence')).toBeInTheDocument();

    // Practice time: 5 * 45m = 225m = 3 hrs 45 min
    expect(screen.getByText('3 hrs 45 min')).toBeInTheDocument();
    expect(screen.getByText('Total practice time')).toBeInTheDocument();
  });

  it('PhaseMilestonesCard groups weeks by phase, displaying phase names, milestone status, and scores', () => {
    const tasks = createSampleTasks();
    const weeks = createSampleWeeks();
    const goal = createSampleGoal(tasks, weeks);

    render(<PhaseMilestonesCard goal={goal} />);

    // Default phases rendered
    expect(screen.getByText('Foundation')).toBeInTheDocument();
    expect(screen.getByText('Acceleration')).toBeInTheDocument();
    expect(screen.getByText('Mastery')).toBeInTheDocument();

    // Key milestones
    expect(screen.getByText('Consistent form across 5 sessions')).toBeInTheDocument();
    expect(screen.getByText('Zero errors on standard drill')).toBeInTheDocument();

    // Milestone heading
    expect(screen.getByRole('heading', { level: 2, name: /Phase milestones/i })).toBeInTheDocument();
  });

  it('WeekBreakdownList renders chronological weeks, themes, session counts, and execution scores', () => {
    const tasks = createSampleTasks();
    const weeks = createSampleWeeks();
    const goal = createSampleGoal(tasks, weeks);

    render(<WeekBreakdownList goal={goal} />);

    expect(screen.getByRole('heading', { level: 2, name: /Week by week/i })).toBeInTheDocument();

    // Week 1: 5 of 5 completed, 100% score
    expect(screen.getByText('Core Posture & Mechanics')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();

    // Week 2: Tempo & Control
    expect(screen.getByText('Tempo & Control')).toBeInTheDocument();
    expect(screen.getByText('0 of 5 practice days')).toBeInTheDocument();

    // Week 3 upcoming
    expect(screen.getByText('Dynamic Speed')).toBeInTheDocument();
  });
});
