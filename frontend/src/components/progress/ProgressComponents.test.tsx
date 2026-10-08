import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DailyTask, Goal, GoalRoadmap, RoadmapWeek } from '../../types';
import { CompletionOverview } from './CompletionOverview';
import { PhaseMilestonesCard } from './PhaseMilestonesCard';
import { WeekBreakdownList } from './WeekBreakdownList';
import { BenchmarkResultsCard } from './BenchmarkResultsCard';
import { AdaptationHistoryList } from './AdaptationHistoryList';

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

const ROADMAP: GoalRoadmap = {
  finalGoal: 'Run 10K under 50 minutes',
  finalTest: '10K time trial',
  startingPoint: { value: 0, description: '' },
  method: { name: 'M', creator: 'C', summary: 'S', whyChosen: 'W', runnerUp: null, safety: 5, rules: [] },
  phases: [
    { name: 'Foundation', startWeek: 1, endWeek: 4, purpose: 'Base' },
    { name: 'Acceleration', startWeek: 5, endWeek: 8, purpose: 'Build' },
    { name: 'Mastery', startWeek: 9, endWeek: 12, purpose: 'Peak' },
  ],
};

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
    planVersion: 2,
    roadmap: ROADMAP,
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

    // The roadmap's phases
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

  it('BenchmarkResultsCard renders benchmark targets, user results, and honest non-punitive badges (M8.3-R1)', () => {
    const tasks = createSampleTasks();
    const weeks: RoadmapWeek[] = [
      {
        id: 'rw-1',
        goalId: 'g-1',
        weekNumber: 1,
        phase: 'Foundation',
        theme: 'Core Posture',
        objective: 'Establish posture',
        keyMilestone: 'Consistent form',
        targetIntensity: 3,
        plannedMinutes: 225,
        status: 'completed',
        target: { kind: 'number', metric: 'Continuous tempo', value: 60, unit: 'bpm', direction: 'higher_is_better' },
        test: { type: 'count', instructions: 'Play 5 sets unbroken', passIf: '60 bpm clean' },
        testResult: { value: 62, unit: 'bpm', passed: true, note: 'Felt very natural' },
        created_at: '',
      },
      {
        id: 'rw-2',
        goalId: 'g-1',
        weekNumber: 2,
        phase: 'Foundation',
        theme: 'Tempo & Control',
        objective: 'Increase tempo',
        keyMilestone: 'Zero errors',
        targetIntensity: 3,
        plannedMinutes: 225,
        status: 'active',
        target: { kind: 'number', metric: 'Speed', value: 80, unit: 'bpm', direction: 'higher_is_better' },
        test: { type: 'count', instructions: 'Play at 80 bpm', passIf: '80 bpm clean' },
        testResult: { value: 72, unit: 'bpm', passed: false, note: 'Tension in left hand' },
        created_at: '',
      },
    ];
    const goal = createSampleGoal(tasks, weeks);

    render(<BenchmarkResultsCard goal={goal} />);

    expect(screen.getByRole('heading', { level: 2, name: /Benchmark results/i })).toBeInTheDocument();

    // Week 1 passed
    expect(screen.getByText(/Continuous tempo: 60 bpm/i)).toBeInTheDocument();
    expect(screen.getByText('62 bpm')).toBeInTheDocument();
    expect(screen.getByText(/Benchmark achieved/i)).toBeInTheDocument();
    expect(screen.getByText(/Felt very natural/i)).toBeInTheDocument();

    // Week 2 not passed: non-punitive styling
    expect(screen.getByText(/Speed: 80 bpm/i)).toBeInTheDocument();
    expect(screen.getByText('72 bpm')).toBeInTheDocument();
    expect(screen.getByText(/In progress · Reinforcing/i)).toBeInTheDocument();
    expect(screen.getByText(/Tension in left hand/i)).toBeInTheDocument();
  });

  it('AdaptationHistoryList renders reflections, score, and genuine server aiAdaptationInsight (M8.3-R2)', () => {
    const tasks = createSampleTasks();
    const weeks: RoadmapWeek[] = [
      {
        id: 'rw-1',
        goalId: 'g-1',
        weekNumber: 1,
        phase: 'Foundation',
        theme: 'Core Posture',
        objective: 'Establish posture',
        keyMilestone: 'Consistent form',
        targetIntensity: 3,
        plannedMinutes: 225,
        status: 'completed',
        created_at: '',
      },
    ];
    const goal = {
      ...createSampleGoal(tasks, weeks),
      weeklyReviews: [
        {
          id: 'wr-1',
          goalId: 'g-1',
          weekNumber: 1,
          tasksPlanned: 5,
          tasksCompleted: 5,
          scorePercentage: 100,
          reflection: 'Morning sessions worked best for consistency.',
          aiAdaptationInsight: '5 of 5 sessions completed. Solid adherence.',
          created_at: '2026-09-07T10:00:00Z',
        },
      ],
    };

    render(<AdaptationHistoryList goal={goal} />);

    expect(screen.getByRole('heading', { level: 2, name: /Adaptation history/i })).toBeInTheDocument();
    expect(screen.getByText('Morning sessions worked best for consistency.')).toBeInTheDocument();
    expect(screen.getByText('5 of 5 sessions completed. Solid adherence.')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('CompletionOverview renders calm, non-punitive early state at Week 1 with 0 completed (M8.4)', () => {
    // Tasks where none are completed yet
    const tasks = createSampleTasks().map((t) => ({ ...t, status: 'pending' as const }));
    const weeks = createSampleWeeks();
    const goal = { ...createSampleGoal(tasks, weeks), currentWeek: 1 };

    render(<CompletionOverview goal={goal} currentDay={1} />);

    // Day 1 of 90
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Day 1 of 90')).toBeInTheDocument();

    // 0 sessions completed
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Practice sessions')).toBeInTheDocument();
    expect(screen.getByText(/First session awaits · of 10 planned/i)).toBeInTheDocument();

    // 0% adherence with non-punitive orientation sublabel
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Execution adherence')).toBeInTheDocument();
    expect(screen.getByText(/Starting your journey · 0 of 5 to date/i)).toBeInTheDocument();

    // 0 min total practice time
    expect(screen.getByText('0 min')).toBeInTheDocument();
    expect(screen.getByText('Total practice time')).toBeInTheDocument();
  });

  it('AdaptationHistoryList renders encouraging card when goal has zero reviews (M8.4)', () => {
    const tasks = createSampleTasks();
    const weeks = createSampleWeeks().map((w) => ({
      ...w,
      status: (w.weekNumber === 1 ? 'active' : 'pending') as RoadmapWeek['status'],
      executionScore: undefined,
    }));
    const goal = { ...createSampleGoal(tasks, weeks), currentWeek: 1, weeklyReviews: [] };

    render(<AdaptationHistoryList goal={goal} />);

    expect(screen.getByRole('heading', { level: 2, name: /Adaptation history/i })).toBeInTheDocument();
    expect(screen.getByText('Weekly reviews unlock adaptation insights')).toBeInTheDocument();
    expect(
      screen.getByText(
        /At the end of each week, your review reflections and server path adaptations will appear here\./i,
      ),
    ).toBeInTheDocument();
  });

  it('BenchmarkResultsCard renders upcoming benchmark badge and pass criteria when no tests completed yet (M8.4)', () => {
    const tasks = createSampleTasks();
    const weeks: RoadmapWeek[] = [
      {
        id: 'rw-1',
        goalId: 'g-1',
        weekNumber: 1,
        phase: 'Foundation',
        theme: 'Core Posture',
        objective: 'Establish posture',
        keyMilestone: 'Consistent form',
        targetIntensity: 3,
        plannedMinutes: 225,
        status: 'active',
        target: { kind: 'number', metric: 'Continuous tempo', value: 60, unit: 'bpm', direction: 'higher_is_better' },
        test: { type: 'count', instructions: 'Play 5 sets unbroken without pausing', passIf: '60 bpm clean for 3 mins' },
        testResult: null,
        created_at: '',
      },
    ];
    const goal = { ...createSampleGoal(tasks, weeks), currentWeek: 1 };

    render(<BenchmarkResultsCard goal={goal} />);

    expect(screen.getByRole('heading', { level: 2, name: /Benchmark results/i })).toBeInTheDocument();
    expect(screen.getByText(/Week 1/i)).toBeInTheDocument();
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText(/Target: Continuous tempo: 60 bpm/i)).toBeInTheDocument();
    expect(screen.getByText(/Pass criteria: 60 bpm clean for 3 mins/i)).toBeInTheDocument();
    expect(screen.getByText('Play 5 sets unbroken without pausing')).toBeInTheDocument();
  });
});
