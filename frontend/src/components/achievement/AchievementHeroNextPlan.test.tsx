import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Goal, JourneyResult } from '../../types';
import { AchievementHero } from './AchievementHero';
import { computeAchievementSummary } from '../../lib/achievement';

// Next plan (NP-1, NP-2, NP-6, NP-7, NP-10): the end screen's line, its outcome and its choices. No weekly tests
// (2026-10-30): it says what they did, and a goal measured in a number asks the level now.

const pro = vi.hoisted(() => ({ value: false }));
vi.mock('../../hooks/useProEntitlement', () => ({ useProEntitlement: () => pro.value }));

const result = (over: Partial<JourneyResult> = {}): JourneyResult => ({
  kind: 'number',
  start: '3 km',
  startValue: 3,
  goal: 'Run 10 km without stopping',
  unit: 'km',
  direction: 'higher_is_better',
  weeksFinished: 11,
  sessionsDone: 52,
  sessionsPlanned: 60,
  ...over,
});

const goalWith = (journeyResult: JourneyResult | null, rawGoal = 'Run 10 km without stopping') =>
  ({
    id: 'g1',
    rawGoal,
    clarifiedOutcome: rawGoal,
    status: 'completed',
    roadmap: { answers: [] },
    roadmapWeeks: [],
    dailyTasks: [],
    journeyResult,
  }) as unknown as Goal;

const Probe = () => {
  const location = useLocation();
  return <pre data-testid="route">{JSON.stringify({ pathname: location.pathname, state: location.state })}</pre>;
};
const seenRoute = () => JSON.parse(screen.getByTestId('route').textContent ?? 'null');

const renderHero = (goal: Goal) =>
  render(
    <MemoryRouter initialEntries={['/achievement']}>
      <Routes>
        <Route
          path="/achievement"
          element={<AchievementHero goal={goal} summary={computeAchievementSummary(goal)} onViewResults={() => {}} onBeginAnotherJourney={() => {}} />}
        />
        <Route path="/onboarding" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  pro.value = false;
  localStorage.clear();
});

describe('end screen', () => {
  it('leads with the weeks and sessions done, then where they started and the goal (NP-1, NP-2)', () => {
    renderHero(goalWith(result()));
    expect(screen.getByText('You finished 11 of 12 weeks: 52 of 60 sessions.')).toBeInTheDocument();
    expect(screen.getByText('You started at 3 km. Your goal: Run 10 km without stopping.')).toBeInTheDocument();
    expect(screen.queryByText(/target|benchmark/i)).not.toBeInTheDocument();
  });

  it('free: no next plan and no Pro line (NP-7)', () => {
    renderHero(goalWith(result()));
    expect(screen.queryByRole('button', { name: /Keep going|Go further/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Pro/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose another pathway' })).toBeInTheDocument();
  });

  it('free on a pathway: restart it from the start', () => {
    renderHero(goalWith(result(), 'Run a 10K Under 50 Minutes'));
    expect(screen.getByRole('button', { name: /again from the start/ })).toBeInTheDocument();
  });

  it('Pro: keep going first, then go further (NP-6)', () => {
    pro.value = true;
    renderHero(goalWith(result()));
    expect(screen.getAllByRole('button', { name: /Keep going|Go further/ }).map((b) => b.textContent)).toEqual(['Keep going', 'Go further']);
  });

  it('a goal measured in a number asks the level first, then sends it with the goal text (NP-3, NP-10)', async () => {
    pro.value = true;
    renderHero(goalWith(result()));
    await userEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    const dialog = screen.getByRole('dialog');
    const input = within(dialog).getByLabelText('You started this plan at 3 km. Where are you now?');
    expect(input).toHaveValue('');
    await userEvent.type(input, '6.5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(seenRoute().pathname).toBe('/onboarding');
    expect(seenRoute().state).toMatchObject({
      switchGoal: true,
      draftGoal: 'Run 10 km without stopping',
      nextPlan: { request: { fromGoalId: 'g1', mode: 'keep_going', level: 6.5 }, startsFrom: '6.5 km' },
    });
  });

  it('any other goal goes straight on, with no level', async () => {
    pro.value = true;
    renderHero(goalWith(result({ kind: 'other', unit: null, start: null, startValue: null }), 'Write a novel'));
    await userEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(seenRoute().state).toMatchObject({ nextPlan: { request: { fromGoalId: 'g1', mode: 'keep_going' }, startsFrom: null } });
  });
});
