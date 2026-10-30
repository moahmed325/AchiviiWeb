import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Goal, GoalRoadmap, RoadmapWeek } from '../types';
import { toJourneyData } from '../lib/journeyAdapter';

// Weekly update M1.5b review fix 3 (WU-40 (1)): the 12-week strip never fills a jumped week as done.

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

const week = (weekNumber: number, over: Partial<RoadmapWeek> = {}) =>
  ({ id: `rw-${weekNumber}`, goalId: 'g-1', weekNumber, phase: 'Foundation', theme: `Theme ${weekNumber}`, status: 'pending', created_at: '', ...over }) as RoadmapWeek;

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
    week(1, { status: 'completed' }),
    week(2, { status: 'completed' }),
    ...[3, 4, 5].map((n) => week(n, { status: 'completed', closedBy: 'jumped', jumped: true })),
    week(6, { status: 'active' }),
    ...[7, 8, 9, 10, 11, 12].map((n) => week(n)),
  ],
  dailyTasks: [],
} as unknown as Goal;

vi.mock('../hooks/useJourneyData', () => ({ useJourneyData: () => toJourneyData(goal, '2026-10-12') }));

import { RoadmapPage } from './RoadmapPage';

describe('the Roadmap week strip (M1.5b review fix 3)', () => {
  it('a jumped week gets its own muted state, never completed', () => {
    render(
      <MemoryRouter>
        <RoadmapPage />
      </MemoryRouter>
    );
    const strip = screen.getByRole('img', { name: 'Week 6 of 12' });
    const states = Array.from(strip.querySelectorAll('.road-week')).map((el) => el.getAttribute('data-state'));
    expect(states).toEqual(['completed', 'completed', 'paused', 'paused', 'paused', 'current', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });
});
