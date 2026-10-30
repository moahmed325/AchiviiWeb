import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { DailyTask, Goal, GoalRoadmap, RoadmapWeek, WeekTarget } from '../types';
import { toJourneyData } from '../lib/journeyAdapter';

const ROADMAP: GoalRoadmap = {
  finalGoal: '49.98',
  finalTest: 'Run 10K on a flat course and record your time.',
  startingPoint: { value: 60, description: '' },
  method: { name: 'Jack Daniels VDOT', creator: 'Jack Daniels', summary: 'Paces from your fitness.', whyChosen: 'You have a time goal.', runnerUp: null, safety: 5, rules: ['Most runs easy'] },
  phases: [
    { name: 'Foundation', startWeek: 1, endWeek: 4, purpose: 'Easy miles build the engine.' },
    { name: 'Acceleration', startWeek: 5, endWeek: 8, purpose: 'Build' },
    { name: 'Mastery', startWeek: 9, endWeek: 12, purpose: 'Peak' },
  ],
};

const minutes = (value: number): WeekTarget => ({ kind: 'number', metric: '10K time', value, unit: 'min', direction: 'lower_is_better' });
const test = { type: 'timer' as const, instructions: 'Run 10K hard.', passIf: 'under the target' };

const week = (weekNumber: number, over: Partial<RoadmapWeek> = {}) =>
  ({
    id: `rw-${weekNumber}`, goalId: 'g-1', weekNumber, phase: 'Foundation', theme: `Theme ${weekNumber}`, status: 'pending',
    target: minutes(60 - weekNumber * (10 / 12)), test, created_at: '', ...over,
  }) as RoadmapWeek;

const task = (id: string, weekNumber: number, status: 'completed' | 'pending', isRestDay = false) =>
  ({ id, goalId: 'g-1', weekNumber, dayNumber: 1, date: '2026-09-01', dayOfWeek: 'Monday', title: 'Run', detailedSteps: '[]', implementationIntention: '', durationMinutes: 30, isRestDay, status, created_at: '' }) as DailyTask;

/** Weeks 1 and 2 done (week 1 met its target, week 2 did not), weeks 3 to 5 jumped, week 6 open. */
const goal = {
  id: 'g-1',
  userId: 'u-1',
  rawGoal: 'Run a 10K',
  clarifiedOutcome: '49.98',
  status: 'active',
  startDate: '2026-09-01T00:00:00.000Z',
  targetDate: '2026-11-30T00:00:00.000Z',
  currentWeek: 6,
  planVersion: 2,
  roadmap: ROADMAP,
  roadmapWeeks: [
    week(1, { status: 'completed', testResult: { value: 58.5, unit: 'min', passed: true } }),
    week(2, { status: 'completed', testResult: { value: 58.9, unit: 'min', passed: false } }),
    ...[3, 4, 5].map((n) => week(n, { status: 'completed', closedBy: 'jumped', jumped: true })),
    week(6, { status: 'active' }),
    ...[7, 8, 9, 10, 11, 12].map((n) => week(n)),
  ],
  weeklyReviews: [{ id: 'r1', goalId: 'g-1', weekNumber: 1, tasksPlanned: 2, tasksCompleted: 2, scorePercentage: 100, aiAdaptationInsight: 'Week 2 adds a tempo run.', created_at: '' }],
  dailyTasks: [task('a', 1, 'completed'), task('b', 1, 'completed'), task('c', 1, 'completed', true), task('d', 6, 'completed'), task('e', 6, 'pending')],
} as unknown as Goal;

vi.mock('../hooks/useJourneyData', () => ({ useJourneyData: () => toJourneyData(goal, '2026-10-12') }));
vi.mock('../context/GoalContext', () => ({ useGoal: () => ({ activeGoal: goal }) }));
vi.mock('../context/AuthContext', () => ({ useUserTimezone: () => 'UTC' }));

import { RoadmapPage } from './RoadmapPage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <RoadmapPage />
    </MemoryRouter>,
  );

