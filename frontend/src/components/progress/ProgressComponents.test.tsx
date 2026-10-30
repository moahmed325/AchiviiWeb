import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DailyTask, Goal, GoalRoadmap, RoadmapWeek } from '../../types';
import { WeekBreakdownList } from './WeekBreakdownList';
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

});

// Weekly update M1.4 (WU-33 (3), (4)): a week whose every practice day was not offered has no score, shown as not
// counted (no percentage, never 0%); the moved-plan line's {date} is filled in.
describe('Progress after days not offered (weekly update M1.4)', () => {
  const notOfferedTasks = (): DailyTask[] =>
    createSampleTasks().map((t) => (t.weekNumber === 2 && !t.isRestDay ? { ...t, notOffered: true, status: 'pending' } : t));
  const closedWeeks = (): RoadmapWeek[] =>
    createSampleWeeks().map((w) => (w.weekNumber === 2 ? { ...w, status: 'completed', executionScore: undefined } : w));

  it('WeekBreakdownList shows no score for a week with every practice day not offered, and counts no sessions', () => {
    const goal = { ...createSampleGoal(notOfferedTasks(), closedWeeks()), currentWeek: 3 };
    render(<WeekBreakdownList goal={goal} />);
    expect(screen.getByText('100%')).toBeInTheDocument(); // week 1
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('AdaptationHistoryList: a 0-of-0 review is not counted, and the moved-plan line has its date', () => {
    const goal = {
      ...createSampleGoal(notOfferedTasks(), closedWeeks()),
      currentWeek: 3,
      targetDate: '2026-12-24T00:00:00.000Z',
      weeklyReviews: [
        {
          id: 'wr-2',
          goalId: 'g-1',
          weekNumber: 2,
          tasksPlanned: 0,
          tasksCompleted: 0,
          scorePercentage: 0,
          reflection: '',
          aiAdaptationInsight: 'Your next week starts today. Your plan now ends on {date}.',
          created_at: '',
        },
      ],
    } as Goal;
    render(<AdaptationHistoryList goal={goal} />);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    const end = new Date(Date.UTC(2026, 11, 23)).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
      ...(new Date().getUTCFullYear() === 2026 ? {} : { year: 'numeric' }),
    });
    expect(screen.getByText(`Your next week starts today. Your plan now ends on ${end}.`)).toBeInTheDocument();
    expect(screen.queryByText(/\{date\}/)).not.toBeInTheDocument();
  });

  it('AdaptationHistoryList: the welcome-back line after a break (M1.5a) has its date', () => {
    const goal = {
      ...createSampleGoal(createSampleTasks(), closedWeeks()),
      currentWeek: 3,
      targetDate: '2026-12-24T00:00:00.000Z',
      weeklyReviews: [
        {
          id: 'wr-2',
          goalId: 'g-1',
          weekNumber: 2,
          tasksPlanned: 5,
          tasksCompleted: 5,
          scorePercentage: 100,
          reflection: '',
          aiAdaptationInsight: 'Welcome back. Your plan picks up from here and now ends on {date}.',
          created_at: '',
        },
      ],
    } as Goal;
    render(<AdaptationHistoryList goal={goal} />);
    const end = new Date(Date.UTC(2026, 11, 23)).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
      ...(new Date().getUTCFullYear() === 2026 ? {} : { year: 'numeric' }),
    });
    expect(screen.getByText(`Welcome back. Your plan picks up from here and now ends on ${end}.`)).toBeInTheDocument();
    expect(screen.queryByText(/\{date\}/)).not.toBeInTheDocument();
  });

});

describe('Progress with jumped weeks (weekly update M1.5b, WU-40 (1))', () => {
  /** Week 1 closed, weeks 2 and 3 jumped (week 3 holds a test), week 4 open. */
  const jumpedGoal = (): Goal =>
    ({
      ...createSampleGoal(createSampleTasks().filter((t) => t.weekNumber === 1), [
        ...createSampleWeeks().map((w) =>
          w.weekNumber === 1
            ? { ...w, test: { type: 'timer', instructions: 'Run 5 km', passIf: 'under 30 minutes' }, testResult: { value: 29, passed: true } }
            : { ...w, status: 'completed', closedBy: 'jumped', jumped: true, executionScore: 0, ...(w.weekNumber === 3 ? { test: { type: 'timer', instructions: 'Run 5 km', passIf: 'under 28 minutes' } } : {}) }
        ),
        { ...createSampleWeeks()[2], id: 'rw-4', weekNumber: 4, theme: 'Week four', status: 'active' },
      ] as RoadmapWeek[]),
      currentWeek: 4,
      targetDate: '2026-12-24T00:00:00.000Z',
      weeklyReviews: [
        {
          id: 'wr-1',
          goalId: 'g-1',
          weekNumber: 1,
          tasksPlanned: 5,
          tasksCompleted: 5,
          scorePercentage: 100,
          reflection: '',
          aiAdaptationInsight: 'Welcome back. Your plan picks up at week 4 and now ends on {date}.',
          created_at: '',
        },
      ],
    }) as Goal;

  it('WeekBreakdownList shows them muted as "Paused" with no score and no session count', () => {
    render(<WeekBreakdownList goal={jumpedGoal()} />);
    expect(screen.getAllByText('Paused')).toHaveLength(2);
    expect(screen.getByText('100%')).toBeInTheDocument(); // week 1
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.getAllByText('Done')).toHaveLength(1);
  });

  it('AdaptationHistoryList shows them as "Paused" with no score, and the line after "Keep going" has its date', () => {
    render(<AdaptationHistoryList goal={jumpedGoal()} />);
    expect(screen.getAllByText('Paused')).toHaveLength(2);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText('Phase milestone reached')).not.toBeInTheDocument();
    expect(screen.getByText(/^Welcome back\. Your plan picks up at week 4 and now ends on (?!\{date\}).+\.$/)).toBeInTheDocument();
  });

  it('AdaptationHistoryList with only jumped weeks keeps its early state', () => {
    const goal = { ...jumpedGoal(), weeklyReviews: [], roadmapWeeks: jumpedGoal().roadmapWeeks!.filter((w) => w.jumped) } as Goal;
    render(<AdaptationHistoryList goal={goal} />);
    expect(screen.getByText('Weekly reviews unlock adaptation insights')).toBeInTheDocument();
  });
});
