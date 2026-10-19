import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Goal, GoalRoadmap, RoadmapWeek } from '../../types';
import { toJourneyData } from '../../lib/journeyAdapter';
import { StrategicRoadmap } from './StrategicRoadmap';

// Weekly update M1.5b (WU-40 (1)): a week jumped past the limit shows muted as "Paused", never as a week done.

const ROADMAP: GoalRoadmap = {
  finalGoal: 'Run 10K under 50 minutes',
  finalTest: '10K race',
  startingPoint: { value: 0, description: '' },
  method: { name: 'M', creator: 'C', summary: 'S', whyChosen: 'W', runnerUp: null, safety: 5, rules: [] },
  phases: [
    { name: 'Foundation', startWeek: 1, endWeek: 4, purpose: 'Base' },
    { name: 'Acceleration', startWeek: 5, endWeek: 8, purpose: 'Build' },
    { name: 'Mastery', startWeek: 9, endWeek: 12, purpose: 'Peak' },
  ],
};

const week = (weekNumber: number, over: Partial<RoadmapWeek> = {}) =>
  ({
    id: `rw-${weekNumber}`,
    goalId: 'g-1',
    weekNumber,
    phase: weekNumber <= 4 ? 'Foundation' : weekNumber <= 8 ? 'Acceleration' : 'Mastery',
    theme: `Theme ${weekNumber}`,
    status: 'pending',
    created_at: '',
    ...over,
  }) as RoadmapWeek;

/** Weeks 1 and 2 closed, weeks 3 to 5 jumped, week 6 open. */
const goal = {
  id: 'g-1',
  userId: 'u-1',
  rawGoal: 'Run a 10K',
  clarifiedOutcome: 'Sub-50',
  status: 'active',
  startDate: '2026-09-01T00:00:00.000Z',
  targetDate: '2026-12-24T00:00:00.000Z',
  currentWeek: 6,
  planVersion: 2,
  roadmap: ROADMAP,
  roadmapWeeks: [
    week(1, { status: 'completed', executionScore: 100 }),
    week(2, { status: 'completed', executionScore: 80 }),
    ...[3, 4, 5].map((n) => week(n, { status: 'completed', closedBy: 'jumped', jumped: true, executionScore: 0 })),
    week(6, { status: 'active' }),
    ...[7, 8, 9, 10, 11, 12].map((n) => week(n)),
  ],
  dailyTasks: [],
} as unknown as Goal;

describe('jumped weeks on the Roadmap (M1.5b, WU-40 (1))', () => {
  it('the adapter marks them jumped with no score', () => {
    const journey = toJourneyData(goal, '2026-10-12')!;
    const weeks = journey.phases.flatMap((p) => p.weeks);
    expect(weeks.filter((w) => w.jumped).map((w) => [w.weekNumber, w.executionScore])).toEqual([
      [3, undefined],
      [4, undefined],
      [5, undefined],
    ]);
  });

  it('a phase shows them as "Paused", not checked off, and leaves them out of its weeks done', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <StrategicRoadmap journey={toJourneyData(goal, '2026-10-12')!} />
      </MemoryRouter>
    );
    expect(screen.getByText('2 of 4 weeks')).toBeInTheDocument(); // Foundation: weeks 1 and 2
    expect(screen.getByText('0 of 4 weeks')).toBeInTheDocument(); // Acceleration: week 5 jumped, week 6 open

    const foundation = screen.getByRole('button', { name: /Foundation/ });
    await user.click(foundation);
    const list = document.getElementById(foundation.getAttribute('aria-controls')!)!;
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((row) => within(row).queryByText('Paused') !== null)).toEqual([false, false, true, true]);
    expect(rows.map((row) => within(row).queryByLabelText('Completed') !== null)).toEqual([true, true, false, false]);
  });
});
