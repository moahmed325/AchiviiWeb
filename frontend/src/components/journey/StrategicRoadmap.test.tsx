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

// Weekly update M2.1 (requirement 8): this week's target in a light week is the next check.
describe('a light week on the Roadmap (M2.1)', () => {
  const target = { kind: 'number' as const, metric: '10K time', value: 62, unit: 'minutes', direction: 'lower_is_better' as const };
  const withWeek6 = (over: Partial<RoadmapWeek>) =>
    ({ ...goal, currentWeek: 6, roadmapWeeks: goal.roadmapWeeks!.map((w) => (w.weekNumber === 6 ? { ...w, target, ...over } : w)) }) as Goal;
  const renderRoadmap = (g: Goal) =>
    render(
      <MemoryRouter>
        <StrategicRoadmap journey={toJourneyData(g, '2026-10-12')!} />
      </MemoryRouter>
    );

  it('shows "Next check, week 8: {target}" and the light test, no pass mark', () => {
    renderRoadmap(withWeek6({ test: { type: 'timer', instructions: "Run this week's long run as written.", passIf: 'Done as written', light: true } }));
    expect(screen.getByText('Next check, week 8: 10K time: 62 minutes or less')).toBeInTheDocument();
    expect(screen.getByText("Run this week's long run as written.")).toBeInTheDocument();
    expect(screen.queryByText(/Done as written/)).not.toBeInTheDocument();
  });

  it('a week without the light key shows its target and pass mark as before', () => {
    renderRoadmap(withWeek6({ test: { type: 'timer', instructions: 'Run 10 km.', passIf: '62 minutes' } }));
    expect(screen.getByText('10K time: 62 minutes or less')).toBeInTheDocument();
    expect(screen.getByText('Pass if 62 minutes.')).toBeInTheDocument();
    expect(screen.queryByText(/Next check/)).not.toBeInTheDocument();
  });
});

// Plan safety limits M1.3 (PSL-9, PSL-12): the honest line under week 12's target when it was lowered to a safe step.
describe('the honest week 12 line on the Roadmap (M1.3)', () => {
  const target12 = { kind: 'number' as const, metric: 'Long run distance', value: 16, unit: 'km', direction: 'higher_is_better' as const };
  const LONG = 'Week 12 aims at 16 km, a safe step. Your 21 km goal is the next step.';
  const SHORT = 'Week 12 aims at 16 km, a safe step.';
  const at = (currentWeek: number, week12Line: Goal['week12Line']) =>
    ({
      ...goal,
      currentWeek,
      week12Line,
      roadmapWeeks: goal.roadmapWeeks!.map((w) =>
        w.weekNumber === 12
          ? { ...w, status: currentWeek === 12 ? 'active' : 'pending', target: target12, test: { type: 'timer', instructions: 'Run it.', passIf: 'Long run distance: 16 km' } }
          : { ...w, status: w.weekNumber < currentWeek ? 'completed' : w.weekNumber === currentWeek ? 'active' : 'pending', jumped: false, closedBy: undefined }
      ),
    }) as Goal;
  const renderRoadmap = (g: Goal) =>
    render(
      <MemoryRouter>
        <StrategicRoadmap journey={toJourneyData(g, '2026-10-12')!} />
      </MemoryRouter>
    );

  it('week 12 current: the full line under its target and in the Destination', () => {
    renderRoadmap(at(12, { safe: '16 km', goal: '21 km' }));
    expect(screen.getByText('Long run distance: 16 km')).toBeInTheDocument();
    expect(screen.getAllByText(LONG)).toHaveLength(2);
  });

  it('the short line when the goal text named no number', () => {
    renderRoadmap(at(12, { safe: '16 km', goal: null }));
    expect(screen.getAllByText(SHORT)).toHaveLength(2);
    expect(screen.queryByText(/goal is the next step/)).not.toBeInTheDocument();
  });

  it('another week current: only the Destination shows it', () => {
    renderRoadmap(at(6, { safe: '16 km', goal: '21 km' }));
    expect(screen.getAllByText(LONG)).toHaveLength(1);
  });

  it('nothing when week12Line is null', () => {
    renderRoadmap(at(12, null));
    expect(screen.queryByText(/Week 12 aims at/)).not.toBeInTheDocument();
  });
});