const weekButton = (n: number) => screen.getByRole('button', { name: new RegExp(`^Week ${n}: `) });
const weekItem = (n: number) => weekButton(n).closest('li')!;

describe('the Roadmap (ND-33: progress at a glance, the whole plan with its details folded)', () => {
  it('heads with the goal the person chose, never the stored outcome, and where the plan stands', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Run a 10K' })).toBeInTheDocument();
    expect(screen.queryByText(/49\.98/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Week 6 of 12 · Acceleration · finishes /)).toBeInTheDocument();
  });

  it('shows progress: a ring for the way covered, now and the goal as times, the checks as a line, and plain counts', () => {
    renderPage();
    const progress = screen.getByRole('region', { name: 'Your progress' });
    expect(within(progress).getByRole('progressbar', { name: 'Progress toward your goal' })).toHaveAttribute('aria-valuetext', '11% of the way to 50:00');
    expect(within(progress).getByText('58:54')).toBeInTheDocument();
    expect(within(progress).getByText('50:00')).toBeInTheDocument();
    expect(within(progress).getByRole('img', { name: 'Weekly checks: start 60:00, week 1 58:30, week 2 58:54. Goal 50:00.' })).toBeInTheDocument();
    expect(within(progress).getByText('Weeks done').nextElementSibling).toHaveTextContent('2 / 12');
    expect(within(progress).getByText('Checks met').nextElementSibling).toHaveTextContent('1 / 2');
  });

  it('shows every phase and every week\'s title; this week is open, the rest are folded', async () => {
    renderPage();
    for (const phase of ['Foundation', 'Acceleration', 'Mastery']) expect(screen.getByRole('heading', { level: 3, name: phase })).toBeInTheDocument();
    for (let n = 1; n <= 12; n += 1) expect(weekButton(n)).toHaveTextContent('Theme ' + n);
    expect(weekButton(6)).toHaveAccessibleName('Week 6: Theme 6, this week');
    expect(weekButton(3)).toHaveAccessibleName('Week 3: Theme 3, paused');
    expect(weekItem(6)).toHaveAttribute('aria-current', 'step');
    expect(weekButton(6)).toHaveAttribute('aria-expanded', 'true');
    expect(within(weekItem(6)).getByText('1 of 2')).toBeVisible();
    expect(weekButton(1)).toHaveAttribute('aria-expanded', 'false');
    expect(within(weekItem(1)).getByText('Sep 1 – Sep 7')).not.toBeVisible();

    await userEvent.click(weekButton(1));
    expect(within(weekItem(1)).getByText('Sep 1 – Sep 7')).toBeVisible();
    expect(within(weekItem(1)).getByText('59:10 or less')).toBeVisible();
    expect(within(weekItem(1)).getByText('58:30 · beat by 0:40')).toBeVisible();
    expect(within(weekItem(1)).getByText('2 of 2')).toBeVisible();
    expect(within(weekItem(1)).getByText('Week 2 adds a tempo run.')).toBeVisible();
  });

  it('a check that missed its target reads "to go", never a failure; a jumped week is "Paused", never done', async () => {
    renderPage();
    await userEvent.click(weekButton(2));
    expect(within(weekItem(2)).getByText('58:54 · 0:34 to go')).toBeVisible();
    for (const n of [3, 4, 5]) {
      expect(within(weekItem(n)).getByText('Paused')).toBeInTheDocument();
      expect(within(weekItem(n)).queryByText(/beat by|to go/)).not.toBeInTheDocument();
    }
  });

  it('ends with the finish line and, on request, why the plan works', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 3, name: /^Finish line/ })).toBeInTheDocument();
    expect(screen.getByText('Run 10K on a flat course and record your time.')).toBeInTheDocument();
    const why = screen.getByRole('button', { name: /Why this plan works/ });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('You have a time goal.')).not.toBeVisible();
    await userEvent.click(why);
    expect(screen.getByText('You have a time goal.')).toBeVisible();
    expect(screen.getByText('Most runs easy')).toBeVisible();
  });
});
