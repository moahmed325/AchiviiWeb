import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { DailyTask, Goal, GoalRoadmap, RoadmapWeek } from '../types';
import { toJourneyData } from '../lib/journeyAdapter';

const ROADMAP: GoalRoadmap = {
  finalGoal: '49.98',
  startingPoint: { value: 60, description: '' },
  method: { name: 'Jack Daniels VDOT', creator: 'Jack Daniels', summary: 'Paces from your fitness.', whyChosen: 'You have a time goal.', runnerUp: null, safety: 5, rules: ['Most runs easy'] },
  phases: [
    { name: 'Foundation', startWeek: 1, endWeek: 4, purpose: 'Easy miles build the engine.' },
    { name: 'Acceleration', startWeek: 5, endWeek: 8, purpose: 'Build' },
    { name: 'Mastery', startWeek: 9, endWeek: 12, purpose: 'Peak' },
  ],
};

const week = (weekNumber: number, over: Partial<RoadmapWeek> = {}) =>
  ({
    id: `rw-${weekNumber}`, goalId: 'g-1', weekNumber, phase: 'Foundation', theme: `Theme ${weekNumber}`, status: 'pending',
    created_at: '', ...over,
  }) as RoadmapWeek;

const task = (id: string, weekNumber: number, status: 'completed' | 'pending', isRestDay = false) =>
  ({ id, goalId: 'g-1', weekNumber, dayNumber: 1, date: '2026-09-01', dayOfWeek: 'Monday', title: 'Run', detailedSteps: '[]', implementationIntention: '', durationMinutes: 30, isRestDay, status, created_at: '' }) as DailyTask;

/** Weeks 1 and 2 done, weeks 3 to 5 jumped, week 6 open. */
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
    week(1, { status: 'completed' }),
    week(2, { status: 'completed' }),
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

  it('shows progress: a ring for the weeks done and plain counts, with no goal number or checks (ND-35)', () => {
    renderPage();
    const progress = screen.getByRole('region', { name: 'Your progress' });
    expect(within(progress).getByRole('progressbar', { name: 'Progress toward your goal' })).toHaveAttribute('aria-valuetext', '17% of the plan done');
    expect(within(progress).getByText('Weeks done').nextElementSibling).toHaveTextContent('2 / 12');
    expect(within(progress).getByText('Sessions').nextElementSibling).toHaveTextContent('3');
    expect(within(progress).getByText('Practice days').nextElementSibling).toHaveTextContent('3 / 4');
    expect(within(progress).queryByText('Checks met')).not.toBeInTheDocument();
    expect(within(progress).queryByRole('img')).not.toBeInTheDocument();
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
    expect(within(weekItem(1)).queryByText('Target')).not.toBeInTheDocument();
    expect(within(weekItem(1)).queryByText('Your result')).not.toBeInTheDocument();
    expect(within(weekItem(1)).getByText('2 of 2')).toBeVisible();
    expect(within(weekItem(1)).getByText('Week 2 adds a tempo run.')).toBeVisible();
  });

  it('a jumped week is "Paused", never done', () => {
    renderPage();
    for (const n of [3, 4, 5]) expect(within(weekItem(n)).getByText('Paused')).toBeInTheDocument();
  });

  it('ends with the finish line and, on request, why the plan works', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 3, name: /^Finish line/ })).toBeInTheDocument();
    expect(screen.getByText(/^The last day of week 12\. No final test/)).toBeInTheDocument();
    const why = screen.getByRole('button', { name: /Why this plan works/ });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('You have a time goal.')).not.toBeVisible();
    await userEvent.click(why);
    expect(screen.getByText('You have a time goal.')).toBeVisible();
    expect(screen.getByText('Most runs easy')).toBeVisible();
  });
});
